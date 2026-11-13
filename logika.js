/* Logika murni untuk form lokasi dan titik (prototipe Tahap 0.3).
 * Tanpa DOM, jalan di browser (global LOGIKA) dan di Node (module.exports), supaya bisa diuji dan dipakai ulang di aplikasi. */
(function (root) {
  'use strict';

  /* ---------- normalisasi ---------- */

  /** Spasi dirapikan, tanda petik diseragamkan jadi ', tanda baca di ujung dibuang. */
  function rapi(s) {
    return String(s == null ? '' : s)
      .replace(/[‘’‛′`´]/g, "'")
      .replace(/\s+/g, ' ').trim()
      .replace(/[.,;:\-_\/\s]+$/g, '');
  }
  /** Kunci pembanding nama bebas (Elemen, Jenis ruangan, teks): tanpa peduli huruf besar-kecil. */
  function kunci(s) { return rapi(s).toLowerCase(); }

  /** Kelompok grid: A-Z0-9, boleh kosong, pemisah yang terketik dibuang, maksimal 10. */
  function kelompok(s) {
    var v = rapi(s).toUpperCase().replace(/[\s\-._\/]+/g, '');
    if (v.length > 10) return { ok: false, err: 'Kelompok maksimal 10 karakter.' };
    if (!/^[A-Z0-9]*$/.test(v)) return { ok: false, err: 'Kelompok hanya huruf dan angka.' };
    return { ok: true, val: v };
  }
  /** Kode grid: A-Z0-9 ditambah ' dan . (aturan sementara), wajib terisi, maksimal 10. */
  function kode(s) {
    var v = rapi(s).toUpperCase().replace(/\s+/g, '');
    if (!v) return { ok: false, err: 'Kode wajib diisi.' };
    if (v.length > 10) return { ok: false, err: 'Kode maksimal 10 karakter.' };
    if (!/^[A-Z0-9][A-Z0-9'.]*$/.test(v)) return { ok: false, err: 'Kode hanya huruf, angka, \' dan titik.' };
    return { ok: true, val: v };
  }

  /* ---------- urutan natural ---------- */

  function potong(s) {
    // potongan: angka, huruf, atau tanda petik/titik
    return String(s).match(/\d+|[A-Za-z]+|'+|\./g) || [];
  }
  /** Angka sebagai angka (2 < 10), huruf menurut abjad dengan panjang dulu (Z < AA), tanda petik setelah induknya (2 < 2' < 3). */
  function bandingAlami(a, b) {
    var x = potong(a), y = potong(b), n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var p = x[i], q = y[i];
      if (p === undefined) return -1;
      if (q === undefined) return 1;
      if (p === q) continue;
      var pd = /^\d/.test(p), qd = /^\d/.test(q);
      if (pd && qd) { var d = parseInt(p, 10) - parseInt(q, 10); if (d) return d < 0 ? -1 : 1; continue; }
      if (pd !== qd) return pd ? -1 : 1;                         // angka sebelum huruf
      var pp = p[0] === "'", qp = q[0] === "'";
      if (pp || qp) { if (pp && qp) return p.length < q.length ? -1 : 1; return pp ? -1 : 1; }   // tanda petik sebelum potongan lain
      if (p.length !== q.length) return p.length < q.length ? -1 : 1;
      return p < q ? -1 : 1;
    }
    return 0;
  }

  /** Urutan natural untuk NAMA (ruangan, elemen): kata menurut abjad tanpa peduli huruf besar-kecil, angka sebagai angka. */
  function bandingNama(a, b) {
    var x = String(a).toLowerCase().match(/[0-9]+|[^0-9]+/g) || [], y = String(b).toLowerCase().match(/[0-9]+|[^0-9]+/g) || [], n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var p = x[i], q = y[i];
      if (p === undefined) return -1;
      if (q === undefined) return 1;
      if (p === q) continue;
      var pd = /^[0-9]/.test(p), qd = /^[0-9]/.test(q);
      if (pd && qd) { var d = parseInt(p, 10) - parseInt(q, 10); if (d) return d < 0 ? -1 : 1; continue; }
      if (pd !== qd) return pd ? -1 : 1;
      return p < q ? -1 : 1;
    }
    return 0;
  }

  /* ---------- kemiripan ---------- */

  function jarak(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  /* ---------- daftar (registri) ----------
   * daftar = { kunci: { nama, n, t } }  n = jumlah pakai, t = waktu terakhir pakai.
   * Nama bebas: bentuk pertama yang diketik yang tampil. Kode grid: sudah kapital oleh normalisasi. */

  /**
   * Cocokkan masukan dengan daftar.
   *  { tipe:'sama', entri }   -> pakai entri lama tanpa bertanya
   *  { tipe:'mirip', entri }  -> tanya "Maksudnya ...?"
   *  { tipe:'baru' }          -> konfirmasi entri baru
   * opsi.fuzzy = false mematikan kemiripan (kode dan kelompok pendek: T1 dan T3 sah berbeda).
   */
  function cocok(daftar, masuk, opsi) {
    var k = kunci(masuk), fuzzy = !opsi || opsi.fuzzy !== false;
    if (daftar[k]) return { tipe: 'sama', entri: daftar[k] };
    if (fuzzy && k.length >= 4) {
      var best = null, bd = 99;
      Object.keys(daftar).forEach(function (dk) {
        var d = jarak(k, dk), awalan = (dk.indexOf(k) === 0 || k.indexOf(dk) === 0) && Math.abs(dk.length - k.length) <= 2 && dk.length >= 4;
        if ((d <= 1 || awalan) && d < bd) { bd = d; best = daftar[dk]; }
      });
      if (best) return { tipe: 'mirip', entri: best };
    }
    return { tipe: 'baru' };
  }
  function tambah(daftar, nama, t) {
    var k = kunci(nama);
    if (!daftar[k]) daftar[k] = { nama: rapi(nama), n: 0, t: 0 };
    return daftar[k];
  }
  function pakai(entri, t) { entri.n++; entri.t = t || Date.now(); }
  /** Chip: paling sering dipakai dulu, lalu paling baru; saring dengan awalan atau potongan ketikan. */
  function chips(daftar, saring) {
    var s = saring ? kunci(saring) : '';
    return Object.keys(daftar).map(function (k) { return daftar[k]; })
      .filter(function (e) { return !s || kunci(e.nama).indexOf(s) >= 0; })
      .sort(function (a, b) { return (b.n - a.n) || (b.t - a.t) || bandingNama(a.nama, b.nama); });
  }

  /* ---------- label dan teks Titik ---------- */

  function label(k, pemisah, n) { return k ? k + (pemisah || '') + n : n; }

  /**
   * Satu sumbu: arr = [dari] atau [dari, sampai], tiap elemen {k, n}.
   * pem(k) memberi pemisah Kelompok. Rentang disingkat bila Kelompok sama (T3-A-C ditulis T3-A–C).
   */
  function teksSumbu(arr, pem) {
    if (!arr || !arr.length) return '';
    var a = arr[0], la = label(a.k, pem(a.k), a.n);
    if (arr.length === 1) return la;
    var b = arr[1];
    if (a.k === b.k) return la + '–' + b.n;
    return la + '–' + label(b.k, pem(b.k), b.n);
  }
  /** Rentang harus urut natural dan satu Kelompok; sama persis dilipat jadi satu titik. */
  function cekRentang(arr, nama) {
    if (!arr || arr.length < 2) return { ok: true, arr: arr || [] };
    var a = arr[0], b = arr[1];
    if (a.k !== b.k) return { ok: false, err: nama + ': "dari" dan "sampai" harus satu Kelompok.' };
    var c = bandingAlami(a.n, b.n);
    if (c === 0) return { ok: true, arr: [a] };
    if (c > 0) return { ok: false, err: nama + ': rentang terbalik (' + a.n + ' sampai ' + b.n + ').' };
    return { ok: true, arr: arr };
  }
  function teksGrid(grid, pem) {
    var s1 = teksSumbu(grid.a, pem), s2 = teksSumbu(grid.b, pem);
    return s1 && s2 ? s1 + ' / ' + s2 : (s1 || s2);
  }

  /** "Ruang Rapat 2" -> {jenis:'Ruang Rapat', nomor:'2'}; konservatif: hanya angka (dan satu huruf) di akhir, sisa nama tidak kosong. */
  function pecahRuangan(nama) {
    var s = rapi(nama), m = /^(.*\S)\s+(\d+[A-Za-z]?)$/.exec(s);
    return m ? { jenis: m[1], nomor: m[2].toUpperCase(), ragu: false } : { jenis: s, nomor: '', ragu: /\d/.test(s) };
  }

  root.LOGIKA = {
    rapi: rapi, kunci: kunci, kelompok: kelompok, kode: kode,
    bandingAlami: bandingAlami, bandingNama: bandingNama, jarak: jarak,
    cocok: cocok, tambah: tambah, pakai: pakai, chips: chips,
    label: label, teksSumbu: teksSumbu, cekRentang: cekRentang, teksGrid: teksGrid, pecahRuangan: pecahRuangan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LOGIKA;
})(typeof window !== 'undefined' ? window : globalThis);
