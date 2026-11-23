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

  /* ---------- aturan nama lokasi (Gedung, Lantai, Ruangan) ----------
   * Nama dirapikan otomatis (huruf besar-kecil, spasi, format lantai) dan dicek sebelum disimpan, supaya master tidak berantakan.
   * Hasil: { ok:true, val } atau { ok:false, err }. Hanya dipakai untuk nama BARU; nama lama yang sudah terdaftar tidak diperiksa. */

  /** Singkatan yang tetap huruf kapital semua. Tambahkan di sini bila ada singkatan baru di proyek. */
  var SINGKATAN = ['LVMDP', 'MVMDP', 'MDP', 'SDP', 'LVDB', 'MVDB', 'DB', 'MCC', 'AHU', 'FCU', 'VAV', 'UPS', 'ATS', 'AMF', 'CCTV', 'MATV', 'BAS', 'BMS', 'FAP', 'WC', 'AC', 'VIP', 'IT', 'CCR',
    'PLN', 'PDAM', 'STP', 'GWT', 'RWT', 'TPS', 'ATM', 'OB', 'HVAC', 'AV', 'KWH', 'LV', 'MV', 'HV', 'LG', 'GF', 'UG', 'KY', 'MK', 'MA', 'PK', 'IKN', 'MEP', 'MEEP', 'HSE', 'BGH', 'SLF', 'R'];
  var KATA_KECIL = ['dan', 'di', 'ke', 'dari', 'atau', 'untuk', 'yang', 'dengan', 'pada'];
  var ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  /** Kata penunjuk posisi: nama lokasi hanya menyebut jenis tempatnya, posisi detail ditulis di temuan. */
  var POSISI_SELALU = ['dekat', 'sebelah', 'samping', 'seberang', 'antara', 'menuju', 'arah', 'sekitar', 'hadapan'];
  var POSISI_LALU = ['depan', 'belakang', 'atas', 'bawah', 'kiri', 'kanan'];   // ditolak bila diikuti kata lain ("Koridor Depan Ruang LVMDP"); "Lobi Depan" sah

  /** Setiap kata diawali huruf besar, singkatan tetap kapital, campuran huruf dan angka (B1, 2A, T1A) kapital semua. */
  function kapital(s) {
    var first = true;
    return String(s).split(/([\s\/()\-,.]+)/).map(function (w) {
      if (!w || /^[\s\/()\-,.]+$/.test(w)) return w;
      var lo = w.toLowerCase(), up = w.toUpperCase(), r;
      if (/\d/.test(w)) r = up;
      else if (SINGKATAN.indexOf(up) >= 0 || ROMAWI.indexOf(up) >= 0 || w.length === 1) r = up;
      else if (!first && KATA_KECIL.indexOf(lo) >= 0) r = lo;
      else r = lo.charAt(0).toUpperCase() + lo.slice(1);
      first = false;
      return r;
    }).join('');
  }

  function namaGedung(s) {
    var v = rapi(s);
    if (!v) return { ok: false, err: 'Nama gedung wajib diisi.' };
    if (v.length > 40) return { ok: false, err: 'Nama gedung maksimal 40 karakter.' };
    return { ok: true, val: kapital(v) };
  }

  /** Lantai dibakukan: "lt 2" dan "2" jadi "Lantai 2"; Basement jadi "Lantai B1", "Lantai B2"; "Split level Elv.37500" jadi "Lantai Split Level" (elevasinya saran Lokasi detail). */
  function namaLantai(s) {
    var v = rapi(s), m;
    if (!v) return { ok: false, err: 'Nama lantai wajib diisi.' };
    if (v.length > 40) return { ok: false, err: 'Nama lantai maksimal 40 karakter.' };
    if ((m = /\b(?:elv|elevasi|el)\.?\s*([+\-]?\d[\d.,]*)/i.exec(v))) {
      var angka = m[1].replace(/,/g, '.').replace(/\.$/, ''), neg = angka.charAt(0) === '-', abs = angka.replace(/^[+\-]/, '');
      if (/^\d{5,}$/.test(abs)) abs = abs.slice(0, -3) + '.' + abs.slice(-3);   // 37500 -> 37.500 (milimeter)
      if (!/^\d+(\.\d+)?$/.test(abs)) return { ok: false, err: 'Elevasi tidak terbaca. Contoh: Elv. 37.500' };
      var elv = 'Elv. ' + (neg ? '-' : '') + parseFloat(abs).toFixed(3);
      // "Split level Elv.37.500": lantainya Split Level; elevasinya jadi saran Lokasi detail (detail)
      if (/split/i.test(v)) return { ok: true, val: 'Lantai Split Level', detail: elv };
      return { ok: true, val: elv };
    }
    if (/^(?:lantai\s+|lt\.?\s*)?split(?:\s*-?\s*level)?$/i.test(v)) return { ok: true, val: 'Lantai Split Level', detail: '' };
    var pre = '(?:lantai|lt\\.?|level|floor)?\\s*';
    if ((m = new RegExp('^' + pre + '(?:basement|bsmt)\\s*-?\\s*(\\d*)$', 'i').exec(v)) || (m = new RegExp('^' + pre + 'b\\s*-?\\s*(\\d+)$', 'i').exec(v)))
      return { ok: true, val: 'Lantai B' + (parseInt(m[1], 10) || 1) };
    if ((m = new RegExp('^' + pre + '(\\d+)$', 'i').exec(v))) return { ok: true, val: 'Lantai ' + parseInt(m[1], 10) };
    if ((m = new RegExp('^' + pre + '(?:gf|ground(?:\\s+floor)?|dasar)$', 'i').exec(v))) return { ok: true, val: 'Lantai GF' };
    if ((m = new RegExp('^' + pre + '(lg|ug)\\s*-?\\s*(\\d*)$', 'i').exec(v))) return { ok: true, val: 'Lantai ' + m[1].toUpperCase() + (m[2] ? ' ' + parseInt(m[2], 10) : '') };
    if ((m = new RegExp('^' + pre + '(?:atap|roof)$', 'i').exec(v))) return { ok: true, val: 'Lantai Atap' };
    if ((m = new RegExp('^' + pre + 'roof\\s*-?\\s*top$', 'i').exec(v))) return { ok: true, val: 'Lantai Roof Top' };
    return { ok: true, val: kapital(v.replace(/^lt\.?\s+/i, 'Lantai ')) };
  }
  /** Kunci pembanding lantai: dua penulisan yang menjadi nama baku sama dianggap lantai yang sama ("Lt 2" = "Lantai 2"). */
  function kunciLantai(s) { var r = namaLantai(s); return kunci(r.ok ? r.val : s); }

  /** Nama ruangan hanya jenis tempatnya ("Koridor", "Ruang Rapat 2"); posisi detail ("depan ruang LVMDP") tidak boleh masuk nama. */
  function namaRuangan(s) {
    var v = rapi(s);
    if (!v) return { ok: false, err: 'Nama ruangan wajib diisi.' };
    if (v.length > 40) return { ok: false, err: 'Nama ruangan terlalu panjang (maksimal 40 huruf). Tulis jenis ruangnya saja, mis. "Koridor"; posisi detail tulis di temuan.' };
    var kata = v.toLowerCase().split(/[\s,()]+/).filter(Boolean), salah = '';
    kata.forEach(function (w, i) {
      if (salah) return;
      if (POSISI_SELALU.indexOf(w) >= 0 || (i === 0 && (w === 'di' || w === 'ke'))) salah = w;
      else if (POSISI_LALU.indexOf(w) >= 0 && i < kata.length - 1) salah = w;
    });
    if (salah) return { ok: false, err: 'Nama ruangan memuat posisi ("' + salah + '"). Tulis jenis ruangnya saja, mis. "Koridor"; posisi detail tulis di temuan.' };
    return { ok: true, val: kapital(v) };
  }

  root.LOGIKA = {
    namaGedung: namaGedung, namaLantai: namaLantai, namaRuangan: namaRuangan, kunciLantai: kunciLantai, kapital: kapital,
    rapi: rapi, kunci: kunci, kelompok: kelompok, kode: kode,
    bandingAlami: bandingAlami, bandingNama: bandingNama, jarak: jarak,
    cocok: cocok, tambah: tambah, pakai: pakai, chips: chips,
    label: label, teksSumbu: teksSumbu, cekRentang: cekRentang, teksGrid: teksGrid, pecahRuangan: pecahRuangan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LOGIKA;
})(typeof window !== 'undefined' ? window : globalThis);
