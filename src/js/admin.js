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
    currentPage: 1,
    pageSize: 10,
    selectedIds: new Set(),
    currentClass: "",
    currentSearch: ""
  },

  rekapState: {
    items: [],
    currentPage: 1,
    pageSize: 10,
    periode: {},
    idKelas: "",
    summary: {}
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
      feedContainer.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada data scan presensi hari ini.</td></tr>`;
      this.renderPagination("dashboard-feed-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.dashboardState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? scans.length : parseInt(pageSize, 10);
    const currentPage = this.dashboardState.currentPage;

    const pageItems = isAll ? scans : scans.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

    feedContainer.innerHTML = pageItems.map(s => `
      <tr>
        <td><strong>${s.nama_lengkap}</strong></td>
        <td>${s.kelas || '-'}</td>
        <td>${s.jam_masuk || '-'}</td>
        <td>
          <span class="badge ${s.status_kehadiran === 'HADIR' ? 'badge-success' : s.status_kehadiran === 'TERLAMBAT' ? 'badge-warning' : 'badge-danger'}">
            ${s.status_kehadiran}
          </span>
        </td>
      </tr>
    `).join("");

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

  // ==========================================================================
  // 3. DATA MASTER SISWA CRUD & BULK ACTIONS
  // ==========================================================================
  async loadStudents(idKelas = "", searchTerm = "") {
    const tableBody = document.getElementById("students-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Memuat data siswa...</td></tr>`;

    this.studentsState.currentClass = idKelas;
    this.studentsState.currentSearch = searchTerm;

    const res = await API.getSiswa(idKelas);
    this.studentsState.allList = res.data || [];

    this.applyStudentFilters();
  },

  handleStudentSearch(term) {
    this.studentsState.currentSearch = term;
    this.applyStudentFilters();
  },

  handleStudentClassFilter(idKelas) {
    this.studentsState.currentClass = idKelas;
    this.loadStudents(idKelas, this.studentsState.currentSearch);
  },

  applyStudentFilters() {
    let list = this.studentsState.allList;
    const term = (this.studentsState.currentSearch || "").toLowerCase();

    if (term) {
      list = list.filter(s => 
        (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(term)) || 
        (s.nisn && s.nisn.includes(term))
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
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Tidak ada data siswa yang cocok.</td></tr>`;
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

    tableBody.innerHTML = pageItems.map((s, idx) => {
      const isChecked = this.studentsState.selectedIds.has(s.id_siswa);
      const rowNumber = start + idx + 1;

      return `
        <tr style="${isChecked ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" class="table-checkbox student-row-check" value="${s.id_siswa}" ${isChecked ? 'checked' : ''} onchange="ADMIN.toggleStudentSelection('${s.id_siswa}', this.checked)">
          </td>
          <td>${rowNumber}</td>
          <td><code>${s.nisn}</code></td>
          <td><strong>${s.nama_lengkap}</strong></td>
          <td><span class="badge badge-info">${s.nama_kelas || s.id_kelas}</span></td>
          <td>${s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
          <td style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-icon" onclick="window.editStudent('${s.id_siswa}')" title="Edit Siswa">
              ✏️
            </button>
            <button class="btn btn-secondary btn-icon" onclick="window.deleteStudent('${s.id_siswa}', '${encodeURIComponent(s.nama_lengkap)}')" title="Hapus Siswa" style="color: #f87171;">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Update Header Checkbox
    const headerCheck = document.getElementById("check-all-students");
    if (headerCheck) {
      const visibleIds = pageItems.map(s => s.id_siswa);
      const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.studentsState.selectedIds.has(id));
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAllVisibleStudents(visibleIds, e.target.checked);
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

  toggleStudentSelection(idSiswa, isChecked) {
    if (isChecked) {
      this.studentsState.selectedIds.add(idSiswa);
    } else {
      this.studentsState.selectedIds.delete(idSiswa);
    }
    this.renderStudentsTable();
  },

  toggleSelectAllVisibleStudents(visibleIds, isChecked) {
    visibleIds.forEach(id => {
      if (isChecked) {
        this.studentsState.selectedIds.add(id);
      } else {
        this.studentsState.selectedIds.delete(id);
      }
    });
    this.renderStudentsTable();
  },

  clearStudentSelection() {
    this.studentsState.selectedIds.clear();
    this.renderStudentsTable();
  },

  updateBulkActionBar() {
    const bulkBar = document.getElementById("students-bulk-bar");
    const countBadge = document.getElementById("bulk-selected-count");
    const selectedCount = this.studentsState.selectedIds.size;

    if (!bulkBar) return;

    if (selectedCount > 0) {
      bulkBar.classList.add("active");
      if (countBadge) countBadge.textContent = selectedCount;
    } else {
      bulkBar.classList.remove("active");
    }
  },

  async deleteSelectedStudents() {
    const count = this.studentsState.selectedIds.size;
    if (count === 0) return;

    if (confirm(`Apakah Anda yakin ingin menghapus ${count} data siswa yang dipilih? Tindakan ini tidak dapat dibatalkan.`)) {
      const ids = Array.from(this.studentsState.selectedIds);
      const res = await API.deleteMultipleSiswa(ids);
      
      if (res.status === "success") {
        if (typeof showToast === 'function') {
          showToast(res.message || `${count} siswa berhasil dihapus.`, "success");
        } else {
          alert(res.message || `${count} siswa berhasil dihapus.`);
        }
        this.clearStudentSelection();
        this.loadStudents(this.studentsState.currentClass, this.studentsState.currentSearch);
      } else {
        if (typeof showToast === 'function') {
          showToast(res.message || "Gagal menghapus siswa.", "danger");
        } else {
          alert(res.message || "Gagal menghapus siswa.");
        }
      }
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
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Tidak ada riwayat presensi pada rentang tanggal tersebut.</td></tr>`;
      this.renderPagination("rekap-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.rekapState.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? total : parseInt(pageSize, 10);
    const currentPage = this.rekapState.currentPage;

    const start = isAll ? 0 : (currentPage - 1) * effectivePageSize;
    const pageItems = isAll ? items : items.slice(start, start + effectivePageSize);

    tableBody.innerHTML = pageItems.map((item, idx) => `
      <tr>
        <td>${start + idx + 1}</td>
        <td>${item.tanggal}</td>
        <td><code>${item.nisn}</code></td>
        <td><strong>${item.nama_lengkap}</strong></td>
        <td>${item.nama_kelas}</td>
        <td>${item.jam_masuk || '-'}</td>
        <td>
          <span class="badge ${
            item.status_kehadiran === 'HADIR' ? 'badge-success' :
            item.status_kehadiran === 'TERLAMBAT' ? 'badge-warning' :
            item.status_kehadiran === 'IZIN' ? 'badge-info' :
            item.status_kehadiran === 'SAKIT' ? 'badge-purple' : 'badge-danger'
          }">
            ${item.status_kehadiran}
          </span>
        </td>
      </tr>
    `).join("");

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

