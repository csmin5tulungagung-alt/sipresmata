# 📋 Dokumen Kebutuhan Produk (PRD)
## Aplikasi Web Absensi Siswa Berbasis Barcode — MIN 5

---

### 1. Ringkasan Eksekutif & Latar Belakang
Madrasah Ibtidaiyah Negeri 5 (MIN 5) membutuhkan sistem pencatatan kehadiran siswa yang cepat, akurat, hemat biaya, dan mudah diakses. Selama ini, absensi manual berbasis kertas memiliki kendala:
- Memakan waktu pembelajaran di kelas (5–10 menit per jam pertama).
- Rentan kesalahan pencatatan dan rekapitulasi yang lambat di akhir bulan.
- Pihak sekolah/wali kelas kesulitan memantau kehadiran siswa yang terlambat secara *real-time*.

Aplikasi **Absensi Siswa MIN 5** dirancang sebagai aplikasi web modern (PWA-ready) dengan arsitektur serverless:
- **Frontend**: Web App responsif (di-hosting di Vercel / GitHub Pages), dapat dioperasikan via tablet/smartphone/laptop yang memiliki kamera (sebagai stasiun kiosk scan atau dipegang petugas piket).
- **Backend**: Google Apps Script (GAS) Web App API.
- **Database**: Google Sheets (aman, gratis, mudah dibaca, dan bisa diakses pihak sekolah tanpa software tambahan).

---

### 2. Profil Pengguna (Target Personas)

| Persona | Peran & Akses | Kebutuhan Utama |
| :--- | :--- | :--- |
| **Siswa / Petugas Piket (Kiosk)** | *Role Siswa (Public/Kiosk Mode)* | Scan barcode kartu pelajar siswa dengan kamera secara instan (<1.5 detik), mendapatkan umpan balik audio & visual (Nama, Kelas, Status: Tepat Waktu/Terlambat). |
| **Wali Kelas / Guru Piket** | *Role Operator / Guru* | Memantau daftar siswa kelas yang belum hadir hari ini, menginput status Izin/Sakit/Alpa secara manual dengan keterangan. |
| **Admin Tata Usaha / Kurikulum** | *Role Super Admin* | Mengelola data master siswa & kelas, mencetak kartu barcode siswa (per siswa / per kelas), mengatur jam operasional sekolah, serta mengunduh rekap absensi bulanan (Excel/PDF). |

---

### 3. Daftar Fitur & Prioritas (MoSCoW Matrix)

#### 3.1. Fitur Utama (*Must-Have* / MVP)
1. **Modul Scanner Barcode/QR Interaktif**:
   - Pemindaian barcode 1D (Code128) atau QR Code secara langsung dari kamera web (dukungan kamera depan/belakang).
   - Audio feedback suara ("*Tet... Absen Masuk Berhasil: Ahmad Fauzi, Hadir Tepat Waktu*") & visual toast hijau/merah.
   - Deteksi *anti-duplicate scan* (mencegah scan berulang dalam hitungan detik/hari yang sama).
2. **Kalkulasi Status Kehadiran Otomatis**:
   - Otomatis menentukan status: **Hadir (Tepat Waktu)**, **Terlambat**, atau **Hadir (Pulang)** berdasarkan jam server saat scan.
3. **Modul Dashboard & Rekapitulasi (Admin)**:
   - Ringkasan harian statistik kehadiran (Total Hadir, Terlambat, Izin, Sakit, Alpa, Belum Hadir).
   - Filter tabel rekap berdasarkan: Rentang Tanggal, Tingkat/Kelas, dan Status Kehadiran.
   - Ekspor rekapitulasi ke format spreadsheet (.CSV / .XLSX) dan cetak laporan presensi resmi.
4. **Modul Input Manual (Sakit / Izin / Alpa)**:
   - Formulir cepat bagi guru/admin untuk menandai siswa yang berhalangan hadir disertai catatan/keterangan.
5. **Modul Master Data Siswa & Kelas (CRUD)**:
   - Tambah, edit, hapus data siswa (NISN, Nama Lengkap, Kelas, Jenis Kelamin, No HP Orang Tua, Status Aktif).
   - Import & Export data siswa via file Excel/CSV.
