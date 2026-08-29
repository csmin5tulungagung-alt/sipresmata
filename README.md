# 🏫 SIPRESMATA
### *Sistem Informasi Presensi Siswa Madrasah Terpadu — MIN 5 Tulungagung*
> **"Pantau Kehadiran, Wujudkan Madrasah Cerdas."**  
> *Slogan: "Presensi Tepat, Masa Depan Hebat."*

---

## 🔗 Tautan Penting Proyek
- 🗄️ **Google Sheets Database**: [Buka Spreadsheet Database](https://docs.google.com/spreadsheets/d/1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh/edit?usp=sharing)
  - `SPREADSHEET_ID`: `1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh`
- 🐙 **GitHub Repository**: [csmin5tulungagung-alt/sipresmata](https://github.com/csmin5tulungagung-alt/sipresmata.git)
- 📌 **Daftar Tugas & Roadmap Proyek**: [Lihat TASK_PROJECT_PLAN.md](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/TASK_PROJECT_PLAN.md)

---

## 📚 Dokumen Rancangan Sistem

1. 📌 **[Rencana Pengerjaan & Task Proyek (Roadmap)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/TASK_PROJECT_PLAN.md)**
   - Rincian tahapan pengerjaan Fase 1 s.d. Fase 6 lengkap dengan *acceptance criteria*.
2. 📄 **[Dokumen Kebutuhan Produk (PRD)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/PRD.md)**
   - Latar belakang masalah & tujuan implementasi di MIN 5 Tulungagung.
   - Persona pengguna (Siswa/Kiosk Scanner, Guru Piket/Wali Kelas, Admin Tata Usaha).
   - Fitur Prioritas (*Must-Have* MVP vs *Nice-to-Have* Fase 2).
   - Batasan sistem, jam operasional, dan definisi selesai (*Definition of Done*).
3. 🗄️ **[Desain Database Google Sheets](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/DATABASE_DESIGN.md)**
   - Struktur skema 6 sheet: `master_siswa`, `master_kelas`, `data_absensi`, `users_admin`, `pengaturan_sekolah`, dan `log_aktivitas`.
   - Entity Relationship (ERD) dan kunci relasi (Primary & Foreign Keys).
   - Contoh data dummy siap pakai & strategi mitigasi performa Google Sheets.
4. 🔌 **[Spesifikasi API Backend (Google Apps Script)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/API_SPECIFICATION.md)**
   - Pola endpoint berbasis `?action=nama_aksi`.
   - Spesifikasi detail untuk: Scan Barcode, Login Admin, Ambil Rekap, Simpan Siswa, Absen Manual, dan Dashboard Statistik.
   - Mekanisme autentikasi sederhana & direktori kode error global.
5. 🔄 **[Alur Sistem & Diagram Use Case](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/SYSTEM_FLOW_USECASE.md)**
   - Deskripsi alur langkah-demi-langkah (Scan Kiosk, Cetak Kartu Barcode, Ekspor Rekap, Penanganan Kondisi Khusus).
   - Diagram Alur Mermaid (*Flowchart*) untuk setiap skenario utama.
   - Matriks Tabel Use Case lengkap (Aktor, Use Case, Prasyarat, Hasil Akhir).

---

## 🛠️ Tech Stack & Arsitektur

```
┌────────────────────────────────────────────────────────┐
│                   FRONTEND WEB APP                     │
│  - Branding: SIPRESMATA (MIN 5 Tulungagung)            │
│  - Framework/Core: HTML5, Modern CSS, Vanilla JS / SPA │
│  - Scanner Library: HTML5-QRCode / JsBarcode / TTS API │
│  - Hosting: GitHub -> Vercel (Auto Production Deploy)  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS JSON Request
                            ▼
┌────────────────────────────────────────────────────────┐
│             BACKEND (Google Apps Script)               │
│  - Web App Deployment (doGet & doPost Router)          │
│  - CacheService (In-Memory Indexing <100ms)           │
│  - Real-time Audio Text-to-Speech Engine Response      │
└───────────────────────────┬────────────────────────────┘
                            │ SpreadsheetApp API (Batch)
                            ▼
┌────────────────────────────────────────────────────────┐
│              DATABASE (Google Sheets)                  │
│  Spreadsheet ID: 1omNmjeUB29BGNeNRlwPM2TSgTd4CLgQarT9...│
│  - master_siswa    - master_kelas    - data_absensi    │
│  - users_admin     - pengaturan      - log_aktivitas   │
└────────────────────────────────────────────────────────┘
```
