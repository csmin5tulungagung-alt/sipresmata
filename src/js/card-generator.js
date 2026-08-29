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

    return `
      <div class="student-card-portrait">
        
        <!-- 1. Header Banner Atas -->
        <div class="card-top-banner">
          <div class="banner-dots-pattern"></div>
          
          <!-- Logo Kemenag Ikhlas Beramal -->
          <div class="kemenag-logo-wrapper">
            <div class="kemenag-badge" title="Kementerian Agama RI">
              <svg class="kemenag-svg-icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,4 92,26 92,74 50,96 8,74 8,26" fill="#047857" stroke="#fbbf24" stroke-width="4"/>
                <circle cx="50" cy="50" r="30" fill="#064e3b" stroke="#fef08a" stroke-width="2"/>
                <path d="M50 24 L53 33 L62 33 L55 38 L58 47 L50 42 L42 47 L45 38 L38 33 L47 33 Z" fill="#fbbf24"/>
                <path d="M35 56 Q50 48 65 56 Q50 64 35 56 Z" fill="#ffffff"/>
                <path d="M38 60 Q50 54 62 60 Q50 68 38 60 Z" fill="#fbbf24"/>
                <circle cx="50" cy="74" r="4" fill="#fbbf24"/>
              </svg>
            </div>
          </div>

          <div class="card-subtitle-small">— KARTU ABSEN SISWA —</div>
          <div class="card-title-main">MIN 5 TULUNGAGUNG</div>
          <div class="card-motto">MADRASAH HEBAT BERMARTABAT</div>
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

  printCards() {
    window.print();
  }
};
