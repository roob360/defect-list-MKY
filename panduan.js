/* Panduan penggunaan di dalam aplikasi: daftar bab yang bisa dibuka satu per satu (akordeon), tiap bab berisi gambar kecil dan langkah singkat.
   Bab yang tampil menyesuaikan kelas akun (MK, QC MK, Koordinator QC, PJ, QC PJ). Gambar dibuat otomatis oleh gas/uji/buat-panduan.js dan
   disimpan di panduan/. Nomor merah pada gambar sama dengan nomor langkah di teks. Ketuk gambar untuk memperbesar. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* untuk: kelas yang melihat bab ini. mk = semua akun MK, qcmk = MK dengan penanda QC, koord = koordinator QC MK, pj = semua akun PJ, qcpj = PJ dengan penanda QC. */
  var BAB = [
    { id: 'mulai', judul: 'Masuk ke aplikasi', untuk: ['mk', 'pj'], ringkas: 'Pilih paket dan masukkan kode', halaman: [
      { judul: 'Pilih paket', img: 'mk-01-paket', langkah: ['Ketuk paket pekerjaan Anda. Pilihan diingat di HP ini.'] },
      { judul: 'Masukkan kode', img: 'mk-02-masuk', langkah: ['Ketik 6 karakter kode akses dari admin, atau ketuk Tempel kode.', 'Ketuk Masuk. Kode tidak perlu diketik lagi di HP ini.'] }
    ] },
    { id: 'layar', judul: 'Layar Temuan', untuk: ['mk'], ringkas: 'Cari, filter, dan kartu temuan', halaman: [
      { judul: 'Bagian-bagiannya', img: 'mk-03-temuan', langkah: [
        'Cari: ketik kata, ruangan, atau elemen.',
        'Filter: gedung, lantai, bidang, tingkat, atau tanggal.',
        'Menu titik tiga: urutan, PDF, dan muat ulang.',
        'Chip status: Semua, Open, Proses, Close.',
        'Kartu temuan: ketuk untuk detail lengkap.',
        'Tombol +: catat temuan baru. Tekan lama untuk kamera.',
        'Menu bawah: pindah bagian, atau geser layar ke kiri dan kanan.'] }
    ] },
    { id: 'detail', judul: 'Detail dan riwayat', untuk: ['mk'], ringkas: 'Informasi lengkap satu temuan', halaman: [
      { judul: 'Ketuk kartu mana pun', img: 'mk-04-detail', langkah: [
        'Status, bidang, tingkat, dan penanda memo.',
        'Lokasi, tanggal, pelapor, dan tahap perbaikan.',
        'Riwayat: tiap kejadian lengkap dengan tanggal, jam, dan pelakunya.'] }
    ] },
    { id: 'catat', judul: 'Catat temuan baru', untuk: ['mk'], ringkas: 'Foto, lokasi, dan uraian', halaman: [
      { judul: 'Foto Before', img: 'mk-05-form-foto', langkah: [
        'Formulir terdiri dari empat bagian bernomor.',
        'Kamera: foto langsung. Foto dipotong ke rasio 4:3.',
        'Galeri: pilih foto yang sudah ada.'] },
      { judul: 'Lokasi', img: 'mk-06-form-lokasi', langkah: [
        'Pilih bidang.',
        'Gedung dan Lantai: pilih atau ketik yang baru. Nama yang mirip ditandai.',
        'Ruangan: sama. Bidang tanpa ruangan terisi otomatis.'] },
      { judul: 'Temuan dan simpan', img: 'mk-07-form-temuan', langkah: [
        'Tulis temuannya. Boleh didikte lewat mikrofon papan ketik.',
        'Pilih tingkat: Minor, Mayor, atau Kritis.',
        'Simpan. Pakai Simpan & tambah lagi untuk lokasi yang sama.'] }
    ] },
    { id: 'cari', judul: 'Cari dan filter', untuk: ['mk'], ringkas: 'Menemukan temuan dengan cepat', halaman: [
      { judul: 'Kata kunci dan filter', img: 'mk-08-filter', langkah: [
        'Ketik kata kunci. Pencarian terakhir tersimpan dan muncul saat kolom kosong.',
        'Panel Filter terbuka di bawahnya. Atur ulang mencabut semuanya.'] }
    ] },
    { id: 'verif', judul: 'Verifikasi', untuk: ['mk'], ringkas: 'Terima atau tolak perbaikan', halaman: [
      { judul: 'Antrean verifikasi', img: 'mk-09-verifikasi', langkah: [
        'Bandingkan foto Before dan After.',
        'Ketuk Verifikasi untuk memutuskan.'] },
      { judul: 'Keputusan', img: 'mk-10-keputusan', langkah: [
        'Catatan MK. Wajib diisi bila menolak.',
        'Diterima: temuan berstatus Close.',
        'Ditolak: temuan kembali ke PJ untuk diperbaiki dan difoto ulang.'] }
    ] },
    { id: 'rekap', judul: 'Rekap dan unduhan', untuk: ['mk'], ringkas: 'Ringkasan, Excel, dan PDF', halaman: [
      { judul: 'Rekap', img: 'mk-11-rekap', langkah: [
        'Jumlah Open, Proses, dan Close. Ketuk untuk menyaring daftar.',
        'Tabel per ruangan dengan persen Close. Ruangan tanpa temuan disembunyikan.',
        'Unduh Excel untuk seluruh data.',
        'Cetak PDF laporan per bidang.'] }
    ] },
    { id: 'pj-layar', judul: 'Layar Temuan', untuk: ['pj'], ringkas: 'Daftar temuan dan menu bawah', halaman: [
      { judul: 'Bagian-bagiannya', img: 'pj-01-temuan', langkah: [
        'Kartu temuan: ketuk untuk detail lengkap dan riwayatnya.',
        'Perbaikan: temuan yang perlu Anda kerjakan. Angka merah = jumlahnya.',
        'Temuan: semua temuan paket ini. Geser layar untuk pindah bagian.'] }
    ] },
    { id: 'pj-perbaikan', judul: 'Mengerjakan perbaikan', untuk: ['pj'], ringkas: 'Mulai perbaikan, unggah foto After', halaman: [
      { judul: 'Antrean perbaikan', img: 'pj-02-perbaikan', langkah: [
        'Cari dan filter, sama seperti di Temuan.',
        'Kartu temuan dengan foto Before.',
        'Mulai perbaikan: ketuk saat pekerjaan dimulai. Tanggal dan nama Anda tercatat.'] },
      { judul: 'Setelah dimulai', img: 'pj-03-sudah-mulai', langkah: [
        'Tanggal mulai dan nama pelaksana tampil. Salah mulai? Batalkan di menu titik tiga, selama foto After belum ada.',
        'Unggah foto After saat perbaikan selesai.'] },
      { judul: 'Unggah foto After', img: 'pj-04-foto-after', langkah: [
        'Kamera: foto langsung.',
        'Galeri: pilih foto yang ada. Setelah itu menunggu keputusan MK. Bila ditolak, ketuk Perbaiki ulang dan unggah foto baru.'] }
    ] },
    { id: 'pj-memo', judul: 'Memo dan tindak lanjut', untuk: ['pj'], ringkas: 'Membaca memo, mengisi tindak lanjut', halaman: [
      { judul: 'Bagian Memo', img: 'pj-05-memo', langkah: [
        'Perlu tindakan: memo yang menunggu Anda. Semua memo: seluruhnya.',
        'Kartu memo: status, lokasi, dan tanda tangan MK I, PJ I, MK II, PJ II. Teks tebal menyebut siapa yang ditunggu.'] },
      { judul: 'Isi tindak lanjut', img: 'pj-06-tindak', langkah: [
        'Rencana tindak lanjut (wajib): perbaikan yang dilakukan atau direncanakan.',
        'Simpan. Temuan bermemo tidak bisa diterima MK sebelum ini diisi.'] }
    ] },
    { id: 'qcpj', judul: 'Mengesahkan tanda terima', untuk: ['qcpj'], ringkas: 'Tugas QC PJ di bagian Memo', halaman: [
      { judul: 'Sahkan', img: 'qcpj-01-memo', langkah: [
        'Perlu tindakan: jumlah memo untuk Anda.',
        'Teks tebal pada kartu menyebut yang ditunggu, misalnya tanda terima QC PJ.',
        'Sahkan: satu ketukan membubuhkan tanda tangan Anda. Belum punya? Buat dulu di Pengaturan (bab Tanda tangan).'] }
    ] },
    { id: 'qcmemo', judul: 'Membuat dan mengesahkan memo', untuk: ['qcmk'], ringkas: 'Tugas QC bidang', halaman: [
      { judul: 'Bagian Memo', img: 'qc-01-memo', langkah: [
        'Cari, filter, dan menu titik tiga. Perlu tindakan = memo untuk Anda.',
        'Kartu memo: nomor, status, dan tanda tangan MK I, PJ I, MK II, PJ II.',
        'Sahkan: satu ketukan membubuhkan tanda tangan Anda.',
        'Pratinjau: lihat PDF memo sebelum disahkan.'] },
      { judul: 'Menaikkan temuan jadi memo', img: 'qc-02-belum-memo', langkah: ['Ketuk Memo (berbingkai kuning) pada temuan yang belum bermemo. Formulir terbuka dengan isian dari temuan.'] },
      { judul: 'Formulir: data dan jenis', img: 'qc-03-form-memo-1', tanpaNomor: true, langkah: [
        'Lengkapi tanggal, kegiatan, dan lokasi pekerjaan (wajib).',
        'Pilih jenis ketidaksesuaian. Bila Lainnya, jelaskan di bawahnya.'] },
      { judul: 'Formulir: referensi dan kondisi', img: 'qc-04-form-memo-2', tanpaNomor: true, langkah: [
        'Centang referensi: KPPK, RKS, BQ, Drawing, Spesifikasi, dan lainnya.',
        'Kondisi aktual (wajib) boleh dikembangkan; uraian temuan tidak berubah.',
        'Kondisi seharusnya (wajib): rujukan SNI, spesifikasi, atau standar.'] },
      { judul: 'Foto dan mengesahkan', img: 'qc-05-form-memo-3', langkah: [
        'Lanjut. Bila Langsung sahkan dan beri nomor dicentang, memo langsung disahkan. Bila tidak, tersimpan sebagai draf.'] }
    ] },
    { id: 'ttd', judul: 'Tanda tangan', untuk: ['qcmk', 'qcpj'], ringkas: 'Dibuat sekali, dipakai tiap mengesahkan', halaman: [
      { judul: 'Buka dari Pengaturan', img: 'qc-06-pengaturan', langkah: ['Ketuk ikon akun, lalu Tanda tangan.'] },
      { judul: 'Buat tanda tangan', img: 'qc-07-ttd', tanpaNomor: true, langkah: [
        'Isi nama yang dicetak dan jabatan.',
        'Gambar langsung di layar, atau Unggah PNG.',
        'Simpan. Memo yang sudah disahkan tidak berubah bila tanda tangan diganti.'] }
    ] },
    { id: 'koord', judul: 'Koordinator QC MK', untuk: ['koord'], ringkas: 'Wewenang tambahan', halaman: [
      { judul: 'Selain tugas QC bidang', img: '', langkah: [
        'Mengesahkan memo untuk semua bidang.',
        'Mengelola temuan semua bidang, termasuk mengubah dan menghapus temuan akun lain.'] }
    ] },
    { id: 'setelan', judul: 'Pengaturan', untuk: ['mk', 'pj'], ringkas: 'Tema, ukuran tampilan, dan keluar', halaman: [
      { judul: 'Ketuk ikon akun', img: 'mk-12-pengaturan', langkah: [
        'Akun: nama, peran, paket, dan Ganti paket.',
        'Tampilan: tema, ukuran, dan kontras tinggi.',
        'Keluar: mengakhiri sesi di HP ini. Bila masih ada foto belum terkirim, Anda diminta memastikan dulu.'] }
    ] },
    { id: 'umum', judul: 'Tips', untuk: ['mk', 'pj'], ringkas: 'Kebiasaan yang mempercepat', halaman: [
      { judul: 'Singkatnya', img: '', langkah: [
        'Geser layar ke kiri atau kanan untuk pindah bagian.',
        'Tarik layar ke bawah dari atas untuk memuat ulang.',
        'Foto yang belum terkirim karena tidak ada sinyal tersimpan dan dikirim otomatis nanti.'] }
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
  function labelKelas(u) {
    if (!u) return '';
    if (u.peran === 'ADMIN') return 'Admin';
    if (u.peran === 'PJ') return u.qc === 'YA' ? 'QC PJ' : 'PJ';
    if (u.qc === 'YA') return u.qcBidang === 'KOORD' ? 'Koordinator QC MK' : 'QC MK';
    return 'MK';
  }

  var ST = null;   // { bab, u }
  function el() { return document.getElementById('panduan'); }
  function tutup() { var e = el(); if (e) e.remove(); ST = null; document.removeEventListener('keydown', tombol, true); }
  function tombol(ev) { if (ev.key === 'Escape') { var z = document.querySelector('.pdn-zoom'); ev.stopPropagation(); if (z) z.remove(); else tutup(); } }

  function isiBab(b) {
    return b.halaman.map(function (g) {
      var tanpa = g.tanpaNomor || !g.img;
      return '<div class="pdn-pg">' + (b.halaman.length > 1 || g.img ? '<h3>' + esc(g.judul) + '</h3>' : '') +
        (g.img ? '<figure class="pdn-fig"><img src="panduan/' + esc(g.img) + '.jpg" alt="Tangkapan layar: ' + esc(g.judul) + '" width="390" height="844" loading="lazy" data-p="gambar"></figure>' : '') +
        '<ol class="pdn-ls">' + g.langkah.map(function (l, k) { return '<li><span class="pdn-n' + (tanpa ? ' pdn-b' : '') + '">' + (tanpa ? '&bull;' : (k + 1)) + '</span><span class="pdn-t">' + esc(l) + '</span></li>'; }).join('') + '</ol></div>';
    }).join('');
  }
  function dokumenHtml() {
    var bb = ST.bab;
    return '<div class="pdn-bar"><b>Panduan</b><button type="button" class="pdn-x" data-p="tutup" aria-label="Tutup">&times;</button></div>' +
      '<div class="pdn-in"><div class="pdn-head"><div class="cap">Untuk akun ' + esc(labelKelas(ST.u)) + '</div><h1>Panduan</h1><p class="pdn-sub">Ketuk bab untuk membuka.</p></div>' +
      '<div class="group pdn-list">' + bb.map(function (b, i) {
        return '<div class="pdn-bab" id="pdn-' + esc(b.id) + '"><button type="button" class="pdn-hd" data-p="buka" data-id="' + esc(b.id) + '" aria-expanded="false"><span class="pdn-no">' + (i + 1) + '</span><span class="pdn-tx"><b>' + esc(b.judul) + '</b><small>' + esc(b.ringkas) + '</small></span><svg class="pdn-cv" viewBox="0 0 12 18" aria-hidden="true"><path d="M3 2l6 7-6 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<div class="pdn-body" hidden>' + isiBab(b) + '</div></div>';
      }).join('') + '</div></div>';
  }
  function klik(ev) {
    var t = ev.target.closest && ev.target.closest('[data-p]'); if (!t || !ST) return;
    ev.stopPropagation();
    var p = t.getAttribute('data-p');
    if (p === 'tutup') return tutup();
    if (p === 'buka') {
      var bab = t.closest('.pdn-bab'), buka = t.getAttribute('aria-expanded') !== 'true';
      Array.prototype.forEach.call(el().querySelectorAll('.pdn-bab'), function (x) { x.classList.remove('buka'); x.querySelector('.pdn-hd').setAttribute('aria-expanded', 'false'); x.querySelector('.pdn-body').hidden = true; });
      if (buka) {
        bab.classList.add('buka'); t.setAttribute('aria-expanded', 'true'); bab.querySelector('.pdn-body').hidden = false;
        setTimeout(function () { try { bab.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { } }, 30);
      }
      return;
    }
    if (p === 'gambar') { var ov = document.createElement('div'); ov.className = 'pdn-zoom'; ov.innerHTML = '<img src="' + t.src + '" alt="">'; ov.addEventListener('click', function () { ov.remove(); }); document.body.appendChild(ov); }
  }
  function buka(u) {
    var bab = babUntuk(u); if (!bab.length) return;
    ST = { bab: bab, u: u };
    var e = el();
    if (!e) {
      e = document.createElement('div'); e.id = 'panduan'; e.className = 'pdn'; e.setAttribute('role', 'dialog'); e.setAttribute('aria-modal', 'true'); e.setAttribute('aria-label', 'Panduan penggunaan');
      document.body.appendChild(e); e.addEventListener('click', klik); document.addEventListener('keydown', tombol, true);
    }
    e.innerHTML = dokumenHtml(); e.scrollTop = 0;
  }
  window.PANDUAN = { buka: buka, babUntuk: babUntuk, kelas: kelas, BAB: BAB };
})();
