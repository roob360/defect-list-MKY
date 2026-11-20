/* Pembuat PDF Site Memo (A4, 3 lembar) dengan jsPDF. Tanpa DOM: jalan di browser (global MEMOPDF) dan di Node (module.exports), supaya bisa diuji otomatis.
 * Tata letak mengikuti sheet TEMPLATE_MEMO di Site Memo (lebar kolom 120/325/78/150/78/150 px diskalakan ke lebar halaman) dan tampilan PDF contoh
 * (header navy, bar biru muda, tanda centang tanpa kotak, logo Owner, KSO MK, KSO PJ di kiri atas).
 *   Lembar 1: data memo, jenis dan referensi, kondisi aktual dan seharusnya, tanda tangan Tahap I.
 *   Lembar 2: usulan tindak lanjut PJ, pemeriksaan lanjutan (II), tanda tangan Tahap II.
 *   Lembar 3: dokumentasi, foto Before di kiri dan After di kanan.
 * Huruf seragam: judul besar 12 pt, isi dan label 8,5 pt (label tebal), keterangan kecil 7 pt. Tinggi baris menyesuaikan isi, huruf tidak diperkecil.
 * Bagian yang belum terisi dibiarkan kosong (PDF "Before" tidak punya tindak lanjut, pemeriksaan, foto After, dan tanda tangan PJ). */
