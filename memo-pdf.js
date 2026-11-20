/* Pembuat PDF Site Memo (A4, 3 lembar) dengan jsPDF. Tanpa DOM: jalan di browser (global MEMOPDF) dan di Node (module.exports), supaya bisa diuji otomatis.
 * Tata letak mengikuti sheet TEMPLATE_MEMO di Site Memo (lebar kolom 120/325/78/150/78/150 px diskalakan ke lebar halaman) dan tampilan PDF contoh
 * (header navy, bar biru muda, tanda centang tanpa kotak, logo Owner, KSO MK, KSO PJ di kiri atas).
 *   Lembar 1: data memo, jenis dan referensi, kondisi aktual dan seharusnya, tanda tangan Tahap I.
 *   Lembar 2: usulan tindak lanjut PJ, pemeriksaan lanjutan (II), tanda tangan Tahap II.
 *   Lembar 3: dokumentasi, foto Before di kiri dan After di kanan.
 * Bagian yang belum terisi dibiarkan kosong (PDF "Before" tidak punya tindak lanjut, pemeriksaan, foto After, dan tanda tangan PJ). */
(function (root) {
  'use strict';

  var PW = 210, PH = 297, ML = 17.8, MT = 19, MB = 18;
  var CUM = [0, 120, 445, 523, 673, 751, 901];          // batas kolom A..F dalam px template
  var K = (PW - 2 * ML) / 901;                          // mm per px template
  var NAVY = [31, 42, 68], BIRU = [217, 225, 242], ABU = [242, 242, 242];
  /* tinggi baris (px template) yang diubah dari template asli supaya teks panjang tidak terpotong */
  var R_DETAIL = 44, R_AJU = 100, R_KOND = 460, R_TTD1 = 112, R_TTD2 = 149;

  var JENIS = ['Kualitas', 'Material', 'Dimensi & Posisi (X,Y,Z)', 'Lainnya'];
  var REFERENSI = ['KPPK', 'RKS', 'Material yang disetujui', 'BQ', 'Drawing', 'Metoda Kerja/ WI/SOP', 'Spesifikasi'];

  function s(v) { return v == null ? '' : String(v); }

  function bangun(JsPDF, d) {
    d = d || {};
    var doc = new JsPDF({ unit: 'mm', format: 'a4' });
    var y = MT;
    var ttd = d.ttd || {}, logo = d.logo || {};
    var fotoB = d.fotoBefore || [], fotoA = d.fotoAfter || [];

    function X(c) { return ML + CUM[c] * K; }
    function H(px) { return px * K; }
    function ink() { doc.setTextColor(20, 20, 20); }
    function garis() { doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.25); }
    function font(ukuran, tebal) { doc.setFont('helvetica', tebal ? 'bold' : 'normal'); doc.setFontSize(ukuran); }
    function lh(ukuran) { return ukuran * 0.3528 * 1.22; }

    /* Teks diperkecil (sampai 6,5 pt) bila tidak muat di kotak. */
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

    /* Teks di dalam sel dari kolom c0 sampai c1 (batas kanan), tinggi dalam px template. Tanpa garis. */
    function sel(c0, c1, yy, hpx, o) {
      o = o || {};
      var x = X(c0), w = X(c1) - X(c0), h = H(hpx);
      if (o.isi) { doc.setFillColor(o.isi[0], o.isi[1], o.isi[2]); doc.rect(x, yy, w, h, 'F'); }
      if (o.teks != null && s(o.teks) !== '') {
        var pad = o.pad == null ? 1.6 : o.pad, uk = o.ukuran || 9;
        var m = muat(o.teks, w - 2 * pad, h - 2 * pad + 0.6, uk, o.tebal);
        font(m.uk, o.tebal);
        if (o.putih) doc.setTextColor(255, 255, 255); else ink();
        var tinggiTeks = m.baris.length * lh(m.uk);
        var ty = o.atas ? yy + pad + m.uk * 0.3528 * 0.85 : yy + (h - tinggiTeks) / 2 + m.uk * 0.3528 * 0.85;
        var tx = o.tengah ? x + w / 2 : (o.kanan ? x + w - pad : x + pad);
        doc.text(m.baris, tx, ty, { align: o.tengah ? 'center' : (o.kanan ? 'right' : 'left'), lineHeightFactor: 1.22 });
        ink();
      }
    }
    function bar(yy, hpx, isi, kolom) {              // bar berwarna sepanjang lebar; kolom: [[c0, c1, teks], ...]
      sel(0, 6, yy, hpx, { isi: isi });
      kolom.forEach(function (k) { sel(k[0], k[1], yy, hpx, { teks: k[2], tebal: true, tengah: true, ukuran: k[3] || 8.5, putih: isi === NAVY }); });
    }
    function bingkai(c0, c1, yy, hpx) { garis(); doc.rect(X(c0), yy, X(c1) - X(c0), H(hpx)); }
    function vgaris(c, yy, hpx) { garis(); doc.line(X(c), yy, X(c), yy + H(hpx)); }
    function hgaris(c0, c1, yy) { garis(); doc.line(X(c0), yy, X(c1), yy); }

    function centang(cx, cy) {
      doc.setLineWidth(0.55); doc.setDrawColor(20, 20, 20);
      doc.line(cx - 1.4, cy + 0.1, cx - 0.4, cy + 1.3); doc.line(cx - 0.4, cy + 1.3, cx + 1.6, cy - 1.5); garis();
    }
    function kotakCentang(cx, cy, tanda) {
      var u = 3.4; garis(); doc.rect(cx - u / 2, cy - u / 2, u, u);
      if (tanda) centang(cx, cy);
    }

    function gambar(im, x, yy, w, h) {
      if (!im || !im.url) return;
      var sc = Math.min((w - 1) / im.w, (h - 1) / im.h), gw = im.w * sc, gh = im.h * sc;
      var fmt = /^data:image\/png/i.test(im.url) ? 'PNG' : 'JPEG';
      doc.addImage(im.url, fmt, x + (w - gw) / 2, yy + (h - gh) / 2, gw, gh);
    }

    /* Tiga logo berjajar di blok kiri: Owner, KSO MK, KSO PJ. Tinggi sama, lebar menurut rasio; diperkecil bila tidak muat. */
    function logoBlok(c0, c1, yy, hpx) {
      var ada = [logo.owner, logo.mk, logo.pj].filter(function (l) { return l && l.url; });
      if (!ada.length) return;
      var tinggi = H(hpx) - 4, jarak = 2.5, lebarBlok = X(c1) - X(c0) - 4;
      var lebar = ada.map(function (l) { return l.w * tinggi / l.h; });
      var total = lebar.reduce(function (a, b) { return a + b; }, 0) + jarak * (ada.length - 1);
      var sk = total > lebarBlok ? lebarBlok / total : 1;
      var x = X(c0) + 2 + (lebarBlok - total * sk) / 2, ty = yy + 2 + tinggi * (1 - sk) / 2;
      ada.forEach(function (l, i) {
        var w = lebar[i] * sk, h = tinggi * sk, fmt = /^data:image\/png/i.test(l.url) ? 'PNG' : 'JPEG';
        doc.addImage(l.url, fmt, x, ty, w, h); x += w + jarak * sk;
      });
    }

    /* Tanda tangan: gambar di tengah kotak, keterangan elektronik di bawah. */
    function tandaTangan(slot, c0, c1, yy, hpx) {
      var t = ttd[slot];
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

    /* Blok tanda tangan satu bingkai: tulisan Diajukan/Diterima, ruang tanda tangan, Nama, Tanggal. */
    function blokTandaTangan(slotMk, slotPj, hTtd, namaMk, namaPj, tglMk, tglPj) {
      var total = R_AJU + hTtd + 42;
      bingkai(0, 6, y, total); vgaris(2, y, total);
      sel(0, 2, y, R_AJU, { teks: 'Diajukan Oleh :\nKonsultan Manajemen Konstruksi\n' + s(d.konsultanMk), atas: true, ukuran: 8.5, pad: 1.2 });
      sel(2, 6, y, R_AJU, { teks: 'Diterima Oleh :\nPenyedia Jasa Kontraktor\n' + s(d.kontraktor), atas: true, ukuran: 8.5, pad: 1.2 });
      var yt = y + H(R_AJU);
      tandaTangan(slotMk, 0, 2, yt, hTtd); tandaTangan(slotPj, 2, 6, yt, hTtd);
      var yn = yt + H(hTtd);
      sel(0, 2, yn, 21, { teks: 'Nama   : ' + s(namaMk), ukuran: 8.5 }); sel(2, 6, yn, 21, { teks: 'Nama   : ' + s(namaPj), ukuran: 8.5 });
      sel(0, 2, yn + H(21), 21, { teks: 'Tanggal : ' + s(tglMk), ukuran: 8.5 }); sel(2, 6, yn + H(21), 21, { teks: 'Tanggal : ' + s(tglPj), ukuran: 8.5 });
      y += H(total);
    }

    /* ===================== LEMBAR 1 ===================== */
    bar(y, 40, NAVY, [[0, 6, 'SITE MEMO', 12]]); y += H(40);

    bingkai(0, 6, y, 78); vgaris(2, y, 78);
    logoBlok(0, 2, y, 78);
    sel(3, 4, y, 36, { teks: 'No.', tebal: true }); sel(4, 6, y, 36, { teks: d.noMemo, ukuran: 8.5 });
    sel(3, 4, y + H(36), 36, { teks: 'Tgl Pengajuan', tebal: true }); sel(4, 6, y + H(36), 36, { teks: d.tglPengajuan, kanan: true });
    y += H(78);

    bingkai(0, 6, y, 78); vgaris(2, y, 78);
    sel(0, 1, y, 39, { teks: 'No. Kontrak', tebal: true }); sel(1, 2, y, 39, { teks: d.noKontrak });
    sel(3, 4, y, 39, { teks: 'Nama Paket', tebal: true }); sel(4, 6, y, 78, { teks: d.namaPaket, atas: true, ukuran: 8.5, pad: 2.2 });
    sel(0, 1, y + H(39), 39, { teks: 'Tgl Kontrak', tebal: true }); sel(1, 2, y + H(39), 39, { teks: d.tglKontrak });
    y += H(78);

    bar(y, 21, BIRU, [[0, 2, 'Detail Data Ketidaksesuaian'], [2, 4, 'Jenis Ketidaksesuaian'], [4, 6, 'Referensi']]); y += H(21);

    var kiri = [['Nama Proyek', d.namaProyek], ['Bidang', d.bidang], ['Kegiatan', d.kegiatan], ['Lokasi', d.lokasi], ['Info Lainnya', d.info || '-'], ['', ''], ['', '']];
    var jenis = d.jenis || [], ref = d.referensi || [];
    bingkai(0, 6, y, 7 * R_DETAIL); vgaris(2, y, 7 * R_DETAIL); vgaris(4, y, 7 * R_DETAIL);
    for (var i = 0; i < 7; i++) {
      var ry = y + i * H(R_DETAIL), cy = ry + H(R_DETAIL) / 2;
      sel(0, 1, ry, R_DETAIL, { teks: kiri[i][0], tebal: true, ukuran: 8.5 });
      sel(1, 2, ry, R_DETAIL, { teks: kiri[i][1], atas: true, pad: 1.2, ukuran: 8.5 });
      if (i < 4) {
        if (jenis.indexOf(JENIS[i]) > -1) centang(X(2) + (X(3) - X(2)) / 2, cy);
        sel(3, 4, ry, R_DETAIL, { teks: i === 3 ? 'Lainnya: ' + s(d.jenisLainnya) : JENIS[i], ukuran: 8.5 });
      }
      if (ref.indexOf(REFERENSI[i]) > -1) centang(X(4) + (X(5) - X(4)) / 2, cy);
      sel(5, 6, ry, R_DETAIL, { teks: REFERENSI[i], ukuran: 8.5 });
    }
    y += 7 * H(R_DETAIL);

    bar(y, 21, BIRU, [[0, 6, 'Uraian Ketidaksesuaian oleh Manajemen Konstruksi']]); y += H(21);
    bar(y, 21, ABU, [[0, 2, 'Kondisi Aktual'], [2, 6, 'Kondisi Seharusnya']]); y += H(21);
    bingkai(0, 6, y, R_KOND); vgaris(2, y, R_KOND);
    sel(0, 2, y, R_KOND, { teks: d.kondisiAktual, atas: true, ukuran: 8.5 }); sel(2, 6, y, R_KOND, { teks: d.kondisiSeharusnya, atas: true, ukuran: 8.5 });
    y += H(R_KOND) + H(8);

    var t = ttd;
    blokTandaTangan('MK1', 'PJ1', R_TTD1,
      (t.MK1 && t.MK1.nama) || d.diajukanNama, t.PJ1 && t.PJ1.nama,
      (t.MK1 && t.MK1.tanggal) || d.tglPengajuan, t.PJ1 && t.PJ1.tanggal);

    /* ===================== LEMBAR 2 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    bar(y, 21, BIRU, [[0, 6, 'Usulan Rencana Tindak Lanjut oleh Penyedia Jasa/Kontraktor']]); y += H(21);
    bingkai(0, 6, y, 307);
    sel(0, 6, y, 307, { teks: d.tindakLanjut, atas: true, ukuran: 8.5 }); y += H(307) + H(8);
    bar(y, 21, BIRU, [[0, 6, 'Pemeriksaan Lanjutan (II)']]); y += H(21);
    var p = d.pemeriksaan || {};
    bingkai(0, 6, y, 47 + 292);
    var rb = { x: X(0), y: y, h: H(47) };
    font(8.5, false); ink();
    var cyp = rb.y + rb.h / 2;
    doc.text('Pemeriksaan Setelah Tindak Lanjut', rb.x + 1.6, cyp + 1.2);
    var cx0 = rb.x + 62;
    kotakCentang(cx0, cyp, p.hasil === 'Diterima'); doc.text('Diterima', cx0 + 3, cyp + 1.2);
    kotakCentang(cx0 + 28, cyp, p.hasil === 'Ditolak' || p.hasil === 'Tidak Diterima'); doc.text('Tidak Diterima', cx0 + 31, cyp + 1.2);
    doc.text('Tanggal : ' + s(p.tanggal), cx0 + 64, cyp + 1.2);
    sel(0, 6, y + H(47), 292, { teks: 'Catatan : ' + s(p.catatan), atas: true, ukuran: 8.5 });
    y += H(47 + 292) + H(8);
    blokTandaTangan('MK2', 'PJ2', R_TTD2,
      t.MK2 && t.MK2.nama, t.PJ2 && t.PJ2.nama, t.MK2 && t.MK2.tanggal, t.PJ2 && t.PJ2.tanggal);

    /* ===================== LEMBAR 3 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    bar(y, 30, NAVY, [[0, 6, 'DOKUMENTASI SITE MEMO', 11]]); y += H(30);
    var info = [['No.', d.noMemo, 'Tgl Pengajuan', d.tglPengajuan], ['Nama Proyek', d.namaProyek, 'Kepada Yth', 'Site Manager'], ['Bidang', d.bidang, 'Kontraktor', d.kontraktor], ['Kegiatan', d.kegiatan, '', ''], ['Lokasi', d.lokasi, '', '']];
    bingkai(0, 6, y, 5 * 26);
    for (var r = 0; r < info.length; r++) {
      var iy = y + r * H(26);
      sel(0, 1, iy, 26, { teks: info[r][0], tebal: true, ukuran: 8.5 });
      if (info[r][2]) {
        sel(1, 3, iy, 26, { teks: info[r][1], ukuran: 8 });
        sel(3, 4, iy, 26, { teks: info[r][2], tebal: true, ukuran: 8.5 }); sel(4, 6, iy, 26, { teks: info[r][3], ukuran: 8, kanan: true });
      } else sel(1, 6, iy, 26, { teks: info[r][1], ukuran: 8 });
    }
    y += 5 * H(26);
    bar(y, 21, BIRU, [[0, 2, 'BEFORE'], [2, 6, 'AFTER']]); y += H(21);
    bingkai(0, 6, y, 4 * 210); vgaris(2, y, 4 * 210);
    for (var f = 0; f < 4; f++) {
      var fy = y + f * H(210);
      if (f) hgaris(0, 6, fy);
      if (fotoB[f]) gambar(fotoB[f], X(0), fy, X(2) - X(0), H(210));
      if (fotoA[f]) gambar(fotoA[f], X(2), fy, X(6) - X(2), H(210));
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
