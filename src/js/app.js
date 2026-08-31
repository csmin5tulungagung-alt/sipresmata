/**
 * ============================================================================
 * SIPRESMATA - MASTER SPA ORCHESTRATOR (DUAL MODE: KIOSK & CMS)
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung
 * ============================================================================
 */

import { CONFIG, saveApiUrl, saveClientKey, saveSchedule, saveWaSettings } from './config.js';
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
  initFullscreenToggle();
  initIzinPublicView();
  initScannerView();
  initAdminForms();
  initSettingsView();

  ADMIN.populateClassSelects();

  // Prefetch data siswa di background agar navigasi CMS instan (0ms)
  API.getSiswa().catch(() => {});

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
      if (targetViewId === "cms-view-cards") CARD_GENERATOR.renderFolderView();
      if (targetViewId === "cms-view-rekap") {
        const tglMulai = document.getElementById("rekap-tgl-mulai").value || new Date().toISOString().split("T")[0];
        const tglAkhir = document.getElementById("rekap-tgl-akhir").value || new Date().toISOString().split("T")[0];
        ADMIN.loadRekap(tglMulai, tglAkhir);
      }
      if (targetViewId === "cms-view-settings") initSettingsView();
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
    const isPulang = data.jenis_sesi === "PULANG";
    const isLate = !isPulang && data.status_kehadiran === "TERLAMBAT";

    let statusLabel = "✅ HADIR TEPAT WAKTU";
    let statusClass = "hadir";

    if (isPulang) {
      statusLabel = "🏠 HADIR (SUDAH PULANG)";
      statusClass = "hadir";
    } else if (isLate) {
      statusLabel = `⚠️ HADIR TERLAMBAT (${data.keterlambatan_menit || 0}m)`;
      statusClass = "terlambat";
    }

    resultCard.innerHTML = `
      <div class="result-avatar-circle" style="${isPulang ? 'background: linear-gradient(135deg, #0284c7, #0369a1);' : isLate ? 'background: linear-gradient(135deg, #f59e0b, #d97706);' : ''}">
        ${data.nama_lengkap.charAt(0)}
      </div>
      <h3 class="result-student-name">${data.nama_lengkap}</h3>
      <p class="result-student-meta">${data.kelas || '-'} • NISN: ${data.nisn || '-'}</p>
      
      <div class="status-tag ${statusClass}">
        ${statusLabel} (${data.jam_scan} WIB)
      </div>

      <p class="result-timestamp">${res.message}</p>
    `;
    showToast(`Presensi Berhasil: ${data.nama_lengkap} (${isPulang ? 'Sudah Pulang' : 'Hadir Masuk'})`, "success");
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

  // Global Bridges
  window.ADMIN = ADMIN;
  window.CARD_GENERATOR = CARD_GENERATOR;

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

