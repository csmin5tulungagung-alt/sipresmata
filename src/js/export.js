/**
 * ============================================================================
 * SIPRESMATA - EXPORT & REPORTING MODULE
 * Generates Excel / CSV and Printable Formal Attendance Reports
 * ============================================================================
 */

export const EXPORT = {
  // Export array of objects to CSV file
  downloadCSV(data, filename = "rekap_presensi_min5.csv") {
    if (!data || data.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const row of data) {
      const values = headers.map(header => {
        const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Cetak format laporan resmi madrasah
  printFormalReport(periode, idKelas, summary, items) {
    const printWin = window.open("", "_blank");
    const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const rowsHTML = items.map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${item.tanggal}</td>
        <td>${item.nisn}</td>
        <td><strong>${item.nama_lengkap}</strong></td>
        <td>${item.nama_kelas}</td>
        <td style="text-align: center;">${item.jam_masuk || '-'}</td>
        <td style="text-align: center;">${item.jam_pulang || '-'}</td>
        <td style="text-align: center; font-weight: bold;">${item.status_kehadiran}</td>
        <td>${item.keterangan || '-'}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Rekapitulasi Presensi Siswa - MIN 5 Tulungagung</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11pt; padding: 20mm; }
          .header-kop { text-align: center; border-bottom: 2.5px double #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header-kop h3 { margin: 0; font-size: 14pt; text-transform: uppercase; }
          .header-kop h2 { margin: 0; font-size: 16pt; text-transform: uppercase; font-weight: bold; }
          .header-kop p { margin: 2px 0 0 0; font-size: 9.5pt; font-style: italic; }
          .meta-info { margin-bottom: 15px; font-size: 11pt; }
          .meta-info table { width: 100%; border: none; }
          .meta-info td { padding: 3px 0; }
          table.report-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.report-table th, table.report-table td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; }
          table.report-table th { background-color: #f2f2f2; }
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-box { width: 220px; text-align: center; }
          @media print { @page { size: A4 landscape; margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header-kop">
          <h3>KEMENTERIAN AGAMA REPUBLIK INDONESIA</h3>
          <h2>MADRASAH IBTIDAIYAH NEGERI 5 TULUNGAGUNG</h2>
          <p>Jl. Raya Madrasah No. 5 Tulungagung • Website: min5tulungagung.sch.id</p>
        </div>

        <h3 style="text-align: center; margin: 10px 0; text-transform: uppercase;">
          LAPORAN REKAPITULASI PRESENSI KEHADIRAN SISWA
        </h3>

        <div class="meta-info">
          <table>
            <tr>
              <td style="width: 15%;"><strong>Periode</strong></td>
              <td style="width: 35%;">: ${periode.mulai} s.d. ${periode.akhir}</td>
              <td style="width: 15%;"><strong>Total Kehadiran</strong></td>
              <td style="width: 35%;">: Hadir: ${summary.hadir} | Terlambat: ${summary.terlambat} | Izin: ${summary.izin} | Sakit: ${summary.sakit}</td>
            </tr>
            <tr>
              <td><strong>Rombel / Kelas</strong></td>
              <td>: ${idKelas || 'Semua Kelas (1A-D s.d 6A-D)'}</td>
              <td><strong>Total Data</strong></td>
              <td>: ${items.length} Transaksi Presensi</td>
            </tr>
          </table>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 4%;">No</th>
              <th style="width: 10%;">Tanggal</th>
              <th style="width: 12%;">NISN</th>
              <th>Nama Siswa</th>
              <th style="width: 10%;">Kelas</th>
              <th style="width: 10%;">Jam Masuk</th>
              <th style="width: 10%;">Jam Pulang</th>
              <th style="width: 12%;">Status</th>
              <th style="width: 18%;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <p>Mengetahui,</p>
            <p>Kepala MIN 5 Tulungagung</p>
            <br><br><br>
            <p><strong><u>H. Ahmad Marzuki, M.Pd.I</u></strong><br>NIP. 197508152003121002</p>
          </div>
          <div class="signature-box">
            <p>Tulungagung, ${todayStr}</p>
            <p>Koordinator Presensi / Wali Kelas</p>
            <br><br><br>
            <p><strong><u>Ustadzah Nurul Hidayah, S.Pd</u></strong><br>NIP. 198204102008012015</p>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  }
};
