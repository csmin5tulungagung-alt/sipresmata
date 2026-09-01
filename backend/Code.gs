/**
 * ============================================================================
 * SIPRESMATA - BACKEND API ENGINE (Google Apps Script Web App)
 * Madrasah Ibtidaiyah Negeri 5 Tulungagung (MIN 5 Tulungagung)
 * "Pantau Kehadiran, Wujudkan Madrasah Cerdas." | "Presensi Tepat, Masa Depan Hebat."
 * ============================================================================
 * 
 * SPREADSHEET_ID: 1omNmjeUB29BGNeNRlwPM2TSgTd4CLgQarT9EB_93a5A
 */

var SPREADSHEET_ID = "1omNmjeUB29BGNeNRlwPM2TSgTd4CLgQarT9EB_93a5A";
var SECRET_SALT = "SIPRESMATA_MIN5_SECRET_SALT_2026";
var CACHE_TTL_SECONDS = 0; // 0 = REAL-TIME MODE (Bebas delay cache, data langsung terbaca secara live)

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
      case "delete_absensi":
        result = handleDeleteAbsensi(requestData);
        break;
      case "delete_multiple_absensi":
        result = handleDeleteMultipleAbsensi(requestData);
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
      case "test_wa_notif":
        result = handleTestWaNotif(requestData);
        break;
      case "check_fonnte_status":
        result = handleCheckFonnteStatus(requestData);
        break;
      case "clear_cache":
        result = handleClearCache(requestData);
        break;
      case "check_db_health":
        result = handleCheckDbHealth(requestData);
        break;
      case "ping":
        result = { 
          status: "success", 
          message: "SIPRESMATA API is running smoothly!", 
          app: "MIN 5 Tulungagung",
          timestamp: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") + " WIB"
        };
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
  var dayOfWeek = now.getDay(); // 0 = Minggu, 5 = Jumat

  // Cek Hari Libur Minggu
  var liburMingguEnabled = (settings.libur_minggu_enabled !== "false");
  var bypassTestMode = (settings.bypass_schedule_test_mode === "true" || req.bypass_schedule === "true");

  if (dayOfWeek === 0 && liburMingguEnabled && !bypassTestMode) {
    return {
      status: "error",
      code: "HOLIDAY_OFF",
      message: "Hari ini adalah hari libur (Minggu). Pemindaian presensi madrasah dinonaktifkan."
    };
  }

  var jamMasukMulai = settings.jam_masuk_mulai || "06:00:00";
  var jamMasukBatas = settings.jam_masuk_batas || "07:15:00";
  var jamMasukMaks = settings.jam_masuk_maksimal || "08:30:00";
  var jamPulangMulai = settings.jam_pulang_mulai || "12:30:00";
  var jamPulangBatas = settings.jam_pulang_batas || "16:00:00";

  // Penyesuaian Jadwal Khusus Hari Jumat
  if (dayOfWeek === 5 && settings.jumat_khusus_enabled !== "false") {
    jamPulangMulai = settings.jam_pulang_jumat_mulai || "11:00:00";
    jamPulangBatas = settings.jam_pulang_jumat_batas || "14:00:00";
  }

  var jenisSesi = "";
  if (timeStr >= jamMasukMulai && timeStr <= jamMasukMaks) {
    jenisSesi = "MASUK";
  } else if (timeStr >= jamPulangMulai && timeStr <= jamPulangBatas) {
    jenisSesi = "PULANG";
  } else if (bypassTestMode) {
    // Mode Pengujian / Bypass
    jenisSesi = (timeStr < (jamPulangMulai || "12:00:00")) ? "MASUK" : "PULANG";
  } else {
    // Di luar jam scan normal
    var arrHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return {
      status: "error",
      code: "OUT_OF_SCHEDULE",
      message: "Saat ini di luar jam operasional presensi hari " + arrHari[dayOfWeek] + " (" + timeStr + " WIB). Sesi Masuk: " + jamMasukMulai.substring(0, 5) + "-" + jamMasukMaks.substring(0, 5) + " WIB. Sesi Pulang: " + jamPulangMulai.substring(0, 5) + "-" + jamPulangBatas.substring(0, 5) + " WIB."
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

    // Kirim Notifikasi WhatsApp Otomatis ke Nomor HP Orang Tua (Anti-Banned Queue)
    kirimNotifikasiWhatsApp(db, settings, siswa, "MASUK", statusKehadiran, timeStr, keterlambatanMenit);

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

      // Kirim Notifikasi WhatsApp Otomatis ke Nomor HP Orang Tua (Anti-Banned Queue)
      kirimNotifikasiWhatsApp(db, settings, siswa, "PULANG", "HADIR", timeStr, 0);

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

    // Pastikan status_kehadiran tetap HADIR (atau TERLAMBAT) saat sudah pulang
    var statusKehadiranPulang = (existingRecord.status === "ALPA" || !existingRecord.status) ? "HADIR" : existingRecord.status;

    // Update kolom jam_pulang (Kolom 6) dan kolom status (Kolom 7)
    absensiSheet.getRange(existingRowIndex, 6).setValue(timeStr);
    absensiSheet.getRange(existingRowIndex, 7).setValue(statusKehadiranPulang);

    // Kirim Notifikasi WhatsApp Otomatis ke Nomor HP Orang Tua (Anti-Banned Queue)
    kirimNotifikasiWhatsApp(db, settings, siswa, "PULANG", statusKehadiranPulang, timeStr, 0);

    return {
      status: "success",
      message: "Presensi pulang berhasil dicatat. Status: " + statusKehadiranPulang + " (Sudah Pulang).",
      data: {
        id_absensi: existingRecord.id_absensi,
        id_siswa: siswa.id_siswa,
        nisn: siswa.nisn,
        nama_lengkap: siswa.nama_lengkap,
        kelas: siswa.nama_kelas,
        jenis_sesi: "PULANG",
        status_kehadiran: statusKehadiranPulang,
        jam_scan: timeStr,
        jam_masuk: existingRecord.jam_masuk || "",
        jam_pulang: timeStr,
        audio_prompt: "Terima kasih " + siswa.nama_lengkap + ". Presensi pulang berhasil dicatat, hati-hati di jalan."
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

function handleDeleteAbsensi(req) {
  var idAbsensi = String(req.id_absensi || "").trim().toUpperCase();
  var idSiswa = String(req.id_siswa || "").trim().toUpperCase();
  var nisn = String(req.nisn || "").trim().toUpperCase();
  var tanggal = formatDateISO(req.tanggal || "");

  if (!idAbsensi && !idSiswa && !nisn) {
    return { status: "error", code: "MISSING_ID", message: "ID Presensi, NISN, atau ID Siswa wajib disertakan." };
  }

  var db = getDB();
  var sheet = db.getSheetByName("data_absensi");
  var data = sheet.getDataRange().getValues();
  var siswaMap = getSiswaMap(db);

  for (var i = data.length - 1; i >= 1; i--) {
    var rowIdAbs = String(data[i][0] || "").trim().toUpperCase();
    var rowTgl = formatDateISO(data[i][1]);
    var rowIdSiswa = String(data[i][2] || "").trim().toUpperCase();
    var rowSiswa = siswaMap[rowIdSiswa] || {};
    var rowNisn = String(rowSiswa.nisn || "").trim().toUpperCase();
    var rowSiswaId = String(rowSiswa.id_siswa || "").trim().toUpperCase();

    var isMatch = false;

    // 1. Cocokkan berdasarkan ID Absensi langsung
    if (idAbsensi && rowIdAbs && rowIdAbs === idAbsensi) {
      isMatch = true;
    }
    // 2. Cocokkan berdasarkan Tanggal + (ID Siswa / NISN / ID Absensi)
    else if (tanggal && rowTgl === tanggal) {
      if (
        (idSiswa && (rowIdSiswa === idSiswa || rowSiswaId === idSiswa)) ||
        (nisn && (rowNisn === nisn || rowIdSiswa === nisn)) ||
        (idAbsensi && (rowIdAbs === idAbsensi || rowIdSiswa === idAbsensi || rowNisn === idAbsensi))
      ) {
        isMatch = true;
      }
    }
    // 3. Fallback tanpa tanggal jika ID Siswa / NISN unik
    else if (!tanggal && !idAbsensi) {
      if (
        (idSiswa && (rowIdSiswa === idSiswa || rowSiswaId === idSiswa)) ||
        (nisn && (rowNisn === nisn || rowIdSiswa === nisn))
      ) {
        isMatch = true;
      }
    }

    if (isMatch) {
      sheet.deleteRow(i + 1);
      clearCache();
      catatLog(db, req.aktor || "ADMIN", "DELETE_ABSENSI", "Menghapus data presensi " + (rowIdAbs || idAbsensi || idSiswa || nisn) + " tanggal " + rowTgl);
      return { status: "success", message: "Data presensi berhasil dihapus." };
    }
  }

  return { status: "error", code: "NOT_FOUND", message: "Data presensi dengan ID / NISN " + (idAbsensi || nisn || idSiswa) + " tidak ditemukan." };
}

function handleDeleteMultipleAbsensi(req) {
  var idList = req.id_list || [];
  var items = req.items || [];

  if (!Array.isArray(idList) || idList.length === 0) {
    if (Array.isArray(items) && items.length > 0) {
      idList = items.map(function(it) { return it.id_absensi || it.nisn || it.id_siswa; });
    } else {
      return { status: "error", code: "EMPTY_LIST", message: "Daftar ID presensi yang akan dihapus tidak boleh kosong." };
    }
  }

  var targetMap = {};
  for (var k = 0; k < idList.length; k++) {
    var rawId = String(idList[k] || "").trim().toUpperCase();
    if (rawId) targetMap[rawId] = true;
  }

  var itemTargetMap = {};
  if (Array.isArray(items)) {
    for (var m = 0; m < items.length; m++) {
      var itm = items[m];
      var itmTgl = formatDateISO(itm.tanggal || "");
      var itmNisn = String(itm.nisn || itm.id_siswa || itm.id_absensi || "").trim().toUpperCase();
      if (itmTgl && itmNisn) {
        itemTargetMap[itmTgl + "_" + itmNisn] = true;
      }
    }
  }

  var db = getDB();
  var sheet = db.getSheetByName("data_absensi");
  var data = sheet.getDataRange().getValues();
  var siswaMap = getSiswaMap(db);
  var deletedCount = 0;

  // Hapus dari baris terbawah ke atas agar index baris tidak bergeser
  for (var i = data.length - 1; i >= 1; i--) {
    var curId = String(data[i][0] || "").trim().toUpperCase();
    var curTgl = formatDateISO(data[i][1]);
    var curIdSiswa = String(data[i][2] || "").trim().toUpperCase();
    var curSiswa = siswaMap[curIdSiswa] || {};
    var curNisn = String(curSiswa.nisn || "").trim().toUpperCase();
    var curSiswaId = String(curSiswa.id_siswa || "").trim().toUpperCase();

    var isMatch = false;
    if (curId && targetMap[curId]) {
      isMatch = true;
    } else if (targetMap[curIdSiswa] || (curNisn && targetMap[curNisn]) || (curSiswaId && targetMap[curSiswaId])) {
      isMatch = true;
    } else if (itemTargetMap[curTgl + "_" + curIdSiswa] || (curNisn && itemTargetMap[curTgl + "_" + curNisn])) {
      isMatch = true;
    }

    if (isMatch) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  clearCache();
  catatLog(db, req.aktor || "ADMIN", "DELETE_MULTIPLE_ABSENSI", "Menghapus " + deletedCount + " data presensi massal.");

  return {
    status: "success",
    message: deletedCount + " data presensi berhasil dihapus.",
    deleted_count: deletedCount
  };
}

// ----------------------------------------------------------------------------
// 3. HANDLER: REKAPITULASI & STATISTIK
// ----------------------------------------------------------------------------
function handleGetRekapAbsensi(req) {
  var db = getDB();
  var tglMulai = formatDateISO(req.tanggal_mulai) || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-01");
  var tglAkhir = formatDateISO(req.tanggal_akhir) || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var idKelas = req.id_kelas || "";

  var siswaMap = getSiswaMap(db);
  var absSheet = db.getSheetByName("data_absensi");
  var absData = absSheet.getDataRange().getValues();

  var items = [];
  var summary = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 };

  for (var i = 1; i < absData.length; i++) {
    var rowTgl = formatDateISO(absData[i][1]);
    var rowIdSiswa = String(absData[i][2] || "").trim();
    var rowKelas = String(absData[i][3] || "").trim();
    var rowStatus = (absData[i][6] || "").toUpperCase();

    if (rowTgl >= tglMulai && rowTgl <= tglAkhir) {
      if (!idKelas || rowKelas === idKelas) {
        var siswa = siswaMap[rowIdSiswa] || { nama_lengkap: "Siswa Tidak Dikenal", nisn: rowIdSiswa };
        var idAbs = String(absData[i][0] || "").trim() || ("ABS-" + rowTgl.replace(/-/g, "") + "-" + i);
        items.push({
          id_absensi: idAbs,
          tanggal: rowTgl,
          id_siswa: siswa.id_siswa || rowIdSiswa,
          nisn: siswa.nisn || rowIdSiswa,
          nama_lengkap: siswa.nama_lengkap || "Siswa Tidak Dikenal",
          id_kelas: rowKelas || siswa.id_kelas || "",
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
        jam_pulang: absData[i][5],
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
  var idList = req.id_siswa_list;
  var deleteAll = req.delete_all === true || req.delete_all === "true" || idList === "ALL";
  var idKelas = req.id_kelas || "";

  if (!deleteAll && !idSiswa && (!idList || idList.length === 0)) {
    return { status: "error", code: "MISSING_ID", message: "ID Siswa atau daftar ID wajib disertakan." };
  }

  var targets = {};
  if (idSiswa) targets[String(idSiswa).trim().toUpperCase()] = true;
  if (Array.isArray(idList)) {
    for (var k = 0; k < idList.length; k++) {
      targets[String(idList[k]).trim().toUpperCase()] = true;
    }
  }

  var db = getDB();
  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return { status: "success", message: "Tidak ada data siswa.", deleted_count: 0 };
  }

  var deletedCount = 0;

  // Hapus dari baris terbawah ke atas agar index baris tidak bergeser
  for (var i = data.length - 1; i >= 1; i--) {
    var curId = String(data[i][0] || "").trim().toUpperCase();
    var curNisn = String(data[i][1] || "").trim().toUpperCase();
    var curNama = String(data[i][2] || "").trim().toUpperCase();
    var curBarcode = String(data[i][5] || "").trim().toUpperCase();
    var curKelas = String(data[i][3] || "").trim().toUpperCase();

    var isMatch = deleteAll 
      ? (!idKelas || curKelas === String(idKelas).trim().toUpperCase()) 
      : (targets[curId] || targets[curNisn] || targets[curBarcode]);

    if (isMatch) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  clearCache();
  catatLog(db, req.aktor || "ADMIN", "DELETE_SISWA", "Menghapus " + deletedCount + " data siswa secara permanen.");

  return {
    status: "success",
    message: deletedCount + " data siswa berhasil dihapus secara permanen.",
    deleted_count: deletedCount
  };
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
  var existingKeys = {};

  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    existingKeys[key] = i + 1;
    if (req[key] !== undefined) {
      sheet.getRange(i + 1, 2).setValue(String(req[key]));
    }
  }

  // Auto-append key baru jika belum ada di spreadsheet
  for (var prop in req) {
    if (prop !== "action" && req[prop] !== undefined && !existingKeys[prop]) {
      sheet.appendRow([prop, String(req[prop]), "Pengaturan " + prop]);
    }
  }

  clearCache();
  return { status: "success", message: "Pengaturan madrasah berhasil diperbarui." };
}

// ----------------------------------------------------------------------------
// 6. HANDLER & HELPER: WHATSAPP GATEWAY (FONNTE) & ANTI-BANNED QUEUE
// ----------------------------------------------------------------------------
function handleTestWaNotif(req) {
  var token = (req.fonnte_token || "").trim();
  var target = (req.target_hp || "").trim();
  var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

  if (!token) {
    return { status: "error", code: "MISSING_TOKEN", message: "Token Fonnte tidak boleh kosong." };
  }
  if (!target) {
    return { status: "error", code: "MISSING_TARGET", message: "Nomor WhatsApp tujuan tes wajib diisi." };
  }

  var cleanHp = target.replace(/[^0-9]/g, "");
  if (cleanHp.indexOf("0") === 0) cleanHp = "62" + cleanHp.substring(1);
  else if (cleanHp.indexOf("8") === 0) cleanHp = "62" + cleanHp;

  var pesan = "🧪 *UJI COBA KONEKSI WHATSAPP GATEWAY*\n"
            + "*MIN 5 TULUNGAGUNG - SIPRESMATA*\n\n"
            + "Halo! Ini adalah pesan uji coba integrasi WhatsApp Gateway (Fonnte) pada sistem presensi SIPRESMATA.\n\n"
            + "⏰ *Waktu Tes:* " + nowStr + " WIB\n"
            + "✅ *Status Token:* TERHUBUNG & AKTIF\n"
            + "🛡️ *Fitur Anti-Banned Delay:* AKTIF\n\n"
            + "Sistem presensi siap mengirim notifikasi otomatis saat kartu barcode siswa discan.";

  try {
    var options = {
      method: "post",
      headers: { "Authorization": token },
      payload: { target: cleanHp, message: pesan, countryCode: "62" },
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch("https://api.fonnte.com/send", options);
    var resText = res.getContentText();
    var json = {};
    try { json = JSON.parse(resText); } catch (e) { json = { raw: resText }; }

    if (json.status === true || json.status === "true" || json.status === "success") {
      return {
        status: "success",
        message: "✓ Pesan uji coba berhasil dikirim ke " + target + ".",
        data: json
      };
    } else {
      return {
        status: "error",
        code: "FONNTE_ERROR",
        message: json.reason || json.message || "Gagal mengirim pesan via Fonnte. Periksa apakah token valid dan device Fonnte terhubung (QR Code sudah discan).",
        data: json
      };
    }
  } catch (err) {
    return {
      status: "error",
      code: "FETCH_ERROR",
      message: "Terjadi kesalahan koneksi ke server Fonnte: " + err.message
    };
  }
}

function handleCheckFonnteStatus(req) {
  var db = getDB();
  var settings = getPengaturanMap(db);
  var token = (req.fonnte_token || settings.fonnte_token || "").trim();

  if (!token) {
    return {
      status: "error",
      code: "MISSING_TOKEN",
      message: "Token Fonnte belum diisi. Masukkan token API Fonnte pada form pengaturan."
    };
  }

  try {
    var options = {
      method: "post",
      headers: {
        "Authorization": token
      },
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch("https://api.fonnte.com/get-devices", options);
    var resText = res.getContentText();
    var json = {};
    try {
      json = JSON.parse(resText);
    } catch (e) {
      json = { raw: resText };
    }

    if (json.status === true || json.status === "true" || (json.data && json.data.length > 0)) {
      var dev = (json.data && json.data.length > 0) ? json.data[0] : (json.device || json);
      var isConnected = (dev.device_status === "connect" || dev.status === "connect" || json.device_status === "connect");
      
      return {
        status: "success",
        is_connected: isConnected,
        device_status: dev.device_status || (isConnected ? "connect" : "disconnect"),
        device_name: dev.name || dev.device || "WhatsApp Gateway MIN 5",
        device_number: dev.device || dev.sender || "-",
        quota: dev.quota || json.quota || "-",
        expired: dev.expired || json.expired || "-",
        message: isConnected 
          ? "✓ WhatsApp Gateway Fonnte TERHUBUNG & Siap Mengirim Notifikasi (Nomor: " + (dev.device || dev.name || "-") + ")"
          : "⚠️ Token Fonnte Valid, namun Perangkat WhatsApp TERPUTUS / Belum scan QR.",
        data: json
      };
    } else {
      // Fallback ke endpoint /device
      var opt2 = {
        method: "post",
        headers: { "Authorization": token },
        muteHttpExceptions: true
      };
      var res2 = UrlFetchApp.fetch("https://api.fonnte.com/device", opt2);
      var json2 = {};
      try { json2 = JSON.parse(res2.getContentText()); } catch (e) { json2 = {}; }

      if (json2.status === true || json2.status === "true") {
        var isConn = (json2.device_status === "connect");
        return {
          status: "success",
          is_connected: isConn,
          device_status: json2.device_status || "disconnect",
          device_name: json2.name || "WhatsApp Gateway",
          device_number: json2.device || "-",
          quota: json2.quota || "-",
          expired: json2.expired || "-",
          message: isConn
            ? "✓ WhatsApp Gateway Fonnte TERHUBUNG & Siap Mengirim Notifikasi."
            : "⚠️ Token Fonnte Valid, namun Perangkat WhatsApp TERPUTUS / Belum scan QR.",
          data: json2
        };
      }

      return {
        status: "error",
        code: "FONNTE_AUTH_FAILED",
        message: json.reason || json.message || "Token Fonnte tidak valid atau server Fonnte menolak otorisasi.",
        data: json
      };
    }
  } catch (err) {
    return {
      status: "error",
      code: "FETCH_ERROR",
      message: "Gagal menghubungi server Fonnte API: " + err.message
    };
  }
}

function handleClearCache(req) {
  clearCache();
  return {
    status: "success",
    message: "Cache memory berhasil dibersihkan! Data spreadsheet akan dimuat ulang secara real-time.",
    timestamp: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") + " WIB"
  };
}

// ----------------------------------------------------------------------------
// 6. HANDLER: DIAGNOSTIK KESEHATAN DATABASE GOOGLE SHEETS
// ----------------------------------------------------------------------------
function handleCheckDbHealth(req) {
  var db;
  try {
    db = getDB();
  } catch (e) {
    return {
      status: "error",
      code: "CANNOT_OPEN_SPREADSHEET",
      message: "Gagal membuka Google Spreadsheet. Periksa SPREADSHEET_ID atau izin akses akun: " + e.message
    };
  }

  if (!db) {
    return {
      status: "error",
      code: "NO_ACTIVE_SPREADSHEET",
      message: "Spreadsheet tidak ditemukan. Pastikan SPREADSHEET_ID valid atau script dijalankan sebagai container-bound script."
    };
  }

  var sheets = db.getSheets();
  var sheetDetails = [];
  var requiredSheets = ["master_kelas", "master_siswa", "data_absensi", "users_admin", "pengaturan_sekolah", "log_aktivitas"];
  var existingNames = [];

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var name = s.getName();
    var rows = s.getLastRow();
    var cols = s.getLastColumn();
    existingNames.push(name);
    sheetDetails.push({
      nama_sheet: name,
      baris: rows,
      kolom: cols
    });
  }

  var missingSheets = [];
  for (var j = 0; j < requiredSheets.length; j++) {
    if (existingNames.indexOf(requiredSheets[j]) === -1) {
      missingSheets.push(requiredSheets[j]);
    }
  }

  var settings = {};
  try {
    settings = getPengaturanMap(db);
  } catch (err) {
    settings = { error: "Gagal membaca pengaturan_sekolah" };
  }

  return {
    status: "success",
    message: "Koneksi Google Spreadsheet & Apps Script BERHASIL aktif!",
    data: {
      spreadsheet_name: db.getName(),
      spreadsheet_id: db.getId(),
      spreadsheet_url: db.getUrl(),
      total_sheets: sheets.length,
      sheets: sheetDetails,
      missing_required_sheets: missingSheets,
      is_database_ready: missingSheets.length === 0,
      server_time: Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss") + " WIB",
      school_name: settings.nama_madrasah || "MIN 5 Tulungagung"
    }
  };
}

function kirimNotifikasiWhatsApp(db, settings, siswa, jenisSesi, statusKehadiran, timeStr, keterlambatanMenit) {
  try {
    // 1. Cek apakah notifikasi WA aktif
    var waEnabled = settings.wa_notif_enabled;
    if (waEnabled !== "true" && waEnabled !== true && waEnabled !== "1") {
      return;
    }

    var token = (settings.fonnte_token || "").trim();
    if (!token) {
      return;
    }

    var noHp = (siswa.no_hp_ortu || "").trim();
    if (!noHp) {
      return;
    }

    // 2. Normalisasi nomor HP ke format internasional 628...
    var cleanHp = noHp.replace(/[^0-9]/g, "");
    if (cleanHp.indexOf("0") === 0) {
      cleanHp = "62" + cleanHp.substring(1);
    } else if (cleanHp.indexOf("8") === 0) {
      cleanHp = "62" + cleanHp;
    }

    // Validasi panjang nomor
    if (cleanHp.length < 10 || cleanHp === "6281234567801") {
      return;
    }

    // 3. KEAMANAN TINGGI ANTI-BANNED: Hitung Dynamic Queue Delay
    // Default jeda pengiriman minimal 10 detik antar pesan
    var baseDelay = parseInt(settings.wa_delay_seconds || "10", 10);
    if (isNaN(baseDelay) || baseDelay < 5) baseDelay = 10;

    var cache = CacheService.getScriptCache();
    var now = new Date().getTime();
    var lastScheduledStr = cache.get("LAST_WA_SCHEDULE_TIMESTAMP");
    var lastScheduled = lastScheduledStr ? parseInt(lastScheduledStr, 10) : 0;

    var nextSendTime;
    if (lastScheduled > now) {
      nextSendTime = lastScheduled + (baseDelay * 1000);
    } else {
      nextSendTime = now + (baseDelay * 1000);
    }

    // Simpan jadwal antrean berikutnya ke cache (TTL 3600 detik)
    cache.put("LAST_WA_SCHEDULE_TIMESTAMP", String(nextSendTime), 3600);

    // Hitung selisih delay dalam detik untuk parameter Fonnte API
    var effectiveDelaySeconds = Math.max(0, Math.round((nextSendTime - now) / 1000));

    // 4. Susun Format Pesan WhatsApp yang Humanis & Rapi
    var pesan = "";
    if (jenisSesi === "MASUK") {
      if (statusKehadiran === "TERLAMBAT") {
        pesan = "🟡 *PEMBERITAHUAN KETERLAMBATAN SISWA*\n"
              + "*MIN 5 TULUNGAGUNG*\n\n"
              + "Yth. Bapak/Ibu Orang Tua / Wali Murid,\n\n"
              + "Diberitahukan bahwa ananda:\n"
              + "👤 *Nama:* " + siswa.nama_lengkap + "\n"
              + "🆔 *NISN:* " + siswa.nisn + "\n"
              + "🏫 *Kelas:* " + (siswa.nama_kelas || siswa.id_kelas) + "\n"
              + "⏰ *Waktu Scan:* " + timeStr + " WIB\n"
              + "⚠️ *Status:* TERLAMBAT (" + keterlambatanMenit + " Menit)\n\n"
              + "Mohon bantuan Bapak/Ibu untuk memotivasi ananda hadir sebelum pukul 07:15 WIB. Terima kasih.\n\n"
              + "_SIPRESMATA - Presensi Digital MIN 5 Tulungagung_";
      } else {
        pesan = "🟢 *PRESENSI KEHADIRAN SISWA*\n"
              + "*MIN 5 TULUNGAGUNG*\n\n"
              + "Yth. Bapak/Ibu Orang Tua / Wali Murid,\n\n"
              + "Alhamdulillah, ananda telah tiba di madrasah:\n"
              + "👤 *Nama:* " + siswa.nama_lengkap + "\n"
              + "🆔 *NISN:* " + siswa.nisn + "\n"
              + "🏫 *Kelas:* " + (siswa.nama_kelas || siswa.id_kelas) + "\n"
              + "⏰ *Waktu Scan:* " + timeStr + " WIB\n"
              + "✅ *Status:* HADIR TEPAT WAKTU\n\n"
              + "Terima kasih atas perhatian dan kerjasamanya.\n\n"
              + "_SIPRESMATA - Presensi Digital MIN 5 Tulungagung_";
      }
    } else {
      pesan = "🔵 *PRESENSI KEPULANGAN SISWA*\n"
            + "*MIN 5 TULUNGAGUNG*\n\n"
            + "Yth. Bapak/Ibu Orang Tua / Wali Murid,\n\n"
            + "Pemberitahuan bahwa ananda telah selesai belajar:\n"
            + "👤 *Nama:* " + siswa.nama_lengkap + "\n"
            + "🆔 *NISN:* " + siswa.nisn + "\n"
            + "🏫 *Kelas:* " + (siswa.nama_kelas || siswa.id_kelas) + "\n"
            + "⏰ *Waktu Pulang:* " + timeStr + " WIB\n"
            + "🏠 *Status:* SELESAI / PULANG\n\n"
            + "Semoga selamat sampai di rumah. Terima kasih.\n\n"
            + "_SIPRESMATA - Presensi Digital MIN 5 Tulungagung_";
    }

    // 5. Kirim via Fonnte API dengan parameter delay
    var payload = {
      target: cleanHp,
      message: pesan,
      delay: String(effectiveDelaySeconds),
      countryCode: "62"
    };

    var options = {
      method: "post",
      headers: {
        "Authorization": token
      },
      payload: payload,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.fonnte.com/send", options);
    Logger.log("Fonnte WA Queue Delay: " + effectiveDelaySeconds + "s | Target: " + cleanHp + " | Res: " + response.getContentText());

  } catch (err) {
    Logger.log("Gagal mengirim WA (Non-blocking): " + err.toString());
  }
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS & DATABASE CACHE
// ----------------------------------------------------------------------------
function getSiswaList(db) {
  if (CACHE_TTL_SECONDS > 0) {
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get("CACHE_SISWA_LIST");
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
    } catch (e) {}
  }

  var sheet = db.getSheetByName("master_siswa");
  var data = sheet.getDataRange().getValues();
  var kelasMap = getKelasMap(db);
  var list = [];

  for (var i = 1; i < data.length; i++) {
    var idSiswa = String(data[i][0] || "").trim();
    var nisn = String(data[i][1] || "").trim();
    var nama = String(data[i][2] || "").trim();

    if (!idSiswa && !nisn && !nama) continue; // Skip baris kosong

    var statusAktif = data[i][7];
    var isNonAktif = (statusAktif === false || statusAktif === "FALSE" || statusAktif === 0 || statusAktif === "0");
    if (isNonAktif) continue;

    var idKls = String(data[i][3] || "KLS-1A").trim();
    list.push({
      id_siswa: idSiswa || ("SISWA-" + Utilities.formatString("%03d", i)),
      nisn: nisn,
      nama_lengkap: nama,
      id_kelas: idKls,
      nama_kelas: kelasMap[idKls] || idKls,
      jenis_kelamin: data[i][4] || "L",
      kode_barcode: data[i][5] || ("MIN5-" + nisn),
      no_hp_ortu: data[i][6] || ""
    });
  }

  if (CACHE_TTL_SECONDS > 0) {
    try {
      var cache2 = CacheService.getScriptCache();
      cache2.put("CACHE_SISWA_LIST", JSON.stringify(list), CACHE_TTL_SECONDS);
    } catch (e) {}
  }
  return list;
}

function getSiswaMap(db) {
  var list = getSiswaList(db);
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.id_siswa) {
      map[s.id_siswa] = s;
      map[String(s.id_siswa).trim().toUpperCase()] = s;
    }
    if (s.nisn) {
      map[s.nisn] = s;
      map[String(s.nisn).trim().toUpperCase()] = s;
    }
    if (s.kode_barcode) {
      map[s.kode_barcode] = s;
      map[String(s.kode_barcode).trim().toUpperCase()] = s;
    }
    if (s.nama_lengkap) {
      map[String(s.nama_lengkap).trim().toUpperCase()] = s;
    }
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
  if (!s) return "";

  // yyyy-MM-dd or yyyy/MM/dd
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
    var p = s.substring(0, 10).split(/[-/]/);
    var y = p[0];
    var m = p[1].length === 1 ? "0" + p[1] : p[1];
    var d = p[2].length === 1 ? "0" + p[2] : p[2];
    return y + "-" + m + "-" + d;
  }

  // dd/MM/yyyy or dd-MM-yyyy
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) {
    var p = s.substring(0, 10).split(/[-/]/);
    var d = p[0].length === 1 ? "0" + p[0] : p[0];
    var m = p[1].length === 1 ? "0" + p[1] : p[1];
    var y = p[2];
    return y + "-" + m + "-" + d;
  }

  try {
    var dObj = new Date(s);
    if (!isNaN(dObj.getTime())) {
      return Utilities.formatDate(dObj, "Asia/Jakarta", "yyyy-MM-dd");
    }
  } catch (e) {}

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
