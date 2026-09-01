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
    previewStudent: null
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
    tempDiv.style.width = "82px";
    tempDiv.style.height = "82px";
    
    try {
      new QRCode(tempDiv, {
        text: qrText,
        width: 82,
        height: 82,
        colorDark: "#022c22",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });

      // Tunggu generate canvas
      await new Promise(r => setTimeout(r, 60));

      const canvas = tempDiv.querySelector("canvas");
      if (canvas && canvas.width > 0) {
        const dataUrl = canvas.toDataURL("image/png");
        qrElem.innerHTML = `<img src="${dataUrl}" width="82" height="82" style="width:82px;height:82px;display:block;margin:auto;" alt="QR" />`;
      } else {
        const img = tempDiv.querySelector("img");
        if (img && img.src) {
          qrElem.innerHTML = `<img src="${img.src}" width="82" height="82" style="width:82px;height:82px;display:block;margin:auto;" alt="QR" />`;
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
        
        <!-- 1. Header Banner Atas -->
        <div class="card-top-banner">
          <svg class="banner-dots-pattern" width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="4" cy="4" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <circle cx="14" cy="4" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <circle cx="24" cy="4" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <circle cx="4" cy="14" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <circle cx="14" cy="14" r="1.5" fill="rgba(255,255,255,0.45)"/>
            <circle cx="24" cy="14" r="1.5" fill="rgba(255,255,255,0.45)"/>
          </svg>
          
          <!-- Logo Resmi MIN 5 Tulungagung -->
          <div class="kemenag-logo-wrapper">
            <div class="kemenag-badge" title="MIN 5 Tulungagung">
              <img src="/logo-min5.png" class="kemenag-badge-img" alt="Logo MIN 5 Tulungagung">
            </div>
          </div>

          <div class="card-subtitle-small">— KARTU ABSEN SISWA —</div>
          <div class="card-title-main">MIN 5 TULUNGAGUNG</div>
          <div class="card-motto">MADRASAH RAMAH ANAK • MADRASAH ADIWIYATA • TIADA HARI TANPA PRESTASI</div>
        </div>

        <!-- 2. Body Kartu (Foto & Data Siswa) -->
        <div class="card-body-content">
          <svg class="banner-dots-pattern-left" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="4" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="4" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="4" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
          </svg>
          <svg class="banner-dots-pattern-mid-right" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="4" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="4" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="4" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="12" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="4" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="12" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
            <circle cx="20" cy="20" r="1.5" fill="rgba(5,150,105,0.3)"/>
          </svg>

          <!-- Bingkai Foto Siswa -->
          <div class="card-photo-frame">
            <div class="photo-placeholder-icon">👤</div>
            <div class="photo-placeholder-text">FOTO SISWA 3x4</div>
          </div>

          <!-- Nama Siswa -->
          <div class="card-student-name" title="${s.nama_lengkap}">${s.nama_lengkap}</div>

          <!-- Ornamen Garis & Diamond -->
          <div class="name-separator-ornament">
            <div class="ornament-line"></div>
            <div class="ornament-diamond"></div>
            <div class="ornament-line"></div>
          </div>

          <!-- Info NISN & Kelas -->
          <div class="card-info-badge-row">
            <span class="info-item">
              <span>👤</span>
              <span>${s.nisn}</span>
            </span>
            <span class="info-divider">|</span>
            <span class="info-item">
              <span>🎓</span>
              <span>${shortKelas}</span>
            </span>
          </div>

          <!-- 3. Kotak QR Code Pemindai -->
          <div class="card-qr-container">
            <div id="qrcode-${s.id_siswa}" class="card-qr-render"></div>
          </div>
        </div>

        <!-- 4. Footer Kartu (Wave Hijau Bawah dengan Icon Scan) -->
        <div class="card-bottom-banner">
          <div class="scan-prompt-group">
            <div class="scan-icon-badge">📱</div>
            <div class="scan-prompt-text">
              Scan untuk<br>absensi siswa
            </div>
          </div>

          <!-- Hiasan Daun Kanan Bawah -->
          <svg class="card-leaf-decoration" viewBox="0 0 60 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 45 C40 25, 20 15, 10 10 C25 25, 35 40, 50 45 Z" fill="#34d399" opacity="0.6"/>
            <path d="M55 48 C45 35, 30 25, 15 25 C30 35, 45 45, 55 48 Z" fill="#10b981" opacity="0.8"/>
            <path d="M58 50 C50 42, 40 38, 25 40 C40 45, 50 48, 58 50 Z" fill="#047857"/>
            <circle cx="48" cy="38" r="2" fill="#fbbf24"/>
          </svg>
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
      showToast("Data siswa tidak ditemukan untuk diunduh.", "warning");
      return;
    }

    // Buat container bersih dalam viewport agar kalkulasi rendering 100% akurat
    const captureWrapper = document.createElement("div");
    captureWrapper.style.position = "fixed";
    captureWrapper.style.left = "0";
    captureWrapper.style.top = "0";
    captureWrapper.style.width = "290px";
    captureWrapper.style.height = "440px";
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

    // Tunggu render elemen
    await new Promise(r => setTimeout(r, 120));

    try {
      const targetElement = cardEl || captureWrapper;
      const canvas = await html2canvas(targetElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
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
        width: 82,
        height: 82,
        colorDark: "#022c22",
        colorLight: "#ffffff",
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
    tempContainer.style.height = "440px";
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

        await new Promise(r => setTimeout(r, 60));

        const canvas = await html2canvas(cardEl || tempContainer, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
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
          width: 82,
          height: 82,
          colorDark: "#022c22",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    });

    setTimeout(() => {
      window.print();
      printContainer.style.display = "none";
    }, 400);
  }
};

window.CARD_GENERATOR = CARD_GENERATOR;