6. **Generator & Cetak Kartu Barcode**:
   - Otomatis menghasilkan barcode/QR unik berbasis NISN / ID Siswa.
   - Fitur cetak kartu siswa siap print (layout ID card A4 berisi 8–10 kartu dengan logo MIN 5).
7. **Autentikasi & Keamanan Admin**:
   - Halaman login khusus admin dengan proteksi PIN / Kata Sandi dan sesi aman.

#### 3.2. Fitur Pengembangan (*Nice-to-Have* / Fase 2)
1. **Notifikasi WhatsApp Gateway**: Notifikasi otomatis ke nomor WhatsApp orang tua ketika siswa berhasil melakukan scan masuk/pulang.
2. **Offline-First Resilience**: Penyimpanan antrean lokal (*Local Storage / IndexedDB*) jika koneksi internet madrasah sempat terputus, dan otomatis sinkronisasi saat internet kembali stabil.
3. **Capture Foto Siswa (Webcam)**: Opsional mengambil snapshot foto saat siswa scan untuk validasi visual.
4. **PWA (Progressive Web App)**: Aplikasi dapat diinstal langsung di layar utama smartphone/tablet guru tanpa melalui Play Store.

---

### 4. Aturan & Batasan Bisnis (Business Rules)

1. **Keunikan Barcode**:
   - Setiap siswa hanya memiliki 1 kode barcode unik dengan format standar: `MIN5-[NISN/ID]` (Contoh: `MIN5-0012345678`).
2. **Frekuensi & Sesi Absensi**:
   - Siswa hanya dapat melakukan scan **1 kali untuk sesi Masuk** dan **1 kali untuk sesi Pulang** per hari tanggal kalender.
3. **Pengaturan Jam Operasional (Dapat Diubah Admin)**:
   - **Sesi Masuk Normal**: 06.00 – 07.15 WIB (*Status: Hadir Tepat Waktu*)
   - **Sesi Masuk Terlambat**: 07.16 – 08.30 WIB (*Status: Terlambat, sistem mencatat durasi menit keterlambatan*)
   - **Di Luar Jam Masuk**: 08.31 – 11.59 WIB (*Scan ditolak, harus melalui izin piket manual*)
   - **Sesi Pulang**: 12.30 – 16.00 WIB (*Status: Pulang*)
   - **Hari Libur**: Sistem otomatis menolak scan pada hari Ahad/Minggu dan tanggal merah.

---

### 5. Asumsi & Batasan Teknis (MIN 5 Environment)

- **Kapasitas Siswa & Kelas**:
  - Jumlah Siswa: ~400 – 600 siswa.
  - Jumlah Rombongan Belajar: 12 – 18 kelas (Tingkat 1A,B,C,D hingga 6A,B,C,D;).
- **Infrastruktur & Quota**:
  - Backend Google Apps Script memiliki limit kuota 20.000 eksekusi/hari (untuk ~600 siswa x 2 sesi = 1.200 request/hari, hanya menggunakan **6% dari kuota gratis Google**).
  - Waktu respon rata-rata GAS berkisar antara 0.8 s.d. 1.8 detik. Frontend mengimplementasikan *optimistic UI feedback* dan *audio cue* seketika agar proses antrean scan tetap mengalir lancar.

---

### 6. Kriteria Sukses MVP (Definition of Done)

1. **Performa Scan**: Petugas/kiosk dapat memindai kartu siswa secara beruntun dengan jeda maksimal 2 detik antar siswa.
2. **Integritas Data**: Tidak ada data ganda (*duplicate record*) pada tanggal dan sesi yang sama untuk satu siswa.
3. **Kemudahan Cetak**: Admin dapat men-generate dan mencetak kartu barcode untuk 1 kelas penuh hanya dalam 3 klik.
4. **Akurasi Rekap**: Laporan bulanan menghasilkan persentase kehadiran per siswa dan per kelas dengan akurasi 100% cocok dengan data fisik.
5. **Kemudahan Akses**: Aplikasi dapat dibuka tanpa kendala di browser Google Chrome / Safari baik di HP, tablet Android, maupun PC sekolah.
