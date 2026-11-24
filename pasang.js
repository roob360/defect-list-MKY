/* Wajib pasang ke layar utama di HP. Di browser HP, seluruh aplikasi ditutup halaman petunjuk pasang.
   Komputer tidak diblokir. Tautan darurat untuk pengujian: tambahkan ?bebas=robi pada alamat (diingat di perangkat itu). */
(function () {
  'use strict';
  var KUNCI = 'dl-bebas';
  try {
    if (/[?&]bebas=robi(&|$)/.test(location.search)) localStorage.setItem(KUNCI, '1');
    if (localStorage.getItem(KUNCI) === '1') return;
  } catch (e) { }
  var ua = navigator.userAgent || '';
  var hp = /Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!hp) return;
  var mq = function (q) { try { return window.matchMedia && matchMedia(q).matches; } catch (e) { return false; } };
  var mandiri = mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)') || mq('(display-mode: minimal-ui)') || navigator.standalone === true;
  if (mandiri) return;

  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var dalamApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|; wv\)|WhatsApp|Telegram/i.test(ua);
  var prompt = null, terpasang = false;
  var IKON_BAGI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IKON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/></svg>';
  var IKON_TAMBAH = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  var css = document.createElement('style');
  css.textContent =
    'html.pasangwajib body > *:not(#pasangwajib):not(script):not(style){display:none!important}' +
    '#pasangwajib{--pb:#f2f2f7;--pc:#ffffff;--pt:#000000;--ps:#66666b;--pl:#0000001f;--pn:#e5f1ff;--pa:#0066cc;--pm:#0071e3;--pw:#fff1e0;--pwt:#a85200}' +
    '@media (prefers-color-scheme:dark){#pasangwajib{--pb:#000000;--pc:#1c1c1e;--pt:#ffffff;--ps:#ebebf599;--pl:#ffffff1f;--pn:#0a2a4a;--pa:#4da3ff;--pm:#0a72e8;--pw:#3a2410;--pwt:#ff9f4a}}' +
    '#pasangwajib{position:fixed;inset:0;z-index:2147483000;overflow:auto;background:var(--pb);color:var(--pt);font-family:-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}' +
    '#pasangwajib .pw{max-width:440px;margin:0 auto;padding:max(28px,env(safe-area-inset-top,0px)) 22px calc(28px + env(safe-area-inset-bottom,0px))}' +
    '#pasangwajib img.lg{width:72px;height:72px;border-radius:18px;display:block;margin:12px 0 18px}' +
    '#pasangwajib h1{font-size:26px;line-height:31px;margin:0 0 8px;letter-spacing:-.4px;color:var(--pt)}' +
    '#pasangwajib p{font-size:16px;line-height:22px;margin:0 0 18px;color:var(--ps)}' +
    '#pasangwajib .pwbtn{display:block;width:100%;min-height:52px;border:0;border-radius:14px;background:var(--pm);color:#fff;font:inherit;font-size:17px;font-weight:600;margin:0 0 22px;cursor:pointer}' +
    '#pasangwajib ol{list-style:none;margin:0 0 20px;padding:0;background:var(--pc);color:var(--pt);border-radius:16px;box-shadow:inset 0 0 0 1px var(--pl)}' +
    '#pasangwajib li{display:flex;align-items:center;gap:14px;padding:14px 16px;font-size:16px;line-height:21px;color:var(--pt)}' +
    '#pasangwajib li+li{border-top:1px solid var(--pl)}' +
    '#pasangwajib li b{color:var(--pt)}' +
    '#pasangwajib li .no{flex:none;width:28px;height:28px;border-radius:50%;background:var(--pn);color:var(--pa);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}' +
    '#pasangwajib li .ik{flex:none;width:26px;height:26px;color:var(--pa)}' +
    '#pasangwajib li .ik svg{width:100%;height:100%;display:block}' +
    '#pasangwajib .pwwarn{padding:14px 16px;border-radius:14px;background:var(--pw);color:var(--pwt);font-size:15px;line-height:20px;margin:0 0 18px}' +
    '#pasangwajib .pwfoot{font-size:14px;line-height:19px;color:var(--ps)}';
  document.head.appendChild(css);

  function langkah() {
    if (ios) {
      return '<ol>' +
        '<li><span class="no">1</span><span>Buka halaman ini di <b>Safari</b></span></li>' +
        '<li><span class="no">2</span><span class="ik">' + IKON_BAGI + '</span><span>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas)</span></li>' +
        '<li><span class="no">3</span><span class="ik">' + IKON_TAMBAH + '</span><span>Pilih <b>Tambah ke Layar Utama</b>, lalu ketuk <b>Tambah</b></span></li>' +
        '<li><span class="no">4</span><span>Tutup halaman ini, lalu buka <b>Defect List</b> dari layar utama</span></li></ol>';
    }
    return '<ol>' +
      '<li><span class="no">1</span><span class="ik">' + IKON_MENU + '</span><span>Ketuk menu <b>titik tiga</b> di pojok kanan atas Chrome</span></li>' +
      '<li><span class="no">2</span><span class="ik">' + IKON_TAMBAH + '</span><span>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b></span></li>' +
      '<li><span class="no">3</span><span>Ketuk <b>Instal</b>, lalu buka <b>Defect List</b> dari layar utama</span></li></ol>';
  }

  function gambar() {
    var el = document.getElementById('pasangwajib');
    if (!el) { el = document.createElement('div'); el.id = 'pasangwajib'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Pasang aplikasi dulu'); document.body.appendChild(el); }
    var h = '<div class="pw"><img class="lg" src="icon-192.png" alt="">';
    if (terpasang) {
      h += '<h1>Sudah terpasang</h1><p>Tutup halaman ini, lalu buka <b>Defect List</b> dari ikon di layar utama HP Anda.</p>' +
        '<p class="pwfoot">Anda perlu masuk lagi dengan kode akses saat pertama kali membukanya.</p>';
    } else {
      h += '<h1>Pasang aplikasi dulu</h1><p>Defect List dipakai dari layar utama HP, tidak dari browser. Pasang sekali saja, tidak perlu mengunduh dari toko aplikasi.</p>';
      if (dalamApp) h += '<div class="pwwarn">Anda membuka lewat aplikasi lain (misalnya WhatsApp atau Instagram). Salin tautan ini, lalu buka di <b>' + (ios ? 'Safari' : 'Chrome') + '</b> dulu.</div>';
      if (prompt) h += '<button type="button" class="pwbtn" id="pwpasang">Pasang sekarang</button><p class="pwfoot" style="margin-bottom:10px">Atau pasang manual:</p>';
      h += langkah();
      h += '<p class="pwfoot">Setelah terpasang, buka dari ikon di layar utama dan masuk dengan kode akses Anda. Kode akses perlu dimasukkan lagi karena aplikasi yang terpasang menyimpan data terpisah dari browser.</p>';
    }
    el.innerHTML = h + '</div>';
    var b = document.getElementById('pwpasang');
    if (b) b.addEventListener('click', function () {
      var p = prompt; if (!p) return; prompt = null;
      try { p.prompt(); if (p.userChoice) p.userChoice.then(function (r) { if (r && r.outcome === 'accepted') { terpasang = true; gambar(); } }); } catch (e) { }
      gambar();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; gambar(); });
  window.addEventListener('appinstalled', function () { terpasang = true; gambar(); });
  document.documentElement.classList.add('pasangwajib');
  if (document.body) gambar(); else document.addEventListener('DOMContentLoaded', gambar);
})();
