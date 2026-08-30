/**
 * ============================================================================
 * SIPRESMATA - VERTICAL ID CARD & QR CODE GENERATOR MODULE
 * Desain Kartu Presensi Vertikal Premium MIN 5 Tulungagung
 * ============================================================================
 */

import { API } from './api.js';

export const CARD_GENERATOR = {
  async renderCards(containerElement, idKelas = "") {
    if (!containerElement) return;

    containerElement.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏳</div>
        Membuat desain kartu presensi siswa...
      </div>
    `;

    const res = await API.getSiswa(idKelas);
    const students = res.data || [];

    if (students.length === 0) {
      containerElement.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👥</div>
          Belum ada data siswa untuk kelas yang dipilih. Silakan tambah data siswa atau import Excel terlebih dahulu.
        </div>
      `;
      return;
    }

    containerElement.innerHTML = students.map(s => this.createCardHTML(s)).join("");

    // Render QR Code untuk masing-masing kartu
    students.forEach(s => {
      const qrElem = document.getElementById(`qrcode-${s.id_siswa}`);
      if (qrElem && typeof QRCode !== 'undefined') {
        qrElem.innerHTML = ""; // Bersihkan kontainer
        try {
          new QRCode(qrElem, {
            text: s.kode_barcode || `MIN5-${s.nisn}`,
            width: 82,
            height: 82,
            colorDark: "#022c22",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch (e) {
          console.error("QR render error:", e);
        }
      }
    });
  },

  createCardHTML(s) {
    const rawKelas = s.nama_kelas || s.id_kelas || "1-A";
    const shortKelas = rawKelas.replace(/Kelas\s*/i, "").replace("KLS-", "").trim();
    const encodedNama = encodeURIComponent(s.nama_lengkap);

    return `
      <div class="student-card-portrait" id="card-item-${s.id_siswa}" data-student-id="${s.id_siswa}" data-nisn="${s.nisn}" data-nama="${s.nama_lengkap}" data-kelas="${shortKelas}">
        
        <!-- Tombol Aksi Cepat: Unduh Kartu Tunggal (No-Print) -->
        <div class="card-actions-quick no-print">
          <button type="button" class="btn-card-quick-download" onclick="window.downloadSingleCard('${s.id_siswa}', '${s.nisn}', '${encodedNama}')" title="Download Gambar Kartu Ini (PNG)">
            📥 Unduh PNG
          </button>
        </div>

        <!-- 1. Header Banner Atas -->
        <div class="card-top-banner">
          <div class="banner-dots-pattern"></div>
          
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
          <div class="banner-dots-pattern-left"></div>
          <div class="banner-dots-pattern-mid-right"></div>

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

  // 1. Ekspor seluruh kartu per anak ke file .ZIP
  async exportCardsToZip(idKelas = "", onProgress = null) {
    if (typeof JSZip === 'undefined' || typeof html2canvas === 'undefined') {
      throw new Error("Pustaka JSZip atau html2canvas belum termuat dengan benar.");
    }

    const cardElements = document.querySelectorAll("#printable-cards-area .student-card-portrait");
    if (!cardElements || cardElements.length === 0) {
      throw new Error("Tidak ada kartu siswa yang dapat diekspor.");
    }

    const zip = new JSZip();
    const total = cardElements.length;

    for (let i = 0; i < total; i++) {
      const cardEl = cardElements[i];
      const nisn = cardEl.getAttribute("data-nisn") || `siswa_${i + 1}`;
      const nama = cardEl.getAttribute("data-nama") || `Siswa ${i + 1}`;
      const kelas = cardEl.getAttribute("data-kelas") || "Umum";

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: total,
          studentName: nama,
          percent: Math.round(((i + 1) / total) * 100)
        });
      }

      // Render kartu dengan resolusi tinggi (skala 3x untuk hasil cetak tajam 300 DPI)
      const canvas = await html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        ignoreElements: (element) => element.classList.contains("no-print")
      });

      const base64Data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      
      const cleanNama = nama.replace(/[\\/:*?"<>|]/g, "_").trim();
      const cleanKelas = `Kelas ${kelas}`.replace(/[\\/:*?"<>|]/g, "_").trim();
      const fileName = `${nisn}_${cleanNama}.png`;

      // Masukkan ke subfolder kelas masing-masing
      zip.folder(cleanKelas).file(fileName, base64Data, { base64: true });
    }

    // Generate file ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    // Trigger download
    const dateStr = new Date().toISOString().split("T")[0];
    const zipFileName = `Kartu_Presensi_MIN5_${idKelas || 'Semua_Rombel'}_${dateStr}.zip`;

    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    return { total, fileName: zipFileName };
  },

  // 2. Unduh 1 Kartu Tunggal (PNG)
  async downloadSingleCard(idSiswa, nisn, encodedNama) {
    const nama = decodeURIComponent(encodedNama);
    const cardEl = document.getElementById(`card-item-${idSiswa}`);
    if (!cardEl || typeof html2canvas === 'undefined') {
      alert("Kartu tidak ditemukan atau pustaka canvas belum siap.");
      return;
    }

    try {
      const canvas = await html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        ignoreElements: (element) => element.classList.contains("no-print")
      });

      const cleanNama = nama.replace(/[\\/:*?"<>|]/g, "_").trim();
      const fileName = `Kartu_${nisn}_${cleanNama}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Gagal mengunduh kartu satuan:", err);
      alert("Gagal mengunduh kartu: " + err.message);
    }
  },

  printCards() {
    window.print();
  }
};
