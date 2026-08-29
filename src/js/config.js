/**
 * ============================================================================
 * SIPRESMATA - CONFIGURATION MODULE
 * "Pantau Kehadiran, Wujudkan Madrasah Cerdas."
 * ============================================================================
 */

export const CONFIG = {
  APP_NAME: "SIPRESMATA",
  APP_SUBTITLE: "Sistem Informasi Presensi Siswa Madrasah Terpadu",
  SCHOOL_NAME: "MIN 5 TULUNGAGUNG",
  SLOGAN: "Presensi Tepat, Masa Depan Hebat.",
  SPREADSHEET_ID: "1BbmMgggGUSOhnXfMW4VMzg7u_L9HGWfuPRbd7c1JM7ksOgEeF8_TwgXh",
  
  // Default GAS API URL (Dapat diubah via menu Pengaturan Sistem atau localStorage)
  DEFAULT_API_URL: localStorage.getItem("SIPRESMATA_API_URL") || "",
  CLIENT_KEY: localStorage.getItem("SIPRESMATA_CLIENT_KEY") || "MIN5_SIPRESMATA_2026",
  
  // Jam Operasional Default (WIB)
  SCHEDULE: {
    MASUK_MULAI: "06:00:00",
    MASUK_BATAS: "07:15:00", // > 07:15 = Terlambat
    MASUK_MAKSIMAL: "08:30:00",
    PULANG_MULAI: "12:30:00",
    PULANG_BATAS: "16:00:00"
  },
  
  // Daftar 24 Rombel (Kelas 1A-D s.d 6A-D)
  ROMBEL_LIST: [
    { id: "KLS-1A", nama: "Kelas 1A", tingkat: 1 },
    { id: "KLS-1B", nama: "Kelas 1B", tingkat: 1 },
    { id: "KLS-1C", nama: "Kelas 1C", tingkat: 1 },
    { id: "KLS-1D", nama: "Kelas 1D", tingkat: 1 },
    { id: "KLS-2A", nama: "Kelas 2A", tingkat: 2 },
    { id: "KLS-2B", nama: "Kelas 2B", tingkat: 2 },
    { id: "KLS-2C", nama: "Kelas 2C", tingkat: 2 },
    { id: "KLS-2D", nama: "Kelas 2D", tingkat: 2 },
    { id: "KLS-3A", nama: "Kelas 3A", tingkat: 3 },
    { id: "KLS-3B", nama: "Kelas 3B", tingkat: 3 },
    { id: "KLS-3C", nama: "Kelas 3C", tingkat: 3 },
    { id: "KLS-3D", nama: "Kelas 3D", tingkat: 3 },
    { id: "KLS-4A", nama: "Kelas 4A", tingkat: 4 },
    { id: "KLS-4B", nama: "Kelas 4B", tingkat: 4 },
    { id: "KLS-4C", nama: "Kelas 4C", tingkat: 4 },
    { id: "KLS-4D", nama: "Kelas 4D", tingkat: 4 },
    { id: "KLS-5A", nama: "Kelas 5A", tingkat: 5 },
    { id: "KLS-5B", nama: "Kelas 5B", tingkat: 5 },
    { id: "KLS-5C", nama: "Kelas 5C", tingkat: 5 },
    { id: "KLS-5D", nama: "Kelas 5D", tingkat: 5 },
    { id: "KLS-6A", nama: "Kelas 6A", tingkat: 6 },
    { id: "KLS-6B", nama: "Kelas 6B", tingkat: 6 },
    { id: "KLS-6C", nama: "Kelas 6C", tingkat: 6 },
    { id: "KLS-6D", nama: "Kelas 6D", tingkat: 6 }
  ]
};

export function saveApiUrl(url) {
  CONFIG.DEFAULT_API_URL = url.trim();
  localStorage.setItem("SIPRESMATA_API_URL", url.trim());
}

export function saveClientKey(key) {
  CONFIG.CLIENT_KEY = key.trim();
  localStorage.setItem("SIPRESMATA_CLIENT_KEY", key.trim());
}
