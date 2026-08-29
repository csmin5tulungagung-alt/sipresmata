# 📖 Buku Panduan Pengguna (User Manual)
# **SIPRESMATA — MIN 5 Tulungagung**
> *"Pantau Kehadiran, Wujudkan Madrasah Cerdas."* | *"Presensi Tepat, Masa Depan Hebat."*

Buku panduan ini disusun untuk memberikan petunjuk operasional bagi Administrator Tata Usaha, Guru Piket, dan Wali Kelas MIN 5 Tulungagung dalam mengoperasikan aplikasi SIPRESMATA.

---

## 📑 Daftar Isi
1. [Pengenalan Sistem](#1-pengenalan-sistem)
2. [Akses & Login Administrator](#2-akses--login-administrator)
3. [Panduan Operasional Stasiun Kiosk Scanner](#3-panduan-operasional-stasiun-kiosk-scanner)
4. [Pemantauan Dashboard Presensi Real-Time](#4-pemantauan-dashboard-presensi-real-time)
5. [Pengelolaan Data Master Siswa & Kelas](#5-pengelolaan-data-master-siswa--kelas)
6. [Generate & Cetak Kartu Barcode Massal](#6-generate--cetak-kartu-barcode-massal)
7. [Pencatatan Presensi Manual (Izin / Sakit / Alpa)](#7-pencatatan-presensi-manual-izin--sakit--alpa)
8. [Rekapitulasi & Ekspor Laporan Bulanan](#8-rekapitulasi--ekspor-laporan-bulanan)
9. [Konfigurasi Sistem & Pengaturan Jam Sekolah](#9-konfigurasi-sistem--pengaturan-jam-sekolah)
10. [Tanya Jawab & Solusi Kendala (Troubleshooting)](#10-tanya-jawab--solusi-kendala-troubleshooting)

---

## 1. Pengenalan Sistem
**SIPRESMATA** (*Sistem Informasi Presensi Siswa Madrasah Terpadu*) adalah platform pencatatan kehadiran siswa madrasah berbasis pemindaian barcode/QR code kartu pelajar.
- **Kiosk Scanner**: Dijalankan di tablet/laptop/smartphone di gerbang utama atau ruang piket madrasah.
- **Admin Portal**: Digunakan untuk manajemen data siswa, pencatatan izin/sakit, dan rekapitulasi laporan resmi.

---

## 2. Akses & Login Administrator
1. Buka aplikasi web SIPRESMATA pada browser Google Chrome atau Mozilla Firefox.
2. Klik tombol **🔒 Login Admin** di pojok kanan atas navbar.
3. Masukkan kredensial akun:
   - **Super Admin**: Username `admin` | Password `admin123`
   - **Guru Piket**: Username `piket` | Password `guru123`
4. Klik **Masuk ke Portal Admin**.
5. Setelah berhasil, seluruh tab manajemen (Dashboard, Rekap, Data Siswa, Cetak Kartu, Izin/Sakit, Pengaturan) dapat diakses penuh.

---

## 3. Panduan Operasional Stasiun Kiosk Scanner
1. Buka menu **📷 Scanner Kiosk** pada perangkat pemindai madrasah.
2. Izinkan akses kamera browser saat pertama kali membuka (*Allow Camera Access*).
3. Pada dropdown kamera di atas kotak pemindai, pilih kamera yang digunakan (disarankan kamera belakang atau webcam HD USB).
4. Siswa mengarahkan kartu barcode ke kotak sasaran kamera.
5. Sistem akan memberikan indikator ganda:
   - **Visual**: Kartu hijau (*Hadir Tepat Waktu*) atau kartu kuning (*Terlambat*) beserta foto, nama, kelas, dan jam scan.
   - **Audio**: Nada *melodic chime* dan suara sapaan otomatis dalam Bahasa Indonesia (*"Selamat pagi [Nama Siswa], absen masuk berhasil"*).
6. **Input Manual Barcode (Cadangan)**: Jika kartu siswa basah/rusak sehingga tidak terbaca kamera, petugas dapat mengetikkan NISN/kode barcode pada kolom input di bawah kamera lalu klik **Kirim Presensi**.

---

## 4. Pemantauan Dashboard Presensi Real-Time
1. Buka menu **📊 Dashboard**.
2. Anda akan melihat 6 kartu metrik presensi hari ini:
   - **Total Siswa Aktif** (Seluruh siswa terdaftar di MIN 5)
   - **Hadir Tepat Waktu** (Scan masuk sebelum 07.15 WIB)
   - **Terlambat** (Scan masuk antara 07.16 s.d 08.30 WIB)
   - **Izin** (Tercatat izin)
   - **Sakit** (Tercatat sakit)
   - **Alpa / Belum Absen** (Siswa yang belum melakukan presensi)
3. Tabel **Riwayat Scan Terbaru** menampilkan feed siswa yang baru saja melakukan scan secara *real-time*.

---

## 5. Pengelolaan Data Master Siswa & Kelas
### A. Menambah Siswa Baru
1. Buka menu **👥 Data Siswa**.
2. Klik tombol **➕ Tambah Siswa Baru**.
3. Isi data:
   - **NISN**: 10 digit nomor induk unik siswa.
   - **Nama Lengkap**: Nama lengkap siswa.
   - **Rombel / Kelas**: Pilih kelas (misal: `Kelas 1A`).
   - **Jenis Kelamin**: Laki-laki / Perempuan.
   - **No. WhatsApp Ortu**: Format `628xxxxxxxxxx`.
4. Klik **💾 Simpan Data Siswa**. Kode barcode unik `MIN5-[NISN]` otomatis dibuat.

### B. Mengubah / Menghapus Data Siswa
- Klik ikon pensil ✏️ pada baris siswa untuk mengedit nama/kelas/kontak.
- Klik ikon tempat sampah 🗑️ untuk menonaktifkan siswa yang telah lulus atau pindah sekolah.

---

## 6. Generate & Cetak Kartu Barcode Massal
1. Buka menu **🪪 Cetak Kartu**.
2. Pilih rombongan belajar pada dropdown (misal: `Kelas 1A`).
3. Seluruh kartu ID siswa kelas tersebut akan langsung dirender secara otomatis dengan barcode Code128 beresolusi tinggi dan Kop resmi MIN 5 Tulungagung.
4. Klik tombol **🖨️ Cetak Seluruh Kartu (A4)**.
5. Pada jendela cetak printer:
   - Pilih ukuran kertas: **A4**.
   - Tata letak: **Portrait / Landscape**.
   - Centang opsi: **Background graphics (Grafik latar belakang)** agar warna kop tercetak sempurna.
   - Pilih printer fisik atau **Save as PDF**.

---

## 7. Pencatatan Presensi Manual (Izin / Sakit / Alpa)
Digunakan ketika orang tua siswa mengirim surat keterangan dokter atau memberitahukan izin ketidakhadiran:
1. Buka menu **📝 Izin / Sakit**.
2. Tentukan **Tanggal Ketidakhadiran**.
3. Pilih **Nama Siswa** dari dropdown pencarian.
4. Pilih **Status Kehadiran**: `IZIN`, `SAKIT`, atau `ALPA`.
5. Tuliskan alasan/keterangan pada kolom teks (contoh: *"Demam tinggi, surat dokter terlampir"*).
6. Klik **💾 Simpan Presensi Manual**. Status siswa akan langsung terbarui di database dan laporan rekapitulasi.

---

## 8. Rekapitulasi & Ekspor Laporan Bulanan
1. Buka menu **📑 Rekap Presensi**.
2. Tentukan filter:
   - **Periode**: Tanggal Mulai dan Tanggal Akhir (misal: `01/08/2026` s.d `31/08/2026`).
   - **Rombel**: Pilih kelas tertentu atau *Semua Rombel (1A-D s.d 6A-D)*.
3. Klik **🔍 Tampilkan Rekap**.
4. **Opsi Ekspor**:
   - Klik **📥 Ekspor Excel (.csv)** untuk mengunduh data mentah yang dapat diolah di Microsoft Excel / Google Sheets.
   - Klik **🖨️ Cetak Laporan Resmi** untuk membuka jendela cetak format resmi Kop Kementerian Agama & MIN 5 Tulungagung yang siap ditandatangani oleh Kepala Madrasah.

---

## 9. Konfigurasi Sistem & Pengaturan Jam Sekolah
1. Buka menu **⚙️ Pengaturan**.
2. **Koneksi Database**:
   - Masukkan URL hasil deployment Google Apps Script Web App pada kolom **URL Google Apps Script Web App (API)**.
   - Pastikan **Client Key** terisi sesuai kunci pengaman madrasah (`MIN5_SIPRESMATA_2026`).
3. Klik **💾 Simpan Konfigurasi**.

---

## 10. Tanya Jawab & Solusi Kendala (Troubleshooting)

| Gejala Kendala | Kemungkinan Penyebab | Solusi Penanganan |
| :--- | :--- | :--- |
| **Kamera tidak muncul di layar scanner** | Izin kamera diblokir browser atau kamera sedang dipakai aplikasi lain. | Klik ikon gembok 🔒 di samping address bar browser > ubah izin Kamera menjadi *Allow/Izinkan* > muat ulang halaman. |
| **Peringatan "Barcode tidak terdaftar"** | Siswa belum dimasukkan ke data master atau NISN salah ketik. | Buka menu *Data Siswa* dan pastikan NISN siswa telah terdaftar dengan benar. |
| **Peringatan "Sudah melakukan absen"** | Siswa menempelkan kartu dua kali dalam hari yang sama. | Kartu cukup dipindai satu kali saat masuk dan satu kali saat pulang. |
| **Suara notifikasi tidak berbunyi** | Volume perangkat mute atau fitur Text-to-Speech diblokir browser. | Pastikan volume speaker perangkat aktif. Klik satu kali di area mana saja pada layar untuk mengaktifkan izin audio browser. |
