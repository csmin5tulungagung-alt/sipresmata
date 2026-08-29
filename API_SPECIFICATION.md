# 🔌 Spesifikasi API (Google Apps Script Backend)
# **SIPRESMATA — MIN 5 Tulungagung**
> *"Pantau Kehadiran, Wujudkan Madrasah Cerdas."*

Base URL Google Apps Script Web App Deployment:
`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

---

### 1. Standar Format Request & Response

#### 1.1. Standar Response Berhasil
Semua endpoint mengembalikan status HTTP 200 dengan format JSON standar:
```json
{
  "status": "success",
  "message": "Deskripsi pesan sukses",
  "data": {},
  "timestamp": "2026-08-29T07:15:00.000Z"
}
```

#### 1.2. Standar Response Gagal / Error
```json
{
  "status": "error",
  "code": "ERROR_CODE_NAME",
  "message": "Pesan deskripsi kesalahan yang mudah dipahami",
  "timestamp": "2026-08-29T07:15:00.000Z"
}
```

---

### 2. Strategi Autentikasi & Otorisasi

Google Apps Script berjalan sebagai web app publik (`Execute as: Me`, `Who has access: Anyone`). Untuk mengamankan endpoint, diterapkan strategi token sederhana:

1. **Role Siswa / Public Scanner**:
   - Endpoint pemindaian (`action=absen_scan`) dapat diakses tanpa token admin, tetapi diamankan dengan parameter `client_key` sekolah yang disimpan di environment frontend Vercel (`VITE_PUBLIC_CLIENT_KEY`).
2. **Role Admin / Petugas**:
   - Endpoint modifikasi data (`save_siswa`, `delete_siswa`, `manual_absen`, `get_rekap_absensi`) **wajib menyertakan parameter `auth_token`**.
   - `auth_token` dihasilkan saat endpoint `login_admin` sukses dan disimpan pada `PropertiesService` atau di-hash dari `id_user + secret_salt + tanggal_hari_ini`.

---

### 3. Daftar Spesifikasi Endpoint

---

#### 3.1. Scan Barcode Siswa (Masuk / Pulang)
Mencatat absensi siswa secara instan dari hasil pemindaian kamera barcode.

- **URL**: `POST ?action=absen_scan`
- **Tipe Request**: `application/json`
- **Parameter Body**:
  | Parameter | Tipe | Wajib? | Keterangan |
  |---|---|---|---|
  | `kode_barcode` | String | Ya | Nilai barcode yang terdeteksi kamera (contoh: `MIN5-0123456781`) |
  | `client_key` | String | Ya | Kunci autentikasi kiosk scanner sekolah |

- **Contoh Request Payload**:
  ```json
  {
    "kode_barcode": "MIN5-0123456781",
    "client_key": "MIN5_SECURE_KIOSK_KEY_2026"
  }
  ```

- **Contoh Response Sukses (Scan Masuk - Tepat Waktu)**:
  ```json
  {
    "status": "success",
    "message": "Absen masuk berhasil dicatat.",
    "data": {
      "id_absensi": "ABS-20260829-042",
      "id_siswa": "SISWA-001",
      "nisn": "0123456781",
      "nama_lengkap": "Ahmad Fauzi Rahman",
      "kelas": "Kelas 1A (Abu Bakar)",
      "jenis_sesi": "MASUK",
      "status_kehadiran": "HADIR",
      "jam_scan": "07:04:12",
      "keterlambatan_menit": 0,
      "audio_prompt": "Selamat pagi Ahmad Fauzi Rahman. Absen masuk berhasil, tepat waktu."
    },
    "timestamp": "2026-08-29T07:04:12.000Z"
  }
  ```

- **Contoh Response Error (Sudah Absen Hari Ini)**:
  ```json
  {
    "status": "error",
    "code": "ALREADY_SCANNED",
    "message": "Ahmad Fauzi Rahman sudah melakukan absen masuk hari ini pada pukul 07:04:12.",
    "timestamp": "2026-08-29T07:05:00.000Z"
  }
  ```

- **Contoh Response Error (Barcode Tidak Ditemukan)**:
  ```json
  {
    "status": "error",
    "code": "BARCODE_NOT_FOUND",
    "message": "Barcode tidak terdaftar dalam database siswa MIN 5.",
    "timestamp": "2026-08-29T07:06:00.000Z"
  }
  ```

---

#### 3.2. Login & Validasi Admin
Memvalidasi kredensial pengguna admin/guru piket dan mengembalikan token sesi.

- **URL**: `POST ?action=login_admin`
- **Tipe Request**: `application/json`
- **Parameter Body**:
  | Parameter | Tipe | Wajib? | Keterangan |
  |---|---|---|---|
  | `username` | String | Ya | Nama pengguna admin |
  | `password` | String | Ya | Kata sandi / PIN admin |

- **Contoh Request**:
  ```json
  {
    "username": "admin_min5",
    "password": "PasswordKuat2026!"
  }
  ```

- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "message": "Login berhasil.",
    "data": {
      "id_user": "USR-001",
      "username": "admin_min5",
      "nama_pengguna": "Ahmad Subagyo, S.Pd",
      "role": "SUPER_ADMIN",
      "auth_token": "tk_9f83ab29c41d7e812b04f19b28a"
    },
    "timestamp": "2026-08-29T07:10:00.000Z"
  }
  ```

