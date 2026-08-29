/**
 * ============================================================================
 * SIPRESMATA - ID CARD & BARCODE GENERATOR MODULE
 * Renders ID Cards with Code128 / QR Code for A4 Batch Printing
 * ============================================================================
 */

import { API } from './api.js';

export const CARD_GENERATOR = {
  async renderCards(containerElement, idKelas = "") {
    const res = await API.getSiswa(idKelas);
    const students = res.data || [];

    if (students.length === 0) {
      containerElement.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="bi bi-people" style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;"></i>
          Belum ada data siswa untuk kelas yang dipilih.
        </div>
      `;
      return;
    }

    containerElement.innerHTML = students.map(s => this.createCardHTML(s)).join("");

    // Render Barcode SVG menggunakan JsBarcode
    students.forEach(s => {
      const svgElem = document.getElementById(`barcode-${s.id_siswa}`);
      if (svgElem && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(svgElem, s.kode_barcode || s.nisn, {
            format: "CODE128",
            width: 1.4,
            height: 28,
            displayValue: false,
            margin: 0
          });
        } catch (e) {
          console.error("Barcode render error:", e);
        }
      }
    });
  },

  createCardHTML(s) {
    const initial = s.nama_lengkap.charAt(0).toUpperCase();
    const genderIcon = s.jenis_kelamin === 'P' ? '👧' : '👦';

    return `
      <div class="student-id-card">
        <!-- Card Header Kop -->
        <div class="id-card-header">
          <div class="id-card-logo">MIN 5</div>
          <div class="id-card-title-group">
            <h4>KARTU PRESENSI SISWA</h4>
            <p>MIN 5 TULUNGAGUNG • TAHUN AJARAN 2026/2027</p>
          </div>
        </div>

        <!-- Card Body -->
        <div class="id-card-body">
          <div class="id-card-photo">${genderIcon}</div>
          <div class="id-card-info-table">
            <div class="info-row">
              <span class="label">Nama</span>
              <span class="val">: ${s.nama_lengkap}</span>
            </div>
            <div class="info-row">
              <span class="label">NISN</span>
              <span class="val">: ${s.nisn}</span>
            </div>
            <div class="info-row">
              <span class="label">Kelas</span>
              <span class="val">: ${s.nama_kelas || s.id_kelas}</span>
            </div>
            <div class="info-row">
              <span class="label">Status</span>
              <span class="val" style="color: #059669;">: Siswa Aktif</span>
            </div>
          </div>
        </div>

        <!-- Card Footer Barcode -->
        <div class="id-card-footer">
          <svg id="barcode-${s.id_siswa}" class="barcode-svg-render"></svg>
          <div class="barcode-text-code">${s.kode_barcode || s.nisn}</div>
        </div>
      </div>
    `;
  },

  printCards() {
    window.print();
  }
};
