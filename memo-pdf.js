/* Pembuat PDF Site Memo (A4, 3 lembar) dengan jsPDF. Tanpa DOM: jalan di browser (global MEMOPDF) dan di Node (module.exports), supaya bisa diuji otomatis.
 * Tata letak mengikuti sheet TEMPLATE_MEMO di Site Memo: lebar kolom 120/325/78/150/78/150 px diskalakan ke lebar halaman, tinggi baris mengikuti template.
 *   Lembar 1: data memo, jenis dan referensi, kondisi aktual dan seharusnya, tanda tangan Tahap I.
 *   Lembar 2: usulan tindak lanjut PJ, pemeriksaan lanjutan (II), tanda tangan Tahap II.
 *   Lembar 3: dokumentasi, foto Before di kiri dan After di kanan.
 * Bagian yang belum terisi dibiarkan kosong (PDF "Before" tidak punya tindak lanjut, pemeriksaan, foto After, dan tanda tangan PJ). */
(function (root) {
  'use strict';

  var PW = 210, PH = 297, ML = 17.8, MT = 19, MB = 18;
  var CUM = [0, 120, 445, 523, 673, 751, 901];          // batas kolom A..F dalam px template
  var K = (PW - 2 * ML) / 901;                          // mm per px template
  var GARIS = 0.25;
  /* tinggi baris (px template) yang diubah dari template asli supaya teks panjang tidak terpotong */
  var R_DETAIL = 44, R_AJU = 100, R_KOND = 460;

  var JENIS = [['Kualitas', 'Kualitas'], ['Material', 'Material'], ['Dimensi & Posisi (X,Y,Z)', 'Dimensi & Posisi (X,Y,Z)'], ['Lainnya', 'Lainnya']];
  var REFERENSI = ['KPPK', 'RKS', 'Material yang disetujui', 'BQ', 'Drawing', 'Metoda Kerja/ WI/SOP', 'Spesifikasi'];
  var SLOT_NAMA = { MK1: 'MK1', PJ1: 'PJ1', MK2: 'MK2', PJ2: 'PJ2' };

  function s(v) { return v == null ? '' : String(v); }
  function bangun(JsPDF, d) {
    d = d || {};
    var doc = new JsPDF({ unit: 'mm', format: 'a4' });
    var y = MT;
    var ttd = d.ttd || {};
    var fotoB = d.fotoBefore || [], fotoA = d.fotoAfter || [];

    function X(c) { return ML + CUM[c] * K; }
    function H(px) { return px * K; }
    function ink() { doc.setTextColor(20, 20, 20); }
    function garis() { doc.setDrawColor(20, 20, 20); doc.setLineWidth(GARIS); }
    function font(ukuran, tebal) { doc.setFont('helvetica', tebal ? 'bold' : 'normal'); doc.setFontSize(ukuran); }
    function lh(ukuran) { return ukuran * 0.3528 * 1.22; }

    /* Teks diperkecil (sampai 6,5 pt) bila tidak muat di kotak. Mengembalikan baris yang dipakai. */
    function muat(teks, lebar, tinggi, ukuran, tebal) {
      var uk = ukuran, baris;
      for (;;) {
        font(uk, tebal);
        baris = doc.splitTextToSize(s(teks), lebar);
        if (baris.length * lh(uk) <= tinggi || uk <= 6.5) break;
        uk -= 0.5;
      }
      return { baris: baris, uk: uk };
    }

    /* Kotak sel dari kolom c0 sampai c1 (batas kanan), tinggi dalam px template. */
    function sel(c0, c1, yy, hpx, o) {
      o = o || {};
      var x = X(c0), w = X(c1) - X(c0), h = H(hpx);
      if (o.isi) { doc.setFillColor(o.isi[0], o.isi[1], o.isi[2]); doc.rect(x, yy, w, h, 'F'); }
      if (o.garis !== false) { garis(); doc.rect(x, yy, w, h); }
      if (o.teks != null && s(o.teks) !== '') {
        var pad = o.pad == null ? 1.6 : o.pad, uk = o.ukuran || 9;
        var m = muat(o.teks, w - 2 * pad, h - 2 * pad + 0.6, uk, o.tebal);
        font(m.uk, o.tebal); ink();
        var tinggiTeks = m.baris.length * lh(m.uk);
        var ty = o.atas ? yy + pad + m.uk * 0.3528 * 0.85 : yy + (h - tinggiTeks) / 2 + m.uk * 0.3528 * 0.85;
        var tx = o.tengah ? x + w / 2 : x + pad;
        doc.text(m.baris, tx, ty, { align: o.tengah ? 'center' : 'left', lineHeightFactor: 1.22 });
      }
      return { x: x, y: yy, w: w, h: h };
    }

    function kotakCentang(cx, cy, tanda) {
      var u = 3.4;
      garis(); doc.rect(cx - u / 2, cy - u / 2, u, u);
      if (tanda) { doc.setLineWidth(0.5); doc.line(cx - 1.2, cy, cx - 0.3, cy + 1.1); doc.line(cx - 0.3, cy + 1.1, cx + 1.4, cy - 1.3); garis(); }
    }

    function gambar(im, x, yy, w, h) {
      if (!im || !im.url) return;
      var sc = Math.min((w - 1) / im.w, (h - 1) / im.h), gw = im.w * sc, gh = im.h * sc;
      var fmt = /^data:image\/png/i.test(im.url) ? 'PNG' : 'JPEG';
      doc.addImage(im.url, fmt, x + (w - gw) / 2, yy + (h - gh) / 2, gw, gh);
    }

    /* Tanda tangan: gambar di tengah kotak, keterangan elektronik di bawah. */
    function tandaTangan(slot, c0, c1, yy, hpx) {
      var t = ttd[SLOT_NAMA[slot]];
      if (!t) return;
      var x = X(c0), w = X(c1) - X(c0), h = H(hpx);
      if (t.img) gambar(t.img, x + w * 0.12, yy + 1, w * 0.76, h - 7);
      font(6.5, false); doc.setTextColor(95, 95, 95);
      var ket = 'Disahkan secara elektronik' + (t.waktu ? ', ' + t.waktu : '') + (t.pengganti ? ' (oleh ' + t.pengganti + ')' : '');
      doc.text(doc.splitTextToSize(ket, w - 4), x + w / 2, yy + h - 3.2, { align: 'center' });
      ink();
    }

    function kepalaLanjutan() {
      font(8, false); doc.setTextColor(95, 95, 95);
      doc.text('SITE MEMO  No. ' + s(d.noMemo || '(belum bernomor)'), ML, 12);
      ink();
    }

    /* ===================== LEMBAR 1 ===================== */
    sel(0, 6, y, 39, { teks: 'SITE MEMO', tebal: true, ukuran: 15, tengah: true }); y += H(39);
    var y0 = y;
    sel(0, 2, y0, 78, {});                                  // blok kiri (ruang logo)
    sel(2, 3, y0, 36, {});
    sel(3, 4, y0, 36, { teks: 'No.', tebal: true });
    sel(4, 6, y0, 36, { teks: d.noMemo || '', tebal: true });
    sel(2, 3, y0 + H(36), 36, {});
    sel(3, 4, y0 + H(36), 36, { teks: 'Tgl Pengajuan', tebal: true });
    sel(4, 6, y0 + H(36), 36, { teks: d.tglPengajuan });
    y += H(78) + H(12);

    sel(0, 1, y, 39, { teks: 'No. Kontrak', tebal: true }); sel(1, 2, y, 39, { teks: d.noKontrak });
    sel(2, 4, y, 39, { teks: 'Nama Paket', tebal: true }); sel(4, 6, y, 78, { teks: d.namaPaket });
    sel(0, 1, y + H(39), 39, { teks: 'Tgl Kontrak', tebal: true }); sel(1, 2, y + H(39), 39, { teks: d.tglKontrak });
    sel(2, 4, y + H(39), 39, {});
    y += H(78);

    sel(0, 2, y, 21, { teks: 'Detail Data Ketidaksesuaian', tebal: true, isi: [232, 232, 236] });
    sel(2, 4, y, 21, { teks: 'Jenis Ketidaksesuaian', tebal: true, isi: [232, 232, 236] });
    sel(4, 6, y, 21, { teks: 'Referensi', tebal: true, isi: [232, 232, 236] });
    y += H(21);

    var kiri = [['Nama Proyek', d.namaProyek], ['Bidang', d.bidang], ['Kegiatan', d.kegiatan], ['Lokasi', d.lokasi], ['Info Lainnya', d.info || '-'], ['', ''], ['', '']];
    var jenis = d.jenis || [], ref = d.referensi || [];
    for (var i = 0; i < 7; i++) {
      var ry = y + i * H(R_DETAIL);
      sel(0, 1, ry, R_DETAIL, { teks: kiri[i][0], tebal: true });
      sel(1, 2, ry, R_DETAIL, { teks: kiri[i][1], atas: true, pad: 1.2, ukuran: 8.5 });
      if (i < 4) {
        sel(2, 3, ry, R_DETAIL, {});
        kotakCentang(X(2) + (X(3) - X(2)) / 2, ry + H(R_DETAIL) / 2, jenis.indexOf(JENIS[i][1]) > -1);
        sel(3, 4, ry, R_DETAIL, { teks: i === 3 ? 'Lainnya: ' + s(d.jenisLainnya) : JENIS[i][0], ukuran: 8.5 });
      } else sel(2, 4, ry, R_DETAIL, {});
      sel(4, 5, ry, R_DETAIL, {});
      kotakCentang(X(4) + (X(5) - X(4)) / 2, ry + H(R_DETAIL) / 2, ref.indexOf(REFERENSI[i]) > -1);
      sel(5, 6, ry, R_DETAIL, { teks: REFERENSI[i], ukuran: 8.5 });
    }
    y += 7 * H(R_DETAIL);

    sel(0, 6, y, 21, { teks: 'Uraian Ketidaksesuaian oleh Manajemen Konstruksi', tebal: true, isi: [232, 232, 236] }); y += H(21);
    sel(0, 2, y, 21, { teks: 'Kondisi Aktual', tebal: true }); sel(2, 6, y, 21, { teks: 'Kondisi Seharusnya', tebal: true }); y += H(21);
    sel(0, 2, y, R_KOND, { teks: d.kondisiAktual, atas: true }); sel(2, 6, y, R_KOND, { teks: d.kondisiSeharusnya, atas: true }); y += H(R_KOND) + H(10);

    function blokTandaTangan(slotMk, slotPj, hTtd, namaMk, namaPj, tglMk, tglPj) {
      sel(0, 2, y, R_AJU, { teks: 'Diajukan Oleh :\nKonsultan Manajemen Konstruksi\n' + s(d.konsultanMk), atas: true, ukuran: 8.5, pad: 1.2 });
      sel(2, 6, y, R_AJU, { teks: 'Diterima Oleh :\nPenyedia Jasa Kontraktor\n' + s(d.kontraktor), atas: true, ukuran: 8.5, pad: 1.2 });
      y += H(R_AJU);
      sel(0, 2, y, hTtd, {}); sel(2, 6, y, hTtd, {});
      tandaTangan(slotMk, 0, 2, y, hTtd); tandaTangan(slotPj, 2, 6, y, hTtd);
      y += H(hTtd);
      sel(0, 2, y, 21, { teks: 'Nama   : ' + s(namaMk) }); sel(2, 6, y, 21, { teks: 'Nama   : ' + s(namaPj) }); y += H(21);
      sel(0, 2, y, 21, { teks: 'Tanggal : ' + s(tglMk) }); sel(2, 6, y, 21, { teks: 'Tanggal : ' + s(tglPj) }); y += H(21);
    }
    var t = ttd;
    blokTandaTangan('MK1', 'PJ1', 112,
      (t.MK1 && t.MK1.nama) || d.diajukanNama, t.PJ1 && t.PJ1.nama,
      (t.MK1 && t.MK1.tanggal) || d.tglPengajuan, t.PJ1 && t.PJ1.tanggal);

    /* ===================== LEMBAR 2 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    sel(0, 6, y, 21, { teks: 'Usulan Rencana Tindak Lanjut oleh Penyedia Jasa/Kontraktor', tebal: true, isi: [232, 232, 236] }); y += H(21);
    sel(0, 6, y, 307, { teks: d.tindakLanjut, atas: true }); y += H(307);
    sel(0, 6, y, 21, { teks: 'Pemeriksaan Lanjutan (II)', tebal: true, isi: [232, 232, 236] }); y += H(21);
    var p = d.pemeriksaan || {};
    var rb = sel(0, 6, y, 47, {});
    font(9, false); ink();
    var cy = rb.y + rb.h / 2;
    doc.text('Pemeriksaan Setelah Tindak Lanjut', rb.x + 1.6, cy + 1.2);
    var cx0 = rb.x + 62;
    kotakCentang(cx0, cy, p.hasil === 'Diterima'); doc.text('Diterima', cx0 + 3, cy + 1.2);
    kotakCentang(cx0 + 28, cy, p.hasil === 'Ditolak' || p.hasil === 'Tidak Diterima'); doc.text('Tidak Diterima', cx0 + 31, cy + 1.2);
    doc.text('Tanggal : ' + s(p.tanggal), cx0 + 64, cy + 1.2);
    y += H(47);
    sel(0, 6, y, 292, { teks: 'Catatan : ' + s(p.catatan), atas: true }); y += H(292);
    blokTandaTangan('MK2', 'PJ2', 149,
      t.MK2 && t.MK2.nama, t.PJ2 && t.PJ2.nama, t.MK2 && t.MK2.tanggal, t.PJ2 && t.PJ2.tanggal);

    /* ===================== LEMBAR 3 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    sel(0, 6, y, 24, { teks: 'DOKUMENTASI SITE MEMO', tebal: true, tengah: true, isi: [232, 232, 236], ukuran: 10 }); y += H(24);
    var info = [['No.', d.noMemo, 'Tgl Pengajuan', d.tglPengajuan], ['Nama Proyek', d.namaProyek, 'Kepada Yth', 'Site Manager'], ['Bidang', d.bidang, 'Kontraktor', d.kontraktor], ['Kegiatan', d.kegiatan, '', ''], ['Lokasi', d.lokasi, '', '']];
    for (var r = 0; r < info.length; r++) {
      var iy = y + r * H(26);
      sel(0, 1, iy, 26, { teks: info[r][0], tebal: true, ukuran: 8.5 });
      if (info[r][2]) {
        sel(1, 3, iy, 26, { teks: info[r][1], ukuran: 8 });
        sel(3, 4, iy, 26, { teks: info[r][2], tebal: true, ukuran: 8.5 }); sel(4, 6, iy, 26, { teks: info[r][3], ukuran: 8 });
      } else sel(1, 6, iy, 26, { teks: info[r][1], ukuran: 8 });
    }
    y += 5 * H(26);
    sel(0, 2, y, 21, { teks: 'BEFORE', tebal: true, tengah: true, isi: [232, 232, 236] }); sel(2, 6, y, 21, { teks: 'AFTER', tebal: true, tengah: true, isi: [232, 232, 236] }); y += H(21);
    for (var f = 0; f < 4; f++) {
      var fy = y + f * H(210), a = sel(0, 2, fy, 210, {}), b = sel(2, 6, fy, 210, {});
      if (fotoB[f]) gambar(fotoB[f], a.x, a.y, a.w, a.h);
      if (fotoA[f]) gambar(fotoA[f], b.x, b.y, b.w, b.h);
    }

    /* nomor halaman */
    var n = doc.getNumberOfPages();
    for (var pg = 1; pg <= n; pg++) {
      doc.setPage(pg); font(7.5, false); doc.setTextColor(95, 95, 95);
      doc.text('Halaman ' + pg + ' dari ' + n, PW - ML, PH - MB + 8, { align: 'right' });
    }
    ink();
    return doc;
  }

  var api = { bangun: bangun };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MEMOPDF = api;
})(typeof window !== 'undefined' ? window : this);
