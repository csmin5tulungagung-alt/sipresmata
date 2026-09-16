/**
 * ============================================================================
 * SIPRESMATA - KIOSK SCANNER ENGINE & AUDIO SYNTHESIZER
 * Real-time Webcam Barcode/QR Scanning & Indonesian Voice Synthesis
 * ============================================================================
 */

import { API } from './api.js';

let html5QrCode = null;
let isScanning = false;
let isProcessing = false;
let lastScannedCode = "";
let lastScannedTime = 0;
const SCAN_COOLDOWN_MS = 2500; // 2.5 Detik jeda antar-scan kartu yang sama

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
    if (typeof Html5Qrcode === 'undefined') {
      console.warn("Html5Qrcode library not loaded yet.");
      return;
    }

    html5QrCode = new Html5Qrcode("camera-reader");

    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        cameraSelectElement.innerHTML = devices.map(d => 
          `<option value="${d.id}">${d.label || 'Kamera ' + d.id}</option>`
        ).join("");
        
        // Pilih kamera belakang secara default jika ada
        const backCamera = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("belakang"));
        if (backCamera) {
          cameraSelectElement.value = backCamera.id;
        }
      } else {
        cameraSelectElement.innerHTML = `<option value="">Tidak ada kamera terdeteksi</option>`;
      }
    } catch (err) {
      console.error("Error accessing camera list:", err);
      cameraSelectElement.innerHTML = `<option value="">Izin kamera ditolak</option>`;
    }
  },

  async start(cameraId, onScanSuccess) {
    if (!html5QrCode || isScanning) return;

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.333333
    };

    try {
      await html5QrCode.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" },
        config,
        async (decodedText) => {
          const now = Date.now();
          const cleanCode = (decodedText || "").trim();
          if (!cleanCode) return;

          if (cleanCode === lastScannedCode && (now - lastScannedTime) < SCAN_COOLDOWN_MS) {
            return; // Hindari double trigger beruntun
          }

          if (isProcessing) return; // Mencegah tumpukan request

          lastScannedCode = cleanCode;
          lastScannedTime = now;

          await this.processBarcode(cleanCode, onScanSuccess);
        },
        () => {
          // Frame scanner decoding, ignore standard frame drops
        }
      );
      isScanning = true;
    } catch (err) {
      console.error("Failed to start Html5Qrcode:", err);
    }
  },

  async stop() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
        isScanning = false;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  },

  async processBarcode(barcode, callback) {
    const cleanBarcode = (barcode || "").trim();
    if (!cleanBarcode) return;

    if (isProcessing) return;
    isProcessing = true;

    try {
      playAudioBeep("success");

      const response = await API.scanBarcode(cleanBarcode);
      if (response && response.status === "success") {
        if (response.data && response.data.status_kehadiran === "TERLAMBAT") {
          playAudioBeep("warning");
        } else {
          playAudioBeep("success");
        }

        if (response.data && response.data.audio_prompt) {
          speakText(response.data.audio_prompt);
        }
      } else {
        playAudioBeep("error");
        speakText(response ? (response.message || "Peringatan presensi.") : "Presensi tidak dikenali.");
      }

      if (callback) callback(response);
    } catch (err) {
      playAudioBeep("error");
      if (callback) callback({ status: "error", message: "Gagal menghubungi server database." });
    } finally {
      isProcessing = false;
    }
  }
};
