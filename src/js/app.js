/**
 * ============================================================================
 * SIPRESMATA - MASTER SPA ORCHESTRATOR
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung
 * ============================================================================
 */

import { CONFIG, saveApiUrl, saveClientKey } from './config.js';
import { API } from './api.js';
import { SCANNER, playAudioBeep } from './scanner.js';
import { ADMIN } from './admin.js';
import { CARD_GENERATOR } from './card-generator.js';
import { EXPORT } from './export.js';

// State App
let currentSessionUser = JSON.parse(localStorage.getItem("SIPRESMATA_ADMIN_USER")) || null;

document.addEventListener("DOMContentLoaded", () => {
  initLiveClock();
  initNavigation();
  initThemeToggle();
  initScannerView();
  initAdminForms();
  initSettingsView();

  ADMIN.populateClassSelects();
  updateAuthUI();
});

// 1. Live Clock & Session Indicator
function initLiveClock() {
  const clockElem = document.getElementById("live-digital-clock");
  const bannerSession = document.getElementById("kiosk-session-banner");

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " WIB";
    const dateStr = now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    if (clockElem) {
      clockElem.textContent = timeStr;
    }

    const t = now.toTimeString().split(" ")[0];
    if (bannerSession) {
      if (t >= CONFIG.SCHEDULE.MASUK_MULAI && t <= CONFIG.SCHEDULE.MASUK_MAKSIMAL) {
        const isLate = t > CONFIG.SCHEDULE.MASUK_BATAS;
        bannerSession.className = "session-badge-banner " + (isLate ? "session-tutup" : "session-masuk");
        bannerSession.innerHTML = `<span>🔔 Sesi Masuk Pagi ${isLate ? '(TERLAMBAT)' : '(NORMAL)'}</span> <span>Batas: ${CONFIG.SCHEDULE.MASUK_BATAS.substring(0, 5)} WIB</span>`;
      } else if (t >= CONFIG.SCHEDULE.PULANG_MULAI && t <= CONFIG.SCHEDULE.PULANG_BATAS) {
        bannerSession.className = "session-badge-banner session-pulang";
        bannerSession.innerHTML = `<span>🏠 Sesi Presensi Pulang</span> <span>Hingga: ${CONFIG.SCHEDULE.PULANG_BATAS.substring(0, 5)} WIB</span>`;
      } else {
        bannerSession.className = "session-badge-banner session-tutup";
        bannerSession.innerHTML = `<span>⏳ Gerbang Presensi Ditutup</span> <span>Masuk: ${CONFIG.SCHEDULE.MASUK_MULAI.substring(0, 5)} WIB</span>`;
      }
    }
  }

  update();
  setInterval(update, 1000);
}

// 2. Navigation SPA Tab Switcher
function initNavigation() {
  const tabBtns = document.querySelectorAll(".nav-tab-btn");
  const views = document.querySelectorAll(".view-section");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetView = btn.getAttribute("data-target");

      // Proteksi rute admin jika belum login
      if (targetView.startsWith("admin-") && !currentSessionUser) {
        openModal("modal-login-admin");
        return;
      }

      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      views.forEach(v => v.classList.remove("active"));
      const activeView = document.getElementById(targetView);
      if (activeView) activeView.classList.add("active");

      // Lifecycle hooks on view enter
      if (targetView === "view-kiosk-scanner") {
        const camSelect = document.getElementById("select-camera");
        if (camSelect && camSelect.value) {
          SCANNER.start(camSelect.value, handleScanFeedback);
        }
      } else {
        SCANNER.stop();
      }

      if (targetView === "admin-view-dashboard") ADMIN.loadDashboard();
      if (targetView === "admin-view-students") ADMIN.loadStudents();
      if (targetView === "admin-view-cards") CARD_GENERATOR.renderCards(document.getElementById("printable-cards-area"));
      if (targetView === "admin-view-rekap") {
        const tglMulai = document.getElementById("rekap-tgl-mulai").value || new Date().toISOString().split("T")[0];
        const tglAkhir = document.getElementById("rekap-tgl-akhir").value || new Date().toISOString().split("T")[0];
        ADMIN.loadRekap(tglMulai, tglAkhir);
      }
    });
  });
}

// 3. Scanner Kiosk Integration
function initScannerView() {
  const camSelect = document.getElementById("select-camera");
  const manualBarcodeBtn = document.getElementById("btn-submit-manual-code");
  const manualBarcodeInput = document.getElementById("input-manual-barcode");

  if (camSelect) {
    SCANNER.init(camSelect).then(() => {
      if (camSelect.value) {
        SCANNER.start(camSelect.value, handleScanFeedback);
      }
    });

    camSelect.addEventListener("change", () => {
      SCANNER.stop().then(() => {
        SCANNER.start(camSelect.value, handleScanFeedback);
      });
    });
  }

  if (manualBarcodeBtn && manualBarcodeInput) {
    manualBarcodeBtn.addEventListener("click", () => {
      const code = manualBarcodeInput.value.trim();
      if (code) {
        SCANNER.processBarcode(code, handleScanFeedback);
        manualBarcodeInput.value = "";
      }
    });

    manualBarcodeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        manualBarcodeBtn.click();
      }
    });
  }
}

