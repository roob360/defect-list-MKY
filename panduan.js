/* Panduan penggunaan di dalam aplikasi, seperti ebook: bab, halaman, langkah bernomor, dan tangkapan layar.
   Bab yang tampil menyesuaikan kelas akun (MK, QC MK, Koordinator QC, PJ, QC PJ). Gambar dibuat otomatis oleh gas/uji/buat-panduan.js
   dan disimpan di panduan/. Nomor merah pada gambar sama dengan nomor langkah di teks. */
(function () {
  'use strict';
  var KEY_POS = 'dl-pdn-pos', KEY_BACA = 'dl-pdn-baca';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  /* ----- isi panduan -----
     untuk: kelas yang melihat bab ini. mk = semua akun MK, qcmk = MK dengan penanda QC, koord = koordinator QC MK, pj = semua akun PJ, qcpj = PJ dengan penanda QC. */
  var BAB = [
    { id: 'mulai', judul: 'Memulai', untuk: ['mk', 'pj'], ringkas: 'Memilih paket dan masuk dengan kode akses', halaman: [
      { judul: 'Pilih paket pekerjaan', img: 'mk-01-paket', intro: 'Aplikasi dipakai dari ikon di layar utama HP. Saat dibuka, pilih paket pekerjaan Anda.', langkah: ['Ketuk paket pekerjaan Anda. Pilihan ini diingat di HP, jadi hanya perlu sekali.'] },
      { judul: 'Masuk dengan kode akses', img: 'mk-02-masuk', intro: 'Kode akses berisi 6 karakter dan diberikan oleh admin. Setiap orang punya kode sendiri.', langkah: ['Ketik kode akses. Kode yang disalin juga bisa ditempel dengan tombol Tempel kode.', 'Ketuk Masuk. Setelah berhasil, Anda tidak perlu mengetik kode lagi di HP ini.'] }
    ] },
    { id: 'layar', judul: 'Mengenal layar Temuan', untuk: ['mk'], ringkas: 'Daftar temuan, cari, filter, dan menu bawah', halaman: [
      { judul: 'Layar Temuan', img: 'mk-03-temuan', intro: 'Semua temuan paket ini ada di layar Temuan. Dari sini Anda mencari, menyaring, dan membuka tiap temuan.', langkah: [
        'Kolom cari: ketik uraian, elemen, titik, atau nama ruangan.',
        'Filter: pilih gedung, lantai, bidang, tingkat, atau tanggal. Angka di sampingnya menunjukkan berapa filter yang aktif.',
        'Menu titik tiga: urutan daftar, unduh PDF, dan muat ulang.',
        'Chip status: Semua, Open, Proses, dan Close, lengkap dengan jumlahnya. Ketuk untuk menyaring.',
        'Kartu temuan: foto Before dan After, uraian, status, dan langkah penyelesaian. Ketuk kartunya untuk detail lengkap.',
        'Tombol +: mencatat temuan baru. Tekan lama untuk langsung membuka kamera.',
        'Menu bawah: pindah antar bagian. Bagian lain bisa dicapai juga dengan menggeser layar ke kiri atau kanan.'] }
    ] },
    { id: 'detail', judul: 'Membaca detail temuan', untuk: ['mk'], ringkas: 'Informasi lengkap dan riwayat tiap kejadian', halaman: [
      { judul: 'Detail dan riwayat', img: 'mk-04-detail', intro: 'Ketuk kartu mana pun untuk melihat semua informasi temuan di satu tempat.', langkah: [
        'Status, bidang, tingkat, dan penanda memo ada di bagian atas.',
        'Lokasi, tanggal, pelapor, dan tahap perbaikan tersusun per bagian.',
        'Riwayat menampilkan setiap kejadian beserta tanggal, jam, dan siapa yang melakukannya, mulai dari temuan dicatat sampai verifikasi.'] }
    ] },
    { id: 'catat', judul: 'Mencatat temuan baru', untuk: ['mk'], ringkas: 'Foto, lokasi, uraian, dan rincian teknis', halaman: [
      { judul: 'Foto Before', img: 'mk-05-form-foto', intro: 'Ketuk + di menu bawah. Di HP, kamera langsung terbuka. Foto kondisi temuan lebih dulu, baru lengkapi isian.', langkah: [
        'Judul bagian: formulir terdiri dari empat bagian bernomor, semuanya terlihat.',
        'Kamera: ambil foto langsung. Foto dipotong otomatis ke rasio 4:3.',
        'Galeri: pilih foto yang sudah ada. Bisa lebih dari satu foto.'] },
      { judul: 'Lokasi', img: 'mk-06-form-lokasi', intro: 'Tentukan bidang dan tempat temuan.', langkah: [
        'Pilih bidang. Ketujuh pilihan terlihat sekaligus.',
        'Gedung dan Lantai: ketuk untuk memilih, atau ketik untuk menambah yang baru. Nama yang mirip akan ditandai supaya tidak ada dobel.',
        'Ruangan: sama seperti di atas. Bidang yang tidak memakai ruangan terisi otomatis dan tidak bisa diubah.'] },
      { judul: 'Temuan dan simpan', img: 'mk-07-form-temuan', intro: 'Tulis apa yang ditemukan dan seberapa parah, lalu simpan.', langkah: [
        'Uraian temuan. Anda bisa mendikte dengan mikrofon papan ketik.',
        'Tingkat: Minor, Mayor, atau Kritis.',
        'Simpan. Gunakan Simpan & tambah lagi bila ada beberapa temuan di lokasi yang sama.'] }
    ] },
    { id: 'cari', judul: 'Mencari dan menyaring', untuk: ['mk'], ringkas: 'Cari kata, filter, dan chip status', halaman: [
      { judul: 'Cari dan filter', img: 'mk-08-filter', intro: 'Gabungkan kolom cari dengan filter untuk menemukan temuan dengan cepat.', langkah: [
        'Ketik kata kunci. Pencarian terakhir tersimpan dan muncul sebagai chip saat kolom cari kosong.',
        'Panel filter terbuka di bawah kolom cari. Pilih gedung, lantai, bidang, tingkat, dan lainnya. Ketuk Atur ulang untuk mencabut semuanya.'] }
    ] },
    { id: 'verif', judul: 'Verifikasi', untuk: ['mk'], ringkas: 'Memutuskan perbaikan diterima atau ditolak', halaman: [
      { judul: 'Antrean verifikasi', img: 'mk-09-verifikasi', intro: 'Bagian Verifikasi berisi temuan yang sudah punya foto After dari penanggung jawab dan menunggu keputusan MK.', langkah: [
        'Kartu temuan dengan foto Before dan After berdampingan. Bandingkan keduanya.',
        'Ketuk Verifikasi untuk memutuskan.'] },
      { judul: 'Terima atau tolak', img: 'mk-10-keputusan', intro: 'Dialog keputusan memuat catatan dan dua pilihan.', langkah: [
        'Catatan MK (opsional). Wajib diisi bila menolak, supaya penanggung jawab tahu apa yang harus diperbaiki.',
        'Diterima (Close): temuan selesai dan berstatus Close.',
        'Ditolak: temuan kembali ke penanggung jawab untuk diperbaiki dan difoto ulang.'] }
    ] },
    { id: 'rekap', judul: 'Rekap dan unduhan', untuk: ['mk'], ringkas: 'Ringkasan, Excel, dan PDF', halaman: [
      { judul: 'Rekap', img: 'mk-11-rekap', intro: 'Rekap meringkas temuan per ruangan dan per bidang.', langkah: [
        'Jumlah Open, Proses, dan Close. Ketuk salah satunya untuk menyaring daftar di bawah.',
        'Tabel per ruangan beserta persentase yang sudah Close. Ruangan tanpa temuan disembunyikan bawaannya; ketuk tombol di atasnya untuk menampilkan.',
        'Unduh Excel untuk seluruh data.',
        'Cetak PDF laporan per bidang.'] }
    ] },
    { id: 'pj-layar', judul: 'Mengenal layar Temuan', untuk: ['pj'], ringkas: 'Daftar temuan dan menu bawah', halaman: [
      { judul: 'Layar Temuan dan menu bawah', img: 'pj-01-temuan', intro: 'Sebagai penanggung jawab, Anda melihat temuan paket ini dan mengerjakan perbaikan yang menjadi bagian Anda. Tombol + untuk mencatat temuan hanya ada di akun MK.', langkah: [
        'Kartu temuan: foto Before dan After, uraian, status, dan tahap penyelesaian. Ketuk kartu untuk detail lengkap dan riwayat tiap kejadian.',
        'Perbaikan: temuan yang perlu Anda kerjakan. Angka merah menunjukkan jumlahnya.',
        'Temuan: seluruh temuan di paket ini. Anda juga bisa berpindah bagian dengan menggeser layar ke kiri atau kanan.'] }
    ] },
    { id: 'pj-perbaikan', judul: 'Mengerjakan perbaikan', untuk: ['pj'], ringkas: 'Mulai perbaikan dan unggah foto After', halaman: [
      { judul: 'Antrean perbaikan', img: 'pj-02-perbaikan', intro: 'Bagian Perbaikan berisi temuan yang menunggu dikerjakan.', langkah: [
        'Cari dan filter: sama seperti di bagian Temuan. Chip Open, Proses, dan Close menyaring berdasarkan status.',
        'Kartu temuan beserta foto Before.',
        'Mulai perbaikan: ketuk saat pekerjaan perbaikan dimulai. Tanggal dan nama Anda tercatat.'] },
      { judul: 'Setelah perbaikan dimulai', img: 'pj-03-sudah-mulai', intro: 'Kartu berubah: tanggal mulai dan nama pelaksana tampil, dan tombol berganti menjadi Unggah foto After.', langkah: [
        'Catatan Perbaikan dimulai beserta tanggal dan nama Anda. Bila salah mulai dan foto After belum ada, Batalkan mulai perbaikan tersedia di menu titik tiga pada kartu.',
        'Unggah foto After: ketuk bila perbaikan selesai dan sudah difoto.'] },
      { judul: 'Unggah foto After', img: 'pj-04-foto-after', intro: 'Foto After dipotong otomatis ke rasio 4:3, sama seperti foto Before supaya mudah dibandingkan.', langkah: [
        'Kamera: ambil foto langsung.',
        'Galeri: pilih foto yang sudah ada. Setelah terunggah, temuan menunggu keputusan MK. Bila ditolak, kartu menampilkan catatan MK dan tombol Perbaiki ulang untuk mengunggah foto yang baru.'] }
    ] },
    { id: 'pj-memo', judul: 'Memo dan tindak lanjut', untuk: ['pj'], ringkas: 'Membaca memo dan mengisi tindak lanjut', halaman: [
      { judul: 'Bagian Memo', img: 'pj-05-memo', intro: 'Site memo yang ditujukan kepada Anda tampil di bagian Memo.', langkah: [
        'Perlu tindakan memuat memo yang menunggu Anda. Semua memo menampilkan seluruhnya.',
        'Kartu memo: status, bidang, tingkat, lokasi, dan titik tanda tangan MK I, PJ I, MK II, dan PJ II. Teks tebal di bawahnya menyebut siapa yang ditunggu.'] },
      { judul: 'Mengisi tindak lanjut', img: 'pj-06-tindak', intro: 'Ketuk Isi tindak lanjut pada kartu memo. Temuan bermemo yang sudah punya foto After tidak bisa diterima MK sebelum tindak lanjut diisi.', langkah: [
        'Usulan rencana tindak lanjut (wajib): jelaskan perbaikan yang dilakukan atau direncanakan.',
        'Simpan. Nama penerima memo terisi dari akun Anda.'] }
    ] },
    { id: 'qcpj', judul: 'Mengesahkan tanda terima (QC PJ)', untuk: ['qcpj'], ringkas: 'Satu ketukan untuk mengesahkan', halaman: [
      { judul: 'Sahkan tanda terima', img: 'qcpj-01-memo', intro: 'Akun QC PJ memiliki tombol Sahkan pada memo yang menunggu tanda terima atau pemeriksaan tahap II.', langkah: [
        'Bagian Memo, dengan chip Perlu tindakan yang menunjukkan jumlah memo untuk Anda.',
        'Kartu memo: teks tebal menyebut apa yang ditunggu, misalnya tindak lanjut PJ dan tanda terima QC PJ.',
        'Sahkan: satu ketukan membubuhkan tanda tangan Anda. Bila Anda belum punya tanda tangan, aplikasi mengarahkan ke Pengaturan untuk membuatnya (lihat bab Tanda tangan).'] }
    ] },
    { id: 'qcmemo', judul: 'Memo: membuat dan mengesahkan', untuk: ['qcmk'], ringkas: 'Menaikkan temuan jadi memo dan mengesahkan', halaman: [
      { judul: 'Bagian Memo dan Sahkan', img: 'qc-01-memo', intro: 'Sebagai QC bidang, Anda menaikkan temuan menjadi site memo dan mengesahkannya. Nomor memo keluar setelah QC bidang yang bersangkutan atau Koordinator QC MK mengesahkan.', langkah: [
        'Bilah alat: cari, filter, dan menu titik tiga. Chip Perlu tindakan menunjukkan memo yang menunggu Anda.',
        'Kartu memo: nomor, status, dan titik tanda tangan MK I, PJ I, MK II, PJ II.',
        'Sahkan: satu ketukan membubuhkan tanda tangan Anda. Akun yang belum punya tanda tangan diarahkan membuatnya dulu.',
        'Pratinjau: lihat memo dalam bentuk PDF sebelum disahkan.'] },
      { judul: 'Menaikkan temuan jadi memo', img: 'qc-02-belum-memo', intro: 'Temuan yang belum bermemo memiliki tombol Memo berbingkai kuning di kartunya.', langkah: ['Ketuk Memo. Formulir memo terbuka dengan isian yang diambil dari temuan.'] },
      { judul: 'Formulir memo: data dan jenis', img: 'qc-03-form-memo-1', tanpaNomor: true, intro: 'Isian di bawah diambil dari temuan. Lengkapi yang belum terisi.', langkah: [
        'Tanggal pengajuan, bidang pekerjaan, kegiatan pekerjaan, lokasi pekerjaan (wajib), dan info lainnya.',
        'Jenis ketidaksesuaian: Kualitas, Material, Dimensi & Posisi (X,Y,Z), atau Lainnya. Bila memilih Lainnya, jelaskan di kolom di bawahnya.'] },
      { judul: 'Formulir memo: referensi dan kondisi', img: 'qc-04-form-memo-2', tanpaNomor: true, intro: 'Tandai dokumen yang menjadi rujukan, lalu tulis kondisi yang ditemukan.', langkah: [
        'Referensi: KPPK, RKS, Material yang disetujui, BQ, Drawing, Metoda Kerja/WI/SOP, dan Spesifikasi. Pilih satu atau lebih.',
        'Kondisi aktual (wajib) diisi dari temuan dan boleh dikembangkan. Perubahan hanya berlaku di memo, uraian temuan tidak berubah.',
        'Kondisi seharusnya (wajib): tulis rujukan SNI, spesifikasi, atau standar.'] },
      { judul: 'Foto dan mengesahkan', img: 'qc-05-form-memo-3', intro: 'Bagian akhir formulir memuat foto Before yang ikut di memo dan pilihan mengesahkan langsung.', langkah: [
        'Lanjut. Bila kotak Langsung sahkan dan beri nomor dicentang (muncul untuk QC bidang ini), memo langsung disahkan dan bernomor. Bila tidak, memo disimpan sebagai draf untuk disahkan kemudian.'] }
    ] },
    { id: 'ttd', judul: 'Tanda tangan', untuk: ['qcmk', 'qcpj'], ringkas: 'Membuat tanda tangan untuk mengesahkan memo', halaman: [
      { judul: 'Membuka Tanda tangan', img: 'qc-06-pengaturan', intro: 'Tanda tangan dipakai setiap kali Anda mengesahkan memo. Cukup dibuat sekali dan tersimpan di akun Anda.', langkah: ['Buka Pengaturan lewat ikon akun, lalu ketuk Tanda tangan.'] },
      { judul: 'Membuat tanda tangan', img: 'qc-07-ttd', tanpaNomor: true, intro: 'Memo yang sudah disahkan tidak berubah bila tanda tangan Anda diganti kemudian.', langkah: [
        'Nama yang dicetak (wajib) dan jabatan tampil di memo.',
        'Gambar: goreskan tanda tangan langsung di layar. Unggah PNG: pakai berkas gambar tanda tangan yang sudah ada.',
        'Simpan.'] }
    ] },
    { id: 'koord', judul: 'Koordinator QC MK', untuk: ['koord'], ringkas: 'Peran tambahan untuk koordinator', halaman: [
      { judul: 'Wewenang koordinator', img: '', intro: 'Sebagai Koordinator QC MK, Anda memiliki semua kemampuan QC bidang, ditambah:', langkah: [
        'Mengesahkan memo untuk semua bidang, bukan hanya satu bidang.',
        'Mengelola temuan semua bidang, termasuk mengubah dan menghapus temuan yang dilaporkan akun lain.'] }
    ] },
    { id: 'umum', judul: 'Tips pemakaian', untuk: ['mk', 'pj'], ringkas: 'Geser antar bagian dan riwayat pencarian', halaman: [
      { judul: 'Tips', img: '', intro: 'Beberapa kebiasaan yang mempercepat pekerjaan sehari-hari.', langkah: [
        'Geser layar ke kiri atau kanan untuk pindah ke bagian tetangga di menu bawah, seperti di aplikasi chat. Cara ini tidak berlaku saat dialog terbuka atau di tepi layar.',
        'Tarik layar ke bawah dari paling atas untuk memuat ulang data.',
        'Kolom cari mengingat enam pencarian terakhir. Ketuk kolomnya saat kosong untuk melihatnya.',
        'Bila foto belum terkirim karena tidak ada sinyal, aplikasi menyimpannya dan mengirim otomatis saat sinyal kembali.'] }
    ] },
    { id: 'setelan', judul: 'Pengaturan dan tampilan', untuk: ['mk', 'pj'], ringkas: 'Tema, ukuran tampilan, dan keluar', halaman: [
      { judul: 'Pengaturan', img: 'mk-12-pengaturan', intro: 'Ketuk ikon akun di kanan atas untuk membuka Pengaturan.', langkah: [
        'Akun: nama, peran, dan paket Anda. Ganti paket di sini.',
        'Tampilan: tema terang atau gelap, animasi, ukuran tampilan, dan kontras tinggi bila teks terasa kurang jelas.',
        'Keluar: mengakhiri sesi di HP ini. Bila masih ada foto yang belum terkirim, Anda diminta memastikan dulu.'] }
    ] }
  ];

  function kelas(u) {
    var k = {};
    if (!u) return k;
    if (u.peran === 'PJ') { k.pj = 1; if (u.qc === 'YA') k.qcpj = 1; }
    else { k.mk = 1; if (u.qc === 'YA') k.qcmk = 1; if (u.qc === 'YA' && u.qcBidang === 'KOORD') k.koord = 1; }
    return k;
  }
  function babUntuk(u) {
    var k = kelas(u);
    if (u && u.peran === 'ADMIN') k.mk = 1;
    return BAB.filter(function (b) { return b.untuk.some(function (x) { return k[x]; }); });
  }
  function dibaca() { try { return JSON.parse(ls(KEY_BACA) || '{}'); } catch (e) { return {}; } }

  var ST = null;   // { daftar, b, h }
  function el() { return document.getElementById('panduan'); }
  function tutup() { var e = el(); if (e) e.remove(); ST = null; document.removeEventListener('keydown', tombol, true); }
  function tombol(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); tutup(); } }
  function isi(h) {
    var e = el();
    if (!e) {
      e = document.createElement('div'); e.id = 'panduan'; e.className = 'pdn'; e.setAttribute('role', 'dialog'); e.setAttribute('aria-modal', 'true'); e.setAttribute('aria-label', 'Panduan penggunaan');
      document.body.appendChild(e);
      e.addEventListener('click', klik);
      document.addEventListener('keydown', tombol, true);
    }
    e.innerHTML = h; e.scrollTop = 0;
    var sc = e.querySelector('.pdn-in'); if (sc) sc.scrollTop = 0;
  }
  function daftarHtml() {
    var bb = ST.bab, bc = dibaca();
    return '<div class="pdn-bar"><b>Panduan</b><button type="button" class="pdn-x" data-p="tutup" aria-label="Tutup">&times;</button></div>' +
      '<div class="pdn-in"><h1>Panduan penggunaan</h1><p class="pdn-sub">Pilih bab. Bab di bawah ini sesuai dengan akun Anda.</p><div class="pdn-list">' +
      bb.map(function (b, i) {
        var n = b.halaman.length, sudah = b.halaman.filter(function (_, j) { return bc[b.id + ':' + j]; }).length;
        return '<button type="button" class="pdn-bab" data-p="bab" data-i="' + i + '"><span class="pdn-no">' + (i + 1) + '</span><span class="pdn-tx"><b>' + esc(b.judul) + '</b><small>' + esc(b.ringkas) + '</small></span><span class="pdn-pr">' + (sudah >= n ? '&#10003;' : sudah + '/' + n) + '</span></button>';
      }).join('') + '</div></div>';
  }
  function halamanHtml() {
    var b = ST.bab[ST.b], h = b.halaman[ST.h], n = b.halaman.length;
    var bc = dibaca(); bc[b.id + ':' + ST.h] = 1; lsSet(KEY_BACA, JSON.stringify(bc)); lsSet(KEY_POS, b.id + ':' + ST.h);
    var ada = n > 1;
    var lanjut = ST.h < n - 1 ? { t: 'Berikutnya', p: 'maju' } : (ST.b < ST.bab.length - 1 ? { t: 'Bab berikutnya', p: 'babnext' } : { t: 'Selesai', p: 'daftar' });
    return '<div class="pdn-bar"><button type="button" class="pdn-bk" data-p="daftar" aria-label="Daftar bab">&lsaquo; Daftar bab</button><button type="button" class="pdn-x" data-p="tutup" aria-label="Tutup">&times;</button></div>' +
      '<div class="pdn-in"><div class="pdn-kr">Bab ' + (ST.b + 1) + ' &middot; ' + esc(b.judul) + (ada ? ' &middot; halaman ' + (ST.h + 1) + ' dari ' + n : '') + '</div>' +
      '<h1>' + esc(h.judul) + '</h1>' + (h.intro ? '<p class="pdn-sub">' + esc(h.intro) + '</p>' : '') +
      (h.img ? '<figure class="pdn-fig"><img src="panduan/' + esc(h.img) + '.jpg" alt="Tangkapan layar: ' + esc(h.judul) + '" loading="lazy" data-p="gambar"></figure>' : '') +
      '<ol class="pdn-ls">' + h.langkah.map(function (l, i) { var b = h.tanpaNomor || !h.img; return '<li><span class="pdn-n' + (b ? ' pdn-b' : '') + '">' + (b ? '&bull;' : (i + 1)) + '</span><span>' + esc(l) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="pdn-nav"><button type="button" class="btn sec" data-p="mundur"' + (ST.h === 0 && ST.b === 0 ? ' disabled' : '') + '>Sebelumnya</button><button type="button" class="btn" data-p="' + lanjut.p + '">' + lanjut.t + '</button></div></div>';
  }
  function klik(ev) {
    var t = ev.target.closest && ev.target.closest('[data-p]'); if (!t || !ST) return;
    ev.stopPropagation();
    var p = t.getAttribute('data-p'), b = ST.bab[ST.b];
    if (p === 'tutup') return tutup();
    if (p === 'daftar') { ST.daftar = true; return isi(daftarHtml()); }
    if (p === 'bab') { ST.b = +t.getAttribute('data-i'); ST.h = 0; ST.daftar = false; return isi(halamanHtml()); }
    if (p === 'maju') { ST.h++; return isi(halamanHtml()); }
    if (p === 'babnext') { ST.b++; ST.h = 0; return isi(halamanHtml()); }
    if (p === 'mundur') { if (ST.h > 0) ST.h--; else if (ST.b > 0) { ST.b--; ST.h = ST.bab[ST.b].halaman.length - 1; } return isi(halamanHtml()); }
    if (p === 'gambar') { var im = t, ov = document.createElement('div'); ov.className = 'pdn-zoom'; ov.innerHTML = '<img src="' + im.src + '" alt="">'; ov.addEventListener('click', function () { ov.remove(); }); document.body.appendChild(ov); }
  }
  function buka(u) {
    var bab = babUntuk(u); if (!bab.length) return;
    ST = { bab: bab, b: 0, h: 0, daftar: true };
    isi(daftarHtml());
  }
  window.PANDUAN = { buka: buka, babUntuk: babUntuk, kelas: kelas, BAB: BAB };
})();
