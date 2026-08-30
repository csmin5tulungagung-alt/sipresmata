/**
 * ============================================================================
 * SIPRESMATA - MASTER SPA ORCHESTRATOR (DUAL MODE: KIOSK & CMS)
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
  initLayoutSwitching();
  initCmsNavigation();
  initThemeToggle();
  initScannerView();
  initAdminForms();
  initSettingsView();

  ADMIN.populateClassSelects();

  // Jika sudah login sebelumnya, bisa langsung aktifkan CMS atau default Kiosk
  if (currentSessionUser) {
    updateCmsUserUI();
  }
});

// 1. Live Clock & Session Indicator
function initLiveClock() {
  const kioskClock = document.getElementById("kiosk-live-clock");
  const cmsClock = document.getElementById("cms-live-clock");
  const bannerSession = document.getElementById("kiosk-session-banner");

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " WIB";
    
    if (kioskClock) kioskClock.textContent = timeStr;
    if (cmsClock) cmsClock.textContent = timeStr;

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

// 2. Dual Layout Switcher (Kiosk Mode vs CMS Mode)
function initLayoutSwitching() {
  const kioskLayout = document.getElementById("public-kiosk-layout");
  const cmsLayout = document.getElementById("admin-cms-layout");
  const btnOpenLogin = document.getElementById("btn-open-login");
  const btnSwitchKiosk = document.getElementById("btn-cms-switch-kiosk");
  const btnLogout = document.getElementById("btn-cms-logout");

  // Klik tombol Login Admin di Kiosk
  if (btnOpenLogin) {
    btnOpenLogin.addEventListener("click", () => {
      if (currentSessionUser) {
        // Jika sudah login, langsung buka CMS
        switchToCms();
      } else {
        openModal("modal-login-admin");
      }
    });
  }

  // Tombol Kembali ke Kiosk Scanner dari CMS
  if (btnSwitchKiosk) {
    btnSwitchKiosk.addEventListener("click", () => {
      switchToKiosk();
    });
  }

  // Logout Admin
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      currentSessionUser = null;
      localStorage.removeItem("SIPRESMATA_ADMIN_USER");
      showToast("Anda telah keluar dari Portal Administrator.", "info");
      switchToKiosk();
    });
  }
}

export function switchToCms() {
  document.getElementById("public-kiosk-layout").classList.remove("active");
  document.getElementById("admin-cms-layout").classList.add("active");
  document.body.className = "mode-cms";

  // Stop camera saat di portal CMS
  SCANNER.stop();

  updateCmsUserUI();
  // Default load Dashboard CMS
  document.querySelector('.cms-nav-link[data-target="cms-view-dashboard"]').click();
}

export function switchToKiosk() {
  document.getElementById("admin-cms-layout").classList.remove("active");
  document.getElementById("public-kiosk-layout").classList.add("active");
  document.body.className = "mode-kiosk";

  // Re-start camera di kiosk
  const camSelect = document.getElementById("select-camera");
  if (camSelect && camSelect.value) {
    SCANNER.start(camSelect.value, handleScanFeedback);
  }
}

// 3. CMS Sidebar Navigation Switcher
function initCmsNavigation() {
  const navLinks = document.querySelectorAll(".cms-nav-link[data-target]");
  const cmsViews = document.querySelectorAll(".cms-view-section");
  const breadcrumbSub = document.getElementById("cms-breadcrumb-sub");

  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      const targetViewId = link.getAttribute("data-target");

      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      cmsViews.forEach(v => v.classList.remove("active"));
      const activeView = document.getElementById(targetViewId);
      if (activeView) activeView.classList.add("active");

      // Update breadcrumb
      if (breadcrumbSub) {
        breadcrumbSub.textContent = link.textContent.trim().replace(/^.+?\s/, '');
      }

      // Lifecycle hooks on CMS view enter
      if (targetViewId === "cms-view-dashboard") ADMIN.loadDashboard();
      if (targetViewId === "cms-view-students") ADMIN.loadStudents();
      if (targetViewId === "cms-view-cards") CARD_GENERATOR.renderCards(document.getElementById("printable-cards-area"));
      if (targetViewId === "cms-view-rekap") {
        const tglMulai = document.getElementById("rekap-tgl-mulai").value || new Date().toISOString().split("T")[0];
        const tglAkhir = document.getElementById("rekap-tgl-akhir").value || new Date().toISOString().split("T")[0];
        ADMIN.loadRekap(tglMulai, tglAkhir);
      }
    });
  });
}

// 4. Scanner Kiosk Integration
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

// 5. Admin Forms & Modals
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
        showToast("Login Berhasil! Selamat datang di Portal CMS Administrator.", "success");
        switchToCms();
      } else {
        showToast(res.message, "danger");
      }
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

  // Cetak Kartu A4 (Print)
  const btnPrintAllCards = document.getElementById("btn-print-cards");
  if (btnPrintAllCards) {
    btnPrintAllCards.addEventListener("click", () => {
      CARD_GENERATOR.printCards();
    });
  }

  // Export Kartu ke ZIP (Gambar PNG per Siswa)
  const btnExportZip = document.getElementById("btn-export-zip-cards");
  if (btnExportZip) {
    btnExportZip.addEventListener("click", async () => {
      const filterClass = document.getElementById("filter-card-kelas")?.value || "";
      const progressBar = document.getElementById("zip-progress-bar");
      const progressStatus = document.getElementById("zip-progress-status");
      const progressPercent = document.getElementById("zip-progress-percent");

      // Buka modal progress
      openModal("modal-zip-progress");
      if (progressBar) progressBar.style.width = "0%";
      if (progressStatus) progressStatus.textContent = "Menyiapkan elemen kartu...";
      if (progressPercent) progressPercent.textContent = "0%";

      btnExportZip.disabled = true;

      try {
        const result = await CARD_GENERATOR.exportCardsToZip(filterClass, (p) => {
          if (progressBar) progressBar.style.width = `${p.percent}%`;
          if (progressStatus) progressStatus.textContent = `Merender ${p.current}/${p.total}: ${p.studentName}`;
          if (progressPercent) progressPercent.textContent = `${p.percent}%`;
        });

        setTimeout(() => {
          closeModal("modal-zip-progress");
          showToast(`Berhasil mengunduh ${result.total} kartu siswa ke file ZIP.`, "success");
        }, 500);
      } catch (err) {
        console.error("ZIP Export Error:", err);
        closeModal("modal-zip-progress");
        showToast("Gagal membuat file ZIP: " + err.message, "danger");
      } finally {
        btnExportZip.disabled = false;
      }
    });
  }

  // Global Bridge untuk Unduh Satuan Kartu Siswa
  window.downloadSingleCard = function(idSiswa, nisn, encodedNama) {
    CARD_GENERATOR.downloadSingleCard(idSiswa, nisn, encodedNama);
  };

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

  // Setup Excel Dropzone & File Input
  initExcelImport();
}

let parsedImportData = [];

function initExcelImport() {
  const dropzone = document.getElementById("dropzone-excel");
  const fileInput = document.getElementById("file-input-excel");
  const btnConfirm = document.getElementById("btn-confirm-import");

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--primary)";
    dropzone.style.background = "rgba(5, 150, 105, 0.15)";
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "rgba(255, 255, 255, 0.2)";
    dropzone.style.background = "rgba(0, 0, 0, 0.2)";
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "rgba(255, 255, 255, 0.2)";
    dropzone.style.background = "rgba(0, 0, 0, 0.2)";
    if (e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  });

  if (btnConfirm) {
    btnConfirm.addEventListener("click", async () => {
      if (parsedImportData.length === 0) return;

      btnConfirm.disabled = true;
      btnConfirm.textContent = "⏳ Mengimpor ke Database...";

      try {
        const res = await API.batchImportSiswa(parsedImportData);
        if (res.status === "success") {
          showToast(res.message, "success");
          closeModal("modal-import-siswa");
          ADMIN.loadStudents();
        } else {
          showToast(res.message, "danger");
        }
      } catch (err) {
        showToast("Terjadi kesalahan saat mengimpor data.", "danger");
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "💾 Simpan & Impor Semua Siswa";
      }
    });
  }
}

function processExcelFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      parsedImportData = ADMIN.parseEmisWorkbook(workbook);

      renderImportPreview(parsedImportData);
    } catch (err) {
      console.error("Excel Read Error:", err);
      showToast("Gagal membaca file: " + err.message, "danger");
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportPreview(students) {
  const container = document.getElementById("import-preview-container");
  const tbody = document.getElementById("preview-table-body");
  const countElem = document.getElementById("preview-count");
  const btnConfirm = document.getElementById("btn-confirm-import");

  if (!container || !tbody) return;

  if (students.length === 0) {
    showToast("Tidak ada data siswa yang dapat dikenali dari file ini.", "warning");
    return;
  }

  countElem.textContent = students.length;
  tbody.innerHTML = students.map((s, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><code>${s.nisn}</code></td>
      <td><strong>${s.nama_lengkap}</strong></td>
      <td><span class="badge badge-info">${s.nama_kelas}</span></td>
      <td>${s.jenis_kelamin === 'P' ? '👧 P' : '👦 L'}</td>
      <td>${s.no_hp_ortu || '-'}</td>
    </tr>
  `).join("");

  container.style.display = "block";
  if (btnConfirm) btnConfirm.style.display = "inline-flex";
  showToast(`Berhasil membaca ${students.length} data siswa dari file.`, "info");
}

window.openImportModal = function() {
  parsedImportData = [];
  const container = document.getElementById("import-preview-container");
  const btnConfirm = document.getElementById("btn-confirm-import");
  const fileInput = document.getElementById("file-input-excel");

  if (container) container.style.display = "none";
  if (btnConfirm) btnConfirm.style.display = "none";
  if (fileInput) fileInput.value = "";

  openModal("modal-import-siswa");
};

window.downloadEmisTemplate = function() {
  // Download file template CSV langsung
  const link = document.createElement("a");
  link.href = "/public/template_import_siswa_emis.csv";
  link.download = "template_import_siswa_emis_min5.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Template Excel/CSV berhasil diunduh.", "success");
};

// 6. Global Window Bridges for Table Actions
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

window.deleteStudent = async function(idSiswa, encodedNama) {
  const nama = decodeURIComponent(encodedNama || "ini");
  if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${nama}?`)) {
    const res = await API.deleteSiswa(idSiswa);
    if (res.status === "success") {
      showToast(res.message || "Siswa berhasil dihapus.", "success");
      ADMIN.loadStudents(ADMIN.studentsState.currentClass, ADMIN.studentsState.currentSearch);
    } else {
      showToast(res.message || "Gagal menghapus siswa.", "danger");
    }
  }
};

window.openAddStudentModal = function() {
  document.getElementById("student-modal-title").textContent = "Tambah Siswa Baru";
  document.getElementById("form-student-modal").reset();
  document.getElementById("student-modal-id").value = "";
  openModal("modal-student-form");
};

// 7. Settings View
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

// 8. Modal & Toast Helpers
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

// 9. Update CMS User UI
function updateCmsUserUI() {
  const userNameElem = document.getElementById("cms-user-name");
  const userRoleElem = document.getElementById("cms-user-role");
  const userAvatarElem = document.getElementById("cms-user-avatar");

  if (currentSessionUser) {
    if (userNameElem) userNameElem.textContent = currentSessionUser.nama_pengguna;
    if (userRoleElem) userRoleElem.textContent = currentSessionUser.role.replace("_", " ");
    if (userAvatarElem) {
      const initials = currentSessionUser.nama_pengguna.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
      userAvatarElem.textContent = initials || "AD";
    }
  }
}

// 10. Theme Toggle
function initThemeToggle() {
  const btnKiosk = document.getElementById("btn-toggle-theme-kiosk");
  const btnCms = document.getElementById("btn-toggle-theme-cms");

  function toggle() {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    if (btnKiosk) btnKiosk.textContent = isLight ? "🌙" : "☀️";
    if (btnCms) btnCms.textContent = isLight ? "🌙" : "☀️";
  }

  if (btnKiosk) btnKiosk.addEventListener("click", toggle);
  if (btnCms) btnCms.addEventListener("click", toggle);
}