function handleScanFeedback(res) {
  const resultCard = document.getElementById("scan-result-card");
  if (!resultCard) return;

  if (res.status === "success") {
    const data = res.data;
    const isLate = data.status_kehadiran === "TERLAMBAT";

    resultCard.innerHTML = `
      <div class="result-avatar-circle" style="${isLate ? 'background: linear-gradient(135deg, #f59e0b, #d97706);' : ''}">
        ${data.nama_lengkap.charAt(0)}
      </div>
      <h3 class="result-student-name">${data.nama_lengkap}</h3>
      <p class="result-student-meta">${data.kelas || '-'} • NISN: ${data.nisn || '-'}</p>
      
      <div class="status-tag ${isLate ? 'terlambat' : 'hadir'}">
        ${isLate ? '⚠️ TERLAMBAT' : '✅ HADIR TEPAT WAKTU'} (${data.jam_scan} WIB)
      </div>

      <p class="result-timestamp">${res.message}</p>
    `;
    showToast(`Presensi Berhasil: ${data.nama_lengkap}`, "success");
  } else {
    resultCard.innerHTML = `
      <div class="result-avatar-circle" style="background: linear-gradient(135deg, #ef4444, #b91c1c);">
        ✕
      </div>
      <h3 class="result-student-name" style="color: #f87171;">Presensi Ditolak</h3>
      <p class="result-student-meta">${res.message}</p>
      
      <div class="status-tag error">
        ${res.code || 'GAGAL'}
      </div>
    `;
    showToast(res.message, "danger");
  }
}

// 4. Admin Forms & Modals
function initAdminForms() {
  // Login Form
  const formLogin = document.getElementById("form-login-admin");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("login-username").value;
      const p = document.getElementById("login-password").value;

      const res = await API.loginAdmin(u, p);
      if (res.status === "success") {
        currentSessionUser = res.data;
        localStorage.setItem("SIPRESMATA_ADMIN_USER", JSON.stringify(currentSessionUser));
        closeModal("modal-login-admin");
        updateAuthUI();
        showToast("Login Berhasil! Selamat datang, " + currentSessionUser.nama_pengguna, "success");
        // Pindah ke tab dashboard
        document.querySelector('[data-target="admin-view-dashboard"]').click();
      } else {
        showToast(res.message, "danger");
      }
    });
  }

  // Logout Button
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      currentSessionUser = null;
      localStorage.removeItem("SIPRESMATA_ADMIN_USER");
      updateAuthUI();
      showToast("Anda telah keluar dari mode admin.", "info");
      document.querySelector('[data-target="view-kiosk-scanner"]').click();
    });
  }

  // Filter Rekap Form
  const formFilterRekap = document.getElementById("form-filter-rekap");
  if (formFilterRekap) {
    formFilterRekap.addEventListener("submit", (e) => {
      e.preventDefault();
      const tglMulai = document.getElementById("rekap-tgl-mulai").value;
      const tglAkhir = document.getElementById("rekap-tgl-akhir").value;
      const idKelas = document.getElementById("rekap-filter-kelas").value;
      ADMIN.loadRekap(tglMulai, tglAkhir, idKelas);
    });
  }

  // Export Buttons
  const btnExportCSV = document.getElementById("btn-export-csv");
  const btnPrintReport = document.getElementById("btn-print-report");

  if (btnExportCSV) {
    btnExportCSV.addEventListener("click", () => {
      if (window.currentRekapData && window.currentRekapData.items) {
        EXPORT.downloadCSV(window.currentRekapData.items, `rekap_presensi_${Date.now()}.csv`);
        showToast("File CSV berhasil diunduh.", "success");
      } else {
        showToast("Tampilkan data rekap terlebih dahulu.", "warning");
      }
    });
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener("click", () => {
      if (window.currentRekapData) {
        const { periode, idKelas, summary, items } = window.currentRekapData;
        EXPORT.printFormalReport(periode, idKelas, summary, items);
      } else {
        showToast("Tampilkan data rekap terlebih dahulu.", "warning");
      }
    });
  }

  // Manual Absen Form
  const formManualAbsen = document.getElementById("form-manual-absen");
  if (formManualAbsen) {
    formManualAbsen.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idSiswa = document.getElementById("manual-absen-siswa").value;
      const status = document.getElementById("manual-absen-status").value;
      const keterangan = document.getElementById("manual-absen-keterangan").value;
      const tanggal = document.getElementById("manual-absen-tanggal").value || new Date().toISOString().split("T")[0];

      if (!idSiswa) {
        showToast("Pilih siswa terlebih dahulu.", "warning");
        return;
      }

      const res = await API.submitManualAbsen({
        id_siswa: idSiswa,
        status_kehadiran: status,
        keterangan: keterangan,
        tanggal: tanggal
      });

      if (res.status === "success") {
        showToast(res.message, "success");
        formManualAbsen.reset();
      } else {
        showToast(res.message, "danger");
      }
    });
  }

  // Filter Cards by Class
  const filterCardClass = document.getElementById("filter-card-kelas");
  if (filterCardClass) {
    filterCardClass.addEventListener("change", () => {
      CARD_GENERATOR.renderCards(document.getElementById("printable-cards-area"), filterCardClass.value);
    });
  }

  const btnPrintAllCards = document.getElementById("btn-print-cards");
  if (btnPrintAllCards) {
    btnPrintAllCards.addEventListener("click", () => {
      CARD_GENERATOR.printCards();
    });
  }

  // Student Form Modal Add/Edit
  const formStudent = document.getElementById("form-student-modal");
  if (formStudent) {
    formStudent.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        id_siswa: document.getElementById("student-modal-id").value,
        nisn: document.getElementById("student-modal-nisn").value,
        nama_lengkap: document.getElementById("student-modal-nama").value,
        id_kelas: document.getElementById("student-modal-kelas").value,
        jenis_kelamin: document.getElementById("student-modal-jk").value,
        no_hp_ortu: document.getElementById("student-modal-hp").value
      };

      const res = await API.saveSiswa(data);
      if (res.status === "success") {
        showToast(res.message, "success");
        closeModal("modal-student-form");
        ADMIN.loadStudents();
      } else {
        showToast(res.message, "danger");
      }
    });
  }
}

