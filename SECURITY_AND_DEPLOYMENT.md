# 🔒 Panduan Keamanan & Deployment (Vercel & GitHub)
# **SIPRESMATA — MIN 5 Tulungagung**
> *"Pantau Kehadiran, Wujudkan Madrasah Cerdas."*

---

## 1. Arsitektur Keamanan Sistem

### A. Pencegahan CORS & Preflight Issue di Google Apps Script
Google Apps Script (GAS) Web App tidak mendukung penanganan HTTP OPTIONS *preflight request* secara bawaan. Oleh karena itu:
- Seluruh request `POST` dari frontend SIPRESMATA dikirim dengan header `Content-Type: text/plain;charset=utf-8`.
- Hal ini mencegah browser mengirimkan OPTIONS preflight request yang sering memicu error CORS pada backend GAS.
- Backend `Code.gs` mem-parsing isi `e.postData.contents` sebagai JSON objek murni.

### B. Proteksi Endpoint Pemindai Kiosk (`client_key`)
- Stasiun Kiosk Scanner mengirimkan parameter `client_key: "MIN5_SIPRESMATA_2026"` pada setiap request `absen_scan`.
- Backend memvalidasi kecocokan kunci ini sebelum memproses database.

### C. Proteksi Portal Administrator (`auth_token`)
- Kata sandi admin disimpan dalam bentuk **SHA-256 Hash** di sheet `users_admin`.
- Sesi login menerbitkan token terenkripsi `tk_[hash_sha256]` dengan masa berlaku harian.
- Seluruh operasi pengeditan master data (`save_siswa`, `delete_siswa`, `manual_absen`) memverifikasi token admin.

### D. Audit Trail & Logging
- Setiap aktivitas login admin, input absensi manual, atau modifikasi data siswa otomatis dicatat di sheet `log_aktivitas` lengkap dengan timestamp, aktor, jenis aksi, dan payload JSON.

---

## 2. Panduan Deployment Frontend ke Vercel

### Langkah 1: Pastikan Repositori GitHub Telah Terhubung
1. Repositori GitHub resmi: [`https://github.com/csmin5tulungagung-alt/sipresmata.git`](https://github.com/csmin5tulungagung-alt/sipresmata.git)
2. Pastikan seluruh kode terbaru telah di-push:
   ```bash
   git push -u origin main
   ```

### Langkah 2: Hubungkan ke Vercel
1. Buka [https://vercel.com](https://vercel.com) dan login menggunakan akun GitHub Anda.
2. Klik tombol **Add New...** > pilih **Project**.
3. Cari repositori **`sipresmata`** pada daftar repositori GitHub Anda, lalu klik **Import**.
4. Pada menu konfigurasi proyek:
   - **Framework Preset**: Pilih `Vite` (atau `Other`).
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. (Opsional) Tambahkan **Environment Variables**:
   - `VITE_APPS_SCRIPT_URL`: Masukkan URL Web App Google Apps Script Anda.
   - `VITE_CLIENT_KEY`: `MIN5_SIPRESMATA_2026`
6. Klik tombol biru **Deploy**.
7. Dalam waktu ~30 detik, aplikasi SIPRESMATA akan live pada domain gratis berkecepatan tinggi dengan sertifikat SSL (HTTPS) resmi:
   `https://sipresmata.vercel.app` (atau domain kustom madrasah).

---

## 3. Konfigurasi Domain Kustom Madrasah (Opsional)
Jika madrasah memiliki domain sekolah resmi (contoh: `presensi.min5tulungagung.sch.id`):
1. Buka dashboard proyek di Vercel > **Settings** > **Domains**.
2. Masukkan subdomain: `presensi.min5tulungagung.sch.id`.
3. Tambahkan DNS CNAME Record pada panel domain hosting madrasah:
   - **Type**: `CNAME`
   - **Name**: `presensi`
   - **Value**: `cname.vercel-dns.com`
4. Vercel akan otomatis menerbitkan sertifikat SSL Let's Encrypt gratis.