---

#### 3.3. Ambil Rekap Absensi (Filter Tanggal & Kelas)
Mengambil daftar riwayat kehadiran dengan opsi penyaringan untuk tabel rekap & ekspor.

- **URL**: `GET ?action=get_rekap_absensi`
- **Parameter Query String**:
  | Parameter | Tipe | Wajib? | Keterangan |
  |---|---|---|---|
  | `auth_token` | String | Ya | Token autentikasi admin |
  | `tanggal_mulai`| String (YYYY-MM-DD) | Ya | Batas awal tanggal |
  | `tanggal_akhir`| String (YYYY-MM-DD) | Ya | Batas akhir tanggal |
  | `id_kelas` | String | Opsional| Kosongkan jika ingin seluruh kelas |
  | `status` | String | Opsional| Filter status: `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPA` |

- **Contoh URL**:
  `GET ?action=get_rekap_absensi&auth_token=tk_9f83...&tanggal_mulai=2026-08-01&tanggal_akhir=2026-08-29&id_kelas=KLS-1A`

- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "message": "Data rekap absensi berhasil diambil.",
    "data": {
      "total_records": 2,
      "summary": {
        "hadir": 1,
        "terlambat": 1,
        "izin": 0,
        "sakit": 0,
        "alpa": 0
      },
      "items": [
        {
          "id_absensi": "ABS-20260829-001",
          "tanggal": "2026-08-29",
          "id_siswa": "SISWA-001",
          "nisn": "0123456781",
          "nama_lengkap": "Ahmad Fauzi Rahman",
          "nama_kelas": "Kelas 1A (Abu Bakar)",
          "jam_masuk": "07:02:15",
          "jam_pulang": "13:02:00",
          "status_kehadiran": "HADIR",
          "keterlambatan_menit": 0,
          "metode_absen": "BARCODE_SCAN",
          "keterangan": "Tepat waktu"
        }
      ]
    },
    "timestamp": "2026-08-29T07:15:00.000Z"
  }
  ```

---

#### 3.4. Ambil Daftar Siswa (Master Siswa)
- **URL**: `GET ?action=get_siswa`
- **Query Params**: `auth_token` (Wajib), `id_kelas` (Opsional), `status_aktif` (Opsional: `all`/`true`)
- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id_siswa": "SISWA-001",
        "nisn": "0123456781",
        "nama_lengkap": "Ahmad Fauzi Rahman",
        "id_kelas": "KLS-1A",
        "nama_kelas": "Kelas 1A (Abu Bakar)",
        "jenis_kelamin": "L",
        "kode_barcode": "MIN5-0123456781",
        "no_hp_ortu": "081234567801",
        "status_aktif": true
      }
    ]
  }
  ```

