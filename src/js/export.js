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

  // Cetak format laporan resmi madrasah (Log Harian / Periode)
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
  },

  // Ekspor Matriks Presensi Bulanan ke Format Excel / CSV
  downloadMonthlyMatrixCSV(monthName, year, classLabel, matrixStudents, daysInMonth) {
    if (!matrixStudents || matrixStudents.length === 0) {
      alert("Tidak ada data rekap bulanan untuk diekspor.");
      return;
    }

    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    const headers = ["No", "NISN", "Nama Lengkap Siswa", "Kelas", ...dayHeaders, "Hadir (H)", "Terlambat (T)", "Izin (I)", "Sakit (S)", "Alpa (A)", "Persentase (%)"];

    const csvRows = [];
    csvRows.push([`"REKAPITULASI PRESENSI BULANAN SISWA - MIN 5 TULUNGAGUNG"`]);
    csvRows.push([`"Bulan: ${monthName} ${year} | Rombel: ${classLabel}"`]);
    csvRows.push([]);
    csvRows.push(headers.map(h => `"${h}"`).join(","));

    matrixStudents.forEach((student, idx) => {
      const row = [
        idx + 1,
        `'${student.nisn}`,
        `"${student.nama_lengkap.replace(/"/g, '""')}"`,
        `"${student.nama_kelas || classLabel}"`,
        ...student.dailyStatus.map(s => `"${s.code || '-'}"`),
        student.summary.hadir,
        student.summary.terlambat,
        student.summary.izin,
        student.summary.sakit,
        student.summary.alpa,
        `"${student.percentage}%"`
      ];
      csvRows.push(row.join(","));
    });

    const fileName = `Rekap_Bulanan_MIN5_${classLabel.replace(/\s+/g, '_')}_${monthName}_${year}.csv`;
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Cetak Matriks Presensi Bulanan Resmi (A4 Landscape Form)
  printMonthlyMatrixReport(monthName, year, classLabel, matrixStudents, daysInMonth, summary) {
    const printWin = window.open("", "_blank");
    const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const dayThHTML = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dayDate = new Date(year, parseInt(summary.monthIdx || 1) - 1, dayNum);
      const isSunday = dayDate.getDay() === 0;
      return `<th style="width: 20px; font-size: 8pt; text-align: center; ${isSunday ? 'background-color: #fee2e2; color: #ef4444;' : ''}">${dayNum}</th>`;
    }).join("");

    const rowsHTML = matrixStudents.map((s, idx) => {
      const dayTds = s.dailyStatus.map(d => {
        let bgStyle = "";
        let textVal = d.code || "-";
        if (d.isHoliday) {
          bgStyle = "background-color: #f3f4f6; color: #9ca3af;";
          textVal = "—";
        } else if (d.code === "H") {
          bgStyle = "color: #059669; font-weight: bold;";
        } else if (d.code === "T") {
          bgStyle = "color: #d97706; font-weight: bold;";
        } else if (d.code === "I") {
          bgStyle = "color: #0284c7; font-weight: bold;";
        } else if (d.code === "S") {
          bgStyle = "color: #7c3aed; font-weight: bold;";
        } else if (d.code === "A") {
          bgStyle = "background-color: #fee2e2; color: #dc2626; font-weight: bold;";
        }

        return `<td style="text-align: center; padding: 2px 1px; font-size: 7.5pt; ${bgStyle}">${textVal}</td>`;
      }).join("");

      return `
        <tr>
          <td style="text-align: center; font-size: 8.5pt;">${idx + 1}</td>
          <td style="font-size: 8.5pt; white-space: nowrap;">${s.nisn}</td>
          <td style="font-size: 8.5pt; font-weight: 600; white-space: nowrap; text-align: left;">${s.nama_lengkap}</td>
          <td style="font-size: 8.5pt; text-align: center;">${s.nama_kelas || classLabel}</td>
          ${dayTds}
          <td style="text-align: center; font-size: 8.5pt; font-weight: bold; color: #059669;">${s.summary.hadir}</td>
          <td style="text-align: center; font-size: 8.5pt; font-weight: bold; color: #d97706;">${s.summary.terlambat}</td>
          <td style="text-align: center; font-size: 8.5pt;">${s.summary.izin}</td>
          <td style="text-align: center; font-size: 8.5pt;">${s.summary.sakit}</td>
          <td style="text-align: center; font-size: 8.5pt; font-weight: bold; color: ${s.summary.alpa > 0 ? '#dc2626' : '#6b7280'};">${s.summary.alpa}</td>
          <td style="text-align: center; font-size: 8.5pt; font-weight: bold;">${s.percentage}%</td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rekapitulasi Presensi Bulanan - ${monthName} ${year} - ${classLabel}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 9pt; padding: 10mm; color: #000; }
          .header-kop { text-align: center; border-bottom: 2px double #000; padding-bottom: 6px; margin-bottom: 10px; }
          .header-kop h3 { margin: 0; font-size: 11pt; text-transform: uppercase; font-weight: 700; }
          .header-kop h2 { margin: 0; font-size: 13pt; text-transform: uppercase; font-weight: 900; }
          .header-kop p { margin: 2px 0 0 0; font-size: 8pt; font-style: italic; }
          .meta-info { margin-bottom: 8px; font-size: 8.5pt; }
          .meta-info table { width: 100%; border: none; }
          .meta-info td { padding: 2px 0; }
          table.report-matrix-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          table.report-matrix-table th, table.report-matrix-table td { border: 1px solid #333; padding: 3px 2px; }
          table.report-matrix-table th { background-color: #f3f4f6; font-weight: 700; }
          .legend-box { margin-top: 8px; font-size: 7.5pt; display: flex; gap: 12px; }
          .signature-section { margin-top: 25px; display: flex; justify-content: space-between; font-size: 8.5pt; }
          .signature-box { width: 220px; text-align: center; }
          @media print {
            @page { size: A4 landscape; margin: 8mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header-kop">
          <h3>KEMENTERIAN AGAMA REPUBLIK INDONESIA</h3>
          <h2>MADRASAH IBTIDAIYAH NEGERI 5 TULUNGAGUNG</h2>
          <p>Jl. Raya Madrasah No. 5 Tulungagung • Sistem Informasi Presensi Siswa (SIPRESMATA)</p>
        </div>

        <h3 style="text-align: center; margin: 6px 0; font-size: 10.5pt; text-transform: uppercase; font-weight: 800;">
          MATRIKS REKAPITULASI PRESENSI BULANAN SISWA
        </h3>

        <div class="meta-info">
          <table>
            <tr>
              <td style="width: 15%;"><strong>Bulan / Tahun</strong></td>
              <td style="width: 35%;">: ${monthName} ${year}</td>
              <td style="width: 15%;"><strong>Total Siswa</strong></td>
              <td style="width: 35%;">: ${matrixStudents.length} Siswa Terdaftar</td>
            </tr>
            <tr>
              <td><strong>Rombel / Kelas</strong></td>
              <td>: ${classLabel}</td>
              <td><strong>Rata-rata Kehadiran</strong></td>
              <td>: ${summary.avgAttendance || 0}%</td>
            </tr>
          </table>
        </div>

        <table class="report-matrix-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 25px;">No</th>
              <th rowspan="2" style="width: 75px;">NISN</th>
              <th rowspan="2">Nama Lengkap Siswa</th>
              <th rowspan="2" style="width: 50px;">Kelas</th>
              <th colspan="${daysInMonth}">Tanggal (${monthName})</th>
              <th colspan="5">Rekap</th>
              <th rowspan="2" style="width: 32px;">%</th>
            </tr>
            <tr>
              ${dayThHTML}
              <th style="width: 18px; font-size: 7.5pt; background-color: #d1fae5; color: #065f46;">H</th>
              <th style="width: 18px; font-size: 7.5pt; background-color: #fef3c7; color: #92400e;">T</th>
              <th style="width: 18px; font-size: 7.5pt; background-color: #e0f2fe; color: #075985;">I</th>
              <th style="width: 18px; font-size: 7.5pt; background-color: #ede9fe; color: #5b21b6;">S</th>
              <th style="width: 18px; font-size: 7.5pt; background-color: #fee2e2; color: #991b1b;">A</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="legend-box">
          <strong>Keterangan:</strong>
          <span><strong>H:</strong> Hadir Tepat Waktu</span>
          <span><strong>T:</strong> Terlambat</span>
          <span><strong>I:</strong> Izin</span>
          <span><strong>S:</strong> Sakit</span>
          <span><strong>A:</strong> Alpa / Tanpa Keterangan</span>
          <span><strong>—:</strong> Hari Libur / Minggu</span>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <p>Mengetahui,</p>
            <p>Kepala MIN 5 Tulungagung</p>
            <br><br><br>
            <p><strong><u>H. Ahmad Marzuki, M.Pd.I</u></strong><br>NIP. 197508152003121002</p>
          </div>
          <div class="signature-box">
            <p>Tulungagung, ${todayStr}</p>
            <p>Wali Kelas / Koordinator Presensi</p>
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
