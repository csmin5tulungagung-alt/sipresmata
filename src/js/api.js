/**
 * ============================================================================
 * SIPRESMATA - API CLIENT MODULE
 * Handles requests to Google Apps Script Web App with Offline/Local Fallback
 * ============================================================================
 */

import { CONFIG } from './config.js';

// Local Mock Database for Offline / Immediate Demo Mode
let localStudents = JSON.parse(localStorage.getItem("SIPRESMATA_LOCAL_STUDENTS")) || [
  { id_siswa: "SISWA-001", nisn: "0123456781", nama_lengkap: "Ahmad Fauzi Rahman", id_kelas: "KLS-1A", nama_kelas: "Kelas 1A", jenis_kelamin: "L", kode_barcode: "MIN5-0123456781", no_hp_ortu: "6281234567801", status_aktif: true },
  { id_siswa: "SISWA-002", nisn: "0123456782", nama_lengkap: "Aisyah Zahira Putri", id_kelas: "KLS-1A", nama_kelas: "Kelas 1A", jenis_kelamin: "P", kode_barcode: "MIN5-0123456782", no_hp_ortu: "6281234567802", status_aktif: true },
  { id_siswa: "SISWA-003", nisn: "0123456783", nama_lengkap: "Bilal Abdul Malik", id_kelas: "KLS-1B", nama_kelas: "Kelas 1B", jenis_kelamin: "L", kode_barcode: "MIN5-0123456783", no_hp_ortu: "6281234567803", status_aktif: true },
  { id_siswa: "SISWA-004", nisn: "0123456784", nama_lengkap: "Fatimah Azzahra", id_kelas: "KLS-1C", nama_kelas: "Kelas 1C", jenis_kelamin: "P", kode_barcode: "MIN5-0123456784", no_hp_ortu: "6281234567804", status_aktif: true },
  { id_siswa: "SISWA-005", nisn: "0123456785", nama_lengkap: "Muhammad Hanif Al-Baqir", id_kelas: "KLS-2A", nama_kelas: "Kelas 2A", jenis_kelamin: "L", kode_barcode: "MIN5-0123456785", no_hp_ortu: "6281234567805", status_aktif: true },
  { id_siswa: "SISWA-006", nisn: "0123456786", nama_lengkap: "Zhafira Nur Ramadhani", id_kelas: "KLS-3A", nama_kelas: "Kelas 3A", jenis_kelamin: "P", kode_barcode: "MIN5-0123456786", no_hp_ortu: "6281234567806", status_aktif: true },
  { id_siswa: "SISWA-007", nisn: "0123456787", nama_lengkap: "Ibrahim Al-Ghifari", id_kelas: "KLS-4B", nama_kelas: "Kelas 4B", jenis_kelamin: "L", kode_barcode: "MIN5-0123456787", no_hp_ortu: "6281234567807", status_aktif: true },
  { id_siswa: "SISWA-008", nisn: "0123456788", nama_lengkap: "Khadijah Nayla Syarif", id_kelas: "KLS-5A", nama_kelas: "Kelas 5A", jenis_kelamin: "P", kode_barcode: "MIN5-0123456788", no_hp_ortu: "6281234567808", status_aktif: true },
  { id_siswa: "SISWA-009", nisn: "0123456789", nama_lengkap: "Rayhan Yusuf Pratama", id_kelas: "KLS-6A", nama_kelas: "Kelas 6A", jenis_kelamin: "L", kode_barcode: "MIN5-0123456789", no_hp_ortu: "6281234567809", status_aktif: true }
];

let localAttendance = JSON.parse(localStorage.getItem("SIPRESMATA_LOCAL_ATTENDANCE")) || [];

function saveLocalState() {
  localStorage.setItem("SIPRESMATA_LOCAL_STUDENTS", JSON.stringify(localStudents));
  localStorage.setItem("SIPRESMATA_LOCAL_ATTENDANCE", JSON.stringify(localAttendance));
}

