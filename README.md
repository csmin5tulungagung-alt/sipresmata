# 🏫 SIPRESMATA
### *Sistem Informasi Presensi Siswa Madrasah Terpadu — MIN 5 Tulungagung*
> **"Pantau Kehadiran, Wujudkan Madrasah Cerdas."**  
> *Slogan: "Presensi Tepat, Masa Depan Hebat."*

---

## 🔗 Tautan Penting Proyek
- 🗄️ **Google Sheets Database**: [Buka Spreadsheet Database](https://docs.google.com/spreadsheets/d/1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh/edit?usp=sharing)  
  `SPREADSHEET_ID`: `1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh`
- 🐙 **GitHub Repository**: [csmin5tulungagung-alt/sipresmata](https://github.com/csmin5tulungagung-alt/sipresmata.git)
- 📌 **Daftar Tugas & Roadmap Proyek**: [Lihat TASK_PROJECT_PLAN.md](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/TASK_PROJECT_PLAN.md)

---

## 📚 Dokumen Rancangan & Operasional Lengkap

### 🏛️ Dokumen Arsitektur & Desain (Fase 1–3)
1. 📌 **[Rencana Pengerjaan & Task Proyek (Roadmap)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/TASK_PROJECT_PLAN.md)**
2. 📄 **[Dokumen Kebutuhan Produk (PRD)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/PRD.md)**
3. 🗄️ **[Desain Database Google Sheets](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/DATABASE_DESIGN.md)**
4. 🔌 **[Spesifikasi API Backend (Google Apps Script)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/API_SPECIFICATION.md)**
5. 🔄 **[Alur Sistem & Diagram Use Case](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/SYSTEM_FLOW_USECASE.md)**

### 📘 Dokumen Panduan Operasional & Deployment (Fase 4–6)
6. 📖 **[Buku Panduan Pengguna (User Manual)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/USER_MANUAL_ADMIN.md)** — Panduan lengkap Administrator, Wali Kelas, dan Guru Piket.
7. 📋 **[Standar Operasional Prosedur (SOP Kiosk Scanner)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/SOP_KIOSK_SCANNER.md)** — SOP stasiun pemindaian pagi hari, penanganan kendala, dan offline mode.
8. 🔒 **[Panduan Keamanan & Deployment (Vercel & GitHub)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/SECURITY_AND_DEPLOYMENT.md)** — Panduan deploy Vercel, CORS handling, dan domain madrasah.
9. 🧪 **[Rencana Pengujian & Quality Assurance (Testing Plan)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/TESTING_AND_QA_PLAN.md)** — 13 Skenario pengujian sistem dan benchmark antrean siswa.
10. 📑 **[Template Import Data Siswa (.csv)](file:///d:/coding%20test/ABSENSI%20SIWA%20MIN%205/public/template_import_siswa.csv)** — Format CSV resmi untuk import master siswa.

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
│  Spreadsheet ID: 1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh
│  - master_siswa    - master_kelas    - data_absensi    │
│  - users_admin     - pengaturan      - log_aktivitas   │
└────────────────────────────────────────────────────────┘
```
