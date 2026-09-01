/**
 * ============================================================================
 * SIPRESMATA - JADWAL OPERASIONAL PRESENSI SISWA MODULE
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung
 * ============================================================================
 */

import { CONFIG, saveSchedule } from './config.js';
import { API } from './api.js';

export const SCHEDULE_PAGE = {
  clockInterval: null,
  isFormBound: false,

  // Inisialisasi Halaman Jadwal Operasional
  async init() {
    this.startLiveClock();
    this.loadCurrentSettings();
    this.updateTimelineUI();
    this.bindEvents();

    // Coba ambil update terbaru dari server GAS / Spreadsheet
    try {
      const res = await API.getPengaturan();
      if (res && res.data) {
        const d = res.data;
        const scheduleUpdates = {};
        if (d.jam_masuk_mulai) scheduleUpdates.MASUK_MULAI = d.jam_masuk_mulai;
        if (d.jam_masuk_batas) scheduleUpdates.MASUK_BATAS = d.jam_masuk_batas;
        if (d.jam_masuk_maksimal) scheduleUpdates.MASUK_MAKSIMAL = d.jam_masuk_maksimal;
        if (d.jam_pulang_mulai) scheduleUpdates.PULANG_MULAI = d.jam_pulang_mulai;
        if (d.jam_pulang_batas) scheduleUpdates.PULANG_BATAS = d.jam_pulang_batas;
        if (d.jumat_khusus_enabled !== undefined) scheduleUpdates.JUMAT_KHUSUS_ENABLED = (d.jumat_khusus_enabled === "true" || d.jumat_khusus_enabled === true);
        if (d.jam_pulang_jumat_mulai) scheduleUpdates.JAM_PULANG_JUMAT_MULAI = d.jam_pulang_jumat_mulai;
        if (d.jam_pulang_jumat_batas) scheduleUpdates.JAM_PULANG_JUMAT_BATAS = d.jam_pulang_jumat_batas;
        if (d.libur_minggu_enabled !== undefined) scheduleUpdates.LIBUR_MINGGU_ENABLED = (d.libur_minggu_enabled === "true" || d.libur_minggu_enabled === true);
        if (d.bypass_schedule_test_mode !== undefined) scheduleUpdates.BYPASS_SCHEDULE_TEST_MODE = (d.bypass_schedule_test_mode === "true" || d.bypass_schedule_test_mode === true);

        saveSchedule(scheduleUpdates);
        this.loadCurrentSettings();
        this.updateTimelineUI();
      }
    } catch (e) {
      console.warn("Gagal sinkronisasi jadwal dari server, menggunakan cache lokal:", e);
    }
  },

  // 1. Live Digital Clock & Sesi Status Tracker
  startLiveClock() {
    if (this.clockInterval) clearInterval(this.clockInterval);

    const updateStatus = () => {
      const now = new Date();
      const timeStr = now.toTimeString().substring(0, 8);
      const dayIdx = now.getDay();
      const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][dayIdx];
      const tanggalStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      const clockEl = document.getElementById("schedule-live-clock");
      const dateEl = document.getElementById("schedule-live-date");
      const statusBadge = document.getElementById("schedule-current-session-badge");
      const descEl = document.getElementById("schedule-session-detail-desc");

      if (clockEl) clockEl.textContent = `${timeStr} WIB`;
      if (dateEl) dateEl.textContent = `${namaHari}, ${tanggalStr}`;

      const sessionInfo = this.evaluateCurrentSession(now);

      if (statusBadge) {
        statusBadge.innerHTML = `<span class="status-indicator-dot ${sessionInfo.dotClass}"></span> ${sessionInfo.badgeLabel}`;
        statusBadge.className = `schedule-status-badge ${sessionInfo.badgeClass}`;
      }

      if (descEl) {
        descEl.innerHTML = sessionInfo.description;
      }
    };

    updateStatus();
    this.clockInterval = setInterval(updateStatus, 1000);
  },

  // Evaluasi Status Sesi Berdasarkan Waktu Sekarang
  evaluateCurrentSession(dateObj) {
    const now = dateObj || new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    const dayOfWeek = now.getDay();

    if (dayOfWeek === 0 && CONFIG.SCHEDULE.LIBUR_MINGGU_ENABLED && !CONFIG.SCHEDULE.BYPASS_SCHEDULE_TEST_MODE) {
      return {
        badgeLabel: "HARI LIBUR (MINGGU)",
        badgeClass: "badge-holiday",
        dotClass: "dot-gray",
        description: "Hari Minggu adalah hari libur mingguan madrasah. Pemindai presensi otomatis dinonaktifkan."
      };
    }

    const masukMulai = CONFIG.SCHEDULE.MASUK_MULAI || "06:00:00";
    const masukBatas = CONFIG.SCHEDULE.MASUK_BATAS || "07:15:00";
    const masukMaks = CONFIG.SCHEDULE.MASUK_MAKSIMAL || "08:30:00";

    let pulangMulai = CONFIG.SCHEDULE.PULANG_MULAI || "12:30:00";
    let pulangBatas = CONFIG.SCHEDULE.PULANG_BATAS || "16:00:00";

    if (dayOfWeek === 5 && CONFIG.SCHEDULE.JUMAT_KHUSUS_ENABLED) {
      pulangMulai = CONFIG.SCHEDULE.JAM_PULANG_JUMAT_MULAI || "11:00:00";
      pulangBatas = CONFIG.SCHEDULE.JAM_PULANG_JUMAT_BATAS || "14:00:00";
    }

    if (CONFIG.SCHEDULE.BYPASS_SCHEDULE_TEST_MODE) {
      return {
        badgeLabel: "MODE BEBAS UJI COBA (BYPASS AKTIF)",
        badgeClass: "badge-bypass",
        dotClass: "dot-purple",
        description: `Mode Demo/Uji Coba aktif. Pemindaian presensi diizinkan 24 jam tanpa pembatasan jam operasional.`
      };
    }

    if (timeStr >= masukMulai && timeStr <= masukMaks) {
      if (timeStr <= masukBatas) {
        return {
          badgeLabel: "SESI MASUK — TEPAT WAKTU",
          badgeClass: "badge-active-green",
          dotClass: "dot-green",
          description: `Gerbang presensi pagi dibuka. Siswa yang tap kartu sekarang mendapatkan status <strong>HADIR TEPAT WAKTU</strong> (Batas: ${masukBatas.slice(0, 5)} WIB).`
        };
      } else {
        return {
          badgeLabel: "SESI MASUK — TERLAMBAT",
          badgeClass: "badge-warning-amber",
          dotClass: "dot-amber",
          description: `Siswa yang tap kartu sekarang tercatat <strong>TERLAMBAT</strong> (Tutup scan masuk: ${masukMaks.slice(0, 5)} WIB).`
        };
      }
    } else if (timeStr >= pulangMulai && timeStr <= pulangBatas) {
      return {
        badgeLabel: "SESI PULANG — AKTIF",
        badgeClass: "badge-active-cyan",
        dotClass: "dot-cyan",
        description: `Sesi kepulangan siswa dibuka sampai pukul <strong>${pulangBatas.slice(0, 5)} WIB</strong>.`
      };
    } else if (timeStr > masukMaks && timeStr < pulangMulai) {
      return {
        badgeLabel: "JEDA KBM / BELAJAR",
        badgeClass: "badge-recess-blue",
        dotClass: "dot-blue",
        description: `Kegiatan Belajar Mengajar sedang berlangsung. Sesi kepulangan dibuka mulai pukul <strong>${pulangMulai.slice(0, 5)} WIB</strong>.`
      };
    } else {
      return {
        badgeLabel: "DI LUAR JAM OPERASIONAL",
        badgeClass: "badge-closed-gray",
        dotClass: "dot-gray",
        description: `Pemindai presensi ditutup. Sesi masuk berikutnya dibuka pukul <strong>${masukMulai.slice(0, 5)} WIB</strong>.`
      };
    }
  },

  // 2. Isi Formulir dari Nilai Konfigurasi
  loadCurrentSettings() {
    const s = CONFIG.SCHEDULE;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ? val.substring(0, 5) : "";
    };

    setVal("sched-masuk-mulai", s.MASUK_MULAI);
    setVal("sched-masuk-batas", s.MASUK_BATAS);
    setVal("sched-masuk-maks", s.MASUK_MAKSIMAL);
    setVal("sched-pulang-mulai", s.PULANG_MULAI);
    setVal("sched-pulang-batas", s.PULANG_BATAS);

    // Jumat Khusus
    const jumatCheck = document.getElementById("sched-jumat-khusus-check");
    if (jumatCheck) jumatCheck.checked = Boolean(s.JUMAT_KHUSUS_ENABLED);

    setVal("sched-jumat-pulang-mulai", s.JAM_PULANG_JUMAT_MULAI);
    setVal("sched-jumat-pulang-batas", s.JAM_PULANG_JUMAT_BATAS);

    // Opsi Tambahan
    const liburMingguCheck = document.getElementById("sched-libur-minggu-check");
    if (liburMingguCheck) liburMingguCheck.checked = Boolean(s.LIBUR_MINGGU_ENABLED);

    const bypassCheck = document.getElementById("sched-bypass-test-check");
    if (bypassCheck) bypassCheck.checked = Boolean(s.BYPASS_SCHEDULE_TEST_MODE);

    this.toggleFridayFields(Boolean(s.JUMAT_KHUSUS_ENABLED));
  },

  toggleFridayFields(isEnabled) {
    const container = document.getElementById("sched-friday-fields-container");
    if (container) {
      container.style.opacity = isEnabled ? "1" : "0.5";
      container.style.pointerEvents = isEnabled ? "auto" : "none";
    }
  },

  // 3. Update Visual Timeline UI
  updateTimelineUI() {
    const s = CONFIG.SCHEDULE;
    const tMasukMulai = (s.MASUK_MULAI || "06:00").substring(0, 5);
    const tMasukBatas = (s.MASUK_BATAS || "07:15").substring(0, 5);
    const tMasukMaks = (s.MASUK_MAKSIMAL || "08:30").substring(0, 5);
    const tPulangMulai = (s.PULANG_MULAI || "12:30").substring(0, 5);
    const tPulangBatas = (s.PULANG_BATAS || "16:00").substring(0, 5);

    const el1 = document.getElementById("timeline-time-masuk-mulai");
    const el2 = document.getElementById("timeline-time-masuk-batas");
    const el3 = document.getElementById("timeline-time-masuk-maks");
    const el4 = document.getElementById("timeline-time-pulang-mulai");
    const el5 = document.getElementById("timeline-time-pulang-batas");

    if (el1) el1.textContent = tMasukMulai;
    if (el2) el2.textContent = tMasukBatas;
    if (el3) el3.textContent = tMasukMaks;
    if (el4) el4.textContent = tPulangMulai;
    if (el5) el5.textContent = tPulangBatas;
  },

  // 4. Event Binding
  bindEvents() {
    if (this.isFormBound) return;
    this.isFormBound = true;

    // Toggle Jumat
    const jumatCheck = document.getElementById("sched-jumat-khusus-check");
    if (jumatCheck) {
      jumatCheck.addEventListener("change", (e) => {
        this.toggleFridayFields(e.target.checked);
      });
    }

    // Form Submit
    const form = document.getElementById("form-schedule-settings");
    const btnSave = document.getElementById("btn-save-schedule");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (btnSave) {
          btnSave.disabled = true;
          btnSave.innerHTML = `⏳ Menyimpan Jadwal...`;
        }

        const newSchedule = {
          MASUK_MULAI: document.getElementById("sched-masuk-mulai")?.value || "06:00",
          MASUK_BATAS: document.getElementById("sched-masuk-batas")?.value || "07:15",
          MASUK_MAKSIMAL: document.getElementById("sched-masuk-maks")?.value || "08:30",
          PULANG_MULAI: document.getElementById("sched-pulang-mulai")?.value || "12:30",
          PULANG_BATAS: document.getElementById("sched-pulang-batas")?.value || "16:00",
          JUMAT_KHUSUS_ENABLED: document.getElementById("sched-jumat-khusus-check")?.checked || false,
          JAM_PULANG_JUMAT_MULAI: document.getElementById("sched-jumat-pulang-mulai")?.value || "11:00",
          JAM_PULANG_JUMAT_BATAS: document.getElementById("sched-jumat-pulang-batas")?.value || "14:00",
          LIBUR_MINGGU_ENABLED: document.getElementById("sched-libur-minggu-check")?.checked || false,
          BYPASS_SCHEDULE_TEST_MODE: document.getElementById("sched-bypass-test-check")?.checked || false
        };

        // Simpan ke local config
        saveSchedule(newSchedule);
        this.updateTimelineUI();

        // Kirim ke backend Spreadsheet tab pengaturan_sekolah
        const serverPayload = {
          jam_masuk_mulai: `${newSchedule.MASUK_MULAI}:00`,
          jam_masuk_batas: `${newSchedule.MASUK_BATAS}:00`,
          jam_masuk_maksimal: `${newSchedule.MASUK_MAKSIMAL}:00`,
          jam_pulang_mulai: `${newSchedule.PULANG_MULAI}:00`,
          jam_pulang_batas: `${newSchedule.PULANG_BATAS}:00`,
          jumat_khusus_enabled: String(newSchedule.JUMAT_KHUSUS_ENABLED),
          jam_pulang_jumat_mulai: `${newSchedule.JAM_PULANG_JUMAT_MULAI}:00`,
          jam_pulang_jumat_batas: `${newSchedule.JAM_PULANG_JUMAT_BATAS}:00`,
          libur_minggu_enabled: String(newSchedule.LIBUR_MINGGU_ENABLED),
          bypass_schedule_test_mode: String(newSchedule.BYPASS_SCHEDULE_TEST_MODE)
        };

        try {
          const res = await API.updatePengaturan(serverPayload);
          if (typeof showToast === 'function') {
            showToast(res.message || "✓ Jadwal operasional presensi berhasil disimpan ke Cloud Spreadsheet.", "success");
          }
        } catch (err) {
          if (typeof showToast === 'function') {
            showToast("✓ Jadwal berhasil disimpan di penyimpanan browser lokal.", "success");
          }
        } finally {
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `💾 Simpan Jadwal Operasional`;
          }
        }
      });
    }

    // Tombol Reset ke Default Madrasah
    const btnReset = document.getElementById("btn-reset-schedule-default");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (confirm("Kembalikan seluruh jadwal operasional ke pengaturan standar MIN 5 Tulungagung?")) {
          const defaultSched = {
            MASUK_MULAI: "06:00",
            MASUK_BATAS: "07:15",
            MASUK_MAKSIMAL: "08:30",
            PULANG_MULAI: "12:30",
            PULANG_BATAS: "16:00",
            JUMAT_KHUSUS_ENABLED: true,
            JAM_PULANG_JUMAT_MULAI: "11:00",
            JAM_PULANG_JUMAT_BATAS: "14:00",
            LIBUR_MINGGU_ENABLED: true,
            BYPASS_SCHEDULE_TEST_MODE: false
          };
          saveSchedule(defaultSched);
          this.loadCurrentSettings();
          this.updateTimelineUI();
          if (typeof showToast === 'function') {
            showToast("Jadwal dikembalikan ke standar default. Klik 'Simpan' untuk mengirim ke server.", "info");
          }
        }
      });
    }

    // Live Time Simulator
    const btnSimulate = document.getElementById("btn-run-schedule-sim");
    if (btnSimulate) {
      btnSimulate.addEventListener("click", () => {
        this.runSimulation();
      });
    }
  },

  // 5. Live Simulator Evaluasi Waktu Presensi
  runSimulation() {
    const inputTime = document.getElementById("sim-input-time")?.value || "07:20";
    const selectDay = parseInt(document.getElementById("sim-select-day")?.value || "1", 10);
    const simResultBox = document.getElementById("sim-result-box");

    if (!simResultBox) return;

    const timeFormatted = inputTime.length === 5 ? `${inputTime}:00` : inputTime;
    const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][selectDay];

    const dummyDate = new Date();
    dummyDate.setHours(parseInt(inputTime.split(":")[0], 10));
    dummyDate.setMinutes(parseInt(inputTime.split(":")[1], 10));
    dummyDate.setSeconds(0);

    // Cek Hari Libur
    if (selectDay === 0 && CONFIG.SCHEDULE.LIBUR_MINGGU_ENABLED && !CONFIG.SCHEDULE.BYPASS_SCHEDULE_TEST_MODE) {
      simResultBox.style.display = "block";
      simResultBox.className = "sim-result-card sim-card-danger";
      simResultBox.innerHTML = `
        <div class="sim-result-header">
          <span class="sim-icon">🏖️</span>
          <strong>HASIL: DITOLAK (HARI LIBUR MINGGU)</strong>
        </div>
        <p style="margin-top:0.35rem;font-size:0.85rem;">Pada hari <strong>Minggu</strong>, scanner presensi dalam kondisi non-aktif.</p>
      `;
      return;
    }

    const masukMulai = CONFIG.SCHEDULE.MASUK_MULAI || "06:00:00";
    const masukBatas = CONFIG.SCHEDULE.MASUK_BATAS || "07:15:00";
    const masukMaks = CONFIG.SCHEDULE.MASUK_MAKSIMAL || "08:30:00";

    let pulangMulai = CONFIG.SCHEDULE.PULANG_MULAI || "12:30:00";
    let pulangBatas = CONFIG.SCHEDULE.PULANG_BATAS || "16:00:00";

    if (selectDay === 5 && CONFIG.SCHEDULE.JUMAT_KHUSUS_ENABLED) {
      pulangMulai = CONFIG.SCHEDULE.JAM_PULANG_JUMAT_MULAI || "11:00:00";
      pulangBatas = CONFIG.SCHEDULE.JAM_PULANG_JUMAT_BATAS || "14:00:00";
    }

    function hitungMenit(jamA, jamB) {
      try {
        const [hA, mA] = jamA.split(":").map(Number);
        const [hB, mB] = jamB.split(":").map(Number);
        return Math.max(0, (hB * 60 + mB) - (hA * 60 + mA));
      } catch (e) { return 0; }
    }

    simResultBox.style.display = "block";

    if (timeFormatted >= masukMulai && timeFormatted <= masukMaks) {
      if (timeFormatted <= masukBatas) {
        simResultBox.className = "sim-result-card sim-card-success";
        simResultBox.innerHTML = `
          <div class="sim-result-header">
            <span class="sim-icon">✅</span>
            <strong>HASIL: SESI MASUK — HADIR TEPAT WAKTU</strong>
          </div>
          <div class="sim-details-grid">
            <div><strong>Waktu Scan:</strong> ${inputTime} WIB (${namaHari})</div>
            <div><strong>Status Kehadiran:</strong> <span class="badge badge-success">HADIR</span></div>
            <div><strong>Keterlambatan:</strong> 0 menit</div>
            <div><strong>Notifikasi Audio:</strong> <em>"Selamat pagi Muhammad Faishol. Absen masuk berhasil, tepat waktu."</em></div>
          </div>
        `;
      } else {
        const telat = hitungMenit(masukBatas, timeFormatted);
        simResultBox.className = "sim-result-card sim-card-warning";
        simResultBox.innerHTML = `
          <div class="sim-result-header">
            <span class="sim-icon">⚠️</span>
            <strong>HASIL: SESI MASUK — TERLAMBAT ${telat} MENIT</strong>
          </div>
          <div class="sim-details-grid">
            <div><strong>Waktu Scan:</strong> ${inputTime} WIB (${namaHari})</div>
            <div><strong>Status Kehadiran:</strong> <span class="badge badge-warning">TERLAMBAT</span></div>
            <div><strong>Keterlambatan:</strong> ${telat} menit (Batas: ${masukBatas.slice(0, 5)} WIB)</div>
            <div><strong>Notifikasi Audio:</strong> <em>"Selamat pagi Muhammad Faishol. Absen masuk tercatat, Anda terlambat ${telat} menit."</em></div>
          </div>
        `;
      }
    } else if (timeFormatted >= pulangMulai && timeFormatted <= pulangBatas) {
      simResultBox.className = "sim-result-card sim-card-cyan";
      simResultBox.innerHTML = `
        <div class="sim-result-header">
          <span class="sim-icon">🏠</span>
          <strong>HASIL: SESI PULANG — BERHASIL TERCATAT</strong>
        </div>
        <div class="sim-details-grid">
          <div><strong>Waktu Scan:</strong> ${inputTime} WIB (${namaHari})</div>
          <div><strong>Status:</strong> Kepulangan Siswa Tercatat</div>
          <div><strong>Notifikasi Audio:</strong> <em>"Selamat siang Muhammad Faishol. Presensi kepulangan berhasil dicatat. Hati-hati di jalan."</em></div>
        </div>
      `;
    } else {
      simResultBox.className = "sim-result-card sim-card-danger";
      simResultBox.innerHTML = `
        <div class="sim-result-header">
          <span class="sim-icon">❌</span>
          <strong>HASIL: DI LUAR JAM OPERASIONAL (OUT_OF_SCHEDULE)</strong>
        </div>
        <p style="margin-top:0.35rem;font-size:0.85rem;">Pada jam <strong>${inputTime} WIB</strong> hari <strong>${namaHari}</strong> pemindaian barcode ditolak sistem. Sesi Masuk: ${masukMulai.slice(0,5)}–${masukMaks.slice(0,5)} WIB. Sesi Pulang: ${pulangMulai.slice(0,5)}–${pulangBatas.slice(0,5)} WIB.</p>
      `;
    }
  }
};
