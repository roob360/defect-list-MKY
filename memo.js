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
  var HINT = { MK1: 'Sahkan memo', PJ1: 'Sahkan tanda terima', MK2: 'Sahkan Tahap II (MK)', PJ2: 'Sahkan Tahap II (PJ)', tindak: 'Isi tindak lanjut' };
  var STAT = { 'MENUNGGU TTD MK': 'Menunggu TTD MK', TERBIT: 'Terbit', 'TINDAK LANJUT': 'Tindak lanjut', 'PEMERIKSAAN II': 'Pemeriksaan II', CLOSE: 'Close', BATAL: 'Batal' };
  var MODAL = { memoform: 1, memokonfirm: 1, memo: 1, memotindak: 1, memolist: 1, ttd: 1, memoyakin: 1, memoprev: 1 };
  var JENIS_MEMO = ['Kualitas', 'Material', 'Dimensi & Posisi (X,Y,Z)', 'Lainnya'];   // sama dengan Kode.gs
  var REF_MEMO = ['KPPK', 'RKS', 'Material yang disetujui', 'BQ', 'Drawing', 'Metoda Kerja/ WI/SOP', 'Spesifikasi'];

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
  function bisaNaik(d) { return C.canEdit() && !d.memoId && (C.isAdmin() || d.tingkat === 'Mayor' || d.tingkat === 'Kritis'); }
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
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Memo"><div class="grab" aria-hidden="true"></div><h2>' + (m.mode === 'ubah' ? 'Ubah memo' : 'Memo') + '</h2>' +
      '<div class="note" style="padding:0;overflow-wrap:anywhere">' + esc(d.uraian) + '</div>' +
      '<div class="note" style="padding:0">' + (m.mode === 'ubah' ? 'Ubah isian memo. Nomor memo tidak berubah. PDF yang sudah diarsipkan dibuat ulang setelah disimpan.' : 'Isian di bawah diambil dari temuan. Lengkapi yang belum terisi. Nomor memo keluar setelah ' + (s.qc.grup === 'KOORD' ? 'Koordinator QC MK' : 'QC ' + esc(s.qc.grup) + ' atau Koordinator QC MK') + ' mengesahkan.') + '</div>' +
      '<section class="group"><div class="list">' + (m.mode === 'ubah' ? '' : row('mTgl', 'Tanggal pengajuan', v.tgl, 'date')) + row('mBid', 'Bidang pekerjaan', v.bidang) + row('mKeg', 'Kegiatan pekerjaan', v.kegiatan) + row('mLok', 'Lokasi pekerjaan', v.lokasi, 'text', true) + row('mInfo', 'Info lainnya', v.info) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Jenis ketidaksesuaian</span>' + cekHtml('jenis', s.opsi.jenis, v.jenis) + '</div>' + row('mJL', 'Jika memilih "Lainnya"', v.jenisLain) + '</div></section>' +
      '<section class="group"><div class="list"><div class="row"><span class="lbl">Referensi</span>' + cekHtml('ref', s.opsi.referensi, v.ref) + '</div></div></section>' +
      '<section class="group"><div class="list">' + area('mAkt', 'Kondisi aktual', v.aktual, 'Jelaskan kondisi di lapangan') + area('mSeh', 'Kondisi seharusnya', v.seharusnya, 'Rujukan SNI, spesifikasi, atau standar') + '</div></section>' +
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
    var terakhir = ''; ['MK1', 'PJ1', 'MK2', 'PJ2'].forEach(function (s) { if (r.ttd[s]) terakhir = s; });
    ['MK1', 'PJ1', 'MK2', 'PJ2'].forEach(function (s) {
      var t = r.ttd[s], b = r.bisa[s], x;
      if (t) x = '<span class="ok">' + C.ic('centang') + '</span><div><b>' + esc(t.nama) + '</b><span>' + esc(t.jabatan) + ' &middot; ' + esc(tglId(t.waktu)) + (t.pelaksana ? ' &middot; disahkan oleh ' + esc(t.pelaksana) : '') + '</span></div>' + (C.isAdmin() && s === terakhir && d.status !== 'BATAL' ? '<button type="button" class="pill bad cb" data-act="memocabut" data-s="' + s + '">Cabut</button>' : '');
      else if (b && b.ok) {
        var sel = (b.kandidat && b.kandidat.length > 1) ? '<select id="mQid_' + s + '" class="mqid">' + b.kandidat.map(function (k) { return '<option value="' + esc(k.qid) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select>' : '';
        var perluTtd = u && u.qc === 'YA' && !r.ttdSaya && !C.isAdmin();
        x = '<div class="mact">' + sel + (perluTtd ? '<button type="button" class="pill" data-act="ttd">' + C.ic('ubah') + 'Unggah tanda tangan dulu</button>' : '<button type="button" class="pill go" data-act="memosah" data-s="' + s + '">' + C.ic('centang') + 'Sahkan</button>') + '</div>';
      } else x = '<span class="wait">' + esc(bukanQc ? 'Menunggu' : ((b && b.alasan) || 'Menunggu')) + '</span>';
      h += '<div class="mtr"><span class="sl">' + NAMA_SLOT[s] + '</span>' + x + '</div>';
    });
    h += '</div></section><div class="gap">';
    if (r.bisaTindak && r.bisaTindak.ok && d.status !== 'CLOSE' && d.status !== 'BATAL') h += '<button type="button" class="btn" data-act="memotindak">' + C.ic('ubah') + (d.tindakLanjut ? 'Ubah tindak lanjut' : 'Isi tindak lanjut') + '</button>';
    h += '<button type="button" class="btn" data-act="memopratinjau">' + C.ic('memo') + 'Pratinjau</button><button type="button" class="btn sec" data-act="memopdf">' + C.ic('pdf') + 'PDF</button>';
    if (perluArsip(r).length && d.status !== 'BATAL' && (C.isAdmin() || (u && u.qc === 'YA'))) h += '<button type="button" class="btn sec" data-act="memoarsip">Arsipkan PDF ke Drive</button>';
    if (C.isAdmin()) {
      if (d.status !== 'BATAL') h += '<button type="button" class="btn sec" data-act="memoubah">' + C.ic('ubah') + 'Ubah isian</button><button type="button" class="btn bad" data-act="memobatal">Batalkan memo</button>';
      h += '<button type="button" class="btn bad" data-act="memohapus">' + C.ic('sampah') + 'Hapus memo</button>';
    }
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

  /* ---------- tab Memo (QC MK, QC PJ, dan PJ) ---------- */

  function punyaTab(u) { return !!u && (u.peran === 'PJ' || (u.peran === 'MK' && u.qc === 'YA')); }
  var TB = { semua: false };            // tab Memo: false = hanya yang menunggu Anda
  var SLOT_PENDEK = { MK1: 'Tahap I', PJ1: 'Tanda terima', MK2: 'Tahap II', PJ2: 'Tahap II' };
  function dots(x) { return '<div class="mdots" aria-label="Tanda tangan">' + [['MK1', 'MK I'], ['PJ1', 'PJ I'], ['MK2', 'MK II'], ['PJ2', 'PJ II']].map(function (s) { return '<span class="' + (x.ttd && x.ttd[s[0]] ? 'on' : '') + '">' + s[1] + '</span>'; }).join('') + '</div>'; }
  function hariTag(x) { return x.hari > 0 && x.status !== 'CLOSE' && x.status !== 'BATAL' ? '<span class="tag hari' + (x.hari > 7 ? ' lama' : '') + '">' + x.hari + ' hari</span>' : ''; }
  function lokasiTeks(x) { return [x.gedung, x.lantai, x.ruangan].filter(Boolean).join(' / ') || x.lokasi; }
  function kartuMemo(x) {
    var jml = (x.aksi || []).filter(function (a) { return a !== 'tindak'; }).length, tombol = '';
    (x.aksi || []).forEach(function (a) {
      if (a === 'tindak') tombol += '<button type="button" class="pill start" data-act="memotindakcepat" data-m="' + esc(x.id) + '">' + C.ic('ubah') + 'Isi tindak lanjut</button>';
      else tombol += '<button type="button" class="pill go" data-act="memosahcepat" data-m="' + esc(x.id) + '" data-s="' + a + '">' + C.ic('centang') + 'Sahkan' + (jml > 1 ? ' ' + SLOT_PENDEK[a] : '') + '</button>';
    });
    if (jml) tombol += '<button type="button" class="pill" data-act="memopratinjaukartu" data-m="' + esc(x.id) + '">Pratinjau</button>';
    return '<article class="group mcard"><div class="eh"><span class="no">' + esc(x.noMemo ? pendek(x.noMemo) : 'Draf') + '</span><span class="tx">' + esc(x.kegiatan || x.lokasi || x.bidang) + '</span></div>' +
      '<div class="meta"><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span><span class="tag">' + esc(x.bidang) + '</span>' + (x.tingkat ? '<span class="tag ' + esc(x.tingkat.toLowerCase()) + '">' + esc(x.tingkat) + '</span>' : '') + hariTag(x) + '</div>' +
      '<div class="note">' + esc(lokasiTeks(x)) + '</div>' + dots(x) +
      '<div class="note"><b>' + esc(x.menunggu ? x.menunggu.teks : '') + '</b></div>' +
      '<div class="acts">' + tombol + '<button type="button" class="pill memo" data-act="memolihat" data-m="' + esc(x.id) + '">' + C.ic('memo') + 'Lihat</button></div></article>';
  }
  function tabHtml() {
    var h = '<div class="pagehead"><div class="cap">' + esc(C.S.paket.nama) + '</div><h1>Memo</h1></div>';
    if (D.daftar === null) return h + (D.off ? '<div class="err">Server belum mendukung site memo.</div>' : C.skel('entries'));
    var semua = D.daftar.filter(function (x) { return x.status !== 'BATAL'; }), ps = perlu(), tampil = (TB.semua ? semua : ps).slice().sort(function (a, b) { return (b.hari || 0) - (a.hari || 0); });
    h += '<div class="banner" role="status"><span>' + ps.length + ' memo menunggu Anda</span><button type="button" data-act="memosegar2">Muat ulang</button></div>';
    h += '<div class="chips" role="group" aria-label="Tampilan"><button type="button" class="chip' + (TB.semua ? '' : ' on') + '" data-act="memotabfilter" data-v="0">Perlu tindakan ' + ps.length + '</button><button type="button" class="chip' + (TB.semua ? ' on' : '') + '" data-act="memotabfilter" data-v="1">Semua memo ' + semua.length + '</button></div>';
    if (!tampil.length) return h + '<div class="empty">' + (TB.semua ? 'Belum ada site memo.' : 'Tidak ada memo yang menunggu Anda.') + '</div>';
    return h + '<div class="entgrid">' + tampil.map(kartuMemo).join('') + '</div>';
  }
  /* Satu ketuk dari kartu: langsung mengesahkan. Akun QC yang belum punya tanda tangan diarahkan ke layar tanda tangan. */
  async function sahkanCepat(memoId, slot) {
    var perluTtd = false;
    var h = await C.work('Mengesahkan...', async function () {
      try { return await C.api('memo_sahkan', { memoId: memoId, slot: slot }); }
      catch (e) { if (e && e.server && /Unggah tanda tangan/.test(e.message)) { perluTtd = true; return null; } throw e; }
    });
    if (!h) { if (perluTtd) { C.toast('Unggah tanda tangan Anda dulu.'); bukaTtd(); } return; }
    C.putDefect(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    muatDaftar();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
  }

  /* ---------- Rekap > Memo (Admin dan MK) ---------- */

  var RK = { bd: '', st: '', mw: '', lama: 0 };
  var BID_KODE = [['ARS', 'Arsitektur'], ['STR', 'Struktur'], ['MEEP', 'MEEP'], ['INF', 'Infrastruktur'], ['LSC', 'Lansekap']];
  var ST_URUT = ['MENUNGGU TTD MK', 'TERBIT', 'TINDAK LANJUT', 'PEMERIKSAAN II', 'CLOSE'];
  function simpanMode(v) { try { localStorage.setItem('dl-rekap', v); } catch (e) { } }
  function rekapToggle() {
    if (!C.canEdit()) return '';
    var m = C.S.rekapMode === 'memo', n = D.daftar ? D.daftar.filter(function (x) { return x.status !== 'BATAL'; }).length : 0;
    return '<div class="chips rkmode" role="group" aria-label="Rekap"><button type="button" class="chip' + (m ? '' : ' on') + '" data-act="memorekapmode" data-v="temuan">Temuan</button><button type="button" class="chip' + (m ? ' on' : '') + '" data-act="memorekapmode" data-v="memo">Memo' + (n ? ' ' + n : '') + '</button></div>';
  }
  function rekapFilter() {
    var all = (D.daftar || []).filter(function (x) { return C.isAdmin() || x.status !== 'BATAL'; });
    return all.filter(function (x) { return (!RK.bd || x.kodeBidang === RK.bd) && (!RK.st || x.status === RK.st) && (!RK.mw || (x.menunggu && x.menunggu.orang === RK.mw)) && (!RK.lama || x.hari > 7); })
      .sort(function (a, b) { var sa = (a.status === 'CLOSE' || a.status === 'BATAL') ? 1 : 0, sb = (b.status === 'CLOSE' || b.status === 'BATAL') ? 1 : 0; return sa - sb || (b.hari || 0) - (a.hari || 0); });
  }
  function rekapHtml() {
    var h = '<div class="pagehead"><div class="cap">' + esc(C.S.paket.nama) + '</div><h1>Rekap memo</h1></div>';
    if (D.daftar === null) return h + (D.off ? '<div class="err">Server belum mendukung site memo.</div>' : C.skel('table'));
    var all = D.daftar.filter(function (x) { return C.isAdmin() || x.status !== 'BATAL'; }), aktif = all.filter(function (x) { return x.status !== 'BATAL'; });
    var n = function (st) { return aktif.filter(function (x) { return x.status === st; }).length; };
    h += '<div class="mkpis">' + [['Total', aktif.length, ''], ['Menunggu TTD MK', n('MENUNGGU TTD MK'), 'o'], ['Terbit', n('TERBIT'), ''], ['Tindak lanjut', n('TINDAK LANJUT'), 'p'], ['Pemeriksaan II', n('PEMERIKSAAN II'), 'p'], ['Close', n('CLOSE'), 'c']].map(function (k) { return '<div class="mk ' + k[2] + '"><b>' + k[1] + '</b><span>' + k[0] + '</span></div>'; }).join('') + '</div>';
    h += '<section class="group"><div class="sh">Per bidang</div><div class="tw"><table class="t"><thead><tr><th>Bidang</th><th>Total</th><th>Berjalan</th><th>Close</th></tr></thead><tbody>' +
      BID_KODE.map(function (b) { var l = aktif.filter(function (x) { return x.kodeBidang === b[0]; }), cl = l.filter(function (x) { return x.status === 'CLOSE'; }).length; return '<tr><td>' + esc(b[1]) + '</td><td>' + l.length + '</td><td>' + (l.length - cl) + '</td><td>' + cl + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    var opt = function (arr, cur, semua) { return '<option value="">' + semua + '</option>' + arr.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
    h += '<section class="group"><div class="list"><div class="two"><label class="row"><span class="lbl">Bidang</span><select data-rk="bd">' + opt(BID_KODE, RK.bd, 'Semua') + '</select></label>' +
      '<label class="row"><span class="lbl">Status</span><select data-rk="st">' + opt(ST_URUT.concat(C.isAdmin() ? ['BATAL'] : []).map(function (s) { return [s, STAT[s]]; }), RK.st, 'Semua') + '</select></label></div>' +
      '<div class="two"><label class="row"><span class="lbl">Menunggu</span><select data-rk="mw">' + opt([['QC MK', 'QC MK'], ['PJ', 'PJ'], ['MK', 'MK'], ['QC PJ', 'QC PJ']], RK.mw, 'Semua') + '</select></label>' +
      '<label class="mchk big" style="margin:6px 12px"><input type="checkbox" data-rk="lama"' + (RK.lama ? ' checked' : '') + '><span>Lebih dari 7 hari</span></label></div></div></section>';
    var v = rekapFilter();
    h += '<div class="cap" style="margin:6px 4px">' + v.length + ' dari ' + all.length + ' memo</div>';
    h += v.length ? '<div class="mlis">' + v.map(function (x) {
      return '<button type="button" class="mli" data-act="memolihat" data-m="' + esc(x.id) + '"><div><b>' + esc(x.noMemo ? 'SM ' + pendek(x.noMemo) : 'Draf memo') + '</b><span>' + esc(x.kegiatan || x.lokasi) + '</span><span>' + esc(lokasiTeks(x)) + '</span>' + dots(x) +
        (x.menunggu && x.status !== 'CLOSE' && x.status !== 'BATAL' ? '<em>' + esc(x.menunggu.teks) + '</em>' : '') + '</div><div class="mr"><span class="tag ' + stCls(x.status) + '">' + esc(STAT[x.status] || x.status) + '</span>' + hariTag(x) + '</div></button>';
    }).join('') + '</div>' : '<div class="empty">Tidak ada memo yang cocok.</div>';
    return h + '<div class="btnrow"><button type="button" class="btn" data-act="memoexcel">' + C.ic('excel') + 'Unduh Excel</button></div>';
  }
  async function eksporExcel() {
    var v = rekapFilter();
    var ok = await C.work('Menyusun Excel...', async function () {
      await C.loadLib(C.XLSX_URL, 'XLSX');
      var X = root.XLSX, d10 = function (s) { return String(s || '').slice(0, 10); };
      var rows = [['No Memo', 'Tgl Pengajuan', 'Disiplin', 'Bidang', 'Kegiatan', 'Gedung', 'Lantai', 'Ruangan', 'Tingkat', 'Status', 'Menunggu', 'Hari menunggu', 'TTD MK Tahap I', 'TTD PJ Tanda terima', 'Tindak lanjut PJ', 'Verifikasi MK', 'TTD MK Tahap II', 'TTD PJ Tahap II']];
      v.forEach(function (x) {
        rows.push([x.noMemo, x.tglPengajuan, x.kodeBidang, x.bidang, x.kegiatan, x.gedung, x.lantai, x.ruangan, x.tingkat, STAT[x.status] || x.status, x.menunggu ? x.menunggu.teks : '', x.hari,
          d10(x.tgl && x.tgl.MK1), d10(x.tgl && x.tgl.PJ1), d10(x.tglTindak), x.verifikasi, d10(x.tgl && x.tgl.MK2), d10(x.tgl && x.tgl.PJ2)]);
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
    C.putDefect(r.defect);
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
    cabut: ['Cabut tanda tangan?', '', 'Ya, cabut']
  };
  function yakinHtml(m) {
    var y = YAKIN[m.kind], d = m.r.memo, ket = y[1] || ('Tanda tangan ' + NAMA_SLOT[m.slot] + ' dicabut dan status memo mundur satu tahap. Nomor memo tetap.');
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Konfirmasi"><h2>' + y[0] + '</h2>' +
      '<div class="note" style="padding:0"><b>' + esc(d.noMemo ? 'SM ' + pendek(d.noMemo) : 'Draf memo') + '</b> &middot; ' + esc(d.kegiatan || d.lokasi) + '</div><div class="note" style="padding:0">' + esc(ket) + '</div>' +
      '<div class="gap"><button type="button" class="btn bad" data-act="memoyakinya">' + y[2] + '</button><button type="button" class="btn sec" data-act="memoyakinbatal">Kembali</button></div></div></div>';
  }
  async function jalankanYakin() {
    var m = C.S.modal; if (!m || m.t !== 'memoyakin') return;
    var id = m.r.memo.id, d = m.r.defect;
    if (m.kind === 'cabut') {
      var h = await C.work('Mencabut tanda tangan...', function () { return C.api('memo_cabut_ttd', { memoId: id, slot: m.slot, konfirmasi: true }); });
      if (!h) return;
      C.putDefect(h.defect); C.toast('Tanda tangan dicabut.' + ((h.arsipBasi || []).length ? ' PDF After lama belum sesuai; arsipkan ulang setelah disahkan lagi.' : ''));
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
  async function bukaPratinjau(o) {
    var t0 = performance.now();
    var doc = await C.work('Membuat pratinjau...', function () { return o.mode === 'draf' ? bangunPdfDraf(o.form) : bangunPdf(o.r, 'akhir'); });
    if (!doc) return;
    var m = { t: 'memoprev', mode: o.mode, buf: doc.output('arraybuffer'), nama: o.mode === 'draf' ? 'Pratinjau memo.pdf' : namaBerkas(o.r.memo), r: o.r || null, form: o.form || null, kanvas: [], zoom: false };
    root.__memoPrev = { bangun: Math.round(performance.now() - t0), render: 0, halaman: 0 };
    D.pv = m;
    C.openModal(m);
    if (doc.fotoHilang) C.toast(doc.fotoHilang + ' foto belum termuat; pratinjau tanpa foto itu.');
  }
  function pvHtml(m) {
    var u = C.S.user, tombol;
    if (m.mode === 'draf') tombol = '<button type="button" class="btn" data-act="memopvlanjut">Lanjut ke konfirmasi</button><button type="button" class="btn sec" data-act="memopvtutup">Kembali ke form</button>';
    else {
      var slot = m.r ? slotSahkan(m.r) : '', sah = '';
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
    C.putDefect(h.defect);
    C.toast(h.hasil && h.hasil.nomor ? 'Memo disahkan. Nomor ' + pendek(h.hasil.nomor) + '.' : h.hasil && h.hasil.close ? 'Memo Close. Temuan ikut Close.' : 'Tanda tangan tersimpan.');
    C.openModal({ t: 'memo', r: h }); C.render(); muatDaftar();
    if (h.hasil && h.hasil.arsip) await arsipkan(h, h.hasil.arsip);
  }

  /* ---------- pintu masuk dari app.js ---------- */

  function modalHtml(m) {
    if (m.t === 'memoform') return formHtml(m);
    if (m.t === 'memokonfirm') return konfirmHtml(m);
    if (m.t === 'memo') return detailHtml(m);
    if (m.t === 'memotindak') return tindakHtml(m);
    if (m.t === 'memolist') return listHtml();
    if (m.t === 'ttd') return ttdHtml(m);
    if (m.t === 'memoyakin') return yakinHtml(m);
    if (m.t === 'memoprev') return pvHtml(m);
    return '';
  }
  function sesudahOverlay() {
    pasangPv();
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
        return bukaPratinjau({ mode: 'draf', form: m });
      }
      case 'memopvlanjut': return m && m.form && C.openModal({ t: 'memokonfirm', d: m.form.d, s: m.form.s, v: m.form.v });
      case 'memopvtutup': return m && (m.mode === 'draf' ? C.openModal(m.form) : C.openModal({ t: 'memo', r: m.r }));
      case 'memopvsahkan': return sahkanDariPv(el.getAttribute('data-s'));
      case 'memopvunduh': return m && m.buf && C.showFile(m.nama, m.buf.slice(0), 'application/pdf');
      case 'memopvzoom': if (m && m.t === 'memoprev') { m.zoom = !m.zoom; C.renderOverlay(); } return;
      case 'memopratinjau': return m && m.t === 'memo' && bukaPratinjau({ mode: 'detail', r: m.r });
      case 'memopratinjaukartu': {
        var rp = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: el.getAttribute('data-m') }); });
        if (rp) { C.putDefect(rp.defect); return bukaPratinjau({ mode: 'detail', r: rp }); }
        return;
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
      case 'memotabfilter': TB.semua = el.getAttribute('data-v') === '1'; return C.render();
      case 'memosegar2': D.daftar = null; C.render(); return muatDaftar();
      case 'memosahcepat': return sahkanCepat(el.getAttribute('data-m'), el.getAttribute('data-s'));
      case 'memotindakcepat': {
        var r1 = await C.work('Memuat memo...', function () { return C.api('memo_detail', { memoId: el.getAttribute('data-m') }); });
        if (r1) { C.putDefect(r1.defect); C.openModal({ t: 'memotindak', r: r1 }); }
        return;
      }
      case 'memorekapmode': C.S.rekapMode = el.getAttribute('data-v') === 'memo' ? 'memo' : 'temuan'; simpanMode(C.S.rekapMode); C.render(); if (C.S.rekapMode === 'memo') return muatDaftar(); return;
      case 'memoexcel': return eksporExcel();
      case 'memoubah': return m && m.t === 'memo' && bukaUbah(m.r);
      case 'memoubahsimpan': return simpanUbah();
      case 'memokembaliubah': return m && m.r && C.openModal({ t: 'memo', r: m.r });
      case 'memobatal': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'batal', r: m.r });
      case 'memohapus': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'hapus', r: m.r });
      case 'memocabut': return m && m.t === 'memo' && C.openModal({ t: 'memoyakin', kind: 'cabut', slot: el.getAttribute('data-s'), r: m.r });
      case 'memoyakinya': return jalankanYakin();
      case 'memoyakinbatal': return m && m.r && C.openModal({ t: 'memo', r: m.r });
    }
  }

  root.MEMO = {
    init: function (konteks) {
      C = konteks;
      document.addEventListener('change', function (e) {   // filter Rekap > Memo
        var k = e.target && e.target.getAttribute && e.target.getAttribute('data-rk');
        if (k) { RK[k] = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value; C.render(); }
      });
      return { punyaTab: punyaTab, tabHtml: tabHtml, rekapToggle: rekapToggle, rekapHtml: rekapHtml, tag: tag, kartuTombol: kartuTombol, setelanHtml: setelanHtml, punya: punya, milik: milik, modalHtml: modalHtml, sesudahOverlay: sesudahOverlay, klik: klik, muatDaftar: muatDaftar, jumlahPerlu: jumlahPerlu }; },
    /* untuk uji */
    _tglId: tglId, _pendek: pendek, _olahGambar: olahGambar
  };
})(typeof window !== 'undefined' ? window : this);
