/* Site memo di klien: tombol Memo pada kartu temuan, form kekurangan isian dengan konfirmasi, rincian memo (pengesahan QC, tindak lanjut PJ),
 * daftar memo, profil tanda tangan QC, dan pembuatan serta pengarsipan PDF dari perangkat. Logika server ada di Kode.gs (aksi memo_*, ttd_*).
 * app.js memanggil MEMO.init(konteks) sekali; modul ini tidak menyentuh state aplikasi selain lewat konteks itu. */
(function (root) {
  'use strict';

  var C = null;                         // konteks dari app.js
  var D = { daftar: null, off: false }; // daftar ringkas memo (memo_daftar); off = server belum punya aksi memo
  var LOGO = {};
  var BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var NAMA_SLOT = { MK1: 'QC MK, Tahap I', PJ1: 'QC PJ, tanda terima', MK2: 'QC MK, Tahap II', PJ2: 'QC PJ, Tahap II' };
  var HINT = { MK1: 'Sahkan memo', PJ1: 'Sahkan tanda terima', MK2: 'Sahkan Tahap II (MK)', PJ2: 'Sahkan Tahap II (PJ)', tindak: 'Isi tindak lanjut' };
  var STAT = { 'MENUNGGU TTD MK': 'Menunggu TTD MK', TERBIT: 'Terbit', 'TINDAK LANJUT': 'Tindak lanjut', 'PEMERIKSAAN II': 'Pemeriksaan II', CLOSE: 'Close', BATAL: 'Batal' };
  var MODAL = { memoform: 1, memokonfirm: 1, memo: 1, memotindak: 1, memolist: 1, ttd: 1 };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return C.esc(s); }
  function tglId(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + BLN[Number(m[2]) - 1] + ' ' + m[1] : String(iso || ''); }
  function pendek(no) { var m = /^(\d+)\/SM-([A-Z]+)/.exec(String(no || '')); return m ? m[2] + ' ' + m[1] : ''; }
  function stCls(st) { return st === 'CLOSE' ? 'close' : st === 'BATAL' ? 'open' : st === 'MENUNGGU TTD MK' ? '' : 'proses'; }
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
    if (!d || !d.memoId) return '';
    var lbl = d.noMemo ? 'SM ' + pendek(d.noMemo) : 'Draf memo';
    return '<button type="button" class="tag memo ' + stCls(d.memoStatus) + '" data-act="memobuka" data-d="' + esc(d.id) + '" aria-label="Site memo ' + esc(lbl) + '">' + C.ic('memo') + esc(lbl) + '</button>';
  }
  function bisaNaik(d) { return C.canEdit() && !d.memoId && d.status !== 'Close' && (C.isAdmin() || d.tingkat === 'Mayor' || d.tingkat === 'Kritis'); }
  function kartuTombol(d) {
    if (d.memoId || bisaNaik(d)) return '<button type="button" class="pill memo" data-act="memobuka" data-d="' + esc(d.id) + '">' + C.ic('memo') + 'Memo</button>';
    return '';
  }
  function setelanHtml() {
    var u = C.S.user, h = '', n = jumlahPerlu();
    if (!u) return '';
    if (C.canEdit() || C.isPJ()) h += '<button type="button" class="btn sec" data-act="memolist">' + C.ic('memo') + 'Memo' + (n ? ' (' + n + ')' : '') + '</button>';
    if (u.qc === 'YA') h += '<button type="button" class="btn sec" data-act="ttd">' + C.ic('ubah') + 'Tanda tangan</button>';
    return h ? '<div class="btnrow">' + h + '</div>' : '';
  }

  /* ---------- form kenaikan memo ---------- */

  function awalForm(s) {
    var i = s.isian;
    return { tgl: i.tglPengajuan, bidang: i.bidang, kegiatan: '', lokasi: i.lokasi, info: '-', jenis: [], jenisLain: '', ref: [], aktual: i.kondisiAktual, seharusnya: '',
      foto: (s.fotoBefore || []).slice(0, 4).map(function (f) { return f.id; }), sahkan: !!s.qc.sayaBisaMengesahkan };
  }
  function cekHtml(g, arr, sel) {
    return arr.map(function (x) { return '<label class="mchk"><input type="checkbox" data-g="' + g + '" value="' + esc(x) + '"' + (sel.indexOf(x) >= 0 ? ' checked' : '') + '><span>' + esc(x) + '</span></label>'; }).join('');
  }
  function formHtml(m) {
    var v = m.v, s = m.s, d = m.d;
    var row = function (id, lbl, val, tp, wajib) { return '<label class="row"><span class="lbl">' + lbl + (wajib ? '<i>*</i>' : '') + '</span><input type="' + (tp || 'text') + '" id="' + id + '" value="' + esc(val) + '" autocomplete="off"></label>'; };
    var area = function (id, lbl, val, ph) { return '<label class="row"><span class="lbl">' + lbl + '<i>*</i></span><textarea id="' + id + '" placeholder="' + esc(ph || '') + '" style="min-height:96px">' + esc(val) + '</textarea></label>'; };
    var fotos = (s.fotoBefore || []).map(function (f) {
      var on = v.foto.indexOf(f.id) >= 0;
      return '<button type="button" class="mfoto' + (on ? ' on' : '') + '" data-act="memofoto" data-f="' + esc(f.id) + '" aria-pressed="' + on + '"><img alt="Foto before" referrerpolicy="no-referrer" src="' + esc(C.thumb(f.id, 200)) + '">' + (on ? '<span class="n">' + (v.foto.indexOf(f.id) + 1) + '</span>' : '') + '</button>';
    }).join('');
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Memo"><div class="grab" aria-hidden="true"></div><h2>Memo</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(d.uraian) + '</div>' +
      '<div class="note" style="padding:0">Isian di bawah diambil dari temuan. Lengkapi yang belum terisi. Nomor memo keluar setelah ' + (s.qc.grup === 'KOORD' ? 'Koordinator QC MK' : 'QC ' + esc(s.qc.grup) + ' atau Koordinator QC MK') + ' mengesahkan.</div>' +
      '<section class="group"><div class="list">' + row('mTgl', 'Tanggal pengajuan', v.tgl, 'date') + row('mBid', 'Bidang pekerjaan', v.bidang) + row('mKeg', 'Kegiatan pekerjaan', v.kegiatan) + row('mLok', 'Lokasi pekerjaan', v.lokasi, 'text', true) + row('mInfo', 'Info lainnya', v.info) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Jenis ketidaksesuaian</span>' + cekHtml('jenis', s.opsi.jenis, v.jenis) + '</div>' + row('mJL', 'Jika memilih "Lainnya"', v.jenisLain) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Referensi</span>' + cekHtml('ref', s.opsi.referensi, v.ref) + '</div></div></section>' +
      '<section class="group"><div class="list">' + area('mAkt', 'Kondisi aktual', v.aktual, 'Jelaskan kondisi di lapangan') + area('mSeh', 'Kondisi seharusnya', v.seharusnya, 'Rujukan SNI, spesifikasi, atau standar') + '</div></section>' +
      (fotos ? '<section class="group"><div class="list"><div class="row"><span class="lbl">Foto before di memo (' + v.foto.length + ' dari 4)</span><div class="mfotos">' + fotos + '</div></div></div></section>' : '<div class="note" style="padding:0">Temuan ini belum punya foto before.</div>') +
      (s.qc.sayaBisaMengesahkan ? '<label class="mchk big"><input type="checkbox" id="mSah"' + (v.sahkan ? ' checked' : '') + '><span>Langsung sahkan dan beri nomor (Anda QC bidang ini)</span></label>' : '') +
      '<div class="gap"><button type="button" class="btn" data-act="memolanjut">' + C.ic('memo') + 'Lanjut</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>';
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
    C.putDefect(r.defect);
    C.toast(r.hasil && r.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(r.hasil.nomor) + '.' : 'Draf memo dibuat. Menunggu QC mengesahkan.');
    C.openModal({ t: 'memo', r: r });
    C.render();
    if (r.hasil && r.hasil.arsip) await arsipkan(r, r.hasil.arsip);
    muatDaftar();
  }

  /* ---------- rincian memo ---------- */

  async function bukaDetail(p) {
    var r = await C.work('Memuat memo...', function () { return C.api('memo_detail', p); });
    if (r) { C.putDefect(r.defect); C.openModal({ t: 'memo', r: r }); }
  }
  async function buka(id) {
    var d = C.findDefect(id); if (!d) return;
    if (d.memoId) return bukaDetail({ memoId: d.memoId });
    var s = await C.work('Memuat memo...', function () { return C.api('memo_siap', { id: id }); });
    if (!s) return;
    if (s.ada) { C.putDefect(s.detail.defect); return C.openModal({ t: 'memo', r: s.detail }); }
    C.openModal({ t: 'memoform', d: d, s: s, v: awalForm(s) });
  }
  function baris(l, v) { return v ? '<div class="mrow"><span>' + l + '</span><b>' + esc(v) + '</b></div>' : ''; }
  function perluArsip(r) {
    var d = r.memo, a = [];
    if (r.ttd.MK1 && !d.pdfBefore) a.push('before');
    if (d.status === 'CLOSE' && !d.pdfAfter) a.push('after');
    return a;
  }
  function detailHtml(m) {
    var r = m.r, d = r.memo, df = r.defect, u = C.S.user, h = '', bukanQc = !!(u && u.qc !== 'YA' && !C.isAdmin());
    h += '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Site memo"><div class="grab" aria-hidden="true"></div><h2>' + (d.noMemo ? 'SM ' + esc(pendek(d.noMemo)) : 'Draf site memo') + '</h2>' +
      '<div class="meta"><span class="tag ' + stCls(d.status) + '">' + esc(STAT[d.status] || d.status) + '</span><span class="tag">' + esc(d.bidang) + '</span></div>' +
      (d.noMemo ? '<div class="note mono" style="padding:0">' + esc(d.noMemo) + '</div>' : '');
    h += '<section class="group"><div class="list mlist">' + baris('Kegiatan', d.kegiatan) + baris('Lokasi', d.lokasi) + baris('Info', d.info && d.info !== '-' ? d.info : '') +
      baris('Jenis', d.jenis.concat(d.jenisLain ? ['(' + d.jenisLain + ')'] : []).join(', ')) + baris('Referensi', d.referensi.join(', ')) +
      baris('Kondisi aktual', d.kondisiAktual) + baris('Kondisi seharusnya', d.kondisiSeharusnya) +
      (d.tindakLanjut ? baris('Tindak lanjut PJ', d.tindakLanjut + (d.namaPenerima ? ' (penerima: ' + d.namaPenerima + ')' : '')) : '') +
      (df.verifikasi ? baris('Verifikasi MK', df.verifikasi + (df.tglVerif ? ' ' + tglId(df.tglVerif) : '') + (df.verifOleh ? ' oleh ' + df.verifOleh : '') + (df.catatan ? '. ' + df.catatan : '')) : '') + '</div></section>';
    if (bukanQc) h += '<div class="note" style="padding:0">Pengesahan memo dilakukan oleh QC.</div>';
    h += '<section class="group"><div class="list mttd">';
    ['MK1', 'PJ1', 'MK2', 'PJ2'].forEach(function (s) {
      var t = r.ttd[s], b = r.bisa[s], x;
      if (t) x = '<span class="ok">' + C.ic('centang') + '</span><div><b>' + esc(t.nama) + '</b><span>' + esc(t.jabatan) + ' &middot; ' + esc(tglId(t.waktu)) + (t.pelaksana ? ' &middot; disahkan oleh ' + esc(t.pelaksana) : '') + '</span></div>';
      else if (b && b.ok) {
        var sel = (b.kandidat && b.kandidat.length > 1) ? '<select id="mQid_' + s + '" class="mqid">' + b.kandidat.map(function (k) { return '<option value="' + esc(k.qid) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select>' : '';
        var perluTtd = u && u.qc === 'YA' && !r.ttdSaya && !C.isAdmin();
        x = '<div class="mact">' + sel + (perluTtd ? '<button type="button" class="pill" data-act="ttd">' + C.ic('ubah') + 'Unggah tanda tangan dulu</button>' : '<button type="button" class="pill go" data-act="memosah" data-s="' + s + '">' + C.ic('centang') + 'Sahkan</button>') + '</div>';
      } else x = '<span class="wait">' + esc(bukanQc ? 'Menunggu' : ((b && b.alasan) || 'Menunggu')) + '</span>';
      h += '<div class="mtr"><span class="sl">' + NAMA_SLOT[s] + '</span>' + x + '</div>';
    });
    h += '</div></section><div class="gap">';
    if (r.bisaTindak && r.bisaTindak.ok && d.status !== 'CLOSE' && d.status !== 'BATAL') h += '<button type="button" class="btn" data-act="memotindak">' + C.ic('ubah') + (d.tindakLanjut ? 'Ubah tindak lanjut' : 'Isi tindak lanjut') + '</button>';
    h += '<button type="button" class="btn sec" data-act="memopdf">' + C.ic('pdf') + 'PDF</button>';
    if (perluArsip(r).length) h += '<button type="button" class="btn sec" data-act="memoarsip">Arsipkan PDF ke Drive</button>';
    return h + '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div></div>';
  }
  async function sahkan(slot) {
    var m = C.S.modal; if (!m || m.t !== 'memo') return;
    var sel = $('mQid_' + slot), p = { memoId: m.r.memo.id, slot: slot };
    if (sel && sel.value) p.qid = sel.value;
    var h = await C.work('Mengesahkan...', function () { return C.api('memo_sahkan', p); });
    if (!h) return;
    C.putDefect(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    if (C.S.modal && C.S.modal.t === 'memo') { C.S.modal.r = h; C.renderOverlay(); }
    C.render();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
    muatDaftar();
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
    C.putDefect(r.defect); C.toast('Tindak lanjut tersimpan.'); C.openModal({ t: 'memo', r: r }); C.render(); muatDaftar();
  }

  /* ---------- daftar memo ---------- */

  function listHtml() {
    var all = D.daftar || [], ps = perlu(), lain = all.filter(function (x) { return !(x.aksi && x.aksi.length) && x.status !== 'CLOSE'; }), tutup = all.filter(function (x) { return x.status === 'CLOSE'; });
    var item = function (x) {
      var hint = (x.aksi || []).map(function (a) { return HINT[a]; }).filter(function (v) { return v; });
      return '<button type="button" class="mli" data-act="memolihat" data-m="' + esc(x.id) + '"><div><b>' + esc(x.noMemo ? 'SM ' + pendek(x.noMemo) : 'Draf memo') + '</b><span>' + esc(x.kegiatan || x.lokasi || x.bidang) + '</span>' + (hint.length && !C.isAdmin() ? '<em>' + esc(hint.join(', ')) + '</em>' : '') + '</div><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span></button>';
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
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Tanda tangan"><div class="grab" aria-hidden="true"></div><h2>Tanda tangan</h2>' +
      '<div class="note" style="padding:0">Dipakai saat Anda mengesahkan site memo. Tersimpan di akun Anda. Memo yang sudah disahkan tidak berubah bila Anda mengganti tanda tangan.</div>' +
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Nama yang dicetak<i>*</i></span><input type="text" id="tNama" value="' + esc(m.nama) + '" autocomplete="off"></label>' +
      '<label class="row"><span class="lbl">Jabatan</span><input type="text" id="tJab" value="' + esc(m.jabatan) + '" placeholder="cth: QC Struktur" autocomplete="off"></label></div></section>' +
      (gambar ? '<div class="ttdbox"><canvas id="ttdCv" width="560" height="224" aria-label="Kotak menggambar tanda tangan"></canvas></div><div class="btnrow"><button type="button" class="btn sec" data-act="ttdbersih">Bersihkan</button><button type="button" class="btn" data-act="ttdselesai">Selesai</button></div>' :
        '<div class="ttdbox pv">' + (m.img ? '<img alt="Tanda tangan" src="' + esc(m.img) + '">' : '<span>Belum ada tanda tangan</span>') + '</div>' +
        '<div class="btnrow"><button type="button" class="btn sec" data-act="ttdgambar">' + C.ic('pena') + 'Gambar</button><button type="button" class="btn sec" data-act="ttdunggah">' + C.ic('img') + 'Unggah PNG</button></div>' +
        '<input type="file" id="ttdFile" accept="image/*" hidden>' +
        '<div class="gap"><button type="button" class="btn" data-act="ttdsimpan"' + (m.img ? '' : ' disabled') + '>Simpan</button><button type="button" class="btn sec" data-act="mtutup">Tutup</button></div>') + '</div></div>';
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
      bacaNama(m); m.img = out; C.renderOverlay();
    };
    im.onerror = function () { URL.revokeObjectURL(url); C.toast('Berkas bukan gambar yang bisa dibaca.'); };
    im.src = url;
  }
  async function simpanTtd() {
    var m = C.S.modal; bacaNama(m);
    if (!m.nama.trim()) { C.toast('Isi nama yang dicetak.'); return; }
    var r = await C.work('Menyimpan tanda tangan...', function () { return C.api('ttd_simpan', { nama: m.nama, jabatan: m.jabatan, gambar: m.img }); });
    if (r) { C.toast('Tanda tangan tersimpan.'); C.closeModal(); }
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

  /* ---------- pintu masuk dari app.js ---------- */

  function modalHtml(m) {
    if (m.t === 'memoform') return formHtml(m);
    if (m.t === 'memokonfirm') return konfirmHtml(m);
    if (m.t === 'memo') return detailHtml(m);
    if (m.t === 'memotindak') return tindakHtml(m);
    if (m.t === 'memolist') return listHtml();
    if (m.t === 'ttd') return ttdHtml(m);
    return '';
  }
  function sesudahOverlay() {
    var cv = $('ttdCv'); if (cv && !cv._b) { cv._b = 1; pasangCanvas(cv); }
    var f = $('ttdFile'); if (f && !f._b) { f._b = 1; f.addEventListener('change', function () { var fl = f.files && f.files[0]; f.value = ''; if (fl) dariBerkas(fl); }); }
  }
  async function klik(a, el) {
    var m = C.S.modal;
    switch (a) {
      case 'memobuka': return buka(el.getAttribute('data-d'));
      case 'memofoto': {
        if (!m || m.t !== 'memoform') return;
        bacaForm(m);
        var id = el.getAttribute('data-f'), i = m.v.foto.indexOf(id);
        if (i >= 0) m.v.foto.splice(i, 1); else if (m.v.foto.length < 4) m.v.foto.push(id); else C.toast('Paling banyak 4 foto.');
        return segar();
      }
      case 'memolanjut': {
        if (!m || m.t !== 'memoform') return;
        bacaForm(m);
        var v = m.v;
        if (!v.lokasi.trim() || !v.aktual.trim() || !v.seharusnya.trim()) { C.toast('Lokasi, kondisi aktual, dan kondisi seharusnya wajib diisi.'); return; }
        return C.openModal({ t: 'memokonfirm', d: m.d, s: m.s, v: v });
      }
      case 'memokembali': return m && C.openModal({ t: 'memoform', d: m.d, s: m.s, v: m.v });
      case 'memoya': return m && m.t === 'memokonfirm' && kirimDraf(m);
      case 'memosah': return sahkan(el.getAttribute('data-s'));
      case 'memotindak': return m && m.t === 'memo' && C.openModal({ t: 'memotindak', r: m.r });
      case 'memotutuptindak': return m && C.openModal({ t: 'memo', r: m.r });
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
        bacaNama(m); m.img = out; m.mode = ''; return C.renderOverlay();
      }
      case 'ttdunggah': { var f = $('ttdFile'); if (f) f.click(); return; }
      case 'ttdsimpan': return simpanTtd();
    }
  }

  root.MEMO = {
    init: function (konteks) { C = konteks; return { tag: tag, kartuTombol: kartuTombol, setelanHtml: setelanHtml, punya: punya, milik: milik, modalHtml: modalHtml, sesudahOverlay: sesudahOverlay, klik: klik, muatDaftar: muatDaftar, jumlahPerlu: jumlahPerlu }; },
    /* untuk uji */
    _tglId: tglId, _pendek: pendek, _olahGambar: olahGambar
  };
})(typeof window !== 'undefined' ? window : this);
