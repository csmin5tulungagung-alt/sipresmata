/**
 * ============================================================================
 * SIPRESMATA - KIOSK SCANNER ENGINE & AUDIO SYNTHESIZER
 * Real-time Webcam Barcode/QR Scanning & Indonesian Voice Synthesis
 * ============================================================================
 */

import { API } from './api.js';
import { CONFIG } from './config.js';

let html5QrCode = null;
let isScanning = false;
let lastScannedCode = "";
let lastScannedTime = 0;
const SAME_CODE_COOLDOWN_MS = 1800; // 1.8 Detik jeda antar-scan untuk kartu yang SAMA
const DIFF_CODE_COOLDOWN_MS = 500;  // Hanya 0.5 Detik jeda jika kartu siswa BERBEDA (antrean cepat)

// Web Audio API Synthesizer (Lazy initialized to prevent browser Autoplay Policy warning)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && (typeof window !== "undefined")) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playAudioBeep(type = "success") {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === "success") {
    // 2-tone bright melodic chime
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } else if (type === "warning") {
    // Double beep warning
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(370, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else {
    // Low buzz error sound
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(160, now + 0.15);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

// Indonesian Text-to-Speech (Web Speech API) with Voice Preloader
let cachedIdVoice = null;

function resolveIndonesianVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang.includes("id") || v.lang.includes("ID") || v.name.toLowerCase().includes("indonesian")) || null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedIdVoice = resolveIndonesianVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedIdVoice = resolveIndonesianVoice();
  };
}