export const API = {
  // 1. Scan Absensi
  async scanBarcode(barcode) {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const response = await fetch(`${CONFIG.DEFAULT_API_URL}?action=absen_scan`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // text/plain prevents CORS preflight in GAS
          body: JSON.stringify({
            kode_barcode: barcode,
            client_key: CONFIG.CLIENT_KEY
          })
        });
        return await response.json();
      } catch (err) {
        console.warn("GAS Connection Error, falling back to Local Engine:", err);
      }
    }

    // Mock Local Engine Fallback
    await new Promise(r => setTimeout(r, 450));
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const clean = String(barcode || "").replace(/['"\s]/g, "").trim().toUpperCase();
    const rawNisnOnly = clean.replace(/^MIN5-?/i, "");

    const siswa = localStudents.find(s => {
      const sNisn = String(s.nisn || "").replace(/['"\s]/g, "").trim().toUpperCase();
      const sBarcode = String(s.kode_barcode || "").replace(/['"\s]/g, "").trim().toUpperCase();
      return sBarcode === clean || sNisn === clean || sNisn === rawNisnOnly || sBarcode === ("MIN5-" + rawNisnOnly);
    });

    if (!siswa) {
      return {
        status: "error",
        code: "BARCODE_NOT_FOUND",
        message: `Barcode '${barcode}' tidak terdaftar dalam database siswa aktif MIN 5.`
      };
    }

    // Cek double scan
    const existing = localAttendance.find(a => a.tanggal === todayStr && a.id_siswa === siswa.id_siswa);
    
    // Tentukan sesi (Jika jam < 12.00 = Masuk, >= 12.00 = Pulang)
    const isSesiMasuk = now.getHours() < 12;

    if (isSesiMasuk) {
      if (existing && existing.jam_masuk) {
        return {
          status: "error",
          code: "ALREADY_SCANNED",
          message: `${siswa.nama_lengkap} sudah melakukan absen masuk hari ini pukul ${existing.jam_masuk} WIB.`
        };
      }

      const isTerlambat = timeStr > CONFIG.SCHEDULE.MASUK_BATAS;
      const keterlambatanMenit = isTerlambat ? 12 : 0;
      const statusKehadiran = isTerlambat ? "TERLAMBAT" : "HADIR";

      const newRecord = {
        id_absensi: `ABS-${todayStr.replace(/-/g, "")}-${localAttendance.length + 1}`,
        tanggal: todayStr,
        id_siswa: siswa.id_siswa,
        nisn: siswa.nisn,
        nama_lengkap: siswa.nama_lengkap,
        id_kelas: siswa.id_kelas,
        nama_kelas: siswa.nama_kelas,
        jam_masuk: timeStr,
        jam_pulang: "",
        status_kehadiran: statusKehadiran,
        keterlambatan_menit: keterlambatanMenit,
        metode_absen: "BARCODE_SCAN",
        keterangan: isTerlambat ? "Terlambat 12 menit" : "Hadir tepat waktu",
        created_at: new Date().toISOString()
      };

      localAttendance.unshift(newRecord);
      saveLocalState();

      return {
        status: "success",
        message: "Presensi masuk berhasil dicatat.",
        data: {
          id_absensi: newRecord.id_absensi,
          id_siswa: siswa.id_siswa,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama_lengkap,
          kelas: siswa.nama_kelas,
          jenis_sesi: "MASUK",
          status_kehadiran: statusKehadiran,
          jam_scan: timeStr,
          keterlambatan_menit: keterlambatanMenit,
          audio_prompt: isTerlambat 
            ? `Selamat pagi ${siswa.nama_lengkap}. Absen masuk tercatat, Anda terlambat.` 
            : `Selamat pagi ${siswa.nama_lengkap}. Absen masuk berhasil, tepat waktu.`
        }
      };
    } else {
      // Sesi Pulang
      if (existing && existing.jam_pulang) {
        return {
          status: "error",
          code: "ALREADY_SCANNED",
          message: `${siswa.nama_lengkap} sudah melakukan absen pulang hari ini pukul ${existing.jam_pulang} WIB.`
        };
      }

      if (existing) {
        existing.jam_pulang = timeStr;
      } else {
        localAttendance.unshift({
          id_absensi: `ABS-${todayStr.replace(/-/g, "")}-${localAttendance.length + 1}`,
          tanggal: todayStr,
          id_siswa: siswa.id_siswa,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama_lengkap,
          id_kelas: siswa.id_kelas,
          nama_kelas: siswa.nama_kelas,
          jam_masuk: "",
          jam_pulang: timeStr,
          status_kehadiran: "HADIR",
          keterlambatan_menit: 0,
          metode_absen: "BARCODE_SCAN",
          keterangan: "Scan pulang langsung",
          created_at: new Date().toISOString()
        });
      }
      saveLocalState();

      return {
        status: "success",
        message: "Presensi pulang berhasil dicatat.",
        data: {
          nama_lengkap: siswa.nama_lengkap,
          kelas: siswa.nama_kelas,
          jenis_sesi: "PULANG",
          status_kehadiran: "HADIR",
          jam_scan: timeStr,
          audio_prompt: `Terima kasih ${siswa.nama_lengkap}. Absen pulang berhasil, hati-hati di jalan.`
        }
      };
    }
  },

  // 2. Login Admin
  async loginAdmin(username, password) {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const response = await fetch(`${CONFIG.DEFAULT_API_URL}?action=login_admin`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ username, password })
        });
        return await response.json();
      } catch (err) {
        console.warn("GAS Connection Error, falling back to Local Auth:", err);
      }
    }

    if ((username === "admin" && password === "admin123") || (username === "piket" && password === "guru123")) {
      return {
        status: "success",
        message: "Login berhasil. Selamat datang di SIPRESMATA MIN 5 Tulungagung.",
        data: {
          id_user: "USR-001",
          username: username,
          nama_pengguna: username === "admin" ? "Administrator MIN 5" : "Petugas Guru Piket",
          role: username === "admin" ? "SUPER_ADMIN" : "GURU_PIKET",
          auth_token: "tk_mock_session_" + Date.now()
        }
      };
    }
    return { status: "error", code: "INVALID_CREDENTIALS", message: "Username atau kata sandi salah. Gunakan admin / admin123" };
  },

  // 3. Ambil Rekap Absensi
  async getRekapAbsensi(tglMulai, tglAkhir, idKelas = "") {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const url = `${CONFIG.DEFAULT_API_URL}?action=get_rekap_absensi&tanggal_mulai=${tglMulai}&tanggal_akhir=${tglAkhir}&id_kelas=${idKelas}`;
        const res = await fetch(url);
        return await res.json();
      } catch (err) {
        console.warn("Falling back to local rekap:", err);
      }
    }

    let items = localAttendance.filter(a => {
      const matchTgl = a.tanggal >= tglMulai && a.tanggal <= tglAkhir;
      const matchKelas = !idKelas || a.id_kelas === idKelas;
      return matchTgl && matchKelas;
    });

    const summary = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: items.length };
    items.forEach(a => {
      const s = (a.status_kehadiran || "").toUpperCase();
      if (s === "HADIR") summary.hadir++;
      else if (s === "TERLAMBAT") summary.terlambat++;
      else if (s === "IZIN") summary.izin++;
      else if (s === "SAKIT") summary.sakit++;
      else if (s === "ALPA") summary.alpa++;
    });

    return {
      status: "success",
      data: {
        periode: { mulai: tglMulai, akhir: tglAkhir },
        id_kelas: idKelas,
        summary: summary,
        total_records: items.length,
        items: items
      }
    };
  },

  // 4. Ambil Statistik Dashboard
  async getDashboardStats(tanggal) {
    const today = tanggal || new Date().toISOString().split("T")[0];
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const res = await fetch(`${CONFIG.DEFAULT_API_URL}?action=get_dashboard_stats&tanggal=${today}`);
        return await res.json();
      } catch (err) {
        console.warn("Falling back to local dashboard stats:", err);
      }
    }

    const todayItems = localAttendance.filter(a => a.tanggal === today);
    let hadir = 0, terlambat = 0, izin = 0, sakit = 0, alpa = 0;
    
    todayItems.forEach(a => {
      const s = (a.status_kehadiran || "").toUpperCase();
      if (s === "HADIR") hadir++;
      else if (s === "TERLAMBAT") terlambat++;
      else if (s === "IZIN") izin++;
      else if (s === "SAKIT") sakit++;
      else if (s === "ALPA") alpa++;
    });

    const totalSudah = hadir + terlambat + izin + sakit + alpa;
    const totalSiswa = localStudents.length;

    return {
      status: "success",
      data: {
        tanggal: today,
        total_siswa_aktif: totalSiswa,
        total_sudah_absen: totalSudah,
        total_belum_absen: Math.max(0, totalSiswa - totalSudah),
        rincian: {
          hadir_tepat_waktu: hadir,
          terlambat: terlambat,
          izin: izin,
          sakit: sakit,
          alpa: alpa
        },
        recent_scans: todayItems.slice(0, 8)
      }
    };
  },

  // 5. Data Siswa CRUD
  async getSiswa(idKelas = "") {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const res = await fetch(`${CONFIG.DEFAULT_API_URL}?action=get_siswa&id_kelas=${idKelas}`);
        return await res.json();
      } catch (err) {}
    }

    let list = localStudents;
    if (idKelas) list = list.filter(s => s.id_kelas === idKelas);
    return { status: "success", total: list.length, data: list };
  },

  async saveSiswa(data) {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const res = await fetch(`${CONFIG.DEFAULT_API_URL}?action=save_siswa`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        });
        return await res.json();
      } catch (err) {}
    }

    const rombel = CONFIG.ROMBEL_LIST.find(r => r.id === data.id_kelas);
    const namaKelas = rombel ? rombel.nama : data.id_kelas;
    const barcode = "MIN5-" + data.nisn;

    if (data.id_siswa) {
      const idx = localStudents.findIndex(s => s.id_siswa === data.id_siswa);
      if (idx !== -1) {
        localStudents[idx] = { ...localStudents[idx], ...data, nama_kelas: namaKelas, kode_barcode: barcode };
        saveLocalState();
        return { status: "success", message: `Data siswa ${data.nama_lengkap} berhasil diperbarui.` };
      }
    } else {
      const newSiswa = {
        id_siswa: `SISWA-${String(localStudents.length + 1).padStart(3, '0')}`,
        nisn: data.nisn,
        nama_lengkap: data.nama_lengkap,
        id_kelas: data.id_kelas,
        nama_kelas: namaKelas,
        jenis_kelamin: data.jenis_kelamin || "L",
        kode_barcode: barcode,
        no_hp_ortu: data.no_hp_ortu || "",
        status_aktif: true
      };
      localStudents.push(newSiswa);
      saveLocalState();
      return { status: "success", message: `Siswa baru ${data.nama_lengkap} berhasil ditambahkan.` };
    }
  },

  async batchImportSiswa(students) {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const res = await fetch(`${CONFIG.DEFAULT_API_URL}?action=batch_import_siswa`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ students })
        });
        return await res.json();
      } catch (err) {}
    }

    let addedCount = 0;
    let skippedCount = 0;

    students.forEach(s => {
      const cleanNisn = String(s.nisn || "").replace(/['"\s]/g, "").trim();
      const cleanNama = String(s.nama_lengkap || "").trim();
      if (!cleanNisn || !cleanNama) {
        skippedCount++;
        return;
      }

      const exists = localStudents.some(item => item.nisn === cleanNisn);
      if (exists) {
        skippedCount++;
        return;
      }

      const rombel = CONFIG.ROMBEL_LIST.find(r => r.id === s.id_kelas) || { nama: s.id_kelas || "Kelas 1A", id: "KLS-1A" };
      const barcode = "MIN5-" + cleanNisn;

      localStudents.push({
        id_siswa: `SISWA-${String(localStudents.length + 1).padStart(3, '0')}`,
        nisn: cleanNisn,
        nama_lengkap: cleanNama,
        id_kelas: rombel.id,
        nama_kelas: rombel.nama,
        jenis_kelamin: (s.jenis_kelamin === 'P' || s.jenis_kelamin === 'Perempuan') ? 'P' : 'L',
        kode_barcode: barcode,
        no_hp_ortu: String(s.no_hp_ortu || "").replace(/['"\s]/g, ""),
        status_aktif: true
      });
      addedCount++;
    });

    saveLocalState();
    return {
      status: "success",
      message: `Berhasil mengimpor ${addedCount} siswa baru (${skippedCount} duplikat/dilewati).`,
      data: { imported: addedCount, skipped: skippedCount }
    };
  },

  async deleteSiswa(idSiswa) {
    localStudents = localStudents.filter(s => s.id_siswa !== idSiswa);
    saveLocalState();
    return { status: "success", message: "Siswa berhasil dihapus." };
  },

  // 6. Manual Absen
  async submitManualAbsen(data) {
    if (CONFIG.DEFAULT_API_URL) {
      try {
        const res = await fetch(`${CONFIG.DEFAULT_API_URL}?action=manual_absen`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        });
        return await res.json();
      } catch (err) {}
    }

    const siswa = localStudents.find(s => s.id_siswa === data.id_siswa);
    const todayStr = data.tanggal || new Date().toISOString().split("T")[0];

    const idx = localAttendance.findIndex(a => a.tanggal === todayStr && a.id_siswa === data.id_siswa);
    if (idx !== -1) {
      localAttendance[idx].status_kehadiran = data.status_kehadiran;
      localAttendance[idx].keterangan = data.keterangan;
      localAttendance[idx].metode_absen = "MANUAL_ADMIN";
    } else {
      localAttendance.unshift({
        id_absensi: `ABS-${todayStr.replace(/-/g, "")}-${localAttendance.length + 1}`,
        tanggal: todayStr,
        id_siswa: data.id_siswa,
        nisn: siswa ? siswa.nisn : "-",
        nama_lengkap: siswa ? siswa.nama_lengkap : "Siswa",
        id_kelas: siswa ? siswa.id_kelas : "",
        nama_kelas: siswa ? siswa.nama_kelas : "",
        jam_masuk: "",
        jam_pulang: "",
        status_kehadiran: data.status_kehadiran,
        keterlambatan_menit: 0,
        metode_absen: "MANUAL_ADMIN",
        keterangan: data.keterangan,
        created_at: new Date().toISOString()
      });
    }
    saveLocalState();

    return { status: "success", message: `Presensi manual berhasil dicatat (${data.status_kehadiran}).` };
  }
};
