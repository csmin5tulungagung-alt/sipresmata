/**
 * ============================================================================
 * SIPRESMATA - SETUP & INISIALISASI DATABASE GOOGLE SHEETS
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung (MIN 5 Tulungagung)
 * Slogan: "Presensi Tepat, Masa Depan Hebat."
 * ============================================================================
 * 
 * CARA MENGGUNAKAN:
 * 1. Buka Google Sheets ID: 1omNmjeUB29BGNeNRlwPM2TSgTd4CLgQarT9EB_93a5A
 * 2. Klik menu "Extensions" (Ekstensi) > "Apps Script".
 * 3. Salin isi file ini ke file `Setup.gs` di Apps Script editor.
 * 4. Pilih fungsi `setupDatabaseSIPRESMATA` pada dropdown fungsi di bagian atas.
 * 5. Klik tombol "Run" (Jalankan) dan berikan izin akses saat diminta.
 * 6. Seluruh 6 sheet beserta header, format, dan data awal akan otomatis dibuat!
 */

var SPREADSHEET_ID = "1omNmjeUB29BGNeNRlwPM2TSgTd4CLgQarT9EB_93a5A";

function setupDatabaseSIPRESMATA() {
  var ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error("Tidak dapat membuka spreadsheet dengan ID: " + SPREADSHEET_ID);
  }

  Logger.log("Memulai setup database SIPRESMATA untuk: " + ss.getName());

  // 1. Setup Sheet: master_kelas (1A-D s.d. 6A-D)
  setupSheetMasterKelas(ss);

  // 2. Setup Sheet: master_siswa
  setupSheetMasterSiswa(ss);

  // 3. Setup Sheet: data_absensi
  setupSheetDataAbsensi(ss);

  // 4. Setup Sheet: users_admin
  setupSheetUsersAdmin(ss);

  // 5. Setup Sheet: pengaturan_sekolah
  setupSheetPengaturanSekolah(ss);

  // 6. Setup Sheet: log_aktivitas
  setupSheetLogAktivitas(ss);

  // 7. Setup Sheet: master_guru
  setupSheetMasterGuru(ss);

  // Hapus sheet default "Sheet1" / "Sheet 1" jika kosong
  var defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1") || ss.getSheetByName("Lembar1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() <= 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      Logger.log("Sheet default tidak dihapus: " + e.message);
    }
  }

  Logger.log("✅ SETUP DATABASE SIPRESMATA SELESAI DENGAN SUKSES!");
  return "Database SIPRESMATA Berhasil Dikonfigurasi!";
}

