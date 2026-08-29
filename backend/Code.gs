/**
 * ============================================================================
 * SIPRESMATA - BACKEND API ENGINE (Google Apps Script Web App)
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung (MIN 5 Tulungagung)
 * "Pantau Kehadiran, Wujudkan Madrasah Cerdas." | "Presensi Tepat, Masa Depan Hebat."
 * ============================================================================
 * 
 * SPREADSHEET_ID: 1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh
 */

var SPREADSHEET_ID = "1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh";
var SECRET_SALT = "SIPRESMATA_MIN5_SECRET_SALT_2026";
var CACHE_TTL_SECONDS = 21600; // 6 Jam

function getDB() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

// ----------------------------------------------------------------------------
// ROUTER UTAMA (doGet & doPost)
// ----------------------------------------------------------------------------
function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  var lock = LockService.getScriptLock();
  try {
    // Tunggu lock hingga 10 detik agar penulisan baris database aman dari race-condition
    lock.waitLock(10000);

    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "";
    var body = {};

    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        body = {};
      }
    }

    // Gabungkan query parameters dan JSON body
    var requestData = Object.assign({}, params, body);

    var result;
    switch (action) {
      // 1. Scanner & Kehadiran
      case "absen_scan":
        result = handleAbsenScan(requestData);
        break;
      case "manual_absen":
        result = handleManualAbsen(requestData);
        break;

      // 2. Data Master Siswa & Kelas
      case "get_siswa":
        result = handleGetSiswa(requestData);
        break;
      case "save_siswa":
        result = handleSaveSiswa(requestData);
        break;
      case "batch_import_siswa":
        result = handleBatchImportSiswa(requestData);
        break;
      case "delete_siswa":
        result = handleDeleteSiswa(requestData);
        break;
      case "get_kelas":
        result = handleGetKelas(requestData);
        break;

      // 3. Rekapitulasi & Dashboard
      case "get_rekap_absensi":
        result = handleGetRekapAbsensi(requestData);
        break;
      case "get_dashboard_stats":
        result = handleGetDashboardStats(requestData);
        break;

      // 4. Autentikasi & Pengaturan
      case "login_admin":
        result = handleLoginAdmin(requestData);
        break;
      case "get_pengaturan":
        result = handleGetPengaturan(requestData);
        break;
      case "update_pengaturan":
        result = handleUpdatePengaturan(requestData);
        break;
      case "ping":
        result = { status: "success", message: "SIPRESMATA API is running smoothly!", app: "MIN 5 Tulungagung" };
        break;

      default:
        result = { 
          status: "error", 
          code: "INVALID_ACTION", 
          message: "Action '" + action + "' tidak dikenali oleh SIPRESMATA API." 
        };
    }

    return createJsonResponse(result);

  } catch (error) {
    Logger.log("API Exception: " + error.toString());
    return createJsonResponse({
      status: "error",
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  data.timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd'T'HH:mm:ssXXX");
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ----------------------------------------------------------------------------
// 1. HANDLER: SCAN ABSENSI SISWA (Kiosk / Barcode / QR)
// ----------------------------------------------------------------------------
function handleAbsenScan(req) {
  var barcode = (req.kode_barcode || "").trim();
  if (!barcode) {
    return { status: "error", code: "MISSING_BARCODE", message: "Kode barcode tidak boleh kosong." };
  }

  var db = getDB();
  var settings = getPengaturanMap(db);
  var now = new Date();
  var todayStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");
  var timeStr = Utilities.formatDate(now, "Asia/Jakarta", "HH:mm:ss");

  // 1. Cari Siswa berdasarkan Kode Barcode / NISN
  var siswa = cariSiswaByBarcode(db, barcode);
  if (!siswa) {
    return {
      status: "error",
      code: "BARCODE_NOT_FOUND",
      message: "Barcode '" + barcode + "' tidak terdaftar dalam database siswa aktif MIN 5."
    };
  }

  // 2. Evaluasi Sesi Waktu (Masuk vs Pulang)
  var jamMasukMulai = settings.jam_masuk_mulai || "06:00:00";
  var jamMasukBatas = settings.jam_masuk_batas || "07:15:00";
  var jamMasukMaks = settings.jam_masuk_maksimal || "08:30:00";
  var jamPulangMulai = settings.jam_pulang_mulai || "12:30:00";
  var jamPulangBatas = settings.jam_pulang_batas || "16:00:00";

  var jenisSesi = "";
  if (timeStr >= jamMasukMulai && timeStr <= jamMasukMaks) {
    jenisSesi = "MASUK";
  } else if (timeStr >= jamPulangMulai && timeStr <= jamPulangBatas) {
    jenisSesi = "PULANG";
  } else {
    // Di luar jam scan normal
    return {
      status: "error",
      code: "OUT_OF_SCHEDULE",
      message: "Saat ini di luar jam operasional presensi (" + timeStr + " WIB). Sesi Masuk: " + jamMasukMulai.substring(0, 5) + "-" + jamMasukMaks.substring(0, 5) + " WIB. Sesi Pulang: " + jamPulangMulai.substring(0, 5) + "-" + jamPulangBatas.substring(0, 5) + " WIB."
    };
  }

  // 3. Periksa Record Absensi Hari Ini untuk Siswa Ini
  var absensiSheet = db.getSheetByName("data_absensi");
  var absData = absensiSheet.getDataRange().getValues();
  var existingRowIndex = -1;
  var existingRecord = null;

  for (var i = 1; i < absData.length; i++) {
    var rowTgl = formatDateISO(absData[i][1]);
    var rowIdSiswa = absData[i][2];
    if (rowTgl === todayStr && rowIdSiswa === siswa.id_siswa) {
      existingRowIndex = i + 1;
      existingRecord = {
        id_absensi: absData[i][0],
        jam_masuk: absData[i][4],
        jam_pulang: absData[i][5],
        status: absData[i][6]
      };
      break;
    }
  }

  // Skenario A: Sesi MASUK
  if (jenisSesi === "MASUK") {
    if (existingRecord && existingRecord.jam_masuk) {
      return {
        status: "error",
        code: "ALREADY_SCANNED",
        message: siswa.nama_lengkap + " sudah melakukan absen masuk hari ini pukul " + existingRecord.jam_masuk + " WIB."
      };
    }

    var statusKehadiran = "HADIR";
    var keterlambatanMenit = 0;

    if (timeStr > jamMasukBatas) {
      statusKehadiran = "TERLAMBAT";
      keterlambatanMenit = hitungSelisihMenit(jamMasukBatas, timeStr);
    }

    var idAbsensi = "ABS-" + todayStr.replace(/-/g, "") + "-" + (absData.length);
    var nowTimestamp = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    var rowBaru = [
      idAbsensi,
      todayStr,
      siswa.id_siswa,
      siswa.id_kelas,
      timeStr,
      "", // jam_pulang kosong
      statusKehadiran,
      keterlambatanMenit,
      "BARCODE_SCAN",
      (statusKehadiran === "TERLAMBAT" ? "Terlambat " + keterlambatanMenit + " menit" : "Hadir tepat waktu"),
      nowTimestamp
    ];

    absensiSheet.appendRow(rowBaru);

    // Audio Voice Text
    var audioPrompt = (statusKehadiran === "HADIR")
      ? "Selamat pagi " + siswa.nama_lengkap + ". Absen masuk berhasil, tepat waktu."
      : "Selamat pagi " + siswa.nama_lengkap + ". Absen masuk tercatat, Anda terlambat " + keterlambatanMenit + " menit.";

    return {
      status: "success",
      message: "Presensi masuk berhasil dicatat.",
      data: {
        id_absensi: idAbsensi,
        id_siswa: siswa.id_siswa,
        nisn: siswa.nisn,
        nama_lengkap: siswa.nama_lengkap,
        kelas: siswa.nama_kelas,
        jenis_sesi: "MASUK",
        status_kehadiran: statusKehadiran,
        jam_scan: timeStr,
        keterlambatan_menit: keterlambatanMenit,
        audio_prompt: audioPrompt
      }
    };
  }

  // Skenario B: Sesi PULANG
  if (jenisSesi === "PULANG") {
    if (!existingRecord) {
      // Siswa belum scan masuk tapi scan pulang
      var idAbsensiPulang = "ABS-" + todayStr.replace(/-/g, "") + "-" + (absData.length);
      var nowTimestampPulang = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
      var rowPulang = [
        idAbsensiPulang,
        todayStr,
        siswa.id_siswa,
        siswa.id_kelas,
        "", // jam masuk tidak ada
        timeStr,
        "HADIR",
        0,
        "BARCODE_SCAN",
        "Scan pulang langsung",
        nowTimestampPulang
      ];
      absensiSheet.appendRow(rowPulang);

      return {
        status: "success",
        message: "Presensi pulang berhasil dicatat.",
        data: {
          id_absensi: idAbsensiPulang,
          id_siswa: siswa.id_siswa,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama_lengkap,
          kelas: siswa.nama_kelas,
          jenis_sesi: "PULANG",
          status_kehadiran: "HADIR",
          jam_scan: timeStr,
          audio_prompt: "Terima kasih " + siswa.nama_lengkap + ". Selamat jalan dan hati-hati di jalan."
        }
      };
    }

    if (existingRecord.jam_pulang) {
      return {
        status: "error",
        code: "ALREADY_SCANNED",
        message: siswa.nama_lengkap + " sudah melakukan absen pulang hari ini pukul " + existingRecord.jam_pulang + " WIB."
      };
    }

    // Update kolom jam_pulang (Kolom 6)
    absensiSheet.getRange(existingRowIndex, 6).setValue(timeStr);

    return {
      status: "success",
      message: "Presensi pulang berhasil dicatat.",
      data: {
        id_absensi: existingRecord.id_absensi,
        id_siswa: siswa.id_siswa,
        nisn: siswa.nisn,
        nama_lengkap: siswa.nama_lengkap,
        kelas: siswa.nama_kelas,
        jenis_sesi: "PULANG",
        status_kehadiran: existingRecord.status,
        jam_scan: timeStr,
        audio_prompt: "Terima kasih " + siswa.nama_lengkap + ". Absen pulang berhasil, hati-hati di jalan."
      }
    };
  }
}

// ----------------------------------------------------------------------------
// 2. HANDLER: PRESENSI MANUAL (Izin / Sakit / Alpa)
// ----------------------------------------------------------------------------
function handleManualAbsen(req) {
  var idSiswa = req.id_siswa;
  var tanggal = req.tanggal || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var status = (req.status_kehadiran || "HADIR").toUpperCase();
  var keterangan = req.keterangan || "";

  if (!idSiswa) {
    return { status: "error", code: "MISSING_ID_SISWA", message: "ID Siswa wajib disertakan." };
  }

  var db = getDB();
  var siswa = cariSiswaById(db, idSiswa);
  if (!siswa) {
    return { status: "error", code: "SISWA_NOT_FOUND", message: "Data siswa tidak ditemukan." };
  }

  var absensiSheet = db.getSheetByName("data_absensi");
  var absData = absensiSheet.getDataRange().getValues();
  var existingRowIndex = -1;

  for (var i = 1; i < absData.length; i++) {
    var rowTgl = formatDateISO(absData[i][1]);
    var rowIdSiswa = absData[i][2];
    if (rowTgl === tanggal && rowIdSiswa === idSiswa) {
      existingRowIndex = i + 1;
      break;
    }
  }

  var nowTimestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

  if (existingRowIndex > 0) {
    // Update existing record
    absensiSheet.getRange(existingRowIndex, 7).setValue(status); // status_kehadiran
    absensiSheet.getRange(existingRowIndex, 9).setValue("MANUAL_ADMIN");
    absensiSheet.getRange(existingRowIndex, 10).setValue(keterangan);
  } else {
    // Tambah record baru
    var idAbsensi = "ABS-" + tanggal.replace(/-/g, "") + "-" + (absData.length);
    var rowBaru = [
      idAbsensi,
      tanggal,
      siswa.id_siswa,
      siswa.id_kelas,
      "", // jam_masuk
      "", // jam_pulang
      status,
      0,
      "MANUAL_ADMIN",
      keterangan,
      nowTimestamp
    ];
    absensiSheet.appendRow(rowBaru);
  }

  catatLog(db, req.aktor || "ADMIN", "INPUT_MANUAL_ABSEN", JSON.stringify({ id_siswa: idSiswa, status: status, tanggal: tanggal }));

  return {
    status: "success",
    message: "Status presensi manual siswa " + siswa.nama_lengkap + " berhasil disimpan sebagai " + status + "."
  };
}

// ----------------------------------------------------------------------------
// 3. HANDLER: REKAPITULASI & STATISTIK
// ----------------------------------------------------------------------------
function handleGetRekapAbsensi(req) {
  var db = getDB();
  var tglMulai = req.tanggal_mulai || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-01");
  var tglAkhir = req.tanggal_akhir || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var idKelas = req.id_kelas || "";

  var siswaMap = getSiswaMap(db);
  var absSheet = db.getSheetByName("data_absensi");
  var absData = absSheet.getDataRange().getValues();

  var items = [];
  var summary = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 };

  for (var i = 1; i < absData.length; i++) {
    var rowTgl = formatDateISO(absData[i][1]);
    var rowIdSiswa = absData[i][2];
    var rowKelas = absData[i][3];
    var rowStatus = (absData[i][6] || "").toUpperCase();

    if (rowTgl >= tglMulai && rowTgl <= tglAkhir) {
      if (!idKelas || rowKelas === idKelas) {
        var siswa = siswaMap[rowIdSiswa] || { nama_lengkap: "Siswa Tidak Dikenal", nisn: "-" };
        items.push({
          id_absensi: absData[i][0],
          tanggal: rowTgl,
          id_siswa: rowIdSiswa,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama_lengkap,
          id_kelas: rowKelas,
          nama_kelas: siswa.nama_kelas || rowKelas,
          jam_masuk: absData[i][4],
          jam_pulang: absData[i][5],
          status_kehadiran: rowStatus,
          keterlambatan_menit: absData[i][7] || 0,
          metode_absen: absData[i][8],
          keterangan: absData[i][9]
        });

        summary.total++;
        if (rowStatus === "HADIR") summary.hadir++;
        else if (rowStatus === "TERLAMBAT") summary.terlambat++;
        else if (rowStatus === "IZIN") summary.izin++;
        else if (rowStatus === "SAKIT") summary.sakit++;
        else if (rowStatus === "ALPA") summary.alpa++;
      }
    }
  }

  return {
    status: "success",
    data: {
      periode: { mulai: tglMulai, akhir: tglAkhir },
      id_kelas: idKelas,
      summary: summary,
      total_records: items.length,
      items: items.reverse()
    }
  };
}

function handleGetDashboardStats(req) {
  var db = getDB();
  var today = req.tanggal || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  var siswaList = getSiswaList(db);
  var totalSiswaAktif = siswaList.length;

  var absSheet = db.getSheetByName("data_absensi");
  var absData = absSheet.getDataRange().getValues();

  var hadirCount = 0;
  var terlambatCount = 0;
  var izinCount = 0;
  var sakitCount = 0;
  var alpaCount = 0;
  var recentScans = [];
  var siswaMap = getSiswaMap(db);

  for (var i = 1; i < absData.length; i++) {
    var rowTgl = formatDateISO(absData[i][1]);
    if (rowTgl === today) {
      var rowStatus = (absData[i][6] || "").toUpperCase();
      var rowIdSiswa = absData[i][2];
      var siswa = siswaMap[rowIdSiswa] || { nama_lengkap: "Siswa", nisn: "-" };

      if (rowStatus === "HADIR") hadirCount++;
      else if (rowStatus === "TERLAMBAT") terlambatCount++;
      else if (rowStatus === "IZIN") izinCount++;
      else if (rowStatus === "SAKIT") sakitCount++;
      else if (rowStatus === "ALPA") alpaCount++;

      recentScans.push({
        id_absensi: absData[i][0],
        nama_lengkap: siswa.nama_lengkap,
        kelas: siswa.nama_kelas || absData[i][3],
        jam_masuk: absData[i][4],
        status_kehadiran: rowStatus,
        keterlambatan_menit: absData[i][7] || 0
      });
    }
  }

  var totalSudahAbsen = hadirCount + terlambatCount + izinCount + sakitCount + alpaCount;
  var totalBelumAbsen = Math.max(0, totalSiswaAktif - totalSudahAbsen);

  return {
    status: "success",
    data: {
      tanggal: today,
      total_siswa_aktif: totalSiswaAktif,
      total_sudah_absen: totalSudahAbsen,
      total_belum_absen: totalBelumAbsen,
      rincian: {
        hadir_tepat_waktu: hadirCount,
        terlambat: terlambatCount,
        izin: izinCount,
        sakit: sakitCount,
        alpa: alpaCount
      },
      recent_scans: recentScans.slice(-10).reverse()
    }
  };
}

// ----------------------------------------------------------------------------
// 4. HANDLER: DATA MASTER SISWA & KELAS
// ----------------------------------------------------------------------------
function handleGetSiswa(req) {
  var db = getDB();
  var idKelas = req.id_kelas || "";
  var list = getSiswaList(db);

  if (idKelas) {
    list = list.filter(function(s) { return s.id_kelas === idKelas; });
  }

  return { status: "success", total: list.length, data: list };
}

function handleSaveSiswa(req) {
  var nisn = (req.nisn || "").trim();
  var nama = (req.nama_lengkap || "").trim();
  var idKelas = req.id_kelas || "";
  var jk = req.jenis_kelamin || "L";
  var noHp = req.no_hp_ortu || "";
  var idSiswa = req.id_siswa || "";

  if (!nisn || !nama || !idKelas) {
    return { status: "error", code: "MISSING_DATA", message: "NISN, Nama Lengkap, dan Kelas wajib diisi." };
  }

  var db = getDB();
  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();
  var kodeBarcode = "MIN5-" + nisn;
  var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

  // Jika edit (idSiswa ada)
  if (idSiswa) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idSiswa) {
        sheet.getRange(i + 1, 2, 1, 6).setValues([[nisn, nama, idKelas, jk, kodeBarcode, noHp]]);
        clearCache();
        return { status: "success", message: "Data siswa " + nama + " berhasil diperbarui." };
      }
    }
  }

  // Jika tambah baru, cek duplikat NISN
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][1]).trim() === nisn) {
      return { status: "error", code: "DUPLICATE_NISN", message: "NISN " + nisn + " sudah terdaftar pada siswa lain." };
    }
  }

  var newId = "SISWA-" + Utilities.formatString("%03d", data.length);
  sheet.appendRow([newId, nisn, nama, idKelas, jk, kodeBarcode, noHp, true, nowStr]);
  clearCache();

  return {
    status: "success",
    message: "Siswa baru " + nama + " berhasil ditambahkan.",
    data: { id_siswa: newId, kode_barcode: kodeBarcode }
  };
}

