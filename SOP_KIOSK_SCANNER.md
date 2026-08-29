# 📋 Standar Operasional Prosedur (SOP)
## Stasiun Pemindai Presensi (Kiosk Scanner) — MIN 5 Tulungagung
### **Aplikasi SIPRESMATA**

---

### 1. Tujuan SOP
Menjamin kelancaran, ketertiban, kecepatan, dan akurasi pencatatan kehadiran siswa madrasah setiap hari kerja tanpa menimbulkan penumpukan antrean di gerbang atau ruang kelas.

---

### 2. Petugas Pelaksana
1. **Guru Piket Harian**: Bertanggung jawab mengawasi jalannya proses presensi dan menangani kendala siswa terlambat/tidak membawa kartu.
2. **Operator Kiosk / Staf IT**: Bertanggung jawab menyiapkan perangkat keras (tablet/laptop/webcam) dan koneksi internet sebelum gerbang dibuka.
3. **Ketua Kelas / Petugas Siswa**: Membantu mengarahkan antrean siswa di depan pemindai.

---

### 3. Jadwal & Alur Waktu Operasional

| Jam (WIB) | Fase Operasional | Keterangan Status |
| :--- | :--- | :--- |
| **06.00 – 06.30** | Persiapan Perangkat & Pengecekan Jaringan | Operator menyalakan perangkat kiosk, membuka web SIPRESMATA, dan uji scan 1 kartu sampel. |
| **06.30 – 07.15** | Presensi Masuk Pagi (Normal) | Siswa melakukan scan mandiri. Status: **HADIR (Tepat Waktu)**. |
| **07.16 – 08.30** | Presensi Masuk Terlambat | Siswa melakukan scan didampingi Guru Piket. Status: **TERLAMBAT** (menit tercatat). |
| **08.31 – 12.29** | Jam Pembelajaran Efektif (Gerbang Scan Ditutup) | Siswa yang datang di atas jam ini wajib melapor ke Guru Piket untuk dicatat via menu *Presensi Manual*. |
| **12.30 – 16.00** | Presensi Kepulangan Siswa | Siswa melakukan scan pulang sebelum keluar gerbang madrasah. |

---

### 4. Prosedur Operasional Sebelum Sesi Dimulai (Checklist Pagi)
1. Letakkan perangkat pemindai (tablet / laptop dengan kamera menghadap siswa) pada meja setinggi dada siswa (sekitar 90–110 cm) di lokasi yang terlindung dari sinar matahari langsung (agar tidak silau).
2. Hubungkan perangkat ke sumber daya listrik / pastikan baterai terisi penuh (>80%).
3. Buka browser Google Chrome dan akses alamat web **SIPRESMATA**.
4. Masuk ke halaman **📷 Scanner Kiosk**.
5. Pastikan gambar kamera jernih dan lampu indikator kamera aktif.
6. Pastikan volume speaker perangkat berada pada tingkat 70–80% agar suara konfirmasi terdengar jelas oleh siswa.
7. Lakukan 1 kali scan uji coba menggunakan kartu sampel.

---

### 5. Prosedur Saat Siswa Melakukan Scan
1. Siswa berbaris rapi 1 baris berjarak 50 cm di depan pemindai.
2. Siswa memegang kartu pelajar dengan posisi barcode menghadap ke arah lensa kamera (jarak ideal 15–25 cm).
3. Setelah terdengar nada *chime* dan suara sintesis menyebutkan nama siswa:
   - **Layar Hijau**: Siswa dipersilakan langsung menuju ke ruang kelas.
   - **Layar Kuning (Terlambat)**: Siswa dipersilakan masuk dan diingatkan untuk hadir lebih awal esok hari.
4. Siswa berikutnya langsung maju setelah jeda 1 detik.

---

### 6. Prosedur Penanganan Situasi Khusus

#### A. Siswa Lupa Membawa Kartu / Kartu Rusak
1. Siswa tidak boleh menghentikan antrean.
2. Siswa diminta melapor ke Guru Piket yang berjaga di samping stasiun.
3. Guru Piket memasukkan NISN siswa pada kolom **Ketik NISN / Barcode Manual** di bawah pemindai atau mencatatnya di menu *Presensi Manual*.
4. Jika kartu fisik hilang/rusak permanen, Guru Piket mengarahkan siswa ke Tata Usaha untuk pencetakan ulang kartu di menu *Cetak Kartu*.

#### B. Siswa Datang Terlambat (> 07.15 WIB)
1. Siswa tetap melakukan scan di stasiun pemindai.
2. Sistem otomatis mencatat status **TERLAMBAT** dan menghitung durasi menit keterlambatan.
3. Guru Piket memberikan surat izin masuk kelas sesuai tata tertib madrasah.

#### C. Koneksi Internet Terputus Mendadak
1. Aplikasi SIPRESMATA memiliki fitur *Offline-First Local Storage Engine*.
2. Proses pemindaian tetap dapat dilanjutkan seperti biasa. Seluruh data scan sementara tersimpan aman di memori browser lokal.
3. Begitu koneksi internet pulih, sistem akan menyelaraskan data transaksi ke Google Sheets.

---

### 7. Prosedur Penutupan Stasiun (Sore Hari)
1. Pukul 16.00 WIB, Guru Piket membuka menu **📊 Dashboard** untuk mengecek rekapitulasi kehadiran harian.
2. Operator mematikan kamera dengan berpindah tab atau menutup browser.
3. Rapikan dan simpan perangkat pemindai di ruang administrasi/ruang server madrasah.