// ----------------------------------------------------------------------------
// 1. Setup Tab: master_kelas (24 Rombel: 1A-1D s.d 6A-6D)
// ----------------------------------------------------------------------------
function setupSheetMasterKelas(ss) {
  var sheetName = "master_kelas";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = ["id_kelas", "nama_kelas", "tingkat", "nama_wali_kelas", "ruangan"];
  setHeaderRow(sheet, headers, "#059669"); // Emerald Green

  if (sheet.getLastRow() <= 1) {
    var kelasList = [];
    var abjad = ["A", "B", "C", "D"];
    for (var tingkat = 1; tingkat <= 6; tingkat++) {
      for (var j = 0; j < abjad.length; j++) {
        var huruf = abjad[j];
        var idKelas = "KLS-" + tingkat + huruf;
        var namaKelas = "Kelas " + tingkat + huruf;
        var wali = "Wali Kelas " + tingkat + huruf + ", S.Pd";
        var ruangan = "Ruang " + tingkat + huruf + " (Gedung " + (tingkat <= 3 ? "A" : "B") + ")";
        kelasList.push([idKelas, namaKelas, tingkat, wali, ruangan]);
      }
    }
    sheet.getRange(2, 1, kelasList.length, headers.length).setValues(kelasList);
    Logger.log("24 Rombel berhasil diisi ke master_kelas.");
  }
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 2. Setup Tab: master_siswa
// ----------------------------------------------------------------------------
function setupSheetMasterSiswa(ss) {
  var sheetName = "master_siswa";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = ["id_siswa", "nisn", "nama_lengkap", "id_kelas", "jenis_kelamin", "kode_barcode", "no_hp_ortu", "status_aktif", "created_at"];
  setHeaderRow(sheet, headers, "#059669");

  if (sheet.getLastRow() <= 1) {
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    var sampleSiswa = [
      ["SISWA-001", "0123456781", "Ahmad Fauzi Rahman", "KLS-1A", "L", "MIN5-0123456781", "6281234567801", true, nowStr],
      ["SISWA-002", "0123456782", "Aisyah Zahira Putri", "KLS-1A", "P", "MIN5-0123456782", "6281234567802", true, nowStr],
      ["SISWA-003", "0123456783", "Bilal Abdul Malik", "KLS-1B", "L", "MIN5-0123456783", "6281234567803", true, nowStr],
      ["SISWA-004", "0123456784", "Fatimah Azzahra", "KLS-1C", "P", "MIN5-0123456784", "6281234567804", true, nowStr],
      ["SISWA-005", "0123456785", "Muhammad Hanif Al-Baqir", "KLS-2A", "L", "MIN5-0123456785", "6281234567805", true, nowStr],
      ["SISWA-006", "0123456786", "Zhafira Nur Ramadhani", "KLS-3A", "P", "MIN5-0123456786", "6281234567806", true, nowStr],
      ["SISWA-007", "0123456787", "Ibrahim Al-Ghifari", "KLS-4B", "L", "MIN5-0123456787", "6281234567807", true, nowStr],
      ["SISWA-008", "0123456788", "Khadijah Nayla Syarif", "KLS-5A", "P", "MIN5-0123456788", "6281234567808", true, nowStr],
      ["SISWA-009", "0123456789", "Rayhan Yusuf Pratama", "KLS-6A", "L", "MIN5-0123456789", "6281234567809", true, nowStr]
    ];
    sheet.getRange(2, 1, sampleSiswa.length, headers.length).setValues(sampleSiswa);
    Logger.log("Sampel siswa berhasil diisi ke master_siswa.");
  }
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 3. Setup Tab: data_absensi
// ----------------------------------------------------------------------------
function setupSheetDataAbsensi(ss) {
  var sheetName = "data_absensi";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = [
    "id_absensi", "tanggal", "id_siswa", "id_kelas", 
    "jam_masuk", "jam_pulang", "status_kehadiran", 
    "keterlambatan_menit", "metode_absen", "keterangan", "created_at"
  ];
  setHeaderRow(sheet, headers, "#0d9488"); // Teal
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 4. Setup Tab: users_admin
// ----------------------------------------------------------------------------
function setupSheetUsersAdmin(ss) {
  var sheetName = "users_admin";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = ["id_user", "username", "password_hash", "nama_pengguna", "role", "status_aktif"];
  setHeaderRow(sheet, headers, "#1e293b"); // Slate Dark

  if (sheet.getLastRow() <= 1) {
    // Password default "admin123" di-hash SHA-256 = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
    // Password guru "guru123" = 5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5
    var defaultUsers = [
      ["USR-001", "admin", "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", "Administrator MIN 5", "SUPER_ADMIN", true],
      ["USR-002", "piket", "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5", "Petugas Guru Piket", "GURU_PIKET", true]
    ];
    sheet.getRange(2, 1, defaultUsers.length, headers.length).setValues(defaultUsers);
    Logger.log("Akun default admin dan piket dibuat di users_admin.");
  }
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 5. Setup Tab: pengaturan_sekolah
// ----------------------------------------------------------------------------
function setupSheetPengaturanSekolah(ss) {
  var sheetName = "pengaturan_sekolah";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = ["key", "value", "keterangan"];
  setHeaderRow(sheet, headers, "#f59e0b"); // Amber/Gold

  if (sheet.getLastRow() <= 1) {
    var defaultSettings = [
      ["nama_madrasah", "MIN 5 TULUNGAGUNG", "Nama resmi madrasah"],
      ["slogan_aplikasi", "Pantau Kehadiran, Wujudkan Madrasah Cerdas.", "Motto aplikasi SIPRESMATA"],
      ["jam_masuk_mulai", "06:00:00", "Awal dibukanya pemindaian masuk pagi"],
      ["jam_masuk_batas", "07:15:00", "Batas akhir tepat waktu (lewat = Terlambat)"],
      ["jam_masuk_maksimal", "08:30:00", "Batas akhir scan masuk (lewat = harus izin piket)"],
      ["jam_pulang_mulai", "12:30:00", "Awal dibukanya sesi scan pulang"],
      ["jam_pulang_batas", "16:00:00", "Batas akhir scan pulang"],
      ["jumat_khusus_enabled", "TRUE", "Aktifkan jadwal khusus kepulangan Jumat"],
      ["jam_pulang_jumat_mulai", "11:00:00", "Awal scan pulang khusus Jumat"],
      ["jam_pulang_jumat_batas", "14:00:00", "Batas scan pulang khusus Jumat"],
      ["libur_minggu_enabled", "TRUE", "Nonaktifkan scanner otomatis di hari Minggu"],
      ["bypass_schedule_test_mode", "FALSE", "Mode bebas uji coba jam scan untuk admin"],
      ["client_key", "MIN5_SIPRESMATA_2026", "Kunci pengaman scanner kiosk"],
      ["suara_otomatis", "TRUE", "Aktifkan suara notifikasi Text-to-Speech (TRUE/FALSE)"]
    ];
    sheet.getRange(2, 1, defaultSettings.length, headers.length).setValues(defaultSettings);
    Logger.log("Pengaturan default diisi di pengaturan_sekolah.");
  }
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 6. Setup Tab: log_aktivitas
// ----------------------------------------------------------------------------
function setupSheetLogAktivitas(ss) {
  var sheetName = "log_aktivitas";
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var headers = ["id_log", "timestamp", "aktor", "aksi", "detail"];
  setHeaderRow(sheet, headers, "#64748b"); // Slate Gray
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// 7. Setup Tab: master_guru
// ----------------------------------------------------------------------------
function setupSheetMasterGuru(ss) {
  var sheetName = "master_guru";
  var sheet = getOrCreateSheet(ss, sheetName);

  var headers = [
    "id_guru", "nip", "nama_guru", "jenis_kelamin", "jabatan",
    "tugas_tambahan", "id_kelas_wali", "no_hp", "status_kepegawaian",
    "kode_barcode", "status_aktif", "created_at"
  ];
  setHeaderRow(sheet, headers, "#059669"); // Emerald Green

  if (sheet.getLastRow() <= 1) {
    var defaultTeachers = [
      ["GURU-001", "197508122005011003", "Drs. H. Ahmad Fauzi, M.Pd.I", "L", "Kepala Madrasah", "Penanggung Jawab", "", "081234567901", "PNS", "GURU-19750812", true, Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")],
      ["GURU-002", "198203152009012011", "Siti Nurjanah, S.Pd.I", "P", "Guru Kelas", "Wali Kelas 1A", "KLS-1A", "081234567902", "PNS", "GURU-19820315", true, Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")],
      ["GURU-003", "198511202010011018", "Moch. Zainuri, S.Pd", "L", "Guru Kelas", "Wali Kelas 6B", "KLS-6B", "081234567903", "PNS", "GURU-19851120", true, Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")],
      ["GURU-004", "199004182023212025", "Rina Wahyuni, S.Pd", "P", "Guru PJOK", "Pembina UKS", "", "081234567904", "PPPK", "GURU-19900418", true, Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")],
      ["GURU-005", "-", "Fajar Shodiq, S.Hum", "L", "Guru Bahasa Arab", "Guru Piket", "", "081234567905", "GTT", "GURU-99001", true, Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")]
    ];
    sheet.getRange(2, 1, defaultTeachers.length, headers.length).setValues(defaultTeachers);
    Logger.log("Data awal guru diisi di master_guru.");
  }
  formatSheetClean(sheet);
}

// ----------------------------------------------------------------------------
// Helper Utilities
// ----------------------------------------------------------------------------
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setHeaderRow(sheet, headers, bgHex) {
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(bgHex)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontFamily("Arial")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function formatSheetClean(sheet) {
  sheet.getRange("A:Z").setFontFamily("Arial").setFontSize(10);
  for (var col = 1; col <= sheet.getLastColumn(); col++) {
    sheet.autoResizeColumn(col);
  }
}
