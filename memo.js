/* Site memo di klien: tombol Memo pada kartu temuan, form kekurangan isian dengan konfirmasi, rincian memo (pengesahan QC, tindak lanjut PJ),
 * daftar memo, profil tanda tangan QC, dan pembuatan serta pengarsipan PDF dari perangkat. Logika server ada di Kode.gs (aksi memo_*, ttd_*).
 * app.js memanggil MEMO.init(konteks) sekali; modul ini tidak menyentuh state aplikasi selain lewat konteks itu. */
(function (root) {
  'use strict';

  var C = null;                         // konteks dari app.js
  var D = { daftar: null, off: false, pv: null }; // daftar ringkas memo (memo_daftar); off = server belum punya aksi memo
  var LOGO = {};
  var BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var NAMA_SLOT = { MK1: 'QC MK, Tahap I', PJ1: 'QC PJ, tanda terima', MK2: 'QC MK, Tahap II', PJ2: 'QC PJ, Tahap II' };
  /* HSE dan BGH disahkan TA atau QC MK; sisi PJ oleh QC atau Manager PJ (cermin _lblMK dan _lblPJ di server). */
  function bidangTA(k) { return k === 'HSE' || k === 'BGH'; }
  function namaSlot(s, kode) {
    if (bidangTA(kode)) return { MK1: 'TA atau QC MK, Tahap I', PJ1: 'QC atau Manager PJ, tanda terima', MK2: 'TA atau QC MK, Tahap II', PJ2: 'QC atau Manager PJ, Tahap II' }[s];
    return NAMA_SLOT[s];
  }
  function lblGrup(g, ta) { return g === 'KOORD' ? 'Koordinator QC MK' : (ta ? 'TA ' + g + ', QC ' + g + ', atau Koordinator QC MK' : 'QC ' + g + ' atau Koordinator QC MK'); }
  var HINT = { MK1: 'Sahkan memo', PJ1: 'Sahkan tanda terima', MK2: 'Periksa dan sahkan', PJ2: 'Sahkan Tahap II (PJ)', tindak: 'Isi tindak lanjut' };
  var STAT = { 'MENUNGGU TTD MK': 'Menunggu TTD MK', TERBIT: 'Terbit', 'TINDAK LANJUT': 'Tindak lanjut', 'PEMERIKSAAN II': 'Pemeriksaan II', CLOSE: 'Close', BATAL: 'Batal', PERALIHAN: 'Peralihan' };
  var MODAL = { memomuat: 1, memoform: 1, memokonfirm: 1, memo: 1, memotindak: 1, memolist: 1, ttd: 1, memoyakin: 1, memoprev: 1, memolainnya: 1, qcdaftar: 1, tutupperalihan: 1 };
  var JENIS_MEMO = ['Kualitas', 'Material', 'Dimensi & Posisi (X,Y,Z)', 'Lainnya'];   // sama dengan Kode.gs
  var REF_MEMO = ['KPPK', 'RKS', 'Material yang disetujui', 'BQ', 'Drawing', 'Metoda Kerja/ WI/SOP', 'Spesifikasi'];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return C.esc(s); }
  function tglId(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + BLN[Number(m[2]) - 1] + ' ' + m[1] : String(iso || ''); }
  function taruh(df) { if (df) C.putDefect(df); }   // memo peralihan tidak punya temuan
  /* Daftar memo menampilkan nomor urut saja (mis. 11); bidangnya tampil di baris keterangan atau kolom Bidang. */
  /* Sel tabel yang dipotong satu baris dengan tiga titik; teks lengkap muncul saat diarahkan dan ada di rincian saat baris diketuk. */
  function potong(teks, kls) { var s = String(teks || ''); return s ? '<span class="cl ' + kls + '" title="' + esc(s) + '">' + esc(s) + '</span>' : ''; }
  function nomorSaja(no) { var m = /^\s*(\d+)\s*\//.exec(String(no || '')); return m ? String(parseInt(m[1], 10)) : pendek(no); }
  function pendek(no) { var m = /^(\d+)\/SM-([A-Z]+)/.exec(String(no || '')); return m ? m[2] + ' ' + m[1] : ''; }
  /* Warna per status memo (sama di kartu temuan, tab Memo, Rekap, dan rincian): Belum memo kuning, Draf jingga, Terbit biru, Tindak lanjut ungu, Pemeriksaan II toska, Close hijau, Batal abu-abu. */
  var KLS = { 'MENUNGGU TTD MK': 'm-draf', TERBIT: 'm-terbit', 'TINDAK LANJUT': 'm-tindak', 'PEMERIKSAAN II': 'm-periksa', CLOSE: 'm-close', BATAL: 'm-batal', PERALIHAN: 'm-peralihan' };
  function stCls(st) { return KLS[st] || ''; }
  function perluMemo(d) { return !!d && C.canEdit() && !d.memoId && (d.tingkat === 'Mayor' || d.tingkat === 'Kritis'); }
  function stKartu(st) { return st === 'MENUNGGU TTD MK' ? 'm-draf' : st === 'BATAL' ? 'm-batal' : 'm-terbit'; }   // kartu temuan: Draf atau Terbit saja
  function kelas(d) { return d && d.memoId ? ' mm ' + stKartu(d.memoStatus) : perluMemo(d) ? ' mm m-belum' : ''; }
  function legenda(list) {
    if (list && !list.some(function (d) { return d.memoId || perluMemo(d); })) return '';
    var item = list ? [['m-belum', 'Belum memo'], ['m-draf', 'Draf'], ['m-terbit', 'Terbit']] : [['m-belum', 'Belum memo'], ['m-draf', 'Draf'], ['m-terbit', 'Terbit'], ['m-tindak', 'Tindak lanjut'], ['m-periksa', 'Pemeriksaan II'], ['m-peralihan', 'Peralihan'], ['m-close', 'Close']];   // dengan daftar temuan: tiga keadaan; tanpa: semua tahap
    return '<div class="mlg" aria-label="Arti warna memo">' + item.map(function (x) { return '<span><i class="' + x[0] + '"></i>' + x[1] + '</span>'; }).join('') + '</div>';
  }
  function punya(t) { return !!MODAL[t]; }
  function milik(a) { return a.indexOf('memo') === 0 || a.indexOf('ttd') === 0; }

  /* ---------- daftar dan lencana ---------- */

  async function muatDaftar() {
    if (D.off || !C.S.user) return;
    try { D.daftar = await C.api('memo_daftar'); }
    catch (e) { if (e && e.server && /Aksi tidak dikenal/i.test(e.message)) D.off = true; return; }
    C.render();
  }
  function perlu() { return (D.daftar || []).filter(function (x) { return x.aksi && x.aksi.length; }); }
  /* Admin tidak diberi lencana: semua memo bisa ia sahkan, jadi angkanya tidak bermakna. */
  function jumlahPerlu() { return C.isAdmin() ? 0 : perlu().length; }

  /* ---------- potongan HTML untuk app.js ---------- */

  function tag(d) {
    if (d && !d.memoId) return perluMemo(d) ? '<span class="tag m-belum">Belum memo</span>' : '';
    if (!d) return '';
    var lbl = d.noMemo ? 'SM ' + pendek(d.noMemo) : 'Draf memo';
    return '<button type="button" class="tag memo ' + stKartu(d.memoStatus) + '" data-act="memobuka" data-d="' + esc(d.id) + '" aria-label="Site memo ' + esc(lbl) + '">' + C.ic('memo') + esc(lbl) + '</button>';
  }
  /* Bagian "Site memo" pada dialog Temuan lengkap: nomor, tahap, penerbit, tanggal. */
  var NAMA_TAHAP = { 'MENUNGGU TTD MK': 'Menunggu tanda tangan QC MK', 'TERBIT': 'Terbit', 'TINDAK LANJUT': 'Tindak lanjut', 'PEMERIKSAAN II': 'Pemeriksaan II, menunggu MK', 'CLOSE': 'Close', 'BATAL': 'Dibatalkan', 'PERALIHAN': 'Peralihan dari sistem lama' };
  function ringkasMemo(d) {
    function baris(k, v) { return v ? '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>' : ''; }
    if (!d.memoId) return perluMemo(d) ? baris('Status', 'Belum dimemokan') : '';
    var x = (D.daftar || []).filter(function (r) { return r.id === d.memoId; })[0];
    return baris('Nomor', d.noMemo ? esc(d.noMemo) : 'Draf, belum bernomor') + baris('Tahap', esc(NAMA_TAHAP[d.memoStatus] || d.memoStatus || '')) +
      (x ? baris('Diterbitkan oleh', esc(x.oleh || '(tidak tercatat)')) + baris('Tanggal pengajuan', x.tglPengajuan ? esc(x.tglPengajuan) : '') : '');
  }
  function bisaNaik(d) { return C.canEdit() && C.bisaKelola(d) && !d.memoId && (d.tingkat === 'Mayor' || d.tingkat === 'Kritis'); }   // hanya yang berhak mengelola temuan (pelapor, QC MK berwenang, Admin); rincian memo tetap terbuka bagi semua
  /* Tombol Memo berwarna menurut keadaan: kuning bergaris putus = belum dinaikkan; selebihnya sama dengan warna status memo. */
  function kartuTombol(d, label) {
    if (d.memoId) return '<button type="button" class="pill memo ' + stKartu(d.memoStatus) + '" data-act="memobuka" data-d="' + esc(d.id) + '">' + C.ic('memo') + (label || 'Memo') + '</button>';
    if (bisaNaik(d)) return '<button type="button" class="pill memo m-belum" data-act="memobuka" data-d="' + esc(d.id) + '">' + C.ic('memo') + 'Memo</button>';
    return '';
  }
  function setelanHtml() {
    var u = C.S.user, h = '', n = jumlahPerlu();
    if (!u) return '';
    if (C.canEdit() || C.isPJ()) h += '<button type="button" class="btn sec" data-act="memolist">' + C.ic('memo') + 'Memo' + (n ? ' (' + n + ')' : '') + '</button>';
    if (u.qc === 'YA') h += '<button type="button" class="btn sec" data-act="ttd">' + C.ic('ubah') + 'Tanda tangan</button>';
    if (C.isAdmin()) h += '<button type="button" class="btn sec" data-act="ttdqc">' + C.ic('ubah') + 'Tanda tangan QC</button>';
    return h ? '<div class="btnrow">' + h + '</div>' : '';
  }

  /* ---------- kartu temuan bermemo ---------- */
  function entriDaftar(d) { return (D.daftar || []).filter(function (r) { return r.id === d.memoId; })[0]; }
  function tungguKartu(d) {
    if (!d || !d.memoId || d.status === 'Close') return '';
    var x = entriDaftar(d), st = d.memoStatus;
    var teks = x && x.menunggu && x.menunggu.teks && x.status === st ? x.menunggu.teks : st === 'MENUNGGU TTD MK' ? 'Menunggu tanda tangan QC MK' : st === 'PEMERIKSAAN II' ? 'Menunggu pemeriksaan QC MK' : 'Menunggu PJ melengkapi site memo';
    var o = st === 'MENUNGGU TTD MK' || st === 'PEMERIKSAAN II' || d.verifikasi === 'Ditolak';
    var sub = '';
    if (st !== 'PEMERIKSAAN II') {
      if (C.isPJ()) {
        var kurang = [];
        if (x && !x.tindak) kurang.push('tindak lanjut');
        if (!(d.fotoAfter || []).length) kurang.push('foto After');
        sub = kurang.length && st !== 'MENUNGGU TTD MK' ? 'Lengkapi: ' + kurang.join(', ') : '';
      } else sub = 'Belum bisa diverifikasi';
    }
    return '<div class="mtunggu kartu' + (o ? ' o' : '') + '"><b>' + esc(teks) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }
  /* Satu tombol sesuai giliran akun ini (QC). Tanda terima boleh langsung dari kartu; selebihnya membuka halaman memo. */
  function aksiKartu(d) {
    var u = C.S.user, x = d && d.memoId ? entriDaftar(d) : null;
    if (!x || C.isAdmin() || !u || u.qc !== 'YA') return '';
    var a = (x.aksi || []).filter(function (v) { return v !== 'tindak'; })[0];
    if (!a) return '';
    if (a === 'PJ1') return '<button type="button" class="pill go" data-act="memosahcepat" data-m="' + esc(x.id) + '" data-s="PJ1">' + C.ic('centang') + 'Terima memo</button>';
    return '<button type="button" class="pill go" data-act="memobuka" data-d="' + esc(d.id) + '">' + C.ic('centang') + (a === 'MK2' ? 'Periksa' : LBL_AKSI[a]) + '</button>';
  }

  /* ---------- form kenaikan memo ---------- */

  function awalForm(s) {
    var i = s.isian;
    return { tgl: i.tglPengajuan, bidang: i.bidang, kegiatan: '', lokasi: i.lokasi, info: '-', jenis: [], jenisLain: '', ref: [], aktual: i.kondisiAktual, seharusnya: '',
      foto: (s.fotoBefore || []).slice(0, 4).map(function (f) { return f.id; }), sahkan: !!s.qc.sayaBisaMengesahkan };
  }
  function cekHtml(g, arr, sel) {
    return arr.map(function (x) { return '<label class="mchk pil"><input type="checkbox" data-g="' + g + '" value="' + esc(x) + '"' + (sel.indexOf(x) >= 0 ? ' checked' : '') + '><span>' + esc(x === 'Dimensi & Posisi (X,Y,Z)' ? 'Dimensi dan posisi' : x) + '</span></label>'; }).join('');
  }
  function formHtml(m) {
    var v = m.v, s = m.s, d = m.d;
    var row = function (id, lbl, val, tp, wajib) { return '<label class="row"><span class="lbl">' + lbl + (wajib ? '<i>*</i>' : '') + '</span><input type="' + (tp || 'text') + '" id="' + id + '" value="' + esc(val) + '" autocomplete="off"></label>'; };
    var area = function (id, lbl, val, ph) { return '<label class="row"><span class="lbl">' + lbl + '<i>*</i></span><textarea id="' + id + '" placeholder="' + esc(ph || '') + '" style="min-height:96px">' + esc(val) + '</textarea></label>'; };
    var fotos = (s.fotoBefore || []).map(function (f) {
      var on = v.foto.indexOf(f.id) >= 0;
      return '<button type="button" class="mfoto' + (on ? ' on' : '') + '" data-act="memofoto" data-f="' + esc(f.id) + '" aria-pressed="' + on + '"><img alt="Foto before" referrerpolicy="no-referrer" src="' + esc(C.thumb(f.id, 200)) + '">' + (on ? '<span class="n">' + (v.foto.indexOf(f.id) + 1) + '</span>' : '') + '</button>';
    }).join('');
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Memo"><div class="grab" aria-hidden="true"></div><h2>' + (m.mode === 'ubah' ? 'Ubah memo' : 'Buat site memo') + '</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(d.uraian) + '</div>' +
      '<div class="note" style="padding:0">' + (m.mode === 'ubah' ? 'Ubah isian memo. Nomor memo tidak berubah. PDF yang sudah diarsipkan dibuat ulang setelah disimpan.' : 'Isian di bawah diambil dari temuan. Lengkapi yang belum terisi. Nomor memo keluar setelah ' + esc(lblGrup(s.qc.grup, s.qc.ta)) + ' mengesahkan.') + '</div>' +
      '<section class="group"><div class="list">' + (m.mode === 'ubah' ? '' : row('mTgl', 'Tanggal pengajuan', v.tgl, 'date')) + row('mBid', 'Bidang pekerjaan', v.bidang) + row('mKeg', 'Kegiatan pekerjaan', v.kegiatan) + row('mLok', 'Lokasi pekerjaan', v.lokasi, 'text', true) + row('mInfo', 'Info lainnya', v.info) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Jenis ketidaksesuaian</span><div class="mpils">' + cekHtml('jenis', s.opsi.jenis, v.jenis) + '</div></div>' + row('mJL', 'Jika memilih "Lainnya"', v.jenisLain) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Referensi</span><div class="mpils">' + cekHtml('ref', s.opsi.referensi, v.ref) + '</div></div></div></section>' +
      '<section class="group"><div class="list">' + area('mAkt', 'Kondisi aktual', v.aktual, 'Jelaskan kondisi di lapangan') + area('mSeh', 'Kondisi seharusnya', v.seharusnya, 'Rujukan SNI, spesifikasi, atau standar') + '</div></section>' + '<div class="note" style="padding:0">Kondisi aktual diisi dari temuan. Boleh dikembangkan; hanya berlaku di site memo, uraian temuan tidak berubah.</div>' +
      (fotos ? '<section class="group"><div class="list"><div class="row"><span class="lbl">Foto before di memo (' + v.foto.length + ' dari 4)</span><div class="mfotos">' + fotos + '</div></div></div></section>' : '<div class="note" style="padding:0">Temuan ini belum punya foto before.</div>') +
      (s.qc.sayaBisaMengesahkan ? '<label class="mchk big"><input type="checkbox" id="mSah"' + (v.sahkan ? ' checked' : '') + '><span>Langsung sahkan dan beri nomor (Anda QC bidang ini)</span></label>' : '') +
      (m.mode === 'ubah' ? '<div class="gap"><button type="button" class="btn" data-act="memoubahsimpan">Simpan</button><button type="button" class="btn sec" data-act="memokembaliubah">Batal</button></div></div></div>' : '<div class="gap"><button type="button" class="btn" data-act="memolanjut">' + C.ic('memo') + 'Lanjut</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>');
  }
  function bacaForm(m) {
    var v = m.v, g = function (id) { var e = $(id); return e ? e.value : null; };
    var set = function (k, id) { var x = g(id); if (x !== null) v[k] = x; };
    set('tgl', 'mTgl'); set('bidang', 'mBid'); set('kegiatan', 'mKeg'); set('lokasi', 'mLok'); set('info', 'mInfo'); set('jenisLain', 'mJL'); set('aktual', 'mAkt'); set('seharusnya', 'mSeh');
    var dom = function (n) { return Array.prototype.map.call(document.querySelectorAll('input[data-g="' + n + '"]:checked'), function (e) { return e.value; }); };
    if ($('mTgl')) { v.jenis = dom('jenis'); v.ref = dom('ref'); }
    var sw = $('mSah'); if (sw) v.sahkan = sw.checked;
  }
  function segar() {   // render ulang overlay dengan posisi gulir terjaga
    var sh = C.overlay.querySelector('.sheet'), y = sh ? sh.scrollTop : 0;
    C.renderOverlay();
    var s2 = C.overlay.querySelector('.sheet'); if (s2) s2.scrollTop = y;
  }
  function konfirmHtml(m) {
    var d = m.d;
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Konfirmasi memo"><h2>Naikkan jadi site memo?</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(d.uraian) + '</div>' +
      '<div class="note" style="padding:0">Temuan ' + esc(d.tingkat) + ' ini akan dibuat site memo ' + (m.v.sahkan ? 'dan langsung disahkan' : '(draf, menunggu pengesahan QC)') + '. Setelah dinaikkan, temuan baru Close kalau memo lengkap (tanda tangan QC MK dan QC PJ).</div>' +
      '<div class="gap"><button type="button" class="btn" data-act="memoya">Ya, buat memo</button><button type="button" class="btn sec" data-act="memokembali">Kembali ke form</button></div></div></div>';
  }
  async function kirimDraf(m) {
    var v = m.v, p = { id: m.d.id, tglPengajuan: v.tgl, bidang: v.bidang, kegiatan: v.kegiatan, lokasi: v.lokasi, info: v.info, jenis: v.jenis, jenisLain: v.jenisLain, referensi: v.ref,
      kondisiAktual: v.aktual, kondisiSeharusnya: v.seharusnya, fotoBefore: v.foto, sahkan: !!(v.sahkan && m.s.qc.sayaBisaMengesahkan), konfirmasi: true };
    var r = await C.work('Membuat memo...', function () { return C.api('memo_draf', p); });
    if (!r) { C.openModal({ t: 'memoform', d: m.d, s: m.s, v: v }); return; }
    taruh(r.defect);
    V2.teksHapus('mAkt', m.d.id); V2.teksHapus('mSeh', m.d.id);
    C.toast(r.hasil && r.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(r.hasil.nomor) + '.' : 'Draf memo dibuat. Menunggu QC mengesahkan.');
    C.openModal({ t: 'memo', r: r });
    C.render();
    if (r.hasil && r.hasil.arsip) await arsipkan(r, r.hasil.arsip);
    muatDaftar();
  }

  /* ---------- rincian memo ---------- */

  async function bukaDetail(p) {
    var tunggu = { t: 'memomuat', mid: p.memoId || '' }, r;
    C.openModal(tunggu);   // halaman langsung terbuka berisi kerangka, tanpa layar digelapkan
    var naik = new Promise(function (ok) { setTimeout(ok, document.documentElement.classList.contains('hemat') ? 0 : 580); });   // isi diganti setelah gerak naik selesai, supaya tidak terputus
    try { r = await C.api('memo_detail', p); await naik; }
    catch (e) { if (C.S.modal === tunggu) C.closeModal(); return C.gagal(e); }
    if (C.S.modal !== tunggu) return;   // sudah ditutup atau diganti selagi memuat
    taruh(r.defect); C.openModal({ t: 'memo', r: r });
  }
  function muatHtml() {
    var b = function (w, h) { return '<div class="sk" style="width:' + w + ';height:' + h + 'px;border-radius:12px"></div>'; };
    return '<div class="ov mpage" data-act="modalbg"><div class="sheet msheet" role="dialog" aria-label="Memuat memo">' +
      '<div class="mtop"><button type="button" class="mback" data-act="mtutup" aria-label="Tutup"><span class="hp">&lsaquo; Kembali</span><span class="lb">' + C.ic('x') + '</span></button><h2>Site memo</h2></div>' +
      b('60%', 24) + b('100%', 64) + b('100%', 280) + b('100%', 48) + '</div></div>';
  }
  async function buka(id) {
    var d = C.findDefect(id); if (!d) return;
    if (d.memoId) return bukaDetail({ memoId: d.memoId });
    var s = await C.work('Memuat memo...', function () { return C.api('memo_siap', { id: id }); });
    if (!s) return;
    if (s.ada) { taruh(s.detail.defect); return C.openModal({ t: 'memo', r: s.detail }); }
    C.openModal({ t: 'memoform', d: d, s: s, v: awalForm(s) });
  }
  function baris(l, v) { return v ? '<div class="mrow"><span>' + l + '</span><b>' + esc(v) + '</b></div>' : ''; }
  function perluArsip(r) {
    var d = r.memo, a = [];
    if (d.sumber) return a;
    if (r.ttd.MK1 && !d.pdfBefore) a.push('before');
    if (d.status === 'CLOSE' && !d.pdfAfter) a.push('after');
    return a;
  }
  /* Memo peralihan (dari Monitoring): hanya data ringkas dan tautan ke surat dan penutup di Drive; tanpa tanda tangan, tindak lanjut, atau pratinjau. */
  function driveUrl(id) { return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; }
  function detailPeralihanHtml(m) {
    var r = m.r, d = r.memo, admin = C.isAdmin();
    var sel2 = function (l, v, penuh) { return v ? '<div class="mc' + (penuh ? ' full' : '') + '"><span>' + l + '</span><b>' + esc(v) + '</b></div>' : ''; };
    var h = '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Site memo"><div class="grab" aria-hidden="true"></div><div class="mhead"><h2>SM ' + esc(pendek(d.noMemo) || d.kodeBidang) + '</h2><button type="button" class="btn-ic" data-act="mtutup" aria-label="Tutup">' + C.ic('x') + '</button></div>' +
      '<div class="meta"><span class="tag ' + stCls(d.status) + '">' + esc(STAT[d.status] || d.status) + '</span><span class="tag">' + esc(d.bidang) + '</span><span class="tag">' + (d.sumber === 'MANUAL' ? 'Catatan manual' : 'Dari sistem lama') + '</span></div>' +
      '<div class="note mono" style="padding:0">' + esc(d.noMemo) + '</div>' +
      '<section class="group"><div class="mgrid">' + sel2('Perihal', d.kegiatan, true) + sel2('Lokasi', d.lokasi) + sel2('Pembuat memo', d.diajukanNama) + sel2('PIC penyedia jasa', d.kontraktor) +
      sel2('Tanggal kirim', tglId(d.tglPengajuan)) + sel2(d.status === 'CLOSE' ? 'Tanggal respon dan penutupan' : 'Tahap', d.status === 'CLOSE' ? (d.tglClose ? tglId(d.tglClose) : 'Close (tanggal tidak tercatat)') : 'Menunggu ditutup Admin') + '</div></section>';
    h += '<div class="note" style="padding:0">' + (d.status === 'CLOSE' ? 'Memo ini sudah Close.' : 'Memo ini dari sistem lama atau dicatat manual di sheet. Admin menutupnya dengan tombol Tutup memo.') + '</div>';
    var links = '';
    if (d.pdfBefore) links += '<a class="btn sec" href="' + driveUrl(d.pdfBefore) + '" target="_blank" rel="noopener">' + C.ic('pdf') + 'Buka surat memo</a>';
    if (d.pdfAfter) links += '<a class="btn sec" href="' + driveUrl(d.pdfAfter) + '" target="_blank" rel="noopener">' + C.ic('pdf') + 'Buka penutup</a>';
    if (links) h += '<div class="gap">' + links + '</div>';
    var utama = '';
    if (admin && d.status === 'PERALIHAN') utama += '<button type="button" class="btn" data-act="memotutupform">' + C.ic('centang') + 'Tutup memo (Close)</button>';
    return h + '<div class="mact2">' + utama + (admin ? '<button type="button" class="btn sec sq" data-act="memolainnya" aria-label="Aksi lain">&#8943;</button>' : '<button type="button" class="btn sec" data-act="mtutup">Tutup</button>') + '</div></div></div>';
  }
  /* ---------- halaman memo: satu tempat untuk membaca dan bertindak ---------- */

  var LBL_AKSI = { MK1: 'Sahkan memo', PJ1: 'Terima memo', PJ2: 'Sahkan Tahap II', MK2: 'Terima dan sahkan' };
  function lebar() { return !!(root.matchMedia && root.matchMedia('(min-width:768px)').matches); }
  /* Siapa yang ditunggu dan untuk apa (cermin _menunggu di server, dihitung dari rincian yang sedang terbuka). */
  function giliran(r) {
    var d = r.memo, t = r.ttd, df = r.defect || {}, foto = !!(df.fotoAfter && df.fotoAfter.length);
    if (d.status === 'BATAL' || d.status === 'CLOSE') return null;
    if (!t.MK1) return { w: 'QC MK', apa: 'Memo belum bernomor. Menunggu disahkan.', o: true };
    if (t.PJ2 && !t.MK2) return { w: 'QC MK', apa: 'Cek di lapangan, lalu terima atau tolak.', o: true };
    var kurang = [];
    if (!t.PJ1) kurang.push('tanda terima QC PJ');
    if (!d.tindakLanjut) kurang.push('tindak lanjut');
    if (!t.MK2 && !foto) kurang.push('foto After');
    if (df.verifikasi === 'Ditolak') return { w: 'PJ', apa: 'Ditolak MK' + (df.catatan ? ': ' + df.catatan : '') + '. Perbaiki, lalu sahkan Tahap II lagi.', o: true };
    if (kurang.length) return { w: !t.PJ1 ? (kurang.length === 1 ? 'QC PJ' : 'QC PJ dan PJ') : 'PJ', apa: 'Belum ada: ' + kurang.join(', ') + '.' };
    return { w: 'QC PJ', apa: 'Semua lengkap. Sahkan Tahap II supaya MK bisa memeriksa.' };
  }
  function langkahHtml(r) {
    var d = r.memo, t = r.ttd, df = r.defect || {}, u = C.S.user, aktif = d.status !== 'CLOSE' && d.status !== 'BATAL', foto = (df.fotoAfter || []).length, selesai = 0, h = '';
    function baris(kls, judul, isi, kanan) {
      var ok = / ok/.test(kls);
      if (ok) selesai++;
      h += '<div class="' + kls + '"><span class="dot" aria-hidden="true">' + (ok ? C.ic('centang') : '') + '</span><div class="isi"><span class="sl">' + judul + '</span>' + isi + '</div>' + (kanan || '') + '</div>';
    }
    function slot(s) {
      var x = t[s], b = r.bisa[s], isi, kanan = '';
      if (x) {
        isi = '<span class="who"><b>' + esc(x.nama) + '</b></span><span class="sub">' + esc(x.jabatan) + ' &middot; ' + esc(C.fmtWaktu(x.waktu)) + (x.pelaksana ? ' &middot; oleh ' + esc(x.pelaksana) : '') + '</span>';
        if (r.cabut === s && !C.isAdmin()) kanan = '<button type="button" class="pill bad" data-act="memocabut" data-s="' + s + '">Batalkan</button>';
      } else isi = b && b.ok ? '<span class="sub">Giliran Anda</span>' : '<span class="wait">' + esc(s === 'MK2' && !t.PJ2 && t.MK1 ? 'Setelah QC PJ sahkan Tahap II' : u && u.qc !== 'YA' && !C.isAdmin() ? 'Menunggu' : ((b && b.alasan) || 'Menunggu')) + '</span>';
      baris('mt2' + (x ? ' ok' : b && b.ok ? ' kini' : ''), namaSlot(s, d.kodeBidang), isi, kanan);
    }
    slot('MK1'); slot('PJ1');
    var bisaFoto = aktif && !t.PJ2 && !t.MK2 && !!t.MK1 && (C.isPJ() || C.isAdmin());
    baris('mst' + (foto ? ' ok' : ''), 'Foto After', '<span class="sub">' + (foto ? foto + ' foto' : 'Belum ada') + '</span>',
      bisaFoto && !foto ? '<button type="button" class="pill start" data-act="unggah" data-d="' + esc(df.id) + '" data-j="after">Unggah</button>' : '');
    var bisaTl = r.bisaTindak && r.bisaTindak.ok && aktif;
    baris('mst' + (d.tindakLanjut ? ' ok' : bisaTl ? ' kini' : ''), 'Tindak lanjut PJ', '<span class="sub dua">' + esc(d.tindakLanjut || 'Belum diisi') + '</span>',
      bisaTl ? '<button type="button" class="pill start" data-act="memotindak">' + (d.tindakLanjut ? 'Ubah' : 'Isi') + '</button>' : '');
    slot('PJ2'); slot('MK2');
    return { h: h, selesai: selesai };
  }
  function rincianHtml(r) {
    var d = r.memo, df = r.defect || {};
    function sel(l, v) { return '<div class="mc"><span>' + l + '</span><b>' + esc(v || '-') + '</b></div>'; }
    function panjang(l, v) {
      if (!v) return '';
      var p = String(v).length > 220 || (String(v).match(/\n/g) || []).length > 3;
      return '<div class="mc full"><span>' + l + '</span><b' + (p ? ' class="klem"' : '') + '>' + esc(v) + '</b>' + (p ? '<button type="button" class="lnk" data-act="memolebih">Selengkapnya</button>' : '') + '</div>';
    }
    return '<section class="group mrinci"><div class="cap">Rincian memo</div><div class="mgrid">' + sel('Kegiatan', d.kegiatan) + sel('Lokasi', d.lokasi) +
      sel('Jenis', d.jenis.concat(d.jenisLain ? ['(' + d.jenisLain + ')'] : []).join(', ')) + sel('Referensi', d.referensi.join(', ')) +
      panjang('Info', d.info && d.info !== '-' ? d.info : '') + panjang('Kondisi aktual', d.kondisiAktual) + panjang('Kondisi seharusnya', d.kondisiSeharusnya) +
      panjang('Tindak lanjut PJ', d.tindakLanjut ? d.tindakLanjut + (d.namaPenerima ? ' (penerima: ' + d.namaPenerima + ')' : '') : '') +
      panjang('Verifikasi MK', df.verifikasi ? df.verifikasi + (df.tglVerif ? ' ' + tglId(df.tglVerif) : '') + (df.verifOleh ? ' oleh ' + df.verifOleh : '') + (df.catatan ? '. ' + df.catatan : '') : '') + '</div></section>';
  }
  function detailHtml(m) {
    if (m.r.memo.sumber) return detailPeralihanHtml(m);
    var r = m.r, d = r.memo, df = r.defect, u = C.S.user, bukanQc = !!(u && u.qc !== 'YA' && !C.isAdmin());
    var g = giliran(r), lk = langkahHtml(r), periksa = !!(r.ttd.PJ2 && !r.ttd.MK2), bisaPeriksa = !!(r.bisa.MK2 && r.bisa.MK2.ok && !r.ttd.MK2);
    var perluTtd = u && u.qc === 'YA' && !r.ttdSaya && !C.isAdmin();
    var aksi = '', pilih = '';
    ['MK1', 'PJ1', 'PJ2', 'MK2'].forEach(function (s) {
      var b = r.bisa[s];
      if (r.ttd[s] || !b || !b.ok) return;
      if (b.kandidat && b.kandidat.length > 1) pilih += '<select id="mQid_' + s + '" class="mqid" aria-label="Tanda tangan siapa">' + b.kandidat.map(function (k) { return '<option value="' + esc(k.qid) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select>';
      aksi += perluTtd ? '<button type="button" class="btn" data-act="ttd">' + C.ic('ubah') + 'Unggah tanda tangan</button>' : '<button type="button" class="btn" data-act="memosah" data-s="' + s + '">' + C.ic('centang') + LBL_AKSI[s] + '</button>';
    });
    if (bisaPeriksa) aksi += '<button type="button" class="btn bad" data-act="memotolak">Tolak</button>';
    aksi += '<button type="button" class="btn sec" data-act="memopratinjau">' + C.ic('memo') + 'Pratinjau</button>';
    return '<div class="ov mpage" data-act="modalbg"><div class="sheet msheet' + (periksa ? ' periksa' : '') + '" role="dialog" aria-label="Site memo">' +
      '<div class="mtop"><button type="button" class="mback" data-act="mtutup" aria-label="Tutup"><span class="hp">&lsaquo; Kembali</span><span class="lb">' + C.ic('x') + '</span></button>' +
      '<h2>' + (d.noMemo ? 'SM ' + esc(pendek(d.noMemo)) : 'Draf site memo') + '</h2><button type="button" class="mlain" data-act="memolainnya" aria-label="Aksi lain">&#8943;</button></div>' +
      '<div class="meta"><span class="tag ' + stCls(d.status) + '">' + esc(STAT[d.status] || d.status) + '</span>' + (df.tingkat ? '<span class="tag ' + esc(String(df.tingkat).toLowerCase()) + '">' + esc(df.tingkat) + '</span>' : '') + '<span class="tag">' + esc(d.bidang) + '</span></div>' +
      (d.noMemo ? '<div class="note mono mnomor">' + esc(d.noMemo) + '</div>' : '') +
      '<div class="mbadan"><div class="mkanan">' +
      (r.lokasiBeda ? '<div class="mtunggu o mbeda" role="status"><b>Lokasi temuan berbeda dengan memo</b><span>Temuan: ' + esc([df.gedung, df.lantai, df.ruangan].join(', ')) + '. Memo: ' + esc(d.lokasi) + '.</span>' + (C.isAdmin() ? '<button type="button" class="pill" data-act="memolokasi">Perbarui lokasi memo (Admin)</button>' : '') + '</div>' : '') +
      (g ? '<div class="mtunggu' + (g.o ? ' o' : '') + '"><b>Menunggu ' + g.w + '</b><span>' + esc(g.apa) + '</span></div>' : '') +
      '<details class="mlangkah"' + (periksa && !lebar() ? '' : ' open') + '><summary>' + lk.selesai + ' dari 6 langkah selesai</summary><div class="mttd2">' + lk.h + '</div></details>' +
      (bukanQc ? '<div class="note mbukan">Pengesahan memo dilakukan oleh ' + (bidangTA(d.kodeBidang) ? 'TA atau QC' : 'QC') + '.</div>' : '') +
      (bisaPeriksa ? '<label class="mcat"><span>Catatan MK (wajib bila ditolak)</span><textarea id="mCat"></textarea></label>' : '') +
      '<div class="maksi">' + pilih + '<div class="mact2">' + aksi + '</div></div></div>' +
      '<div class="mkiri"><div class="mfto"><div class="phs"><div class="ph" data-j="before">' + C.fotoBlok(df, 'before') + '</div><div class="ph" data-j="after">' + C.fotoBlok(df, 'after') + '</div></div>' +
      '<div class="muraian"><span class="no">' + esc(df.no || '') + '</span><span>' + esc(df.uraian) + '</span></div></div>' +
      rincianHtml(r) +
      '<details class="mriwayat"><summary>Lokasi, pelapor, riwayat</summary><div class="isi">' + C.riwayatHtml(df) + [['Diterbitkan oleh', d.dibuatOleh], ['Tanggal pengajuan', d.tglPengajuan]].map(function (x) { return x[1] ? '<div class="kv"><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>' : ''; }).join('') + '</div></details></div></div></div></div>';
  }
  function lainnyaHtml(m) {
    var r = m.r, d = r.memo, u = C.S.user, it = [];
    if (!d.sumber) it.push(['memopdf', C.ic('pdf'), 'Unduh PDF', false]);
    if (perluArsip(r).length && d.status !== 'BATAL' && (C.isAdmin() || (u && u.qc === 'YA' && u.peran === 'MK' && (u.qcBidang === 'KOORD' || u.qcBidang === d.kodeBidang)))) it.push(['memoarsip', C.ic('refresh'), 'Arsipkan PDF ke Drive', false]);
    if (r.bisaUbah && d.status !== 'BATAL') it.push(['memoubah', C.ic('ubah'), 'Ubah isian', false]);
    if (r.defect) C.kmenuItems(r.defect).forEach(function (k) { it.push([k.a, k.ic ? C.ic(k.ic) : '', k.a === 'hapus' ? 'Hapus temuan' : k.t, !!k.bad, r.defect.id]); });
    if (C.isAdmin() && !d.sumber && d.status !== 'BATAL' && Object.keys(r.ttd).length) it.push(['memomundur', C.ic('urungkan'), 'Mundur ke tahap', false]);
    if (C.isAdmin() && !d.sumber && d.status === 'CLOSE' && r.defect) it.push(['memobukakembali', C.ic('urungkan'), 'Buka kembali', false]);
    if (C.isAdmin() && d.status !== 'BATAL') it.push(['memobatal', '', 'Batalkan memo', true]);
    if (C.isAdmin()) it.push(['memohapus', C.ic('sampah'), 'Hapus memo', true]);
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Aksi memo"><div class="group kmenu"><div class="list">' +
      it.map(function (x) { return '<button type="button" class="row act' + (x[3] ? ' bad' : '') + '" data-act="' + x[0] + '"' + (x[4] ? ' data-d="' + esc(x[4]) + '"' : '') + '>' + x[1] + '<span>' + x[2] + '</span></button>'; }).join('') +
      '</div></div><button type="button" class="btn sec" data-act="memoyakinbatal">Kembali</button></div></div>';
  }
  async function sahkan(slot) {
    var m = C.S.modal; if (!m || m.t !== 'memo') return;
    var sel = $('mQid_' + slot), p = { memoId: m.r.memo.id, slot: slot };
    if (sel && sel.value) p.qid = sel.value;
    if (slot === 'MK2' && $('mCat')) p.catatan = $('mCat').value.trim();
    var h = await C.work('Mengesahkan...', function () { return C.api('memo_sahkan', p); });
    if (!h) return;
    V2.teksHapus('mCat', m.r.memo.id);
    taruh(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    if (C.S.modal && C.S.modal.t === 'memo') { C.S.modal.r = h; C.renderOverlay(); }
    C.render();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
    muatDaftar();
  }

  /* MK menolak: tanda tangan PJ Tahap II dibatalkan server dan memo kembali ke PJ. */
  async function tolak() {
    var m = C.S.modal; if (!m || m.t !== 'memo') return;
    var cat = ($('mCat') || {}).value || '', d = m.r.memo;
    if (!cat.trim()) { C.toast('Isi catatan MK dulu supaya PJ tahu yang harus diperbaiki.'); var ta = $('mCat'); if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus(); } return; }
    var r = await C.work('Menolak...', async function () {
      await C.api('verifikasi', { id: d.defectId, hasil: 'Ditolak', catatan: cat.trim() });
      return C.api('memo_detail', { memoId: d.id });
    });
    if (!r) return;
    V2.teksHapus('mCat', d.id);
    taruh(r.defect); C.toast('Ditolak. Memo kembali ke PJ.'); C.openModal({ t: 'memo', r: r }); C.render(); muatDaftar();
  }

  /* ---------- tindak lanjut PJ ---------- */

  function tindakHtml(m) {
    var d = m.r.memo;
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Tindak lanjut"><h2>Tindak lanjut</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(d.kegiatan || d.lokasi) + '</div>' +
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Usulan rencana tindak lanjut<i>*</i></span><textarea id="tTL" style="min-height:130px" placeholder="Jelaskan perbaikan yang dilakukan atau direncanakan">' + esc(d.tindakLanjut || '') + '</textarea></label>' +
      '<label class="row"><span class="lbl">Nama penerima memo (PJ)</span><input type="text" id="tNm" value="' + esc(d.namaPenerima || C.S.user.nama || '') + '" autocomplete="off"></label></div></section>' +
      '<div class="gap"><button type="button" class="btn" data-act="memotindaksimpan">Simpan</button><button type="button" class="btn sec" data-act="memotutuptindak">Kembali</button></div></div></div>';
  }
  async function simpanTindak() {
    var m = C.S.modal, tl = $('tTL').value.trim(), nm = $('tNm').value.trim();
    if (!tl) { C.toast('Usulan tindak lanjut wajib diisi.'); return; }
    var r = await C.work('Menyimpan...', function () { return C.api('memo_tindak', { memoId: m.r.memo.id, tindakLanjut: tl, namaPenerima: nm }); });
    if (!r) return;
    V2.teksHapus('tTL', m.r.memo.id);
    taruh(r.defect); C.toast('Tindak lanjut tersimpan.'); C.openModal({ t: 'memo', r: r }); C.render(); muatDaftar();
  }

  /* ---------- daftar memo ---------- */

  function listHtml() {
    var all = D.daftar || [], ps = perlu(), lain = all.filter(function (x) { return !(x.aksi && x.aksi.length) && x.status !== 'CLOSE'; }), tutup = all.filter(function (x) { return x.status === 'CLOSE'; });
    var item = function (x) {
      var hint = (x.aksi || []).map(function (a) { return HINT[a]; }).filter(function (v) { return v; });
      return '<button type="button" class="mli" data-act="memolihat" data-m="' + esc(x.id) + '"><div><b>' + esc(x.noMemo ? nomorSaja(x.noMemo) : 'Draf') + '</b><span>' + esc((x.kodeBidang ? x.kodeBidang + ' · ' : '') + (x.kegiatan || x.lokasi || x.bidang)) + '</span>' + (hint.length && !C.isAdmin() ? '<em>' + esc(hint.join(', ')) + '</em>' : '') + '</div><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span></button>';
    };
    var blok = function (jd, arr) { return arr.length ? '<div class="cap" style="margin:6px 4px 6px">' + jd + ' (' + arr.length + ')</div><div class="mlis">' + arr.map(item).join('') + '</div>' : ''; };
    var isi = C.isAdmin() ? blok('Memo berjalan', all.filter(function (x) { return x.status !== 'CLOSE'; })) + blok('Close', tutup) : blok('Perlu tindakan Anda', ps) + blok('Berjalan', lain) + blok('Close', tutup);
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Daftar memo"><div class="grab" aria-hidden="true"></div><h2>Memo</h2>' +
      (D.daftar === null ? '<div class="note" style="padding:0">Memuat...</div>' : (isi || '<div class="empty">Belum ada site memo.</div>')) +
      '<div class="gap"><button type="button" class="btn sec" data-act="memosegar">' + C.ic('refresh') + 'Muat ulang</button><button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div></div>';
  }

  /* ---------- tanda tangan QC ---------- */

  function ttdHtml(m) {
    var gambar = m.mode === 'gambar';
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Tanda tangan"><div class="grab" aria-hidden="true"></div><h2>' + (m.hid ? 'Tanda tangan ' + esc(m.akun) : 'Tanda tangan') + '</h2>' +
      '<div class="note" style="padding:0">' + (m.hid ? 'Anda menyetel nama cetak dan tanda tangan akun QC ini. Dipakai saat QC mengesahkan, atau saat Admin mengesahkan atas namanya.' : 'Dipakai saat Anda mengesahkan site memo. Tersimpan di akun Anda.') + ' Memo yang sudah disahkan tidak berubah bila tanda tangan diganti.</div>' +
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Nama yang dicetak<i>*</i></span><input type="text" id="tNama" value="' + esc(m.nama) + '" autocomplete="off"></label>' +
      '<label class="row"><span class="lbl">Jabatan</span><input type="text" id="tJab" value="' + esc(m.jabatan) + '" placeholder="cth: QC Struktur atau TA HSE" autocomplete="off"></label></div></section>' +
      (gambar ? '<div class="ttdbox"><canvas id="ttdCv" width="560" height="224" aria-label="Kotak menggambar tanda tangan"></canvas></div><div class="btnrow"><button type="button" class="btn sec" data-act="ttdbersih">Bersihkan</button><button type="button" class="btn" data-act="ttdselesai">Selesai</button></div>' :
        '<div class="ttdbox pv">' + (m.img ? '<img alt="Tanda tangan" src="' + esc(m.img) + '">' : '<span>Belum ada tanda tangan</span>') + '</div>' +
        '<div class="btnrow"><button type="button" class="btn sec" data-act="ttdgambar">' + C.ic('pena') + 'Gambar</button><button type="button" class="btn sec" data-act="ttdunggah">' + C.ic('img') + 'Unggah PNG</button></div>' +
        '<input type="file" id="ttdFile" accept="image/*" hidden>' +
        '<div class="gap"><button type="button" class="btn" data-act="ttdsimpan"' + (m.img || m.hid ? '' : ' disabled') + '>Simpan</button><button type="button" class="btn sec" data-act="' + (m.hid ? 'ttdqckembali' : 'mtutup') + '">' + (m.hid ? 'Kembali' : 'Tutup') + '</button></div>') + '</div></div>';
  }
  async function bukaTtd() {
    var r = await C.work('Memuat...', function () { return C.api('ttd_saya'); });
    if (r) C.openModal({ t: 'ttd', nama: r.nama || C.S.user.nama || '', jabatan: r.jabatan || '', img: r.gambar || '', mode: '' });
  }
  function bacaNama(m) { var a = $('tNama'), b = $('tJab'); if (a) m.nama = a.value; if (b) m.jabatan = b.value; }
  /* Menghapus latar putih, memangkas ke bagian bertinta, dan memperkecil sampai muat (maks 400 x 160 px, 44.000 karakter). */
  function olahGambar(cv, hapusPutih) {
    var w = cv.width, h = cv.height, x = cv.getContext('2d'), id = x.getImageData(0, 0, w, h), p = id.data, x0 = w, y0 = h, x1 = -1, y1 = -1, i, k, xx, yy;
    for (i = 0; i < p.length; i += 4) {
      if (hapusPutih && p[i + 3] > 0) {
        var lum = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000;
        if (lum > 225) p[i + 3] = 0; else if (lum > 170) p[i + 3] = Math.round(p[i + 3] * (225 - lum) / 55);
      }
      if (p[i + 3] > 24) { k = i / 4; xx = k % w; yy = (k - xx) / w; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    if (x1 < 0) return null;
    x.putImageData(id, 0, 0);
    x0 = Math.max(0, x0 - 6); y0 = Math.max(0, y0 - 6); x1 = Math.min(w - 1, x1 + 6); y1 = Math.min(h - 1, y1 + 6);
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, sk = Math.min(400 / cw, 160 / ch, 1), url;
    for (;;) {
      var o = document.createElement('canvas'); o.width = Math.max(1, Math.round(cw * sk)); o.height = Math.max(1, Math.round(ch * sk));
      o.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, o.width, o.height);
      url = o.toDataURL('image/png');
      if (url.length <= 44000 || o.width <= 80) break;
      sk *= 0.85;
    }
    return url.length <= 44000 ? url : null;
  }
  function pasangCanvas(cv) {
    var x = cv.getContext('2d'), gambar = false, last = null;
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = '#14206e';
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
    cv.addEventListener('pointerdown', function (e) { gambar = true; last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (er) { } x.beginPath(); x.arc(last.x, last.y, 1.6, 0, 7); x.fillStyle = '#14206e'; x.fill(); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!gambar) return; var p = pos(e); x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); last = p; e.preventDefault(); });
    var stop = function () { gambar = false; };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop); cv.addEventListener('pointerleave', stop);
  }
  function dariBerkas(file) {
    var m = C.S.modal; if (!m || m.t !== 'ttd') return;
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var sk = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * sk)); c.height = Math.max(1, Math.round(im.naturalHeight * sk));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      var out = olahGambar(c, true);
      if (!out) { C.toast('Gambar tanda tangan tidak terbaca atau terlalu besar. Coba foto yang lebih jelas.'); return; }
      bacaNama(m); m.img = out; m.berubah = true; C.renderOverlay();
    };
    im.onerror = function () { URL.revokeObjectURL(url); C.toast('Berkas bukan gambar yang bisa dibaca.'); };
    im.src = url;
  }
  async function simpanTtd() {
    var m = C.S.modal; bacaNama(m);
    if (!m.nama.trim()) { C.toast('Isi nama yang dicetak.'); return; }
    if (m.hid) {   // Admin menyetel akun QC lain; gambar dikirim hanya bila diganti
      var p = { hid: m.hid, nama: m.nama, jabatan: m.jabatan };
      if (m.berubah && m.img) p.gambar = m.img;
      var ra = await C.work('Menyimpan tanda tangan QC...', function () { return C.api('ttd_atur', p); });
      if (ra) { C.toast('Tanda tangan ' + m.akun + ' tersimpan.'); bukaDaftarQc(); }
      return;
    }
    var r = await C.work('Menyimpan tanda tangan...', function () { return C.api('ttd_simpan', { nama: m.nama, jabatan: m.jabatan, gambar: m.img }); });
    if (r) { C.toast('Tanda tangan tersimpan.'); C.closeModal(); }
  }
  /* Admin: daftar akun QC dan penyetelan tanda tangan serta nama cetaknya */
  async function bukaDaftarQc() {
    var d = await C.work('Memuat akun QC...', function () { return C.api('qc_daftar'); });
    if (d) C.openModal({ t: 'qcdaftar', daftar: d });
  }
  function qcdaftarHtml(m) {
    var NAMA_PERAN = { MK: 'QC MK', PJ: 'QC PJ' }, bid = { STR: 'Struktur', ARS: 'Arsitektur', MEEP: 'MEEP', INF: 'Infrastruktur', LSC: 'Lansekap', HSE: 'HSE', BGH: 'BGH', KOORD: 'Koordinator' };
    var baris = m.daftar.map(function (x) {
      return '<button type="button" class="mli" data-act="ttdqcpilih" data-h="' + esc(x.hid) + '"><div><b>' + esc(x.akun) + '</b><span>' + esc((x.ta && x.peran === 'MK' ? 'TA MK' : (NAMA_PERAN[x.peran] || x.peran)) + (x.qcBidang ? ' ' + (bid[x.qcBidang] || x.qcBidang) : '')) + '</span><span>Tercetak: ' + esc(x.nama || '(belum diisi)') + (x.jabatan ? ', ' + esc(x.jabatan) : '') + '</span></div><span class="tag ' + (x.adaTtd ? 'm-close' : 'm-belum') + '">' + (x.adaTtd ? 'Ada tanda tangan' : 'Belum ada') + '</span></button>';
    }).join('');
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Tanda tangan QC"><h2>Tanda tangan QC</h2><div class="note" style="padding:0">Setel tanda tangan dan nama cetak akun QC. Akun QC ditandai di sheet PENGGUNA (kolom QC dan QCBidang).</div>' +
      (baris ? '<div class="mlis">' + baris + '</div>' : '<div class="empty">Belum ada akun QC.</div>') + '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
  }
  /* ---------- tutup memo peralihan: cukup tanggal dan konfirmasi ---------- */
  function tutupHtml(m) {
    var d = m.r.memo;
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Tutup memo"><h2>Tutup memo?</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(pendek(d.noMemo) || d.noMemo) + '. ' + esc(d.kegiatan) + '</div>' +
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Tanggal penutupan</span><input type="date" id="mTutupTgl" value="' + esc(m.tgl || '') + '" max="' + esc(m.tgl || '') + '"></label></div></section>' +
      '<div class="note" style="padding:0">Status memo menjadi Close. Aksi ini tercatat atas nama Anda.</div>' +
      '<div class="gap"><button type="button" class="btn" data-act="memotutupkirim">Ya, tutup memo</button><button type="button" class="btn sec" data-act="memotutupbatal">Kembali</button></div></div></div>';
  }
  async function kirimTutup() {
    var m = C.S.modal; if (!m || m.t !== 'tutupperalihan') return;
    var tgl = ($('mTutupTgl') || {}).value || '';
    var r = await C.work('Menutup memo...', function () { return C.api('memo_tutup_peralihan', { memoId: m.r.memo.id, tglClose: tgl, konfirmasi: true }); });
    if (!r) return;
    C.toast('Memo ditutup.');
    D.daftar = null; C.openModal({ t: 'memo', r: r }); C.render(); muatDaftar();
  }
  /* ---------- PDF ---------- */

  function muatLogo(url) {
    if (!url) return Promise.resolve(null);
    if (LOGO[url]) return LOGO[url];
    return (LOGO[url] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); res({ url: c.toDataURL('image/png'), w: c.width, h: c.height }); };
      im.onerror = function () { res(null); };
      im.src = url;
    }));
  }
  /* mode 'before': memo sebagaimana diterbitkan (hanya tanda tangan MK Tahap I, tanpa tindak lanjut dan foto After). mode 'akhir': keadaan sekarang. */
  async function bangunPdf(r, mode) {
    await C.loadLib(C.PDF_URL, 'jspdf');
    var m = r.memo, df = r.defect, tt = r.ttd, lg = (C.S.paket && C.S.paket.logo) || {}, awal = mode === 'before';
    var logo = { owner: await muatLogo(lg.owner), mk: await muatLogo(lg.mk), pj: await muatLogo(lg.pj) };
    var ttd = {}, slots = awal ? ['MK1'] : ['MK1', 'PJ1', 'MK2', 'PJ2'];
    for (var i = 0; i < slots.length; i++) {
      var t = tt[slots[i]]; if (!t) continue;
      ttd[slots[i]] = { nama: t.nama, jabatan: t.jabatan, tanggal: tglId(t.waktu), img: t.gambar ? await C.imgSize(t.gambar) : null };
    }
    var idB = (m.fotoBefore || []).map(function (f) { return f.id; }).slice(0, 4), idA = awal ? [] : (df.fotoAfter || []).map(function (f) { return f.id; }).slice(0, 4);
    var semua = idB.concat(idA);
    semua.forEach(function (id) { if (C.S.img[id] && C.S.img[id].fail) delete C.S.img[id]; });   // foto yang gagal sebelumnya dicoba lagi
    if (semua.length) await C.fetchImgs(semua, function () { });
    var gm = function (ids) { return ids.map(function (id) { return C.S.img[id]; }).filter(function (x) { return x && !x.fail; }); };
    var data = {
      noMemo: m.noMemo, tglPengajuan: m.tglPengajuan, noKontrak: m.noKontrak, tglKontrak: m.tglKontrak, namaPaket: m.namaPaket, namaProyek: m.namaProyek,
      bidang: m.bidang, kegiatan: m.kegiatan, lokasi: m.lokasi, info: m.info, jenis: m.jenis, jenisLain: m.jenisLain, referensi: m.referensi,
      kondisiAktual: m.kondisiAktual, kondisiSeharusnya: m.kondisiSeharusnya, diajukanNama: (tt.MK1 && tt.MK1.nama) || m.diajukanNama, konsultanMk: m.konsultanMk, kontraktor: m.kontraktor,
      tindakLanjut: awal ? '' : m.tindakLanjut, namaPenerima: awal ? '' : m.namaPenerima,
      pemeriksaan: awal ? {} : { hasil: df.verifikasi === 'Diterima' ? 'Diterima' : df.verifikasi === 'Ditolak' ? 'Ditolak' : '', tanggal: tglId(df.tglVerif), catatan: df.catatan || '' },
      ttd: ttd, logo: logo, fotoBefore: gm(idB), fotoAfter: gm(idA)
    };
    var doc = root.MEMOPDF.bangun(root.jspdf.jsPDF, data);
    doc.fotoHilang = semua.length - data.fotoBefore.length - data.fotoAfter.length;   // foto yang tidak bisa dimuat
    return doc;
  }
  function namaBerkas(m, akhiran) {
    var s = /^(\d+)\/SM-([A-Z]+)/.exec(m.noMemo || '');
    return ((s ? 'SM-' + s[2] + '-' + s[1] : 'Draf memo') + (m.kegiatan ? ' ' + m.kegiatan : '') + (akhiran || '')).replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) + '.pdf';
  }
  async function lihatPdf() {
    var m = C.S.modal; if (!m || m.t !== 'memo') return;
    var r = m.r, doc = await C.work('Membuat PDF memo...', function () { return bangunPdf(r, 'akhir'); });
    if (doc) {
      C.showFile(namaBerkas(r.memo), doc.output('arraybuffer'), 'application/pdf');
      if (doc.fotoHilang) C.toast(doc.fotoHilang + ' foto belum termuat, jadi PDF ini tanpa foto itu. Coba lagi bila sinyal membaik.');
    }
  }
  /* Membuat PDF dan menyimpannya ke Drive. Memo tetap sah bila gagal; tombol "Arsipkan PDF" tersedia untuk mengulang. */
  async function arsipkan(r, jenis) {
    var ok = await C.work('Membuat dan menyimpan PDF memo...', async function () {
      var doc = await bangunPdf(r, jenis === 'before' ? 'before' : 'akhir');
      if (doc.fotoHilang) throw new Error(doc.fotoHilang + ' foto belum termuat. PDF arsip tidak dibuat tanpa foto.');
      var hasil = await C.api('memo_arsip', { memoId: r.memo.id, jenis: jenis, data: doc.output('datauristring') });
      if (jenis === 'before') r.memo.pdfBefore = hasil.id; else r.memo.pdfAfter = hasil.id;
      return true;
    });
    if (ok) C.toast('PDF memo (' + (jenis === 'before' ? 'Before' : 'After') + ') tersimpan di Drive.');
    else C.toast('Memo sudah tersimpan, tetapi PDF belum masuk Drive. Buka memo lalu tekan "Arsipkan PDF ke Drive".');
    if (C.S.modal && C.S.modal.t === 'memo') C.renderOverlay();
    return !!ok;
  }
  async function arsipkanUlang() {
    var m = C.S.modal; if (!m || m.t !== 'memo') return;
    var a = perluArsip(m.r);
    for (var i = 0; i < a.length; i++) await arsipkan(m.r, a[i]);
  }

  /* ---------- tab Memo (QC MK, QC PJ, dan PJ) ---------- */

  function punyaTab(u) { return !!u && (u.peran === 'ADMIN' || u.peran === 'PJ' || (u.peran === 'MK' && u.qc === 'YA')); }
  var TB = { semua: false, awal: false, pn: false, q: '', st: '', bd: '', mw: '', ur: 'hari' };   // tab Memo: semua false = hanya yang menunggu Anda (Admin langsung melihat semua); st, bd, mw = filter; ur = urutan
  var SLOT_PENDEK = { MK1: 'Tahap I', PJ1: 'Tanda terima', MK2: 'Tahap II', PJ2: 'Tahap II' };
  function dots(x) { return '<div class="mdots" aria-label="Tanda tangan">' + [['MK1', 'MK I'], ['PJ1', 'PJ I'], ['PJ2', 'PJ II'], ['MK2', 'MK II']].map(function (s) { return '<span class="' + (x.ttd && x.ttd[s[0]] ? 'on' : '') + '">' + s[1] + '</span>'; }).join('') + '</div>'; }
  function hariTag(x) { return x.hari > 0 && x.status !== 'CLOSE' && x.status !== 'BATAL' ? '<span class="tag hari' + (x.hari > 7 ? ' lama' : '') + '">' + x.hari + ' hari</span>' : ''; }
  function lokasiTeks(x) { return [x.gedung, x.lantai, x.ruangan].filter(Boolean).join(' / ') || x.lokasi; }
  function kartuMemo(x) {
    var jml = (x.aksi || []).filter(function (a) { return a !== 'tindak'; }).length, tombol = '';
    (x.aksi || []).slice(0, 1).forEach(function (a) {
      if (a === 'tindak') tombol += '<button type="button" class="pill start" data-act="memotindakcepat" data-m="' + esc(x.id) + '">' + C.ic('tindak') + 'Isi tindak lanjut</button>';
      else if (a === 'MK2') tombol += '<button type="button" class="pill go" data-act="memolihat" data-m="' + esc(x.id) + '">' + C.ic('centang') + 'Periksa' + (jml > 1 ? ' Tahap II' : '') + '</button>';
      else tombol += '<button type="button" class="pill go" data-act="memosahcepat" data-m="' + esc(x.id) + '" data-s="' + a + '">' + C.ic('centang') + 'Sahkan' + (jml > 1 ? ' ' + SLOT_PENDEK[a] : '') + '</button>';
    });
    return '<article class="group mcard tap" data-act="memolihat" data-m="' + esc(x.id) + '"><div class="eh"><span class="tx">' + esc(x.uraian || x.kegiatan || x.lokasi || x.bidang) + '</span></div>' +
      '<div class="note mkecil">' + esc([x.noMemo ? 'SM ' + (pendek(x.noMemo) || x.noMemo) : 'Draf', x.kegiatan, lokasiTeks(x)].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="meta"><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span><span class="tag">' + esc(x.bidang) + '</span>' + (x.tingkat ? '<span class="tag ' + esc(x.tingkat.toLowerCase()) + '">' + esc(x.tingkat) + '</span>' : '') + hariTag(x) + '</div>' +
      dots(x) +
      '<div class="note mmenunggu"><b>' + esc(x.menunggu ? x.menunggu.teks : '') + '</b></div>' +
      (tombol ? '<div class="acts satu">' + tombol + '</div>' : '') + '</article>';
  }
  var URUT_TAB = [['hari', 'Terlama', 'jam'], ['baru', 'Terbaru', 'tanggal'], ['no', 'Nomor', 'nomor']];
  function urutTab(list) {
    var f = TB.ur === 'baru' ? function (a, b) { return String(b.tglPengajuan || '').localeCompare(String(a.tglPengajuan || '')) || (a.hari || 0) - (b.hari || 0); }
      : TB.ur === 'no' ? function (a, b) { var x = KUNCI_URUT.no(a), y = KUNCI_URUT.no(b); if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1; return x - y || String(a.kodeBidang).localeCompare(String(b.kodeBidang)); }
      : function (a, b) { return (b.hari || 0) - (a.hari || 0); };
    return list.slice().sort(f);
  }
  function tabDasar() {
    var admin = C.isAdmin();
    if (admin && !TB.awal) { TB.awal = true; TB.semua = true; }   // Admin tidak punya antrean pribadi: langsung semua memo
    var semua = D.daftar.filter(function (x) { return x.status !== 'BATAL'; }), ps = perlu();
    return { admin: admin, semua: semua, ps: ps, dasar: admin || TB.semua ? semua : ps };
  }
  function tabTampil(d) {
    var q = TB.q.trim().toLowerCase();
    var cocok = function (x) {
      return (!TB.st || x.status === TB.st) && (!TB.bd || x.kodeBidang === TB.bd) && (!TB.mw || (x.menunggu && x.menunggu.orang === TB.mw && x.status !== 'CLOSE')) &&
        (!q || String([x.noMemo, x.kegiatan, x.lokasi, lokasiTeks(x), x.bidang, x.kodeBidang].join(' ')).toLowerCase().indexOf(q) >= 0);
    };
    return urutTab(d.dasar.filter(cocok));
  }
  function tabAktif() { return !!(TB.q.trim() || TB.st || TB.bd || TB.mw); }
  function tabIsi() {   // daftar kartu dan hitungan; dipasang ulang tanpa menyentuh kolom cari
    var d = tabDasar(), tampil = tabTampil(d);
    if (!tampil.length) return '<div class="empty">' + (tabAktif() ? 'Tidak ada memo yang cocok dengan filter.' : d.admin || TB.semua ? 'Belum ada site memo.' : 'Tidak ada memo yang menunggu Anda.') + '</div>';
    return '<div class="entgrid">' + tampil.map(kartuMemo).join('') + '</div>';
  }
  function tabHitung() {
    var d = tabDasar(); return tabAktif() ? tabTampil(d).length + ' dari ' + d.dasar.length + ' memo' : d.dasar.length + ' memo';
  }
  function tabHtml() {
    var h = '<div class="pagehead"><div class="cap">' + esc(C.S.paket.nama) + '</div><h1>Memo</h1></div>';
    if (D.daftar === null) return h + (D.off ? '<div class="err">Server belum mendukung site memo.</div>' : C.skel('entries'));
    var d = tabDasar(), admin = d.admin, semua = d.semua, ps = d.ps, dasar = d.dasar;
    var sel = function (k, lbl, pairs) {
      return '<label class="aqf"><span>' + lbl + '</span><select data-tb="' + k + '"><option value="">Semua</option>' + pairs.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === TB[k] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>';
    };
    var nf = (TB.st ? 1 : 0) + (TB.bd ? 1 : 0) + (TB.mw ? 1 : 0);
    var chips = admin ? '' : '<div class="chips stat" role="group" aria-label="Tampilan"><button type="button" class="chip' + (TB.semua ? '' : ' on') + '" data-act="memotabfilter" data-v="0">Perlu tindakan ' + ps.length + '</button><button type="button" class="chip' + (TB.semua ? ' on' : '') + '" data-act="memotabfilter" data-v="1">Semua memo ' + semua.length + '</button></div>';
    // bilah alat yang sama dengan Verifikasi dan Perbaikan: judul kecil, kolom cari dengan Filter di dalamnya, menu titik tiga, chip tampilan
    h += '<div class="tbar" id="tbar"><div class="sbar tb"><span class="mt" id="mtmt">' + (admin ? semua.length + ' memo' : ps.length + ' memo menunggu Anda') + '</span>' +
      '<label class="sinp' + (TB.q || TB.qo ? ' open' : '') + '" data-act="memocari">' + C.ic('search') + '<input type="text" id="mtq" data-tb-q="1" placeholder="Cari memo" autocomplete="off" value="' + esc(TB.q) + '">' +
      '<button type="button" class="fbtn' + (TB.pn || nf ? ' on' : '') + '" data-act="memotabpn" aria-expanded="' + !!TB.pn + '" aria-controls="mfpanel">Filter' + (nf ? ' &middot; ' + nf : '') + '</button></label>' +
      '<button type="button" class="btn-sq ic" data-act="memotabmenu" aria-label="Menu aksi" aria-expanded="' + !!TB.mn + '">&#8943;</button></div>' + chips + '</div>';
    if (TB.mn) h += '<div class="aqpanel" id="mmenu"><label class="aqf"><span>Urutan</span><select data-tb="ur" aria-label="Urutkan">' + URUT_TAB.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === TB.ur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label><button type="button" class="chip" data-act="memosegar2">Muat ulang</button></div>';
    if (TB.pn) h += '<div class="aqpanel" id="mfpanel">' + sel('st', 'Status', ST_URUT.map(function (st) { return [st, STAT[st]]; })) + sel('bd', 'Bidang', BID_KODE.map(function (b) { return [b[0], b[0]]; })) + sel('mw', 'Menunggu', ['QC MK', 'PJ', 'QC PJ'].map(function (o) { return [o, o]; })) + '</div>';
    h += '<div class="aqcnt"><span id="mtcount">' + esc(tabHitung()) + '</span>' + (tabAktif() ? '<button type="button" class="aqreset" data-act="memotabclr">Atur ulang</button>' : '') + '</div>';
    return h + '<div id="mtlist">' + tabIsi() + '</div>';
  }
  /* Satu ketuk dari kartu: langsung mengesahkan. Akun QC yang belum punya tanda tangan diarahkan ke layar tanda tangan. */
  async function sahkanCepat(memoId, slot) {
    var perluTtd = false;
    var h = await C.work('Mengesahkan...', async function () {
      try { return await C.api('memo_sahkan', { memoId: memoId, slot: slot }); }
      catch (e) { if (e && e.server && /Unggah tanda tangan/.test(e.message)) { perluTtd = true; return null; } throw e; }
    });
    if (!h) { if (perluTtd) { C.toast('Unggah tanda tangan Anda dulu.'); bukaTtd(); } return; }
    taruh(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    muatDaftar();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
  }

  /* ---------- Rekap > Memo (Admin dan MK) ---------- */

  function ukHal() { try { var v = parseInt(localStorage.getItem('dl-rkn'), 10); return [0, 10, 20, 50, 100].indexOf(v) >= 0 ? v : 20; } catch (e) { return 20; } }
  var RK = { bd: '', st: '', mw: '', lama: 0, hb: '', n: ukHal(), ur: '', ud: 1 };   // n: jumlah baris daftar (0 = semua); hb: kelompok lama menunggu (indeks LAMA_BKT)
  var LAMA_BKT = [['0 sampai 3 hari', 0, 3], ['4 sampai 7 hari', 4, 7], ['8 sampai 14 hari', 8, 14], ['Lebih dari 14 hari', 15, 99999]];   // ur: kolom urutan (kosong = urutan bawaan: yang berjalan dulu, terlama di atas), ud: 1 naik atau -1 turun
  var BID_KODE = [['ARS', 'Arsitektur'], ['STR', 'Struktur'], ['MEEP', 'MEEP'], ['INF', 'Infrastruktur'], ['LSC', 'Lansekap'], ['HSE', 'HSE'], ['BGH', 'BGH']];
  var ST_URUT = ['MENUNGGU TTD MK', 'TERBIT', 'TINDAK LANJUT', 'PEMERIKSAAN II', 'PERALIHAN', 'CLOSE'];
  function simpanMode(v) { try { localStorage.setItem('dl-rekap', v); } catch (e) { } }
  function rekapToggle() {
    if (!C.canEdit()) return '';
    var m = C.S.rekapMode === 'memo', n = D.daftar ? D.daftar.filter(function (x) { return x.status !== 'BATAL'; }).length : 0;
    return '<div class="chips rkmode" role="group" aria-label="Rekap"><button type="button" class="chip' + (m ? '' : ' on') + '" data-act="memorekapmode" data-v="temuan">Temuan</button><button type="button" class="chip' + (m ? ' on' : '') + '" data-act="memorekapmode" data-v="memo">Memo' + (n ? ' ' + n : '') + '</button></div>';
  }
  /* Urutan tabel Rekap Memo lewat klik judul kolom. Kolom Menunggu tidak diurutkan (teks bebas, tidak bermakna). Sel kosong selalu di bawah. */
  var KUNCI_URUT = {
    no: function (x) { var s = /^\s*(\d+)\s*\//.exec(String(x.noMemo || '')); return s ? parseInt(s[1], 10) : null; },
    bd: function (x) { return x.kodeBidang || null; },
    kg: function (x) { return (x.kegiatan || x.lokasi || '').toLowerCase() || null; },
    lk: function (x) { return (lokasiTeks(x) || '').toLowerCase() || null; },
    st: function (x) { var i = ST_URUT.indexOf(x.status); return i < 0 ? 99 : i; },
    mk1: function (x) { return (x.tgl && x.tgl.MK1) || null; }, pj1: function (x) { return (x.tgl && x.tgl.PJ1) || null; },
    mk2: function (x) { return (x.tgl && x.tgl.MK2) || null; }, pj2: function (x) { return (x.tgl && x.tgl.PJ2) || null; },
    hr: function (x) { return x.status === 'CLOSE' || x.status === 'BATAL' ? null : (x.hari || 0); }
  };
  var ARAH_AWAL = { mk1: -1, pj1: -1, mk2: -1, pj2: -1, hr: -1 };   // tanggal dan lama menunggu: yang terbaru atau terlama dulu pada klik pertama
  function urutkan(list) {
    var f = KUNCI_URUT[RK.ur]; if (!f) return list;
    return list.slice().sort(function (a, b) {
      var x = f(a), y = f(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      var c = typeof x === 'string' ? x.localeCompare(y, 'id', { numeric: true }) : x - y;
      if (!c && RK.ur === 'no') c = String(a.kodeBidang).localeCompare(String(b.kodeBidang));
      return c * RK.ud;
    });
  }
  function th(k, label) {
    var on = RK.ur === k;
    return '<th class="srt' + (on ? ' on' : '') + '" data-act="memorkurut" data-k="' + k + '" aria-sort="' + (on ? (RK.ud === 1 ? 'ascending' : 'descending') : 'none') + '" title="Urutkan menurut ' + esc(label) + '">' + label + '<span class="ar" aria-hidden="true">' + (on ? (RK.ud === 1 ? '&#9650;' : '&#9660;') : '&#8693;') + '</span></th>';
  }
  function rekapFilter() {
    var all = (D.daftar || []).filter(function (x) { return C.isAdmin() || x.status !== 'BATAL'; });
    var hasil = all.filter(function (x) { return (!RK.bd || x.kodeBidang === RK.bd) && (!RK.st || x.status === RK.st) && (!RK.mw || (x.menunggu && x.menunggu.orang === RK.mw)) && (!RK.lama || x.hari > 7) && (RK.hb === '' || (x.status !== 'CLOSE' && x.status !== 'BATAL' && x.hari >= LAMA_BKT[+RK.hb][1] && x.hari <= LAMA_BKT[+RK.hb][2])); })
      .sort(function (a, b) { var sa = (a.status === 'CLOSE' || a.status === 'BATAL') ? 1 : 0, sb = (b.status === 'CLOSE' || b.status === 'BATAL') ? 1 : 0; return sa - sb || (b.hari || 0) - (a.hari || 0); });
    return urutkan(hasil);
  }
  /* Filter aktif tampil sebagai pil yang bisa diketuk untuk dicabut; menyaring dilakukan lewat kartu di atas daftar. */
  function filterBar() {
    var a = [];
    if (RK.bd) a.push(['bd', RK.bd, 'Bidang ' + RK.bd]);
    if (RK.st) a.push(['st', RK.st, 'Status ' + (STAT[RK.st] || RK.st)]);
    if (RK.mw) a.push(['mw', RK.mw, 'Menunggu ' + RK.mw]);
    if (RK.lama) a.push(['lama', '1', 'Lebih dari 7 hari']);
    if (RK.hb !== '') a.push(['hb', RK.hb, LAMA_BKT[+RK.hb][0]]);
    if (!a.length) return '<div class="rknote" style="padding:0 4px 8px">Ketuk kartu di atas untuk menyaring daftar.</div>';
    return '<div class="chips rkaktif" role="group" aria-label="Filter aktif">' + a.map(function (c) { return '<button type="button" class="chip on" data-act="memorkfilter" data-k="' + c[0] + '" data-v="' + esc(c[1]) + '" aria-label="Cabut filter ' + esc(c[2]) + '">' + esc(c[2]) + ' &times;</button>'; }).join('') + '<button type="button" class="chip" data-act="memorkclear">Hapus semua</button></div>';
  }
  function halBar() {
    return '<div class="chips rkhal" role="group" aria-label="Jumlah baris"><span class="rkhl">Tampilkan</span>' + [10, 20, 50, 100, 0].map(function (n) { return '<button type="button" class="chip' + (RK.n === n ? ' on' : '') + '" data-act="memorkn" data-v="' + n + '" aria-pressed="' + (RK.n === n) + '">' + (n || 'Semua') + '</button>'; }).join('') + '</div>';
  }
  function tgl2(iso) { var s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] : ''; }
  /* Dashboard Rekap > Memo untuk layar lebar (>= 1100 px): kartu bento seperti Rekap temuan, dengan daftar tabel lengkap tanggal tanda tangan. */
  function rekapBentoHtml() {
    var kepala = function (isi) {
      return '<div class="bhead"><div><h1>Rekap memo</h1><div class="bsub">' + esc(C.S.paket.nama) + '</div></div><div class="bact"><button type="button" class="pill" data-act="memoexcel">' + C.ic('excel') + 'Unduh Excel</button></div></div>' + isi;
    };
    if (D.daftar === null) return kepala(D.off ? '<div class="err">Server belum mendukung site memo.</div>' : '<div class="rknote">Memuat...</div>');
    var all = D.daftar.filter(function (x) { return C.isAdmin() || x.status !== 'BATAL'; }), aktif = all.filter(function (x) { return x.status !== 'BATAL'; });
    var jalan = aktif.filter(function (x) { return x.status !== 'CLOSE'; });
    var n = function (st) { return aktif.filter(function (x) { return x.status === st; }).length; };
    var tot = aktif.length, close = n('CLOSE'), draf = n('MENUNGGU TTD MK'), berjalan = tot - close - draf;
    var p = function (v) { return tot ? v / tot * 100 : 0; };
    var bar = function (pc, w) { return '<div class="rkbar"><i style="width:' + Math.max(0, Math.min(100, pc)) + '%;background:var(--' + (w || 'blue') + ')"></i></div>'; };
    var maks = function (a) { return Math.max(1, Math.max.apply(null, a)); };
    var h = '<div class="bgrid">';
    h += '<section class="bc s6"><div class="cap">Progres memo</div><div class="bigp"><b>' + Math.round(p(close)) + '%</b><span><strong>selesai (Close)</strong>' + close + ' dari ' + tot + ' memo</span></div>' +
      '<div class="stk"><i style="width:' + p(close) + '%;background:var(--green)"></i><i style="width:' + p(berjalan) + '%;background:var(--orange)"></i><i style="width:' + p(draf) + '%;background:var(--red)"></i></div>' +
      '<div class="tiles"><div class="tl o"><b>' + draf + '</b><span>Menunggu TTD MK</span></div><div class="tl p"><b>' + berjalan + '</b><span>Berjalan</span></div><div class="tl c"><b>' + close + '</b><span>Close</span></div></div></section>';
    var bc = BID_KODE.map(function (b) { var l = aktif.filter(function (x) { return x.kodeBidang === b[0]; }); return { k: b[0], n: l.length, c: l.filter(function (x) { return x.status === 'CLOSE'; }).length }; }), mx = maks(bc.map(function (x) { return x.n; }));
    h += '<section class="bc s3"><div class="cap">Per bidang</div>' + bc.map(function (x) { return '<button type="button" class="rkrow lb lnkrow' + (RK.bd === x.k ? ' on' : '') + '" data-act="memorkfilter" data-k="bd" data-v="' + x.k + '"><b>' + x.k + '</b>' + bar(x.n / mx * 100) + '<span>' + x.c + '/' + x.n + '</span></button>'; }).join('') + '<div class="rknote">Close dari total memo. Ketuk untuk menyaring</div></section>';
    var lama7 = jalan.filter(function (x) { return x.hari > 7; }).length;
    h += '<section class="bc s3 hi"><div class="cap">Lebih dari 7 hari</div><b class="huge">' + lama7 + '</b><p>memo berjalan yang belum bergerak lebih dari seminggu</p><button type="button" class="pill" data-act="memorkfilter" data-k="lama" data-v="1">Lihat daftarnya &rsaquo;</button></section>';
    var siapa = ['QC MK', 'PJ', 'QC PJ'].map(function (o) { return { o: o, n: jalan.filter(function (x) { return x.menunggu && x.menunggu.orang === o; }).length }; }), mxs = maks(siapa.map(function (x) { return x.n; }));
    h += '<section class="bc s4"><div class="cap">Menunggu siapa</div>' + siapa.map(function (x) { return '<button type="button" class="rkrow lb lnkrow' + (RK.mw === x.o ? ' on' : '') + '" data-act="memorkfilter" data-k="mw" data-v="' + x.o + '"><b>' + x.o + '</b>' + bar(x.n / mxs * 100, 'orange') + '<span>' + x.n + '</span></button>'; }).join('') + '<div class="rknote">Ketuk untuk menyaring daftar</div></section>';
    h += '<section class="bc s4"><div class="cap">Alur status</div>' + ST_URUT.concat(C.isAdmin() ? ['BATAL'] : []).map(function (s) { var c = s === 'BATAL' ? all.length - tot : n(s); return '<button type="button" class="rkrow lb lnkrow' + (RK.st === s ? ' on' : '') + '" data-act="memorkfilter" data-k="st" data-v="' + s + '"><b>' + esc(STAT[s] || s) + '</b>' + bar(p(c), s === 'CLOSE' ? 'green' : s === 'BATAL' ? 'red' : 'blue') + '<span>' + c + '</span></button>'; }).join('') + '</section>';
    var bk = LAMA_BKT.map(function (b) { return { t: b[0], n: jalan.filter(function (x) { return x.hari >= b[1] && x.hari <= b[2]; }).length }; }), mxb = maks(bk.map(function (x) { return x.n; }));
    h += '<section class="bc s4"><div class="cap">Lama menunggu</div>' + bk.map(function (x, i) { return '<button type="button" class="rkrow lb lnkrow' + (RK.hb === String(i) ? ' on' : '') + '" data-act="memorkfilter" data-k="hb" data-v="' + i + '"><b>' + x.t + '</b>' + bar(x.n / mxb * 100, i > 1 ? 'red' : 'blue') + '<span>' + x.n + '</span></button>'; }).join('') + '<div class="rknote">Memo yang belum Close. Ketuk untuk menyaring</div></section>';
    var v = rekapFilter(), tampil = RK.n ? v.slice(0, RK.n) : v, fil = filterBar() + halBar();
    var td = function (x, s) { return '<td class="ttdc' + (x.tgl && x.tgl[s] ? ' on' : '') + '">' + (x.tgl && x.tgl[s] ? tgl2(x.tgl[s]) : '&ndash;') + '</td>'; };
    /* Kolom pratinjau dan unduh: Open = memo sebagaimana diterbitkan (sampai tanda tangan MK Tahap I, nomor sudah keluar); Close = memo lengkap setelah semua selesai. */
    var pdfSel = function (x, j) {
      var ada = !x.sumber && x.status !== 'BATAL' && (j === 'before' ? !!(x.noMemo && x.tgl && x.tgl.MK1) : x.status === 'CLOSE');
      if (!ada) return '<td class="pdfc">&ndash;</td>';
      var b = function (a, t) { return '<button type="button" class="pill pdfb" data-act="memorkpdf" data-m="' + esc(x.id) + '" data-j="' + j + '" data-a="' + a + '" aria-label="' + t + ' memo ' + (j === 'before' ? 'Open' : 'Close') + '" title="' + t + '">' + C.ic(a === 'lihat' ? 'mata' : 'unduh') + '</button>'; };
      return '<td class="pdfc">' + b('lihat', 'Lihat') + b('unduh', 'Unduh') + '</td>';
    };
    var kartuHp = !lebar() ? '<div class="mlis">' + (tampil.map(function (x) {
      var pdf = function (j, t) {
        var ada = !x.sumber && x.status !== 'BATAL' && (j === 'before' ? !!(x.noMemo && x.tgl && x.tgl.MK1) : x.status === 'CLOSE');
        return ada ? '<span class="mpdf"><em>' + t + '</em>' + ['lihat', 'unduh'].map(function (a) { return '<button type="button" class="pill pdfb" data-act="memorkpdf" data-m="' + esc(x.id) + '" data-j="' + j + '" data-a="' + a + '" aria-label="' + (a === 'lihat' ? 'Lihat' : 'Unduh') + ' memo ' + t + '">' + C.ic(a === 'lihat' ? 'mata' : 'unduh') + '</button>'; }).join('') + '</span>' : '';
      };
      return '<div class="mli" role="button" tabindex="0" data-act="memolihat" data-m="' + esc(x.id) + '"><div><b>' + esc(x.noMemo ? nomorSaja(x.noMemo) : 'Draf') + '</b><span>' + esc((x.kodeBidang ? x.kodeBidang + ' · ' : '') + (x.kegiatan || x.lokasi)) + '</span><span>' + esc(lokasiTeks(x)) + '</span>' + dots(x) +
        (x.menunggu && x.status !== 'CLOSE' && x.status !== 'BATAL' ? '<em>' + esc(x.menunggu.teks) + '</em>' : '') + pdf('before', 'Open') + pdf('akhir', 'Close') + '</div><div class="mr"><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span>' + hariTag(x) + '</div></div>';
    }).join('') || '<div class="empty">Tidak ada memo yang cocok.</div>') + '</div>' : '';
    var baris = tampil.map(function (x) {
      return '<tr data-act="memolihat" data-m="' + esc(x.id) + '"><td><b>' + esc(x.noMemo ? nomorSaja(x.noMemo) : 'Draf') + '</b></td><td>' + esc(x.kodeBidang) + '</td><td>' + potong(x.kegiatan || x.lokasi, 'kg') + '</td><td>' + potong(lokasiTeks(x), 'lk') + '</td>' +
        '<td><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span></td><td>' + potong(x.status === 'CLOSE' || x.status === 'BATAL' ? '' : (x.menunggu ? x.menunggu.teks : ''), 'mn') + '</td>' + td(x, 'MK1') + td(x, 'PJ1') + td(x, 'PJ2') + td(x, 'MK2') +
        '<td class="hr' + (x.hari > 7 && x.status !== 'CLOSE' && x.status !== 'BATAL' ? ' lama' : '') + '">' + (x.status === 'CLOSE' || x.status === 'BATAL' ? '' : x.hari) + '</td>' + pdfSel(x, 'before') + pdfSel(x, 'akhir') + '</tr>';
    }).join('');
    h += '<section class="bc s12" id="rkdaftar"><div class="bch"><div class="cap">Daftar memo (menampilkan ' + tampil.length + ' dari ' + v.length + (v.length !== all.length ? ', total ' + all.length : '') + ')</div></div>' + fil + (kartuHp ? kartuHp + '</section></div>' : '<div class="tw"><table class="t rkt mt"><thead><tr>' + th('no', 'No') + th('bd', 'Bid') + th('kg', 'Kegiatan') + th('lk', 'Lokasi') + th('st', 'Status') + '<th>Menunggu</th>' + th('mk1', 'MK I') + th('pj1', 'PJ I') + th('pj2', 'PJ II') + th('mk2', 'MK II') + th('hr', 'Hari') + '<th>Memo Open</th><th>Memo Close</th></tr></thead><tbody>' +
      (baris || '<tr><td colspan="13">Tidak ada memo yang cocok.</td></tr>') + '</tbody></table></div></section></div>');
    return kepala(h);
  }
  async function eksporExcel() {
    var v = rekapFilter();
    var ok = await C.work('Menyusun Excel...', async function () {
      await C.loadLib(C.XLSX_URL, 'XLSX');
      var X = root.XLSX, d10 = function (s) { return String(s || '').slice(0, 10); };
      var rows = [['No Memo', 'Tgl Pengajuan', 'Disiplin', 'Bidang', 'Kegiatan', 'Gedung', 'Lantai', 'Ruangan', 'Tingkat', 'Status', 'Menunggu', 'Hari menunggu', 'TTD MK Tahap I', 'TTD PJ Tanda terima', 'Tindak lanjut PJ', 'Verifikasi MK', 'TTD PJ Tahap II', 'TTD MK Tahap II']];
      v.forEach(function (x) {
        rows.push([x.noMemo, x.tglPengajuan, x.kodeBidang, x.bidang, x.kegiatan, x.gedung, x.lantai, x.ruangan, x.tingkat, STAT[x.status] || x.status, x.menunggu ? x.menunggu.teks : '', x.hari,
          d10(x.tgl && x.tgl.MK1), d10(x.tgl && x.tgl.PJ1), d10(x.tglTindak), x.verifikasi, d10(x.tgl && x.tgl.PJ2), d10(x.tgl && x.tgl.MK2)]);
      });
      var ws = X.utils.aoa_to_sheet(rows);
      ws['!cols'] = [46, 16, 9, 18, 30, 16, 12, 22, 9, 16, 44, 9, 14, 14, 14, 12, 14, 14].map(function (w) { return { wch: w }; });
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Site Memo');
      C.showFile('Rekap_Site_Memo_' + C.clean(C.S.paket.nama) + '_' + C.today() + '.xlsx', X.write(wb, { bookType: 'xlsx', type: 'array' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return true;
    });
    return !!ok;
  }

  /* ---------- kendali Admin: ubah, batalkan, hapus, cabut tanda tangan ---------- */

  function awalUbah(r) {
    var d = r.memo;
    return { tgl: '', bidang: d.bidang, kegiatan: d.kegiatan, lokasi: d.lokasi, info: d.info, jenis: d.jenis.slice(), jenisLain: d.jenisLain, ref: d.referensi.slice(), aktual: d.kondisiAktual, seharusnya: d.kondisiSeharusnya,
      foto: (d.fotoBefore || []).map(function (f) { return f.id; }), sahkan: false };
  }
  function bukaUbah(r) {
    C.openModal({ t: 'memoform', mode: 'ubah', r: r, d: r.defect, s: { opsi: { jenis: JENIS_MEMO, referensi: REF_MEMO }, fotoBefore: r.defect.fotoBefore || [], qc: { grup: '', sayaBisaMengesahkan: false } }, v: awalUbah(r) });
  }
  async function simpanUbah() {
    var m = C.S.modal; if (!m || m.mode !== 'ubah') return;
    bacaForm(m);
    var v = m.v;
    if (!v.lokasi.trim() || !v.aktual.trim() || !v.seharusnya.trim()) { C.toast('Lokasi, kondisi aktual, dan kondisi seharusnya wajib diisi.'); return; }
    var p = { memoId: m.r.memo.id, bidang: v.bidang, kegiatan: v.kegiatan, lokasi: v.lokasi, info: v.info, jenis: v.jenis, jenisLain: v.jenisLain, referensi: v.ref, kondisiAktual: v.aktual, kondisiSeharusnya: v.seharusnya, fotoBefore: v.foto };
    var r = await C.work('Menyimpan perubahan...', function () { return C.api('memo_ubah', p); });
    if (!r) return;
    V2.teksHapus('mAkt', m.r.memo.id); V2.teksHapus('mSeh', m.r.memo.id);
    taruh(r.defect);
    C.toast('Memo diperbarui.');
    C.openModal({ t: 'memo', r: r });
    C.render();
    var ulang = r.arsipUlang || [];
    for (var i = 0; i < ulang.length; i++) await arsipkan(r, ulang[i]);
    muatDaftar();
  }
  var YAKIN = {
    batal: ['Batalkan memo?', 'Temuan kembali ke alur biasa dan boleh dinaikkan lagi dengan memo baru. Nomor memo ini tidak dipakai ulang.', 'Ya, batalkan'],
    hapus: ['Hapus memo permanen?', 'Memo, tanda tangan, dan arsip PDF-nya dihapus dan tidak bisa dikembalikan. Nomor memo ini tidak dipakai ulang.', 'Ya, hapus'],
    cabut: ['Batalkan tanda tangan?', '', 'Ya, batalkan']
  };
  function yakinHtml(m) {
    var y = YAKIN[m.kind], d = m.r.memo, ket = y[1] || ('Tanda tangan ' + namaSlot(m.slot, d.kodeBidang) + ' dibatalkan dan status memo mundur satu tahap. Nomor memo tetap; tanda tangan bisa dibubuhkan lagi.');
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Konfirmasi"><h2>' + y[0] + '</h2>' +
      '<div class="note" style="padding:0"><b>' + esc(d.noMemo ? 'SM ' + pendek(d.noMemo) : 'Draf memo') + '</b> &middot; ' + esc(d.kegiatan || d.lokasi) + '</div><div class="note" style="padding:0">' + esc(ket) + '</div>' +
      '<div class="gap"><button type="button" class="btn bad" data-act="memoyakinya">' + y[2] + '</button><button type="button" class="btn sec" data-act="memoyakinbatal">Kembali</button></div></div></div>';
  }
  async function jalankanYakin() {
    var m = C.S.modal; if (!m || m.t !== 'memoyakin') return;
    var id = m.r.memo.id, d = m.r.defect;
    if (m.kind === 'cabut') {
      var h = await C.work('Membatalkan tanda tangan...', function () { return C.api('memo_cabut_ttd', { memoId: id, slot: m.slot, konfirmasi: true }); });
      if (!h) return;
      taruh(h.defect); C.toast('Tanda tangan dibatalkan.' + ((h.arsipBasi || []).length ? ' PDF After lama belum sesuai; arsipkan ulang setelah disahkan lagi.' : ''));
      C.openModal({ t: 'memo', r: h }); C.render(); muatDaftar(); return;
    }
    var aksi = m.kind === 'batal' ? 'memo_batal' : 'memo_hapus';
    var r = await C.work(m.kind === 'batal' ? 'Membatalkan memo...' : 'Menghapus memo...', function () { return C.api(aksi, { memoId: id, konfirmasi: true }); });
    if (!r) return;
    C.toast(m.kind === 'batal' ? 'Memo dibatalkan.' : 'Memo dihapus.');
    C.closeModal();
    C.S.all = null; C.S.siap = null; C.S.perlu = null;
    if (d && d.ruanganId) C.loadDefects(d.ruanganId, true);
    C.render(); muatDaftar();
  }

  /* ---------- pratinjau PDF di dalam aplikasi (pdf.js, dimuat saat pertama dibuka) ---------- */

  async function muatPdfJs() {
    await C.loadLib('lib/pdf.min.js', 'pdfjsLib');
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    return root.pdfjsLib;
  }
  /* PDF dari isian form (belum ada memo di server): memo sebagaimana akan diterbitkan, tanpa tanda tangan dan foto After. */
  async function bangunPdfDraf(m) {
    var v = m.v, i = m.s.isian;
    var fake = { memo: { noMemo: '', tglPengajuan: tglId(v.tgl), noKontrak: i.noKontrak, tglKontrak: i.tglKontrak, namaPaket: i.namaPaket, namaProyek: i.namaProyek, bidang: v.bidang, kegiatan: v.kegiatan, lokasi: v.lokasi,
      info: v.info, jenis: v.jenis, jenisLain: v.jenisLain, referensi: v.ref, kondisiAktual: v.aktual, kondisiSeharusnya: v.seharusnya, diajukanNama: '', konsultanMk: i.konsultanMk, kontraktor: i.kontraktor,
      fotoBefore: v.foto.map(function (id) { return { id: id }; }), tindakLanjut: '', namaPenerima: '' }, defect: m.d, ttd: {} };
    return bangunPdf(fake, 'before');
  }
  function slotSahkan(r) {   // slot yang bisa disahkan akun ini (bukan Admin, yang memilih QC di rincian)
    if (C.isAdmin()) return '';
    var urut = ['MK1', 'PJ1', 'MK2', 'PJ2'];
    for (var i = 0; i < urut.length; i++) if (r.bisa[urut[i]] && r.bisa[urut[i]].ok) return urut[i];
    return '';
  }
  /* Rekap Memo: pratinjau atau unduh PDF memo Open (sampai Tahap I) dan Close (lengkap) langsung dari baris tabel. */
  async function rkPdf(id, j, aksi) {
    var r = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: id }); });
    if (!r) return;
    taruh(r.defect);
    if (j === 'akhir' && r.memo.status !== 'CLOSE') { C.toast('Memo ini belum Close.'); return; }
    if (j === 'before' && !(r.ttd && r.ttd.MK1)) { C.toast('Memo ini belum disahkan Tahap I.'); return; }
    var mode = j === 'before' ? 'before' : 'akhir', akh = j === 'before' ? ' (Open)' : ' (Close)';
    if (aksi === 'lihat') return bukaPratinjau({ mode: 'detail', r: r, pdfMode: mode, dari: 'rekap', akhiran: akh });
    var doc = await C.work('Membuat PDF memo...', function () { return bangunPdf(r, mode); });
    if (!doc) return;
    C.showFile(namaBerkas(r.memo, akh), doc.output('arraybuffer'), 'application/pdf');
    if (doc.fotoHilang) C.toast(doc.fotoHilang + ' foto belum termuat, jadi PDF ini tanpa foto itu. Coba lagi bila sinyal membaik.');
  }
  async function bukaPratinjau(o) {
    var t0 = performance.now();
    var doc = await C.work('Membuat pratinjau...', function () { return o.mode === 'draf' ? bangunPdfDraf(o.form) : bangunPdf(o.r, o.pdfMode || 'akhir'); });
    if (!doc) return;
    var m = { t: 'memoprev', mode: o.mode, buf: doc.output('arraybuffer'), nama: o.mode === 'draf' ? 'Pratinjau memo.pdf' : namaBerkas(o.r.memo, o.akhiran), dari: o.dari || '', r: o.r || null, form: o.form || null, kanvas: [], zoom: false };
    root.__memoPrev = { bangun: Math.round(performance.now() - t0), render: 0, halaman: 0 };
    D.pv = m;
    C.openModal(m);
    if (doc.fotoHilang) C.toast(doc.fotoHilang + ' foto belum termuat; pratinjau tanpa foto itu.');
  }
  function pvHtml(m) {
    var u = C.S.user, tombol;
    if (m.mode === 'draf') tombol = '<button type="button" class="btn" data-act="memopvlanjut">Lanjut ke konfirmasi</button><button type="button" class="btn sec" data-act="memopvtutup">Kembali ke form</button>';
    else {
      var slot = (m.r && !m.dari) ? slotSahkan(m.r) : '', sah = '';
      if (slot === 'MK2') slot = '';   // Terima atau Tolak hanya dari rincian memo
      if (slot) sah = (u && u.qc === 'YA' && !m.r.ttdSaya) ? '<button type="button" class="btn" data-act="ttd">' + C.ic('ubah') + 'Unggah tanda tangan dulu</button>' : '<button type="button" class="btn" data-act="memopvsahkan" data-s="' + slot + '">' + C.ic('centang') + 'Sahkan memo ini</button>';
      tombol = sah + '<button type="button" class="btn sec" data-act="memopvunduh">Unduh PDF</button><button type="button" class="btn sec" data-act="memopvtutup">Tutup</button>';
    }
    return '<div class="ov" data-act="modalbg"><div class="sheet pv gap" role="dialog" aria-label="Pratinjau memo"><div class="pvbar"><b>Pratinjau</b><button type="button" class="pill" data-act="memopvzoom">' + (m.zoom ? 'Perkecil' : 'Perbesar') + '</button></div>' +
      '<div class="pvwrap' + (m.zoom ? ' zoom' : '') + '" id="pvwrap"><div class="note" id="pvnote">Menggambar halaman...</div></div><div class="gap">' + tombol + '</div></div></div>';
  }
  /* Halaman digambar satu per satu supaya halaman pertama cepat tampil. Kanvas disimpan di state modal dan dipasang kembali bila overlay digambar ulang. */
  async function gambarHalaman(pv) {
    var t0 = performance.now();
    try {
      var L = await muatPdfJs();
      var pdf = await L.getDocument({ data: new Uint8Array(pv.buf.slice(0)), isEvalSupported: false }).promise;
      pv.pdf = pdf;
      for (var i = 1; i <= pdf.numPages; i++) {
        if (C.S.modal !== pv) return;
        var wrap = $('pvwrap'); if (!wrap) return;
        var page = await pdf.getPage(i), w = wrap.clientWidth || 360, vp0 = page.getViewport({ scale: 1 }), dpr = Math.min(root.devicePixelRatio || 1, 2) * 1.25;
        var vp = page.getViewport({ scale: (w / vp0.width) * dpr }), cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height); cv.className = 'pvpage'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Halaman ' + i + ' dari ' + pdf.numPages);
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        if (C.S.modal !== pv) return;
        pv.kanvas.push(cv);
        var w2 = $('pvwrap'), n = $('pvnote'); if (n) n.remove();
        if (w2) w2.appendChild(cv);
        if (root.__memoPrev) { root.__memoPrev.halaman = i; root.__memoPrev.render = Math.round(performance.now() - t0); }
      }
    } catch (e) {
      var n2 = $('pvnote'); if (n2) n2.textContent = 'Pratinjau tidak bisa ditampilkan. Gunakan Unduh PDF.';
      if (root.__memoPrev) root.__memoPrev.galat = String(e && e.message || e);
    }
  }
  function bersihPv(pv) { try { if (pv.pdf) pv.pdf.destroy(); } catch (e) { } pv.kanvas = []; pv.buf = null; pv.pdf = null; }
  function pasangPv() {
    var pv = D.pv, wrap = $('pvwrap');
    if (pv && C.S.modal !== pv) { bersihPv(pv); D.pv = null; return; }   // pratinjau ditutup: lepaskan memori
    if (!pv || !wrap) return;
    if (pv.kanvas.length) { var n = $('pvnote'); if (n) n.remove(); pv.kanvas.forEach(function (c) { wrap.appendChild(c); }); }
    if (!pv.mulai) { pv.mulai = true; gambarHalaman(pv); }
  }
  async function sahkanDariPv(slot) {
    var m = C.S.modal; if (!m || m.t !== 'memoprev') return;
    var perluTtd = false;
    var h = await C.work('Mengesahkan...', async function () {
      try { return await C.api('memo_sahkan', { memoId: m.r.memo.id, slot: slot }); }
      catch (e) { if (e && e.server && /Unggah tanda tangan/.test(e.message)) { perluTtd = true; return null; } throw e; }
    });
    if (!h) { if (perluTtd) { C.toast('Unggah tanda tangan Anda dulu.'); bukaTtd(); } return; }
    taruh(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    C.openModal({ t: 'memo', r: h }); C.render(); muatDaftar();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
  }

  /* ---------- pintu masuk dari app.js ---------- */

  function modalHtml(m) {
    if (m.t === 'memomuat') return muatHtml();
    if (m.t === 'memoform') return formHtml(m);
    if (m.t === 'memokonfirm') return konfirmHtml(m);
    if (m.t === 'memo') return detailHtml(m);
    if (m.t === 'memotindak') return tindakHtml(m);
    if (m.t === 'memolist') return listHtml();
    if (m.t === 'ttd') return ttdHtml(m);
    if (m.t === 'memoyakin') return yakinHtml(m);
    if (m.t === 'memoprev') return pvHtml(m);
    if (m.t === 'memolainnya') return lainnyaHtml(m);
    if (m.t === 'qcdaftar') return qcdaftarHtml(m);
    if (m.t === 'tutupperalihan') return tutupHtml(m);
    return '';
  }
  function sesudahOverlay() {
    pasangPv();
    var cv = $('ttdCv'); if (cv && !cv._b) { cv._b = 1; pasangCanvas(cv); }
    var f = $('ttdFile'); if (f && !f._b) { f._b = 1; f.addEventListener('change', function () { var fl = f.files && f.files[0]; f.value = ''; if (fl) dariBerkas(fl); }); }
  }
  async function klik(a, el) {
    var m = C.S.modal;
    /* aksi dari menu Lainnya: kembali ke rincian dulu, lalu jalankan seperti biasa */
    if (m && m.t === 'memolainnya' && /^(memopdf|memoarsip|memoubah|memobatal|memohapus)$/.test(a)) { C.openModal({ t: 'memo', r: m.r }); m = C.S.modal; }
    switch (a) {
      case 'memobuka': return buka(el.getAttribute('data-d'));
      case 'memofoto': {
        if (!m || m.t !== 'memoform') return;
        bacaForm(m);
        var id = el.getAttribute('data-f'), i = m.v.foto.indexOf(id);
        m.kotor = true;
        if (i >= 0) m.v.foto.splice(i, 1); else if (m.v.foto.length < 4) m.v.foto.push(id); else C.toast('Paling banyak 4 foto.');
        return segar();
      }
      case 'memolanjut': {
        if (!m || m.t !== 'memoform') return;
        bacaForm(m);
        var v = m.v;
        if (!v.lokasi.trim() || !v.aktual.trim() || !v.seharusnya.trim()) { C.toast('Lokasi, kondisi aktual, dan kondisi seharusnya wajib diisi.'); return; }
        return bukaPratinjau({ mode: 'draf', form: m });
      }
      case 'memopvlanjut': return m && m.form && C.openModal({ t: 'memokonfirm', d: m.form.d, s: m.form.s, v: m.form.v });
      case 'memopvtutup': return m && (m.mode === 'draf' ? C.openModal(m.form) : m.dari ? C.closeModal() : C.openModal({ t: 'memo', r: m.r }));
      case 'memorkpdf': return rkPdf(el.getAttribute('data-m'), el.getAttribute('data-j'), el.getAttribute('data-a'));
      case 'memopvsahkan': return sahkanDariPv(el.getAttribute('data-s'));
      case 'memopvunduh': return m && m.buf && C.showFile(m.nama, m.buf.slice(0), 'application/pdf');
      case 'memopvzoom': if (m && m.t === 'memoprev') { m.zoom = !m.zoom; C.renderOverlay(); } return;
      case 'memopratinjau': return m && m.t === 'memo' && bukaPratinjau({ mode: 'detail', r: m.r });
      case 'memopratinjaukartu': {
        var rp = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: el.getAttribute('data-m') }); });
        if (rp) { taruh(rp.defect); return bukaPratinjau({ mode: 'detail', r: rp }); }
        return;
      }
      case 'memokembali': return m && C.openModal({ t: 'memoform', d: m.d, s: m.s, v: m.v });
      case 'memoya': return m && m.t === 'memokonfirm' && kirimDraf(m);
      case 'memosah': return sahkan(el.getAttribute('data-s'));
      case 'memotolak': return tolak();
      case 'memolebih': { var bl = el.previousElementSibling, buka2 = bl.classList.toggle('klem'); el.textContent = buka2 ? 'Selengkapnya' : 'Tutup sebagian'; return; }
      case 'memotindak': return m && m.t === 'memo' && C.openModal({ t: 'memotindak', r: m.r });
      case 'memotutuptindak': return m && V2.tutup(function () { C.openModal({ t: 'memo', r: m.r }); });
      case 'memotindaksimpan': return simpanTindak();
      case 'memopdf': return lihatPdf();
      case 'memoarsip': return arsipkanUlang();
      case 'memolist': D.daftar = D.daftar || null; C.openModal({ t: 'memolist' }); return muatDaftar().then(function () { if (C.S.modal && C.S.modal.t === 'memolist') C.renderOverlay(); });
      case 'memosegar': D.daftar = null; C.renderOverlay(); return muatDaftar().then(function () { if (C.S.modal && C.S.modal.t === 'memolist') C.renderOverlay(); });
      case 'memolihat': return bukaDetail({ memoId: el.getAttribute('data-m') });
      case 'ttd': return bukaTtd();
      case 'ttdgambar': if (m && m.t === 'ttd') { bacaNama(m); m.mode = 'gambar'; C.renderOverlay(); } return;
      case 'ttdbersih': { var cv = $('ttdCv'); if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
      case 'ttdselesai': {
        var c2 = $('ttdCv'); if (!c2 || !m) return;
        var out = olahGambar(c2, false);
        if (!out) { C.toast('Belum ada coretan. Gambar tanda tangan Anda dulu.'); return; }
        bacaNama(m); m.img = out; m.berubah = true; m.mode = ''; return C.renderOverlay();
      }
      case 'ttdunggah': { var f = $('ttdFile'); if (f) f.click(); return; }
      case 'ttdsimpan': return simpanTtd();
      case 'ttdqc': return bukaDaftarQc();
      case 'ttdqckembali': return bukaDaftarQc();
      case 'ttdqcpilih': {
        var qq = m && m.daftar && m.daftar.filter(function (x) { return x.hid === el.getAttribute('data-h'); })[0];
        if (qq) C.openModal({ t: 'ttd', hid: qq.hid, akun: qq.akun, nama: qq.nama || qq.akun, jabatan: qq.jabatan, img: qq.gambar || '', mode: '' });
        return;
      }
      case 'memotabfilter': TB.semua = el.getAttribute('data-v') === '1'; return C.render();
      case 'memotabf': { var tk = el.getAttribute('data-k'), tv = el.getAttribute('data-v'); TB[tk] = TB[tk] === tv ? '' : tv; return C.render(); }
      case 'memotabpn': TB.pn = !TB.pn; return C.render();
      case 'memotabmenu': TB.mn = !TB.mn; return C.render();
      case 'memocari': { var tb0 = document.getElementById('tbar'); if (tb0 && tb0.classList.contains('min') && !TB.qo) { TB.qo = true; C.render(); var qi = document.getElementById('mtq'); if (qi) qi.focus(); } return; }
      case 'memotabclr': TB.q = ''; TB.st = ''; TB.bd = ''; TB.mw = ''; return C.render();
      case 'memotabur': TB.ur = el.getAttribute('data-v') || 'hari'; return C.render();
      case 'memosegar2': D.daftar = null; C.render(); return muatDaftar();
      case 'memosahcepat': return sahkanCepat(el.getAttribute('data-m'), el.getAttribute('data-s'));
      case 'memotindakcepat': {
        var r1 = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: el.getAttribute('data-m') }); });
        if (r1) { taruh(r1.defect); C.openModal({ t: 'memotindak', r: r1 }); }
        return;
      }
      case 'memorekapmode': C.S.rekapMode = el.getAttribute('data-v') === 'memo' ? 'memo' : 'temuan'; simpanMode(C.S.rekapMode); C.render(); if (C.S.rekapMode === 'memo') return muatDaftar(); return;
      case 'memoexcel': return eksporExcel();
      case 'memoubah': return m && m.t === 'memo' && bukaUbah(m.r);
      case 'memoubahsimpan': return simpanUbah();
      case 'memokembaliubah': return m && m.r && V2.tutup(function () { C.openModal({ t: 'memo', r: m.r }); });
      case 'memomundur': return m && m.r && C.openModal({ t: 'v2mundur', r: m.r, slot: '', alasan: '' });
      case 'memobukakembali': return m && m.r && C.openModal({ t: 'v2buka', r: m.r, d: m.r.defect });
      case 'memolokasi': return m && m.r && C.openModal({ t: 'v2lokasiadmin', r: m.r });
      case 'memotutupform': {
        var t0 = new Date(), tg = t0.getFullYear() + '-' + ('0' + (t0.getMonth() + 1)).slice(-2) + '-' + ('0' + t0.getDate()).slice(-2);
        return m && m.t === 'memo' && C.openModal({ t: 'tutupperalihan', r: m.r, tgl: tg });
      }
      case 'memotutupkirim': return kirimTutup();
      case 'memotutupbatal': return m && m.t === 'tutupperalihan' && C.openModal({ t: 'memo', r: m.r });
      case 'memobatal': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'batal', r: m.r });
      case 'memohapus': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'hapus', r: m.r });
      case 'memocabut': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'cabut', slot: el.getAttribute('data-s'), r: m.r });
      case 'memolainnya': return m && m.t === 'memo' && C.openModal({ t: 'memolainnya', r: m.r });
      case 'memorkurut': {   // klik pertama: urutan awal kolom; kedua: kebalikan; ketiga: kembali ke urutan bawaan
        var kk2 = el.getAttribute('data-k');
        if (RK.ur !== kk2) { RK.ur = kk2; RK.ud = ARAH_AWAL[kk2] || 1; }
        else if (RK.ud === (ARAH_AWAL[kk2] || 1)) RK.ud = -RK.ud;
        else { RK.ur = ''; RK.ud = 1; }
        return C.render();
      }
      case 'memorkfilter': {   // ketuk kartu: pasang filter; ketuk lagi kartu yang sama: cabut
        var kk = el.getAttribute('data-k'), nv = el.getAttribute('data-v');
        if (kk === 'lama') RK.lama = RK.lama ? 0 : 1; else RK[kk] = RK[kk] === nv ? '' : nv;
        C.render();
        var sd = $('rkdaftar'); if (sd && sd.scrollIntoView) sd.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      case 'memorkclear': RK.bd = ''; RK.st = ''; RK.mw = ''; RK.lama = 0; RK.hb = ''; return C.render();
      case 'memorkn': RK.n = parseInt(el.getAttribute('data-v'), 10) || 0; try { localStorage.setItem('dl-rkn', String(RK.n)); } catch (e) { } return C.render();
      case 'memoyakinya': return jalankanYakin();
      case 'memoyakinbatal': return m && m.r && C.openModal({ t: 'memo', r: m.r });
    }
  }

  /* Membuat ulang PDF arsip sesudah isi memo berubah di server. */
  async function arsipUlang(memoId, jenis) {
    var r = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: memoId }); });
    if (!r) return;
    for (var i = 0; i < jenis.length; i++) await arsipkan(r, jenis[i]);
  }

  root.MEMO = {
    init: function (konteks) {
      C = konteks;
      document.addEventListener('input', function (e) {   // cari di tab Memo: hanya daftar yang digambar ulang, kolom cari tetap fokus
        if (!e.target || !e.target.getAttribute || !e.target.getAttribute('data-tb-q')) return;
        TB.q = e.target.value; var l = document.getElementById('mtlist'), c = document.getElementById('mtcount');
        if (l) l.innerHTML = tabIsi(); if (c) c.textContent = tabHitung();
      });
      document.addEventListener('change', function (e) {   // filter dan urutan tab Memo
        var t = e.target && e.target.getAttribute && e.target.getAttribute('data-tb');
        if (t) { TB[t] = e.target.value; C.render(); }
      });
      document.addEventListener('change', function (e) {   // filter Rekap > Memo
        var k = e.target && e.target.getAttribute && e.target.getAttribute('data-rk');
        if (k) { RK[k] = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value; C.render(); }
      });
      return { kelas: kelas, legenda: legenda, punyaTab: punyaTab, tabHtml: tabHtml, arsipUlang: arsipUlang, rekapToggle: rekapToggle, rekapBentoHtml: rekapBentoHtml, tag: tag, ringkasMemo: ringkasMemo, kartuTombol: kartuTombol, tungguKartu: tungguKartu, aksiKartu: aksiKartu, buka: buka, setelanHtml: setelanHtml, punya: punya, milik: milik, modalHtml: modalHtml, sesudahOverlay: sesudahOverlay, klik: klik, muatDaftar: muatDaftar, jumlahPerlu: jumlahPerlu }; },
    /* untuk uji */
    _tglId: tglId, _pendek: pendek, _olahGambar: olahGambar
  };
})(typeof window !== 'undefined' ? window : this);
