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
   - **Who has access**: `Anyone (Siapa saja)` *(SANGAT PENTING! Jika diset "Only myself", Vercel akan diblokir CORS)*
4. Klik tombol **Deploy**.
5. Salin **Web app URL** yang muncul (contoh format: `https://script.google.com/macros/s/AKfycb.../exec`).
6. Tempelkan URL tersebut ke:
   - File `.env` (lokal): `VITE_API_URL=https://script.google.com/macros/s/.../exec`
   - Vercel Dashboard: **Project Settings > Environment Variables > `VITE_API_URL`**
   - Atau langsung di web app pada menu **Portal Admin > Pengaturan Sistem**.

---

### Langkah 5: Uji Koneksi dari Web App
1. Buka aplikasi web SIPRESMATA (lokal atau di Vercel).
2. Masuk ke **Portal Admin > Pengaturan Sistem**.
3. Klik tombol **⚡ Uji Koneksi Database**.
4. Sistem akan otomatis memverifikasi:
   - ✅ Respons status HTTP 200 & latensi (ms)
   - ✅ Keberadaan seluruh 6 tabel database
   - ✅ Nama file spreadsheet yang terhubung

---

### ⚠️ Troubleshooting Masalah Umum:
- **Error CORS / "Failed to fetch"**: Terjadi jika saat deploy Web App Anda memilih *Who has access: Only myself*. Solusinya: Klik **Deploy > Manage Deployments > Edit > Ubah "Who has access" menjadi "Anyone" > Deploy**.
- **Data Tidak Masuk ke Spreadsheet**: Pastikan fungsi `setupDatabaseSIPRESMATA()` di `Setup.gs` telah dijalankan terlebih dahulu dan menghasilkan 6 sheet.
- **Update Kode Tidak Berubah**: Di Google Apps Script, setiap kali Anda mengedit `Code.gs`, Anda **WAJIB** membuat deployment baru (**Deploy > New deployment**) atau mengupdate active deployment (**Manage deployments > Edit > New version**).