// 5. Global Window Bridges for Table Actions
window.editStudent = async function(idSiswa) {
  const res = await API.getSiswa();
  const student = (res.data || []).find(s => s.id_siswa === idSiswa);
  if (!student) return;

  document.getElementById("student-modal-title").textContent = "Edit Data Siswa";
  document.getElementById("student-modal-id").value = student.id_siswa;
  document.getElementById("student-modal-nisn").value = student.nisn;
  document.getElementById("student-modal-nama").value = student.nama_lengkap;
  document.getElementById("student-modal-kelas").value = student.id_kelas;
  document.getElementById("student-modal-jk").value = student.jenis_kelamin || "L";
  document.getElementById("student-modal-hp").value = student.no_hp_ortu || "";

  openModal("modal-student-form");
};

window.deleteStudent = async function(idSiswa, nama) {
  if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${nama}?`)) {
    const res = await API.deleteSiswa(idSiswa);
    if (res.status === "success") {
      showToast(res.message, "success");
      ADMIN.loadStudents();
    }
  }
};

window.openAddStudentModal = function() {
  document.getElementById("student-modal-title").textContent = "Tambah Siswa Baru";
  document.getElementById("form-student-modal").reset();
  document.getElementById("student-modal-id").value = "";
  openModal("modal-student-form");
};

// 6. Settings View
function initSettingsView() {
  const inputUrl = document.getElementById("setting-api-url");
  const inputKey = document.getElementById("setting-client-key");
  const formSettings = document.getElementById("form-settings");

  if (inputUrl) inputUrl.value = CONFIG.DEFAULT_API_URL;
  if (inputKey) inputKey.value = CONFIG.CLIENT_KEY;

  if (formSettings) {
    formSettings.addEventListener("submit", (e) => {
      e.preventDefault();
      saveApiUrl(inputUrl.value);
      saveClientKey(inputKey.value);
      showToast("Konfigurasi API berhasil disimpan.", "success");
    });
  }
}

// 7. Modal & Toast Helpers
export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

window.closeModal = closeModal;

export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-msg toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'danger' ? '❌' : 'ℹ️'}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 8. Auth UI Update
function updateAuthUI() {
  const btnLoginNav = document.getElementById("nav-btn-login");
  const adminBadges = document.querySelectorAll(".admin-only-badge");

  if (currentSessionUser) {
    if (btnLoginNav) btnLoginNav.textContent = `👤 ${currentSessionUser.nama_pengguna.split(" ")[0]}`;
    adminBadges.forEach(el => el.style.display = "inline-block");
  } else {
    if (btnLoginNav) btnLoginNav.textContent = "🔒 Login Admin";
    adminBadges.forEach(el => el.style.display = "none");
  }
}

// 9. Theme Toggle
function initThemeToggle() {
  const btnToggle = document.getElementById("btn-toggle-theme");
  if (!btnToggle) return;

  btnToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    btnToggle.textContent = isLight ? "🌙" : "☀️";
  });
}