---

#### 3.5. Simpan / Edit Data Siswa
- **URL**: `POST ?action=save_siswa`
- **Parameter Body**:
  | Parameter | Tipe | Wajib? | Keterangan |
  |---|---|---|---|
  | `auth_token` | String | Ya | Token autentikasi admin |
  | `id_siswa` | String | Opsional| Kosongkan jika tambah siswa baru; Isi jika update |
  | `nisn` | String | Ya | NISN unik |
  | `nama_lengkap`| String | Ya | Nama siswa |
  | `id_kelas` | String | Ya | ID Kelas |
  | `jenis_kelamin`| String | Ya | `L` / `P` |
  | `no_hp_ortu` | String | Opsional| Format `628...` |

- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "message": "Data siswa berhasil disimpan dan barcode siap digenerate.",
    "data": {
      "id_siswa": "SISWA-045",
      "kode_barcode": "MIN5-0129876543"
    }
  }
  ```

---

#### 3.6. Input Absen Manual (Izin / Sakit / Alpa)
Digunakan oleh guru piket / wali kelas untuk mencatat siswa yang berhalangan hadir.

- **URL**: `POST ?action=manual_absen`
- **Parameter Body**:
  | Parameter | Tipe | Wajib? | Keterangan |
  |---|---|---|---|
  | `auth_token` | String | Ya | Token admin |
  | `tanggal` | String (YYYY-MM-DD) | Ya | Tanggal absensi |
  | `id_siswa` | String | Ya | ID Siswa |
  | `status_kehadiran`| String | Ya | `IZIN`, `SAKIT`, `ALPA`, `HADIR` |
  | `keterangan` | String | Ya | Catatan alasan (misal: "Izin menghadiri pernikahan saudara") |

- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "message": "Status absensi manual berhasil diperbarui.",
    "data": {
      "id_absensi": "ABS-20260829-089",
      "nama_lengkap": "Bilal Abdul Malik",
      "status_kehadiran": "SAKIT"
    }
  }
  ```

---

#### 3.7. Ambil Statistik Dashboard Ringkas (Real-Time)
- **URL**: `GET ?action=get_dashboard_stats`
- **Query Params**: `auth_token` (Wajib), `tanggal` (Opsional, default: hari ini)
- **Contoh Response Sukses**:
  ```json
  {
    "status": "success",
    "data": {
      "tanggal": "2026-08-29",
      "total_siswa_aktif": 520,
      "total_sudah_absen": 485,
      "total_belum_absen": 35,
      "rincian": {
        "hadir_tepat_waktu": 460,
        "terlambat": 25,
        "izin": 5,
        "sakit": 3,
        "alpa": 2
      }
    }
  }
  ```

---

### 4. Daftar Kode Error Global (Error Codes Directory)

| Kode Error | HTTP Status | Keterangan & Solusi |
|---|---|---|
| `UNAUTHORIZED` | 401 | Token admin tidak valid atau sudah kedaluwarsa. Silakan login kembali. |
| `INVALID_CLIENT_KEY` | 403 | Kunci scanner kiosk tidak sesuai. |
| `BARCODE_NOT_FOUND` | 404 | Barcode tidak ditemukan di daftar siswa aktif. |
| `ALREADY_SCANNED` | 409 | Siswa sudah melakukan scan pada sesi yang sama hari ini. |
| `OUT_OF_SCHEDULE` | 400 | Pemindaian dilakukan di luar jam operasional yang ditentukan. |
| `DUPLICATE_NISN` | 409 | NISN sudah digunakan oleh siswa lain saat menyimpan data. |
| `MISSING_REQUIRED_PARAMS` | 400 | Parameter wajib tidak dikirim dalam request body atau query. |
| `INTERNAL_SERVER_ERROR` | 500 | Terjadi kendala saat membaca/menulis ke Google Sheets. |
