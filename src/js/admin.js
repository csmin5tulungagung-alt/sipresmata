/**
 * ============================================================================
 * SIPRESMATA - ADMIN CONTROLLER MODULE
 * Manages Dashboard, Students CRUD, Manual Attendance, and Rekapitulasi
 * ============================================================================
 */

import { API } from './api.js';
import { CONFIG } from './config.js';
import { EXPORT } from './export.js';

export const ADMIN = {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  studentsState: {
    allList: [],
    filteredList: [],
    classStudents: [],
    currentPage: 1,
    pageSize: 10,
    selectedIds: new Set(),
    currentClass: "",
    currentSearch: "",
    isSelectionMode: false,
    viewMode: "CARDS", // "CARDS" | "CLASS_DETAIL" | "ALL_TABLE"
    selectedClassId: "",
    selectedClassName: "",
    selectedTingkatFilter: "ALL",
    selectedGenderFilter: "ALL",
    cardsSearch: "",
    classStudentSearch: ""
  },

  rekapState: {
    items: [],
    currentPage: 1,
    pageSize: 10,
    periode: {},
    idKelas: "",
    summary: {},
    isSelectionMode: false,
    selectedIds: new Set()
  },

  dashboardState: {
    scans: [],
    currentPage: 1,
    pageSize: 10
  },

  // ==========================================================================
  // 1. REUSABLE PAGINATION GENERATOR
  // ==========================================================================
  renderPagination(containerId, totalItems, currentPage, pageSize, onPageChange, onPageSizeChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalItems <= 0) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";

    const isAll = pageSize === "ALL" || pageSize >= totalItems;
    const effectivePageSize = isAll ? totalItems : parseInt(pageSize, 10);
    const totalPages = isAll ? 1 : Math.ceil(totalItems / effectivePageSize);
    const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

    const startIdx = totalItems === 0 ? 0 : isAll ? 1 : (safeCurrentPage - 1) * effectivePageSize + 1;
    const endIdx = isAll ? totalItems : Math.min(safeCurrentPage * effectivePageSize, totalItems);

    // Generate Buttons
    let navButtonsHTML = "";
    if (totalPages > 1) {
      // Prev Button
      navButtonsHTML += `
        <button type="button" class="pagination-btn" ${safeCurrentPage <= 1 ? 'disabled' : ''} data-page="${safeCurrentPage - 1}">
          ◀ Sebelumnya
        </button>
      `;

      // Page Number Pills
      const maxVisiblePages = 5;
      let startPage = Math.max(1, safeCurrentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      if (startPage > 1) {
        navButtonsHTML += `<button type="button" class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) navButtonsHTML += `<span class="pagination-ellipsis">...</span>`;
      }

      for (let p = startPage; p <= endPage; p++) {
        navButtonsHTML += `
          <button type="button" class="pagination-btn ${p === safeCurrentPage ? 'active' : ''}" data-page="${p}">
            ${p}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) navButtonsHTML += `<span class="pagination-ellipsis">...</span>`;
        navButtonsHTML += `<button type="button" class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
      }

      // Next Button
      navButtonsHTML += `
        <button type="button" class="pagination-btn" ${safeCurrentPage >= totalPages ? 'disabled' : ''} data-page="${safeCurrentPage + 1}">
          Berikutnya ▶
        </button>
      `;
    }

    container.innerHTML = `
      <div class="pagination-left-group">
        <div class="pagination-size-selector">
          <span>Tampilkan:</span>
          <select class="pagination-select-size" id="${containerId}-select-size">
            <option value="10" ${String(pageSize) === '10' ? 'selected' : ''}>10 data</option>
            <option value="25" ${String(pageSize) === '25' ? 'selected' : ''}>25 data</option>
            <option value="50" ${String(pageSize) === '50' ? 'selected' : ''}>50 data</option>
            <option value="100" ${String(pageSize) === '100' ? 'selected' : ''}>100 data</option>
            <option value="ALL" ${String(pageSize) === 'ALL' ? 'selected' : ''}>Semua data</option>
          </select>
        </div>
        <div class="pagination-summary-info">
          Menampilkan <strong>${startIdx} – ${endIdx}</strong> dari <strong>${totalItems}</strong> data
        </div>
      </div>
      <div class="pagination-nav-group">
        ${navButtonsHTML}
      </div>
    `;

    // Event Listener for Size Dropdown
    const selectSize = document.getElementById(`${containerId}-select-size`);
    if (selectSize) {
      selectSize.addEventListener("change", (e) => {
        onPageSizeChange(e.target.value);
      });
    }

    // Event Listeners for Page Buttons
    const pageButtons = container.querySelectorAll(".pagination-btn[data-page]");
    pageButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetPage = parseInt(btn.getAttribute("data-page"), 10);
        if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
          onPageChange(targetPage);
        }
      });
    });
  },

  // ==========================================================================
  // 2. DASHBOARD METRICS & LIVE MONITORING
  // ==========================================================================
  async loadDashboard() {
    const statsContainer = document.getElementById("dashboard-stats-grid");
    if (!statsContainer) return;

    try {
      const res = await API.getDashboardStats();
      const data = res.data;

      statsContainer.innerHTML = `
        <div class="stat-card total">
          <div class="stat-label">Total Siswa Aktif</div>
          <div class="stat-value">${data.total_siswa_aktif}</div>
        </div>
        <div class="stat-card hadir">
          <div class="stat-label">Hadir Tepat Waktu</div>
          <div class="stat-value" style="color: #34d399;">${data.rincian.hadir_tepat_waktu}</div>
        </div>
        <div class="stat-card terlambat">
          <div class="stat-label">Terlambat</div>
          <div class="stat-value" style="color: #fbbf24;">${data.rincian.terlambat}</div>
        </div>
        <div class="stat-card izin">
          <div class="stat-label">Izin</div>
          <div class="stat-value" style="color: #818cf8;">${data.rincian.izin}</div>
        </div>
        <div class="stat-card sakit">
          <div class="stat-label">Sakit</div>
          <div class="stat-value" style="color: #ec4899;">${data.rincian.sakit}</div>
        </div>
        <div class="stat-card alpa">
          <div class="stat-label">Alpa / Belum Absen</div>
          <div class="stat-value" style="color: #f87171;">${data.total_belum_absen}</div>
        </div>
      `;

      this.dashboardState.scans = data.recent_scans || [];
      this.dashboardState.currentPage = 1;
      this.renderDashboardFeed();

    } catch (e) {
      console.error("Dashboard error:", e);
    }
  },

  renderDashboardFeed() {
    const feedContainer = document.getElementById("live-scans-feed");
    if (!feedContainer) return;

    const scans = this.dashboardState.scans;
    if (scans.length === 0) {
      feedContainer.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Belum ada data scan presensi hari ini.</td></tr>`;
      this.renderPagination("dashboard-feed-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.dashboardState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? scans.length : parseInt(pageSize, 10);
    const currentPage = this.dashboardState.currentPage;

    const pageItems = isAll ? scans : scans.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

    feedContainer.innerHTML = pageItems.map(s => {
      const isPulang = Boolean(s.jam_pulang);
      const scanTime = isPulang 
        ? `${s.jam_masuk ? s.jam_masuk + ' / ' : ''}<span style="color: #38bdf8; font-weight: 600;">🏠 ${s.jam_pulang}</span>`
        : (s.jam_masuk || '-');
      
      const badgeClass = s.status_kehadiran === 'HADIR' ? 'badge-success' : s.status_kehadiran === 'TERLAMBAT' ? 'badge-warning' : 'badge-danger';
      const badgeText = isPulang ? `${s.status_kehadiran} (PULANG)` : s.status_kehadiran;

      return `
        <tr>
          <td><strong>${s.nama_lengkap}</strong></td>
          <td>${s.kelas || '-'}</td>
          <td>${scanTime}</td>
          <td>
            <span class="badge ${badgeClass}">
              ${badgeText}
            </span>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-icon" onclick="ADMIN.deleteDashboardScan('${s.id_absensi}', '${encodeURIComponent(s.nama_lengkap)}')" title="Hapus Catatan Presensi Ini" style="color: #f87171; padding: 0.35rem 0.5rem;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join("");

    this.renderPagination(
      "dashboard-feed-pagination",
      scans.length,
      currentPage,
      pageSize,
      (newPage) => {
        this.dashboardState.currentPage = newPage;
        this.renderDashboardFeed();
      },
      (newSize) => {
        this.dashboardState.pageSize = newSize;
        this.dashboardState.currentPage = 1;
        this.renderDashboardFeed();
      }
    );
  },

  async deleteDashboardScan(idAbsensi, encodedNama) {
    const namaSiswa = decodeURIComponent(encodedNama || "siswa ini");
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data presensi hari ini untuk ${namaSiswa}?`);
    if (!confirmDelete) return;

    // Optimistic UI Removal
    const idx = this.dashboardState.scans.findIndex(s => s.id_absensi === idAbsensi);
    if (idx !== -1) {
      this.dashboardState.scans.splice(idx, 1);
      this.renderDashboardFeed();
    }

    showToast(`Data presensi ${namaSiswa} berhasil dihapus.`, "success");

    // Sync in background
    try {
      await API.deleteAbsensi(idAbsensi);
      this.loadDashboard();
    } catch (e) {
      console.warn("Delete dashboard scan error:", e);
    }
  },

  // ==========================================================================
  // 3. DATA MASTER SISWA (CARD ROMBEL VIEW & DETAIL PER KELAS)
  // ==========================================================================
  async loadStudents(idKelas = "", searchTerm = "", forceRefresh = false) {
    if (idKelas) this.studentsState.currentClass = idKelas;
    if (searchTerm) this.studentsState.currentSearch = searchTerm;

    // 1. Render instan jika sudah ada data di memory (< 1ms)
    if (this.studentsState.allList && this.studentsState.allList.length > 0 && !forceRefresh) {
      this.refreshCurrentStudentView();
    } else {
      const grid = document.getElementById("students-class-grid");
      if (grid && (!this.studentsState.allList || this.studentsState.allList.length === 0)) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;">⏳</div>
            Memuat data siswa dan rombongan belajar...
          </div>
        `;
      }
    }

    // 2. Fetch / revalidate dari API
    try {
      const res = await API.getSiswa("", forceRefresh);
      this.studentsState.allList = res.data || [];
      this.refreshCurrentStudentView();
    } catch (e) {
      console.error("Gagal memuat data siswa:", e);
    }
  },

  refreshCurrentStudentView() {
    if (this.studentsState.viewMode === "CARDS") {
      this.renderStudentClassCards();
    } else if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.applyClassStudentFilters();
    } else if (this.studentsState.viewMode === "ALL_TABLE") {
      this.applyStudentFilters();
    }
  },

  setStudentViewMode(mode) {
    this.studentsState.viewMode = mode;
    this.studentsState.isSelectionMode = false;
    this.studentsState.selectedIds.clear();

    const cardsView = document.getElementById("students-cards-view");
    const detailView = document.getElementById("students-class-detail-view");
    const globalView = document.getElementById("students-global-table-view");

    if (cardsView) cardsView.style.display = mode === "CARDS" ? "block" : "none";
    if (detailView) detailView.style.display = mode === "CLASS_DETAIL" ? "block" : "none";
    if (globalView) globalView.style.display = mode === "ALL_TABLE" ? "block" : "none";

    this.refreshCurrentStudentView();
  },

  // --------------------------------------------------------------------------
  // 3A. TAMPILAN 1: GRID 24 CARD ROMBEL
  // --------------------------------------------------------------------------
  renderStudentClassCards() {
    const cardsView = document.getElementById("students-cards-view");
    const detailView = document.getElementById("students-class-detail-view");
    const globalView = document.getElementById("students-global-table-view");
    const grid = document.getElementById("students-class-grid");

    if (cardsView) cardsView.style.display = "block";
    if (detailView) detailView.style.display = "none";
    if (globalView) globalView.style.display = "none";
    this.studentsState.viewMode = "CARDS";

    if (!grid) return;

    // Hitung jumlah & breakdown gender siswa per kelas
    const countMap = {};
    const genderMap = {};

    (this.studentsState.allList || []).forEach(s => {
      const k = s.id_kelas || "KLS-1A";
      countMap[k] = (countMap[k] || 0) + 1;
      if (!genderMap[k]) genderMap[k] = { L: 0, P: 0 };
      const jk = (s.jenis_kelamin || "L").toUpperCase();
      if (jk === "L" || jk === "LAKI-LAKI") genderMap[k].L++;
      else genderMap[k].P++;
    });

    let rombels = CONFIG.ROMBEL_LIST || [];

    // Filter Tingkat
    if (this.studentsState.selectedTingkatFilter && this.studentsState.selectedTingkatFilter !== "ALL") {
      const tingkatNum = parseInt(this.studentsState.selectedTingkatFilter, 10);
      rombels = rombels.filter(r => r.tingkat === tingkatNum);
    }

    // Filter Search
    const search = (this.studentsState.cardsSearch || "").toLowerCase().trim();
    if (search) {
      rombels = rombels.filter(r => {
        const matchName = r.nama.toLowerCase().includes(search) || r.id.toLowerCase().includes(search);
        const hasMatchingStudent = (this.studentsState.allList || []).some(s => 
          s.id_kelas === r.id && (
            (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(search)) ||
            (s.nisn && s.nisn.includes(search))
          )
        );
        return matchName || hasMatchingStudent;
      });
    }

    if (rombels.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          Tidak ditemukan kelas yang cocok dengan pencarian "<strong>${this.studentsState.cardsSearch}</strong>".
        </div>
      `;
      return;
    }

    grid.innerHTML = rombels.map(r => {
      const count = countMap[r.id] || 0;
      const g = genderMap[r.id] || { L: 0, P: 0 };
      const gedung = r.tingkat <= 3 ? "Gedung A (Bawah)" : "Gedung B (Atas)";

      return `
        <div class="class-folder-card" onclick="ADMIN.openStudentClass('${r.id}', '${r.nama}')">
          <div class="folder-card-header">
            <div class="folder-icon-wrapper">🏫</div>
            <div style="flex: 1;">
              <div class="folder-info-title">${r.nama}</div>
              <div class="folder-info-desc">Tingkat ${r.tingkat} • ${gedung}</div>
              <div class="folder-gender-stats" style="margin-top: 0.35rem;">
                <span class="folder-gender-pill male">👦 ${g.L} L</span>
                <span class="folder-gender-pill female">👧 ${g.P} P</span>
              </div>
            </div>
          </div>

          <div class="folder-card-footer">
            <span class="folder-student-badge ${count === 0 ? 'empty' : ''}">
              👥 ${count} Siswa
            </span>
            <span class="folder-action-text">
              Kelola Siswa ➔
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  filterTingkatCards(tingkat) {
    this.studentsState.selectedTingkatFilter = tingkat;
    const pills = document.querySelectorAll("#students-tingkat-tabs .tingkat-pill");
    pills.forEach(p => {
      const match = (tingkat === "ALL" && p.textContent.includes("Semua")) ||
                    (p.textContent.includes(`Kelas ${tingkat}`));
      if (match) p.classList.add("active");
      else p.classList.remove("active");
    });
    this.renderStudentClassCards();
  },

  handleCardsSearch(term) {
    this.studentsState.cardsSearch = term;
    this.renderStudentClassCards();
  },

  // --------------------------------------------------------------------------
  // 3B. TAMPILAN 2: DETAIL SISWA PER KELAS
  // --------------------------------------------------------------------------
  openStudentClass(idKelas, namaKelas) {
    this.studentsState.selectedClassId = idKelas;
    this.studentsState.selectedClassName = namaKelas;
    this.studentsState.viewMode = "CLASS_DETAIL";
    this.studentsState.currentPage = 1;
    this.studentsState.classStudentSearch = "";
    this.studentsState.selectedGenderFilter = "ALL";
    this.studentsState.selectedIds.clear();
    this.studentsState.isSelectionMode = false;

    const cardsView = document.getElementById("students-cards-view");
    const detailView = document.getElementById("students-class-detail-view");
    const globalView = document.getElementById("students-global-table-view");
    const titleEl = document.getElementById("student-detail-class-title");
    const searchInput = document.getElementById("search-class-student-input");
    const genderSelect = document.getElementById("filter-class-gender");

    if (cardsView) cardsView.style.display = "none";
    if (globalView) globalView.style.display = "none";
    if (detailView) detailView.style.display = "block";

    if (titleEl) titleEl.textContent = `📁 Data Siswa - ${namaKelas}`;
    if (searchInput) searchInput.value = "";
    if (genderSelect) genderSelect.value = "ALL";

    this.applyClassStudentFilters();
  },

  backToStudentCards() {
    this.setStudentViewMode("CARDS");
  },

  openAddStudentForCurrentClass() {
    window.openAddStudentModal(this.studentsState.selectedClassId);
  },

  jumpToClassCardPrint() {
    const classId = this.studentsState.selectedClassId;
    const className = this.studentsState.selectedClassName;
    if (!classId) return;

    const cardsNavLink = document.querySelector('.cms-nav-link[data-target="cms-view-cards"]');
    if (cardsNavLink) cardsNavLink.click();

    if (window.CARD_GENERATOR) {
      window.CARD_GENERATOR.openClassFolder(classId, className);
    }
  },

  previewStudentCard(idSiswa) {
    if (window.CARD_GENERATOR && typeof window.CARD_GENERATOR.previewCard === "function") {
      window.CARD_GENERATOR.previewCard(idSiswa);
    } else {
      showToast("Pratinjau kartu sedang disiapkan...", "info");
    }
  },

  handleClassStudentSearch(term) {
    this.studentsState.classStudentSearch = term;
    this.studentsState.currentPage = 1;
    this.applyClassStudentFilters();
  },

  handleClassGenderFilter(gender) {
    this.studentsState.selectedGenderFilter = gender;
    this.studentsState.currentPage = 1;
    this.applyClassStudentFilters();
  },

  applyClassStudentFilters() {
    const classId = this.studentsState.selectedClassId;
    let list = (this.studentsState.allList || []).filter(s => s.id_kelas === classId);

    const term = (this.studentsState.classStudentSearch || "").toLowerCase().trim();
    if (term) {
      list = list.filter(s => 
        (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(term)) || 
        (s.nisn && s.nisn.includes(term)) ||
        (s.no_hp_ortu && s.no_hp_ortu.includes(term))
      );
    }

    const gender = this.studentsState.selectedGenderFilter;
    if (gender && gender !== "ALL") {
      list = list.filter(s => (s.jenis_kelamin || "L").toUpperCase() === gender);
    }

    // Update Subtitle Statistik L/P
    const allInClass = (this.studentsState.allList || []).filter(s => s.id_kelas === classId);
    const lCount = allInClass.filter(s => (s.jenis_kelamin || "L").toUpperCase() === "L").length;
    const pCount = allInClass.filter(s => (s.jenis_kelamin || "L").toUpperCase() === "P").length;

    const subtitleEl = document.getElementById("student-detail-class-subtitle");
    if (subtitleEl) {
      subtitleEl.innerHTML = `Total <strong>${allInClass.length} Siswa</strong> terdaftar (👦 ${lCount} Laki-laki • 👧 ${pCount} Perempuan).`;
    }

    this.studentsState.filteredList = list;
    this.renderClassStudentsTable();
  },

  renderClassStudentsTable() {
    const tableBody = document.getElementById("class-students-table-body");
    if (!tableBody) return;

    const list = this.studentsState.filteredList;
    const total = list.length;

    if (total === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada data siswa yang cocok dengan filter.</td></tr>`;
      this.updateClassBulkActionBar();
      this.renderPagination("class-students-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.studentsState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? total : parseInt(pageSize, 10);
    const currentPage = this.studentsState.currentPage;

    const start = isAll ? 0 : (currentPage - 1) * effectivePageSize;
    const pageItems = isAll ? list : list.slice(start, start + effectivePageSize);

    const isSelection = this.studentsState.isSelectionMode;

    tableBody.innerHTML = pageItems.map((s, idx) => {
      const isChecked = this.studentsState.selectedIds.has(s.id_siswa);
      const rowNumber = start + idx + 1;
      const barcodeCode = s.kode_barcode || `MIN5-${s.nisn}`;
      const hp = s.no_hp_ortu || "";
      const waNumber = hp.startsWith("0") ? "62" + hp.substring(1) : hp.startsWith("+62") ? hp.substring(1) : hp;
      const waLink = hp ? `<a href="https://wa.me/${waNumber.replace(/[^0-9]/g, '')}" target="_blank" class="btn-wa-link" title="Kirim Pesan WhatsApp">💬 ${hp}</a>` : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`;

      return `
        <tr style="${isChecked ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
          <td class="col-checkbox-class-student" style="text-align: center; ${isSelection ? '' : 'display: none;'}">
            <input type="checkbox" class="table-checkbox student-row-check" value="${s.id_siswa}" ${isChecked ? 'checked' : ''} onchange="ADMIN.toggleStudentSelection('${s.id_siswa}', this.checked)">
          </td>
          <td>${rowNumber}</td>
          <td><code style="color: #38bdf8; font-weight: 700;">${s.nisn}</code></td>
          <td><strong>${s.nama_lengkap}</strong></td>
          <td>
            <span class="badge ${s.jenis_kelamin === 'P' ? 'badge-purple' : 'badge-info'}" style="font-size: 0.75rem;">
              ${s.jenis_kelamin === 'P' ? '👧 Perempuan' : '👦 Laki-laki'}
            </span>
          </td>
          <td>${waLink}</td>
          <td><span class="badge badge-purple" style="font-family: monospace; font-size: 0.75rem;">${barcodeCode}</span></td>
          <td style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-icon" onclick="window.editStudent('${s.id_siswa}')" title="Edit Data Siswa">
              ✏️
            </button>
            <button class="btn btn-secondary btn-icon" onclick="ADMIN.previewStudentCard('${s.id_siswa}')" title="Cetak / Pratinjau Kartu Siswa">
              🪪
            </button>
            <button class="btn btn-secondary btn-icon" onclick="window.deleteStudent('${s.id_siswa}', '${encodeURIComponent(s.nama_lengkap)}')" title="Hapus Siswa" style="color: #f87171;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Checkbox column header sync
    const thCheckbox = document.getElementById("th-checkbox-class-students");
    if (thCheckbox) thCheckbox.style.display = isSelection ? "table-cell" : "none";

    const headerCheck = document.getElementById("check-all-class-students");
    const visibleIds = pageItems.map(s => s.id_siswa);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.studentsState.selectedIds.has(id));

    if (headerCheck) {
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAllVisibleStudents(visibleIds, e.target.checked);
    }

    const selectAllText = document.getElementById("btn-class-students-select-all-text");
    if (selectAllText) {
      selectAllText.textContent = allVisibleChecked ? "Batalkan Semua" : "Pilih Semua";
    }

    const btnToggle = document.getElementById("btn-toggle-select-class-students");
    if (btnToggle) {
      btnToggle.innerHTML = isSelection ? "✕ Selesai Memilih" : "🔘 Pilih Data Siswa";
      btnToggle.style.background = isSelection ? "rgba(239, 68, 68, 0.15)" : "";
      btnToggle.style.borderColor = isSelection ? "rgba(239, 68, 68, 0.4)" : "";
      btnToggle.style.color = isSelection ? "#fca5a5" : "";
    }

    this.updateClassBulkActionBar();

    // Render Pagination
    this.renderPagination(
      "class-students-pagination",
      total,
      currentPage,
      pageSize,
      (newPage) => {
        this.studentsState.currentPage = newPage;
        this.renderClassStudentsTable();
      },
      (newSize) => {
        this.studentsState.pageSize = newSize;
        this.studentsState.currentPage = 1;
        this.renderClassStudentsTable();
      }
    );
  },

  updateClassBulkActionBar() {
    const bulkBar = document.getElementById("students-class-bulk-bar");
    const countBadge = document.getElementById("bulk-class-selected-count");
    const selectAllText = document.getElementById("btn-class-students-select-all-text");
    const selectedCount = this.studentsState.selectedIds.size;
    const totalFiltered = (this.studentsState.filteredList || []).length;

    if (!bulkBar) return;

    if (this.studentsState.isSelectionMode) {
      bulkBar.classList.add("active");
      if (countBadge) countBadge.textContent = selectedCount;
      if (selectAllText) {
        selectAllText.textContent = (selectedCount > 0 && selectedCount === totalFiltered) ? "Batalkan Semua" : "Pilih Semua";
      }
    } else {
      bulkBar.classList.remove("active");
    }
  },

  // --------------------------------------------------------------------------
  // 3C. TAMPILAN 3: TABEL GLOBAL SELURUH SISWA (FLAT TABLE)
  // --------------------------------------------------------------------------
  handleStudentSearch(term) {
    this.studentsState.currentSearch = term;
    this.applyStudentFilters();
  },

  handleStudentClassFilter(idKelas) {
    this.studentsState.currentClass = idKelas;
    this.applyStudentFilters();
  },

  applyStudentFilters() {
    let list = this.studentsState.allList || [];
    const term = (this.studentsState.currentSearch || "").toLowerCase().trim();
    const idKelas = this.studentsState.currentClass;

    if (idKelas) {
      list = list.filter(s => s.id_kelas === idKelas);
    }

    if (term) {
      list = list.filter(s => 
        (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(term)) || 
        (s.nisn && s.nisn.includes(term)) ||
        (s.nama_kelas && s.nama_kelas.toLowerCase().includes(term))
      );
    }

    this.studentsState.filteredList = list;
    this.studentsState.currentPage = 1;
    this.renderStudentsTable();
  },

  renderStudentsTable() {
    const tableBody = document.getElementById("students-table-body");
    if (!tableBody) return;

    const list = this.studentsState.filteredList;
    const total = list.length;

    if (total === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada data siswa yang cocok.</td></tr>`;
      this.updateBulkActionBar();
      this.renderPagination("students-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.studentsState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? total : parseInt(pageSize, 10);
    const currentPage = this.studentsState.currentPage;

    const start = isAll ? 0 : (currentPage - 1) * effectivePageSize;
    const pageItems = isAll ? list : list.slice(start, start + effectivePageSize);

    const isSelection = this.studentsState.isSelectionMode;

    tableBody.innerHTML = pageItems.map((s, idx) => {
      const isChecked = this.studentsState.selectedIds.has(s.id_siswa);
      const rowNumber = start + idx + 1;
      const hp = s.no_hp_ortu || "";
      const waNumber = hp.startsWith("0") ? "62" + hp.substring(1) : hp.startsWith("+62") ? hp.substring(1) : hp;
      const waLink = hp ? `<a href="https://wa.me/${waNumber.replace(/[^0-9]/g, '')}" target="_blank" class="btn-wa-link" title="Kirim Pesan WhatsApp">💬 ${hp}</a>` : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`;

      return `
        <tr style="${isChecked ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
          <td class="col-checkbox-student" style="text-align: center; ${isSelection ? '' : 'display: none;'}">
            <input type="checkbox" class="table-checkbox student-row-check" value="${s.id_siswa}" ${isChecked ? 'checked' : ''} onchange="ADMIN.toggleStudentSelection('${s.id_siswa}', this.checked)">
          </td>
          <td>${rowNumber}</td>
          <td><code style="color: #38bdf8; font-weight: 700;">${s.nisn}</code></td>
          <td><strong>${s.nama_lengkap}</strong></td>
          <td><span class="badge badge-info">${s.nama_kelas || s.id_kelas}</span></td>
          <td>
            <span class="badge ${s.jenis_kelamin === 'P' ? 'badge-purple' : 'badge-info'}" style="font-size: 0.75rem;">
              ${s.jenis_kelamin === 'P' ? '👧 Perempuan' : '👦 Laki-laki'}
            </span>
          </td>
          <td>${waLink}</td>
          <td style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-icon" onclick="window.editStudent('${s.id_siswa}')" title="Edit Siswa">
              ✏️
            </button>
            <button class="btn btn-secondary btn-icon" onclick="ADMIN.previewStudentCard('${s.id_siswa}')" title="Cetak / Pratinjau Kartu Siswa">
              🪪
            </button>
            <button class="btn btn-secondary btn-icon" onclick="window.deleteStudent('${s.id_siswa}', '${encodeURIComponent(s.nama_lengkap)}')" title="Hapus Siswa" style="color: #f87171;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Update Header Checkbox & Header Column Visibility
    const thCheckbox = document.getElementById("th-checkbox-students");
    if (thCheckbox) thCheckbox.style.display = isSelection ? "table-cell" : "none";

    const headerCheck = document.getElementById("check-all-students");
    const visibleIds = pageItems.map(s => s.id_siswa);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.studentsState.selectedIds.has(id));

    if (headerCheck) {
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAllVisibleStudents(visibleIds, e.target.checked);
    }

    const selectAllText = document.getElementById("btn-students-select-all-text");
    if (selectAllText) {
      selectAllText.textContent = allVisibleChecked ? "Batalkan Semua" : "Pilih Semua";
    }

    const btnToggle = document.getElementById("btn-toggle-select-students");
    if (btnToggle) {
      btnToggle.innerHTML = isSelection ? "✕ Selesai Memilih" : "🔘 Pilih Data Siswa";
      btnToggle.style.background = isSelection ? "rgba(239, 68, 68, 0.15)" : "";
      btnToggle.style.borderColor = isSelection ? "rgba(239, 68, 68, 0.4)" : "";
      btnToggle.style.color = isSelection ? "#fca5a5" : "";
    }

    this.updateBulkActionBar();

    // Render Pagination Controls
    this.renderPagination(
      "students-pagination",
      total,
      currentPage,
      pageSize,
      (newPage) => {
        this.studentsState.currentPage = newPage;
        this.renderStudentsTable();
      },
      (newSize) => {
        this.studentsState.pageSize = newSize;
        this.studentsState.currentPage = 1;
        this.renderStudentsTable();
      }
    );
  },

  // --------------------------------------------------------------------------
  // SELECTION & BULK ACTIONS (SHARED)
  // --------------------------------------------------------------------------
  toggleSelectionMode() {
    this.studentsState.isSelectionMode = !this.studentsState.isSelectionMode;
    if (!this.studentsState.isSelectionMode) {
      this.studentsState.selectedIds.clear();
    }
    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  exitSelectionMode() {
    this.studentsState.isSelectionMode = false;
    this.studentsState.selectedIds.clear();
    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  toggleSelectAllVisible() {
    const list = this.studentsState.filteredList || [];
    if (list.length === 0) return;

    const allChecked = list.every(s => this.studentsState.selectedIds.has(s.id_siswa));

    if (allChecked) {
      list.forEach(s => this.studentsState.selectedIds.delete(s.id_siswa));
    } else {
      list.forEach(s => this.studentsState.selectedIds.add(s.id_siswa));
    }

    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  toggleStudentSelection(idSiswa, isChecked) {
    if (isChecked) {
      this.studentsState.selectedIds.add(idSiswa);
    } else {
      this.studentsState.selectedIds.delete(idSiswa);
    }
    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  toggleSelectAllVisibleStudents(visibleIds, isChecked) {
    visibleIds.forEach(id => {
      if (isChecked) {
        this.studentsState.selectedIds.add(id);
      } else {
        this.studentsState.selectedIds.delete(id);
      }
    });
    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  clearStudentSelection() {
    this.studentsState.selectedIds.clear();
    if (this.studentsState.viewMode === "CLASS_DETAIL") {
      this.renderClassStudentsTable();
    } else {
      this.renderStudentsTable();
    }
  },

  updateBulkActionBar() {
    const bulkBar = document.getElementById("students-bulk-bar");
    const countBadge = document.getElementById("bulk-selected-count");
    const selectAllText = document.getElementById("btn-students-select-all-text");
    const selectedCount = this.studentsState.selectedIds.size;
    const totalFiltered = (this.studentsState.filteredList || []).length;

    if (!bulkBar) return;

    if (this.studentsState.isSelectionMode) {
      bulkBar.classList.add("active");
      if (countBadge) countBadge.textContent = selectedCount;
      if (selectAllText) {
        selectAllText.textContent = (selectedCount > 0 && selectedCount === totalFiltered) ? "Batalkan Semua" : "Pilih Semua";
      }
    } else {
      bulkBar.classList.remove("active");
    }
  },

  async deleteSelectedStudents() {
    const count = this.studentsState.selectedIds.size;
    if (count === 0) {
      showToast("Pilih minimal 1 siswa untuk dihapus.", "warning");
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus ${count} data siswa yang dipilih? Tindakan ini tidak dapat dibatalkan.`)) {
      const ids = Array.from(this.studentsState.selectedIds);
      const idSet = new Set(ids.map(id => String(id || "").trim().toUpperCase()));

      // 1. OPTIMISTIC INSTANT UPDATE (0 ms)
      this.studentsState.allList = (this.studentsState.allList || []).filter(s => 
        !idSet.has(String(s.id_siswa || "").trim().toUpperCase()) && 
        !idSet.has(String(s.nisn || "").trim().toUpperCase())
      );
      this.exitSelectionMode();
      this.refreshCurrentStudentView();
      showToast(`✓ ${count} data siswa berhasil dihapus.`, "success");

      if (window.CARD_GENERATOR) {
        window.CARD_GENERATOR.state.allStudents = (window.CARD_GENERATOR.state.allStudents || []).filter(s => 
          !idSet.has(String(s.id_siswa || "").trim().toUpperCase()) && 
          !idSet.has(String(s.nisn || "").trim().toUpperCase())
        );
      }

      // 2. Kirim sinkronisasi ke backend di latar belakang
      API.deleteMultipleSiswa(ids).catch(err => {
        console.warn("Background delete sync error:", err);
      });
    }
  },

  // ==========================================================================
  // 4. REKAPITULASI PRESENSI & PAGINATION
  // ==========================================================================
  async loadRekap(tglMulai, tglAkhir, idKelas = "") {
    const tableBody = document.getElementById("rekap-table-body");
    const summaryBox = document.getElementById("rekap-summary-badge");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Mengambil data rekap...</td></tr>`;

    const res = await API.getRekapAbsensi(tglMulai, tglAkhir, idKelas);
    const data = res.data || {};
    const items = data.items || [];
    const sum = data.summary || { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 };

    if (summaryBox) {
      summaryBox.innerHTML = `
        <span class="badge badge-success">Hadir: ${sum.hadir}</span>
        <span class="badge badge-warning">Terlambat: ${sum.terlambat}</span>
        <span class="badge badge-info">Izin: ${sum.izin}</span>
        <span class="badge badge-purple">Sakit: ${sum.sakit}</span>
        <span class="badge badge-danger">Alpa: ${sum.alpa}</span>
      `;
    }

    this.rekapState.items = items;
    this.rekapState.periode = data.periode || { mulai: tglMulai, akhir: tglAkhir };
    this.rekapState.idKelas = idKelas;
    this.rekapState.summary = sum;
    this.rekapState.currentPage = 1;

    window.currentRekapData = { periode: this.rekapState.periode, idKelas, summary: sum, items };

    this.renderRekapTable();
  },

  renderRekapTable() {
    const tableBody = document.getElementById("rekap-table-body");
    if (!tableBody) return;

    const items = this.rekapState.items;
    const total = items.length;

    if (total === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">Tidak ada riwayat presensi pada rentang tanggal tersebut.</td></tr>`;
      this.updateRekapBulkActionBar();
      this.renderPagination("rekap-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.rekapState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? total : parseInt(pageSize, 10);
    const currentPage = this.rekapState.currentPage;

    const start = isAll ? 0 : (currentPage - 1) * effectivePageSize;
    const pageItems = isAll ? items : items.slice(start, start + effectivePageSize);
    const isSelection = this.rekapState.isSelectionMode;

    tableBody.innerHTML = pageItems.map((item, idx) => {
      const isChecked = this.rekapState.selectedIds.has(item.id_absensi);
      const isPulang = Boolean(item.jam_pulang);
      const statusBadgeClass = item.status_kehadiran === 'HADIR' ? 'badge-success' :
                               item.status_kehadiran === 'TERLAMBAT' ? 'badge-warning' :
                               item.status_kehadiran === 'IZIN' ? 'badge-info' :
                               item.status_kehadiran === 'SAKIT' ? 'badge-purple' : 'badge-danger';
      const statusLabel = isPulang ? `${item.status_kehadiran} (PULANG)` : item.status_kehadiran;

      return `
        <tr style="${isChecked ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
          <td class="col-checkbox-rekap" style="text-align: center; ${isSelection ? '' : 'display: none;'}">
            <input type="checkbox" class="table-checkbox rekap-row-check" value="${item.id_absensi}" ${isChecked ? 'checked' : ''} onchange="ADMIN.toggleRekapItemSelection('${item.id_absensi}', this.checked)">
          </td>
          <td>${start + idx + 1}</td>
          <td>${item.tanggal}</td>
          <td><code>${item.nisn}</code></td>
          <td><strong>${item.nama_lengkap}</strong></td>
          <td><span class="badge badge-info">${item.nama_kelas || item.id_kelas}</span></td>
          <td>${item.jam_masuk || '-'}</td>
          <td>${item.jam_pulang ? `<span style="color: #38bdf8; font-weight: 600;">🏠 ${item.jam_pulang}</span>` : '<span style="color: var(--text-muted);">-</span>'}</td>
          <td>
            <span class="badge ${statusBadgeClass}">
              ${statusLabel}
            </span>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-icon" onclick="ADMIN.deleteRekapItem('${item.id_absensi}', '${encodeURIComponent(item.nama_lengkap)}', '${item.tanggal}')" title="Hapus Data Presensi Ini" style="color: #f87171; padding: 0.35rem 0.5rem;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Update Header Checkbox & Column Visibility
    const thCheckbox = document.getElementById("th-checkbox-rekap");
    if (thCheckbox) thCheckbox.style.display = isSelection ? "table-cell" : "none";

    const headerCheck = document.getElementById("check-all-rekap");
    const visibleIds = pageItems.map(item => item.id_absensi);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.rekapState.selectedIds.has(id));

    if (headerCheck) {
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAllVisibleRekapRows(visibleIds, e.target.checked);
    }

    const selectAllText = document.getElementById("btn-rekap-select-all-text");
    if (selectAllText) {
      selectAllText.textContent = allVisibleChecked ? "Batalkan Semua" : "Pilih Semua";
    }

    const btnToggle = document.getElementById("btn-toggle-select-rekap");
    if (btnToggle) {
      btnToggle.innerHTML = isSelection ? "✕ Selesai Memilih" : "🔘 Pilih Data Presensi";
      btnToggle.style.background = isSelection ? "rgba(239, 68, 68, 0.15)" : "";
      btnToggle.style.borderColor = isSelection ? "rgba(239, 68, 68, 0.4)" : "";
      btnToggle.style.color = isSelection ? "#fca5a5" : "";
    }

    this.updateRekapBulkActionBar();

    this.renderPagination(
      "rekap-pagination",
      total,
      currentPage,
      pageSize,
      (newPage) => {
        this.rekapState.currentPage = newPage;
        this.renderRekapTable();
      },
      (newSize) => {
        this.rekapState.pageSize = newSize;
        this.rekapState.currentPage = 1;
        this.renderRekapTable();
      }
    );
  },

  toggleRekapSelectionMode() {
    this.rekapState.isSelectionMode = !this.rekapState.isSelectionMode;
    if (!this.rekapState.isSelectionMode) {
      this.rekapState.selectedIds.clear();
    }
    this.renderRekapTable();
  },

  exitRekapSelectionMode() {
    this.rekapState.isSelectionMode = false;
    this.rekapState.selectedIds.clear();
    this.renderRekapTable();
  },

  toggleSelectAllVisibleRekap() {
    const items = this.rekapState.items || [];
    if (items.length === 0) return;

    const allChecked = items.every(item => this.rekapState.selectedIds.has(item.id_absensi));

    if (allChecked) {
      items.forEach(item => this.rekapState.selectedIds.delete(item.id_absensi));
    } else {
      items.forEach(item => this.rekapState.selectedIds.add(item.id_absensi));
    }

    this.renderRekapTable();
  },

  toggleRekapItemSelection(idAbsensi, isChecked) {
    if (isChecked) {
      this.rekapState.selectedIds.add(idAbsensi);
    } else {
      this.rekapState.selectedIds.delete(idAbsensi);
    }
    this.renderRekapTable();
  },

  toggleSelectAllVisibleRekapRows(visibleIds, isChecked) {
    visibleIds.forEach(id => {
      if (isChecked) {
        this.rekapState.selectedIds.add(id);
      } else {
        this.rekapState.selectedIds.delete(id);
      }
    });
    this.renderRekapTable();
  },

  updateRekapBulkActionBar() {
    const bulkBar = document.getElementById("rekap-bulk-bar");
    const countBadge = document.getElementById("rekap-bulk-count");
    const selectAllText = document.getElementById("btn-rekap-select-all-text");
    const selectedCount = this.rekapState.selectedIds.size;
    const totalItems = (this.rekapState.items || []).length;

    if (!bulkBar) return;

    if (this.rekapState.isSelectionMode) {
      bulkBar.classList.add("active");
      if (countBadge) countBadge.textContent = selectedCount;
      if (selectAllText) {
        selectAllText.textContent = (selectedCount > 0 && selectedCount === totalItems) ? "Batalkan Semua" : "Pilih Semua";
      }
    } else {
      bulkBar.classList.remove("active");
    }
  },

  async deleteRekapItem(idAbsensi, encodedNama, tanggal) {
    const namaSiswa = decodeURIComponent(encodedNama || "siswa ini");
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data presensi ${namaSiswa} pada tanggal ${tanggal}?`);
    if (!confirmDelete) return;

    // Optimistic UI
    const idx = this.rekapState.items.findIndex(item => item.id_absensi === idAbsensi);
    if (idx !== -1) {
      this.rekapState.items.splice(idx, 1);
      this.renderRekapTable();
    }

    showToast(`Data presensi ${namaSiswa} (${tanggal}) berhasil dihapus.`, "success");

    // Background sync
    API.deleteAbsensi(idAbsensi).catch(err => {
      console.warn("Delete rekap error:", err);
    });
  },

  async deleteSelectedRekap() {
    const count = this.rekapState.selectedIds.size;
    if (count === 0) {
      showToast("Pilih minimal 1 data presensi untuk dihapus.", "warning");
      return;
    }

    const confirmDelete = confirm(`⚠️ PERINGATAN:\nApakah Anda yakin ingin menghapus ${count} data presensi terpilih secara permanen?`);
    if (!confirmDelete) return;

    const ids = Array.from(this.rekapState.selectedIds);
    const idSet = new Set(ids);

    // Optimistic UI
    this.rekapState.items = this.rekapState.items.filter(item => !idSet.has(item.id_absensi));
    this.rekapState.selectedIds.clear();
    this.rekapState.isSelectionMode = false;
    this.renderRekapTable();

    showToast(`✓ ${count} data presensi berhasil dihapus.`, "success");

    // Background sync
    API.deleteMultipleAbsensi(ids).catch(err => {
      console.warn("Bulk delete rekap error:", err);
    });
  },

  // ==========================================================================
  // 5. HELPER DROPDOWNS & EMIS PARSER
  // ==========================================================================
  populateClassSelects() {
    const selects = document.querySelectorAll(".select-kelas-rombel");
    selects.forEach(select => {
      const hasAllOption = select.getAttribute("data-include-all") === "true";
      let optionsHTML = hasAllOption ? `<option value="">Semua Rombel (1A-D s.d 6A-D)</option>` : `<option value="">Pilih Kelas</option>`;
      optionsHTML += CONFIG.ROMBEL_LIST.map(r => `<option value="${r.id}">${r.nama}</option>`).join("");
      select.innerHTML = optionsHTML;
    });

    this.populateStudentSelect();
  },

  parseEmisWorkbook(workbook) {
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rawRows || rawRows.length < 2) {
      throw new Error("File Excel kosong atau tidak memiliki baris data.");
    }

    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(5, rawRows.length); r++) {
      const rowStr = rawRows[r].join(" ").toLowerCase();
      if (rowStr.includes("nama") || rowStr.includes("nisn")) {
        headerRowIdx = r;
        break;
      }
    }

    const headers = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
    
    let idxNama = headers.findIndex(h => h.includes("nama lengkap") || h.includes("nama"));
    let idxNisn = headers.findIndex(h => h.includes("nisn"));
    let idxRombel = headers.findIndex(h => h.includes("tingkat") || h.includes("rombel") || h.includes("kelas"));
    let idxJk = headers.findIndex(h => h.includes("jenis kelamin") || h.includes("jk"));
    let idxTelp = headers.findIndex(h => h.includes("telepon") || h.includes("telp") || h.includes("hp") || h.includes("wa"));

    if (idxNama === -1) idxNama = 1;
    if (idxNisn === -1) idxNisn = 2;
    if (idxRombel === -1) idxRombel = 6;
    if (idxJk === -1) idxJk = 9;
    if (idxTelp === -1) idxTelp = 11;

    const parsedStudents = [];

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const rawNama = String(row[idxNama] || "").trim();
      const rawNisn = String(row[idxNisn] || "").replace(/['"\s]/g, "").trim();
      const rawRombel = String(row[idxRombel] || "").trim();
      const rawJk = String(row[idxJk] || "").trim();
      const rawTelp = String(row[idxTelp] || "").replace(/['"\s]/g, "").trim();

      if (!rawNama && !rawNisn) continue;

      const matchedRombel = this.normalizeRombel(rawRombel);
      const jk = (rawJk.toLowerCase().startsWith("p") || rawJk.toLowerCase().includes("perempuan")) ? "P" : "L";

      parsedStudents.push({
        nama_lengkap: rawNama,
        nisn: rawNisn,
        id_kelas: matchedRombel.id,
        nama_kelas: matchedRombel.nama,
        jenis_kelamin: jk,
        no_hp_ortu: rawTelp
      });
    }

    return parsedStudents;
  },

  normalizeRombel(raw) {
    if (!raw) return { id: "KLS-1A", nama: "Kelas 1A" };
    
    const clean = raw.toUpperCase().replace(/\s+/g, "");
    
    for (const r of CONFIG.ROMBEL_LIST) {
      const code = r.id.replace("KLS-", "");
      if (clean.includes(code) || clean.includes(`KELAS${code}`) || clean.includes(`KELAS${code[0]}-KELAS${code[0]}${code[1]}`)) {
        return r;
      }
    }

    const match = raw.match(/(\d)\s*[-–]?\s*(?:Kelas\s*)?(\d)?\s*([A-Da-d])/);
    if (match) {
      const tingkat = match[1];
      const huruf = match[3].toUpperCase();
      const targetId = `KLS-${tingkat}${huruf}`;
      const found = CONFIG.ROMBEL_LIST.find(r => r.id === targetId);
      if (found) return found;
    }

    return { id: "KLS-1A", nama: "Kelas 1A" };
  },

  async populateStudentSelect(idKelas = "") {
    const select = document.getElementById("manual-absen-siswa");
    if (!select) return;

    const res = await API.getSiswa(idKelas);
    const list = res.data || [];
    select.innerHTML = `<option value="">-- Pilih Nama Siswa --</option>` + list.map(s => `
      <option value="${s.id_siswa}">${s.nama_lengkap} (${s.nama_kelas || s.id_kelas} - ${s.nisn})</option>
    `).join("");
  }
};

window.ADMIN = ADMIN;