(function (root) {
  'use strict';

  var PW = 210, PH = 297, ML = 17.8, MT = 19, MB = 18;
  var CUM = [0, 120, 445, 523, 673, 751, 901];          // batas kolom A..F dalam px template
  var K = (PW - 2 * ML) / 901;                          // mm per px template
  var NAVY = [31, 42, 68], BIRU = [217, 225, 242], ABU = [242, 242, 242];
  var UK_JUDUL = 12, UK = 8.5, UK_KECIL = 7;            // ukuran huruf (pt)
  var R_TTD1 = 112, R_TTD2 = 149;                       // tinggi ruang tanda tangan (px template)

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

    /* Pemenggalan baris: putus di spasi atau setelah "/" (nomor memo tidak terpotong di tengah kata). Font sudah harus terpasang. */
    function bungkus(teks, lebar) {
      var hasil = [];
      function simpan(b) { doc.splitTextToSize(b.replace(/ +$/, ''), lebar).forEach(function (x) { hasil.push(x); }); }   // token tunggal yang melebihi lebar dipotong
      s(teks).split('\n').forEach(function (para) {
        var token = para.match(/[^ \/]*[ \/]|[^ \/]+$/g) || [''], baris = '';
        token.forEach(function (tk) {
          var cobaan = baris + tk;
          if (baris && doc.getTextWidth(cobaan.replace(/ +$/, '')) > lebar) { simpan(baris); baris = tk; }
          else baris = cobaan;
        });
        simpan(baris);
      });
      return hasil;
    }

    /* Tinggi (px template) yang dibutuhkan teks di sel kolom c0..c1 pada ukuran UK. */
    function butuh(teks, c0, c1, pad, tebal) {
      font(UK, tebal);
      var n = bungkus(teks, X(c1) - X(c0) - 2 * pad).length;
      return (n * lh(UK) + 2 * pad + 0.4) / K;
    }

    /* Teks di dalam sel dari kolom c0 sampai c1 (batas kanan), tinggi dalam px template. Tanpa garis. Huruf tidak diperkecil
     * kecuali isi bebas yang melebihi kotak (kondisi, tindak lanjut, catatan): paling kecil 6,5 pt supaya tidak terpotong. */
    function sel(c0, c1, yy, hpx, o) {
      o = o || {};
      var x = X(c0), w = X(c1) - X(c0), h = H(hpx);
      if (o.isi) { doc.setFillColor(o.isi[0], o.isi[1], o.isi[2]); doc.rect(x, yy, w, h, 'F'); }
      if (o.teks != null && s(o.teks) !== '') {
        var pad = o.pad == null ? 1.6 : o.pad, uk = o.ukuran || UK, baris;
        for (;;) {
          font(uk, o.tebal);
          baris = bungkus(o.teks, w - 2 * pad);
          if (!o.bebas || baris.length * lh(uk) <= h - 2 * pad || uk <= 6.5) break;
          uk -= 0.5;
        }
        if (o.putih) doc.setTextColor(255, 255, 255); else ink();
        var tinggiTeks = baris.length * lh(uk);
        var ty = o.atas ? yy + pad + uk * 0.3528 * 0.85 : yy + (h - tinggiTeks) / 2 + uk * 0.3528 * 0.85;
        var tx = o.tengah ? x + w / 2 : (o.kanan ? x + w - pad : x + pad);
        doc.text(baris, tx, ty, { align: o.tengah ? 'center' : (o.kanan ? 'right' : 'left'), lineHeightFactor: 1.22 });
        ink();
      }
    }
    function bar(yy, hpx, isi, kolom, ukuran) {      // bar berwarna sepanjang lebar; kolom: [[c0, c1, teks], ...]
      sel(0, 6, yy, hpx, { isi: isi });
      kolom.forEach(function (k) { sel(k[0], k[1], yy, hpx, { teks: k[2], tebal: true, tengah: true, ukuran: ukuran || UK, putih: isi === NAVY }); });
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
      font(UK_KECIL, false); doc.setTextColor(95, 95, 95);
      var ket = 'Disahkan secara elektronik' + (t.waktu ? ', ' + t.waktu : '') + (t.pengganti ? ' (oleh ' + t.pengganti + ')' : '');
      doc.text(doc.splitTextToSize(ket, w - 4), x + w / 2, yy + h - 3.2, { align: 'center' });
      ink();
    }

    function kepalaLanjutan() {
      font(UK_KECIL, false); doc.setTextColor(95, 95, 95);
      doc.text('SITE MEMO  No. ' + s(d.noMemo || '(belum bernomor)'), ML, 12);
      ink();
    }

    /* Blok tanda tangan satu bingkai: tulisan Diajukan/Diterima, ruang tanda tangan, Nama, Tanggal. */
    function teksAju() { return ['Diajukan Oleh :\nKonsultan Manajemen Konstruksi\n' + s(d.konsultanMk), 'Diterima Oleh :\nPenyedia Jasa Kontraktor\n' + s(d.kontraktor)]; }
    function tinggiAju() { var a = teksAju(); return Math.max(60, butuh(a[0], 0, 2, 1.2), butuh(a[1], 2, 6, 1.2)); }
    function tinggiBlokTtd(hTtd) { return tinggiAju() + hTtd + 42; }
    function blokTandaTangan(slotMk, slotPj, hTtd, namaMk, namaPj, tglMk, tglPj) {
      var hAju = tinggiAju(), total = hAju + hTtd + 42, a = teksAju();
      bingkai(0, 6, y, total); vgaris(2, y, total);
      sel(0, 2, y, hAju, { teks: a[0], atas: true, pad: 1.2 });
      sel(2, 6, y, hAju, { teks: a[1], atas: true, pad: 1.2 });
      var yt = y + H(hAju);
      tandaTangan(slotMk, 0, 2, yt, hTtd); tandaTangan(slotPj, 2, 6, yt, hTtd);
      var yn = yt + H(hTtd);
      sel(0, 2, yn, 21, { teks: 'Nama   : ' + s(namaMk) }); sel(2, 6, yn, 21, { teks: 'Nama   : ' + s(namaPj) });
      sel(0, 2, yn + H(21), 21, { teks: 'Tanggal : ' + s(tglMk) }); sel(2, 6, yn + H(21), 21, { teks: 'Tanggal : ' + s(tglPj) });
      y += H(total);
    }

    /* ===================== LEMBAR 1 ===================== */
    bar(y, 40, NAVY, [[0, 6, 'SITE MEMO']], UK_JUDUL); y += H(40);

    var hNo = Math.max(36, butuh(d.noMemo, 4, 6, 1.6)), h1 = Math.max(78, hNo + 36);
    bingkai(0, 6, y, h1); vgaris(2, y, h1);
    logoBlok(0, 2, y, h1);
    sel(3, 4, y, hNo, { teks: 'No.', tebal: true }); sel(4, 6, y, hNo, { teks: d.noMemo });
    sel(3, 4, y + H(hNo), h1 - hNo, { teks: 'Tgl Pengajuan', tebal: true }); sel(4, 6, y + H(hNo), h1 - hNo, { teks: d.tglPengajuan, kanan: true });
    y += H(h1);

    var h2 = Math.max(78, butuh(d.namaPaket, 4, 6, 2.2)), h2a = h2 / 2;
    bingkai(0, 6, y, h2); vgaris(2, y, h2);
    sel(0, 1, y, h2a, { teks: 'No. Kontrak', tebal: true }); sel(1, 2, y, h2a, { teks: d.noKontrak });
    sel(3, 4, y, h2a, { teks: 'Nama Paket', tebal: true, atas: true, pad: 2.2 }); sel(4, 6, y, h2, { teks: d.namaPaket, atas: true, pad: 2.2 });
    sel(0, 1, y + H(h2a), h2a, { teks: 'Tgl Kontrak', tebal: true }); sel(1, 2, y + H(h2a), h2a, { teks: d.tglKontrak });
    y += H(h2);

    bar(y, 21, BIRU, [[0, 2, 'Detail Data Ketidaksesuaian'], [2, 4, 'Jenis Ketidaksesuaian'], [4, 6, 'Referensi']]); y += H(21);

    var kiri = [['Nama Proyek', d.namaProyek], ['Bidang', d.bidang], ['Kegiatan', d.kegiatan], ['Lokasi', d.lokasi], ['Info Lainnya', d.info || '-'], ['', ''], ['', '']];
    var jenis = d.jenis || [], ref = d.referensi || [];
    var labelJenis = function (i) { return i === 3 ? 'Lainnya: ' + s(d.jenisLainnya) : JENIS[i]; };
    var rh = [], totalDetail = 0;
    for (var i = 0; i < 7; i++) {
      rh[i] = Math.max(44, butuh(kiri[i][1], 1, 2, 1.2), i < 4 ? butuh(labelJenis(i), 3, 4, 1.6) : 0, butuh(REFERENSI[i], 5, 6, 1.6));
      totalDetail += rh[i];
    }
    bingkai(0, 6, y, totalDetail); vgaris(2, y, totalDetail); vgaris(4, y, totalDetail);
    var ry = y;
    for (var j = 0; j < 7; j++) {
      var cy = ry + H(rh[j]) / 2;
      sel(0, 1, ry, rh[j], { teks: kiri[j][0], tebal: true });
      sel(1, 2, ry, rh[j], { teks: kiri[j][1], pad: 1.2 });
      if (j < 4) {
        if (jenis.indexOf(JENIS[j]) > -1) centang(X(2) + (X(3) - X(2)) / 2, cy);
        sel(3, 4, ry, rh[j], { teks: labelJenis(j) });
      }
      if (ref.indexOf(REFERENSI[j]) > -1) centang(X(4) + (X(5) - X(4)) / 2, cy);
      sel(5, 6, ry, rh[j], { teks: REFERENSI[j] });
      ry += H(rh[j]);
    }
    y += H(totalDetail);

    bar(y, 21, BIRU, [[0, 6, 'Uraian Ketidaksesuaian oleh Manajemen Konstruksi']]); y += H(21);
    bar(y, 21, ABU, [[0, 2, 'Kondisi Aktual'], [2, 6, 'Kondisi Seharusnya']]); y += H(21);
    /* kotak kondisi mengisi sisa lembar di atas blok tanda tangan */
    var t = ttd, sisa = (PH - MB - 4 - y - H(8)) / K - tinggiBlokTtd(R_TTD1);
    var hKond = Math.max(200, Math.floor(sisa));
    bingkai(0, 6, y, hKond); vgaris(2, y, hKond);
    sel(0, 2, y, hKond, { teks: d.kondisiAktual, atas: true, bebas: true }); sel(2, 6, y, hKond, { teks: d.kondisiSeharusnya, atas: true, bebas: true });
    y += H(hKond) + H(8);

    blokTandaTangan('MK1', 'PJ1', R_TTD1,
      (t.MK1 && t.MK1.nama) || d.diajukanNama, t.PJ1 && t.PJ1.nama,
      (t.MK1 && t.MK1.tanggal) || d.tglPengajuan, t.PJ1 && t.PJ1.tanggal);

    /* ===================== LEMBAR 2 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    bar(y, 21, BIRU, [[0, 6, 'Usulan Rencana Tindak Lanjut oleh Penyedia Jasa/Kontraktor']]); y += H(21);
    bingkai(0, 6, y, 307);
    sel(0, 6, y, 307, { teks: d.tindakLanjut, atas: true, bebas: true }); y += H(307) + H(8);
    bar(y, 21, BIRU, [[0, 6, 'Pemeriksaan Lanjutan (II)']]); y += H(21);
    var p = d.pemeriksaan || {};
    bingkai(0, 6, y, 47 + 292);
    var rb = { x: X(0), y: y, h: H(47) };
    font(UK, false); ink();
    var cyp = rb.y + rb.h / 2;
    doc.text('Pemeriksaan Setelah Tindak Lanjut', rb.x + 1.6, cyp + 1.2);
    var cx0 = rb.x + 62;
    kotakCentang(cx0, cyp, p.hasil === 'Diterima'); doc.text('Diterima', cx0 + 3, cyp + 1.2);
    kotakCentang(cx0 + 28, cyp, p.hasil === 'Ditolak' || p.hasil === 'Tidak Diterima'); doc.text('Tidak Diterima', cx0 + 31, cyp + 1.2);
    doc.text('Tanggal : ' + s(p.tanggal), cx0 + 64, cyp + 1.2);
    sel(0, 6, y + H(47), 292, { teks: 'Catatan : ' + s(p.catatan), atas: true, bebas: true });
    y += H(47 + 292) + H(8);
    blokTandaTangan('MK2', 'PJ2', R_TTD2,
      t.MK2 && t.MK2.nama, t.PJ2 && t.PJ2.nama, t.MK2 && t.MK2.tanggal, t.PJ2 && t.PJ2.tanggal);

    /* ===================== LEMBAR 3 ===================== */
    doc.addPage(); y = MT; kepalaLanjutan();
    bar(y, 30, NAVY, [[0, 6, 'DOKUMENTASI SITE MEMO']], UK_JUDUL); y += H(30);
    var info = [['No.', d.noMemo, 'Tgl Pengajuan', d.tglPengajuan], ['Nama Proyek', d.namaProyek, 'Kepada Yth', 'Site Manager'], ['Bidang', d.bidang, 'Kontraktor', d.kontraktor], ['Kegiatan', d.kegiatan, '', ''], ['Lokasi', d.lokasi, '', '']];
    var ih = info.map(function (r) {
      return Math.max(26, butuh(r[1], 1, r[2] ? 3 : 6, 1.6), r[2] ? butuh(r[3], 4, 6, 1.6) : 0);
    });
    var totalInfo = ih.reduce(function (a, b) { return a + b; }, 0), iy = y;
    bingkai(0, 6, y, totalInfo);
    for (var r = 0; r < info.length; r++) {
      sel(0, 1, iy, ih[r], { teks: info[r][0], tebal: true });
      if (info[r][2]) {
        sel(1, 3, iy, ih[r], { teks: info[r][1] });
        sel(3, 4, iy, ih[r], { teks: info[r][2], tebal: true }); sel(4, 6, iy, ih[r], { teks: info[r][3], kanan: true });
      } else sel(1, 6, iy, ih[r], { teks: info[r][1] });
      iy += H(ih[r]);
    }
    y += H(totalInfo);
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
      doc.setPage(pg); font(UK_KECIL, false); doc.setTextColor(95, 95, 95);
      doc.text('Halaman ' + pg + ' dari ' + n, PW - ML, PH - MB + 8, { align: 'right' });
    }
    ink();
    return doc;
  }

  var api = { bangun: bangun };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MEMOPDF = api;
})(typeof window !== 'undefined' ? window : this);
