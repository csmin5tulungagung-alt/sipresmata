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

  // 5. Intelligent EMIS Excel / CSV Parser
  parseEmisWorkbook(workbook) {
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rawRows || rawRows.length < 2) {
      throw new Error("File Excel kosong atau tidak memiliki baris data.");
    }

    // Cari baris header (biasanya baris ke-0 atau baris yang mengandung 'Nama' / 'NISN')
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(5, rawRows.length); r++) {
      const rowStr = rawRows[r].join(" ").toLowerCase();
      if (rowStr.includes("nama") || rowStr.includes("nisn")) {
        headerRowIdx = r;
        break;
      }
    }

    const headers = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
    
    // Temukan index kolom
    let idxNama = headers.findIndex(h => h.includes("nama lengkap") || h.includes("nama"));
    let idxNisn = headers.findIndex(h => h.includes("nisn"));
    let idxRombel = headers.findIndex(h => h.includes("tingkat") || h.includes("rombel") || h.includes("kelas"));
    let idxJk = headers.findIndex(h => h.includes("jenis kelamin") || h.includes("jk"));
    let idxTelp = headers.findIndex(h => h.includes("telepon") || h.includes("telp") || h.includes("hp") || h.includes("wa"));

    // Fallback index jika header tidak bernama standar (sesuai template screenshot kolom A=0 s.d R=17)
    if (idxNama === -1) idxNama = 1;  // Kolom B
    if (idxNisn === -1) idxNisn = 2;  // Kolom C
    if (idxRombel === -1) idxRombel = 6; // Kolom G
    if (idxJk === -1) idxJk = 9;      // Kolom J
    if (idxTelp === -1) idxTelp = 11;  // Kolom L

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

      // Normalisasi Rombel (Contoh: 'Kelas 5 - Kelas 5 A' -> 'KLS-5A', '5A' -> 'KLS-5A')
      const matchedRombel = this.normalizeRombel(rawRombel);

      // Normalisasi Jenis Kelamin
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
    
    // Ekstrak angka tingkat (1-6) dan huruf (A-D)
    const clean = raw.toUpperCase().replace(/\s+/g, "");
    
    for (const r of CONFIG.ROMBEL_LIST) {
      const code = r.id.replace("KLS-", ""); // '1A', '5A', dll
      if (clean.includes(code) || clean.includes(`KELAS${code}`) || clean.includes(`KELAS${code[0]}-KELAS${code[0]}${code[1]}`)) {
        return r;
      }
    }

    // Regex fallback
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
