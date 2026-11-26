/* Splash animasi ringan (SVG + CSS di index.html), menyambung dari splash statis Android. Hanya saat app
   terpasang dibuka (sekali per sesi), tidak saat Animasi "Hemat" atau gerak dikurangi. Ketuk untuk melewati.
   Pratinjau di browser: ?splash=1 */
(function () {
  'use strict';
  var el = document.getElementById('splash');
  if (!el) return;
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var paksa = /[?&]splash=1(&|$)/.test(location.search), anim = null, sudah = null;
  try { anim = localStorage.getItem('dl-anim'); sudah = sessionStorage.getItem('dl-splash'); sessionStorage.setItem('dl-splash', '1'); } catch (e) { }
  var hemat = anim === 'hemat' || (anim !== 'penuh' && mq('(prefers-reduced-motion: reduce)'));
  var mandiri = mq('(display-mode: standalone)') || navigator.standalone === true;
  if (!paksa && (!mandiri || sudah || hemat)) { el.remove(); return; }

  var selesai = false, jam;
  function tutup() {
    if (selesai) return;
    selesai = true;
    clearTimeout(jam);
    el.classList.add('keluar');
    setTimeout(function () { el.remove(); }, 450);
  }
  el.addEventListener('click', tutup);
  el.classList.add('tampil');
  jam = setTimeout(tutup, 1700);
})();
