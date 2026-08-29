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
  // 1. Dashboard Metrics & Live Monitoring
  async loadDashboard() {
    const statsContainer = document.getElementById("dashboard-stats-grid");
    const feedContainer = document.getElementById("live-scans-feed");
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

      if (feedContainer) {
        if (data.recent_scans && data.recent_scans.length > 0) {
          feedContainer.innerHTML = data.recent_scans.map(s => `
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
        } else {
          feedContainer.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada data scan presensi hari ini.</td></tr>`;
        }
      }
    } catch (e) {
      console.error("Dashboard error:", e);
    }
  },

  // 2. Data Siswa CRUD
  async loadStudents(idKelas = "", searchTerm = "") {
    const tableBody = document.getElementById("students-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Memuat data siswa...</td></tr>`;

    const res = await API.getSiswa(idKelas);
    let list = res.data || [];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(s => s.nama_lengkap.toLowerCase().includes(term) || s.nisn.includes(term));
    }

    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Tidak ada data siswa yang cocok.</td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><code>${s.nisn}</code></td>
        <td><strong>${s.nama_lengkap}</strong></td>
        <td><span class="badge badge-info">${s.nama_kelas || s.id_kelas}</span></td>
        <td>${s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
        <td style="display: flex; gap: 0.4rem;">
          <button class="btn btn-secondary btn-icon" onclick="window.editStudent('${s.id_siswa}')" title="Edit Siswa">
            ✏️
          </button>
          <button class="btn btn-secondary btn-icon" onclick="window.deleteStudent('${s.id_siswa}', '${s.nama_lengkap}')" title="Hapus Siswa" style="color: #f87171;">
            🗑️
          </button>
        </td>
      </tr>
    `).join("");
  },

  // 3. Rekapitulasi Presensi
  async loadRekap(tglMulai, tglAkhir, idKelas = "") {
    const tableBody = document.getElementById("rekap-table-body");
    const summaryBox = document.getElementById("rekap-summary-badge");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Mengambil data rekap...</td></tr>`;

    const res = await API.getRekapAbsensi(tglMulai, tglAkhir, idKelas);
    const data = res.data;
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

    if (items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Tidak ada riwayat presensi pada rentang tanggal tersebut.</td></tr>`;
      return;
    }

    tableBody.innerHTML = items.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
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

    // Setup Export Action Buttons
    window.currentRekapData = { periode: data.periode, idKelas, summary: sum, items };
  },

  // 4. Populate Rombel Dropdowns
  populateClassSelects() {
    const selects = document.querySelectorAll(".select-kelas-rombel");
    selects.forEach(select => {
      const hasAllOption = select.getAttribute("data-include-all") === "true";
      let optionsHTML = hasAllOption ? `<option value="">Semua Rombel (1A-D s.d 6A-D)</option>` : `<option value="">Pilih Kelas</option>`;
      optionsHTML += CONFIG.ROMBEL_LIST.map(r => `<option value="${r.id}">${r.nama}</option>`).join("");
      select.innerHTML = optionsHTML;
    });

    // Populate Student dropdown for manual attendance
    this.populateStudentSelect();
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