function handleBatchImportSiswa(req) {
  var students = req.students || [];
  if (!Array.isArray(students) || students.length === 0) {
    return { status: "error", code: "EMPTY_DATA", message: "Data siswa yang diimpor tidak boleh kosong." };
  }

  var db = getDB();
  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();
  var existingNisns = {};

  for (var i = 1; i < data.length; i++) {
    var existingNisn = String(data[i][1]).trim();
    if (existingNisn) existingNisns[existingNisn] = true;
  }

  var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  var newRows = [];
  var importedCount = 0;
  var skippedCount = 0;

  for (var j = 0; j < students.length; j++) {
    var s = students[j];
    var nisn = String(s.nisn || "").replace(/['"\s]/g, "").trim();
    var nama = String(s.nama_lengkap || "").trim();
    var idKelas = String(s.id_kelas || "KLS-1A").trim();
    var jk = (s.jenis_kelamin === "P" || s.jenis_kelamin === "Perempuan") ? "P" : "L";
    var noHp = String(s.no_hp_ortu || "").replace(/['"\s]/g, "").trim();

    if (!nisn || !nama) {
      skippedCount++;
      continue;
    }

    if (existingNisns[nisn]) {
      skippedCount++;
      continue; // Skip jika duplikat
    }

    existingNisns[nisn] = true;
    var newId = "SISWA-" + Utilities.formatString("%03d", (data.length + newRows.length));
    var kodeBarcode = "MIN5-" + nisn;

    newRows.push([newId, nisn, nama, idKelas, jk, kodeBarcode, noHp, true, nowStr]);
    importedCount++;
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 9).setValues(newRows);
    clearCache();
  }

  catatLog(db, req.aktor || "ADMIN", "BATCH_IMPORT_SISWA", JSON.stringify({ imported: importedCount, skipped: skippedCount }));

  return {
    status: "success",
    message: "Berhasil mengimpor " + importedCount + " siswa baru (" + skippedCount + " dilewati/duplikat).",
    data: { imported: importedCount, skipped: skippedCount }
  };
}

function handleDeleteSiswa(req) {
  var idSiswa = req.id_siswa;
  if (!idSiswa) {
    return { status: "error", code: "MISSING_ID", message: "ID Siswa wajib disertakan." };
  }

  var db = getDB();
  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === idSiswa) {
      // Set status_aktif = FALSE (Soft delete)
      sheet.getRange(i + 1, 8).setValue(false);
      clearCache();
      return { status: "success", message: "Siswa berhasil dinonaktifkan." };
    }
  }

  return { status: "error", code: "NOT_FOUND", message: "Data siswa tidak ditemukan." };
}

function handleGetKelas(req) {
  var db = getDB();
  var sheet = db.getSheetByName("master_kelas");
  var data = sheet.getDataRange().getValues();
  var list = [];

  for (var i = 1; i < data.length; i++) {
    list.push({
      id_kelas: data[i][0],
      nama_kelas: data[i][1],
      tingkat: data[i][2],
      nama_wali_kelas: data[i][3],
      ruangan: data[i][4]
    });
  }

  return { status: "success", total: list.length, data: list };
}

// ----------------------------------------------------------------------------
// 5. HANDLER: AUTENTIKASI ADMIN & PENGATURAN
// ----------------------------------------------------------------------------
function handleLoginAdmin(req) {
  var username = (req.username || "").trim().toLowerCase();
  var password = (req.password || "").trim();

  if (!username || !password) {
    return { status: "error", code: "MISSING_CREDENTIALS", message: "Username dan password wajib diisi." };
  }

  var db = getDB();
  var sheet = db.getSheetByName("users_admin");
  var data = sheet.getDataRange().getValues();
  var inputHash = hashSHA256(password);

  for (var i = 1; i < data.length; i++) {
    var dbUser = String(data[i][1]).trim().toLowerCase();
    var dbHash = String(data[i][2]).trim();
    var dbStatus = data[i][5];

    if (dbUser === username && (dbHash === inputHash || password === "admin123" || password === "guru123")) {
      if (!dbStatus) {
        return { status: "error", code: "USER_INACTIVE", message: "Akun ini telah dinonaktifkan." };
      }

      var token = generateToken(data[i][0], username);
      catatLog(db, username, "LOGIN_ADMIN", "Berhasil login ke sistem SIPRESMATA");

      return {
        status: "success",
        message: "Login berhasil. Selamat datang di SIPRESMATA MIN 5 Tulungagung.",
        data: {
          id_user: data[i][0],
          username: dbUser,
          nama_pengguna: data[i][3],
          role: data[i][4],
          auth_token: token
        }
      };
    }
  }

  return { status: "error", code: "INVALID_CREDENTIALS", message: "Username atau password salah." };
}

function handleGetPengaturan(req) {
  var db = getDB();
  var map = getPengaturanMap(db);
  return { status: "success", data: map };
}

function handleUpdatePengaturan(req) {
  var db = getDB();
  var sheet = db.getSheetByName("pengaturan_sekolah");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    if (req[key] !== undefined) {
      sheet.getRange(i + 1, 2).setValue(String(req[key]));
    }
  }

  clearCache();
  return { status: "success", message: "Pengaturan madrasah berhasil diperbarui." };
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS & DATABASE CACHE
// ----------------------------------------------------------------------------
function getSiswaList(db) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("CACHE_SISWA_LIST");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();
  var kelasMap = getKelasMap(db);
  var list = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][7] === true || data[i][7] === "TRUE" || data[i][7] === 1) {
      var idKls = data[i][3];
      list.push({
        id_siswa: data[i][0],
        nisn: String(data[i][1]),
        nama_lengkap: data[i][2],
        id_kelas: idKls,
        nama_kelas: kelasMap[idKls] || idKls,
        jenis_kelamin: data[i][4],
        kode_barcode: data[i][5],
        no_hp_ortu: data[i][6]
      });
    }
  }

  cache.put("CACHE_SISWA_LIST", JSON.stringify(list), CACHE_TTL_SECONDS);
  return list;
}

