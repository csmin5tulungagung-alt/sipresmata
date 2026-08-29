# 🚀 Panduan Deployment Backend Google Apps Script
### **SIPRESMATA — MIN 5 Tulungagung**

Panduan ini memandu Anda langkah-demi-langkah untuk menyiapkan backend API pada Google Sheets Anda (`ID: 1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh`).

---

### Langkah 1: Buka Editor Google Apps Script
1. Buka spreadsheet database Anda di browser:
   👉 [https://docs.google.com/spreadsheets/d/1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh/edit](https://docs.google.com/spreadsheets/d/1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh/edit)
2. Klik menu **Ekstensi (Extensions)** > pilih **Apps Script**.
3. Beri nama proyek di kiri atas: `SIPRESMATA-BACKEND`.

---

### Langkah 2: Salin File `Setup.gs` & Inisialisasi Database
1. Buat file baru di Apps Script dengan klik tanda **`+`** di samping *Files* > pilih **Script**.
2. Beri nama: `Setup.gs`.
3. Buka file [`backend/Setup.gs`](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/backend/Setup.gs), salin seluruh kodenya, dan paste ke editor.
4. Pada dropdown fungsi di toolbar atas, pilih `setupDatabaseSIPRESMATA`.
5. Klik tombol **Run (Jalankan)** ▶️.
6. Saat muncul pop-up izin akses (*Authorization Required*):
   - Klik **Review Permissions** (Tinjau Izin).
   - Pilih akun Google Anda.
   - Klik **Advanced (Lanjutan)** > pilih **Go to SIPRESMATA-BACKEND (unsafe)**.
   - Klik **Allow (Izinkan)**.
7. Tunggu hingga log eksekusi selesai (`✅ SETUP DATABASE SIPRESMATA SELESAI DENGAN SUKSES!`).
8. Cek kembali spreadsheet Anda: seluruh 6 sheet (`master_kelas` 1A-D s.d 6A-D, `master_siswa`, `data_absensi`, `users_admin`, `pengaturan_sekolah`, `log_aktivitas`) telah otomatis terbuat!

---

### Langkah 3: Salin File `Code.gs` (API Engine)
1. Buka file `Code.gs` bawaan di Apps Script editor.
2. Hapus kode bawaan `function myFunction() {}`.
3. Buka file [`backend/Code.gs`](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/backend/Code.gs), salin seluruh kodenya, dan paste ke `Code.gs` di Apps Script.
4. Klik ikon **Simpan (Save)** 💾 (atau Ctrl+S).

---

### Langkah 4: Publikasikan sebagai Web App (Deploy)
1. Klik tombol biru **Deploy (Terapkan)** di kanan atas > pilih **New deployment (Penerapan baru)**.
2. Klik ikon gerigi ⚙️ di samping *Select type* > pilih **Web app**.
3. Isi konfigurasi sebagai berikut:
   - **Description**: `SIPRESMATA Production API v1.0`
   - **Execute as**: `Me (email Anda)` *(PENTING!)*
   - **Who has access**: `Anyone (Siapa saja)` *(PENTING! agar aplikasi web frontend dapat mengakses API)*
4. Klik tombol **Deploy**.
5. Salin **Web app URL** yang muncul (contoh format: `https://script.google.com/macros/s/AKfycb.../exec`).
6. Tempelkan URL tersebut ke pengaturan aplikasi frontend di file `src/js/config.js` atau pada menu Pengaturan Sistem di web app SIPRESMATA!