export function speakText(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  
  try {
    window.speechSynthesis.cancel(); // Hentikan suara sebelumnya jika masih ada
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    if (!cachedIdVoice) {
      cachedIdVoice = resolveIndonesianVoice();
    }
    if (cachedIdVoice) {
      utterance.voice = cachedIdVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}

export const SCANNER = {
  async init(cameraSelectElement) {
    let retries = 0;
    while (typeof Html5Qrcode === 'undefined' && retries < 20) {
      await new Promise(r => setTimeout(r, 150));
      retries++;
    }

    if (typeof Html5Qrcode === 'undefined') {
      console.warn("Html5Qrcode library not loaded yet.");
      return;
    }

    try {
      html5QrCode = new Html5Qrcode("camera-reader", { verbose: false });
    } catch (e) {
      console.warn("Html5Qrcode instantiation fallback:", e);
    }

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        if (cameraSelectElement) {
          cameraSelectElement.innerHTML = devices.map((d, idx) => 
            `<option value="${d.id}">${d.label || 'Kamera ' + (idx + 1)}</option>`
          ).join("");
          
          const savedCameraId = localStorage.getItem("SIPRESMATA_PREFERRED_CAMERA");
          const hasSaved = savedCameraId && devices.some(d => d.id === savedCameraId);

          if (hasSaved) {
            cameraSelectElement.value = savedCameraId;
          } else {
            const usbCamera = devices.find(d => {
              const lbl = (d.label || "").toLowerCase();
              return lbl.includes("usb") || lbl.includes("uvc") || lbl.includes("webcam") || lbl.includes("external");
            });

            const frontCamera = devices.find(d => {
              const lbl = (d.label || "").toLowerCase();
              return lbl.includes("front") || lbl.includes("depan") || lbl.includes("user");
            });

            const chosen = usbCamera || frontCamera || devices[0];
            if (chosen) {
              cameraSelectElement.value = chosen.id;
              localStorage.setItem("SIPRESMATA_PREFERRED_CAMERA", chosen.id);
            }
          }
        }
      } else if (cameraSelectElement) {
        cameraSelectElement.innerHTML = `<option value="">Kamera Default Sistem</option>`;
      }
    } catch (err) {
      console.warn("Daftar kamera belum diizinkan atau kosong:", err);
      if (cameraSelectElement) {
        cameraSelectElement.innerHTML = `<option value="">Kamera Default Sistem</option>`;
      }
    }
  },

  async start(cameraId, onScanSuccess) {
    if (isScanning) {
      await this.stop();
    }

    const config = {
      fps: 20,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        return {
          width: Math.min(Math.floor(viewfinderWidth * 0.88), 380),
          height: Math.min(Math.floor(minEdge * 0.72), 250)
        };
      },
      aspectRatio: 1.333333
    };

    const scanHandler = async (decodedText) => {
      const now = Date.now();
      const cleanCode = (decodedText || "").trim();
      if (!cleanCode) return;

      const isSameCode = (cleanCode === lastScannedCode);
      const elapsed = now - lastScannedTime;

      if (isSameCode && elapsed < SAME_CODE_COOLDOWN_MS) {
        return;
      }
      if (!isSameCode && elapsed < DIFF_CODE_COOLDOWN_MS) {
        return;
      }

      lastScannedCode = cleanCode;
      lastScannedTime = now;

      await this.processBarcode(cleanCode, onScanSuccess);
    };

    const overlay = document.getElementById("camera-placeholder-overlay");
    const toggleBtn = document.getElementById("btn-toggle-camera");

    const tryStart = async (target) => {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("camera-reader", { verbose: false });
      }
      await html5QrCode.start(target, config, scanHandler, () => {});
      isScanning = true;
      if (overlay) overlay.style.display = "none";
      if (toggleBtn) {
        toggleBtn.innerHTML = "⏹️ Stop";
        toggleBtn.className = "btn btn-secondary btn-sm";
      }
    };

    try {
      // Prioritas 1: Gunakan cameraId yang dipilih user jika ada
      if (cameraId && typeof cameraId === "string" && cameraId.trim().length > 0) {
        try {
          await tryStart(cameraId.trim());
          return;
        } catch (idErr) {
          console.warn("Gagal memulai dengan cameraId spesifik, mencoba facingMode user:", idErr);
        }
      }

      // Prioritas 2: Kamera depan (user facing)
      try {
        await tryStart({ facingMode: "user" });
        return;
      } catch (userErr) {
        console.warn("Gagal memulai dengan facingMode user, mencoba facingMode environment:", userErr);
      }

      // Prioritas 3: Kamera belakang (environment)
      try {
        await tryStart({ facingMode: "environment" });
        return;
      } catch (envErr) {
        console.warn("Gagal memulai dengan facingMode environment, mencoba getCameras():", envErr);
      }

      // Prioritas 4: Ambil kamera pertama yang terdeteksi
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        await tryStart(devices[0].id);
        return;
      }

      throw new Error("Tidak ada perangkat kamera yang dapat diakses.");
    } catch (err) {
      console.error("Gagal mengaktifkan kamera pemindai:", err);
      isScanning = false;
      if (overlay) {
        overlay.style.display = "flex";
        overlay.innerHTML = `
          <div class="camera-placeholder-icon">⚠️</div>
          <h4>Kamera Belum Aktif</h4>
          <p style="font-size: 0.76rem; max-width: 310px; margin: 0 auto 0.6rem; color: #94a3b8;">Klik tombol di bawah untuk memberikan izin kamera pada browser Anda.</p>
          <button id="btn-start-camera-overlay" class="btn btn-primary btn-sm" type="button">
            ▶ Izinkan & Mulai Kamera
          </button>
        `;
        const retryBtn = document.getElementById("btn-start-camera-overlay");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => this.start(null, onScanSuccess));
        }
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = "📷 Kamera";
        toggleBtn.className = "btn btn-primary btn-sm";
      }
    }
  },

  async stop() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    isScanning = false;
    const overlay = document.getElementById("camera-placeholder-overlay");
    const toggleBtn = document.getElementById("btn-toggle-camera");
    if (overlay) overlay.style.display = "flex";
    if (toggleBtn) {
      toggleBtn.innerHTML = "📷 Kamera";
      toggleBtn.className = "btn btn-primary btn-sm";
    }
  },

  isScanningNow() {
    return isScanning;
  },

  async processBarcode(barcode, callback) {
    const cleanBarcode = (barcode || "").trim();
    if (!cleanBarcode) return;

    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    const dayOfWeek = now.getDay();
    const s = CONFIG.SCHEDULE;

    // Evaluasi waktu presensi secara lokal (0 ms)
    const isBypass = s.BYPASS_SCHEDULE_TEST_MODE === true || String(s.BYPASS_SCHEDULE_TEST_MODE).toLowerCase() === "true";
    const isMinggu = dayOfWeek === 0 && (s.LIBUR_MINGGU_ENABLED === true || String(s.LIBUR_MINGGU_ENABLED).toLowerCase() === "true") && !isBypass;

    let isSesiMasuk = timeStr >= s.MASUK_MULAI && timeStr <= s.MASUK_MAKSIMAL;
    let isSesiPulang = timeStr >= s.PULANG_MULAI && timeStr <= s.PULANG_BATAS;
    if (dayOfWeek === 5 && (s.JUMAT_KHUSUS_ENABLED === true || String(s.JUMAT_KHUSUS_ENABLED).toLowerCase() === "true")) {
      isSesiPulang = timeStr >= s.JAM_PULANG_JUMAT_MULAI && timeStr <= s.JAM_PULANG_JUMAT_BATAS;
    }

    if (isBypass) {
      // Mode Bebas Uji Coba 24 Jam Aktif
      isSesiMasuk = timeStr < (s.PULANG_MULAI || "12:00:00");
      isSesiPulang = !isSesiMasuk;
    }

    // 1. Validasi Jadwal Operasional (SOP Opsi A)
    const isOutOfSchedule = isMinggu || (!isBypass && !isSesiMasuk && !isSesiPulang);

    // Cari data siswa di memori lokal untuk respon instan 0ms
    const instantStudent = (typeof API.findStudentLocally === 'function') 
      ? API.findStudentLocally(cleanBarcode) 
      : null;

    if (isOutOfSchedule) {
      playAudioBeep("error");

      let rejectMsg = "";
      if (isMinggu) {
        rejectMsg = "Hari ini libur mingguan (Minggu). Pemindaian presensi dinonaktifkan.";
      } else if (timeStr > s.MASUK_MAKSIMAL && timeStr < s.PULANG_MULAI) {
        rejectMsg = `Saat ini di luar jam operasional (KBM belajar mengajar sedang berlangsung, ${timeStr.slice(0, 5)} WIB). Sesi kepulangan dibuka pukul ${s.PULANG_MULAI.slice(0, 5)} WIB.`;
      } else {
        const arrHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        rejectMsg = `Saat ini di luar jam operasional hari ${arrHari[dayOfWeek]} (${timeStr.slice(0, 5)} WIB). Sesi Masuk: ${s.MASUK_MULAI.slice(0, 5)}–${s.MASUK_MAKSIMAL.slice(0, 5)} WIB. Sesi Pulang: ${s.PULANG_MULAI.slice(0, 5)}–${s.PULANG_BATAS.slice(0, 5)} WIB.`;
      }

      if (callback) {
        callback({
          status: "error",
          code: isMinggu ? "HOLIDAY_OFF" : "OUT_OF_SCHEDULE",
          message: rejectMsg,
          student: instantStudent
        });
      }

      speakText("Presensi ditolak. Saat ini di luar jam operasional.");
      return;
    }

    const isTerlambat = isSesiMasuk && timeStr > s.MASUK_BATAS;
    let keterlambatanMenit = 0;
    if (isTerlambat) {
      try {
        const [hA, mA] = s.MASUK_BATAS.split(":").map(Number);
        const [hB, mB] = timeStr.split(":").map(Number);
        keterlambatanMenit = Math.max(0, (hB * 60 + mB) - (hA * 60 + mA));
      } catch (e) {}
    }

    if (instantStudent) {
      // 1. Instan Bunyi Beep (< 5ms)
      playAudioBeep(isTerlambat ? "warning" : "success");

      // 2. Instan Render Tampilan di Layar (0 ms, Zero Delay!)
      if (callback) {
        callback({
          status: "pending",
          data: {
            nama_lengkap: instantStudent.nama_lengkap,
            kelas: instantStudent.nama_kelas || instantStudent.id_kelas,
            nisn: instantStudent.nisn,
            jenis_sesi: isSesiPulang ? "PULANG" : "MASUK",
            status_kehadiran: isTerlambat ? "TERLAMBAT" : "HADIR",
            jam_scan: timeStr,
            keterlambatan_menit: keterlambatanMenit,
            is_bypass: isBypass
          }
        });
      }

      // 3. Suara Text-to-Speech Langsung Menyapa Nama Siswa (< 15ms)
      const voiceGreeting = isBypass
        ? (isSesiMasuk 
            ? `Halo ${instantStudent.nama_lengkap}. Mode uji coba presensi masuk berhasil.` 
            : `Halo ${instantStudent.nama_lengkap}. Mode uji coba presensi pulang berhasil.`)
        : (isSesiMasuk
            ? (isTerlambat 
                ? `Selamat pagi ${instantStudent.nama_lengkap}. Anda terlambat ${keterlambatanMenit} menit.`
                : `Selamat pagi ${instantStudent.nama_lengkap}. Tepat waktu.`)
            : `Terima kasih ${instantStudent.nama_lengkap}. Selamat jalan dan hati-hati.`);
      speakText(voiceGreeting);
    } else {
      playAudioBeep("success");
    }

    // 4. Sinkronisasi Presensi ke Cloud Database di Latar Belakang
    try {
      const response = await API.scanBarcode(cleanBarcode);
      if (response && response.status === "success") {
        if (callback) callback(response);
      } else {
        // Jika server menolak (misal: sudah pernah scan hari ini atau di luar jadwal)
        playAudioBeep("error");
        if (response && response.message) {
          speakText(response.message);
        }
        if (callback) callback(response);
      }
    } catch (err) {
      if (!instantStudent && callback) {
        playAudioBeep("error");
        callback({ status: "error", message: "Gagal menghubungi server database." });
      }
    }
  }
};