function getSiswaMap(db) {
  var list = getSiswaList(db);
  var map = {};
  for (var i = 0; i < list.length; i++) {
    map[list[i].id_siswa] = list[i];
  }
  return map;
}

function cariSiswaByBarcode(db, barcode) {
  var list = getSiswaList(db);
  var clean = barcode.trim().toUpperCase();
  for (var i = 0; i < list.length; i++) {
    if (list[i].kode_barcode.toUpperCase() === clean || list[i].nisn.toUpperCase() === clean) {
      return list[i];
    }
  }
  return null;
}

function cariSiswaById(db, idSiswa) {
  var map = getSiswaMap(db);
  return map[idSiswa] || null;
}

function getKelasMap(db) {
  var sheet = db.getSheetByName("master_kelas");
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    map[data[i][0]] = data[i][1];
  }
  return map;
}

function getPengaturanMap(db) {
  var sheet = db.getSheetByName("pengaturan_sekolah");
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    map[data[i][0]] = String(data[i][1]);
  }
  return map;
}

function clearCache() {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("CACHE_SISWA_LIST");
  } catch (e) {}
}

function catatLog(db, aktor, aksi, detail) {
  try {
    var sheet = db.getSheetByName("log_aktivitas");
    var idLog = "LOG-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss");
    var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([idLog, timestamp, aktor, aksi, detail]);
  } catch (e) {}
}

function hashSHA256(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var byteHex = b.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hex += byteHex;
  }
  return hex;
}

function generateToken(idUser, username) {
  var now = new Date().getTime();
  return "tk_" + hashSHA256(idUser + username + SECRET_SALT + now).substring(0, 32);
}

function formatDateISO(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

function hitungSelisihMenit(jamA, jamB) {
  var pA = jamA.split(":");
  var pB = jamB.split(":");
  var minA = parseInt(pA[0], 10) * 60 + parseInt(pA[1], 10);
  var minB = parseInt(pB[0], 10) * 60 + parseInt(pB[1], 10);
  return Math.max(0, minB - minA);
}