window.deleteStudent = function(idSiswa, encodedNama) {
  const nama = decodeURIComponent(encodedNama || "ini");
  if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${nama}?`)) {
    const cleanId = String(idSiswa || "").trim().toUpperCase();

    // 1. OPTIMISTIC INSTANT UPDATE (0 ms): Hapus seketika dari tabel & memori
    if (window.ADMIN) {
      ADMIN.studentsState.allList = (ADMIN.studentsState.allList || []).filter(s => 
        String(s.id_siswa || "").trim().toUpperCase() !== cleanId && 
        String(s.nisn || "").trim().toUpperCase() !== cleanId
      );
      ADMIN.refreshCurrentStudentView();
    }

    if (window.CARD_GENERATOR) {
      window.CARD_GENERATOR.state.allStudents = (window.CARD_GENERATOR.state.allStudents || []).filter(s => 
        String(s.id_siswa || "").trim().toUpperCase() !== cleanId && 
        String(s.nisn || "").trim().toUpperCase() !== cleanId
      );
    }

    showToast(`✓ Data siswa ${nama} berhasil dihapus.`, "success");

    // 2. Kirim sinkronisasi ke backend di latar belakang
    API.deleteSiswa(idSiswa).catch(err => {
      console.warn("Background delete error:", err);
    });
  }
};

window.openAddStudentModal = function(preselectedClassId = "") {
  document.getElementById("student-modal-title").textContent = "Tambah Siswa Baru";
  document.getElementById("form-student-modal").reset();
  document.getElementById("student-modal-id").value = "";
  if (preselectedClassId) {
    const select = document.getElementById("student-modal-kelas");
    if (select) select.value = preselectedClassId;
  }
  openModal("modal-student-form");
};

// 7. Settings View
let isSettingsFormBound = false;

async function initSettingsView() {
  const inputMasukMulai = document.getElementById("setting-jam-masuk-mulai");
  const inputMasukBatas = document.getElementById("setting-jam-masuk-batas");
  const inputMasukMaks = document.getElementById("setting-jam-masuk-maks");
  const inputPulangMulai = document.getElementById("setting-jam-pulang-mulai");
  const inputPulangBatas = document.getElementById("setting-jam-pulang-batas");
  const inputUrl = document.getElementById("setting-api-url");
  const inputKey = document.getElementById("setting-client-key");
  const inputFonnteToken = document.getElementById("setting-fonnte-token");
  const checkWaEnabled = document.getElementById("setting-wa-enabled");
  const inputWaDelay = document.getElementById("setting-wa-delay");
  const formSettings = document.getElementById("form-settings");
  const btnSave = document.getElementById("btn-save-settings");
  const btnToggleToken = document.getElementById("btn-toggle-token-visibility");
  const btnTestWa = document.getElementById("btn-test-wa-send");
  const inputTestPhone = document.getElementById("input-test-wa-phone");
  const waTestFeedback = document.getElementById("wa-test-feedback");

  // Isi form dari config lokal saat ini
  if (inputMasukMulai) inputMasukMulai.value = (CONFIG.SCHEDULE.MASUK_MULAI || "06:00:00").substring(0, 5);
  if (inputMasukBatas) inputMasukBatas.value = (CONFIG.SCHEDULE.MASUK_BATAS || "07:15:00").substring(0, 5);
  if (inputMasukMaks) inputMasukMaks.value = (CONFIG.SCHEDULE.MASUK_MAKSIMAL || "08:30:00").substring(0, 5);
  if (inputPulangMulai) inputPulangMulai.value = (CONFIG.SCHEDULE.PULANG_MULAI || "12:30:00").substring(0, 5);
  if (inputPulangBatas) inputPulangBatas.value = (CONFIG.SCHEDULE.PULANG_BATAS || "16:00:00").substring(0, 5);
  if (inputUrl) inputUrl.value = CONFIG.DEFAULT_API_URL;
  if (inputKey) inputKey.value = CONFIG.CLIENT_KEY;
  if (inputFonnteToken) inputFonnteToken.value = CONFIG.FONNTE_TOKEN;
  if (checkWaEnabled) checkWaEnabled.checked = CONFIG.WA_NOTIF_ENABLED;
  if (inputWaDelay) inputWaDelay.value = CONFIG.WA_DELAY_SECONDS || 10;

  // Toggle Password / Token Visibility
  if (btnToggleToken && inputFonnteToken) {
    btnToggleToken.onclick = () => {
      if (inputFonnteToken.type === "password") {
        inputFonnteToken.type = "text";
        btnToggleToken.textContent = "🙈";
      } else {
        inputFonnteToken.type = "password";
        btnToggleToken.textContent = "👁️";
      }
    };
  }

  // Tombol Uji Coba Kirim WA
  if (btnTestWa && inputTestPhone) {
    btnTestWa.onclick = async () => {
      const targetPhone = inputTestPhone.value.trim();
      const token = inputFonnteToken ? inputFonnteToken.value.trim() : CONFIG.FONNTE_TOKEN;

      if (!token) {
        showToast("Masukkan Token Fonnte terlebih dahulu sebelum uji coba.", "warning");
        if (inputFonnteToken) inputFonnteToken.focus();
        return;
      }

      if (!targetPhone) {
        showToast("Masukkan nomor WhatsApp tujuan uji coba (contoh: 081234567890).", "warning");
        inputTestPhone.focus();
        return;
      }

      btnTestWa.disabled = true;
      btnTestWa.textContent = "⏳ Mengirim Tes...";
      if (waTestFeedback) {
        waTestFeedback.style.display = "block";
        waTestFeedback.style.color = "#38bdf8";
        waTestFeedback.innerHTML = "Sedang menghubungkan ke server Fonnte WhatsApp API...";
      }

      try {
        const res = await API.testWaNotif(targetPhone, token);
        if (res.status === "success") {
          showToast(res.message || "Pesan tes WhatsApp berhasil terkirim!", "success");
          if (waTestFeedback) {
            waTestFeedback.style.color = "#34d399";
            waTestFeedback.innerHTML = `✅ <strong>Berhasil Terkirim:</strong> ${res.message}`;
          }
        } else {
          showToast(res.message || "Gagal mengirim pesan tes WhatsApp.", "danger");
          if (waTestFeedback) {
            waTestFeedback.style.color = "#f87171";
            waTestFeedback.innerHTML = `❌ <strong>Gagal:</strong> ${res.message}`;
          }
        }
      } catch (err) {
        showToast("Terjadi kesalahan: " + err.message, "danger");
        if (waTestFeedback) {
          waTestFeedback.style.color = "#f87171";
          waTestFeedback.innerHTML = `❌ <strong>Kesalahan:</strong> ${err.message}`;
        }
      } finally {
        btnTestWa.disabled = false;
        btnTestWa.textContent = "📤 Kirim Pesan Tes";
      }
    };
  }

  // Coba ambil pengaturan terbaru dari backend Google Apps Script / Spreadsheet
  try {
    const res = await API.getPengaturan();
    if (res && res.data) {
      const d = res.data;
      if (d.jam_masuk_mulai && inputMasukMulai) inputMasukMulai.value = d.jam_masuk_mulai.substring(0, 5);
      if (d.jam_masuk_batas && inputMasukBatas) inputMasukBatas.value = d.jam_masuk_batas.substring(0, 5);
      if (d.jam_masuk_maksimal && inputMasukMaks) inputMasukMaks.value = d.jam_masuk_maksimal.substring(0, 5);
      if (d.jam_pulang_mulai && inputPulangMulai) inputPulangMulai.value = d.jam_pulang_mulai.substring(0, 5);
      if (d.jam_pulang_batas && inputPulangBatas) inputPulangBatas.value = d.jam_pulang_batas.substring(0, 5);
      if (d.client_key && inputKey) inputKey.value = d.client_key;
      if (d.fonnte_token && inputFonnteToken) inputFonnteToken.value = d.fonnte_token;
      if (d.wa_notif_enabled !== undefined && checkWaEnabled) {
        checkWaEnabled.checked = (d.wa_notif_enabled === "true" || d.wa_notif_enabled === true);
      }
      if (d.wa_delay_seconds && inputWaDelay) inputWaDelay.value = d.wa_delay_seconds;
    }
  } catch (e) {
    console.warn("Gagal sinkronisasi server settings, menggunakan cache lokal:", e);
  }

  if (formSettings && !isSettingsFormBound) {
    isSettingsFormBound = true;
    formSettings.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = "⏳ Menyimpan Pengaturan...";
      }

      const scheduleData = {
        MASUK_MULAI: inputMasukMulai ? inputMasukMulai.value : "06:00",
        MASUK_BATAS: inputMasukBatas ? inputMasukBatas.value : "07:15",
        MASUK_MAKSIMAL: inputMasukMaks ? inputMasukMaks.value : "08:30",
        PULANG_MULAI: inputPulangMulai ? inputPulangMulai.value : "12:30",
        PULANG_BATAS: inputPulangBatas ? inputPulangBatas.value : "16:00"
      };

      const waSettings = {
        FONNTE_TOKEN: inputFonnteToken ? inputFonnteToken.value.trim() : "",
        WA_NOTIF_ENABLED: checkWaEnabled ? checkWaEnabled.checked : false,
        WA_DELAY_SECONDS: inputWaDelay ? parseInt(inputWaDelay.value, 10) || 10 : 10
      };

      // Simpan ke local config
      saveSchedule(scheduleData);
      if (inputUrl) saveApiUrl(inputUrl.value);
      if (inputKey) saveClientKey(inputKey.value);
      saveWaSettings(waSettings);

      // Siapkan payload untuk Spreadsheet tab pengaturan_sekolah
      const serverPayload = {
        jam_masuk_mulai: `${scheduleData.MASUK_MULAI}:00`,
        jam_masuk_batas: `${scheduleData.MASUK_BATAS}:00`,
        jam_masuk_maksimal: `${scheduleData.MASUK_MAKSIMAL}:00`,
        jam_pulang_mulai: `${scheduleData.PULANG_MULAI}:00`,
        jam_pulang_batas: `${scheduleData.PULANG_BATAS}:00`,
        client_key: inputKey ? inputKey.value : CONFIG.CLIENT_KEY,
        fonnte_token: waSettings.FONNTE_TOKEN,
        wa_notif_enabled: String(waSettings.WA_NOTIF_ENABLED),
        wa_delay_seconds: String(waSettings.WA_DELAY_SECONDS)
      };

      try {
        const res = await API.updatePengaturan(serverPayload);
        showToast(res.message || "Pengaturan sistem dan WhatsApp Gateway berhasil disimpan.", "success");
      } catch (err) {
        showToast("Pengaturan berhasil disimpan secara lokal.", "success");
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = "💾 Simpan Seluruh Pengaturan";
        }
      }
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

// 10. Fullscreen Mode Controller
function initFullscreenToggle() {
  const btnKiosk = document.getElementById("btn-fullscreen-kiosk");
  const btnCms = document.getElementById("btn-fullscreen-cms");

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Fullscreen error:", err);
        });
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.warn("Exit fullscreen error:", err);
        });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function updateFullscreenIcons() {
    const isFull = !!document.fullscreenElement;
    const icon = isFull ? "🗗" : "⛶";
    const title = isFull ? "Keluar Layar Penuh (Esc)" : "Mode Layar Penuh (Fullscreen)";

    if (btnKiosk) {
      btnKiosk.textContent = icon;
      btnKiosk.title = title;
      btnKiosk.style.background = isFull ? "rgba(16, 185, 129, 0.2)" : "";
      btnKiosk.style.borderColor = isFull ? "rgba(16, 185, 129, 0.5)" : "";
    }
    if (btnCms) {
      btnCms.textContent = icon;
      btnCms.title = title;
      btnCms.style.background = isFull ? "rgba(16, 185, 129, 0.2)" : "";
      btnCms.style.borderColor = isFull ? "rgba(16, 185, 129, 0.5)" : "";
    }
  }

  if (btnKiosk) btnKiosk.addEventListener("click", toggleFullscreen);
  if (btnCms) btnCms.addEventListener("click", toggleFullscreen);

  document.addEventListener("fullscreenchange", updateFullscreenIcons);
  document.addEventListener("webkitfullscreenchange", updateFullscreenIcons);
}

// 11. Public Student Leave Request Controller (Form Izin Mandiri Online)
let uploadedBuktiBase64 = "";

function initIzinPublicView() {
  const izinLayout = document.getElementById("public-izin-layout");
  const kioskLayout = document.getElementById("public-kiosk-layout");
  const cmsLayout = document.getElementById("admin-cms-layout");
  const selectKelas = document.getElementById("izin-select-kelas");
  const selectSiswa = document.getElementById("izin-select-siswa");
  const inputTanggal = document.getElementById("izin-input-tanggal");
  const inputBukti = document.getElementById("izin-input-bukti");
  const formIzin = document.getElementById("form-public-izin");
  const btnSubmit = document.getElementById("btn-submit-public-izin");

  // Deteksi rute URL (?mode=izin atau #izin)
  const isIzinMode = window.location.search.includes("mode=izin") || window.location.hash === "#izin";

  if (isIzinMode) {
    if (kioskLayout) kioskLayout.style.display = "none";
    if (cmsLayout) cmsLayout.style.display = "none";
    if (izinLayout) {
      izinLayout.style.display = "block";
      izinLayout.classList.add("active");
    }
    document.body.className = "mode-izin";
  }

  // Populate Default Tanggal Hari Ini
  if (inputTanggal) {
    inputTanggal.value = new Date().toISOString().split("T")[0];
  }

  // Populate Dropdown Kelas
  if (selectKelas) {
    selectKelas.innerHTML = `<option value="">-- Pilih Kelas Siswa --</option>` + 
      CONFIG.ROMBEL_LIST.map(r => `<option value="${r.id}">${r.nama}</option>`).join("");

    selectKelas.addEventListener("change", async () => {
      const idKelas = selectKelas.value;
      if (!selectSiswa) return;

      if (!idKelas) {
        selectSiswa.innerHTML = `<option value="">Pilih kelas terlebih dahulu...</option>`;
        return;
      }

      selectSiswa.innerHTML = `<option value="">Memuat daftar siswa kelas...</option>`;
      const res = await API.getSiswa(idKelas);
      const students = res.data || [];

      if (students.length === 0) {
        selectSiswa.innerHTML = `<option value="">Belum ada siswa di kelas ini</option>`;
        return;
      }

      selectSiswa.innerHTML = `<option value="">-- Pilih Nama Siswa --</option>` +
        students.map(s => `<option value="${s.id_siswa}" data-nama="${s.nama_lengkap}" data-nisn="${s.nisn}">${s.nama_lengkap} (NISN: ${s.nisn})</option>`).join("");
    });
  }

  // Handle Upload Foto Bukti dengan Image Compression (Canvas)
  if (inputBukti) {
    inputBukti.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          uploadedBuktiBase64 = canvas.toDataURL("image/jpeg", 0.75);

          const previewContainer = document.getElementById("izin-bukti-preview-container");
          const previewImg = document.getElementById("izin-bukti-preview-img");
          if (previewImg) previewImg.src = uploadedBuktiBase64;
          if (previewContainer) previewContainer.style.display = "block";
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Form Submission
  if (formIzin) {
    formIzin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idSiswa = selectSiswa ? selectSiswa.value : "";
      if (!idSiswa) {
        alert("Silakan pilih nama siswa terlebih dahulu.");
        return;
      }

      const selectedOpt = selectSiswa.options[selectSiswa.selectedIndex];
      const namaSiswa = selectedOpt ? selectedOpt.getAttribute("data-nama") : "";
      const selectedRombel = CONFIG.ROMBEL_LIST.find(r => r.id === selectKelas.value) || { nama: selectKelas.value, id: selectKelas.value };
      const tanggal = inputTanggal.value || new Date().toISOString().split("T")[0];
      const jenisIzin = document.querySelector('input[name="public_jenis_izin"]:checked')?.value || "IZIN";
      const keterangan = document.getElementById("izin-input-keterangan")?.value || "";

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "⏳ Mengirimkan Permohonan Izin...";
      }

      try {
        const payload = {
          id_siswa: idSiswa,
          id_kelas: selectedRombel.id,
          nama_kelas: selectedRombel.nama,
          nama_lengkap: namaSiswa,
          tanggal: tanggal,
          status_kehadiran: jenisIzin,
          keterangan: keterangan,
          bukti_foto: uploadedBuktiBase64
        };

        await API.submitIzinOnline(payload);
        
        // Show Success Screen
        const successScreen = document.getElementById("izin-success-screen");
        const successDesc = document.getElementById("izin-success-desc");
        const formHeader = document.getElementById("izin-form-header");

        if (formIzin) formIzin.style.display = "none";
        if (formHeader) formHeader.style.display = "none";
        if (successScreen) successScreen.style.display = "block";
        if (successDesc) {
          successDesc.innerHTML = `Permohonan izin untuk <strong>${namaSiswa}</strong> (${selectedRombel.nama}) pada tanggal <strong>${tanggal}</strong> telah berhasil dicatat.`;
        }

      } catch (err) {
        alert("Gagal mengirim permohonan izin: " + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "📤 Kirim Permohonan Izin";
        }
      }
    });
  }
}

// Window Global Bridges untuk Fitur Izin
window.openIzinPortal = function() {
  const url = window.location.origin + window.location.pathname + "?mode=izin";
  window.open(url, "_blank");
};

window.copyIzinLink = function() {
  const url = window.location.origin + window.location.pathname + "?mode=izin";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast("Tautan Form Izin berhasil disalin! Siap dibagikan ke WhatsApp wali murid.", "success");
    }).catch(() => {
      prompt("Salin tautan formulir izin berikut:", url);
    });
  } else {
    prompt("Salin tautan formulir izin berikut:", url);
  }
};

window.clearIzinBukti = function() {
  uploadedBuktiBase64 = "";
  const inputBukti = document.getElementById("izin-input-bukti");
  const previewContainer = document.getElementById("izin-bukti-preview-container");
  const previewImg = document.getElementById("izin-bukti-preview-img");
  if (inputBukti) inputBukti.value = "";
  if (previewImg) previewImg.src = "";
  if (previewContainer) previewContainer.style.display = "none";
};

window.resetIzinForm = function() {
  const formIzin = document.getElementById("form-public-izin");
  const formHeader = document.getElementById("izin-form-header");
  const successScreen = document.getElementById("izin-success-screen");
  if (formIzin) {
    formIzin.reset();
    formIzin.style.display = "block";
  }
  if (formHeader) formHeader.style.display = "flex";
  if (successScreen) successScreen.style.display = "none";
  window.clearIzinBukti();
};
