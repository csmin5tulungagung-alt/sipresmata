/**
 * ============================================================================
 * SIPRESMATA - VERTICAL ID CARD & FOLDER/LIST VIEW GENERATOR MODULE
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung
 * ============================================================================
 */

import { API } from './api.js';
import { CONFIG } from './config.js';
import { ADMIN } from './admin.js';

export const CARD_GENERATOR = {
  state: {
    currentView: "FOLDERS", // "FOLDERS" | "CLASS_LIST"
    selectedClassId: "",
    selectedClassName: "",
    allStudents: [],
    classStudents: [],
    filteredStudents: [],
    currentPage: 1,
    pageSize: 10,
    selectedIds: new Set(),
    searchTerm: "",
    isSelectionMode: false,
    previewStudent: null,

    // TEACHER CARDS EXTENSION
    activeCardTab: "SISWA", // "SISWA" | "GURU"
    teacherList: [],
    filteredTeachers: [],
    teacherCurrentPage: 1,
    teacherPageSize: 10,
    teacherSearchTerm: "",
    teacherJabatanFilter: "ALL",
    teacherStatusFilter: "ALL",
    selectedTeacherIds: new Set(),
    isTeacherSelectionMode: false,
    previewTeacher: null
  },

  // ==========================================================================
  // 1. TAMPILAN UTAMA: GRID FOLDER 24 ROMBEL (INSTANT CACHE RENDER)
  // ==========================================================================
  async renderFolderView(forceRefresh = false) {
    const foldersView = document.getElementById("cards-folders-view");
    const listView = document.getElementById("cards-list-view");
    const gridContainer = document.getElementById("class-folders-grid");

    if (foldersView) foldersView.style.display = "block";
    if (listView) listView.style.display = "none";
    this.state.currentView = "FOLDERS";

    if (!gridContainer) return;

    // 1. Jika data sudah ada di memory, render folder grid SEKETIKA (< 1ms)!
    if (this.state.allStudents && this.state.allStudents.length > 0 && !forceRefresh) {
      this.renderFolderCardsGrid(gridContainer);
    } else {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;">⏳</div>
          Memuat data rombongan belajar...
        </div>
      `;
    }

    try {
      const res = await API.getSiswa("", forceRefresh);
      this.state.allStudents = res.data || [];
      this.renderFolderCardsGrid(gridContainer);
    } catch (e) {
      console.error("Gagal memuat folder kelas:", e);
      if (!this.state.allStudents || this.state.allStudents.length === 0) {
        gridContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #f87171;">Gagal memuat data rombel: ${e.message}</div>`;
      }
    }
  },

  renderFolderCardsGrid(gridContainer) {
    if (!gridContainer) return;

    // Hitung jumlah siswa per kelas
    const countMap = {};
    (this.state.allStudents || []).forEach(s => {
      const k = s.id_kelas || "KLS-1A";
      countMap[k] = (countMap[k] || 0) + 1;
    });

    gridContainer.innerHTML = CONFIG.ROMBEL_LIST.map(r => {
      const count = countMap[r.id] || 0;
      const gedung = r.tingkat <= 3 ? "Gedung A (Bawah)" : "Gedung B (Atas)";

      return `
        <div class="class-folder-card" onclick="CARD_GENERATOR.openClassFolder('${r.id}', '${r.nama}')">
          <div class="folder-card-header">
            <div class="folder-icon-wrapper">📁</div>
            <div>
              <div class="folder-info-title">${r.nama}</div>
              <div class="folder-info-desc">Tingkat ${r.tingkat} • ${gedung}</div>
            </div>
          </div>

          <div class="folder-card-footer">
            <span class="folder-student-badge ${count === 0 ? 'empty' : ''}">
              👥 ${count} Siswa
            </span>
            <span class="folder-action-text">
              Buka Kelas ➔
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  // ==========================================================================
  // 2. BUKA FOLDER KELAS: TABEL LIST SISWA
  // ==========================================================================
  openClassFolder(idKelas, namaKelas) {
    this.state.selectedClassId = idKelas;
    this.state.selectedClassName = namaKelas;
    this.state.currentView = "CLASS_LIST";
    this.state.currentPage = 1;
    this.state.searchTerm = "";
    this.state.selectedIds.clear();

    const foldersView = document.getElementById("cards-folders-view");
    const listView = document.getElementById("cards-list-view");
    const titleEl = document.getElementById("card-list-class-title");
    const subtitleEl = document.getElementById("card-list-class-subtitle");
    const searchInput = document.getElementById("search-card-student");

    if (foldersView) foldersView.style.display = "none";
    if (listView) listView.style.display = "block";
    if (titleEl) titleEl.textContent = `📁 Folder ${namaKelas}`;
    if (searchInput) searchInput.value = "";

    // Filter siswa khusus kelas yang dibuka
    this.state.classStudents = this.state.allStudents.filter(s => s.id_kelas === idKelas);
    if (subtitleEl) {
      subtitleEl.textContent = `Daftar ${this.state.classStudents.length} siswa siap cetak kartu barcode & QR Code.`;
    }

    this.applyFiltersAndRenderTable();
  },

  backToFolders() {
    this.renderFolderView();
  },

  handleSearch(term) {
    this.state.searchTerm = term;
    this.state.currentPage = 1;
    this.applyFiltersAndRenderTable();
  },

  applyFiltersAndRenderTable() {
    let list = this.state.classStudents;
    const term = (this.state.searchTerm || "").toLowerCase().trim();

    if (term) {
      list = list.filter(s => 
        (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(term)) || 
        (s.nisn && s.nisn.includes(term))
      );
    }

    this.state.filteredStudents = list;
    this.renderCardsTable();
  },

  renderCardsTable() {
    const tableBody = document.getElementById("cards-table-body");
    if (!tableBody) return;

    const list = this.state.filteredStudents;
    const total = list.length;

    if (total === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Belum ada data siswa untuk kelas ini.</td></tr>`;
      this.updateBulkBar();
      ADMIN.renderPagination("cards-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const pageSize = this.state.pageSize;
    const isAll = pageSize === "ALL";
    const effectivePageSize = isAll ? total : parseInt(pageSize, 10);
    const currentPage = this.state.currentPage;

    const start = isAll ? 0 : (currentPage - 1) * effectivePageSize;
    const pageItems = isAll ? list : list.slice(start, start + effectivePageSize);

    const isSelection = this.state.isSelectionMode;

    tableBody.innerHTML = pageItems.map((s, idx) => {
      const isChecked = this.state.selectedIds.has(s.id_siswa);
      const rowNum = start + idx + 1;
      const barcodeCode = s.kode_barcode || `MIN5-${s.nisn}`;

      return `
        <tr style="${isChecked ? 'background: rgba(2, 132, 199, 0.08);' : ''}">
          <td class="col-checkbox-card" style="text-align: center; ${isSelection ? '' : 'display: none;'}">
            <input type="checkbox" class="table-checkbox card-student-row-check" value="${s.id_siswa}" ${isChecked ? 'checked' : ''} onchange="CARD_GENERATOR.toggleSelection('${s.id_siswa}', this.checked)">
          </td>
          <td>${rowNum}</td>
          <td><code>${s.nisn}</code></td>
          <td><strong>${s.nama_lengkap}</strong></td>
          <td><span class="badge badge-info">${s.nama_kelas || this.state.selectedClassName}</span></td>
          <td><span class="badge badge-purple" style="font-family: monospace;">${barcodeCode}</span></td>
          <td>
            <div class="table-action-group">
              <button type="button" class="btn-action-pill btn-action-pill-cyan" onclick="CARD_GENERATOR.previewCard('${s.id_siswa}')" title="Lihat Pratinjau Kartu Siswa">
                👁️ Lihat
              </button>
              <button type="button" class="btn-action-pill btn-action-pill-emerald" onclick="CARD_GENERATOR.downloadSingleCardById('${s.id_siswa}')" title="Unduh Kartu PNG">
                📥 Unduh
              </button>
              <button type="button" class="btn-action-icon-danger" onclick="CARD_GENERATOR.deleteStudent('${s.id_siswa}', '${encodeURIComponent(s.nama_lengkap || '').replace(/'/g, '%27')}')" title="Hapus Siswa">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Update Header Checkbox & Header Column Visibility
    const thCheckbox = document.getElementById("th-checkbox-cards");
    if (thCheckbox) thCheckbox.style.display = isSelection ? "table-cell" : "none";

    const headerCheck = document.getElementById("check-all-card-students");
    const visibleIds = pageItems.map(s => s.id_siswa);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.state.selectedIds.has(id));

    if (headerCheck) {
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAll(visibleIds, e.target.checked);
    }

    const selectAllText = document.getElementById("btn-cards-select-all-text");
    if (selectAllText) {
      selectAllText.textContent = allVisibleChecked ? "Batalkan Semua" : "Pilih Semua";
    }

    const btnToggle = document.getElementById("btn-toggle-select-cards");
    if (btnToggle) {
      btnToggle.innerHTML = isSelection ? "✕ Selesai Memilih" : "🔘 Pilih Siswa";
      btnToggle.style.background = isSelection ? "rgba(2, 132, 199, 0.15)" : "";
      btnToggle.style.borderColor = isSelection ? "rgba(2, 132, 199, 0.4)" : "";
      btnToggle.style.color = isSelection ? "#38bdf8" : "";
    }

    this.updateBulkBar();

    // Render Pagination Controls
    ADMIN.renderPagination(
      "cards-pagination",
      total,
      currentPage,
      pageSize,
      (newPage) => {
        this.state.currentPage = newPage;
        this.renderCardsTable();
      },
      (newSize) => {
        this.state.pageSize = newSize;
        this.state.currentPage = 1;
        this.renderCardsTable();
      }
    );
  },

  // ==========================================================================
  // 3. CHECKLIST MULTI-SELECT & BULK ACTIONS
  // ==========================================================================
  toggleSelectionMode() {
    this.state.isSelectionMode = !this.state.isSelectionMode;
    if (!this.state.isSelectionMode) {
      this.state.selectedIds.clear();
    }
    this.renderCardsTable();
  },

  exitSelectionMode() {
    this.state.isSelectionMode = false;
    this.state.selectedIds.clear();
    this.renderCardsTable();
  },

  toggleSelectAllVisible() {
    const list = this.state.filteredList || [];
    if (list.length === 0) return;

    // Cek apakah seluruh siswa pada kelas ini (seluruh halaman) sudah terpilih
    const allChecked = list.every(s => this.state.selectedIds.has(s.id_siswa));

    if (allChecked) {
      // Batalkan semua
      list.forEach(s => this.state.selectedIds.delete(s.id_siswa));
    } else {
      // Pilih semua siswa pada kelas ini
      list.forEach(s => this.state.selectedIds.add(s.id_siswa));
    }

    this.renderCardsTable();
  },

  toggleSelection(idSiswa, isChecked) {
    if (isChecked) {
      this.state.selectedIds.add(idSiswa);
    } else {
      this.state.selectedIds.delete(idSiswa);
    }
    this.renderCardsTable();
  },

  toggleSelectAll(visibleIds, isChecked) {
    visibleIds.forEach(id => {
      if (isChecked) {
        this.state.selectedIds.add(id);
      } else {
        this.state.selectedIds.delete(id);
      }
    });
    this.renderCardsTable();
  },

  clearSelection() {
    this.state.selectedIds.clear();
    this.renderCardsTable();
  },

  updateBulkBar() {
    const bulkBar = document.getElementById("cards-bulk-bar");
    const countBadge = document.getElementById("cards-bulk-count");
    const selectAllText = document.getElementById("btn-cards-select-all-text");
    const selectedCount = this.state.selectedIds.size;
    const totalFiltered = (this.state.filteredList || []).length;

    if (!bulkBar) return;

    if (this.state.isSelectionMode) {
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
    const count = this.state.selectedIds.size;
    if (count === 0) {
      showToast("Pilih minimal 1 siswa untuk dihapus.", "warning");
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus ${count} data siswa yang dipilih? Tindakan ini tidak dapat dibatalkan.`)) {
      const ids = Array.from(this.state.selectedIds);
      const idSet = new Set(ids.map(id => String(id || "").trim().toUpperCase()));

      // 1. OPTIMISTIC INSTANT UPDATE (0 ms): Hapus seketika dari tabel & memori
      this.state.allStudents = (this.state.allStudents || []).filter(s => 
        !idSet.has(String(s.id_siswa || "").trim().toUpperCase()) && 
        !idSet.has(String(s.nisn || "").trim().toUpperCase())
      );
      this.clearSelection();
      this.openClassFolder(this.state.selectedClassId, this.state.selectedClassName);
      showToast(`✓ ${count} data siswa berhasil dihapus.`, "success");

      if (window.ADMIN) {
        window.ADMIN.studentsState.allList = (window.ADMIN.studentsState.allList || []).filter(s => 
          !idSet.has(String(s.id_siswa || "").trim().toUpperCase()) && 
          !idSet.has(String(s.nisn || "").trim().toUpperCase())
        );
      }

      // 2. Kirim sinkronisasi ke backend di latar belakang
      API.deleteMultipleSiswa(ids).catch(err => {
        console.warn("Background bulk delete error:", err);
      });
    }
  },

  async deleteStudent(idSiswa, encodedNama) {
    const nama = decodeURIComponent(encodedNama || "siswa ini");
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${nama}?`)) {
      const cleanId = String(idSiswa || "").trim().toUpperCase();

      // 1. OPTIMISTIC INSTANT UPDATE (0 ms): Hapus seketika dari tabel & memori
      this.state.allStudents = (this.state.allStudents || []).filter(s => 
        String(s.id_siswa || "").trim().toUpperCase() !== cleanId && 
        String(s.nisn || "").trim().toUpperCase() !== cleanId
      );
      this.openClassFolder(this.state.selectedClassId, this.state.selectedClassName);
      showToast(`✓ Siswa ${nama} berhasil dihapus.`, "success");

      if (window.ADMIN) {
        window.ADMIN.studentsState.allList = (window.ADMIN.studentsState.allList || []).filter(s => 
          String(s.id_siswa || "").trim().toUpperCase() !== cleanId && 
          String(s.nisn || "").trim().toUpperCase() !== cleanId
        );
      }

      // 2. Kirim sinkronisasi ke backend di latar belakang
      API.deleteSiswa(idSiswa).catch(err => {
        console.warn("Background delete error:", err);
      });
    }
  },

  // ==========================================================================
  // 4. MODAL POP-UP PREVIEW KARTU SISWA (HD 300 DPI)
  // ==========================================================================
  // Helper: Render QR code secara aman ke format Tag <img> (mencegah error html2canvas createPattern)
  async renderCardQRToImage(qrElem, qrText) {
    if (!qrElem || typeof QRCode === 'undefined') return;
    qrElem.innerHTML = "";
    
    const tempDiv = document.createElement("div");
    tempDiv.style.width = "156px";
    tempDiv.style.height = "156px";
    
    try {
      new QRCode(tempDiv, {
        text: qrText,
        width: 156,
        height: 156,
        colorDark: "#ffffff",
        colorLight: "#022b1d",
        correctLevel: QRCode.CorrectLevel.M
      });

      // Tunggu generate canvas
      await new Promise(r => setTimeout(r, 60));

      const canvas = tempDiv.querySelector("canvas");
      if (canvas && canvas.width > 0) {
        const dataUrl = canvas.toDataURL("image/png");
        qrElem.innerHTML = `<img src="${dataUrl}" width="156" height="156" style="width:156px;height:156px;display:block;margin:auto;" alt="QR" />`;
      } else {
        const img = tempDiv.querySelector("img");
        if (img && img.src) {
          qrElem.innerHTML = `<img src="${img.src}" width="156" height="156" style="width:156px;height:156px;display:block;margin:auto;" alt="QR" />`;
        }
      }
    } catch (e) {
      console.warn("QR Render warning:", e);
    }
  },

  // ==========================================================================
  // 4. MODAL POP-UP PREVIEW KARTU SISWA (HD 300 DPI)
  // ==========================================================================
  async previewCard(idSiswa) {
    const student = (this.state.allStudents || []).find(s => s.id_siswa === idSiswa) || 
                    (window.ADMIN && (window.ADMIN.studentsState.allList || []).find(s => s.id_siswa === idSiswa));
    if (!student) {
      showToast("Data siswa tidak ditemukan untuk kartu.", "warning");
      return;
    }

    this.state.previewStudent = student;

    const modal = document.getElementById("modal-card-preview");
    const nameEl = document.getElementById("preview-modal-student-name");
    const metaEl = document.getElementById("preview-modal-student-meta");
    const container = document.getElementById("preview-card-container");
    const btnDownload = document.getElementById("btn-modal-download-card");
    const btnPrint = document.getElementById("btn-modal-print-card");

    if (nameEl) nameEl.textContent = student.nama_lengkap;
    if (metaEl) metaEl.textContent = `${student.nama_kelas || student.id_kelas} • NISN: ${student.nisn}`;

    if (container) {
      container.innerHTML = this.createCardHTML(student);
      const qrElem = container.querySelector(`#qrcode-${student.id_siswa}`);
      const qrText = student.kode_barcode || `MIN5-${student.nisn}`;
      await this.renderCardQRToImage(qrElem, qrText);
    }

    if (btnDownload) {
      btnDownload.onclick = () => this.downloadSingleCardById(student.id_siswa);
    }

    if (btnPrint) {
      btnPrint.onclick = () => this.printSingleCard(student);
    }

    if (typeof openModal === 'function') {
      openModal("modal-card-preview");
    } else if (modal) {
      modal.classList.add("active");
    }
  },

  createCardHTML(s) {
    const rawKelas = s.nama_kelas || s.id_kelas || "1-A";
    const shortKelas = rawKelas.replace(/Kelas\s*/i, "").replace("KLS-", "").trim();

    return `
      <div class="student-card-portrait" id="card-item-${s.id_siswa}" data-student-id="${s.id_siswa}" data-nisn="${s.nisn}" data-nama="${s.nama_lengkap}" data-kelas="${shortKelas}">
        
        <!-- Ornamen Sudut Emas Mewah (Top-Left & Bottom-Right) -->
        <svg class="card-gold-corner tl" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldCornerGradTL_${s.id_siswa}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fef08a" />
              <stop offset="35%" stop-color="#eab308" />
              <stop offset="70%" stop-color="#ca8a04" />
              <stop offset="100%" stop-color="#854d0e" />
            </linearGradient>
          </defs>
          <path d="M-15 45 L45 -15 L52 -15 L-15 52 Z" fill="url(#goldCornerGradTL_${s.id_siswa})" opacity="0.95" />
          <path d="M-15 65 L65 -15 L68 -15 L-15 68 Z" fill="url(#goldCornerGradTL_${s.id_siswa})" opacity="0.75" />
        </svg>

        <svg class="card-gold-corner br" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldCornerGradBR_${s.id_siswa}" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#fef08a" />
              <stop offset="35%" stop-color="#eab308" />
              <stop offset="70%" stop-color="#ca8a04" />
              <stop offset="100%" stop-color="#854d0e" />
            </linearGradient>
          </defs>
          <path d="M95 35 L35 95 L28 95 L95 28 Z" fill="url(#goldCornerGradBR_${s.id_siswa})" opacity="0.95" />
          <path d="M95 15 L15 95 L12 95 L95 12 Z" fill="url(#goldCornerGradBR_${s.id_siswa})" opacity="0.75" />
        </svg>

        <!-- 1. Header: Logo & Judul Madrasah -->
        <div class="card-header-section">
          <div class="card-logo-container">
            <img src="/logo-min5.png" class="card-min5-logo" alt="Logo MIN 5 Tulungagung">
          </div>

          <div class="card-header-texts">
            <div class="card-badge-subtitle">KARTU ABSEN SISWA</div>
            <div class="card-badge-line"></div>
            <div class="card-badge-title">MIN 5 TULUNGAGUNG</div>
          </div>
        </div>

        <!-- 3. Kotak QR Code Pemindai Presensi (Besar & Kontras Tinggi) -->
        <div class="card-qr-box">
          <div id="qrcode-${s.id_siswa}" class="card-qr-render"></div>
        </div>

        <!-- 4. Identitas Siswa & Footer -->
        <div class="card-student-section">
          <div class="card-student-fullname" title="${s.nama_lengkap}">${s.nama_lengkap}</div>
          <div class="card-student-gold-line"></div>

          <div class="card-student-meta-grid">
            <div class="card-student-meta-item">
              <svg class="card-meta-svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
              <div class="card-meta-detail">
                <span class="card-meta-heading">KELAS</span>
                <span class="card-meta-value">${shortKelas}</span>
              </div>
            </div>

            <div class="card-meta-separator"></div>

            <div class="card-student-meta-item">
              <svg class="card-meta-svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <div class="card-meta-detail">
                <span class="card-meta-heading">NO. ABSEN</span>
                <span class="card-meta-value">${s.nisn || s.id_siswa}</span>
              </div>
            </div>
          </div>

          <div class="card-footer-prompt">
            <span class="card-footer-line"></span>
            <span class="card-footer-text">SCAN UNTUK ABSENSI</span>
            <span class="card-footer-line"></span>
          </div>
        </div>

      </div>
    `;
  },

  // ==========================================================================
  // 5. UNDUH SINGLE PNG CARD
  // ==========================================================================
  async downloadSingleCardById(idSiswa) {
    const student = (this.state.allStudents || []).find(s => s.id_siswa === idSiswa) ||
                    this.state.previewStudent ||
                    (window.ADMIN && (window.ADMIN.studentsState.allList || []).find(s => s.id_siswa === idSiswa));
    if (!student) {
      if (typeof showToast === 'function') showToast("Data siswa tidak ditemukan untuk diunduh.", "warning");
      return;
    }

    // Safety Monkey-Patch Canvas createPattern
    if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype.createPattern) {
      const _orig = CanvasRenderingContext2D.prototype.createPattern;
      CanvasRenderingContext2D.prototype.createPattern = function(img, rep) {
        if (!img || img.width === 0 || img.height === 0 || img.naturalWidth === 0 || img.naturalHeight === 0) {
          const fb = document.createElement('canvas');
          fb.width = 2;
          fb.height = 2;
          return _orig.call(this, fb, rep || 'repeat');
        }
        try {
          return _orig.call(this, img, rep);
        } catch (e) {
          const fb = document.createElement('canvas');
          fb.width = 2;
          fb.height = 2;
          return _orig.call(this, fb, rep || 'repeat');
        }
      };
    }

    // Buat container bersih dalam viewport agar kalkulasi rendering 100% akurat
    const captureWrapper = document.createElement("div");
    captureWrapper.style.position = "fixed";
    captureWrapper.style.left = "0";
    captureWrapper.style.top = "0";
    captureWrapper.style.width = "290px";
    captureWrapper.style.height = "460px";
    captureWrapper.style.opacity = "0.01";
    captureWrapper.style.pointerEvents = "none";
    captureWrapper.style.zIndex = "-999";
    captureWrapper.style.background = "#ffffff";
    captureWrapper.innerHTML = this.createCardHTML(student);
    document.body.appendChild(captureWrapper);

    const cardEl = captureWrapper.querySelector(".student-card-portrait");
    const qrElem = captureWrapper.querySelector(`#qrcode-${student.id_siswa}`);

    const qrText = student.kode_barcode || `MIN5-${student.nisn}`;
    await this.renderCardQRToImage(qrElem, qrText);

    // Pastikan semua gambar dalam kartu sudah termuat / decode sebelum capture
    const images = Array.from(captureWrapper.querySelectorAll("img"));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }));

    // Tunggu render elemen & fonts
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(r => setTimeout(r, 100));

    try {
      const targetElement = cardEl || captureWrapper;
      const canvas = await html2canvas(targetElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false
      });

      const cleanNama = String(student.nama_lengkap || "Siswa").replace(/[\\/:*?"<>|]/g, "_").trim();
      const nisn = String(student.nisn || student.id_siswa || "000");
      const fileName = `Kartu_${nisn}_${cleanNama}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (typeof showToast === 'function') {
        showToast(`✓ Kartu ${student.nama_lengkap} berhasil diunduh.`, "success");
      }
    } catch (err) {
      console.error("Gagal download PNG:", err);
      alert("Gagal mengunduh kartu: " + err.message);
    } finally {
      if (captureWrapper && captureWrapper.parentNode) {
        document.body.removeChild(captureWrapper);
      }
    }
  },

  printSingleCard(student) {
    const printContainer = document.getElementById("printable-cards-area");
    if (!printContainer) return;

    printContainer.style.display = "grid";
    printContainer.innerHTML = this.createCardHTML(student);

    const qrElem = printContainer.querySelector(`#qrcode-${student.id_siswa}`);
    if (qrElem && typeof QRCode !== 'undefined') {
      new QRCode(qrElem, {
        text: student.kode_barcode || `MIN5-${student.nisn}`,
        width: 156,
        height: 156,
        colorDark: "#ffffff",
        colorLight: "#022b1d",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    setTimeout(() => {
      window.print();
      printContainer.style.display = "none";
    }, 200);
  },

  // ==========================================================================
  // 6. ZIP EXPORT ENGINE (ZIP PER KELAS / SELURUH SISWA / TERPILIH)
  // ==========================================================================
  async exportAllZip() {
    return this.processZipExport(this.state.allStudents, "Semua_Rombel");
  },

  async exportClassZip() {
    return this.processZipExport(this.state.classStudents, this.state.selectedClassName || "Kelas");
  },

  async exportSelectedZip() {
    const selectedList = this.state.classStudents.filter(s => this.state.selectedIds.has(s.id_siswa));
    if (selectedList.length === 0) {
      alert("Tidak ada siswa yang dipilih.");
      return;
    }
    return this.processZipExport(selectedList, `${this.state.selectedClassName}_Pilihan`);
  },

  async processZipExport(studentsList, labelName) {
    if (!studentsList || studentsList.length === 0) {
      alert("Tidak ada data siswa untuk diekspor ke ZIP.");
      return;
    }

    if (typeof JSZip === 'undefined' || typeof html2canvas === 'undefined') {
      alert("Pustaka JSZip atau html2canvas belum termuat.");
      return;
    }

    const progressBar = document.getElementById("zip-progress-bar");
    const progressStatus = document.getElementById("zip-progress-status");
    const progressPercent = document.getElementById("zip-progress-percent");

    if (typeof openModal === 'function') {
      openModal("modal-zip-progress");
    }

    if (progressBar) progressBar.style.width = "0%";
    if (progressStatus) progressStatus.textContent = "Menyiapkan elemen kartu...";
    if (progressPercent) progressPercent.textContent = "0%";

    const zip = new JSZip();
    const total = studentsList.length;

    // Temporary container untuk render off-screen dengan ukuran pasti dalam viewport
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "fixed";
    tempContainer.style.left = "0";
    tempContainer.style.top = "0";
    tempContainer.style.width = "290px";
    tempContainer.style.height = "460px";
    tempContainer.style.opacity = "0.01";
    tempContainer.style.pointerEvents = "none";
    tempContainer.style.zIndex = "-999";
    tempContainer.style.background = "#ffffff";
    document.body.appendChild(tempContainer);

    try {
      for (let i = 0; i < total; i++) {
        const s = studentsList[i];
        const percent = Math.round(((i + 1) / total) * 100);

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressStatus) progressStatus.textContent = `Merender ${i + 1}/${total}: ${s.nama_lengkap}`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;

        tempContainer.innerHTML = this.createCardHTML(s);
        const cardEl = tempContainer.querySelector(".student-card-portrait");
        const qrElem = tempContainer.querySelector(`#qrcode-${s.id_siswa}`);

        const qrText = s.kode_barcode || `MIN5-${s.nisn}`;
        await this.renderCardQRToImage(qrElem, qrText);

        const images = Array.from(tempContainer.querySelectorAll("img"));
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => {
            img.onload = () => res();
            img.onerror = () => res();
          });
        }));

        await new Promise(r => setTimeout(r, 60));

        const canvas = await html2canvas(cardEl || tempContainer, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false
        });

        const base64Data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
        const cleanNama = s.nama_lengkap.replace(/[\\/:*?"<>|]/g, "_").trim();
        const cleanKelas = (s.nama_kelas || "Kelas").replace(/[\\/:*?"<>|]/g, "_").trim();
        const fileName = `${s.nisn}_${cleanNama}.png`;

        zip.folder(cleanKelas).file(fileName, base64Data, { base64: true });
      }

      if (progressStatus) progressStatus.textContent = "Mengompresi file ZIP...";
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const dateStr = new Date().toISOString().split("T")[0];
      const zipFileName = `Kartu_Presensi_MIN5_${labelName.replace(/\s+/g, '_')}_${dateStr}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal("modal-zip-progress");
        if (typeof showToast === 'function') {
          showToast(`Berhasil mengunduh ${total} kartu ke ${zipFileName}`, "success");
        }
      }, 400);

    } catch (err) {
      console.error("ZIP Export Error:", err);
      if (typeof closeModal === 'function') closeModal("modal-zip-progress");
      alert("Gagal membuat file ZIP: " + err.message);
    } finally {
      if (tempContainer) document.body.removeChild(tempContainer);
    }
  },

  // ==========================================================================
  // 7. PRINT A4 BATCH ENGINES
  // ==========================================================================
  printAllCards() {
    this.printBatchCards(this.state.allStudents);
  },

  printClassCards() {
    this.printBatchCards(this.state.classStudents);
  },

  printBatchCards(studentsList) {
    if (!studentsList || studentsList.length === 0) {
      alert("Tidak ada kartu siswa untuk dicetak.");
      return;
    }

    const printContainer = document.getElementById("printable-cards-area");
    if (!printContainer) return;

    printContainer.style.display = "grid";
    printContainer.innerHTML = studentsList.map(s => this.createCardHTML(s)).join("");

    studentsList.forEach(s => {
      const qrElem = printContainer.querySelector(`#qrcode-${s.id_siswa}`);
      if (qrElem && typeof QRCode !== 'undefined') {
        new QRCode(qrElem, {
          text: s.kode_barcode || `MIN5-${s.nisn}`,
          width: 156,
          height: 156,
          colorDark: "#ffffff",
          colorLight: "#022b1d",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    });

    setTimeout(() => {
      window.print();
      printContainer.style.display = "none";
    }, 400);
  },

  // ==========================================================================
  // 8. TAB SWITCHER: SISWA VS GURU
  // ==========================================================================
  switchTargetTab(target) {
    this.state.activeCardTab = target;
    const btnSiswa = document.getElementById("btn-tab-cards-siswa");
    const btnGuru = document.getElementById("btn-tab-cards-guru");
    const subviewSiswa = document.getElementById("cards-subview-siswa");
    const subviewGuru = document.getElementById("cards-subview-guru");

    if (target === "GURU") {
      if (btnSiswa) { btnSiswa.classList.remove("btn-primary", "active"); btnSiswa.classList.add("btn-secondary"); }
      if (btnGuru) { btnGuru.classList.remove("btn-secondary"); btnGuru.classList.add("btn-primary", "active"); }
      if (subviewSiswa) subviewSiswa.style.display = "none";
      if (subviewGuru) subviewGuru.style.display = "block";
      this.renderTeacherCardsView();
    } else {
      if (btnGuru) { btnGuru.classList.remove("btn-primary", "active"); btnGuru.classList.add("btn-secondary"); }
      if (btnSiswa) { btnSiswa.classList.remove("btn-secondary"); btnSiswa.classList.add("btn-primary", "active"); }
      if (subviewSiswa) subviewSiswa.style.display = "block";
      if (subviewGuru) subviewGuru.style.display = "none";
    }
  },

  // ==========================================================================
  // 9. TEACHER CARDS ENGINE (DATA, FILTER, TABEL, SELECTION)
  // ==========================================================================
  async renderTeacherCardsView(forceRefresh = false) {
    const tbody = document.getElementById("teacher-cards-table-body");
    if (!tbody) return;

    if (this.state.teacherList && this.state.teacherList.length > 0 && !forceRefresh) {
      this.applyTeacherFiltersAndRender();
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;">⏳</div>
          Memuat data guru & tenaga kependidikan...
        </td>
      </tr>
    `;

    try {
      const res = await API.getGuru(forceRefresh);
      this.state.teacherList = res.data || [];
      this.applyTeacherFiltersAndRender();
    } catch (err) {
      console.error("Gagal memuat kartu guru:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: #f87171;">
            Gagal memuat data guru: ${err.message}
          </td>
        </tr>
      `;
    }
  },

  handleTeacherSearch(term) {
    this.state.teacherSearchTerm = (term || "").trim().toLowerCase();
    this.state.teacherCurrentPage = 1;
    this.applyTeacherFiltersAndRender();
  },

  handleTeacherFilter() {
    const elJabatan = document.getElementById("filter-card-teacher-jabatan");
    const elStatus = document.getElementById("filter-card-teacher-status");
    this.state.teacherJabatanFilter = elJabatan ? elJabatan.value : "ALL";
    this.state.teacherStatusFilter = elStatus ? elStatus.value : "ALL";
    this.state.teacherCurrentPage = 1;
    this.applyTeacherFiltersAndRender();
  },

  applyTeacherFiltersAndRender() {
    let list = this.state.teacherList || [];
    const q = this.state.teacherSearchTerm;
    const j = this.state.teacherJabatanFilter;
    const s = this.state.teacherStatusFilter;

    if (q) {
      list = list.filter(g => 
        (g.nama_guru && g.nama_guru.toLowerCase().includes(q)) ||
        (g.nip && g.nip.toLowerCase().includes(q)) ||
        (g.jabatan && g.jabatan.toLowerCase().includes(q)) ||
        (g.tugas_tambahan && g.tugas_tambahan.toLowerCase().includes(q))
      );
    }

    if (j && j !== "ALL") {
      list = list.filter(g => g.jabatan === j);
    }

    if (s && s !== "ALL") {
      list = list.filter(g => g.status_kepegawaian === s);
    }

    this.state.filteredTeachers = list;
    this.renderTeacherCardsTable();
  },

  renderTeacherCardsTable() {
    const tbody = document.getElementById("teacher-cards-table-body");
    if (!tbody) return;

    const list = this.state.filteredTeachers || [];
    const total = list.length;

    if (total === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">👨‍🏫</div>
            Tidak ada data guru yang cocok dengan pencarian / filter.
          </td>
        </tr>
      `;
      ADMIN.renderPagination("teacher-cards-pagination", 0, 1, 10, () => {}, () => {});
      return;
    }

    const page = this.state.teacherCurrentPage || 1;
    const size = this.state.teacherPageSize || 10;
    const startIndex = (page - 1) * size;
    const paged = list.slice(startIndex, startIndex + size);
    const isSelection = this.state.isTeacherSelectionMode;

    tbody.innerHTML = paged.map((g, idx) => {
      const isChecked = this.state.selectedTeacherIds.has(g.id_guru);
      const rowNum = startIndex + idx + 1;
      const initial = (g.nama_guru || "G").charAt(0).toUpperCase();

      let badgePegawai = `<span class="badge badge-success">PNS</span>`;
      if (g.status_kepegawaian === "PPPK") badgePegawai = `<span class="badge" style="background:#3b82f6;color:#fff;">PPPK</span>`;
      else if (g.status_kepegawaian === "GTT") badgePegawai = `<span class="badge" style="background:#f59e0b;color:#fff;">GTT</span>`;
      else if (g.status_kepegawaian === "Honorer") badgePegawai = `<span class="badge" style="background:#64748b;color:#fff;">Honor</span>`;

      return `
        <tr style="${isChecked ? 'background: rgba(5, 150, 105, 0.08);' : ''}">
          <td class="col-checkbox-teacher-cards" style="text-align: center; ${isSelection ? '' : 'display: none;'}">
            <input type="checkbox" class="table-checkbox" value="${g.id_guru}" ${isChecked ? 'checked' : ''} onchange="CARD_GENERATOR.toggleTeacherItemSelection('${g.id_guru}', this.checked)">
          </td>
          <td style="text-align: center; font-weight: 600;">${rowNum}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #059669, #10b981); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0;">
                ${initial}
              </div>
              <div>
                <strong style="color: var(--text-main); font-size: 0.9rem; display: block;">${g.nama_guru}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">NIP: ${g.nip || '-'}</span>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight: 600; color: #34d399;">${g.jabatan || 'Guru'}</span>
          </td>
          <td>
            <span style="font-size: 0.85rem; color: var(--text-main);">${g.tugas_tambahan || '-'}</span>
          </td>
          <td style="text-align: center;">${badgePegawai}</td>
          <td>
            <code style="font-size: 0.78rem; background: rgba(0,0,0,0.2); padding: 0.2rem 0.4rem; border-radius: 4px; color: #38bdf8;">
              ${g.kode_barcode || 'GURU-' + (g.nip !== '-' ? g.nip : g.id_guru)}
            </code>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; gap: 0.4rem;">
              <button type="button" class="btn-action-pill btn-action-pill-cyan" onclick="CARD_GENERATOR.previewTeacherCard('${g.id_guru}')" title="Lihat Pratinjau Kartu Guru">
                👁️ Preview
              </button>
              <button type="button" class="btn-action-pill btn-action-pill-emerald" onclick="CARD_GENERATOR.downloadSingleTeacherCardById('${g.id_guru}')" title="Unduh Kartu PNG HD">
                ⬇️ Unduh
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Update Header Checkbox & Header Column Visibility
    const thCheckbox = document.getElementById("th-checkbox-teacher-cards");
    if (thCheckbox) thCheckbox.style.display = isSelection ? "table-cell" : "none";

    const headerCheck = document.getElementById("check-all-card-teachers");
    const visibleIds = paged.map(g => g.id_guru);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => this.state.selectedTeacherIds.has(id));

    if (headerCheck) {
      headerCheck.checked = allVisibleChecked;
      headerCheck.onchange = (e) => this.toggleSelectAllVisibleTeachers(visibleIds, e.target.checked);
    }

    const selectAllText = document.getElementById("btn-teacher-cards-select-all-text");
    if (selectAllText) {
      selectAllText.textContent = allVisibleChecked ? "Batalkan Semua" : "Pilih Semua";
    }

    const btnToggle = document.getElementById("btn-toggle-select-teacher-cards");
    if (btnToggle) {
      btnToggle.innerHTML = isSelection ? "✕ Selesai Memilih" : "🔘 Pilih Guru";
      btnToggle.style.background = isSelection ? "rgba(2, 132, 199, 0.15)" : "";
      btnToggle.style.borderColor = isSelection ? "rgba(2, 132, 199, 0.4)" : "";
      btnToggle.style.color = isSelection ? "#38bdf8" : "";
    }

    this.updateTeacherBulkBar();

    // Render Pagination Controls
    ADMIN.renderPagination(
      "teacher-cards-pagination",
      total,
      page,
      size,
      (newPage) => {
        this.state.teacherCurrentPage = newPage;
        this.renderTeacherCardsTable();
      },
      (newSize) => {
        this.state.teacherPageSize = newSize;
        this.state.teacherCurrentPage = 1;
        this.renderTeacherCardsTable();
      }
    );
  },

  toggleTeacherSelectionMode() {
    this.state.isTeacherSelectionMode = !this.state.isTeacherSelectionMode;
    if (!this.state.isTeacherSelectionMode) {
      this.state.selectedTeacherIds.clear();
    }
    this.renderTeacherCardsTable();
  },

  exitTeacherSelectionMode() {
    this.state.isTeacherSelectionMode = false;
    this.state.selectedTeacherIds.clear();
    this.renderTeacherCardsTable();
  },

  toggleSelectAllVisibleTeachers(visibleIds = null, isChecked = null) {
    const list = this.state.filteredTeachers || [];
    const page = this.state.teacherCurrentPage || 1;
    const size = this.state.teacherPageSize || 10;
    const targetIds = visibleIds || list.slice((page - 1) * size, page * size).map(g => g.id_guru);

    const shouldCheck = isChecked !== null ? isChecked : !targetIds.every(id => this.state.selectedTeacherIds.has(id));

    targetIds.forEach(id => {
      if (shouldCheck) {
        this.state.selectedTeacherIds.add(id);
      } else {
        this.state.selectedTeacherIds.delete(id);
      }
    });

    this.renderTeacherCardsTable();
  },

  toggleTeacherItemSelection(idGuru, isChecked) {
    if (isChecked) {
      this.state.selectedTeacherIds.add(idGuru);
    } else {
      this.state.selectedTeacherIds.delete(idGuru);
    }
    this.renderTeacherCardsTable();
  },

  updateTeacherBulkBar() {
    const bulkBar = document.getElementById("teacher-cards-bulk-bar");
    const countBadge = document.getElementById("teacher-cards-bulk-count");
    const selectAllText = document.getElementById("btn-teacher-cards-select-all-text");
    const selectedCount = this.state.selectedTeacherIds.size;
    const totalFiltered = (this.state.filteredTeachers || []).length;

    if (!bulkBar) return;

    if (this.state.isTeacherSelectionMode) {
      bulkBar.classList.add("active");
      if (countBadge) countBadge.textContent = selectedCount;
      if (selectAllText) {
        selectAllText.textContent = (selectedCount > 0 && selectedCount === totalFiltered) ? "Batalkan Semua" : "Pilih Semua";
      }
    } else {
      bulkBar.classList.remove("active");
    }
  },

  // ==========================================================================
  // 10. TEMPLATE KARTU GURU & PREVIEW / PRINT / EXPORT ENGINE
  // ==========================================================================
  createTeacherCardHTML(g) {
    const jabatan = g.jabatan || "Guru";
    const nipVal = (g.nip && g.nip !== "-") ? g.nip : (g.status_kepegawaian || "PTK");

    return `
      <div class="student-card-portrait" id="teacher-card-item-${g.id_guru}" data-teacher-id="${g.id_guru}" data-nama="${g.nama_guru}" data-jabatan="${jabatan}">
        
        <!-- Ornamen Sudut Emas Mewah (Top-Left & Bottom-Right) -->
        <svg class="card-gold-corner tl" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldCornerGradTL_g_${g.id_guru}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fef08a" />
              <stop offset="35%" stop-color="#eab308" />
              <stop offset="70%" stop-color="#ca8a04" />
              <stop offset="100%" stop-color="#854d0e" />
            </linearGradient>
          </defs>
          <path d="M-15 45 L45 -15 L52 -15 L-15 52 Z" fill="url(#goldCornerGradTL_g_${g.id_guru})" opacity="0.95" />
          <path d="M-15 65 L65 -15 L68 -15 L-15 68 Z" fill="url(#goldCornerGradTL_g_${g.id_guru})" opacity="0.75" />
        </svg>

        <svg class="card-gold-corner br" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldCornerGradBR_g_${g.id_guru}" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#fef08a" />
              <stop offset="35%" stop-color="#eab308" />
              <stop offset="70%" stop-color="#ca8a04" />
              <stop offset="100%" stop-color="#854d0e" />
            </linearGradient>
          </defs>
          <path d="M95 35 L35 95 L28 95 L95 28 Z" fill="url(#goldCornerGradBR_g_${g.id_guru})" opacity="0.95" />
          <path d="M95 15 L15 95 L12 95 L95 12 Z" fill="url(#goldCornerGradBR_g_${g.id_guru})" opacity="0.75" />
        </svg>

        <!-- 1. Header: Logo & Judul Madrasah -->
        <div class="card-header-section">
          <div class="card-logo-container">
            <img src="/logo-min5.png" class="card-min5-logo" alt="Logo MIN 5 Tulungagung">
          </div>

          <div class="card-header-texts">
            <div class="card-badge-subtitle">KARTU IDENTITAS GURU</div>
            <div class="card-badge-line"></div>
            <div class="card-badge-title">MIN 5 TULUNGAGUNG</div>
          </div>
        </div>

        <!-- 2. Kotak QR Code Pemindai Presensi (Besar & Kontras Tinggi) -->
        <div class="card-qr-box">
          <div id="qrcode-teacher-${g.id_guru}" class="card-qr-render"></div>
        </div>

        <!-- 3. Identitas Guru & Footer -->
        <div class="card-student-section">
          <div class="card-student-fullname" title="${g.nama_guru}">${g.nama_guru}</div>
          <div class="card-student-gold-line"></div>

          <div class="card-student-meta-grid">
            <div class="card-student-meta-item">
              <svg class="card-meta-svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M10 11h4M10 16h4"></path>
              </svg>
              <div class="card-meta-detail">
                <span class="card-meta-heading">JABATAN</span>
                <span class="card-meta-value" style="font-size: 8.5pt; max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${jabatan}</span>
              </div>
            </div>

            <div class="card-meta-separator"></div>

            <div class="card-student-meta-item">
              <svg class="card-meta-svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <div class="card-meta-detail">
                <span class="card-meta-heading">NIP / STATUS</span>
                <span class="card-meta-value" style="font-size: 8.5pt; font-family: monospace;">${nipVal}</span>
              </div>
            </div>
          </div>

          <div class="card-footer-prompt">
            <span class="card-footer-line"></span>
            <span class="card-footer-text">SCAN UNTUK ABSENSI</span>
            <span class="card-footer-line"></span>
          </div>
        </div>

      </div>
    `;
  },

  async previewTeacherCard(idGuru) {
    const teacher = (this.state.teacherList || []).find(g => g.id_guru === idGuru) ||
                    (window.ADMIN && (window.ADMIN.teachersState.allList || []).find(g => g.id_guru === idGuru));
    if (!teacher) {
      if (typeof showToast === 'function') showToast("Data guru tidak ditemukan untuk kartu.", "warning");
      return;
    }

    this.state.previewTeacher = teacher;

    const modal = document.getElementById("modal-card-preview");
    const nameEl = document.getElementById("preview-modal-student-name");
    const metaEl = document.getElementById("preview-modal-student-meta");
    const container = document.getElementById("preview-card-container");
    const btnDownload = document.getElementById("btn-modal-download-card");
    const btnPrint = document.getElementById("btn-modal-print-card");

    if (nameEl) nameEl.textContent = teacher.nama_guru;
    if (metaEl) metaEl.textContent = `${teacher.jabatan || 'Guru'} • ${teacher.nip && teacher.nip !== '-' ? 'NIP: ' + teacher.nip : teacher.status_kepegawaian || 'PTK'}`;

    if (container) {
      container.innerHTML = this.createTeacherCardHTML(teacher);
      const qrElem = container.querySelector(`#qrcode-teacher-${teacher.id_guru}`);
      const qrText = teacher.kode_barcode || `GURU-${teacher.nip && teacher.nip !== '-' ? teacher.nip : teacher.id_guru}`;
      await this.renderCardQRToImage(qrElem, qrText);
    }

    if (btnDownload) {
      btnDownload.onclick = () => this.downloadSingleTeacherCardById(teacher.id_guru);
    }

    if (btnPrint) {
      btnPrint.onclick = () => this.printSingleTeacherCard(teacher);
    }

    if (typeof openModal === 'function') {
      openModal("modal-card-preview");
    } else if (modal) {
      modal.classList.add("active");
    }
  },

  async downloadSingleTeacherCardById(idGuru) {
    const teacher = (this.state.teacherList || []).find(g => g.id_guru === idGuru) ||
                    this.state.previewTeacher ||
                    (window.ADMIN && (window.ADMIN.teachersState.allList || []).find(g => g.id_guru === idGuru));
    if (!teacher) {
      if (typeof showToast === 'function') showToast("Data guru tidak ditemukan untuk diunduh.", "warning");
      return;
    }

    const captureWrapper = document.createElement("div");
    captureWrapper.style.position = "fixed";
    captureWrapper.style.left = "0";
    captureWrapper.style.top = "0";
    captureWrapper.style.width = "290px";
    captureWrapper.style.height = "460px";
    captureWrapper.style.opacity = "0.01";
    captureWrapper.style.pointerEvents = "none";
    captureWrapper.style.zIndex = "-999";
    captureWrapper.style.background = "#ffffff";
    captureWrapper.innerHTML = this.createTeacherCardHTML(teacher);
    document.body.appendChild(captureWrapper);

    const cardEl = captureWrapper.querySelector(".student-card-portrait");
    const qrElem = captureWrapper.querySelector(`#qrcode-teacher-${teacher.id_guru}`);

    const qrText = teacher.kode_barcode || `GURU-${teacher.nip && teacher.nip !== '-' ? teacher.nip : teacher.id_guru}`;
    await this.renderCardQRToImage(qrElem, qrText);

    const images = Array.from(captureWrapper.querySelectorAll("img"));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }));

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(r => setTimeout(r, 100));

    try {
      const targetElement = cardEl || captureWrapper;
      const canvas = await html2canvas(targetElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false
      });

      const cleanNama = String(teacher.nama_guru || "Guru").replace(/[\\/:*?"<>|]/g, "_").trim();
      const nip = String(teacher.nip && teacher.nip !== '-' ? teacher.nip : teacher.id_guru || "PTK");
      const fileName = `Kartu_Guru_${nip}_${cleanNama}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (typeof showToast === 'function') {
        showToast(`✓ Kartu ${teacher.nama_guru} berhasil diunduh.`, "success");
      }
    } catch (err) {
      console.error("Gagal download PNG kartu guru:", err);
      alert("Gagal mengunduh kartu guru: " + err.message);
    } finally {
      if (captureWrapper && captureWrapper.parentNode) {
        document.body.removeChild(captureWrapper);
      }
    }
  },

  printSingleTeacherCard(teacher) {
    const printContainer = document.getElementById("printable-cards-area");
    if (!printContainer) return;

    printContainer.style.display = "grid";
    printContainer.innerHTML = this.createTeacherCardHTML(teacher);

    const qrElem = printContainer.querySelector(`#qrcode-teacher-${teacher.id_guru}`);
    if (qrElem && typeof QRCode !== 'undefined') {
      new QRCode(qrElem, {
        text: teacher.kode_barcode || `GURU-${teacher.nip && teacher.nip !== '-' ? teacher.nip : teacher.id_guru}`,
        width: 156,
        height: 156,
        colorDark: "#ffffff",
        colorLight: "#022b1d",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    setTimeout(() => {
      window.print();
      printContainer.style.display = "none";
    }, 200);
  },

  printAllTeachers() {
    this.printBatchTeacherCards(this.state.teacherList);
  },

  printSelectedTeachers() {
    const selected = (this.state.teacherList || []).filter(g => this.state.selectedTeacherIds.has(g.id_guru));
    if (selected.length === 0) {
      alert("Pilih minimal 1 guru untuk dicetak.");
      return;
    }
    this.printBatchTeacherCards(selected);
  },

  printBatchTeacherCards(teachersList) {
    if (!teachersList || teachersList.length === 0) {
      alert("Tidak ada kartu guru untuk dicetak.");
      return;
    }

    const printContainer = document.getElementById("printable-cards-area");
    if (!printContainer) return;

    printContainer.style.display = "grid";
    printContainer.innerHTML = teachersList.map(g => this.createTeacherCardHTML(g)).join("");

    teachersList.forEach(g => {
      const qrElem = printContainer.querySelector(`#qrcode-teacher-${g.id_guru}`);
      if (qrElem && typeof QRCode !== 'undefined') {
        new QRCode(qrElem, {
          text: g.kode_barcode || `GURU-${g.nip && g.nip !== '-' ? g.nip : g.id_guru}`,
          width: 156,
          height: 156,
          colorDark: "#ffffff",
          colorLight: "#022b1d",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    });

    setTimeout(() => {
      window.print();
      printContainer.style.display = "none";
    }, 400);
  },

  async exportTeacherZip() {
    return this.processTeacherZipExport(this.state.teacherList, "Semua_Guru");
  },

  async exportSelectedTeacherZip() {
    const selected = (this.state.teacherList || []).filter(g => this.state.selectedTeacherIds.has(g.id_guru));
    if (selected.length === 0) {
      alert("Pilih minimal 1 guru untuk diekspor ke ZIP.");
      return;
    }
    return this.processTeacherZipExport(selected, "Pilihan_Guru");
  },

  async processTeacherZipExport(teachersList, labelName) {
    if (!teachersList || teachersList.length === 0) {
      alert("Tidak ada data guru untuk diekspor ke ZIP.");
      return;
    }

    if (typeof JSZip === 'undefined' || typeof html2canvas === 'undefined') {
      alert("Pustaka JSZip atau html2canvas belum termuat.");
      return;
    }

    const progressBar = document.getElementById("zip-progress-bar");
    const progressStatus = document.getElementById("zip-progress-status");
    const progressPercent = document.getElementById("zip-progress-percent");

    if (typeof openModal === 'function') {
      openModal("modal-zip-progress");
    }

    if (progressBar) progressBar.style.width = "0%";
    if (progressStatus) progressStatus.textContent = "Menyiapkan kartu guru...";
    if (progressPercent) progressPercent.textContent = "0%";

    const zip = new JSZip();
    const total = teachersList.length;

    const tempContainer = document.createElement("div");
    tempContainer.style.position = "fixed";
    tempContainer.style.left = "0";
    tempContainer.style.top = "0";
    tempContainer.style.width = "290px";
    tempContainer.style.height = "460px";
    tempContainer.style.opacity = "0.01";
    tempContainer.style.pointerEvents = "none";
    tempContainer.style.zIndex = "-999";
    tempContainer.style.background = "#ffffff";
    document.body.appendChild(tempContainer);

    try {
      for (let i = 0; i < total; i++) {
        const g = teachersList[i];
        const percent = Math.round(((i + 1) / total) * 100);

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressStatus) progressStatus.textContent = `Merender ${i + 1}/${total}: ${g.nama_guru}`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;

        tempContainer.innerHTML = this.createTeacherCardHTML(g);
        const cardEl = tempContainer.querySelector(".student-card-portrait");
        const qrElem = tempContainer.querySelector(`#qrcode-teacher-${g.id_guru}`);

        const qrText = g.kode_barcode || `GURU-${g.nip && g.nip !== '-' ? g.nip : g.id_guru}`;
        await this.renderCardQRToImage(qrElem, qrText);

        const images = Array.from(tempContainer.querySelectorAll("img"));
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => {
            img.onload = () => res();
            img.onerror = () => res();
          });
        }));

        await new Promise(r => setTimeout(r, 60));

        const canvas = await html2canvas(cardEl || tempContainer, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false
        });

        const base64Data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
        const cleanNama = g.nama_guru.replace(/[\\/:*?"<>|]/g, "_").trim();
        const nip = String(g.nip && g.nip !== '-' ? g.nip : g.id_guru || "PTK");
        const fileName = `${nip}_${cleanNama}.png`;

        zip.file(fileName, base64Data, { base64: true });
      }

      if (progressStatus) progressStatus.textContent = "Mengompresi file ZIP...";
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const dateStr = new Date().toISOString().split("T")[0];
      const zipFileName = `Kartu_Presensi_Guru_MIN5_${labelName}_${dateStr}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setTimeout(() => {
        if (typeof closeModal === 'function') closeModal("modal-zip-progress");
        if (typeof showToast === 'function') {
          showToast(`Berhasil mengunduh ${total} kartu guru ke ${zipFileName}`, "success");
        }
      }, 400);

    } catch (err) {
      console.error("ZIP Export Error:", err);
      if (typeof closeModal === 'function') closeModal("modal-zip-progress");
      alert("Gagal membuat file ZIP kartu guru: " + err.message);
    } finally {
      if (tempContainer) document.body.removeChild(tempContainer);
    }
  }
};

window.CARD_GENERATOR = CARD_GENERATOR;
