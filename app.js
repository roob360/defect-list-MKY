(function(){
'use strict';

/* Pustaka disajikan dari folder lib/ (salinan xlsx 0.18.5, jspdf 2.5.1, jszip 3.10.1): tanpa CDN, ikut di-cache untuk offline. */
var XLSX_URL='lib/xlsx.full.min.js';
var PDF_URL='lib/jspdf.umd.min.js';
var ZIP_URL='lib/jszip.min.js';
var STORE='dl-paket';
var LBL=(typeof LABEL!=='undefined'&&LABEL)?LABEL:{area:'Gedung',level:'Lantai',lokasi:'Ruangan'};
/* Label mengikuti bidang: ARS, MEEP, STR memakai Gedung, Lantai, Ruangan; INF dan LAN memakai Kawasan, Jalan/Zona, Lokasi.
 * LBL_GAB (gabungan) untuk tempat yang memuat semua bidang sekaligus (kepala kolom Excel dan Rekap). */
var LBL_INFRA=(typeof LABEL_INFRA!=='undefined'&&LABEL_INFRA)?LABEL_INFRA:{area:'Kawasan',level:'Jalan/Zona',lokasi:'Lokasi'};
var BID_INFRA={Infrastruktur:1,Lansekap:1};
function labelBidang(b){return BID_INFRA[b]?LBL_INFRA:LBL}
var LBL_GAB={area:LBL.area+' / '+LBL_INFRA.area,level:LBL.level+' / '+LBL_INFRA.level.replace('/','-'),lokasi:LBL.lokasi+' / '+LBL_INFRA.lokasi};

var S={
  paket:null, kode:'', user:null, view:'form', rooms:[], roomsReady:false, sel:{g:'',l:'',r:''},
  defects:{}, loading:{}, errs:{}, all:null, siap:null, siapErr:'', perlu:null, perluErr:'', anim:'sistem', flt:{rid:'',q:'',st:'',bd:'',tk:'',el:''}, zipOff:{}, zipRun:false, zipStop:false, terhapus:null, img:{}, busy:'', file:null, loginErr:'', net:'',
  reg:null, regOk:false, master:null, rg:{area:'',pakai:null}, imp:null, impRes:null, up:[], pv:{}, stale:{}, fokusAsal:null, kl:{g:'',l:'',n:''}, hist:[], skip:0, seen:{}, ringPrev:{}, stpPrev:{}, cntPrev:{}, cuPrev:{}, fotoOk:{}, baru:null, drafOk:0, drawn:'', ovKey:''
};
S.klTab=(function(v){return ['ruang','gl','imp','isian','lain'].indexOf(v)>=0?v:'ruang'})(lsGet('dl-kltab'));S.klq='';S.klOpen={};S.klTambah=false;S.klNon=false;S.klNonList=null;S.klMs=null;S.klIsuOpen=true;S.klIsuAll=false;
S.rekapMode=lsGet('dl-rekap')==='memo'?'memo':'temuan';S.semua=lsGet('dl-semua')!=='0';   // Rekap: Temuan atau Memo; Temuan: per ruangan atau semua ruangan
var app=document.getElementById('app'), overlay=document.getElementById('overlay');
var toastTimer=null, pickCb=null;
/* Site memo (memo.js): modul terpisah yang dipanggil dari beberapa titik (kartu, dialog, Pengaturan, lencana). Bila memo.js tidak termuat, semuanya diam. */
var M_=window.MEMO?window.MEMO.init({S:S,overlay:overlay,PDF_URL:PDF_URL,api:api,work:work,putDefect:putDefect,findDefect:findDefect,openModal:openModal,closeModal:closeModal,render:render,renderOverlay:renderOverlay,loadLib:loadLib,fetchImgs:fetchImgs,imgSize:imgSize,showFile:showFile,toast:toast,esc:esc,ic:ic,thumb:thumb,canEdit:canEdit,bisaKelola:bisaKelola,isAdmin:isAdmin,isPJ:isPJ,skel:skel,XLSX_URL:XLSX_URL,loadDefects:loadDefects,loadSiap:loadSiap,loadPerlu:loadPerlu,today:today,clean:clean,BIDANG:BIDANG}):null;

/* ---------- util ---------- */
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function fmt(iso){if(!iso)return '';var p=String(iso).slice(0,10).split('-');if(p.length<3)return iso;var m=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return +p[2]+' '+m[+p[1]-1]+' '+p[0]}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function ic(n){return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-'+n+'"/></svg>'}
/* Animasi batch 1: semua lewat animOn() (mati di mode hemat dan prefers-reduced-motion) dan hanya memakai transform dan opacity. */
function animOn(){return !document.documentElement.classList.contains('hemat')}
var SVG_CEK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
/* Ikon toast ditentukan dari teks pesan: peringatan (gagal, belum, tidak, wajib diisi) atau centang (berhasil). Pesan netral tanpa ikon. */
var RE_TOAST_GALAT=/(^Tidak |tidak bisa|tidak dikenal|tidak terhubung|^Belum |belum (dimuat|ada|diperbarui)|gagal|^Isi |^Pilih |wajib|^Format|^Seret|penuh|diblokir|terhenti|^Periksa|coba lagi|masih disiapkan|terputus|^Maksimal|^Server belum)/i;
var RE_TOAST_OK=/^(Tersimpan|Temuan (dihapus|dipulihkan)|Dihapus|Digabung|Diterima|Ditolak\.|Verifikasi dibatalkan|Pemisah diubah|Ruangan (diperbarui|dinonaktifkan|diaktifkan)|Nama diubah|Urutan diubah|(Gedung|Lantai) (ditambah|dinonaktifkan|diaktifkan)|Perbaikan dicatat|Mulai perbaikan dibatalkan|Foto After terkirim|Foto asli dipindah|\d+ (draf terkirim|foto yang belum|ruangan ditambah|kode ditambahkan))/;
function cekToast(t,m){
  m=String(m);var c=document.createElement('span'),w=RE_TOAST_GALAT.test(m);
  if(w){c.className='tcek w';c.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-peringatan"/></svg>'}
  else if(RE_TOAST_OK.test(m)){c.className='tcek';c.innerHTML=SVG_CEK;try{if(navigator.vibrate&&animOn())navigator.vibrate(12)}catch(e){}}   // getar ringan pada aksi berhasil (Android; iPhone tidak mendukung)
  else return;
  t.insertBefore(c,t.firstChild);
}
function toast(m){var t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;cekToast(t,m);t.hidden=false;t.classList.remove('in');void t.offsetWidth;t.classList.add('in');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true},4500)}
/* Toast dengan satu tombol aksi (mis. Urungkan, hanya Admin) selama 5 detik. */
function toastAksi(m,label,fn){
  var t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent='';var s=document.createElement('span');s.textContent=m;var b=document.createElement('button');b.type='button';b.className='tb';b.textContent=label;
  b.onclick=function(){clearTimeout(toastTimer);t.hidden=true;fn()};
  t.appendChild(s);t.appendChild(b);cekToast(t,m);t.hidden=false;t.classList.remove('in');void t.offsetWidth;t.classList.add('in');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true},5000);
}
async function urungkanHapus(d){
  var r=await work('Memulihkan...',function(){return api('defect_pulihkan',{id:d.id})});
  if(r){delete S.defects[r.ruanganId];S.all=null;await loadRooms();toast('Temuan dipulihkan.')}
}
function clean(s){return String(s).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function pct(c){return c.total?Math.round(c.close/c.total*100)+'%':'-'}
function thumb(id,w){return 'https://lh3.googleusercontent.com/d/'+encodeURIComponent(id)+'=w'+(w||400)}
function applyTema(){
  var r=document.documentElement;
  if(S.tema==='terang'||S.tema==='gelap')r.setAttribute('data-tema',S.tema);else r.removeAttribute('data-tema');
  r.removeAttribute('data-teks');   // ukuran teks seragam (pilihan Ukuran teks dihapus)
  var dark=S.tema==='gelap'||(S.tema!=='terang'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  var tc=document.getElementById('tc');if(tc)tc.setAttribute('content',dark?'#000000':'#f2f2f7');
}
function bersihCache(){
  var p=[];
  try{if(navigator.serviceWorker)p.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}))}catch(e){}
  try{if(window.caches)p.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}))}catch(e){}
  Promise.all(p).catch(function(){}).then(function(){location.reload()});
}
function applyAnim(){
  var rm=false;try{rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  document.documentElement.classList.toggle('hemat',S.anim==='hemat'||(S.anim!=='penuh'&&rm));
}
function isAdmin(){return S.user&&S.user.peran==='ADMIN'}
function canEdit(){return S.user&&(S.user.peran==='ADMIN'||S.user.peran==='MK')}
function isPJ(){return S.user&&S.user.peran==='PJ'}
function stCls(s){return s==='Close'?'close':s==='Dalam proses'?'proses':'open'}
function cnt(list){var c={total:list.length,open:0,proses:0,close:0};list.forEach(function(d){if(d.status==='Close')c.close++;else if(d.status==='Dalam proses')c.proses++;else c.open++});return c}

/* ---------- API ---------- */
/* Aksi baca boleh diulang otomatis (sampai 3 kali) saat jaringan gagal. Aksi tulis tidak, supaya tidak menggandakan data. */
var BACA={mulai:1,masuk:1,ruangan:1,defect_daftar:1,defect_semua:1,defect_siap:1,defect_perbaikan:1,defect_terhapus:1,foto_data:1};
function api(aksi,p){
  var body=JSON.stringify(Object.assign({aksi:aksi,kode:S.kode},p||{}));
  var maks=BACA[aksi]?3:1,batas=aksi==='foto_unggah'?90000:45000,url=S.paket.apiUrl;
  function sekali(){
    var ac=window.AbortController?new AbortController():null,tm=ac?setTimeout(function(){ac.abort()},batas):null;
    return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:body,signal:ac?ac.signal:undefined})
      .then(function(r){return r.json()})
      .then(function(j){clearTimeout(tm);if(!j.ok){var e=new Error(j.pesan||'Gagal');e.server=true;throw e}return j.data},
        function(e){clearTimeout(tm);throw e});
  }
  function jalan(n){
    return sekali().catch(function(e){
      if((e&&e.server)||n+1>=maks)throw e;
      return new Promise(function(r){setTimeout(r,700*(n+1))}).then(function(){return jalan(n+1)});
    });
  }
  return jalan(0);
}

/* Cadangan foto: bila gambar gagal dimuat langsung dari Google (jaringan, akun, atau peramban perangkat tertentu),
   coba URL Drive lama, lalu ambil lewat server (foto_data) sebagai data URL. Diproses satu per satu. */
var FOTO_COBA={},FOTO_ANTRE=Promise.resolve();
document.addEventListener('error',function(ev){
  var im=ev.target;if(!im||im.tagName!=='IMG'||!im.src||im.src.indexOf('data:')===0||im.classList.contains('zprev'))return;
  var m=/googleusercontent\.com\/d\/([^=\/?]+)=|thumbnail\?id=([^&]+)/.exec(im.src);if(!m)return;
  var id=decodeURIComponent(m[1]||m[2]),w=im.closest&&im.closest('.zoom')?1024:400,n=FOTO_COBA[id]||0;
  FOTO_COBA[id]=n+1;
  if(n===0){im.src='https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w'+w;return}
  if(n===1&&S.paket&&S.kode){
    FOTO_ANTRE=FOTO_ANTRE.then(function(){return api('foto_data',{ids:[id],w:w})}).then(function(r){
      var d=r&&r[0]&&r[0].data;if(d){S.pv[id]=d;im.src=d}else fotoGagal(im,id);
    }).catch(function(){fotoGagal(im,id)});
    return;
  }
  fotoGagal(im,id);
},true);
/** Semua cadangan gagal: penampil penuh menampilkan pesan dengan tombol coba lagi; thumbnail diberi penanda (mengetuknya membuka penampil, yang mencoba ulang). */
function fotoGagal(im,id){
  var zm=im.closest&&im.closest('.zoom');
  if(zm){
    if(zm.querySelector('.fgagal'))return;
    im.style.display='none';var zv=zm.querySelector('.zprev');if(zv)zv.remove();
    var d=document.createElement('button');d.type='button';d.className='fgagal';d.setAttribute('data-act','fotocoba');d.setAttribute('data-id',id);
    d.innerHTML='<b>Foto belum bisa dimuat</b><span>Ketuk untuk coba lagi</span>';
    zm.insertBefore(d,im.nextSibling);
  }else{var th=im.closest&&im.closest('.thumb');if(th)th.classList.add('gagal')}
}

/* Penyimpanan lokal (IndexedDB): antrean foto dan cache daftar temuan. Bila tidak tersedia, semuanya diam-diam dilewati. */
var IDB={
  db:null,
  open:function(){
    if(this.db)return this.db;
    this.db=new Promise(function(res,rej){
      try{
        var rq=indexedDB.open('dl',1);
        rq.onupgradeneeded=function(){var d=rq.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('up'))d.createObjectStore('up',{keyPath:'k'})};
        rq.onsuccess=function(){res(rq.result)};rq.onerror=function(){rej(rq.error)};rq.onblocked=function(){rej(new Error('blocked'))};
      }catch(e){rej(e)}
    });
    return this.db;
  },
  run:function(store,mode,fn){
    return this.open().then(function(db){return new Promise(function(res,rej){
      var t=db.transaction(store,mode),rq=fn(t.objectStore(store));
      t.oncomplete=function(){res(rq&&rq.result)};t.onerror=t.onabort=function(){rej(t.error)};
    })});
  },
  get:function(s,k){return this.run(s,'readonly',function(o){return o.get(k)}).catch(function(){return null})},
  put:function(s,v,k){return this.run(s,'readwrite',function(o){return k===undefined?o.put(v):o.put(v,k)}).catch(function(){})},
  del:function(s,k){return this.run(s,'readwrite',function(o){return o['delete'](k)}).catch(function(){})},
  all:function(s){return this.run(s,'readonly',function(o){return o.getAll()}).then(function(r){return r||[]}).catch(function(){return []})},
  keys:function(s){return this.run(s,'readonly',function(o){return o.getAllKeys()}).then(function(r){return r||[]}).catch(function(){return []})}
};
/* Hapus data lokal milik satu paket (saat keluar), tanpa menyentuh paket lain. */
function bersihLokal(pid){
  lsDel('dl-user-'+pid);lsDel('dl-rooms-'+pid);lsDel('dl-reg-'+pid);lsDel('dl-sel');lsDel('dl-view');lsDel('dl-master-'+pid);lsDel('dl-lok');
  IDB.keys('kv').then(function(ks){ks.forEach(function(k){if(String(k).indexOf('def:'+pid+':')===0)IDB.del('kv',k)})});
  IDB.all('up').then(function(its){its.forEach(function(it){if(it.pid===pid)IDB.del('up',it.k)})});
}
var defT={};
function simpanDef(rid){
  clearTimeout(defT[rid]);
  defT[rid]=setTimeout(function(){if(S.paket&&S.user&&S.defects[rid])IDB.put('kv',S.defects[rid],'def:'+S.paket.id+':'+rid)},800);
}
function gagal(e){
  var m=(e&&e.message)||'Gagal';
  if(e&&e.server){
    if(/Kode tidak dikenal|nonaktif/i.test(m)){keluar();S.loginErr='';S.loginNet=false;render();openModal({t:'sesi'});return}
    toast(/Aksi tidak dikenal/i.test(m)?'Server belum diperbarui. Hubungi admin aplikasi.':m);
  }else toast('Tidak terhubung ke server. Periksa internet lalu coba lagi.');
}
async function work(label,fn){
  S.busy=label;renderOverlay();
  try{return await fn()}catch(e){gagal(e)}finally{S.busy='';renderOverlay()}
}

/* ---------- data turunan ---------- */
/* ----- daftar gedung dan lantai resmi (S.master dari server; kosong = belum dipakai, nama bebas) ----- */
function masterAktif(){return !!(S.master&&S.master.gedung&&S.master.gedung.length)}
function masterGedung(nama){var k=L.kunci(nama),r='';((S.master&&S.master.gedung)||[]).forEach(function(n){if(L.kunci(n)===k)r=n});return r}
function masterLantaiDaftar(g){var gm=masterGedung(g);return gm?((S.master.lantai||{})[gm]||[]):[]}
function masterLantai(g,nama){var k=L.kunciLantai(nama),r='';masterLantaiDaftar(g).forEach(function(n){if(L.kunciLantai(n)===k)r=n});return r}
function masterSet(m){S.master=m;lsSet('dl-master-'+S.paket.id,JSON.stringify(m))}
async function tambahGedung(){
  var n=$('klGN').value;if(!L.rapi(n)){toast('Isi nama gedung.');return}
  var r=await work('Menambah gedung...',function(){return api('gedung_tambah',{nama:n})});
  if(r){masterSet(r);S.klMs=null;toast('Gedung ditambah.');render()}
}
async function tambahLantai(gedung,i){
  var el=$('klLN'+i),l=el?el.value:'';if(!L.rapi(l)){toast('Isi nama lantai.');return}
  var r=await work('Menambah lantai...',function(){return api('lantai_tambah',{gedung:gedung,lantai:l})});
  if(r){masterSet(r);S.klMs=null;toast('Lantai ditambah.');render()}
}

function tree(){
  var gs=[],gm={};
  S.rooms.forEach(function(r){
    if(!r||!L.rapi(r.gedung)||!L.rapi(r.lantai)||!r.id)return;   // baris rusak (nama atau id kosong) tidak ditampilkan
    var g=gm[r.gedung];if(!g){g=gm[r.gedung]={nama:r.gedung,lantai:[],lm:{}};gs.push(g)}
    var l=g.lm[r.lantai];if(!l){l=g.lm[r.lantai]={nama:r.lantai,ruangan:[]};g.lantai.push(l)}
    l.ruangan.push(r);
  });
  gs.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.sort(function(a,b){
    if(!!a.bidang!==!!b.bidang)return a.bidang?1:-1;
    return L.bandingNama(a.bidang?a.bidang:a.nama,b.bidang?b.bidang:b.nama);
  })})});
  return gs;
}
function ensureSel(T){
  if(!T.length)return null;
  var g=T.filter(function(x){return x.nama===S.sel.g})[0]||T[0];
  var l=g.lantai.filter(function(x){return x.nama===S.sel.l})[0]||g.lantai[0];
  var r=l.ruangan.filter(function(x){return x.id===S.sel.r})[0]||l.ruangan[0];
  S.sel={g:g.nama,l:l.nama,r:r.id};
  return {g:g,l:l,r:r};
}
function flat(T){var o=[];T.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){o.push({g:g.nama,l:l.nama,r:r.id})})})});return o}
function recount(rid){
  var room=S.rooms.filter(function(r){return r.id===rid})[0],list=S.defects[rid];
  if(!room||!list)return;
  var c=cnt(list);room.total=c.total;room.open=c.open;room.proses=c.proses;room.close=c.close;
}
function putDefect(d){
  var list=S.defects[d.ruanganId];
  if(list){var i=list.map(function(x){return x.id}).indexOf(d.id);if(i>=0)list[i]=d;else list.push(d);recount(d.ruanganId);simpanDef(d.ruanganId)}
  if(S.all){var j=S.all.map(function(x){return x.id}).indexOf(d.id);if(j>=0)S.all[j]=d;else S.all.push(d)}
  if(S.siap){var k=S.siap.map(function(x){return x.id}).indexOf(d.id);if(d.siap){if(k>=0)S.siap[k]=d;else S.siap.push(d)}else if(k>=0)S.siap.splice(k,1)}
  if(S.perlu){var q=S.perlu.map(function(x){return x.id}).indexOf(d.id);if(d.perlu){if(q>=0)S.perlu[q]=d;else S.perlu.push(d)}else if(q>=0)S.perlu.splice(q,1)}
}
function dropDefect(id,rid){
  S.up=S.up.filter(function(x){return x.did!==id});upBar();
  if(S.defects[rid]){S.defects[rid]=S.defects[rid].filter(function(x){return x.id!==id});recount(rid);simpanDef(rid)}
  if(S.all)S.all=S.all.filter(function(x){return x.id!==id});
  if(S.siap)S.siap=S.siap.filter(function(x){return x.id!==id});
  if(S.perlu)S.perlu=S.perlu.filter(function(x){return x.id!==id});
}
/** Semua salinan objek temuan dengan id ini (daftar ruangan, antrean Verifikasi, antrean Perbaikan, Semua area). */
function hariIni(){var n=new Date();return n.getFullYear()+'-'+('0'+(n.getMonth()+1)).slice(-2)+'-'+('0'+n.getDate()).slice(-2)}
function semuaSalinan(id){
  var out=[],rid;
  function cari(l){if(l)for(var i=0;i<l.length;i++)if(l[i].id===id&&out.indexOf(l[i])<0)out.push(l[i])}
  for(rid in S.defects)cari(S.defects[rid]);cari(S.siap);cari(S.perlu);cari(S.all);
  return out;
}
function findDefect(id){
  var rid,list;
  for(rid in S.defects){list=S.defects[rid];for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i]}
  if(S.siap)for(var j=0;j<S.siap.length;j++)if(S.siap[j].id===id)return S.siap[j];
  if(S.perlu)for(var m=0;m<S.perlu.length;m++)if(S.perlu[m].id===id)return S.perlu[m];
  if(S.all)for(var k=0;k<S.all.length;k++)if(S.all[k].id===id)return S.all[k];   // tab Temuan > Semua area: temuan ruangan lain belum ada di S.defects
  return null;
}

/* ---------- muat data ---------- */
async function loadSiap(){
  if(!canEdit())return;
  S.siapErr='';
  try{S.siap=await api('defect_siap')}
  catch(e){
    if(e&&e.server&&/Kode tidak dikenal|nonaktif/i.test(e.message)){gagal(e);return}
    S.siapErr=e&&e.server?(/Aksi tidak dikenal/i.test(e.message)?'Server belum diperbarui. Tempel Kode.gs terbaru di Apps Script lalu deploy Versi baru.':e.message):'Tidak terhubung ke server.';
  }
  if(S.view==='verif')render();else setDock();   // hindari render ulang daftar form (animasi kartu)
}
async function loadPerlu(){
  if(!(isPJ()||isAdmin()))return;
  S.perluErr='';
  try{S.perlu=await api('defect_perbaikan')}
  catch(e){
    if(e&&e.server&&/Kode tidak dikenal|nonaktif/i.test(e.message)){gagal(e);return}
    S.perluErr=e&&e.server?(/Aksi tidak dikenal/i.test(e.message)?'Server belum diperbarui. Tempel Kode.gs terbaru di Apps Script lalu deploy Versi baru.':e.message):'Tidak terhubung ke server.';
  }
  if(S.view==='perbaikan')render();else setDock();
}
/* Sekali per perangkat: ajak memasang ke layar utama bila masih berjalan di browser. Android lewat prompt bawaan, iPhone lewat petunjuk. */
var PROMPT_PASANG=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();PROMPT_PASANG=e});
function petunjukPasang(){
  if(lsGet('dl-pasang')||!S.user)return;
  var mandiri=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
  if(mandiri){lsSet('dl-pasang','1');return}
  if(PROMPT_PASANG){lsSet('dl-pasang','1');toastAksi('Pasang aplikasi di layar utama agar lebih cepat dibuka.','Pasang',function(){var p=PROMPT_PASANG;PROMPT_PASANG=null;try{p.prompt()}catch(e){}});return}
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)){lsSet('dl-pasang','1');toast('Untuk memasang: ketuk Bagikan, lalu Tambah ke Layar Utama.')}
}
/** Penampil foto penuh: cubit untuk zoom, ketuk dua kali untuk memperbesar atau mengembalikan, geser saat diperbesar, seret ke bawah untuk menutup (roda tetikus untuk zoom di komputer). */
(function(){
  var ps={},s=1,tx=0,ty=0,d0=0,s0=1,tapT=0,gerak=0,img=null,sx=0,sy=0;
  function ov(){return img&&img.closest('.ov.zoom')}
  function ap(snap){if(!img)return;img.style.transition=snap?'transform .22s cubic-bezier(.3,.9,.3,1)':'none';img.style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';var o=ov();if(o)o.style.background=s===1&&ty>0?'rgba(0,0,0,'+Math.max(.2,.9*(1-ty/420))+')':''}
  function jarak(){var k=Object.keys(ps);if(k.length<2)return 0;var a=ps[k[0]],b=ps[k[1]];return Math.hypot(a.x-b.x,a.y-b.y)}
  function batas(){if(s<=1){tx=0;if(ty<0)ty=0;return}var w=img.clientWidth*(s-1)/2,h=img.clientHeight*(s-1)/2;tx=Math.max(-w,Math.min(w,tx));ty=Math.max(-h,Math.min(h,ty))}
  document.addEventListener('pointerdown',function(e){
    var im=e.target.closest&&e.target.closest('.ov.zoom img');if(!im)return;
    if(img!==im){img=im;s=1;tx=ty=0;ps={}}
    ps[e.pointerId]={x:e.clientX,y:e.clientY};gerak=0;sx=e.clientX;sy=e.clientY;
    try{im.setPointerCapture(e.pointerId)}catch(x){}
    if(Object.keys(ps).length===2){d0=jarak();s0=s}
  });
  document.addEventListener('pointermove',function(e){
    if(!img||!ps[e.pointerId])return;
    var p=ps[e.pointerId],dx=e.clientX-p.x,dy=e.clientY-p.y;ps[e.pointerId]={x:e.clientX,y:e.clientY};
    gerak=Math.max(gerak,Math.hypot(e.clientX-sx,e.clientY-sy));
    if(Object.keys(ps).length>=2){if(d0)s=Math.max(1,Math.min(5,s0*jarak()/d0))}
    else{tx+=dx;ty+=dy}
    batas();ap(false);
  });
  function lepas(e){
    if(!img||!ps[e.pointerId])return;
    delete ps[e.pointerId];
    if(Object.keys(ps).length)return;
    var tap=gerak<8,now=Date.now();
    if(tap&&now-tapT<320){tapT=0;if(s>1.05){s=1;tx=ty=0}else s=2.5;batas();ap(true);return}
    if(tap)tapT=now;
    if(s<1.05){
      if(ty>110){closeZoom();return}
      s=1;tx=ty=0;ap(true);
    }
  }
  document.addEventListener('pointerup',lepas);document.addEventListener('pointercancel',lepas);
  document.addEventListener('wheel',function(e){
    var im=e.target.closest&&e.target.closest('.ov.zoom img');if(!im)return;
    e.preventDefault();if(img!==im){img=im;s=1;tx=ty=0;ps={}}
    s=Math.max(1,Math.min(5,s*(e.deltaY<0?1.15:1/1.15)));if(s<1.02){s=1;tx=ty=0}batas();ap(false);
  },{passive:false});
})();
/** Tekan lama tombol tambah (+) di dock: langsung membuka form dengan kamera, satu langkah lebih sedikit saat mencatat di lapangan. */
(function(){
  var tm=0,lp=false;
  function batal(){clearTimeout(tm)}
  document.addEventListener('pointerdown',function(e){
    var b=e.target.closest&&e.target.closest('.dockadd');if(!b)return;
    lp=false;batal();
    tm=setTimeout(function(){
      lp=true;try{if(navigator.vibrate)navigator.vibrate(15)}catch(x){}
      openForm(null);
      if(S.modal&&S.modal.f)pick(true,function(items){modalFotos(S.modal.f,items)});
    },500);
  });
  document.addEventListener('pointerup',batal);document.addEventListener('pointercancel',batal);
  document.addEventListener('click',function(e){if(lp&&e.target.closest&&e.target.closest('.dockadd')){e.stopPropagation();e.preventDefault();lp=false}},true);
  document.addEventListener('contextmenu',function(e){if(e.target.closest&&e.target.closest('.dockadd'))e.preventDefault()});
})();
/** Pintasan di ikon aplikasi (manifest shortcuts): alamat ?aksi=tambah|verif|perbaikan|memo membuka bagian itu sekali setelah masuk. */
var AKSI=(function(){try{var a=new URLSearchParams(location.search).get('aksi')||'';return /^(tambah|verif|perbaikan|memo)$/.test(a)?a:''}catch(e){return ''}})();
function aksiPintas(){
  if(!AKSI||!S.user)return;
  var a=AKSI;AKSI='';
  try{history.replaceState(null,'',location.pathname)}catch(e){}
  if(a==='tambah'){if(canEdit())openForm(null);return}
  var tab=document.querySelector('.lainbar [data-v="'+a+'"]')||document.querySelector('#dock [data-v="'+a+'"]');
  if(!tab&&isAdmin()){S.lain=a;tab=document.querySelector('#dock [data-v="lain"]')}
  if(tab)tab.click();
}
/** Lencana angka di ikon aplikasi terpasang (jumlah yang perlu tindakan, sama dengan angka di dock). Dihapus saat keluar. */
var BADGE_N=-1;
function appBadge(){
  if(!navigator.setAppBadge)return;
  var n=0;
  if(S.paket&&S.user&&(canEdit()||isPJ())){
    var nV=S.siap?S.siap.length:0,nP=S.perlu?S.perlu.length:0,nM=M_?M_.jumlahPerlu():0;
    n=isAdmin()?nV+nP+nM:isPJ()?nP+nM:nV+nM;
  }
  if(n===BADGE_N)return;BADGE_N=n;
  try{(n?navigator.setAppBadge(n):navigator.clearAppBadge()).catch(function(){})}catch(e){}
}
async function loadRooms(){
  try{
    S.rooms=await api('ruangan');S.roomsReady=true;S.net='';
    if(!S.reg&&S.regOk!==false&&!S.regTry){S.regTry=true;muatRegistri()}
    lsSet('dl-rooms-'+S.paket.id,JSON.stringify(S.rooms));
    petunjukPasang();aksiPintas();
  }catch(e){
    if(e&&e.server){gagal(e);return}
    S.net='Tidak terhubung. Menampilkan data terakhir yang tersimpan.';
  }
  render();
  var T=tree(),s=ensureSel(T);
  if(s&&S.view==='form')loadDefects(s.r.id,false);
  if(canEdit())loadSiap();
  if(isPJ())loadPerlu();
}
async function loadDefects(rid,force){
  if(!rid)return;
  if(!force&&((S.defects[rid]&&!S.stale[rid])||S.loading[rid]))return;   // cegah pemuatan ganda
  S.loading[rid]=true;S.errs[rid]='';
  if(!S.defects[rid]&&S.paket){ // tampilkan dulu data tersimpan dari kunjungan sebelumnya, lalu segarkan dari server
    var c=await IDB.get('kv','def:'+S.paket.id+':'+rid);
    if(c&&c.length&&!S.defects[rid]&&S.user){S.defects[rid]=c;S.stale[rid]=1}
  }
  render();
  try{S.defects[rid]=await api('defect_daftar',{ruanganId:rid});delete S.stale[rid];recount(rid);simpanDef(rid)}
  catch(e){
    if(e&&e.server&&/Kode tidak dikenal|nonaktif/i.test(e.message)){S.loading[rid]=false;gagal(e);return}
    if(S.defects[rid]){S.stale[rid]=1;if(!(e&&e.server))toast('Tidak terhubung. Menampilkan data terakhir yang tersimpan.')}
    else S.errs[rid]=e&&e.server?e.message:'Tidak terhubung ke server.';
  }
  S.loading[rid]=false;render();
}
async function loadAll(){
  if(S.all)return S.all;
  S.all=await api('defect_semua',{});
  return S.all;
}

/* ---------- tampilan ---------- */
function setHead(){
  var pr=$('bProf'),k=S.user?'u':'g';
  if(pr.getAttribute('data-k')!==k||S.user){pr.setAttribute('data-k',k);var mj=(S.user&&M_&&!(canEdit()||isPJ()?(M_.punyaTab(S.user)&&!isAdmin()):false))?M_.jumlahPerlu():0;pr.innerHTML=S.user?'<span>'+esc(String(S.user.nama||S.user.peran).trim().charAt(0).toUpperCase())+'</span>'+(mj?'<i class="pbdg" aria-hidden="true">'+(mj>9?'9+':mj)+'</i>':''):ic('gear');pr.className='prof'+(S.user?' role '+String(S.user.peran).toLowerCase():'');pr.setAttribute('aria-label',S.user?'Pengaturan, '+S.user.nama+' ('+S.user.peran+')'+(mj?', '+mj+' memo perlu tindakan':''):'Pengaturan');pr.title=S.user?S.user.nama+' · '+S.user.peran:'Pengaturan';pr.parentNode.classList.toggle('in',!!S.user)}
  $('bBack').hidden=!(S.paket&&!S.user);
}
/* Skeleton: memakai kelas asli (pagehead, locbar, summary, sbar, chips, entry, phs, acts, kpis, bgrid) tanpa pembungkus,
   sehingga grid 12 kolom desktop terbentuk sama dan tata letak tidak melompat saat data tiba. */
function skb(w,h,c,x){return '<div class="sk'+(c?' c':'')+'" style="width:'+w+';height:'+h+'px'+(x?';'+x:'')+'"></div>'}
function skr(h,r,x){return '<div class="sk" style="height:'+h+'px;border-radius:'+r+'px'+(x?';'+x:'')+'"></div>'}
function skPagehead(){return '<div class="pagehead">'+skb('90px',12)+skb('200px',34,0,'margin-top:8px')+'</div>'}
function skLocbar(){return '<div class="locbar">'+skb('44px',44,1,'flex:none')+skr(52,14,'flex:1')+skb('44px',44,1,'flex:none')+'</div>'}
function skSummary(){return '<div class="summary">'+skb('72px',72,1,'flex:none')+'<div class="stats">'+[0,1,2,3].map(function(){return '<div>'+skb('26px',26,0,'margin:0 auto')+skb('36px',12,0,'margin:2px auto 0')+'</div>'}).join('')+'</div>'+skb('56px',56,0,'border-radius:14px;flex:none')+'</div>'}
function skSbar(){return '<div class="sbar">'+skr(46,14,'flex:1')+skb('78px',46,0,'border-radius:14px;flex:none')+skb('46px',46,0,'border-radius:14px;flex:none')+'</div>'}
function skChips(){return '<div class="chips">'+[88,84,104,92].map(function(w){return skb(w+'px',36,0,'border-radius:18px;flex:none')}).join('')+'</div>'}
function skEntry(){
  var ph=function(){return '<div class="ph">'+skb('40px',12,0,'margin:2px 0 8px')+'<div class="sk" style="width:100%;aspect-ratio:4/3;border-radius:12px"></div></div>'};
  return '<article class="group entry" aria-hidden="true"><div class="eh">'+skb('26px',26,0,'border-radius:8px;flex:none')+'<div style="flex:1;min-width:0">'+skb('92%',20)+skb('70%',20,0,'margin-top:4px')+'</div></div>'+
    '<div class="meta">'+skb('64px',22,0,'border-radius:11px')+skb('78px',22,0,'border-radius:11px')+skb('60px',22,0,'border-radius:11px')+'</div>'+
    '<div class="stp"><div class="bars">'+[0,1,2,3].map(function(){return skr(4,2)}).join('')+'</div><div class="lbls">'+[0,1,2,3].map(function(){return '<div>'+skb('70%',10,0,'margin:3px 0')+'</div>'}).join('')+'</div></div>'+
    '<div class="phs">'+ph()+ph()+'</div><div class="acts">'+skb('150px',44,0,'border-radius:22px')+skb('44px',44,1)+'</div></article>';
}
function skBanner(){return '<div class="banner" aria-hidden="true">'+skb('190px',14)+'</div>'}
function skRow(){return '<div class="row">'+skb('48px',12)+skb('100%',22,0,'margin-top:6px')+'</div>'}
function skel(kind){
  var h='<div class="vh" role="status">Memuat</div>',ent=function(n){var g='';for(var i=0;i<n;i++)g+=skEntry();return '<div class="entgrid">'+g+'</div>'};
  if(kind==='page')h+=skPagehead()+skLocbar()+skSummary()+skSbar()+skChips()+ent(2);   // layar Temuan belum punya ruangan
  else if(kind==='formlist')h+=skSummary()+skSbar()+skChips()+ent(2);                  // Temuan: header ada, daftar memuat
  else if(kind==='entries')h+=skBanner()+skSbar()+'<section class="group" aria-hidden="true"><div class="list"><div class="two">'+skRow()+skRow()+'</div><div class="two">'+skRow()+skRow()+'</div></div></section>'+ent(2);   // Verifikasi dan Perbaikan
  else if(kind==='table')h+='<div class="kpis" aria-hidden="true">'+[0,1,2].map(function(){return '<div class="kpi">'+skb('36px',28)+skb('52px',13,0,'margin-top:4px')+'</div>'}).join('')+'</div><section class="group" aria-hidden="true"><div style="padding:14px var(--margin)">'+skb('100%',16)+[0,1,2,3,4,5].map(function(){return skb('100%',22,0,'margin-top:12px')}).join('')+'</div></section>';
  else if(kind==='bento'){   // Rekap desktop
    var rows=function(n){var r='';for(var i=0;i<n;i++)r+=skb('100%',18,0,'margin:14px 0');return r};
    h+='<div class="bhead" aria-hidden="true"><div>'+skb('120px',42)+skb('220px',14,0,'margin-top:8px')+'</div><div class="bact">'+skb('150px',40,0,'border-radius:12px')+skb('120px',40,0,'border-radius:12px')+skb('90px',40,0,'border-radius:12px')+'</div></div><div class="bgrid" aria-hidden="true">'+
      '<section class="bc s6">'+skb('150px',12)+skb('140px',72,0,'margin:14px 0')+skr(12,6,'width:100%;margin-bottom:16px')+'<div class="tiles">'+[0,1,2].map(function(){return skr(80,18)}).join('')+'</div></section>'+
      '<section class="bc s3">'+skb('100px',12)+rows(5)+'</section><section class="bc s3">'+skb('140px',12)+skb('80px',80,0,'margin-top:14px')+'</section>'+
      [0,1,2].map(function(){return '<section class="bc s4">'+skb('140px',12)+rows(3)+'</section>'}).join('')+'</div>';
  }
  else if(kind==='kelola')h+=[3,2].map(function(n){var r='';for(var i=0;i<n;i++)r+=skRow();return '<section class="group" aria-hidden="true">'+skb('120px',14,0,'margin:14px var(--margin) 8px')+'<div class="list">'+r+'</div></section>'}).join('');
  return h;
}
var SCR={};   // posisi gulir terakhir per layar (kunci sama dengan S.drawn), dipulihkan saat kembali ke layar itu
function kunciLayar(){return !S.paket?'pick':!S.user?'login':S.view+(S.view==='form'&&S.sel?':'+S.sel.r:'')}
function render(){
  var kPrev=S.drawn,kNow=kunciLayar(),sy=window.pageYOffset||0;
  if(kPrev&&kPrev!==kNow)SCR[kPrev]=sy;if(!S.user)SCR={};
  document.body.classList.toggle('wide',!!(S.paket&&S.user&&(S.view==='form'||S.view==='verif'||S.view==='perbaikan'||S.view==='memo')&&desk()));
  document.body.classList.toggle('bento',!!(S.paket&&S.user&&((S.view==='rekap'&&canEdit())||(S.view==='kelola'&&isAdmin()))&&desk()));
  setHead();setDock();
  if(!S.paket)renderPick();else if(!S.user)renderLogin();else renderMain();
  var key=!S.paket?'pick':!S.user?'login':S.view+(S.view==='form'?':'+S.sel.r:'');
  if(S.drawn!==key){S.drawn=key;S.cuPrev={};app.classList.remove('enter');void app.offsetWidth;app.classList.add('enter');if(S.user)window.scrollTo(0,SCR[key]||0)}
  animHitung();tbarMin();lensAll(app);
}
/* Rekap: angka naik dari 0 (atau dari nilai sebelumnya bila berubah, mis. ganti gedung). Bar tumbuh lewat CSS. */
function hitungKe(b,a,z,ms,suf){
  var t0=performance.now();b.textContent=a+suf;
  (function tik(t){var p=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-p,3);b.textContent=Math.round(a+(z-a)*e)+suf;if(p<1)requestAnimationFrame(tik)})(t0);
}
function animRekap(){
  if(S.view!=='rekap'||!animOn())return;
  Array.prototype.forEach.call(document.querySelectorAll('.kpi b,.bigp b,.tl b,.bc .huge'),function(b,i){
    var tx=b.textContent,z=parseInt(tx,10);if(!isFinite(z))return;
    var a=S.cuPrev[i];S.cuPrev[i]=z;if(a===undefined)a=0;if(a===z)return;
    hitungKe(b,a,z,520,tx.replace(/^\d+/,''));
  });
}
/* Angka ringkasan yang berubah: naik bertahap (maks 260 ms) disertai sentakan kecil. */
function animHitung(){
  if(!animOn())return;
  animRekap();
  Array.prototype.forEach.call(document.querySelectorAll('.stats b[data-from]'),function(b){
    var a=Number(b.getAttribute('data-from')),z=Number(b.textContent);b.removeAttribute('data-from');
    if(!isFinite(a)||a===z)return;
    if(b.animate)b.animate([{transform:'scale(1.3)'},{transform:'none'}],{duration:280,easing:'cubic-bezier(.34,1.4,.64,1)'});
    if(z<a)return;
    var t0=performance.now();b.textContent=a;
    (function tik(t){var p=Math.min(1,(t-t0)/260);b.textContent=Math.round(a+(z-a)*p);if(p<1)requestAnimationFrame(tik)})(t0);
  });
}
/* Hapus kartu: kartu mengempis, lalu kartu di bawahnya naik mengisi tempat (FLIP, hanya transform). */
function kartuPosisi(){var m={};Array.prototype.forEach.call(document.querySelectorAll('article.entry'),function(a){m[a.getAttribute('data-id')]=a.getBoundingClientRect().top});return m}
function kartuKeluar(id){
  return new Promise(function(res){
    var a=Array.prototype.filter.call(document.querySelectorAll('article.entry'),function(x){return x.getAttribute('data-id')===id})[0];
    if(!a||!a.animate||!animOn()){res();return}
    var an=a.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.94) translateY(-6px)'}],{duration:200,easing:'ease-in',fill:'forwards'});
    an.onfinish=res;an.oncancel=res;setTimeout(res,320);
  });
}
function kartuNaik(awal){
  if(!animOn())return;
  Array.prototype.forEach.call(document.querySelectorAll('article.entry'),function(a){
    var t=awal[a.getAttribute('data-id')];if(t===undefined||!a.animate)return;
    var dy=t-a.getBoundingClientRect().top;if(Math.abs(dy)<2)return;
    a.animate([{transform:'translateY('+dy+'px)'},{transform:'none'}],{duration:260,easing:'cubic-bezier(.3,.9,.3,1)'});
  });
}
function kartuLihat(id){   // kartu yang baru disimpan digulir ke layar supaya "mendarat" terlihat
  var a=Array.prototype.filter.call(document.querySelectorAll('article.entry'),function(x){return x.getAttribute('data-id')===id})[0];
  if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest',behavior:animOn()?'smooth':'auto'});
}
function renderPick(){
  var h='<div class="centered"><div class="brand"><img src="icon-192.png" alt="" width="76" height="76"><h1>Defect List</h1><div class="note" style="padding:6px 0 0;text-align:center">Catatan temuan pekerjaan konstruksi</div></div><section class="pick"><div class="cap pkcap">Pilih paket</div><div class="pklist">';
  PAKET_LIST.forEach(function(p){
    h+='<button type="button" class="pkcard" data-act="paket" data-id="'+esc(p.id)+'"><span class="t"><b>'+esc(p.nama)+'</b><span>'+esc(p.ringkas||p.label)+'</span></span><svg class="chev" viewBox="0 0 12 18"><path d="M3 3l6 6-6 6"/></svg></button>';
  });
  app.innerHTML=h+'</div></section></div>'+verHtml();verIsi();
}
function renderLogin(){
  var p=S.paket;
  var an=S.loginErr?'':' ak-masuk';   // animasi masuk hanya saat layar dibuka, bukan saat menampilkan galat
  var h='<div class="centered"><div class="pagehead"><div class="cap'+an+'" style="--m:0">'+esc(p.nama)+' &middot; '+esc(p.label)+'</div><h1 class="'+an.trim()+'" style="--m:1">Masuk</h1><div class="note'+an+'" style="padding:4px 0 0;--m:2">Masukkan kode akses 6 karakter dari admin.</div></div>';
  if(!p.apiUrl)h+='<section class="group pad"><div class="err" style="padding:0">URL API paket ini belum diisi di config.js.</div></section>';
  else{
    var kv=(S.kode||'').slice(0,6),bx='';
    for(var i=0;i<6;i++)bx+='<span class="cb'+(i<kv.length?' f':'')+(i===Math.min(kv.length,5)?' on':'')+an+'" style="--i:'+i+';--m:'+(4+i)+'">'+esc(kv[i]||'')+'</span>';
    h+='<div class="ak" id="ak"><div class="codewrap'+(S.loginErr?' bad':'')+'"><div class="boxes" id="boxes" aria-hidden="true">'+bx+'</div>'+
      '<input type="text" id="kode" class="cin" autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" aria-label="Kode akses, 6 karakter" value="'+esc(kv)+'"></div>'+
      '<div style="height:10px"></div><div style="text-align:center"><button type="button" class="chip" data-act="tempel">Tempel kode</button></div><div style="height:14px"></div>';
    if(S.loginErr)h+=S.loginNet?'<div class="errbox" role="alert">'+esc(S.loginErr)+'</div>':'<div class="err" role="alert" style="padding:0 4px 14px">'+esc(S.loginErr)+'</div>';
    h+='<button type="button" class="btn rect akbtn'+an+'" style="--m:11" id="bMasuk" data-act="masuk"><span class="ak-label">'+(S.loginNet&&S.loginErr?'Coba lagi':'Masuk')+'</span><span class="ak-spin"></span><svg class="ak-centang" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div>';
  }
  app.innerHTML=h+'</div>'+verHtml();verIsi();
  var ki=$('kode');if(ki&&S.paket.apiUrl)ki.focus({preventScroll:true});
}

/** Versi aplikasi dan status koneksi di layar pemilih paket dan masuk.  */
function verHtml(){return '<div class="verinfo" role="status"></div>'}
var APP_VER='1.4';   // nomor versi yang dilihat pengguna; naikkan bersama CACHE di sw.js bila ada fitur baru
function verIsi(){
  var el=app.querySelector('.verinfo');if(!el)return;
  var on=navigator.onLine!==false;
  el.innerHTML='Versi '+APP_VER+' &middot; <span class="vdot'+(on?'':' off')+'" aria-hidden="true"></span>'+(on?'Terhubung':'Tidak ada sinyal');
}
/** Lensa bersama untuk kontrol segmen (.seg): satu penanda geser di belakang tombol aktif. Layar digambar ulang tiap perubahan, jadi posisi lama diingat per kontrol dan lensa baru meluncur dari sana. */
var LENS_POS={};
function lensAll(root){
  var segs=root.querySelectorAll('.seg');
  Array.prototype.forEach.call(segs,function(sg){
    var on=sg.querySelector('button.on');if(!on||!on.offsetWidth)return;
    var key=Array.prototype.map.call(sg.querySelectorAll('button'),function(b){return b.getAttribute('data-act')||b.getAttribute('data-v')||''}).join('|')+'#'+(sg.getAttribute('aria-label')||'');
    var ln=sg.querySelector('.lens');if(!ln){ln=document.createElement('i');ln.className='lens';ln.setAttribute('aria-hidden','true');sg.insertBefore(ln,sg.firstChild)}
    sg.classList.add('lensed');
    var x=on.offsetLeft,w=on.offsetWidth;
    ln.style.width=w+'px';ln.style.transform='translateX('+x+'px)';
    var old=LENS_POS[key];LENS_POS[key]={x:x,w:w};
    if(old&&(old.x!==x||old.w!==w)&&animOn()&&ln.animate)ln.animate([{transform:'translateX('+old.x+'px)',width:old.w+'px'},{transform:'translateX('+x+'px)',width:w+'px'}],{duration:250,easing:'cubic-bezier(.3,.9,.3,1)'});
  });
}
var indLoop=0;
var LAIN=[['verif','Verifikasi'],['perbaikan','Perbaikan'],['memo','Memo']];   // isi tab Lainnya (Admin); tombol di dock membuka yang terakhir dipakai
function lainBar(){
  var cnt={verif:S.siap?S.siap.length:0,perbaikan:S.perlu?S.perlu.length:0,memo:M_?M_.jumlahPerlu():0};
  return '<div class="chips lainbar" role="tablist" aria-label="Bagian Lainnya">'+LAIN.map(function(x){return '<button type="button" class="chip ico'+(S.view===x[0]?' on':'')+'" role="tab" aria-selected="'+(S.view===x[0])+'" data-act="tab" data-v="'+x[0]+'">'+ic(x[0])+'<span class="tx">'+x[1]+'</span>'+(cnt[x[0]]?' <b class="aqn">'+cnt[x[0]]+'</b>':'')+'</button>'}).join('')+'</div>';
}
/** Tombol tambah di dalam dock melebar atau menyempit selama animasi, sehingga posisi tab bergeser; penanda tab aktif mengikuti sampai tata letak berhenti bergerak. */
function trackInd(ms){var t0=Date.now(),id=++indLoop;(function f(){if(id!==indLoop)return;moveInd();if(Date.now()-t0<ms)requestAnimationFrame(f)})()}
function setDock(){
  appBadge();
  var addBerubah=false;
  var el=$('dock'),show=!!(S.paket&&S.user&&(canEdit()||isPJ()));
  if(show){
    var t=isPJ()?[['form','Temuan'],['perbaikan','Perbaikan']]:isAdmin()?[['form','Temuan'],['rekap','Rekap'],['kelola','Kelola'],['lain','Lainnya']]:[['form','Temuan'],['verif','Verifikasi'],['rekap','Rekap']];
    if(M_&&M_.punyaTab(S.user)&&!isAdmin())t.push(['memo','Memo']);   // QC MK, QC PJ, dan PJ; Admin memegang Memo di bawah tab Lainnya
    var add=canEdit();
    var keys=t.map(function(x){return x[0]}).join(',')+(add?'+':'');
    if(el.getAttribute('data-keys')!==keys){
      el.setAttribute('data-keys',keys);el.classList.remove('anim');
      var bt=t.map(function(x){return '<button type="button" data-act="tab" data-v="'+x[0]+'">'+ic(x[0]==='lain'?'titik':x[0])+'<span>'+x[1]+'</span>'+((x[0]==='verif'||x[0]==='perbaikan'||x[0]==='memo'||x[0]==='lain')?'<i class="bdg" hidden></i>':'')+'</button>'});
      if(add)bt.push('<button type="button" class="dockadd" data-act="tambah" aria-label="Tambah temuan">'+ic('plus')+'</button>');
      el.innerHTML='<span class="ind"></span>'+bt.join('');
    }
    var wasNoadd=el.classList.contains('noadd');
    el.classList.toggle('wadd',add);
    el.classList.toggle('padat',t.length>=6);
    var ad=el.querySelector('.dockadd');
    if(ad){var vis=S.view==='form';el.classList.toggle('noadd',!vis);ad.tabIndex=vis?0:-1;ad.setAttribute('aria-hidden',vis?'false':'true');addBerubah=wasNoadd!==!vis}
    Array.prototype.forEach.call(el.querySelectorAll('button'),function(bt){
      var bg=bt.querySelector('.bdg');if(!bg)return;
      var vk=bt.getAttribute('data-v'),pj=vk==='perbaikan',mm=vk==='memo',nV=S.siap?S.siap.length:0,nP=S.perlu?S.perlu.length:0,nM=M_?M_.jumlahPerlu():0,ln=vk==='lain',n=ln?nV+nP+nM:mm?nM:pj?nP:nV;
      var pn=bg._n;bg._n=n;
      bg.textContent=n>99?'99+':n;bg.hidden=!n;bg.setAttribute('aria-label',n+(ln?' perlu tindakan (verifikasi, perbaikan, memo)':mm?' memo perlu tindakan':pj?' perlu dikerjakan':' menunggu verifikasi'));
      if(n&&pn!==undefined&&pn!==n&&animOn()&&bg.animate)bg.animate([{transform:'scale(.4)'},{transform:'scale(1.3)',offset:.6},{transform:'none'}],{duration:300,easing:'ease-out'});   // lencana "pop" saat angkanya berubah
    });
    Array.prototype.forEach.call(el.querySelectorAll('button'),function(b){
      var bv=b.getAttribute('data-v'),on=bv==='lain'?LAIN.some(function(x){return x[0]===S.view}):bv===S.view;
      if(on&&!b.classList.contains('on')&&el.classList.contains('anim')&&animOn()){var sv=b.querySelector('svg');if(sv&&sv.animate)sv.animate([{transform:'none'},{transform:'translateY(-6px) scale(1.18)',offset:.4},{transform:'translateY(0) scale(.96)',offset:.7},{transform:'none'}],{duration:340,easing:'ease-out'})}   // ikon tab memantul kecil
      b.classList.toggle('on',on);
      if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
  }
  el.hidden=!show;document.body.classList.toggle('hasdock',show);
  if(show){moveInd();if(addBerubah)trackInd(560)}
}
function moveInd(){
  var el=$('dock'),b=el.querySelector('button.on'),ind=el.querySelector('.ind');
  if(!b||!ind||!b.offsetWidth)return;
  el.style.setProperty('--dadd',b.offsetHeight+'px');
  ind.style.width=b.offsetWidth+'px';ind.style.height=b.offsetHeight+'px';
  ind.style.transform='translate('+b.offsetLeft+'px,'+b.offsetTop+'px)';
  if(ind._b&&ind._b!==b&&el.classList.contains('anim')&&animOn()&&ind.animate)ind.animate([{scale:'1 1'},{scale:'1.14 .92',offset:.35},{scale:'1 1'}],{duration:480,easing:'cubic-bezier(.3,1.2,.5,1)'});   // lensa meregang sedikit saat berpindah tab
  ind._b=b;
  if(!el.classList.contains('anim'))requestAnimationFrame(function(){el.classList.add('anim')});
}
window.addEventListener('resize',moveInd);window.addEventListener('load',moveInd);
/* ----- dock: geser jari melintasi tab untuk memilih, dan mengecil saat daftar digulir ke bawah ----- */
(function(){
  var dock=null,scrub=null,tutupKlik=0;
  function D(){dock=$('dock');return dock&&!dock.hidden?dock:null}
  function tabs(){return Array.prototype.slice.call(dock.querySelectorAll('button:not(.dockadd)'))}
  document.addEventListener('pointerdown',function(e){
    if(!D())return;
    var b=e.target.closest&&e.target.closest('#dock button:not(.dockadd)');if(!b)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    scrub={id:e.pointerId,x0:e.clientX,aktif:false,hot:b};
  },true);
  document.addEventListener('pointermove',function(e){
    if(!scrub||e.pointerId!==scrub.id||!D())return;
    if(!scrub.aktif){
      if(Math.abs(e.clientX-scrub.x0)<10)return;
      scrub.aktif=true;dock.classList.add('scrub');
      try{dock.setPointerCapture(e.pointerId)}catch(x){}
    }
    var ts=tabs(),dr=dock.getBoundingClientRect(),f=ts[0].getBoundingClientRect(),l=ts[ts.length-1].getBoundingClientRect();
    var x=Math.max(f.left,Math.min(l.right,e.clientX)),hot=ts[0];
    ts.forEach(function(t){var r=t.getBoundingClientRect();if(x>=r.left&&x<=r.right)hot=t});
    var ind=dock.querySelector('.ind'),w=hot.offsetWidth;
    ind.style.width=w+'px';
    ind.style.transform='translate('+Math.round(Math.max(f.left,Math.min(l.right-w,x-w/2))-dr.left)+'px,'+hot.offsetTop+'px)';
    if(hot!==scrub.hot){
      scrub.hot=hot;
      ts.forEach(function(t){t.classList.toggle('hot',t===hot)});
      try{if(navigator.vibrate&&animOn())navigator.vibrate(8)}catch(x){}
    }
  },true);
  function akhiri(e,pilih){
    if(!scrub||e.pointerId!==scrub.id)return;
    var s=scrub;scrub=null;
    if(!s.aktif)return;
    if(dock){dock.classList.remove('scrub');tabs().forEach(function(t){t.classList.remove('hot')});try{dock.releasePointerCapture(e.pointerId)}catch(x){}}
    if(pilih&&s.hot&&!s.hot.classList.contains('on'))s.hot.click();else moveInd();
    tutupKlik=Date.now();
  }
  document.addEventListener('pointerup',function(e){akhiri(e,true)},true);
  document.addEventListener('pointercancel',function(e){akhiri(e,false)},true);
  document.addEventListener('click',function(e){   // klik susulan dari gestur geser tidak boleh memilih tab lagi
    if(Date.now()-tutupKlik<350&&e.target.closest&&e.target.closest('#dock')){e.stopPropagation();e.preventDefault()}
  },true);
  /* Mengecil: gulir ke bawah menyembunyikan label, gulir ke atas atau kembali ke atas memulihkannya. */
  var lastY=0,acc=0,mini=false,tm=0;
  function setMini(v){
    mini=v;dock.classList.toggle('mini',v);dock.classList.add('sync');trackInd(460);
    clearTimeout(tm);tm=setTimeout(function(){dock.classList.remove('sync')},500);
  }
  window.addEventListener('scroll',function(){
    if(!D())return;
    var y=window.pageYOffset||0;if(y<0)return;
    var dy=y-lastY;lastY=y;
    if(dy*acc<0)acc=0;acc+=dy;
    var sisa=document.documentElement.scrollHeight-window.innerHeight,mau=mini;
    if(y<40)mau=false;
    else if(acc>28&&sisa>200&&y>120)mau=true;
    else if(acc<-14)mau=false;
    if(mau!==mini)setMini(mau);
  },{passive:true});
})();
function renderMain(){
  var h='';
  if(S.net)h+='<div class="err" role="status">'+esc(S.net)+'</div>';
  if(isAdmin()&&S.paket&&S.user&&(S.view==='verif'||S.view==='perbaikan'||S.view==='memo'))h+=lainBar();
  if(S.view==='verif'&&canEdit())h+=verifHtml();
  else if(S.view==='perbaikan'&&(isPJ()||isAdmin()))h+=perbaikanHtml();
  else if(S.view==='memo'&&M_&&M_.punyaTab(S.user))h+=M_.tabHtml();
  else if(S.view==='rekap'&&canEdit())h+=(M_?M_.rekapToggle():'')+((M_&&S.rekapMode==='memo')?(desk()?M_.rekapBentoHtml():M_.rekapHtml()):(desk()?rekapBentoHtml():rekapHtml()));
  else if(S.view==='kelola'&&isAdmin())h+=kelolaHtml();
  else h+=formHtml();
  app.innerHTML=h;
}

function selHtml(id,opts,val,label){
  return '<label class="row"><span class="lbl">'+label+'</span><select data-sel="'+id+'"'+(opts.length===1?' class="one" disabled':'')+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===val?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>';
}
function fltList(list){
  var f=S.flt,q=f.q.trim().toLowerCase();
  return list.filter(function(d){return (!f.st||d.status===f.st)&&(!f.bd||d.bidang===f.bd)&&(!f.tk||d.tingkat===f.tk)&&(!f.el||d.elemen===f.el)&&(!q||String(d.uraian+' '+(d.titik||'')+' '+(d.elemen||'')+' '+(d.detail||'')).toLowerCase().indexOf(q)>=0)});
}
function fltOn(){var f=S.flt;return !!(f.q.trim()||f.st||f.bd||f.tk||f.el)}
function entriesHtml(list){
  var v=fltList(list),h='';
  if(!v.length)return '<div class="empty">Tidak ada temuan yang cocok.<div class="acts" style="padding:10px 0 0"><button type="button" class="pill" data-act="fclr">Atur ulang</button></div></div>';
  v.forEach(function(d,i){h+=entryHtml(d,d.no||i+1,i)});
  return h;
}
function fcountText(list){return fltOn()?fltList(list).length+' dari '+list.length+' temuan':''}
function refreshList(){
  var s=ensureSel(tree());if(!s)return;var list=S.defects[s.r.id];if(!list)return;
  var el=$('elist');if(el)el.innerHTML=entriesHtml(list);
  var sg=$('fseg');if(sg)Array.prototype.forEach.call(sg.querySelectorAll('button'),function(b){b.classList.toggle('on',(b.getAttribute('data-v')||'')===S.flt.st)});
  var ct=$('fcount');if(ct)ct.textContent=fcountText(list);
  var fb=document.querySelector('[data-act="filterbuka"]');if(fb){var fx=S.flt,nfx=(fx.bd?1:0)+(fx.tk?1:0)+(fx.el?1:0);fb.textContent='Filter'+(nfx?' · '+nfx:'')}
}
function filterHtml(list,c){   // chip status (Semua, Open, Proses, Close); filter lain ada di lembar Filter
  var seg=[['','Semua',c.total],['Open','Open',c.open],['Dalam proses','Proses',c.proses],['Close','Close',c.close]].map(function(o){return '<button type="button" class="chip'+(S.flt.st===o[0]?' on':'')+'" data-act="fst" data-v="'+esc(o[0])+'">'+o[1]+' '+o[2]+'</button>'}).join('');
  return '<div class="chips" id="fseg" role="group" aria-label="Status">'+seg+'</div>';
}
function filterLembarHtml(){
  var s=ensureSel(tree()),list=(s&&S.defects[s.r.id])||[],els=[];
  list.forEach(function(d){if(d.elemen&&els.indexOf(d.elemen)<0)els.push(d.elemen)});els.sort();
  var f=S.flt,opt=function(arr,cur,all){return '<option value="">'+all+'</option>'+arr.map(function(x){return '<option value="'+esc(x)+'"'+(x===cur?' selected':'')+'>'+esc(x)+'</option>'}).join('')};
  return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Filter"><h2>Filter</h2><section class="group"><div class="list"><div class="two"><label class="row"><span class="lbl">Bidang</span><select data-fil="bd">'+opt(BIDANG,f.bd,'Semua')+'</select></label><label class="row"><span class="lbl">Tingkat</span><select data-fil="tk">'+opt(TINGKAT,f.tk,'Semua')+'</select></label></div>'+
    (els.length?'<label class="row"><span class="lbl">Elemen</span><select data-fil="el">'+opt(els,f.el,'Semua')+'</select></label>':'')+'</div><div class="gf" id="fcount">'+esc(fcountText(list))+'</div></section>'+
    '<button type="button" class="btn sec" data-act="fclr2">Atur ulang</button><button type="button" class="btn" data-act="mtutup">Selesai</button></div></div>';
}
function aksiLembarHtml(){
  return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Menu"><div class="group kmenu"><div class="list">'+
    '<button type="button" class="row act" data-act="pdf">PDF ruangan ini</button><button type="button" class="row act" data-act="pdfbidang">PDF per bidang</button><button type="button" class="row act" data-act="muat">Muat ulang</button></div></div>'+
    '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
}
function lokLembarHtml(){
  var T=tree(),s=ensureSel(T);if(!s)return '';var lb=labelBidang(s.r.bidang);
  return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Pilih lokasi"><h2>Pilih lokasi</h2><section class="group"><div class="list">'+
    selHtml('g',T.map(function(g){return [g.nama,g.nama]}),s.g.nama,lb.area)+
    '<div class="two">'+selHtml('l',s.g.lantai.map(function(l){return [l.nama,l.nama]}),s.l.nama,lb.level)+selHtml('r',s.l.ruangan.map(function(r){return [r.id,r.nama]}),s.r.id,lb.lokasi)+'</div></div></section>'+
    '<button type="button" class="btn" data-act="mtutup">Selesai</button></div></div>';
}
function formHtml(){
  if(!S.roomsReady&&!S.rooms.length)return skel('page');
  var T=tree();
  if(!T.length)return '<div class="empty"><b>Belum ada ruangan.</b>'+(isAdmin()?'<div class="acts" style="padding:12px 0 0;justify-content:center"><button type="button" class="pill go" data-act="tab" data-v="kelola">Buka Kelola</button></div>':'<div>Hubungi admin.</div>')+'</div>';
  var s=ensureSel(T),rid=s.r.id,list=S.defects[rid];
  if(S.flt.rid!==rid)S.flt={rid:rid,q:'',st:'',bd:'',tk:'',el:''};
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Temuan</h1>'+tmodeHtml()+'</div>';
  if(S.semua){var l0=semuaList();if(l0)h=h.replace(/<div class="cap">[^<]*<\/div>/,'<div class="cap">'+aqCap(l0,AQ.form)+'</div>');return h+semuaHtml()}
  h+='<div class="locbar"><button type="button" class="btn-ic" data-act="nav" data-d="-1" aria-label="Ruangan sebelumnya">'+ic('prev')+'</button>'+
    '<button type="button" class="locbtn" data-act="lokpilih" aria-label="Pilih lokasi"><span class="lk">'+esc(s.g.nama)+' &rsaquo; '+esc(s.l.nama)+'</span><b>'+esc(s.r.nama)+'</b><svg class="chv" viewBox="0 0 12 18" aria-hidden="true"><path d="M2 7l4-4 4 4M2 11l4 4 4-4"/></svg></button>'+
    '<button type="button" class="btn-ic" data-act="nav" data-d="1" aria-label="Ruangan berikutnya">'+ic('next')+'</button></div>';
  if(!list&&!S.errs[rid]){
    if(!S.loading[rid])setTimeout(function(){if(!S.defects[rid]&&!S.loading[rid]&&!S.errs[rid])loadDefects(rid,false)},0);   // jangan pernah terjebak tanpa pemuatan
    return h+skel('formlist');
  }
  if(!list){
    h+='<div class="err">'+esc(S.errs[rid])+'</div><button type="button" class="btn sec" data-act="muat">Coba lagi</button>';
    return h;
  }
  var staleN=S.stale[rid]?'<div class="note" style="padding:0 0 10px" role="status">Data tersimpan, belum diperbarui dari server.</div>':'';
  if(!desk())h+=staleN;   // desktop: catatan di bawah ringkasan; sebagai anak grid selebar penuh di antara bilah lokasi dan ringkasan ia membuat tata letak melompat saat hilang
  var c=cnt(list),p=c.total?Math.round(c.close/c.total*100):0;
  var ringGo=S.ringPrev[rid]!==p;S.ringPrev[rid]=p;
  h+='<div class="summary"><div class="ring'+(c.total&&c.close===c.total?' full':'')+'"><svg viewBox="0 0 72 72"><circle class="tr" cx="36" cy="36" r="30"/><circle class="on'+(ringGo?' go':'')+'" cx="36" cy="36" r="30" style="stroke-dashoffset:'+(188.5*(1-p/100)).toFixed(1)+'"/></svg><div class="c">'+pct(c)+'</div></div>'+
    '<div class="stats">'+[['',c.total,'Total'],['o',c.open,'Open'],['p',c.proses,'Proses'],['c',c.close,'Close']].map(function(x){
      var kc=rid+'|'+x[2],pv=S.cntPrev[kc];S.cntPrev[kc]=x[1];
      return '<div'+(x[0]?' class="'+x[0]+'"':'')+'><b'+(pv!==undefined&&pv!==x[1]?' data-from="'+pv+'"':'')+'>'+x[1]+'</b><span>'+x[2]+'</span></div>'}).join('')+'</div>'+
    '<button type="button" class="pdfbtn" data-act="pdf" aria-label="PDF ruangan ini">'+ic('pdf')+'<span>PDF</span></button></div>';
  if(desk())h+=staleN;
  if(!list.length)return h+'<div class="empty"><b>Belum ada temuan di ruangan ini.</b>'+(canEdit()?'<div class="acts" style="padding:12px 0 0;justify-content:center"><button type="button" class="pill go" data-act="tambah">'+ic('plus')+'Tambah temuan</button></div>':'')+'</div>';
  var f=S.flt,nf=(f.bd?1:0)+(f.tk?1:0)+(f.el?1:0);
  h+='<div class="sbar"><label class="sinp">'+ic('search')+'<input type="text" id="fq" placeholder="Cari temuan" autocomplete="off" value="'+esc(f.q)+'"></label>'+
    '<button type="button" class="btn-sq" data-act="filterbuka">Filter'+(nf?' &middot; '+nf:'')+'</button><button type="button" class="btn-sq ic" data-act="menuaksi" aria-label="Menu aksi">&#8943;</button></div>';
  return h+filterHtml(list,c)+(M_?M_.legenda(list):'')+'<div id="elist">'+entriesHtml(list)+'</div>';
}
/* mode: 'kartu' = satu foto paling atas dengan lencana +N; 'detail' = sampai 4 foto; kosong = semua. */
function thumbsHtml(items,jenis,d,removable,mode){
  var jobs=S.up.filter(function(j){return j.did===d.id&&j.jenis===jenis});
  var lim=mode==='kartu'?1:mode==='detail'?4:0,tampil=lim?items.slice(0,lim):items;
  if(!items.length&&!jobs.length)return '<div class="none">Belum ada foto '+jenis+'</div>';
  return '<div class="thumbs">'+(items.length>1&&!mode?'<button type="button" class="more" data-act="ttx" data-d="'+esc(d.id)+'" aria-label="Lihat semua foto">+'+(items.length-1)+'</button>':'')+tampil.map(function(f,ix){
    return '<div class="thumb"><button type="button" data-act="zoom" data-f="'+esc(f.id)+'" data-d="'+esc(d.id)+'" data-j="'+jenis+'" aria-label="Lihat foto"><img loading="lazy" referrerpolicy="no-referrer" alt="Foto '+jenis+'" src="'+(S.pv[f.id]||thumb(f.id,400))+'"></button>'+
      (f.t?'<span class="dt">'+esc(fmt(f.t))+'</span>':'')+
      (S.fotoOk[f.id]?(delete S.fotoOk[f.id],'<span class="ok" aria-hidden="true">'+SVG_CEK+'</span>'):'')+
      (removable?'<button type="button" class="x" data-act="delfoto" data-d="'+esc(d.id)+'" data-j="'+jenis+'" data-f="'+esc(f.id)+'" aria-label="Hapus foto">&times;</button>':'')+(mode==='kartu'&&ix===0&&items.length>1?'<button type="button" class="plus" data-act="fotodetail" data-d="'+esc(d.id)+'" aria-label="Lihat semua '+items.length+' foto">+'+(items.length-1)+'</button>':'')+'</div>';
  }).join('')+(mode==='detail'&&items.length>tampil.length?'<div class="note" style="grid-column:1/-1;padding:4px 0 0">+'+(items.length-tampil.length)+' foto lain (kelola lewat Ubah temuan)</div>':'')+jobs.map(upHtml).join('')+'</div>';
}
function phHtml(d,jenis,ro,mode){
  var ed=canEdit()&&!ro;
  return '<div class="phl"><span>'+(jenis==='before'?'Before':'After')+'</span>'+'</div>'+thumbsHtml(jenis==='before'?d.fotoBefore:d.fotoAfter,jenis,d,false,mode);
}
/* Stepper empat tahap: Temuan, Perbaikan, After, Verifikasi. Hijau selesai, oranye sedang, merah ditolak. */
function stepperHtml(d){
  var af=d.fotoAfter.length>0,vd=d.verifikasi,tolak=vd==='Ditolak';
  var st=['on',d.mulai?(af&&!tolak?'on':'go'):'',af&&!tolak?'on':'',vd==='Diterima'?'on':tolak?'bad':af?'go':''];
  var nm=['Temuan','Perbaikan','After','Verifikasi'];
  var pv=S.stpPrev[d.id],kk=0,fl=st.map(function(s,i){return pv&&pv[i]!==s&&s?kk++:-1});S.stpPrev[d.id]=st.slice();   // batang yang berubah terisi berurutan
  return '<div class="stp" aria-label="Tahap: '+nm.map(function(n,i){return n+(st[i]==='on'?' selesai':st[i]==='go'?' sedang':st[i]==='bad'?' ditolak':'')}).join(', ')+'">'+
    '<div class="bars">'+st.map(function(s,i){return '<i class="'+s+(fl[i]>=0?' fill" style="--i:'+fl[i]:'')+'"></i>'}).join('')+'</div>'+
    '<div class="lbls">'+nm.map(function(n,i){return '<span class="'+st[i]+'">'+n+'</span>'}).join('')+'</div></div>';
}
/* Temuan bermemo: alasan "Diterima" belum bisa (memo belum disahkan QC MK atau PJ belum mengisi tindak lanjut); kosong bila tidak ada hambatan. */
function hambatTerima(d){
  if(!d||!d.memoId)return '';
  var ms=d.memoStatus;
  if(ms==='MENUNGGU TTD MK')return 'Site memo belum disahkan QC MK.';
  if(['TINDAK LANJUT','PEMERIKSAAN II','CLOSE'].indexOf(ms)<0)return 'Menunggu PJ mengisi tindak lanjut site memo. Setelah terisi, tombol Diterima aktif. Anda tetap bisa menolak.';
  return '';
}
/* Hak mengubah, menghapus, dan mengelola foto Before: Admin, pelapor, QC MK yang berwenang (Koordinator semua bidang). Cermin aturan server (_bolehKelolaTemuan). */
var QC_GRUP_BIDANG={Arsitektur:'ARS',Struktur:'STR',MEEP:'MEEP',Infrastruktur:'INF',Lansekap:'LSC',HSE:'HSE',BGH:'BGH'};   // cermin QC_GRUP di server; QC dan TA sama-sama berwenang
function bisaKelola(d){
  if(typeof d.kelola==='boolean')return d.kelola;   // server menentukan (sidik akun); yang di bawah hanya cadangan untuk data tanpa penanda
  var u=S.user;if(!u)return false;
  if(u.peran==='ADMIN')return true;
  if(u.peran!=='MK')return false;
  if(!d.by||d.by===u.nama)return true;
  return u.qc==='YA'&&(u.qcBidang==='KOORD'||u.qcBidang===QC_GRUP_BIDANG[d.bidang]);
}
/* Dialog "Temuan lengkap": ringkasan di atas, lalu bagian Temuan, Pelapor, Site memo, Perbaikan, dan foto. Kartu sengaja ringkas; rincian lengkap ada di sini. */
function ttxHtml(d){
  function baris(k,v){return v?'<div class="kv"><span>'+k+'</span><b>'+v+'</b></div>':''}
  function bagian(j,isi){return isi?'<section class="ttxs"><div class="cap">'+j+'</div>'+isi+'</section>':''}
  var lok=[d.gedung,d.lantai,d.ruangan].filter(Boolean).join(' / ')+(d.titik?' · '+(d.elemen?d.elemen+' ':'')+d.titik:'')+(d.detail?' · '+d.detail:'');
  var memo=M_&&M_.ringkasMemo?M_.ringkasMemo(d):'';
  var perbaikan=baris('Mulai perbaikan',d.mulai?esc(fmt(d.mulai)):'')+baris('Foto After',d.tglAfter?esc(fmt(d.tglAfter))+(d.diisiOleh?' oleh '+esc(d.diisiOleh):''):'')+
    baris('Verifikasi MK',d.verifikasi?esc(d.verifikasi)+' '+esc(fmt(d.tglVerif))+(d.verifOleh?' oleh '+esc(d.verifOleh):''):'')+baris('Catatan MK',d.catatan?esc(d.catatan):'');
  return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Temuan lengkap"><h2>Temuan '+esc(d.no||'')+'</h2>'+
    '<div class="meta"><span class="tag '+stCls(d.status)+'">'+esc(d.status)+'</span><span class="tag">'+esc(d.bidang)+'</span><span class="tag '+esc(String(d.tingkat).toLowerCase())+'">'+esc(d.tingkat)+'</span>'+(M_?M_.tag(d):'')+'</div>'+
    '<div class="note ur'+(((d.uraian||'').length>160||((d.uraian||'').match(/\n/g)||[]).length>3)?' pj':'')+'" style="padding:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;line-height:24px;color:var(--label1)">'+esc(d.uraian)+'</div>'+(((d.uraian||'').length>160||((d.uraian||'').match(/\n/g)||[]).length>3)?'<button type="button" class="lnk rmb" data-act="rmtoggle">Baca selengkapnya</button>':'')+
    bagian('Temuan',baris('Lokasi',esc(lok))+baris('Tanggal temuan',d.tglTemuan?esc(fmt(d.tglTemuan)):''))+
    bagian('Pelapor',baris('Dilaporkan oleh',d.by?esc(d.by)+(d.saya?' (Anda)':''):'(tidak tercatat)')+baris('Terakhir diubah',d.ubah?esc(fmt(d.ubah)):''))+
    bagian('Site memo',memo)+
    bagian('Perbaikan',perbaikan)+
    '<div class="phs"><div class="ph" data-j="before">'+phHtml(d,'before',true,'detail')+'</div><div class="ph" data-j="after">'+phHtml(d,'after',true,'detail')+'</div></div>'+
    (M_&&M_.kartuTombol(d)?'<div class="acts" style="padding:0">'+M_.kartuTombol(d)+'</div>':'')+
    '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
}
/* PJ: temuan bermemo yang sudah punya foto After tetapi tindak lanjut memonya belum diisi tidak bisa diterima MK. */
function perluTindak(d){return !!(d&&d.memoId&&d.fotoAfter.length&&d.verifikasi!=='Diterima'&&d.memoStatus==='TERBIT')}
function bisaMulai(){return !!(S.user&&(S.user.peran==='PJ'||S.user.peran==='ADMIN'))}
/* Satu aksi utama menurut peran dan tahap; sisanya di menu kartu (kmenuItems). */
function aksiUtama(d){
  var closed=d.status==='Close',af=d.fotoAfter.length>0,vd=d.verifikasi,id=esc(d.id);
  if(closed||vd==='Diterima')return '';
  if(isPJ()&&perluTindak(d))return '<button type="button" class="pill start" data-act="memotindakcepat" data-m="'+esc(d.memoId)+'">Isi tindak lanjut</button>';
  if(bisaMulai()){
    if(!d.mulai)return '<button type="button" class="pill start" data-act="mulai" data-d="'+id+'">Mulai perbaikan</button>';
    if(!af||vd==='Ditolak')return '<button type="button" class="pill start" data-act="unggah" data-d="'+id+'" data-j="after">'+(vd==='Ditolak'?'Perbaiki ulang':'Unggah foto After')+'</button>';
  }
  if(canEdit()&&af&&vd!=='Ditolak')return '<button type="button" class="pill go" data-act="verif" data-d="'+id+'">'+ic('verif')+'Verifikasi</button>';
  return '';
}
/* Isi menu kartu per peran: ADMIN (ubah, ubah keputusan, batalkan mulai, hapus), MK (ubah, ubah keputusan, hapus), PJ (batalkan mulai). */
function kmenuItems(d){
  var a=[],closed=d.status==='Close';
  if(bisaKelola(d))a.push({a:'edit',t:'Ubah temuan',ic:'ubah'});
  if(canEdit()&&d.verifikasi)a.push({a:'verif',t:'Ubah keputusan verifikasi',ic:'centang'});
  if(bisaMulai()&&!closed&&d.mulai&&!d.fotoAfter.length)a.push({a:'batalmulai',t:'Batalkan mulai perbaikan',ic:'urungkan'});
  if(bisaKelola(d))a.push({a:'hapus',t:'Hapus',bad:true,ic:'sampah'});
  return a;
}
function entryHtml(d,n,ix,ro){
  var fresh=!S.seen[d.id],land=S.baru===d.id;S.seen[d.id]=1;
  var h='<article class="group entry'+(land?' land':fresh?' pop':'')+(M_?M_.kelas(d):'')+'"'+(fresh&&!land?' style="animation-delay:'+Math.min(ix||0,8)*50+'ms"':'')+' data-id="'+esc(d.id)+'" data-ro="'+(ro?1:0)+'"><div class="eh tap" data-act="ttx" data-d="'+esc(d.id)+'" role="button" tabindex="0" aria-label="Lihat detail temuan"><span class="no">'+n+'</span><span class="tx" data-act="ttx" data-d="'+esc(d.id)+'">'+esc(d.uraian)+'</span></div>'+
    '<div class="meta"><span class="tag '+stCls(d.status)+'">'+esc(d.status)+'</span><span class="tag">'+esc(d.bidang)+'</span><span class="tag '+esc(String(d.tingkat).toLowerCase())+'">'+esc(d.tingkat)+'</span><span class="tag">Temuan '+esc(fmt(d.tglTemuan))+'</span>'+(d.elemen?'<span class="tag">'+esc(d.elemen)+'</span>':'')+(d.titik?'<span class="tag" style="color:var(--label1)"><b>'+esc(d.titik)+'</b></span>':'')+(d.detail?'<span class="tag">'+esc(d.detail)+'</span>':'')+(M_?M_.tag(d):'')+'</div>'+
    stepperHtml(d);
  if(d.mulai)h+='<div class="note">Perbaikan dimulai '+esc(fmt(d.mulai))+(d.diisiOleh?' oleh '+esc(d.diisiOleh):'')+'</div>';
  if(d.verifikasi)h+='<div class="note'+(d.verifikasi==='Ditolak'?' tolak':' ok')+'">'+(d.verifikasi==='Diterima'?'Diterima':'Ditolak')+' MK '+esc(fmt(d.tglVerif))+(d.verifOleh?' oleh '+esc(d.verifOleh):'')+(d.catatan?'. Catatan: '+esc(d.catatan):'')+'</div>';
  if(isPJ()&&d.verifikasi==='Ditolak')h+='<div class="note tolak">Unggah foto After yang baru supaya diverifikasi ulang oleh MK.</div>';
  h+='<div class="phs"><div class="ph" data-j="before">'+phHtml(d,'before',ro,'kartu')+'</div><div class="ph" data-j="after">'+phHtml(d,'after',ro,'kartu')+'</div></div>';
  h+='<div class="acts">'+aksiUtama(d)+(M_?M_.kartuTombol(d):'');
  if(kmenuItems(d).length)h+='<button type="button" class="pill menu" data-act="kmenu" data-d="'+esc(d.id)+'" aria-label="Menu temuan">&#8943;</button>';
  return h+'</div></article>';
}

/* ----- filter antrean (tab Verifikasi dan Perbaikan, masing-masing punya state sendiri) ----- */
function aqBaru(){return {q:'',gd:'',lt:'',bd:'',tk:'',tl:0,mm:0,sy:0,rg:'',st:'',ft:'',dr:'',sp:'',so:'',pn:0,n:60}}
var AQ={verif:aqBaru(),perbaikan:aqBaru(),form:aqBaru()};   // form = tab Temuan mode Semua area
var AQ_URUT=[['','Lokasi'],['baru','Terbaru'],['lama','Terlama'],['tingkat','Tingkat tertinggi'],['status','Open dulu'],['bidang','Bidang'],['uraian','Uraian A-Z']];
var AQ_FOTO=[['','Semua'],['bb','Belum ada After'],['ada','Sudah ada After']];
function aqOn(a){return !!(a.q.trim()||a.gd||a.lt||a.bd||a.tk||a.tl||a.mm||a.sy||a.rg||a.st||a.ft||a.dr||a.sp)}
function aqUrut(l,so){
  var rt={Kritis:0,Mayor:1,Minor:2},rs={'Open':0,'Dalam proses':1,'Close':2};
  var c={baru:function(a,b){return String(b.tglTemuan||'').localeCompare(String(a.tglTemuan||''))},
    lama:function(a,b){return String(a.tglTemuan||'').localeCompare(String(b.tglTemuan||''))},
    tingkat:function(a,b){return (rt[a.tingkat]===undefined?9:rt[a.tingkat])-(rt[b.tingkat]===undefined?9:rt[b.tingkat])},
    status:function(a,b){return (rs[a.status]===undefined?9:rs[a.status])-(rs[b.status]===undefined?9:rs[b.status])},
    bidang:function(a,b){return BIDANG.indexOf(a.bidang)-BIDANG.indexOf(b.bidang)},
    uraian:function(a,b){return L.bandingAlami(a.uraian||'',b.uraian||'')},
    lokasi:function(a,b){return L.bandingAlami(a.gedung,b.gedung)||L.bandingAlami(a.lantai,b.lantai)||L.bandingAlami(a.ruangan,b.ruangan)||((a.no||0)-(b.no||0))},
    tolak:function(a,b){return (a.verifikasi==='Ditolak'?0:1)-(b.verifikasi==='Ditolak'?0:1)}}[so];
  return c?l.slice().sort(c):l;   // sort stabil: urutan lokasi tetap jadi pembeda kedua
}
/** Ringkasan penyaring aktif (untuk kepala PDF). */
function aqRingkas(a){
  var p=[];
  if(a.q.trim())p.push('"'+a.q.trim()+'"');
  if(a.gd)p.push(a.gd);if(a.lt)p.push(a.lt);if(a.rg)p.push(a.rg);if(a.bd)p.push(a.bd);if(a.tk)p.push(a.tk);if(a.st)p.push(a.st);
  if(a.ft==='bb')p.push('Belum ada After');else if(a.ft==='ada')p.push('Sudah ada After');
  if(a.dr||a.sp)p.push((a.dr?fmt(a.dr):'...')+' s/d '+(a.sp?fmt(a.sp):'...'));
  if(a.mm)p.push('Bermemo');if(a.sy)p.push('Temuan saya');
  return p.join(', ')||'Tanpa penyaring';
}
function aqList(list,a){
  var q=a.q.trim().toLowerCase();
  var r=list.filter(function(d){return (!a.gd||d.gedung===a.gd)&&(!a.lt||d.lantai===a.lt)&&(!a.rg||d.ruangan===a.rg)&&(!a.bd||d.bidang===a.bd)&&(!a.tk||d.tingkat===a.tk)&&(!a.st||d.status===a.st)&&(!a.tl||d.verifikasi==='Ditolak')&&(!a.mm||!!d.memoId)&&(!a.sy||d.saya===true)&&
    (!a.ft||(a.ft==='bb'?!(d.fotoAfter||[]).length:(d.fotoAfter||[]).length>0))&&(!a.dr||String(d.tglTemuan||'')>=a.dr)&&(!a.sp||(d.tglTemuan&&String(d.tglTemuan)<=a.sp))&&
    (!q||String(d.uraian+' '+(d.titik||'')+' '+(d.elemen||'')+' '+(d.ruangan||'')+' '+(d.detail||'')).toLowerCase().indexOf(q)>=0)});
  return a.so?aqUrut(r,a.so):r;
}
function aqIsi(list,a,verif){
  var v=aqList(list,a),g='';
  if(!v.length&&!list.length&&!verif)return '<div class="empty"><b>Belum ada temuan.</b>'+(canEdit()?'<div class="acts" style="padding:12px 0 0;justify-content:center"><button type="button" class="pill go" data-act="tambah">'+ic('plus')+'Tambah temuan</button></div>':'')+'</div>';
  if(!v.length)return '<div class="empty">Tidak ada temuan yang cocok.<div class="acts" style="padding:10px 0 0"><button type="button" class="pill" data-act="aqclr">Atur ulang</button></div></div>';
  var lim=a.n||0;   // mode Semua area: tampil bertahap supaya daftar panjang tidak berat
  v.slice(0,lim||v.length).forEach(function(d,i){g+='<div class="ent"><div class="cap path">'+esc(d.gedung)+' / '+esc(d.lantai)+' / '+esc(d.ruangan)+'</div>'+(verif?entryHtml(d,d.no||i+1,i,true):entryHtml(d,d.no||i+1,i))+'</div>'});
  return '<div class="entgrid">'+g+'</div>'+(lim&&v.length>lim?'<div class="acts" style="padding:12px 0"><button type="button" class="btn sec" data-act="aqlebih">Tampilkan lebih banyak ('+(v.length-lim)+' lagi)</button></div>':'');
}
function aqBase(list){var tl=S.view==='perbaikan'?list.filter(function(d){return d.verifikasi==='Ditolak'}).length:0;return S.view==='verif'?list.length+' menunggu keputusan MK':S.view==='perbaikan'?list.length+' perlu dikerjakan'+(tl?' · '+tl+' ditolak MK':''):list.length+' temuan'}
function aqCount(list,a){return aqOn(a)?aqList(list,a).length+' dari '+list.length+' temuan':aqBase(list)}
function aqCap(list,a){return esc(S.paket.nama)+' &middot; <span id="aqcount" role="status">'+esc(aqCount(list,a))+'</span>'}
function aqBar(list,a,perb,semua){return aqBarSemua(list,a,semua?'form':perb?'perbaikan':'verif')}
/** Penyaring tab Temuan > Semua area: satu baris cari + PDF, satu baris tombol (Filter, Urutan, Bermemo, Temuan saya), panel filter bisa dilipat. */
function aqBarSemua(list,a,mode){
  mode=mode||'form';
  var gd=[],lt=[],rg=[];
  list.forEach(function(d){
    if(d.gedung&&gd.indexOf(d.gedung)<0)gd.push(d.gedung);
    if((!a.gd||d.gedung===a.gd)&&d.lantai&&lt.indexOf(d.lantai)<0)lt.push(d.lantai);
    if((!a.gd||d.gedung===a.gd)&&(!a.lt||d.lantai===a.lt)&&d.ruangan&&rg.indexOf(d.ruangan)<0)rg.push(d.ruangan);
  });
  gd.sort(L.bandingAlami);lt.sort(L.bandingAlami);rg.sort(L.bandingAlami);
  if(a.gd&&gd.indexOf(a.gd)<0)a.gd='';
  if(a.lt&&lt.indexOf(a.lt)<0)a.lt='';
  if(a.rg&&rg.indexOf(a.rg)<0)a.rg='';
  var pr=function(arr){return arr.map(function(x){return [x,x]})};
  var sel=function(k,lbl,pairs){return '<label class="aqf"><span>'+lbl+'</span><select data-aq="'+k+'"><option value="">Semua</option>'+pairs.map(function(x){return '<option value="'+esc(x[0])+'"'+(x[0]===a[k]?' selected':'')+'>'+esc(x[1])+'</option>'}).join('')+'</select></label>'};
  var tgl=function(k,lbl){return '<label class="aqf"><span>'+lbl+'</span><input type="date" data-aq="'+k+'" value="'+esc(a[k]||'')+'"></label>'};
  var cf=mode!=='verif',   // Verifikasi: semua temuan sudah punya After, jadi filter status dan foto After tidak berguna
    urut=mode==='form'?AQ_URUT:[['',mode==='perbaikan'?'Ditolak dulu':'Standar'],['lokasi','Lokasi']].concat(AQ_URUT.slice(1)),
    n=(a.gd?1:0)+(a.lt?1:0)+(a.rg?1:0)+(a.bd?1:0)+(a.tk?1:0)+(cf&&a.st?1:0)+(cf&&a.ft?1:0)+((a.dr||a.sp)?1:0);
  var panel=a.pn?'<div class="aqpanel" id="aqpanel">'+sel('gd','Gedung',pr(gd))+sel('lt','Lantai',pr(lt))+sel('rg','Ruangan',pr(rg))+sel('bd','Bidang',pr(BIDANG))+sel('tk','Tingkat',pr(TINGKAT))+
    (cf?sel('st','Status',[['Open','Open'],['Dalam proses','Proses'],['Close','Close']])+sel('ft','Foto After',AQ_FOTO.slice(1)):'')+tgl('dr','Temuan dari')+tgl('sp','Temuan sampai')+'</div>':'';
  AQ_MENU={mode:mode,urut:urut};
  var nm=mode==='form'?'Temuan':mode==='perbaikan'?'Perbaikan':'Verifikasi',nx=n+(a.mm?1:0)+(a.sy?1:0)+(a.tl?1:0);
  var ca=aqList(list,a).length;
  var chips='';
  if(cf){
    var b=aqList(list,{q:a.q,gd:a.gd,lt:a.lt,bd:a.bd,tk:a.tk,tl:a.tl,mm:a.mm,sy:a.sy,rg:a.rg,st:'',ft:a.ft,dr:a.dr,sp:a.sp,so:'',pn:0,n:0});
    var cs=function(s){return b.filter(function(d){return d.status===s}).length};
    chips=[['','Semua',b.length],['Open','Open',cs('Open')],['Dalam proses','Proses',cs('Dalam proses')],['Close','Close',cs('Close')]].map(function(o){return '<button type="button" class="chip'+(a.st===o[0]?' on':'')+'" data-act="aqst" data-v="'+esc(o[0])+'" aria-pressed="'+(a.st===o[0]?'true':'false')+'">'+o[1]+' '+o[2]+'</button>'}).join('');
  }
  if(aqOn(a))chips+='<button type="button" class="chip reset" data-act="aqclr">Atur ulang</button>';
  return '<div class="tbar" id="tbar"><div class="sbar tb"><span class="mt" id="aqmt">'+nm+' &middot; '+ca+'</span>'+
    '<label class="sinp'+(a.qo||a.q?' open':'')+'" data-act="aqcari">'+ic('search')+'<input type="text" id="aqq" placeholder="Cari temuan" autocomplete="off" value="'+esc(a.q)+'">'+
    '<button type="button" class="fbtn'+(a.pn||n?' on':'')+'" data-act="aqpn" aria-expanded="'+(a.pn?'true':'false')+'" aria-controls="aqpanel">Filter'+(n?' &middot; '+n+'':'')+'</button></label>'+
    '<button type="button" class="btn-sq ic" data-act="aqmenu" aria-label="Menu aksi">&#8943;'+(nx-n?'<i class="dot" aria-hidden="true"></i>':'')+'</button></div>'+
    (chips?'<div class="chips" role="group" aria-label="Status">'+chips+'</div>':'')+'</div>'+panel;
}
var AQ_MENU={};
function aqMenuRe(){if(S.modal&&S.modal.t==='aqmenu')renderOverlay()}
function aqMenuHtml(){
  var a=AQ[S.view];if(!a)return '';var mode=S.view==='form'?'form':S.view==='perbaikan'?'perbaikan':'verif',urut=AQ_MENU.urut||AQ_URUT;
  var tg=function(act,v,lbl){return '<button type="button" class="row act" data-act="'+act+'" data-v="'+(v?0:1)+'" aria-pressed="'+(v?'true':'false')+'"><span>'+lbl+'</span>'+(v?'<span class="ck">&#10003;</span>':'')+'</button>'};
  var us='<label class="row"><span class="lbl">Urutan</span><select data-aq="so" aria-label="Urutkan">'+urut.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===(a.so||'')?' selected':'')+'>'+esc(x[1])+'</option>'}).join('')+'</select></label>';
  return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Menu"><div class="group kmenu"><div class="list">'+us+
    tg('aqmm',a.mm,'Hanya yang bermemo')+(mode==='perbaikan'?tg('aqtl',a.tl,'Hanya yang ditolak MK'):'')+(canEdit()?tg('aqsy',a.sy,'Hanya temuan saya'):'')+
    (mode==='form'?'<button type="button" class="row act" data-act="pdfsemua">PDF sesuai penyaring dan urutan</button>':'')+
    '<button type="button" class="row act" data-act="'+(mode==='form'?'muatsemua':mode==='verif'?'muatsiap':'muatperlu')+'">Muat ulang</button></div></div>'+
    '<button type="button" class="btn" data-act="mtutup">Selesai</button></div></div>';
}
var _tmin=false;
function tbarMin(){
  var t=$('tbar');if(!t)return;
  var ph=document.querySelector('#app .pagehead'),b=ph?ph.getBoundingClientRect().bottom:0,m=_tmin?b<40:b<-4;
  if(m!==_tmin){_tmin=m}
  if(t.classList.contains('min')!==m)t.classList.toggle('min',m);
}
window.addEventListener('scroll',tbarMin,{passive:true});
function aqSegar(){
  var verif=S.view==='verif',list=verif?S.siap:S.view==='form'?semuaList():S.perlu;if(!list)return;
  var a=AQ[S.view],el=$('aqlist');if(el)el.innerHTML=aqIsi(list,a,verif);
  var ct=$('aqcount');if(ct)ct.textContent=aqCount(list,a);
  var mt=$('aqmt');if(mt)mt.innerHTML=(S.view==='form'?'Temuan':S.view==='perbaikan'?'Perbaikan':'Verifikasi')+' &middot; '+aqList(list,a).length;
}

/* ----- tab Temuan: Per ruangan (awal) atau Semua ruangan dengan filter Gedung, Lantai, Bidang, Tingkat, Bermemo ----- */
function tmodeHtml(){
  return '<div class="chips tmode" role="group" aria-label="Cakupan temuan"><button type="button" class="chip'+(S.semua?' on':'')+'" data-act="tmode" data-v="semua">Semua area</button><button type="button" class="chip'+(S.semua?'':' on')+'" data-act="tmode" data-v="ruang">Per ruangan</button></div>';
}
function semuaList(){
  if(!S.all)return null;
  return S.all.slice().sort(function(a,b){return L.bandingAlami(a.gedung,b.gedung)||L.bandingAlami(a.lantai,b.lantai)||L.bandingAlami(a.ruangan,b.ruangan)||((a.no||0)-(b.no||0))});
}
function semuaHtml(){
  if(!S.all&&!S.allBusy&&!S.allErr){S.allBusy=true;loadAll().then(function(){S.allBusy=false;if(S.view==='form'&&S.semua)render()}).catch(function(e){S.allBusy=false;S.allErr=(e&&e.message)||true;if(S.view==='form'&&S.semua)render()})}
  if(S.allErr)return '<div class="err">Gagal memuat semua temuan.'+(typeof S.allErr==='string'?' '+esc(S.allErr):'')+'</div><button type="button" class="btn sec" data-act="muatsemua">Coba lagi</button>';
  var list=semuaList();if(!list)return skel('entries');
  var a=AQ.form;
  return aqBar(list,a,false,true)+(M_?M_.legenda(list):'')+'<div id="aqlist">'+aqIsi(list,a,false)+'</div>';
}

/* ----- antrean verifikasi ----- */
function verifHtml(){
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Verifikasi</h1></div>';
  if(!S.siap&&S.siapErr)return h+'<div class="err">'+esc(S.siapErr)+'</div><button type="button" class="btn sec" data-act="muatsiap">Coba lagi</button>';
  if(!S.siap)return h+skel('entries');
  h=h.replace(/<div class="cap">[^<]*<\/div>/,'<div class="cap">'+aqCap(S.siap,AQ.verif)+'</div>');
  if(!S.siap.length)return h+'<div class="empty">Tidak ada temuan yang menunggu verifikasi.</div>';
  return h+aqBar(S.siap,AQ.verif,false)+'<div id="aqlist">'+aqIsi(S.siap,AQ.verif,true)+'</div>';
}

/* ----- antrean perbaikan (PJ) ----- */
function perbaikanHtml(){
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Perbaikan</h1></div>';
  if(!S.perlu&&S.perluErr)return h+'<div class="err">'+esc(S.perluErr)+'</div><button type="button" class="btn sec" data-act="muatperlu">Coba lagi</button>';
  if(!S.perlu)return h+skel('entries');
  var tl=S.perlu.filter(function(d){return d.verifikasi==='Ditolak'}).length;
  h=h.replace(/<div class="cap">[^<]*<\/div>/,'<div class="cap">'+aqCap(S.perlu,AQ.perbaikan)+'</div>');
  if(!S.perlu.length)return h+'<div class="empty">Semua temuan sudah dikerjakan. Tidak ada yang perlu di-close.</div>';
  return h+aqBar(S.perlu,AQ.perbaikan,true)+'<div id="aqlist">'+aqIsi(S.perlu,AQ.perbaikan,false)+'</div>';
}

/* ----- rekap ----- */
/* Kartu Rekap yang bisa diketuk menyaring "Daftar temuan" di bawahnya (bidang, status, gedung, dan kelompok Perlu perhatian). Ketuk lagi untuk mencabut. */
function rfHal(){try{var v=parseInt(lsGet('dl-rfn'),10);return [0,10,20,50,100].indexOf(v)>=0?v:20}catch(e){return 20}}
var RF={bd:'',st:'',ak:'',n:rfHal(),buka:{}};
var RF_AK={kritis:'Kritis masih Open',tolak:'Ditolak MK, belum ada After baru',lama:'Proses lebih dari 7 hari'};
function rfOk(d,fg){
  if(!fg(d.gedung))return false;
  if(RF.bd&&d.bidang!==RF.bd)return false;
  if(RF.st&&d.status!==RF.st)return false;
  if(RF.ak==='kritis')return d.tingkat==='Kritis'&&d.status==='Open';
  if(RF.ak==='tolak')return d.verifikasi==='Ditolak'&&d.status!=='Close'&&!!d.perlu;
  if(RF.ak==='lama'){var t=Date.parse(d.mulai);return d.status==='Dalam proses'&&!!t&&Date.now()-t>7*864e5}
  return true;
}
function rfAktif(){return !!(RF.bd||RF.st||RF.ak||S.rkG)}
function rfDaftar(all,fg){
  var chips=[];
  if(S.rkG)chips.push(['rfg',S.rkG,'Gedung '+S.rkG]);
  if(RF.bd)chips.push(['rfset','bd|'+RF.bd,'Bidang '+(KODE_BID[RF.bd]||RF.bd)]);
  if(RF.st)chips.push(['rfset','st|'+RF.st,'Status '+(RF.st==='Dalam proses'?'Proses':RF.st)]);
  if(RF.ak)chips.push(['rfset','ak|'+RF.ak,RF_AK[RF.ak]]);
  var v=all.filter(function(d){return rfOk(d,fg)}).sort(function(a,b){return L.bandingAlami(a.gedung,b.gedung)||L.bandingAlami(a.lantai,b.lantai)||L.bandingAlami(a.ruangan,b.ruangan)||((a.no||0)-(b.no||0))});
  var tampil=RF.n?v.slice(0,RF.n):v;
  var h='<div class="cap" style="margin:0 0 8px">Daftar temuan ('+(rfAktif()?'menampilkan '+tampil.length+' dari '+v.length+', total '+all.length:'menampilkan '+tampil.length+' dari '+v.length)+')</div>';
  h+=chips.length?'<div class="chips rkaktif" role="group" aria-label="Filter aktif">'+chips.map(function(c){return '<button type="button" class="chip on" data-act="'+c[0]+'" data-v="'+esc(c[1])+'" aria-label="Cabut filter '+esc(c[2])+'">'+esc(c[2])+' &times;</button>'}).join('')+'<button type="button" class="chip" data-act="rfclr">Hapus semua</button></div>':'<div class="rknote" style="padding:0 0 8px">Ketuk kartu di atas untuk menyaring daftar.</div>';
  h+='<div class="chips rkhal" role="group" aria-label="Jumlah baris"><span class="rkhl">Tampilkan</span>'+[10,20,50,100,0].map(function(n){return '<button type="button" class="chip'+(RF.n===n?' on':'')+'" data-act="rfn" data-v="'+n+'" aria-pressed="'+(RF.n===n)+'">'+(n||'Semua')+'</button>'}).join('')+'</div>';
  if(!v.length)return h+'<div class="empty">Tidak ada temuan yang cocok.</div>';
  var g='';tampil.forEach(function(d,i){
    var buka=!!RF.buka[d.id];
    g+='<div class="rfr'+(buka?' open':'')+'"><button type="button" class="rfrh" data-act="rfbuka" data-d="'+esc(d.id)+'" aria-expanded="'+buka+'"><span class="rfno">'+(d.no||i+1)+'</span><span class="rfut"><b>'+esc(d.uraian)+'</b><span class="note">'+esc(d.gedung)+' &middot; '+esc(d.lantai)+' &middot; '+esc(d.ruangan)+'</span></span><span class="rftg"><span class="tag '+stCls(d.status)+'">'+esc(d.status==='Dalam proses'?'Proses':d.status)+'</span><span class="tag">'+esc(KODE_BID[d.bidang]||d.bidang)+'</span><span class="tag '+esc(String(d.tingkat).toLowerCase())+'">'+esc(d.tingkat)+'</span></span>'+CHEV+'</button>'+
      (buka?'<div class="rfdet">'+entryHtml(d,d.no||i+1,i)+'</div>':'')+'</div>'});
  return h+'<div class="rflist" id="rflist">'+g+'</div>';
}
function rekapHtml(){
  var T=tree();
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Rekap</h1></div>';
  if(!S.roomsReady&&!S.rooms.length)return h+skel('table');
  if(!T.length)return h+'<div class="empty">Belum ada ruangan.</div>';
  var tot={total:0,open:0,proses:0,close:0};
  T.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){['total','open','proses','close'].forEach(function(k){tot[k]+=r[k]||0})})})});
  var kp=function(cls,n,t,st){return '<div class="kpi '+cls+' lnk'+(RF.st===st?' on':'')+'" role="button" tabindex="0" data-act="rfset" data-v="st|'+st+'"><b>'+n+'</b><span>'+t+'</span></div>'};
  h+='<div class="kpis">'+kp('o',tot.open,'Open','Open')+kp('p',tot.proses,'Proses','Dalam proses')+kp('c',tot.close,'Close','Close')+'</div>';
  tot={total:0,open:0,proses:0,close:0};
  h+='<section class="group"><div class="tw"><table class="t"><thead><tr><th>'+esc(LBL_GAB.lokasi)+'</th><th>Total</th><th>Open</th><th>Proses</th><th>Close</th><th>%</th></tr></thead><tbody>';
  T.forEach(function(g){
    var gc={total:0,open:0,proses:0,close:0};
    g.lantai.forEach(function(l){l.ruangan.forEach(function(r){['total','open','proses','close'].forEach(function(k){gc[k]+=r[k]||0;tot[k]+=r[k]||0})})});
    h+='<tr class="g"><td>'+esc(g.nama)+'</td><td>'+gc.total+'</td><td>'+gc.open+'</td><td>'+gc.proses+'</td><td>'+gc.close+'</td><td>'+pct(gc)+'</td></tr>';
    g.lantai.forEach(function(l){
      h+='<tr class="l"><td colspan="6">'+esc(l.nama)+'</td></tr>';
      var nr=false;
      l.ruangan.forEach(function(r){if(r.bidang&&!nr){nr=true;h+='<tr class="l"><td colspan="6">Non-ruangan</td></tr>'}h+='<tr><td>'+esc(r.nama)+'</td><td>'+r.total+'</td><td>'+r.open+'</td><td>'+r.proses+'</td><td>'+r.close+'</td><td>'+pct(r)+'</td></tr>'});
    });
  });
  h+='<tr class="tot"><td>Total</td><td>'+tot.total+'</td><td>'+tot.open+'</td><td>'+tot.proses+'</td><td>'+tot.close+'</td><td>'+pct(tot)+'</td></tr></tbody></table></div></section>';
  h+='<section class="group"><div class="sh">Per bidang</div>';
  if(!S.all)h+='<div class="acts" style="padding-top:0;padding-bottom:16px"><button type="button" class="pill" data-act="rekapall">Muat rekap per bidang</button></div>';
  else{
    h+='<div class="tw"><table class="t"><thead><tr><th>Bidang</th><th>Total</th><th>Open</th><th>Proses</th><th>Close</th><th>%</th></tr></thead><tbody>';
    BIDANG.forEach(function(b){var c=cnt(S.all.filter(function(d){return d.bidang===b}));h+='<tr class="lnkrow'+(RF.bd===b?' on':'')+'" role="button" tabindex="0" data-act="rfset" data-v="bd|'+esc(b)+'"><td>'+esc(b)+'</td><td>'+c.total+'</td><td>'+c.open+'</td><td>'+c.proses+'</td><td>'+c.close+'</td><td>'+pct(c)+'</td></tr>'});
    h+='</tbody></table></div>';
  }
  h+='</section>';
  if(S.all)h+='<section class="group pad" id="rfsec">'+rfDaftar(S.all,function(){return true})+'</section>';
  h+='<div class="btnrow"><button type="button" class="btn" data-act="xlsx">'+ic('excel')+'Unduh Excel</button><button type="button" class="btn out" data-act="pdfbidang">'+ic('pdf')+'Cetak PDF</button></div>';
  return h;
}

/* ----- Rekap bento (hanya desktop/tablet lebar, >= 1100 px; mobile memakai rekapHtml) ----- */
var MQ_DESK=window.matchMedia('(min-width:1100px)');
function desk(){return MQ_DESK.matches}
if(MQ_DESK.addEventListener)MQ_DESK.addEventListener('change',function(){if(S.paket&&S.user&&S.view==='rekap')render()});
function rkBar(p,w){return '<div class="rkbar"><i style="width:'+Math.max(0,Math.min(100,p))+'%;background:var(--'+(w||'blue')+')"></i></div>'}
function rkTgl(v){return String(v||'').slice(0,10)}
function rkTren(all){
  var hari=[],i,d=new Date();
  for(i=13;i>=0;i--){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()-i);hari.push(x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2))}
  var baru=hari.map(function(t){return all.filter(function(r){return rkTgl(r.tglTemuan)===t}).length});
  var tutup=hari.map(function(t){return all.filter(function(r){return r.status==='Close'&&rkTgl(r.tglVerif)===t}).length});
  var cb=0,ct=0,sb=[],st=[];baru.forEach(function(n,k){cb+=n;ct+=tutup[k];sb.push(cb);st.push(ct)});
  var mx=Math.max(1,cb,ct),W=360,H=120,P=6;
  var pts=function(a){return a.map(function(v,k){return (P+k*(W-2*P)/13).toFixed(1)+','+(H-P-v/mx*(H-2*P)).toFixed(1)}).join(' ')};
  var wk=function(a){return a.slice(7).reduce(function(p,n){return p+n},0)};
  return '<svg class="rkline" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Tren 14 hari"><polyline fill="none" stroke="var(--prominent)" stroke-width="2.5" stroke-linejoin="round" points="'+pts(sb)+'"/><polyline fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round" points="'+pts(st)+'"/></svg>'+
    '<div class="rknote">Minggu ini: '+wk(baru)+' temuan baru, '+wk(tutup)+' ditutup</div>';
}
function rekapBentoHtml(){
  var T=tree(),h;
  if(!S.roomsReady&&!S.rooms.length)return skel('bento');
  if(!T.length)return '<div class="pagehead"><h1>Rekap</h1></div><div class="empty">Belum ada ruangan.</div>';
  if(S.rkG&&!T.some(function(g){return g.nama===S.rkG}))S.rkG='';
  if(!S.all&&!S.allBusy&&!S.allErr){S.allBusy=true;loadAll().then(function(){S.allBusy=false;if(S.view==='rekap')render()}).catch(function(){S.allBusy=false;S.allErr=true;if(S.view==='rekap')render()})}
  var fg=function(x){return !S.rkG||x===S.rkG};
  var rooms=[];T.forEach(function(g){if(!fg(g.nama))return;g.lantai.forEach(function(l){l.ruangan.forEach(function(r){rooms.push({g:g.nama,l:l.nama,r:r})})})});
  var tot={total:0,open:0,proses:0,close:0};rooms.forEach(function(o){['total','open','proses','close'].forEach(function(k){tot[k]+=o.r[k]||0})});
  var all=(S.all||[]).filter(function(d){return fg(d.gedung)}),siap=(S.siap||[]).filter(function(d){return fg(d.gedung)});
  var p=function(n){return tot.total?n/tot.total*100:0},pc=Math.round(p(tot.close));
  var muat='<div class="rknote">'+(S.allErr?'Gagal memuat.':'Memuat...')+'</div>';
  h='<div class="bhead"><div><h1>Rekap</h1><div class="bsub">'+esc(S.rkG||'Semua gedung')+' &middot; '+esc(S.paket.nama)+'</div></div><div class="bact"><button type="button" class="btn sec sm" data-act="xlsx">'+ic('excel')+'Unduh Excel</button><button type="button" class="btn sm" data-act="pdfbidang">'+ic('pdf')+'Cetak</button></div></div><div class="bgrid">';
  h+='<section class="bc s6"><div class="cap">Progres keseluruhan</div><div class="bigp"><b>'+pc+'%</b><span><strong>selesai (Close)</strong>'+tot.close+' dari '+tot.total+' temuan'+(S.rkG?'':' di '+T.length+' gedung')+'</span></div>'+
    '<div class="stk"><i style="width:'+p(tot.close)+'%;background:var(--green)"></i><i style="width:'+p(tot.proses)+'%;background:var(--orange)"></i><i style="width:'+p(tot.open)+'%;background:var(--red)"></i></div>'+
    '<div class="tiles">'+[['o',tot.open,'Open','Open'],['p',tot.proses,'Proses','Dalam proses'],['c',tot.close,'Close','Close']].map(function(k){return '<button type="button" class="tl '+k[0]+' lnk'+(RF.st===k[3]?' on':'')+'" data-act="rfset" data-v="st|'+k[3]+'"><b>'+k[1]+'</b><span>'+k[2]+'</span></button>'}).join('')+'</div></section>';
  h+='<section class="bc s3"><div class="cap">Per bidang</div>';
  if(!S.all)h+=muat;
  else{var bc=BIDANG.map(function(b){return {b:b,n:all.filter(function(d){return d.bidang===b}).length}}),mx=Math.max(1,Math.max.apply(null,bc.map(function(x){return x.n})));
    h+=bc.map(function(x){return '<button type="button" class="rkrow lnkrow'+(RF.bd===x.b?' on':'')+'" data-act="rfset" data-v="bd|'+esc(x.b)+'"><b>'+esc(KODE_BID[x.b]||x.b)+'</b>'+rkBar(x.n/mx*100)+'<span>'+x.n+'</span></button>'}).join('')+'<div class="rknote">Ketuk untuk menyaring daftar</div>'}
  h+='</section>';
  h+='<section class="bc s3 hi"><div class="cap">Menunggu verifikasi</div><b class="huge">'+siap.length+'</b><p>temuan sudah ada foto After, belum diputuskan MK</p><button type="button" class="pill" data-act="tab" data-v="verif">Buka Verifikasi &rsaquo;</button></section>';
  h+='<section class="bc s4"><div class="cap">Per gedung (selesai)</div>';
  T.forEach(function(g){var c={total:0,close:0};g.lantai.forEach(function(l){l.ruangan.forEach(function(r){c.total+=r.total||0;c.close+=r.close||0})});var q=c.total?Math.round(c.close/c.total*100):0;
    h+='<button type="button" class="rkg lnkrow'+(S.rkG===g.nama?' on':'')+'" data-act="rfg" data-v="'+esc(g.nama)+'"><div><b>'+esc(g.nama)+'</b><span>'+q+'% &middot; '+c.total+' temuan</span></div>'+rkBar(q,'green')+'</button>'});
  h+='<div class="rknote">Ketuk gedung untuk menyaring</div></section>';
  h+='<section class="bc s4"><div class="cap">Tren 14 hari <span class="lg"><i style="background:var(--prominent)"></i>Baru <i style="background:var(--green)"></i>Close</span></div>'+(S.all?rkTren(all):muat)+'</section>';
  var nowT=Date.now(),kritis=all.filter(function(d){return d.tingkat==='Kritis'&&d.status==='Open'}).length,tolak=all.filter(function(d){return d.verifikasi==='Ditolak'&&d.status!=='Close'&&d.perlu}).length,lama=all.filter(function(d){var t=Date.parse(d.mulai);return d.status==='Dalam proses'&&t&&nowT-t>7*864e5}).length;
  var pr=function(n,t,cls,v){return n?'<button type="button" class="att '+cls+(RF.ak===v?' on':'')+'" data-act="rfset" data-v="ak|'+v+'"><span>'+n+' '+t+'</span><svg class="chev" viewBox="0 0 12 18"><path d="M3 3l6 6-6 6"/></svg></button>':''};
  var at=S.all?pr(kritis,'temuan Kritis masih Open','r','kritis')+pr(tolak,'ditolak MK, belum ada After baru','o','tolak')+pr(lama,'temuan Proses lebih dari 7 hari','n','lama'):'';
  h+='<section class="bc s4"><div class="cap">Perlu perhatian</div>'+(S.all?(at||'<div class="rknote">Tidak ada yang perlu perhatian.</div>'):muat)+'</section>';
  var urut=rooms.filter(function(o){return o.r.total}).sort(function(a,b){return ((b.r.open||0)+(b.r.proses||0))-((a.r.open||0)+(a.r.proses||0))||(b.r.total-a.r.total)}),tampil=S.rkAll?urut:urut.slice(0,8);
  h+='<section class="bc s8"><div class="bch"><div class="cap">Per lokasi</div>'+(urut.length>8?'<button type="button" class="lnk" data-act="rkall">'+(S.rkAll?'Ringkas':'Lihat semua '+urut.length+' lokasi')+' &rsaquo;</button>':'')+'</div>'+
    '<table class="t rkt"><thead><tr><th>Lokasi</th><th>Total</th><th>Open</th><th>Proses</th><th>Close</th><th>%</th></tr></thead><tbody>'+
    (tampil.map(function(o){return '<tr><td>'+esc(o.g+' › '+o.l+' › '+o.r.nama)+'</td><td>'+o.r.total+'</td><td class="o">'+o.r.open+'</td><td class="p">'+o.r.proses+'</td><td class="c">'+o.r.close+'</td><td class="b">'+pct(o.r)+'</td></tr>'}).join('')||'<tr><td colspan="6">Belum ada temuan.</td></tr>')+'</tbody></table></section>';
  h+='<section class="bc s4"><div class="cap">Cetak dan unduh</div><button type="button" class="dl" data-act="xlsx"><b>Rekap Excel (datar)</b><span>.xlsx</span></button><button type="button" class="dl" data-act="pdfbidang"><b>PDF per gedung dan bidang</b><span>.pdf / .zip</span></button></section>';
  h+='<section class="bc s12" id="rfsec">'+(S.all?rfDaftar(all,fg):muat)+'</section>';
  return h+'</div>';
}

/* ----- kelola ----- */
/* Kelola dibagi dalam lima tab: Ruangan (daftar, perlu dirapikan, tambah, nonaktif), Gedung dan lantai, Impor Excel, Isian, dan Lainnya (PDF massal, temuan terhapus). */
var KL_TAB=[['ruang','Ruangan','gedung'],['gl','Gedung','lapis'],['imp','Impor','impor'],['isian','Isian','daftar'],['lain','Arsip','arsip']];   // Gedung = gedung dan lantai; Arsip = PDF massal dan temuan terhapus
var CHEV='<svg class="chev" viewBox="0 0 12 18" aria-hidden="true"><path d="M3 3l6 6-6 6"/></svg>';
function klKunciMirip(n){return String(n).toLowerCase().replace(/\b(ruangan|ruang|rg)\b\.?/g,'').replace(/[^a-z0-9]/g,'').replace(/0+(\d)/g,'$1')}
/** Ruangan yang perlu dirapikan: nama berisi posisi atau huruf tidak rapi, gedung atau lantai di luar daftar resmi, dan nama yang mirip ruangan lain di lantai yang sama. */
function klIsu(){
  var out=[],grp={};
  S.rooms.forEach(function(r){
    if(!r||!r.id||!L.rapi(r.gedung)||!L.rapi(r.lantai))return;
    var al=[],jenis='',saran='';
    if(!r.bidang){
      var nr=L.namaRuangan(r.nama);
      if(!nr.ok){al.push(nr.err);jenis='nama'}
      else if(nr.val!==L.rapi(r.nama)){al.push('Huruf belum rapi: '+nr.val);jenis='huruf';saran=nr.val}
    }
    if(masterAktif()){
      if(!masterGedung(r.gedung))al.push('Gedung tidak ada di daftar resmi');
      else if(masterLantaiDaftar(r.gedung).length&&!masterLantai(r.gedung,r.lantai))al.push('Lantai tidak ada di daftar resmi');
    }
    if(!r.bidang){var kk=klKunciMirip(r.nama);if(kk){var k=L.kunci(r.gedung)+'|'+L.kunciLantai(r.lantai)+'|'+kk;(grp[k]=grp[k]||[]).push(r)}}
    if(al.length)out.push({r:r,alasan:al,jenis:jenis,saran:saran});
  });
  Object.keys(grp).forEach(function(k){
    var a=grp[k];if(a.length<2)return;
    a.sort(function(x,y){return (y.total||0)-(x.total||0)});
    a.slice(1).forEach(function(r){
      var e=out.filter(function(o){return o.r.id===r.id})[0],al='Mirip dengan "'+a[0].nama+'"';
      if(e){e.alasan.push(al);e.mirip=a[0]}else out.push({r:r,alasan:[al],jenis:'mirip',saran:a[0].nama,mirip:a[0]});
    });
  });
  return out;
}
function klIsuHtml(){
  var is=klIsu();
  if(!is.length)return '<section class="group kliss ok"><div class="klish static"><svg class="ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>Semua nama ruangan sudah rapi</span></div></section>';
  var buka=S.klIsuOpen!==false,tampil=S.klIsuAll?is:is.slice(0,10);
  var h='<section class="group kliss"><button type="button" class="klish" data-act="klisu" aria-expanded="'+buka+'"><span>Perlu dirapikan</span><b class="klbadge">'+is.length+'</b>'+CHEV+'</button>';
  if(buka){
    h+='<div class="list">'+tampil.map(function(o){
      var r=o.r,bt='<button type="button" class="pill" data-act="ubahroom" data-r="'+esc(r.id)+'">Ubah</button>';
      if(o.mirip)bt='<button type="button" class="pill go" data-act="klmirip" data-r="'+esc(r.id)+'" data-n="'+esc(o.mirip.nama)+'">Gabung</button>'+bt;
      else if(o.jenis==='huruf')bt='<button type="button" class="pill go" data-act="klrapi" data-r="'+esc(r.id)+'" data-n="'+esc(o.saran)+'">Rapikan</button>'+bt;
      return '<div class="klr"><div class="klrn"><b>'+esc(r.nama)+'</b><span class="note">'+esc(r.gedung)+' &middot; '+esc(r.lantai)+' &middot; '+(r.total||0)+' temuan</span><span class="klwhy">'+o.alasan.map(esc).join('. ')+'</span></div><div class="kla">'+bt+'</div></div>';
    }).join('')+'</div>';
    if(is.length>10)h+='<div class="acts" style="padding:4px 16px 12px"><button type="button" class="lnk" data-act="klisuall">'+(S.klIsuAll?'Ringkas':'Tampilkan semua '+is.length)+' &rsaquo;</button></div>';
  }
  return h+'</section>';
}
function klRowHtml(r){
  return '<div class="klr"><div class="klrn"><b>'+esc(r.nama)+'</b></div><span class="klc">'+(r.total||0)+' temuan</span><div class="kla"><button type="button" class="pill" data-act="ubahroom" data-r="'+esc(r.id)+'">Ubah</button><button type="button" class="pill bad" data-act="delroom" data-r="'+esc(r.id)+'">Nonaktifkan</button></div></div>';
}
function klListHtml(){
  var T=tree(),q=String(S.klq||'').trim().toLowerCase(),h='';
  T.forEach(function(g){
    var ls=[],n=0,tm=0;
    g.lantai.forEach(function(l){
      var rs=l.ruangan.filter(function(r){return !q||(g.nama+' '+l.nama+' '+r.nama).toLowerCase().indexOf(q)>=0});
      if(rs.length){ls.push({l:l,rs:rs});n+=rs.length;rs.forEach(function(r){tm+=r.total||0})}
    });
    if(!n)return;
    var buka=!!q||S.klOpen[g.nama]===true||(T.length===1&&S.klOpen[g.nama]!==false);
    h+='<section class="group klg"><button type="button" class="klgh" data-act="klg" data-g="'+esc(g.nama)+'" aria-expanded="'+buka+'"><span class="klgn">'+esc(g.nama)+'</span><span class="klgc">'+n+' ruangan &middot; '+tm+' temuan</span>'+CHEV+'</button>';
    if(buka)ls.forEach(function(o){h+='<div class="kll"><span>'+esc(o.l.nama)+'</span><span>'+o.rs.length+'</span></div>'+o.rs.map(klRowHtml).join('')});
    h+='</section>';
  });
  return h||'<div class="empty">'+(q?'Tidak ada ruangan yang cocok.':'Belum ada ruangan.')+'</div>';
}
function klNonHtml(){
  var h='<section class="group kliss"><div class="klish static"><span>Ruangan nonaktif</span>'+(S.klNonList?'<b class="klbadge">'+S.klNonList.length+'</b>':'')+'</div>';
  if(!S.klNonList)return h+'<div class="note" style="padding:0 16px 14px">Memuat...</div></section>';
  if(!S.klNonList.length)return h+'<div class="note" style="padding:0 16px 14px">Tidak ada ruangan nonaktif.</div></section>';
  return h+'<div class="list">'+S.klNonList.map(function(r){return '<div class="klr"><div class="klrn"><b>'+esc(r.nama)+'</b><span class="note">'+esc(r.gedung)+' &middot; '+esc(r.lantai)+' &middot; '+(r.total||0)+' temuan</span></div><div class="kla"><button type="button" class="pill go" data-act="klakt" data-r="'+esc(r.id)+'">Aktifkan</button></div></div>'}).join('')+'</div></section>';
}
function klTambahHtml(){
  var T=tree();
  return '<section class="group"><div class="sh">Tambah ruangan</div><div class="list kform">'+
    '<label class="row"><span class="lbl">Gedung</span><input type="text" id="klG" list="dlG" placeholder="Contoh: Gedung A" value="'+esc(S.kl.g)+'"></label>'+
    '<label class="row"><span class="lbl">Lantai</span><input type="text" id="klL" placeholder="Contoh: Lantai 1" value="'+esc(S.kl.l||'')+'"></label>'+
    '<label class="row"><span class="lbl">Ruangan (satu per baris)</span><textarea id="klN" placeholder="Ruang Rapat&#10;Lobi&#10;Toilet Pria">'+esc(S.kl.n)+'</textarea></label></div>'+
    '<datalist id="dlG">'+T.map(function(g){return '<option value="'+esc(g.nama)+'">'}).join('')+'</datalist>'+
    '<div class="acts" style="padding-top:0;padding-bottom:14px"><button type="button" class="btn" data-act="addroom">Tambah</button></div></section>';
}
function klRuangHtml(){
  var T=tree(),nr=0;T.forEach(function(g){g.lantai.forEach(function(l){nr+=l.ruangan.length})});
  var h='<div class="klside"><div class="klbar"><label class="sinp">'+ic('search')+'<input type="text" id="klq" placeholder="Cari ruangan, lantai, atau gedung" autocomplete="off" value="'+esc(S.klq||'')+'"></label></div>'+
    '<div class="klact"><button type="button" class="btn klplus'+(S.klTambah?' sec':'')+'" data-act="kltambah" aria-pressed="'+!!S.klTambah+'">'+ic(S.klTambah?'x':'plus')+(S.klTambah?'Tutup':'Tambah')+'</button>'+
    '<button type="button" class="btn sec klsek'+(S.klNon?' on':'')+'" data-act="klnon" aria-pressed="'+!!S.klNon+'">'+ic('arsip')+'Nonaktif'+(S.klNonList?' '+S.klNonList.length:'')+'</button>'+
    '<button type="button" class="btn sec klsek" data-act="klxls">'+ic('excel')+'Excel</button></div>';
  if(S.klTambah)h+=klTambahHtml();
  h+=klIsuHtml();
  if(S.klNon)h+=klNonHtml();
  return h+'</div><div class="klmain"><div class="aqcnt klcnt"><span>'+T.length+' gedung &middot; '+nr+' ruangan</span><span class="klln"><button type="button" class="aqreset" data-act="klsemua" data-v="1">Buka semua</button><button type="button" class="aqreset" data-act="klsemua" data-v="0">Tutup semua</button></span></div><div id="kllist">'+klListHtml()+'</div></div>';
}
function klGlHtml(){
  var ms=S.klMs;
  if(!ms)return '<div class="rknote" style="padding:12px 4px">Memuat...</div>';
  var cg={},cl={};
  S.rooms.forEach(function(r){var kg=L.kunci(r.gedung);cg[kg]=(cg[kg]||0)+1;var k=kg+'|'+L.kunciLantai(r.lantai);cl[k]=(cl[k]||0)+1});
  var bt=function(act,attr,t,cls,label){return '<button type="button" class="pill'+(cls?' '+cls:'')+'" data-act="'+act+'" '+attr+(label?' aria-label="'+esc(label)+'"':'')+'>'+t+'</button>'};
  var h='';
  ms.forEach(function(g,gi){
    var ga='data-g="'+esc(g.nama)+'"',ng=cg[L.kunci(g.nama)]||0;
    h+='<section class="group klgl'+(g.aktif?'':' off')+'"><div class="klglh"><div class="klrn"><b>'+esc(g.nama)+'</b><span class="note">'+(g.aktif?'':'Nonaktif &middot; ')+ng+' ruangan</span></div><div class="kla">'+
      bt('glgeser',ga+' data-k="g" data-d="-1"','&uarr;','ic','Naikkan '+g.nama)+bt('glgeser',ga+' data-k="g" data-d="1"','&darr;','ic','Turunkan '+g.nama)+
      bt('glubah',ga+' data-k="g" data-n="'+esc(g.nama)+'"','Ubah nama')+bt('glaktif',ga+' data-k="g" data-v="'+(g.aktif?0:1)+'" data-c="'+ng+'"',g.aktif?'Nonaktifkan':'Aktifkan',g.aktif?'bad':'go')+'</div></div>';
    if(!g.lantai.length)h+='<div class="note" style="padding:0 16px 10px">Lantai bebas (objek atau zona). Tambahkan lantai di bawah untuk membatasi pilihan.</div>';
    g.lantai.forEach(function(l){
      var la=ga+' data-l="'+esc(l.nama)+'"',nl=cl[L.kunci(g.nama)+'|'+L.kunciLantai(l.nama)]||0;
      h+='<div class="klr kll2'+(l.aktif?'':' off')+'"><div class="klrn"><b>'+esc(l.nama)+'</b><span class="note">'+(l.aktif?'':'Nonaktif &middot; ')+nl+' ruangan</span></div><div class="kla">'+
        bt('glgeser',la+' data-k="l" data-d="-1"','&uarr;','ic','Naikkan '+l.nama)+bt('glgeser',la+' data-k="l" data-d="1"','&darr;','ic','Turunkan '+l.nama)+
        bt('glubah',la+' data-k="l" data-n="'+esc(l.nama)+'"','Ubah nama')+bt('glaktif',la+' data-k="l" data-v="'+(l.aktif?0:1)+'" data-c="'+nl+'"',l.aktif?'Nonaktifkan':'Aktifkan',l.aktif?'bad':'go')+'</div></div>';
    });
    h+='<div class="klnew"><input type="text" id="klLN'+gi+'" maxlength="40" placeholder="Lantai baru, contoh: Lantai 6" aria-label="Lantai baru untuk '+esc(g.nama)+'">'+bt('kllbaru',ga+' data-i="'+gi+'"','Tambah lantai')+'</div></section>';
  });
  h+='<section class="group"><div class="klnew"><input type="text" id="klGN" maxlength="40" placeholder="Gedung baru, contoh: Gedung Sayap Baru" aria-label="Gedung baru"><button type="button" class="pill" data-act="addgedung">Tambah gedung</button></div></section>';
  return h;
}
function klLainHtml(){
  var T=tree(),h='';
  if(T.length){
    h+='<section class="group"><div class="sh">Unduh PDF massal</div><div class="list">'+T.map(function(g){return '<label class="row zrow"><input type="checkbox" data-act="zipg" data-g="'+esc(g.nama)+'"'+(S.zipOff[g.nama]?'':' checked')+'><span>'+esc(g.nama)+'</span></label>'}).join('')+'</div>'+
      '<div class="acts" style="padding-top:12px;padding-bottom:14px"><button type="button" class="pill" data-act="zipgo">'+ic('pdf')+'Unduh ZIP</button></div></section>';
  }
  h+='<section class="group"><div class="sh">Temuan terhapus</div>';
  if(!S.terhapus)h+='<div class="acts" style="padding-top:0;padding-bottom:16px"><button type="button" class="pill" data-act="lihatsampah">Tampilkan</button></div>';
  else if(!S.terhapus.length)h+='<div class="gf">Tidak ada temuan terhapus.</div>';
  else S.terhapus.forEach(function(d){
    h+='<div class="row" style="border-top:1px solid var(--sep)"><div style="overflow-wrap:anywhere">'+esc(d.uraian)+'</div><div class="note" style="padding:4px 0 0">'+esc(d.gedung)+' / '+esc(d.lantai)+' / '+esc(d.ruangan)+'. Dihapus '+esc(String(d.dihapusPada||'').slice(0,10))+' oleh '+esc(d.dihapusOleh)+'</div><div class="pbtn"><button type="button" class="pill ok" data-act="pulih" data-d="'+esc(d.id)+'">Pulihkan</button><button type="button" class="pill bad" data-act="permanen" data-d="'+esc(d.id)+'">Hapus permanen</button></div></div>';
  });
  return h+'</section>';
}
function kelolaHtml(){
  if(!S.roomsReady&&!S.rooms.length)return '<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Kelola</h1></div>'+skel('kelola');
  var tab=S.klTab;
  if(tab==='gl'&&!S.klMs&&!S.klMsBusy)klMuatMs();
  if(tab==='isian'&&S.regOk&&S.reg&&!S.rg.pakai&&!S.rg.memuat&&!S.rg.gagal)rgMuatPakai();
  var tabs='<div class="seg kltabs" role="tablist" aria-label="Bagian Kelola">'+KL_TAB.map(function(x){return '<button type="button" class="'+(tab===x[0]?'on':'')+'" role="tab" aria-selected="'+(tab===x[0])+'" data-act="kltab" data-v="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  var isi=tab==='gl'?klGlHtml():tab==='imp'?impHtml():tab==='isian'?regAdminHtml():tab==='lain'?klLainHtml():klRuangHtml();
  if(desk())return '<div class="bhead"><div><h1>Kelola</h1><div class="bsub">Ruangan, gedung dan lantai, impor, dan laporan massal &middot; '+esc(S.paket.nama)+'</div></div></div><div class="kwrap k-'+tab+'">'+tabs+isi+'</div>';
  return '<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Kelola</h1></div>'+tabs+isi;
}
async function klMuatMs(){
  S.klMsBusy=true;
  try{S.klMs=await api('master_semua')}catch(e){S.klMs=null;if(e&&e.server)gagal(e)}
  S.klMsBusy=false;if(S.view==='kelola'&&S.klTab==='gl'&&S.klMs)render();
}
/** Sesudah gedung atau lantai diubah: segarkan daftar resmi (form), daftar Kelola, dan ruangan bila namanya ikut berubah. */
async function klSesudahMaster(r,ubahNama){
  if(r&&r.master)S.klMs=r.master;
  try{masterSet(await api('master'))}catch(e){}
  if(ubahNama){S.defects={};S.all=null;await loadRooms()}
  render();
}
async function glAktif(k,g,l,aktif){
  var r=await work('Menyimpan...',function(){return k==='g'?api('gedung_ubah',{nama:g,aktif:aktif}):api('lantai_ubah',{gedung:g,lantai:l,aktif:aktif})});
  if(r){toast((k==='g'?'Gedung ':'Lantai ')+(aktif?'diaktifkan.':'dinonaktifkan.'));await klSesudahMaster(r,false)}
}
async function klMuatNon(){
  try{S.klNonList=await api('ruangan_nonaktif')}catch(e){S.klNonList=[];if(e&&e.server)gagal(e)}
  render();
}
async function exportRuangan(){
  S.busy='Menyusun Excel...';renderOverlay();
  try{
    await loadLib(XLSX_URL,'XLSX');
    var X=window.XLSX,rows=[['Gedung','Lantai','Ruangan','Total','Open','Proses','Close']];
    tree().forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){rows.push([g.nama,l.nama,r.nama,r.total||0,r.open||0,r.proses||0,r.close||0])})})});
    var ws=X.utils.aoa_to_sheet(rows);ws['!cols']=[26,24,34,8,8,8,8].map(function(w){return {wch:w}});
    var wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Ruangan');
    var out=X.write(wb,{bookType:'xlsx',type:'array'});
    S.busy='';renderOverlay();
    showFile('Daftar_Ruangan_'+clean(S.paket.nama)+'_'+today()+'.xlsx',out,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }catch(e){S.busy='';renderOverlay();toast('Excel tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}

/* ---------- overlay ---------- */
var ovTm=0;
function renderOverlay(){
  var h='';
  if(S.busy)h='<div class="ov mid" style="z-index:90"><div class="sheet"><div class="busy"><div class="spin d"></div><span>'+esc(S.busy)+'</span></div>'+(S.zipRun?'<button type="button" class="btn sec" data-act="zipbatal" style="margin-top:10px">Batal</button>':'')+'</div></div>';
  else if(S.zoom){
    var zp=/=w1024$/.test(S.zoom)?S.zoom.replace(/=w1024$/,'=w400'):'';   // pratinjau buram dari thumbnail yang sudah ada, sampai foto tajam termuat
    h='<div class="ov zoom'+(zp?' lm':'')+'" data-act="zoomx">'+(zp?'<img class="zprev" alt="" referrerpolicy="no-referrer" src="'+esc(zp)+'">':'')+'<img'+(zp?' class="zmain"':'')+' alt="Foto" referrerpolicy="no-referrer" src="'+esc(S.zoom)+'"><button type="button" class="btn-ic" data-act="zoomx" aria-label="Tutup">'+ic('x')+'</button>'+'</div>';}
  else if(S.file&&desk()){
    var ext=(String(S.file.name).split('.').pop()||'').toUpperCase(),kb=S.file.size/1024,uk=kb>=1024?(kb/1024).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(kb))+' KB',pdf=ext==='PDF';
    h='<div class="ov mid"><div class="sheet gap fileok" role="dialog" aria-label="File siap"><span class="okc" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2>File siap</h2><div class="note c">Dibuat di komputer ini, tanpa unggah ke server</div>'+
      '<div class="fcard"><span class="ftype '+ext.toLowerCase()+'" aria-hidden="true">'+ic(ext==='ZIP'?'zip':ext==='PDF'?'pdf':'excel')+'</span><div><b>'+esc(S.file.name)+'</b><span>'+esc(ext)+' &middot; '+uk+'</span></div></div>'+
      '<div class="btnrow"><a class="btn" id="dl" href="'+esc(S.file.url)+'" download="'+esc(S.file.name)+'">Unduh</a>'+(pdf?'<a class="btn soft" href="'+esc(S.file.url)+'" target="_blank" rel="noopener">Buka di tab baru</a>':'')+'</div>'+
      '<div class="note c">Setelah Unduh, berkas ada di folder Unduhan browser. Menutup jendela ini tidak menghapusnya.</div><button type="button" class="lnk c" data-act="tutupfile">Selesai</button></div></div>';
  }
  else if(S.file)h='<div class="ov mid"><div class="sheet gap"><h2>File siap</h2><div class="note" style="padding:0 0 4px">'+esc(S.file.name)+'</div>'+
    '<a class="btn" id="dl" href="'+esc(S.file.url)+'" download="'+esc(S.file.name)+'">Unduh</a>'+
    (S.file.canShare?'<button type="button" class="btn sec" data-act="bagi">Bagikan</button>':'')+
    '<button type="button" class="btn sec" data-act="tutupfile">Tutup</button></div></div>';
  else if(S.modal)h=modalHtml();
  var key=S.busy?'busy':S.zoom?'zoom':S.file?'file':S.modal?'m'+S.modal.t:'',prev=S.ovKey;
  if(!h&&prev&&(prev.charAt(0)==='m'||prev==='file')&&animOn()&&overlay.querySelector('.ov')){   // animasi keluar singkat
    overlay.classList.remove('fx');S.ovKey='';
    Array.prototype.forEach.call(overlay.querySelectorAll('.ov'),function(o){o.classList.add('out')});
    clearTimeout(ovTm);ovTm=setTimeout(function(){if(!S.ovKey)overlay.innerHTML=''},170);
    aturDialog('',prev);if(M_)M_.sesudahOverlay();return;
  }
  clearTimeout(ovTm);
  overlay.classList.toggle('fx',!!key&&key!==S.ovKey);S.ovKey=key;
  overlay.innerHTML=h;
  aturDialog(key,prev);
  if(M_)M_.sesudahOverlay();
  lensAll(overlay);
}
/* Dialog: peran ARIA, fokus pindah ke dalam dialog saat dibuka dan kembali ke pemicu saat ditutup. */
function aturDialog(key,prev){
  if(key&&key!==prev){
    if(!prev)S.fokusAsal=document.activeElement;
    Array.prototype.forEach.call(overlay.querySelectorAll('.sheet'),function(s){
      s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('tabindex','-1');
      var h2=s.querySelector('h2');if(h2&&!s.getAttribute('aria-label'))s.setAttribute('aria-label',h2.textContent);
    });
    var tg=overlay.querySelector('.sheet')||overlay.querySelector('.btn-ic');
    if(tg)try{tg.focus({preventScroll:true})}catch(e){}
  }else if(!key&&prev){
    var f=S.fokusAsal;S.fokusAsal=null;
    if(f&&f.focus&&document.contains(f))try{f.focus({preventScroll:true})}catch(e){}
  }
}
function modalHtml(){
  var m=S.modal;
  if(M_&&M_.punya(m.t))return M_.modalHtml(m);
  if(m.t==='temuan')return fHtml(m);
  if(m.t==='rgatur')return rgHtml(m);
  if(m.t==='rgyakin')return rgYakinHtml(m);
  if(m.t==='pdfbidang')return pbHtml(m);
  if(m.t==='verif'){
    var d=m.d;
    return '<div class="ov" data-act="modalbg"><div class="sheet" role="dialog" aria-label="Verifikasi"><h2>Verifikasi MK</h2><div class="note" style="padding:0 0 10px;overflow-wrap:anywhere">'+esc(d.uraian)+'</div>'+
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Catatan MK (opsional)</span><textarea id="vC" style="min-height:80px">'+esc(d.catatan||'')+'</textarea></label></div></section>'+
      (d.fotoAfter.length?'':'<div class="note" style="padding:0 0 10px">Belum ada foto After dari penanggung jawab, jadi belum bisa diterima atau ditolak.</div>')+
      (d.fotoAfter.length&&d.verifikasi!=='Diterima'&&hambatTerima(d)?'<div class="note tolak" style="padding:0 0 10px">'+esc(hambatTerima(d))+'</div>':'')+
      '<div class="gap"><button type="button" class="btn"'+(d.fotoAfter.length&&d.verifikasi!=='Diterima'&&!hambatTerima(d)?'':' disabled')+' data-act="vset" data-h="Diterima">'+(d.verifikasi==='Diterima'?'Sudah diterima (Close)':'Diterima (Close)')+'</button><button type="button" class="btn bad"'+(d.fotoAfter.length&&d.verifikasi!=='Ditolak'?'':' disabled')+' data-act="vset" data-h="Ditolak">'+(d.verifikasi==='Ditolak'?'Sudah ditolak':'Ditolak')+'</button>'+
      (d.verifikasi?'<button type="button" class="btn sec" data-act="vset" data-h="">Batalkan verifikasi</button>':'')+
      '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div></div>';
  }
  if(m.t==='set'){
    var us=S.user;
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Pengaturan"><div class="grab" aria-hidden="true"></div><h2>Pengaturan</h2>'+
      (us?'<div class="ucard"><span class="av" aria-hidden="true">'+esc((us.nama||'?').trim().charAt(0).toUpperCase())+'</span><div><b>'+esc(us.nama)+'</b><span>'+esc(us.peran)+' &middot; '+esc(S.paket.nama)+'</span></div></div>':'')+
      (M_?M_.setelanHtml():'')+
      '<div><div class="cap" style="margin:0 4px 8px">Tema</div><div class="seg">'+
      [['sistem','Sistem'],['terang','Terang'],['gelap','Gelap']].map(function(o){return '<button type="button" data-act="tema" data-v="'+o[0]+'" class="ico'+(S.tema===o[0]?' on':'')+'">'+ic(o[0])+o[1]+'</button>'}).join('')+'</div></div>'+
      '<div><div class="cap" style="margin:0 4px 8px">Animasi</div><div class="seg">'+
      [['sistem','Sistem'],['penuh','Penuh'],['hemat','Hemat']].map(function(o){return '<button type="button" data-act="anim" data-v="'+o[0]+'" class="ico'+(S.anim===o[0]?' on':'')+'">'+ic(o[0])+o[1]+'</button>'}).join('')+'</div></div>'+
      (us?'<div class="btnrow"><button type="button" class="btn sec" data-act="ganti">'+ic('swap')+'Ganti paket</button><button type="button" class="btn bad" data-act="keluar">'+ic('out')+'Keluar</button></div>':'')+
      '<button type="button" class="btn sec" data-act="bersih">'+ic('refresh')+'Bersihkan cache aplikasi</button>'+
      '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
  }
  if(m.t==='sesi')
    return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Sesi berakhir"><h2>Sesi berakhir</h2><div class="note" style="padding:0">Demi keamanan, Anda perlu masuk lagi dengan kode akses. Temuan yang sudah tersimpan tidak hilang.</div><button type="button" class="btn" data-act="mtutup">Masuk lagi</button></div></div>';
  if(m.t==='batalmulai')
    return '<div class="ov mid"><div class="sheet gap"><h2>Batalkan mulai perbaikan?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">'+esc(m.d.uraian)+'</div><div class="note" style="padding:0">Tanggal mulai dihapus dan temuan kembali Open. Hanya bisa selama belum ada foto After.</div>'+
      '<button type="button" class="btn bad" data-act="batalmulaiya">Batalkan</button><button type="button" class="btn sec" data-act="mtutup">Kembali</button></div></div>';
  if(m.t==='permanen')
    return '<div class="ov mid"><div class="sheet gap"><h2>Hapus permanen?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">'+esc(m.d.uraian)+'</div><div class="note" style="padding:0">Baris temuan dihapus dari sheet dan fotonya dibuang dari Drive. Tidak bisa dipulihkan dari aplikasi.</div>'+
      '<button type="button" class="btn bad" data-act="permanenya">Hapus permanen</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='lokpilih')return lokLembarHtml();
  if(m.t==='filter')return filterLembarHtml();
  if(m.t==='aksi')return aksiLembarHtml();
  if(m.t==='aqmenu')return aqMenuHtml();
  if(m.t==='mirip'){
    var mp=m.mirip,lbm=labelBidang(m.f.bidang),tj=mp.jenis==='gedung'?lbm.area:lbm.level;
    return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Nama mirip"><h2>Sudah ada '+esc(mp.entri)+'</h2><div class="note" style="padding:0;overflow-wrap:anywhere">Anda mengetik "'+esc(mp.masuk)+'"'+(mp.jenis==='lantai'?' di '+esc(mp.gedung):'')+'. '+esc(tj)+' yang sudah ada: "'+esc(mp.entri)+'". Pakai yang sudah ada supaya tidak ganda.</div>'+
      '<button type="button" class="btn" data-act="miripPakai">Pakai '+esc(mp.entri)+'</button><button type="button" class="btn sec" data-act="miripBaru">Tetap buat baru</button><button type="button" class="btn sec" data-act="miripBatal">Batal</button></div></div>';
  }
  if(m.t==='ttx')return ttxHtml(m.d);
  if(m.t==='kmenu')
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Menu temuan"><div class="group kmenu"><div class="list">'+kmenuItems(m.d).map(function(it){return '<button type="button" class="row act'+(it.bad?' bad':'')+'" data-act="'+it.a+'" data-d="'+esc(m.d.id)+'">'+(it.ic?ic(it.ic):'')+'<span>'+it.t+'</span></button>'}).join('')+'</div></div><button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
  if(m.t==='unggah')
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Unggah foto"><h2>Foto '+(m.j==='before'?'Before':'After')+'</h2><div class="note" style="padding:0">Foto dipotong otomatis ke rasio 4:3 (landscape) lalu dikecilkan sebelum diunggah.</div>'+
      '<div class="utiles"><button type="button" class="utile" data-act="foto" data-d="'+esc(m.d.id)+'" data-j="'+m.j+'" data-cam="1">'+ic('cam')+'<span>Kamera</span></button>'+
      '<button type="button" class="utile" data-act="foto" data-d="'+esc(m.d.id)+'" data-j="'+m.j+'">'+ic('img')+'<span>Galeri</span></button></div>'+
      '<button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='hapus')
    return '<div class="ov mid"><div class="sheet gap"><div class="dlgic bad"><svg viewBox="0 0 24 24" aria-hidden="true"><g class="lid"><path d="M4.5 7.8h15"/><path d="M9.6 7.8V5.6a1 1 0 011-1h2.8a1 1 0 011 1v2.2"/></g><path d="M6.2 7.8l.9 11.6a1.6 1.6 0 001.6 1.5h6.6a1.6 1.6 0 001.6-1.5l.9-11.6"/><path d="M10 11.4v5.2M14 11.4v5.2"/></svg></div><h2>Hapus temuan?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">'+esc(m.d.uraian)+'</div><div class="note" style="padding:0">Temuan hilang dari daftar dan foto dipindah ke folder Sampah. Hanya Admin yang bisa memulihkannya.</div>'+
      '<button type="button" class="btn bad" data-act="hapusya">Hapus</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='ruang')
    return '<div class="ov"><div class="sheet" role="dialog" aria-label="Ubah ruangan"><h2>Ubah ruangan</h2><section class="group"><div class="list">'+
      '<label class="row"><span class="lbl">Gedung</span><input type="text" id="rG" value="'+esc(m.r.gedung)+'"></label>'+
      '<label class="row"><span class="lbl">Lantai</span><input type="text" id="rL" value="'+esc(m.r.lantai)+'"></label>'+
      '<label class="row"><span class="lbl">Ruangan</span><input type="text" id="rN" value="'+esc((m.pre&&m.pre.n)||m.r.nama)+'"'+(m.r.bidang?' readonly':'')+'></label>'+
      '<label class="row"><span class="lbl">Lokasi detail</span><input type="text" id="rD" maxlength="120" placeholder="Opsional, mis. depan ruang LVMDP"></label></div></section>'+
      '<div class="note">Isi Lokasi detail bila nama lama memuat posisi. Teksnya ditambahkan ke Lokasi detail semua temuan ruangan ini. Bila nama baru sudah ada, ruangan digabung ke sana.</div>'+
      '<div class="gap"><button type="button" class="btn" data-act="rsimpan">Simpan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>';
  if(m.t==='gabung')
    return '<div class="ov mid"><div class="sheet gap"><div class="dlgic warn">'+ic('peringatan')+'</div><h2>Gabung ke ruangan yang ada?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">Ruangan "'+esc(m.r.nama)+'" sudah ada sebagai '+esc(m.g)+' / '+esc(m.l)+' / '+esc(m.n)+'.</div>'+
      (m.pv?'<div class="klstats"><span class="klst"><b>'+m.pv.temuan+'</b> temuan pindah</span><span class="klst"><b>'+m.pv.foto+'</b> foto pindah</span><span class="klst">nomor <b>'+m.pv.noAwal+(m.pv.noAkhir>m.pv.noAwal?' sampai '+m.pv.noAkhir:'')+'</b></span></div>':'')+
      '<div class="note" style="padding:0">Ruangan lama dinonaktifkan'+(m.d?' dan Lokasi detail "'+esc(m.d)+'" ditambahkan ke temuan itu':'')+'. Penggabungan tidak bisa dibalik otomatis.</div>'+
      '<button type="button" class="btn" data-act="gabungya">Gabung</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='glubah')
    return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Ubah nama"><h2>Ubah nama '+(m.k==='g'?'gedung':'lantai')+'</h2><section class="group"><div class="list"><label class="row"><span class="lbl">Nama</span><input type="text" id="glN" maxlength="'+(m.k==='g'?80:40)+'" value="'+esc(m.nama)+'"></label></div></section>'+
      '<div class="note" style="padding:0">Semua ruangan, temuan, dan nama folder foto di '+(m.k==='g'?'gedung':'lantai')+' ini ikut berganti nama.</div>'+
      '<button type="button" class="btn" data-act="glsimpan">Simpan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='glnon')
    return '<div class="ov mid"><div class="sheet gap"><div class="dlgic warn">'+ic('peringatan')+'</div><h2>Nonaktifkan '+(m.k==='g'?'gedung':'lantai')+'?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">'+esc(m.k==='g'?m.g:m.g+' / '+m.l)+' masih punya <b>'+m.c+'</b> ruangan. Ruangan dan temuannya tetap ada, tetapi '+(m.k==='g'?'gedung':'lantai')+' ini tidak muncul lagi di pilihan form. Bisa diaktifkan kembali kapan saja.</div>'+
      '<button type="button" class="btn bad" data-act="glnonya">Nonaktifkan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='nonaktif')
    return '<div class="ov mid"><div class="sheet gap"><div class="dlgic warn">'+ic('peringatan')+'</div><h2>Nonaktifkan ruangan?</h2><div class="note" style="padding:0">'+esc(m.r.gedung)+' / '+esc(m.r.lantai)+' / '+esc(m.r.nama)+'. Temuannya tetap tersimpan di sheet.</div>'+
      '<button type="button" class="btn bad" data-act="nonya">Nonaktifkan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  return '';
}

/* ---------- foto ---------- */
function loadViaImg(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){URL.revokeObjectURL(u);res(im)};im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('img'))};im.src=u})}
/* Foto dipotong tengah ke 4:3 landscape (sama dengan kotak foto di kartu dan laporan), lalu dikecilkan ke sisi terpanjang 1024 px, sekitar 150 KB:
 * cukup tajam untuk layar dan PDF, jauh lebih cepat diunggah. Kamera HP umumnya sudah 4:3, jadi biasanya tidak ada yang terpotong. */
var FOTO_TARGET=150*1024,FOTO_RASIO=4/3;
function potong43(w,h){   // area sumber {sx,sy,sw,sh} berasio 4:3 (landscape), terpusat
  var sw=w,sh=h;
  if(w/h>FOTO_RASIO)sw=Math.round(h*FOTO_RASIO);else sh=Math.round(w/FOTO_RASIO);
  return {sx:Math.round((w-sw)/2),sy:Math.round((h-sh)/2),sw:sw,sh:sh};
}
async function prep(file,out){
  var src;
  try{src=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){src=await loadViaImg(file)}
  var w0=src.width||src.naturalWidth,h0=src.height||src.naturalHeight,cr=potong43(w0,h0),w=cr.sw,h=cr.sh;
  var TARGET=FOTO_TARGET,best=null;
  var tries=[[1024,0.74],[1024,0.64],[896,0.58]];
  var c=document.createElement('canvas'),x=c.getContext('2d'),lastDim=0;
  for(var i=0;i<tries.length;i++){
    var dim=tries[i][0],q=tries[i][1];
    if(dim!==lastDim){
      var sc=Math.min(1,dim/Math.max(w,h));c.width=Math.max(1,Math.round(w*sc));c.height=Math.max(1,Math.round(h*sc));
      x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(src,cr.sx,cr.sy,cr.sw,cr.sh,0,0,c.width,c.height);lastDim=dim;
    }
    best=c.toDataURL('image/jpeg',q);
    if(best.length*0.75<=TARGET)break;
  }
  if(out){ // pratinjau kecil (sekitar 12 KB) untuk ditampilkan seketika tanpa menunggu thumbnail Drive
    var tc=document.createElement('canvas'),ts=Math.min(1,320/Math.max(w,h));
    tc.width=Math.max(1,Math.round(w*ts));tc.height=Math.max(1,Math.round(h*ts));
    var tx=tc.getContext('2d');tx.fillStyle='#fff';tx.fillRect(0,0,tc.width,tc.height);tx.drawImage(src,cr.sx,cr.sy,cr.sw,cr.sh,0,0,tc.width,tc.height);
    out.tn=tc.toDataURL('image/jpeg',0.6);
  }
  if(src.close)try{src.close()}catch(e){}
  return best;
}
function pick(cam,cb){
  pickCb=cb;var el=$(cam?'fCam':'fGal');el.value='';el.click();
}
/* Kamera bawaan HP tidak bisa dikendalikan dari aplikasi, jadi rana berkedip saat foto kembali ke aplikasi. */
function kedip(){if(!animOn())return;var d=document.createElement('div');d.className='rana';document.body.appendChild(d);setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},360)}
function onFiles(ev){
  var files=Array.prototype.slice.call(ev.target.files||[]),cam=ev.target.id==='fCam';ev.target.value='';
  if(!files.length||!pickCb)return;
  var cb=pickCb;pickCb=null;if(cam)kedip();cb(files);
}
['dragenter','dragover'].forEach(function(t){document.addEventListener(t,function(e){
  if(!(desk()&&S.modal&&S.modal.t==='temuan'&&S.modal.f&&!S.modal.f.id))return;
  e.preventDefault();var z=$('dropz');if(z)z.classList.add('on')})});
document.addEventListener('dragleave',function(e){var z=$('dropz');if(z&&(!e.relatedTarget||!z.contains(e.relatedTarget)))z.classList.remove('on')});
document.addEventListener('drop',function(e){
  var z=$('dropz');if(z)z.classList.remove('on');
  if(!(desk()&&S.modal&&S.modal.t==='temuan'&&S.modal.f&&!S.modal.f.id))return;
  e.preventDefault();
  var fs=Array.prototype.slice.call((e.dataTransfer&&e.dataTransfer.files)||[]).filter(function(x){return /^image\//.test(x.type)});
  if(!fs.length){toast('Seret berkas foto (JPG atau PNG).');return}
  readForm();modalFotos(S.modal.f,fs);
});
$('fGal').addEventListener('change',onFiles);$('fCam').addEventListener('change',onFiles);
$('fXls').addEventListener('change',function(ev){var f=ev.target.files&&ev.target.files[0];ev.target.value='';if(f)bacaExcel(f)});

var upSeq=0,prepRun=false,upActive=0;
function nk(){return Date.now().toString(36)+'-'+(++upSeq)}   // kunci unik lintas sesi (antrean tersimpan di IndexedDB)
/* Antrean foto disimpan di IndexedDB begitu siap dikirim, dan dilanjutkan otomatis setelah masuk lagi. */
function qSave(j){if(S.paket)IDB.put('up',{k:j.k,did:j.did,jenis:j.jenis,data:j.data,tn:j.tn||'',pid:S.paket.id})}
function qDel(k){IDB.del('up',k)}
async function qPulihkan(){
  var its=await IDB.all('up'),n=0;
  if(!S.paket||!S.user)return;
  its.forEach(function(it){
    if(it.pid!==S.paket.id||S.up.some(function(x){return x.k===it.k}))return;
    S.up.push({k:it.k,did:it.did,jenis:it.jenis,st:'wait',data:it.data,tn:it.tn||null});n++;
  });
  if(n){toast(n+' foto yang belum terkirim dilanjutkan.');upBar();runQueue()}
}
var UP_PAR=3;                                   // jumlah unggahan bersamaan
var UKUR=lsGet('dl-ukur')==='1';                // aktifkan dengan localStorage.setItem('dl-ukur','1'); hasilnya di console
function enqueue(did,jenis,files){
  files.forEach(function(f){S.up.push({k:nk(),did:did,jenis:jenis,st:'prep',file:f,data:null})});
  upUi(did);prepLoop();
}
async function prepLoop(){
  if(prepRun)return;prepRun=true;
  try{
    var j;
    while((j=S.up.filter(function(x){return x.st==='prep'})[0])){
      try{var o={},t0=Date.now(),d=await prep(j.file,o);if(S.up.indexOf(j)>=0){j.data=d;j.tn=o.tn;j.file=null;j.st='wait';j.tPrep=Date.now()-t0;qSave(j)}}
      catch(e){S.up=S.up.filter(function(x){return x!==j});toast('Foto tidak bisa dibaca. Coba foto lain.')}
      upUi(j.did);runQueue();
    }
  }finally{prepRun=false}
}
/* Kolam unggahan: sampai UP_PAR foto dikirim bersamaan. Server menomori berkas di dalam lock, jadi aman. */
function runQueue(){
  while(upActive<UP_PAR){
    var j=S.up.filter(function(x){return x.st==='wait'})[0];
    if(!j)break;
    j.st='run';upActive++;upUi(j.did);
    kirimFoto(j).then(function(){upActive--;runQueue()},function(){upActive--;runQueue()});
  }
  if(!upActive)upBar();
}
async function kirimFoto(j){
  var t0=Date.now();
  try{
    var r=await api('foto_unggah',{id:j.did,jenis:j.jenis,mime:'image/jpeg',data:j.data,ukur:UKUR?1:0});
    if(S.up.indexOf(j)<0)return;
    S.up=S.up.filter(function(x){return x!==j});qDel(j.k);
    if(j.tn)S.pv[r.foto.id]=j.tn;
    S.fotoOk[r.foto.id]=1;setTimeout(function(){delete S.fotoOk[r.foto.id]},2500);   // thumbnail asli muncul dengan centang singkat (satu kali)
    // Respons bisa tiba tidak berurutan. Jangan timpa data yang lebih baru dengan yang lebih lama.
    var cur=findDefect(r.defect.id);
    if(cur&&(cur.fotoBefore.length>r.defect.fotoBefore.length||cur.fotoAfter.length>r.defect.fotoAfter.length)){
      var arr=j.jenis==='before'?cur.fotoBefore:cur.fotoAfter;
      if(!arr.some(function(f){return f.id===r.foto.id}))arr.push(r.foto);
    }else{
      putDefect(r.defect);
      if(isPJ()&&j.jenis==='after'&&!r.defect.perlu){toast('Foto After terkirim. Temuan menunggu verifikasi MK.');if(S.view==='perbaikan')render()}
    }
    if(UKUR)console.log('[ukur] foto',j.jenis,'kompres',j.tPrep+'ms','kirim+server',(Date.now()-t0)+'ms','ukuran',Math.round(j.data.length*0.75/1024)+'KB','server',r.ms);
  }catch(e){
    if(S.up.indexOf(j)<0)return;
    if(e&&e.server&&/Kode tidak dikenal|nonaktif/i.test(e.message||'')){gagal(e);return}
    j.st='err';j.msg=(e&&e.server&&e.message)||'Tidak terhubung ke server';
  }
  upUi(j.did);
}
function upHtml(j){
  var pv=(j.tn||j.data)?'<img class="pv" alt="" src="'+(j.tn||j.data)+'">':'';
  if(j.st==='err')return '<div class="thumb up bad" title="'+esc(j.msg||'')+'">'+pv+'<div class="ov2"><b>Gagal</b><span><button type="button" class="mini" data-act="upretry" data-k="'+j.k+'">Coba lagi</button><button type="button" class="mini" data-act="upbuang" data-k="'+j.k+'">Buang</button></span></div></div>';
  var lbl=j.st==='prep'?'Menyiapkan':j.st==='wait'?'Antre':'Mengunggah';
  return '<div class="thumb up">'+pv+'<div class="ov2"><svg class="ur'+(j.st==='run'?' run':'')+'" viewBox="0 0 36 36" aria-hidden="true"><circle class="tr" cx="18" cy="18" r="15"/><circle class="arc" cx="18" cy="18" r="15"/></svg><small>'+lbl+'</small></div></div>';
}
function upUi(did){
  var d=did&&findDefect(did);
  if(d){
    var a=Array.prototype.filter.call(document.querySelectorAll('article.entry'),function(x){return x.getAttribute('data-id')===did})[0];
    if(a){var ro=a.getAttribute('data-ro')==='1';['before','after'].forEach(function(jn){var p=a.querySelector('.ph[data-j="'+jn+'"]');if(p)p.innerHTML=phHtml(d,jn,ro,'kartu')})}
    if(S.modal&&S.modal.f&&S.modal.f.id===did)fotoEditRefresh();
  }
  upBar();
}
function upBar(){
  var el=$('upbar');if(!el){el=document.createElement('div');el.id='upbar';el.className='upbar';el.setAttribute('role','status');document.body.appendChild(el)}
  var n=S.up.filter(function(x){return x.st!=='err'}).length,e=S.up.length-n;
  var dw=DRAF.filter(function(x){return x.st==='wait'}).length,dc=DRAF.length-dw;
  var off=navigator.onLine===false;
  if(!S.user||(!n&&!e&&!dw&&!dc&&!S.drafOk&&!off)){el.hidden=true;return}
  var h=[];
  if(off)h.push('<span class="dot" aria-hidden="true"></span>Tidak ada sinyal. Data yang tampil bisa sudah lama');
  if(S.drafOk)h.push('<span class="tcek">'+SVG_CEK+'</span>'+S.drafOk+' draf terkirim');   // centang singkat setelah draf offline terkirim
  if(n)h.push('<span class="sp"></span>Mengunggah '+n+' foto'+(e?', '+e+' gagal':''));else if(e)h.push(e+' foto gagal diunggah');
  if(dw)h.push('<span class="dot" aria-hidden="true"></span>'+dw+' draf menunggu sinyal <button type="button" data-act="drafkirim">Kirim</button>');
  if(dc)h.push(dc+' draf perlu dicek <button type="button" data-act="drafbuka">Buka</button>');
  el.innerHTML=h.join(' &middot; ');
  el.hidden=false;
}
window.addEventListener('beforeunload',function(ev){if(S.up&&S.up.some(function(x){return x.st!=='err'})){ev.preventDefault();ev.returnValue=''}});

/* ---------- riwayat: tombol back menutup lapisan dulu, baru layar ---------- */
function hpush(kind){S.hist.push(kind);try{history.pushState({dl:1},'')}catch(e){}}
function hpopTop(kind){
  if(S.hist[S.hist.length-1]===kind){S.hist.pop();S.skip++;try{history.back()}catch(e){S.skip--}}
}
function resetHist(keepPaket){
  var i=S.hist.indexOf('paket'),keepN=(keepPaket&&i>=0)?i+1:0,n=S.hist.length-keepN;
  if(n<=0)return;
  S.hist=S.hist.slice(0,keepN);S.skip++;try{history.go(-n)}catch(e){S.skip--}
}
function openModal(m){if(!S.modal)hpush('modal');S.modal=m;renderOverlay();if(m.t==='temuan')fSegar()}
function closeModal(){AKTIFCB=null;if(S.modal){hpopTop('modal');S.modal=null}renderOverlay()}
function openZoom(u){if(!S.zoom)hpush('zoom');S.zoom=u;renderOverlay()}
function closeZoom(){if(S.zoom){hpopTop('zoom');S.zoom=null}renderOverlay()}
function closeFile(){if(S.file){try{URL.revokeObjectURL(S.file.url)}catch(e){}hpopTop('file');S.file=null}renderOverlay()}
window.addEventListener('popstate',function(){
  if(S.skip>0){S.skip--;return}
  var k=S.hist.pop();if(!k)return;
  if(k==='zoom')S.zoom=null;
  else if(k==='file'){try{URL.revokeObjectURL(S.file.url)}catch(e){}S.file=null}
  else if(k==='modal')S.modal=null;
  else if(k==='view')S.view='form';
  else if(k==='paket'){S.paket=null;S.user=null;S.kode='';S.loginErr='';S.modal=null;S.zoom=null;S.file=null;lsDel(STORE)}
  render();renderOverlay();
  if(k==='view'&&S.user){var s=ensureSel(tree());if(s)loadDefects(s.r.id,false)}
});

/* ---------- perapian daftar isian (ADMIN, tab Kelola) ---------- */
/** Ringkas daftar kode satu kelompok: "A sampai E" bila rapat, selain itu jumlah kodenya. */
function rgRentang(kodes){
  var n=kodes.map(function(c){return String(c.n)}).sort(L.bandingAlami);if(!n.length)return '';
  var huruf=n.every(function(x){return /^[A-Z]$/.test(x)}),angka=n.every(function(x){return /^[0-9]+$/.test(x)});
  if(huruf&&n[n.length-1].charCodeAt(0)-n[0].charCodeAt(0)===n.length-1)return n.length===1?n[0]:n[0]+' sampai '+n[n.length-1];
  if(angka&&+n[n.length-1]-+n[0]===n.length-1)return n.length===1?n[0]:n[0]+' sampai '+n[n.length-1];
  return n.length+' kode';
}
/** Contoh hasil penambahan grid, diperbarui langsung saat mengetik. */
function rgPrevTeks(k,p,d,s){
  k=L.rapi(k);
  if(!k&&!d&&!s)return 'Contoh: T3-A, T3-B, T3-C';
  if(!k)return 'Isi nama grid, misalnya T3.';
  var ek=expansiKode(d,s);if(ek.err)return ek.err;
  var nm=ek.kode.map(function(c){return k+p+c}),n=nm.length;
  return 'Hasil: '+(n>6?nm.slice(0,5).join(', ')+', ... '+nm[n-1]:nm.join(', '))+' ('+n+' garis)';
}
function rgPrevSegar(){var el=$('rgPrev');if(!el)return;el.textContent=rgPrevTeks($('rgK').value,$('rgP').value,$('rgD').value,$('rgS').value)}
document.addEventListener('input',function(e){var i=e.target&&e.target.id;if(i==='rgK'||i==='rgD'||i==='rgS')rgPrevSegar()});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='rgP')rgPrevSegar()});
async function rgMuatPakai(){
  S.rg.memuat=true;S.rg.gagal=false;
  try{S.rg.pakai=await api('registri_pakai')}catch(e){S.rg.gagal=true}
  S.rg.memuat=false;if(S.view==='kelola'&&S.klTab==='isian')render();
}
function rgArea(){
  var T=tree();if(!T.length)return '';
  if(!T.some(function(g){return g.nama===S.rg.area}))S.rg.area=T[0].nama;
  return S.rg.area;
}
function rgKunciPakai(){return S.rg.pakai||{kelompok:{},kode:{},elemen:{}}}
/** Pasangan yang patut dicek: nama mirip (Elemen) atau satu kelompok adalah awalan kelompok lain (T3 dan T33). x = yang lebih jarang dipakai. */
function rgKandidat(a){
  var ka=L.kunci(a),P=rgKunciPakai(),out=[];
  function pasang(j,list,nama,hitung,ekstra){
    for(var i=0;i<list.length;i++)for(var k=i+1;k<list.length;k++){
      var p=nama(list[i]),q=nama(list[k]),kp=L.kunci(p),kq=L.kunci(q);
      var mirip=(j==='elemen')?(kp.length>=4&&kq.length>=4&&(L.jarak(kp,kq)<=1||((kp.indexOf(kq)===0||kq.indexOf(kp)===0)&&Math.abs(kp.length-kq.length)<=2))):
        ((kp.indexOf(kq)===0||kq.indexOf(kp)===0)&&Math.abs(kp.length-kq.length)===1);
      if(!mirip)continue;
      var np=hitung(list[i]),nq=hitung(list[k]),x=np<=nq?list[i]:list[k],y=x===list[i]?list[k]:list[i];
      out.push(Object.assign({j:j,x:nama(x),nx:hitung(x),y:nama(y),ny:hitung(y)},ekstra||{}));
    }
  }
  var kels=S.reg.kelompok.filter(function(e){return L.kunci(e.area)===ka});
  pasang('kelompok',kels,function(e){return e.k},function(e){return P.kelompok[ka+'|'+e.k]||0});
  BIDANG.forEach(function(b){
    var els=S.reg.elemen.filter(function(e){return e.bidang===b});
    pasang('elemen',els,function(e){return e.nama},function(e){return P.elemen[b+'|'+L.kunci(e.nama)]||0},{bidang:b});
  });
  return out;
}
function regAdminHtml(){
  var h='<section class="group'+(S.rg&&S.rg.pakai?' rgbuka':'')+'"><div class="sh">Daftar isian</div>';
  if(!S.regOk||!S.reg)return h+'<div class="gf">Server belum mendukung daftar isian. Pasang Kode.gs terbaru lalu jalankan siapkan().</div></section>';
  var T=tree(),a=rgArea();
  h+='<div class="list"><label class="row"><span class="lbl">Area</span><select data-rg="area">'+T.map(function(g){return '<option value="'+esc(g.nama)+'"'+(g.nama===a?' selected':'')+'>'+esc(g.nama)+'</option>'}).join('')+'</select></label></div>';
  if(!S.rg.pakai)return h+(S.rg.gagal?'<div class="gf">Daftar belum bisa dimuat.</div><div class="acts" style="padding-top:0;padding-bottom:14px"><button type="button" class="pill" data-act="rgmuat">Coba lagi</button></div>':'<div class="gf" role="status">Memuat daftar isian...</div>')+'</section>';
  var P=S.rg.pakai,ka=L.kunci(a);
  var kand=rgKandidat(a);
  if(kand.length){
    h+='<div class="note" style="font-weight:600;padding-top:12px">Perlu dicek</div><div class="list">'+kand.map(function(c){
      var atr=c.j==='kelompok'?'data-j="kelompok" data-k="'+esc(c.x)+'"':'data-j="elemen" data-b="'+esc(c.bidang)+'" data-nama="'+esc(c.x)+'"';
      return '<div class="row" style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0;overflow-wrap:anywhere"><b>'+esc(c.x)+'</b> ('+c.nx+') mirip <b>'+esc(c.y)+'</b> ('+c.ny+')'+(c.bidang?' <span class="tag">'+esc(c.bidang)+'</span>':'')+'</span><button type="button" class="pill" data-act="rgatur" '+atr+'>Atur</button></div>'}).join('')+'</div>';
  }
  var kels=S.reg.kelompok.filter(function(e){return L.kunci(e.area)===ka}).sort(function(x,y){return L.bandingNama(x.k,y.k)});
  var tanpa=S.reg.kode.filter(function(e){return L.kunci(e.area)===ka&&e.k===''});
  h+='<div class="note" style="font-weight:600;padding-top:12px">Grid yang sudah ada</div><div class="list">';
  if(!kels.length&&!tanpa.length)h+='<div class="gf">Belum ada. Terbentuk otomatis dari temuan, atau tambahkan sekaligus di bawah.</div>';
  function kodeTags(k,list){return '<div class="meta" style="padding:8px 0 0">'+list.sort(function(x,y){return L.bandingAlami(x.n,y.n)}).map(function(c){var nn=P.kode[ka+'|'+k+'|'+c.n]||0;return '<button type="button" class="tag" style="border:0;cursor:pointer" data-act="rgatur" data-j="kode" data-k="'+esc(k)+'" data-n="'+esc(c.n)+'">'+esc(c.n)+' · '+nn+'</button>'}).join('')+'</div>'}
  kels.forEach(function(e){
    var n=P.kelompok[ka+'|'+e.k]||0,kodes=S.reg.kode.filter(function(x){return L.kunci(x.area)===ka&&x.k===e.k});
    h+='<div class="row"><div style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0"><b>'+esc(e.k)+'</b> <span class="tag">'+(e.pem===''?'tanpa pemisah':'pemisah '+esc(e.pem))+'</span> <span class="tag">'+n+' temuan</span>'+(kodes.length?' <span class="tag">'+esc(rgRentang(kodes))+'</span>':'')+'</span><button type="button" class="pill" data-act="rgatur" data-j="kelompok" data-k="'+esc(e.k)+'">Atur</button></div>'+kodeTags(e.k,kodes)+'</div>';
  });
  if(tanpa.length)h+='<div class="row"><b>(tanpa kelompok)</b>'+kodeTags('',tanpa)+'</div>';
  h+='</div>';
  var adaEl=false,hE='';
  BIDANG.forEach(function(b){
    var els=S.reg.elemen.filter(function(e){return e.bidang===b}).sort(function(x,y){return L.bandingNama(x.nama,y.nama)});
    if(!els.length)return;adaEl=true;
    hE+='<div class="note" style="padding-top:8px">'+esc(b)+'</div><div class="list">'+els.map(function(e){var n=P.elemen[b+'|'+L.kunci(e.nama)]||0;
      return '<div class="row" style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0;overflow-wrap:anywhere"><b>'+esc(e.nama)+'</b> <span class="tag">'+n+' temuan</span>'+(e.mode?' <span class="tag">'+esc(e.mode)+'</span>':'')+'</span><button type="button" class="pill" data-act="rgatur" data-j="elemen" data-b="'+esc(b)+'" data-nama="'+esc(e.nama)+'">Atur</button></div>'}).join('')+'</div>';
  });
  if(adaEl)h+='<div class="note" style="font-weight:600;padding-top:12px">Elemen</div>'+hE;
  h+='<div class="note" style="font-weight:600;padding-top:12px">Tambah grid</div><div class="note" style="padding-top:2px">Tulis nama sumbu pada gambar kerja, misalnya T3, lalu rentang kodenya (A sampai E atau 1 sampai 20). Semua garisnya ditambahkan sekaligus.</div><div class="list">'+
    '<div class="two"><label class="row"><span class="lbl">Kelompok</span><input type="text" id="rgK" placeholder="Mis. T3" autocomplete="off"></label><label class="row"><span class="lbl">Pemisah</span><select id="rgP"><option value="-">T3-C</option><option value=".">T3.C</option><option value="">T3C</option></select></label></div>'+
    '<div class="two"><label class="row"><span class="lbl">Kode dari</span><input type="text" id="rgD" placeholder="A atau 1" autocomplete="off"></label><label class="row"><span class="lbl">sampai</span><input type="text" id="rgS" placeholder="E atau 20" autocomplete="off"></label></div></div>'+
    '<div class="acts" style="padding-top:12px;padding-bottom:14px"><div class="note" id="rgPrev" role="status" style="width:100%;padding:0 0 8px">'+esc(rgPrevTeks('','-','',''))+'</div><button type="button" class="pill" data-act="rgseed">'+ic('plus')+'Tambahkan</button><button type="button" class="pill" data-act="rgmuat">'+ic('refresh')+'Muat ulang</button></div></section>';
  return h;
}
/** Jumlah temuan yang memakai entri m (dari hitungan pemakaian terakhir). */
function rgPakaiEntri(m){
  var P=rgKunciPakai(),ka=L.kunci(m.area);
  return m.j==='kelompok'?(P.kelompok[ka+'|'+m.k]||0):m.j==='kode'?(P.kode[ka+'|'+m.k+'|'+m.n]||0):(P.elemen[m.bidang+'|'+L.kunci(m.nama)]||0);
}
function rgYakinHtml(y){
  var m=y.m,dari=m.j==='kelompok'?m.k:m.j==='kode'?m.n:m.nama;
  return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Konfirmasi gabung"><h2>Gabungkan?</h2><div class="note" style="padding:0;overflow-wrap:anywhere"><b>'+esc(dari)+'</b> digabung ke <b>'+esc(y.tujuan)+'</b>. '+y.n+' temuan akan diperbarui. <b>Tidak bisa dibatalkan</b> dari aplikasi; cadangkan spreadsheet bila perlu.</div>'+
    '<button type="button" class="btn bad" data-act="rgyakinya">Gabungkan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
}
function rgHtml(m){
  var a=m.area,ka=L.kunci(a),P=rgKunciPakai(),n=0,judul='',opts=[];
  if(m.j==='kelompok'){n=P.kelompok[ka+'|'+m.k]||0;judul='Kelompok '+m.k;opts=S.reg.kelompok.filter(function(e){return L.kunci(e.area)===ka&&e.k!==m.k}).map(function(e){return e.k})}
  else if(m.j==='kode'){n=P.kode[ka+'|'+m.k+'|'+m.n]||0;judul='Kode '+(m.k?m.k+' ':'')+m.n;opts=S.reg.kode.filter(function(e){return L.kunci(e.area)===ka&&e.k===m.k&&e.n!==m.n}).map(function(e){return e.n}).sort(L.bandingAlami)}
  else{n=P.elemen[m.bidang+'|'+L.kunci(m.nama)]||0;judul='Elemen '+m.nama;opts=S.reg.elemen.filter(function(e){return e.bidang===m.bidang&&L.kunci(e.nama)!==L.kunci(m.nama)}).map(function(e){return e.nama}).sort(L.bandingNama)}
  var h='<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Atur isian"><h2>'+esc(judul)+'</h2><div class="note" style="padding:0">'+(m.j==='elemen'?esc(m.bidang)+'. ':esc(a)+'. ')+'Dipakai oleh <b>'+n+'</b> temuan.</div>';
  if(m.j==='kelompok'){
    var cur=((S.reg.kelompok.filter(function(e){return L.kunci(e.area)===ka&&e.k===m.k})[0])||{}).pem;
    h+='<div><div class="cap" style="margin:0 4px 8px">Pemisah</div><div class="seg">'+[['-',m.k+'-C'],['.',m.k+'.C'],['',m.k+'C']].map(function(o){return '<button type="button" data-act="rgpem" data-v="'+o[0]+'"'+(cur===o[0]?' class="on"':'')+'>'+esc(o[1])+'</button>'}).join('')+'</div></div>';
  }
  if(opts.length)h+='<section class="group"><div class="list"><label class="row"><span class="lbl">Gabungkan ke</span><select id="rgTujuan">'+opts.map(function(o){return '<option>'+esc(o)+'</option>'}).join('')+'</select></label></div></section><button type="button" class="btn" data-act="rggabung">Gabungkan</button>';
  h+='<button type="button" class="btn bad" data-act="rghapus"'+(n?' disabled':'')+'>Hapus'+(n?' (masih dipakai)':'')+'</button><button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
  return h;
}
async function hapusCacheTemuan(){
  var pid=S.paket.id;
  (await IDB.keys('kv')).forEach(function(k){if(String(k).indexOf('def:'+pid+':')===0)IDB.del('kv',k)});
}
/** Panggil aksi perapian berulang sampai selesai (server bekerja per batch). Mengembalikan jumlah temuan yang diperbarui, atau null bila gagal. */
async function jalankanRegistri(aksi,p,label){
  var mulai,total=0,ok=true;
  S.busy=label;renderOverlay();
  try{
    do{
      var r=await api(aksi,Object.assign({},p,{mulai:mulai}));
      total+=r.diubah||0;mulai=r.lanjut;
      if(mulai){S.busy=label+' ('+total+' temuan diperbarui)';renderOverlay()}
    }while(mulai);
  }catch(e){ok=false;gagal(e)}
  finally{S.busy='';renderOverlay()}
  return ok?total:null;
}
async function rgSegarkan(){
  S.defects={};S.all=null;S.siap=null;S.perlu=null;S.stale={};await hapusCacheTemuan();
  await muatRegistri();
  try{S.rg.pakai=await api('registri_pakai')}catch(e){S.rg.pakai=null}
  render();if(canEdit())loadSiap();if(isPJ())loadPerlu();
}
function expansiKode(d,s){
  d=L.rapi(d).toUpperCase();s=L.rapi(s).toUpperCase();
  if(!d)return {err:'Isi kode awal.'};
  if(!s)s=d;
  if(/^[0-9]+$/.test(d)&&/^[0-9]+$/.test(s)){var a=+d,b=+s;if(b<a)return {err:'Kode akhir lebih kecil dari awal.'};if(b-a>199)return {err:'Maksimal 200 kode.'};var o=[];for(var i=a;i<=b;i++)o.push(String(i));return {kode:o}}
  if(/^[A-Z]$/.test(d)&&/^[A-Z]$/.test(s)){var c=d.charCodeAt(0),e=s.charCodeAt(0);if(e<c)return {err:'Kode akhir lebih kecil dari awal.'};var r=[];for(var j=c;j<=e;j++)r.push(String.fromCharCode(j));return {kode:r}}
  return {err:'Isi dua huruf tunggal (A sampai E) atau dua angka (1 sampai 20).'};
}

/* ---------- aksi ---------- */
function mphHtml(f){
  return (f.files.length||f.pend?'<div class="thumbs">'+f.files.map(function(x,i){return '<div class="thumb"><button type="button" data-act="mzoom" data-i="'+i+'"><img alt="" src="'+x+'"></button><button type="button" class="x" data-act="mdel" data-i="'+i+'" aria-label="Buang foto">&times;</button></div>'}).join('')+(function(){var t='';for(var i=0;i<(f.pend||0);i++)t+='<div class="thumb up"><div class="ov2"><span class="sp"></span><small>Menyiapkan</small></div></div>';return t})()+'</div>':'<div class="none">Belum ada foto</div>');
}
function mphRefresh(){var el=$('mph');if(el&&S.modal&&S.modal.f)el.innerHTML=mphHtml(S.modal.f)}
/** Tanggal pengambilan foto (EXIF DateTimeOriginal) sebagai 'yyyy-mm-dd', atau '' bila tidak ada. Dibaca dari berkas asli sebelum dikecilkan. */
async function exifTgl(file){
  try{
    var b=new DataView(await file.slice(0,262144).arrayBuffer());
    if(b.getUint16(0)!==0xFFD8)return '';
    var o=2;
    while(o<b.byteLength-10){
      var mk=b.getUint16(o);if(mk===0xFFDA||(mk&0xFF00)!==0xFF00)return '';
      var len=b.getUint16(o+2);
      if(mk===0xFFE1&&b.getUint32(o+4)===0x45786966){
        var t=o+10,le=b.getUint16(t)===0x4949,g16=function(p){return b.getUint16(p,le)},g32=function(p){return b.getUint32(p,le)};
        var ifd0=t+g32(t+4),n=g16(ifd0),exif=0,dt='';
        var teks=function(e){var off=t+g32(e+8),r='';for(var k=0;k<19;k++)r+=String.fromCharCode(b.getUint8(off+k));return r};
        for(var i=0;i<n;i++){var e=ifd0+2+i*12,tg=g16(e);if(tg===0x8769)exif=t+g32(e+8);else if(tg===0x0132)dt=teks(e)}
        if(exif){var c=g16(exif);for(var j=0;j<c;j++){var e2=exif+2+j*12;if(g16(e2)===0x9003){dt=teks(e2);break}}}
        var m=/^(\d{4}):(\d{2}):(\d{2})/.exec(dt);
        if(m&&+m[1]>=2000&&+m[2]>=1&&+m[2]<=12&&+m[3]>=1&&+m[3]<=31)return m[1]+'-'+m[2]+'-'+m[3];
        return '';
      }
      o+=2+len;
    }
  }catch(e){}
  return '';
}
function wTglNote(f){
  var tx=new Date(f.tgl+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  return f.tglExif?'Tanggal temuan diambil dari tanggal foto ('+esc(tx)+'). Foto otomatis dikecilkan sebelum diunggah.':'Tanggal temuan: '+esc(tx)+'. Foto otomatis dikecilkan sebelum diunggah.';
}
/* ---------- editor coretan foto (panah, lingkaran, kotak, pena) ----------
 * editFoto(dataUrl) membuka layar penuh dan mengembalikan data URL JPEG baru, atau null bila dibatalkan.
 * Coretan disimpan sebagai daftar bentuk dan digambar ulang di atas foto asli, jadi Urungkan selalu bersih. */
var EDIT_WARNA=['#ff2d2d','#ffd60a','#ffffff','#111111'];
function editFoto(src,o){o=o||{};
  return new Promise(function(done){
    var im=new Image();
    im.onerror=function(){toast('Foto tidak bisa dibuka.');done(null)};
    im.onload=function(){
      var W=im.naturalWidth,H=im.naturalHeight,lw=Math.max(4,Math.round(Math.max(W,H)/150));
      var tool='panah',warna=EDIT_WARNA[0],shapes=[],cur=null;
      var ov=document.createElement('div');ov.className='edfoto';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Coret foto');
      ov.innerHTML='<div class="edbar"><button type="button" data-e="batal">'+(o.n?'Lewati':'Batal')+'</button><b>'+(o.total>1?'Coret foto '+o.n+' dari '+o.total:'Coret foto')+'</b><button type="button" data-e="ok" class="pri">Selesai</button></div>'+(o.n?'<div class="edhint">Beri panah atau lingkaran pada temuan agar jelas, lalu ketuk Selesai. Tidak perlu? Ketuk Lewati.</div>':'')+
        '<div class="edstage"><canvas></canvas></div>'+
        '<div class="edtools"><div class="edrow"><span class="edgrp" id="edT">'+
        [['panah','Panah','panah'],['oval','Lingkaran','lingkaran'],['kotak','Kotak','kotak'],['pena','Pena','pena']].map(function(t){return '<button type="button" class="ic'+(t[0]===tool?' on':'')+'" data-t="'+t[0]+'" aria-label="'+t[1]+'" title="'+t[1]+'">'+ic(t[2])+'</button>'}).join('')+'</span>'+
        '<span class="edgrp"><button type="button" class="ic" data-e="undo" aria-label="Urungkan" title="Urungkan">'+ic('urungkan')+'</button>'+
        '<button type="button" class="ic" data-e="clear" aria-label="Hapus semua coretan" title="Hapus semua coretan">'+ic('sampah')+'</button></span></div>'+
        '<div class="edrow"><span id="edC">'+EDIT_WARNA.map(function(c,i){return '<button type="button" class="sw'+(i?'':' on')+'" data-c="'+c+'" style="background:'+c+'" aria-label="Warna '+c+'"></button>'}).join('')+'</span></div>'+(o.total>1&&o.n<o.total?'<div class="edrow"><button type="button" data-e="semua">Lewati sisa foto</button></div>':'')+'</div>';
      document.body.appendChild(ov);
      var cv=ov.querySelector('canvas'),x=cv.getContext('2d');cv.width=W;cv.height=H;
      function gbr(sh,c2){
        c2.strokeStyle=c2.fillStyle=sh.c;c2.lineWidth=lw;c2.lineCap=c2.lineJoin='round';
        var a=sh.p[0],b=sh.p[sh.p.length-1];
        if(sh.t==='pena'){c2.beginPath();c2.moveTo(a[0],a[1]);for(var i=1;i<sh.p.length;i++)c2.lineTo(sh.p[i][0],sh.p[i][1]);if(sh.p.length===1)c2.lineTo(a[0]+.1,a[1]);c2.stroke()}
        else if(sh.t==='kotak'){c2.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))}
        else if(sh.t==='oval'){var rx=Math.abs(b[0]-a[0])/2,ry=Math.abs(b[1]-a[1])/2;if(rx<1||ry<1)return;c2.beginPath();c2.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,rx,ry,0,0,Math.PI*2);c2.stroke()}
        else{ // panah: garis dan kepala
          var dx=b[0]-a[0],dy=b[1]-a[1],L2=Math.sqrt(dx*dx+dy*dy);if(L2<3)return;
          var hl=Math.min(L2*.6,lw*5),an=Math.atan2(dy,dx),sp=Math.PI/7;
          c2.beginPath();c2.moveTo(a[0],a[1]);c2.lineTo(b[0],b[1]);c2.stroke();
          c2.beginPath();c2.moveTo(b[0],b[1]);c2.lineTo(b[0]-hl*Math.cos(an-sp),b[1]-hl*Math.sin(an-sp));c2.lineTo(b[0]-hl*Math.cos(an+sp),b[1]-hl*Math.sin(an+sp));c2.closePath();c2.fill();
        }
      }
      function gambar(){x.drawImage(im,0,0,W,H);shapes.forEach(function(sh){gbr(sh,x)});if(cur)gbr(cur,x)}
      gambar();
      function titik(e){var r=cv.getBoundingClientRect();return [Math.max(0,Math.min(W,(e.clientX-r.left)*W/r.width)),Math.max(0,Math.min(H,(e.clientY-r.top)*H/r.height))]}
      cv.addEventListener('pointerdown',function(e){e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}var p=titik(e);cur={t:tool,c:warna,p:[p,p]};gambar()});
      cv.addEventListener('pointermove',function(e){if(!cur)return;var p=titik(e);if(cur.t==='pena')cur.p.push(p);else cur.p[1]=p;gambar()});
      function lepas(){if(!cur)return;shapes.push(cur);cur=null;gambar()}
      cv.addEventListener('pointerup',lepas);cv.addEventListener('pointercancel',lepas);
      function tutup(h){document.removeEventListener('keydown',kb,true);ov.remove();done(h)}
      function kb(e){if(e.key==='Escape'){e.stopPropagation();tutup(null)}}
      document.addEventListener('keydown',kb,true);
      ov.addEventListener('click',function(e){
        var b=e.target.closest('button');if(!b)return;
        var a=b.getAttribute('data-e'),t=b.getAttribute('data-t'),c=b.getAttribute('data-c');
        if(t){tool=t;[].forEach.call(ov.querySelectorAll('#edT button'),function(z){z.classList.toggle('on',z===b)})}
        else if(c){warna=c;[].forEach.call(ov.querySelectorAll('#edC button'),function(z){z.classList.toggle('on',z===b)})}
        else if(a==='undo'){shapes.pop();gambar()}
        else if(a==='clear'){shapes=[];gambar()}
        else if(a==='semua')tutup(false);
        else if(a==='batal')tutup(null);
        else if(a==='ok'){
          if(!shapes.length)return tutup(null);   // tanpa coretan: foto tidak diubah
          var q=[.8,.7,.6],out='';for(var i=0;i<q.length;i++){out=cv.toDataURL('image/jpeg',q[i]);if(out.length*.75<=FOTO_TARGET*1.5)break}
          tutup(out);
        }
      });
    };
    im.src=src;
  });
}
/** Admin: coret foto Before yang sudah tersimpan. Hasil diunggah sebagai foto BARU dan foto asli tetap ada; menghapus foto asli
 * hanya bila Admin menekan "Hapus foto asli" (dipindah ke folder sampah Drive). Tidak ada penghapusan tanpa diminta. */
async function coretTersimpan(zf){
  if(!zf||!isAdmin()||(zf.j!=='before'&&zf.j!=='after'))return;
  var rr=await work('Memuat foto...',function(){return api('foto_data',{ids:[zf.f],w:1280})});
  var src=rr&&rr[0]&&rr[0].data;
  if(!src){if(rr)toast('Foto tidak bisa dimuat dari Drive. Coba lagi.');return}
  var out=await editFoto(src);if(!out)return;
  var up=await work('Menyimpan foto...',function(){return api('foto_unggah',{id:zf.d,jenis:zf.j,mime:'image/jpeg',data:out})});
  if(!up)return;   // gagal (mis. sudah mencapai batas foto): foto lama utuh
  S.pv[up.foto.id]=out;putDefect(up.defect);
  render();fotoEditRefresh();
  toastAksi('Foto hasil coretan ditambahkan. Foto asli tidak dihapus.','Hapus foto asli',async function(){
    var del=await work('Menghapus foto asli...',function(){return api('foto_hapus',{id:zf.d,jenis:zf.j,fotoId:zf.f})});
    if(del){putDefect(del);render();fotoEditRefresh();toast('Foto asli dipindah ke folder sampah Drive.')}
  });
}
/** Tambah foto (Before oleh Admin dan MK, After oleh PJ dan lainnya) ke temuan yang sudah tersimpan: foto disiapkan, ditawari tahap coret, baru diantrekan untuk diunggah. */
async function fotoCoret(did,files,jenis){
  if(S.modal&&S.modal.f)readForm();   // simpan isian dialog sebelum layar memuat menggantikannya
  var siap=[];
  await work('Menyiapkan foto...',async function(){
    for(var i=0;i<files.length;i++){try{var o={};siap.push({d:await prep(files[i],o),tn:o.tn})}catch(e){toast('Foto tidak bisa dibaca. Coba foto lain.')}}
  });
  for(var k=0;k<siap.length;k++){
    var h=await editFoto(siap[k].d,{n:k+1,total:siap.length});
    if(h===false)break;   // Lewati sisa foto: sisanya tetap diunggah apa adanya
    if(h)siap[k].d=h;
  }
  siap.forEach(function(x){var jb={k:nk(),did:did,jenis:jenis||'before',data:x.d,tn:x.tn,st:'wait'};S.up.push(jb);qSave(jb)});
  if(siap.length){upUi(did);upBar();runQueue();fotoEditRefresh()}
}
async function modalFotos(f,files){
  f.pend=(f.pend||0)+files.length;mphRefresh();
  var baru=[];   // foto yang baru siap pada panggilan ini; masing-masing ditawari tahap coret
  for(var i=0;i<files.length;i++){
    if(desk()&&!f.tglExif){var ex=await exifTgl(files[i]);if(ex){f.tgl=ex;f.tglExif=true;var md=$('mD');if(md)md.value=ex;var nt=$('mtx');if(nt)nt.innerHTML=wTglNote(f)}}
    try{var x=await prep(files[i]);if(S.modal&&S.modal.f===f){f.files.push(x);baru.push(x)}}catch(e){toast('Foto tidak bisa dibaca. Coba foto lain.')}
    f.pend--;if(S.modal&&S.modal.f===f)mphRefresh();
  }
  /* Tahap coret: setiap foto baru dibuka di editor supaya penanda (panah, lingkaran) tidak terlewat. Lewati = foto apa adanya. */
  for(var k=0;k<baru.length;k++){
    if(!(S.modal&&S.modal.f===f))break;
    var hs=await editFoto(baru[k],{n:k+1,total:baru.length});
    if(hs===false)break;
    if(hs&&S.modal&&S.modal.f===f){var ix=f.files.indexOf(baru[k]);if(ix>=0){f.files[ix]=hs;mphRefresh()}}
  }
}
/* ---------- form temuan: lokasi, elemen, titik ---------- */
var L=window.LOGIKA;
var BID_RUANG={Arsitektur:1,MEEP:1};   // bidang yang bekerja per ruangan; selain itu memakai lokasi umum

/* ----- registri (terbentuk sendiri dari isian pengguna) ----- */
function regDaftar(jenis,a,b){
  var d={},R=S.reg||{};
  function add(nama,n,t,extra){var k=L.kunci(nama);if(!k&&k!=='')return;if(!d[k])d[k]={nama:nama,n:n||0,t:t?(Date.parse(t)||0):0};if(extra)for(var x in extra)d[k][x]=extra[x]}
  if(jenis==='kel')(R.kelompok||[]).forEach(function(e){if(L.kunci(e.area)===L.kunci(a))add(e.k,e.n,e.t)});
  else if(jenis==='kode')(R.kode||[]).forEach(function(e){if(L.kunci(e.area)===L.kunci(a)&&e.k===b)add(e.n,e.pakai,e.t)});
  else if(jenis==='elemen')(R.elemen||[]).forEach(function(e){if(e.bidang===a)add(e.nama,e.pakai,e.t,{mode:e.mode})});
  else if(jenis==='ruang'){var kb=L.kunciLantai(b);S.rooms.forEach(function(r){if(L.kunci(r.gedung)===L.kunci(a)&&(r.lantai===b||L.kunciLantai(r.lantai)===kb)&&!r.bidang)add(r.nama,r.total,0,{id:r.id})})}
  else if(jenis==='teks')Object.keys(S.defects).forEach(function(rid){S.defects[rid].forEach(function(x){if(x.gedung===a&&x.td&&x.td.m==='teks'&&x.td.t){add(x.td.t,1,0)}})});
  return d;
}
function regPem(area,k){var e=((S.reg||{}).kelompok||[]).filter(function(x){return L.kunci(x.area)===L.kunci(area)&&x.k===k})[0];return e?e.pem:undefined}
function fModeElemen(f){var e=((S.reg||{}).elemen||[]).filter(function(x){return x.bidang===f.bidang&&L.kunci(x.nama)===L.kunci(f.elemen)})[0];return e&&e.mode||null}
/** Setelah simpan: perbarui registri lokal seperti yang dilakukan server, supaya form berikutnya langsung memakainya. */
function regTerapkan(res,f){
  if(!S.reg)return;
  var now=new Date().toISOString().slice(0,19),area=res.gedung,td=res.td;
  var cari=function(arr,fn){return arr.filter(fn)[0]};
  if(td&&(td.m==='grid'||td.m==='kode')){
    var items=td.m==='grid'?(td.a||[]).concat(td.b||[]):[{k:td.k,n:td.n}];
    items.forEach(function(it){
      if(it.k){var ke=cari(S.reg.kelompok,function(x){return L.kunci(x.area)===L.kunci(area)&&x.k===it.k});
        if(ke){ke.n=(ke.n||0)+1;ke.t=now}else S.reg.kelompok.push({area:area,k:it.k,pem:(f&&f.pemBaru&&f.pemBaru[it.k]!==undefined)?f.pemBaru[it.k]:'-',n:1,t:now})}
      var ko=cari(S.reg.kode,function(x){return L.kunci(x.area)===L.kunci(area)&&x.k===it.k&&x.n===it.n});
      if(ko){ko.pakai=(ko.pakai||0)+1;ko.t=now}else S.reg.kode.push({area:area,k:it.k,n:it.n,pakai:1,t:now});
    });
  }
  if(res.elemen){
    var el=cari(S.reg.elemen,function(x){return x.bidang===res.bidang&&L.kunci(x.nama)===L.kunci(res.elemen)});
    if(el){el.pakai=(el.pakai||0)+1;el.t=now;if(td&&td.m)el.mode=td.m}else S.reg.elemen.push({bidang:res.bidang,nama:res.elemen,mode:(td&&td.m)||'',pakai:1,t:now});
  }
  lsSet('dl-reg-'+S.paket.id,JSON.stringify(S.reg));
}
async function muatRegistri(){
  try{S.reg=await api('registri_daftar');S.regOk=true;lsSet('dl-reg-'+S.paket.id,JSON.stringify(S.reg))}
  catch(e){if(e&&e.server&&/Aksi tidak dikenal|penyiapan/i.test(e.message)){S.regOk=false;S.reg=null}}
}

/* ----- kotak pilihan (combobox) ----- */
var AKTIFCB=null,IDXCB=-1;
function cbSumber(id){
  var f=S.modal.f,a=f.gedung,m=/^([ab])(k|n)(1|2)$/.exec(id);
  if(id==='gedung'||id==='lantai'){
    var T0=tree(),LB0=labelBidang(f.bidang),d0={},sk={},mg=masterAktif(),add=function(n,o){
      var kk=id==='lantai'?L.kunciLantai(n):L.kunci(n);if(!L.rapi(n)||sk[kk])return;sk[kk]=1;d0[L.kunci(n)]={nama:n,n:0,t:0,o:o}};   // daftar resmi dulu (urutan aslinya), nama lama sesudahnya
    if(id==='gedung'){if(mg)S.master.gedung.forEach(function(n,i){add(n,i)});T0.forEach(function(g){add(g.nama,1000)})}
    else{masterLantaiDaftar(f.gedung).forEach(function(n,i){add(n,i)});var g0=T0.filter(function(x){return L.kunci(x.nama)===L.kunci(f.gedung)})[0];if(g0)g0.lantai.forEach(function(l){add(l.nama,1000)})}
    var fn=id==='gedung'?L.namaGedung:L.namaLantai,nm=id==='gedung'?LB0.area:LB0.level,tambah=nm.toLowerCase(),norm=function(v){var r=fn(v);return r.ok?r.val:null},galat=function(v){var r=fn(v);return r.ok?'':r.err};
    if(mg&&id==='gedung'){   // gedung baru hanya lewat Admin (tab Kelola)
      tambah=null;norm=function(v){return masterGedung(v)||null};
      galat=function(v){return masterGedung(v)?'':nm+' "'+L.rapi(v)+'" belum ada di daftar. Pilih dari daftar; yang baru ditambahkan Admin di tab Kelola.'};
    }else if(mg&&id==='lantai'&&masterLantaiDaftar(f.gedung).length&&!isAdmin()){   // lantai di luar daftar: Admin saja
      tambah=null;norm=function(v){var r=fn(v);return r.ok?(masterLantai(f.gedung,v)||null):null};
      galat=function(v){var r=fn(v);return !r.ok?r.err:masterLantai(f.gedung,v)?'':nm+' "'+r.val+'" tidak ada di daftar '+f.gedung+'. Pilih dari daftar; yang baru ditambahkan Admin.'};
    }
    return {d:d0,fuzzy:true,urut:mg?'asli':'alami',tambah:tambah,norm:norm,galat:galat,kanon:id==='lantai'?L.kunciLantai:null};
  }
  if(id==='ruang')return {d:regDaftar('ruang',f.gedung,f.lantai),fuzzy:true,urut:'frek',tambah:'ruangan',norm:function(v){var r=L.namaRuangan(v);return r.ok?r.val:null},galat:function(v){var r=L.namaRuangan(v);return r.ok?'':r.err}};
  if(id==='elemen')return {d:regDaftar('elemen',f.bidang),fuzzy:true,urut:'frek',tambah:'elemen',norm:function(v){return L.rapi(v)}};
  if(id==='teks')return {d:regDaftar('teks',a),fuzzy:true,urut:'frek',tambah:null,norm:function(v){return L.rapi(v)}};
  if(id==='kdk'||(m&&m[2]==='k'))return {d:regDaftar('kel',a),fuzzy:false,urut:'frek',tambah:'kelompok',norm:function(v){var r=L.kelompok(v);return r.ok?r.val:null}};
  var kField=(id==='kdn')?f.kd.k:(m?(m[3]==='2'&&L.rapi(f[m[1]].k2)?f[m[1]].k2:f[m[1]].k1):'');
  var kk=L.kelompok(kField||'');
  return {d:regDaftar('kode',a,kk.ok?kk.val:''),fuzzy:false,urut:'alami',pref:(m?(m[1]==='a'?'huruf':'angka'):null),tambah:'kode',norm:function(v){var r=L.kode(v);return r.ok?r.val:null}};
}
function cbHtml(id,ph,val){
  var mx=id==='ruang'||id==='gedung'?80:id==='elemen'?60:id==='teks'?100:id==='lantai'?40:10,cap=(id==='gedung'||id==='lantai'||id==='ruang')?'words':'off';
  return '<div class="ck"><input type="text" id="'+id+'" data-cb="'+id+'" maxlength="'+mx+'" placeholder="'+ph+'" autocomplete="off" autocapitalize="'+cap+'" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="'+id+'_l" value="'+esc(val)+'"><div class="ckl hide" id="'+id+'_l" role="listbox"></div></div>';
}
function cbOpsi(id,q){
  var s=cbSumber(id),all=Object.keys(s.d).map(function(k){return s.d[k]}),kq=L.kunci(q),out=[];
  var tipe=function(n){return /^[0-9]/.test(n)?'angka':'huruf'};
  var urut=s.urut==='asli'?function(x,y){return ((x.o||0)-(y.o||0))||L.bandingAlami(x.nama,y.nama)}:s.urut==='alami'?function(x,y){if(s.pref){var px=tipe(x.nama)===s.pref,py=tipe(y.nama)===s.pref;if(px!==py)return px?-1:1}return L.bandingAlami(x.nama,y.nama)}:function(x,y){return (y.n-x.n)||(y.t-x.t)||L.bandingNama(x.nama,y.nama)};
  if(!kq)out=all.slice().sort(urut).slice(0,(s.urut==='alami'||s.urut==='asli')?40:6).map(function(e){return {e:e}});
  else{
    var sk=all.map(function(e){var k=L.kunci(e.nama),sc=(k===kq||(s.kanon&&s.kanon(e.nama)===s.kanon(q)))?0:k.indexOf(kq)===0?1:k.indexOf(kq)>=0?2:(s.fuzzy&&kq.length>=4&&(L.jarak(kq,k)<=1||(k.length>=4&&kq.indexOf(k)===0)))?3:9;return {e:e,sc:sc}})
      .filter(function(x){return x.sc<9}).sort(function(x,y){return (x.sc-y.sc)||urut(x.e,y.e)});
    out=sk.slice(0,8).map(function(x){return {e:x.e,mirip:x.sc===3}});
  }
  var ada=kq&&all.some(function(e){return L.kunci(e.nama)===kq||(s.kanon&&s.kanon(e.nama)===s.kanon(q))}),nv=kq?s.norm(q):null;
  return {opsi:out,tambah:(kq&&!ada&&s.tambah&&nv)?{nilai:nv,label:s.tambah}:null,galat:(kq&&!ada&&s.galat&&!nv)?s.galat(q):''};
}
function cbIsi(id,q){
  var r=cbOpsi(id,q),box=$(id+'_l'),el=$(id);if(!box)return;
  var h=r.opsi.map(function(o,i){return '<div class="cko" role="option" id="'+id+'_o'+i+'" aria-selected="false" data-id="'+id+'" data-v="'+esc(o.e.nama)+'"><span>'+esc(o.e.nama)+(o.mirip?' <small>(mirip)</small>':'')+'</span>'+(o.e.n?'<small>'+o.e.n+'</small>':'')+'</div>'}).join('');
  if(r.tambah)h+='<div class="cko add" role="option" data-id="'+id+'" data-tambah="1" data-v="'+esc(r.tambah.nilai)+'">+ Tambah '+esc(r.tambah.label)+' "'+esc(r.tambah.nilai)+'"</div>';
  if(r.galat)h+='<div class="cko"><small style="color:var(--bad,#c0392b);white-space:normal">'+esc(r.galat)+'</small></div>';
  if(!h)h='<div class="cko"><small>Belum ada. Ketik untuk menambah.</small></div>';
  box.innerHTML=h;box.classList.remove('hide');el.setAttribute('aria-expanded','true');
  cbPosisi(id);
}
/** Buka ke atas bila ruang di bawah kotak tidak cukup (mis. keyboard HP muncul). Dihitung ulang saat viewport berubah. */
function cbPosisi(id){
  var el=$(id),box=$(id+'_l');if(!el||!box||box.classList.contains('hide'))return;
  var vv=window.visualViewport,dasar=vv?(vv.offsetTop+vv.height):window.innerHeight,rc=el.getBoundingClientRect(),bawah=dasar-rc.bottom;
  box.classList.toggle('up',bawah<270&&rc.top>bawah);
}
function cbBuka(id){
  var el=$(id);if(!el)return;if(AKTIFCB&&AKTIFCB!==id)cbTutup();AKTIFCB=id;IDXCB=-1;
  var v=el.value,s=cbSumber(id),pasti=L.kunci(v)&&!!s.d[L.kunci(v)];
  cbIsi(id,pasti?'':v);
}
function cbTutup(){if(AKTIFCB){var b=$(AKTIFCB+'_l'),e=$(AKTIFCB);if(b)b.classList.add('hide');if(e)e.setAttribute('aria-expanded','false')}AKTIFCB=null;IDXCB=-1}
function cbPilih(id,nilai,tambah){
  var f=S.modal.f,el=$(id);el.value=nilai;el.closest('.row')&&el.closest('.row').classList.remove('bad');
  if(tambah)f.conf[id]=L.kunci(nilai);else delete f.conf[id];
  cbTutup();fBaca();
  if(id==='gedung'||id==='lantai'){
    f.ruang='';delete f.conf.ruang;var er=$('ruang');if(er)er.value='';
    if(id==='gedung'){var gx=tree().filter(function(x){return x.nama===f.gedung})[0],ok=(gx&&gx.lantai.some(function(l){return l.nama===f.lantai}))||!!masterLantai(f.gedung,f.lantai);
      if(!ok){f.lantai='';var elx=$('lantai');if(elx){elx.value='';elx.focus()}}}
    else if(er&&!L.rapi(er.value))er.focus();
    fSegar();return;
  }
  if(id==='elemen'){var mm=fModeElemen(f);if(mm&&mm!==f.mode){f.mode=mm;fRender();return}}
  fSegar();
  var nx={ak1:'an1',bk1:'bn1',kdk:'kdn'}[id];                 // setelah Kelompok, lompat ke kotak Kode
  if(nx&&$(nx)&&!L.rapi($(nx).value))$(nx).focus();
}
function cbAktif(){return !!AKTIFCB}

/* ----- keadaan form ----- */
function fBuat(d,ex){
  var T=tree(),s=ensureSel(T)||{g:{nama:''},l:{nama:''},r:{id:''}},cur=s.r,reg=S.regOk;
  var f={id:null,gedung:s.g.nama,lantai:s.l.nama,bidang:BIDANG[0],tingkat:TINGKAT[0],tgl:today(),uraian:'',files:[],lama:!reg,
    ruanganId:cur.id,lok:'ruang',ruang:'',elemen:'',mode:'tanpa',a:{k1:'',n1:'',k2:'',n2:''},b:{k1:'',n1:'',k2:'',n2:''},kd:{k:'',n:''},teks:'',pemBaru:{},conf:{},kunciBidang:false,lokasiTeks:'',step:d?null:'lokasi',xk:{},baru:null,abc:false,detail:''};
  if(d){
    f.id=d.id;f.gedung=d.gedung;f.lantai=d.lantai;f.bidang=d.bidang;f.tingkat=d.tingkat;f.tgl=d.tglTemuan||today();f.uraian=d.uraian;f.ruanganId=d.ruanganId;f.lokasiTeks=d.ruangan;f.memoId=d.memoId||'';f.ver=d.verifikasi||'';
    var rm=S.rooms.filter(function(r){return r.id===d.ruanganId})[0];f.kunciBidang=!!(rm&&rm.bidang);
    f.elemen=d.elemen||'';f.detail=d.detail||'';
    var td=d.td;
    if(td){f.mode=td.m||'tanpa';
      if(td.m==='grid'){[['a','a'],['b','b']].forEach(function(p){var arr=td[p[0]]||[];f[p[1]]={k1:arr[0]?arr[0].k:'',n1:arr[0]?arr[0].n:'',k2:arr[1]?arr[1].k:'',n2:arr[1]?arr[1].n:''}})}
      else if(td.m==='kode')f.kd={k:td.k,n:td.n};
      else if(td.m==='teks')f.teks=td.t||'';
    }
  }else if(ex){
    ['bidang','gedung','lantai','lok','ruang','elemen','mode'].forEach(function(k){f[k]=ex[k]});f.a.k1=ex.a.k1;f.b.k1=ex.b.k1;f.kd.k=ex.kd.k;
  }else{
    var lb=lsGet('dl-bidang');f.bidang=BIDANG.indexOf(lb)>=0?lb:BIDANG[0];
    if(cur.bidang)f.bidang=cur.bidang;
    fAtur(f,cur);
  }
  f.satu=!f.lama&&(!!d||!desk());
  return f;
}
/** Bawaan Lokasi dan bentuk Titik menurut bidang. cur = ruangan yang sedang dibuka di layar Form. */
function fAtur(f,cur){
  if(BID_RUANG[f.bidang]){f.lok='ruang';f.ruang=(cur&&!cur.bidang)?cur.nama:'';f.mode='tanpa'}
  else{f.lok='umum';f.mode=f.bidang==='Struktur'?'grid':'teks'}
}
function openForm(d){
  try{
    var s=ensureSel(tree());
    if(!s&&d)return;
    if(!s&&!S.roomsReady){toast('Daftar lokasi belum dimuat. Tunggu sebentar lalu coba lagi.');loadRooms();return}   // jangan diam saja
    openModal({t:'temuan',f:fBuat(d,null)});
  }catch(e){toast('Tidak bisa membuka formulir: '+(e&&e.message||e))}
}
function fRender(){ // gambar ulang tanpa kehilangan posisi gulir
  var sh=overlay.querySelector('.sheet'),sc=sh?sh.scrollTop:0;
  renderOverlay();
  var sh2=overlay.querySelector('.sheet');if(sh2)sh2.scrollTop=sc;
  fSegar();
}
function fBaca(){
  var f=S.modal&&S.modal.f;if(!f)return;
  ['ruang','elemen','teks'].forEach(function(k){var e=$(k);if(e)f[k]=e.value});
  if($('mL'))f.detail=$('mL').value;
  ['a','b'].forEach(function(ax){['k1','n1','k2','n2'].forEach(function(x){var e=$(ax+x);if(e)f[ax][x]=e.value})});
  if($('kdk'))f.kd.k=$('kdk').value;if($('kdn'))f.kd.n=$('kdn').value;
  var eg=$('gedung'),el=$('lantai');
  if(eg){
    f.gedung=eg.value;var T=tree(),gm=T.filter(function(x){return L.kunci(x.nama)===L.kunci(f.gedung)})[0];
    var gmM=masterGedung(f.gedung);
    f.gMode=!gm&&!gmM&&!!L.rapi(f.gedung);if(gmM)f.gedung=gmM;else if(gm)f.gedung=gm.nama;
    if(el){
      f.lantai=el.value;
      var nl0=L.namaLantai(el.value);if(nl0.ok&&nl0.detail&&!f.detail){f.detail=nl0.detail;var mi=$('mL');if(mi&&!mi.value)mi.value=nl0.detail}   // "Split level Elv.37.500": elevasi jadi Lokasi detail
      var lmM=masterLantai(f.gedung,f.lantai),lm=gm&&gm.lantai.filter(function(x){return L.kunciLantai(x.nama)===L.kunciLantai(f.lantai)})[0];
      f.lMode=!lm&&!lmM&&!!L.rapi(f.lantai);if(lmM)f.lantai=lmM;else if(lm)f.lantai=lm.nama;
    }
  }
  if($('mB'))f.bidang=$('mB').value;if($('mT'))f.tingkat=$('mT').value;if($('mD'))f.tgl=$('mD').value||today();if($('mU'))f.uraian=$('mU').value;
}
function readForm(){fBaca()}

/* ----- titik ----- */
function fSumbu(f,ax,nama,final){
  var x=f[ax];if(!L.rapi(x.n1)&&!L.rapi(x.n2)&&(!L.rapi(x.k1)||(!f.id&&!f.lama)))return {ok:true,arr:[]};
  if(!L.rapi(x.n1)&&!final)return {ok:true,arr:[],tunda:true};
  var k1=L.kelompok(x.k1),n1=L.kode(x.n1);if(!k1.ok)return {ok:false,err:nama+': '+k1.err};if(!n1.ok)return {ok:false,err:nama+' "dari": '+n1.err};
  var arr=[{k:k1.val,n:n1.val}];
  if(L.rapi(x.n2)){var k2=L.rapi(x.k2)?L.kelompok(x.k2):{ok:true,val:k1.val},n2=L.kode(x.n2);if(!k2.ok)return {ok:false,err:nama+': '+k2.err};if(!n2.ok)return {ok:false,err:nama+' "sampai": '+n2.err};arr.push({k:k2.val,n:n2.val})}
  return L.cekRentang(arr,nama);
}
function fPem(f,k){var p=regPem(f.gedung,k);return p!==undefined?p:(f.pemBaru[k]!==undefined?f.pemBaru[k]:'-')}
function fTitik(f,final){ // {ok, teks, err, data}; data = bentuk yang dikirim ke server
  var pem=function(k){return fPem(f,k)};
  if(f.mode==='tanpa')return {ok:true,teks:'',data:null};
  if(f.mode==='teks'){var t=L.rapi(f.teks);return {ok:true,teks:t,data:t?{t:t}:null}}
  if(f.mode==='kode'){
    if(!L.rapi(f.kd.n))return (final&&L.rapi(f.kd.k)&&(f.id||f.lama))?{ok:false,err:'Kode wajib diisi.'}:{ok:true,teks:'',data:null};
    var k=L.kelompok(f.kd.k),n=L.kode(f.kd.n);if(!k.ok)return {ok:false,err:k.err};if(!n.ok)return {ok:false,err:n.err};
    return {ok:true,teks:L.label(k.val,pem(k.val),n.val),data:{k:k.val,n:n.val}};
  }
  var a=fSumbu(f,'a','Sumbu 1',final),b=fSumbu(f,'b','Sumbu 2',final);
  if(!a.ok)return a;if(!b.ok)return b;
  if(!a.arr.length&&!b.arr.length)return {ok:true,teks:'',data:null};
  return {ok:true,teks:L.teksGrid({a:a.arr,b:b.arr},pem),data:{a:a.arr,b:b.arr}};
}
function fKelompokBaru(f){ // Kelompok yang dikonfirmasi baru lewat "+ Tambah": pemisahnya ditanyakan sekali
  var out={};
  if(!f.id&&!f.lama){
    (f.mode==='grid'?[f.a.k1,f.b.k1]:f.mode==='kode'?[f.kd.k]:[]).forEach(function(k){var r=L.kelompok(k||'');if(r.ok&&r.val&&!regDaftar('kel',f.gedung)[L.kunci(r.val)])out[r.val]=1});
    return Object.keys(out);
  }
  ['ak1','ak2','bk1','bk2','kdk'].forEach(function(id){
    if(!$(id)||!f.conf[id])return;var r=L.kelompok($(id).value);
    if(r.ok&&r.val&&!regDaftar('kel',f.gedung)[L.kunci(r.val)])out[r.val]=1;
  });
  return Object.keys(out);
}
function fSegar(){
  var f=S.modal&&S.modal.f;if(!f||f.lama)return;
  fBaca();
  var t=fTitik(f,false),p=$('fprev');
  if(p){p.className='note'+(t.ok?'':' bad');p.innerHTML=t.ok?(t.teks?'Titik: <b>'+esc(t.teks)+'</b>':'Titik belum diisi'):esc(t.err)}
  var pr=$('fpem');
  if(pr)pr.innerHTML=fKelompokBaru(f).map(function(k){
    return '<div class="note" style="padding:8px 0 4px">Kelompok <b>'+esc(k)+'</b> baru. Tampil sebagai:</div><div class="pbtn" style="padding-top:0">'+[['-',k+'-C'],['.',k+'.C'],['',k+'C']].map(function(o){return '<button type="button" class="pill'+(fPem(f,k)===o[0]?' ok':'')+'" data-act="fpem" data-k="'+esc(k)+'" data-v="'+o[0]+'">'+esc(o[1])+'</button>'}).join('')+'</div>'}).join('');
}

/* ----- tampilan ----- */
function fAxisHtml(f,ax,judul){
  var x=f[ax],kk=L.kelompok(x.k1),sama=kk.ok&&kk.val?kk.val+' (sama)':'Kelompok';
  return '<div class="note" style="padding:10px var(--margin) 0;font-weight:600">'+judul+' · dari</div><div class="two"><div class="row"><span class="lbl">Kelompok</span>'+cbHtml(ax+'k1','Mis. T3',x.k1)+'</div><div class="row"><span class="lbl">Kode</span>'+cbHtml(ax+'n1','Mis. C',x.n1)+'</div></div>'+
    '<div class="note" style="padding:6px var(--margin) 0">sampai (opsional)</div><div class="two"><div class="row"><span class="lbl">Kelompok</span>'+cbHtml(ax+'k2',sama,x.k2)+'</div><div class="row"><span class="lbl">Kode</span>'+cbHtml(ax+'n2','Kode',x.n2)+'</div></div>';
}
/* Pilih Gedung dan Lantai yang ada, atau buat baru (ADMIN dan MK). Nama yang mirip dengan yang sudah ada ditanyakan oleh server (dialog "mirip"). */
function fLokasiHtml(f){
  var LB=labelBidang(f.bidang);
  return '<div class="row"><span class="lbl">'+esc(LB.area)+'</span>'+cbHtml('gedung','Ketik atau pilih '+LB.area.toLowerCase(),f.gedung)+'</div>'+
    '<div class="row"><span class="lbl">'+esc(LB.level)+'</span>'+cbHtml('lantai','Ketik atau pilih '+LB.level.toLowerCase(),f.lantai)+'</div>';
}

/* ----- tambah temuan bertahap (M1 Lokasi, M2 Foto, M3 Detail, M4 Elemen, M5-M7 Titik) ----- */
var KODE_BID={Arsitektur:'ARS',Struktur:'STR',MEEP:'MEEP',Infrastruktur:'INF',Lansekap:'LAN',HSE:'HSE',BGH:'BGH'};
function wLokTeks(f){return f.gedung+' \u203a '+f.lantai+' \u203a '+(f.lok==='ruang'?(f.ruang||'...'):'Umum - '+f.bidang)}
function wTerakhir(){
  try{var o=JSON.parse(lsGet('dl-lok')||'null');if(!o||!o.gedung)return null;
    var g=tree().filter(function(x){return x.nama===o.gedung})[0];if(!g||!g.lantai.some(function(l){return l.nama===o.lantai}))return null;
    return o}catch(e){return null}
}
function wHead(f,judul,balik){
  return '<div class="wh">'+(balik?'<button type="button" class="btn-ic" data-act="wback" aria-label="Kembali">'+ic('x')+'</button>':'')+'<h2>'+esc(judul)+'</h2></div>';
}
function fWizHtml(m){
  if(!desk()||!m.f||m.f.id)return fWizHtml0(m);
  var P='<div class="ov" data-act="modalbg"><div class="sheet wz" role="dialog" aria-label="Tambah temuan">',f=m.f,inner;
  if(f.step==='lokasi'||f.step==='detail'||f.step==='foto'){
    // satu layar: Lokasi (atas) dan Detail (bawah), tombol simpan di bawah
    f.step='lokasi';var a=fWizHtml0(m);f.step='detail';var b=fWizHtml0(m);
    var ia=a.slice(P.length,a.length-12).replace(/<button type="button" class="btn" data-act="wgo" data-v="foto">[^<]*<\/button>$/,'');
    var ib=b.slice(P.length,b.length-12).replace(/^<div class="wh">.*?<\/div><div class="wl2">.*?<\/span><\/div><\/div>/,'').replace(/<button type="button" class="btn" data-act="msimpan">.*$/,'');
    inner=ia+'<div class="wsep"></div>'+ib+'<div class="wfoot"><button type="button" class="btn sec" data-act="wtutup">Batal</button><button type="button" class="btn soft" data-act="msimpanlagi">Simpan &amp; tambah lagi</button><button type="button" class="btn" data-act="msimpan">Simpan temuan</button></div>';
  }else{
    var h0=fWizHtml0(m);
    if(h0.indexOf(P)!==0)return h0;
    inner=h0.slice(P.length,h0.length-12);
  }
  var kiri='<aside class="wzl"><div class="cap">Foto temuan</div><div id="mph" class="phs">'+mphHtml(f)+'</div>'+
    '<div class="dropz" id="dropz">Seret foto ke sini<br><small>atau</small><br><button type="button" class="btn sec sm" data-act="mfoto">'+ic('img')+'Pilih dari komputer</button></div>'+
    '<label class="row"><span class="lbl">Tanggal temuan</span><input type="date" id="mD" value="'+esc(f.tgl)+'"></label><div class="note" id="mtx">'+wTglNote(f)+'</div></aside>';
  return P+'<div class="wzcols">'+kiri+'<div class="wzr">'+inner+'</div></div></div></div>';
}
function fWizHtml0(m){
  var f=m.f,h='<div class="ov" data-act="modalbg"><div class="sheet wz" role="dialog" aria-label="Tambah temuan">';
  if(desk()&&f.step==='foto')f.step='detail';
  if(f.step==='lokasi'){
    h+='<div class="wh"><h2>Tambah temuan</h2><button type="button" class="btn-ic wx" data-act="wtutup" aria-label="Tutup">'+ic('x')+'</button></div><div class="chips wb" role="group" aria-label="Bidang">'+BIDANG.map(function(b){return '<button type="button" class="chip'+(b===f.bidang?' on':'')+'" data-act="wbid" data-v="'+esc(b)+'">'+esc(KODE_BID[b]||b)+'</button>'}).join('')+'</div>';
    var o=wTerakhir();
    if(o&&!(o.bidang===f.bidang&&o.gedung===f.gedung&&o.lantai===f.lantai&&(o.lok==='ruang'?o.ruang===f.ruang:true)))
      h+='<button type="button" class="pakai" data-act="wpakai"><span>'+esc(o.gedung+' \u203a '+o.lantai+' \u203a '+(o.lok==='ruang'?o.ruang:'Umum - '+o.bidang))+'</span><b>Pakai</b></button>';
    h+=fLokasiHtml(f);
    if(f.lok==='ruang')h+='<div class="row"><span class="lbl">'+esc(labelBidang(f.bidang).lokasi)+'</span>'+cbHtml('ruang','Ketik atau pilih nama ruangan',f.ruang)+'</div>'+
      '<div class="note">Ketuk untuk memilih. Ketik untuk menambah yang baru; nama yang mirip akan ditandai.</div>';
    else h+='<div class="row fix"><span class="lbl">Lokasi</span><div>Umum - '+esc(f.bidang)+'</div><span class="oto">otomatis</span></div>'+
      '<div class="note">'+esc(f.bidang)+' tidak memakai ruangan, jadi lokasinya otomatis.'+(BID_RUANG[f.bidang]?'':' Posisi tepatnya diisi lewat Titik di langkah detail.')+'</div>';
    h+='<button type="button" class="btn" data-act="wgo" data-v="foto">'+(desk()?'Lanjut: detail':'Lanjut: foto')+'</button>';
  }else if(f.step==='foto'){
    h+=wHead(f,'Foto Before',true)+'<div class="note wl">'+esc(KODE_BID[f.bidang]||f.bidang)+' &middot; '+esc(wLokTeks(f))+'</div>'+
      '<div class="note">Ambil satu atau beberapa foto kondisi sebelum perbaikan. Foto dipotong otomatis ke rasio 4:3 (landscape).</div>'+
      '<div id="mph" class="phs">'+mphHtml(f)+'</div>'+
      '<button type="button" class="btn sec" data-act="mfoto" data-cam="1">'+ic('cam')+'Ambil foto (kamera)</button>'+
      '<button type="button" class="btn out" data-act="mfoto">'+ic('img')+'Pilih dari galeri</button>'+
      '<button type="button" class="btn" data-act="wgo" data-v="detail">Lanjut: detail</button>';
  }else if(f.step==='elemen'){
    h+=wHead(f,'Elemen \u00b7 '+(KODE_BID[f.bidang]||f.bidang),true)+
      '<div class="sbar"><span class="si">'+ic('search')+'</span><input type="text" id="elq" class="sinp" maxlength="60" autocomplete="off" placeholder="Cari atau ketik elemen baru" value="'+esc(f.elq||'')+'"></div><div id="ell">'+wElemenList(f)+'</div>';
  }else if(f.step==='titik'){
    var mm=fModeElemen(f);
    h+=wHead(f,'Titik'+(f.elemen?' \u00b7 '+f.elemen:''),true)+'<div class="seg in" role="group" aria-label="Bentuk titik">'+
      [['grid','Grid'],['kode','Kode'],['teks','Teks'],['tanpa','Tanpa']].map(function(o){return '<button type="button" data-act="fmode" data-v="'+o[0]+'"'+(f.mode===o[0]?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div>';
    if(mm&&mm!==f.mode)h+='<div class="note">Terakhir untuk "'+esc(f.elemen)+'" dipakai bentuk '+esc(mm)+'.</div>';
    if(f.mode==='grid')h+=wSumbuHtml(f,'a','Sumbu 1')+wSumbuHtml(f,'b','Sumbu 2');
    if(f.mode==='kode')h+=wKodeHtml(f);
    if(f.mode==='teks')h+=wTeksHtml(f);
    h+='<div id="fpem" class="note"></div><div id="fprev" class="note"></div><button type="button" class="btn" data-act="wtitikok">'+(f.mode==='kode'&&L.rapi(f.kd.n)?'Selesai &middot; '+esc(fTitik(f,false).teks||''):'Selesai')+'</button>';
  }else{ // detail
    var tg=fTitik(f,false);
    var all=regDaftar('elemen',f.bidang),arr=Object.keys(all).map(function(k){return all[k]}).sort(function(x,y){return (y.n-x.n)||(y.t-x.t)||L.bandingNama(x.nama,y.nama)}),top=arr.slice(0,4).map(function(e){return e.nama});
    if(f.elemen&&top.every(function(n){return L.kunci(n)!==L.kunci(f.elemen)}))top.unshift(f.elemen);
    h+=wHead(f,'Detail temuan',true)+'<div class="wl2">'+(f.files[0]?'<img alt="" src="'+f.files[0]+'">':'<span class="ph"></span>')+'<div><b>'+esc(wLokTeks(f))+'</b><span class="tag">'+esc(KODE_BID[f.bidang]||f.bidang)+'</span></div></div>'+
      fDetailHtml(f)+'<div class="row dikte" id="mUr"><textarea id="mU" aria-label="Temuan" placeholder="Apa temuannya?">'+esc(f.uraian)+'</textarea></div>'+
      '<div class="cap">Seberapa parah?</div><div class="sev" role="group" aria-label="Tingkat">'+TINGKAT.map(function(x,i){return '<button type="button" class="s'+i+(x===f.tingkat?' on':'')+'" data-act="wsev" data-v="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div>'+
      '<div class="cap">Elemen <small>(opsional)</small></div><div class="epil">'+top.map(function(n){return '<button type="button" class="chip'+(L.kunci(n)===L.kunci(f.elemen)?' on blue':'')+'" data-act="welpick" data-v="'+esc(n)+'">'+esc(n)+'</button>'}).join('')+'<button type="button" class="chip dash" data-act="welbuka">'+(arr.length>=8?'Semua / cari':'+ Elemen lain')+' &rsaquo;</button></div>';
    if(!BID_RUANG[f.bidang])h+='<button type="button" class="row titikrow" data-act="wtitik"><span class="lbl">Titik ('+esc(f.mode)+')</span><div>'+(tg.ok&&tg.teks?esc(tg.teks):'<span class="mute">Belum diisi (opsional)</span>')+'</div><svg class="chev" viewBox="0 0 12 18"><path d="M3 3l6 6-6 6"/></svg></button>';
    h+='<button type="button" class="btn" data-act="msimpan">Simpan</button><button type="button" class="btn sec" data-act="msimpanlagi">Simpan &amp; tambah lagi di sini</button>';
  }
  return h+'</div></div>';
}
function wElemenList(f){
  var q=f.elq||'',r=cbOpsi('elemen',q),h='';
  if(!L.kunci(q)){
    var all=regDaftar('elemen',f.bidang),arr=Object.keys(all).map(function(k){return all[k]}),sering=arr.slice().sort(function(x,y){return (y.n-x.n)||(y.t-x.t)}).slice(0,6);
    if(sering.length)h+='<div class="cap">Sering dipakai</div><div class="epil">'+sering.map(function(e){return '<button type="button" class="chip" data-act="welpick" data-v="'+esc(e.nama)+'">'+esc(e.nama)+(e.n?' '+e.n:'')+'</button>'}).join('')+'</div>';
    arr.sort(function(x,y){return L.bandingNama(x.nama,y.nama)});
    h+='<div class="cap">Semua elemen ('+arr.length+') &middot; A\u2013Z</div>';
    h+=arr.length?'<div class="list">'+arr.map(function(e){return '<button type="button" class="row elrow" data-act="welpick" data-v="'+esc(e.nama)+'"><span>'+esc(e.nama)+'</span><small>'+(e.n||'')+'</small></button>'}).join('')+'</div>':'<div class="note">Belum ada elemen di bidang ini. Ketik untuk menambah.</div>';
  }else{
    h+='<div class="list">'+r.opsi.map(function(o){return '<button type="button" class="row elrow" data-act="welpick" data-v="'+esc(o.e.nama)+'"><span>'+esc(o.e.nama)+(o.mirip?' <small>(mirip)</small>':'')+'</span><small>'+(o.e.n?o.e.n+' temuan':'')+'</small></button>'}).join('')+
      (r.tambah?'<button type="button" class="row elrow add" data-act="weltambah" data-v="'+esc(r.tambah.nilai)+'">+ Tambah elemen "'+esc(r.tambah.nilai)+'"</button>':'')+'</div>';
  }
  return h+'<div class="note">Daftar per bidang. Urut dari yang paling sering dipakai. Memilih elemen akan mengingat bentuk titiknya.</div>';
}
function wStep(s,lewatBaca){   // lewatBaca: isian sudah diatur lewat kode (mis. Pakai), jangan ditimpa isi kotak lama
  var f=S.modal&&S.modal.f;if(!f)return;if(!lewatBaca)fBaca();cbTutup();
  if(f.satu){   // satu dialog: panel Elemen atau Titik dibuka di tempat
    f.bukaEl=(s==='elemen');f.bukaTitik=(s==='titik');fRender();
    var pn=overlay.querySelector(f.bukaEl?'#elsek':f.bukaTitik?'#titiksek':'#none');if(pn&&pn.scrollIntoView)pn.scrollIntoView({block:'nearest'});
    return;
  }
  if(desk()&&(s==='foto'||s==='lokasi'))s='detail';f.step=s;renderOverlay();fSegar();
  var sh=overlay.querySelector('.sheet');if(sh)sh.scrollTop=0;
}
function wLanjutLokasi(f){
  fBaca();
  if(!L.rapi(f.gedung))return fGalat('Isi nama '+labelBidang(f.bidang).area+'.','gedung')||false;
  if(!L.rapi(f.lantai))return fGalat('Isi nama '+labelBidang(f.bidang).level+'.','lantai')||false;
  if(f.lok==='ruang'){
    if(!L.rapi(f.ruang))return fGalat('Pilih atau tambah ruangan.','ruang');
    var bm=fPeriksaDaftar(f);if(bm)return fGalat(bm[1],bm[0]);
  }
  return true;
}
function wPilihElemen(nama){
  var f=S.modal.f;f.elemen=nama;f.elq='';
  var mm=fModeElemen(f);if(mm)f.mode=mm;
  wStep(BID_RUANG[f.bidang]?'detail':'titik');
}

/* ----- Titik bertahap: chip Grid (M5), tombol Kode (M6), Teks (M7) ----- */
function wKelNama(f,k){var d=regDaftar('kel',f.gedung),arr=Object.keys(d).map(function(x){return d[x]}).sort(function(a,b){return (b.n-a.n)||(b.t-a.t)||L.bandingNama(a.nama,b.nama)}).map(function(e){return e.nama}).slice(0,5);
  if(k&&arr.indexOf(k)<0)arr.unshift(k);return arr}
function wKelHtml(f,ax,tanpa){
  var k=ax==='kd'?f.kd.k:f[ax].k1,pil=wKelNama(f,k);
  var h='<div class="kelrow"><span class="kl">Kelompok</span>'+(tanpa?'<button type="button" class="chip'+(!k?' on blue':'')+'" data-act="wkel" data-ax="'+ax+'" data-v="">tanpa</button>':'')+
    pil.map(function(n){return '<button type="button" class="chip'+(n===k?' on blue':'')+'" data-act="wkel" data-ax="'+ax+'" data-v="'+esc(n)+'">'+esc(n)+'</button>'}).join('')+
    '<button type="button" class="chip dash" data-act="wbaru" data-ax="'+ax+'" data-j="kel">+ Baru</button></div>';
  if(f.baru&&f.baru.ax===ax&&f.baru.j==='kel')h+=wBaruHtml('Kelompok baru (mis. T3)',10);
  return h;
}
function wBaruHtml(ph,mx){return '<div class="inl"><input type="text" id="wbaru" maxlength="'+mx+'" autocomplete="off" autocapitalize="characters" placeholder="'+esc(ph)+'"><button type="button" class="chip on blue" data-act="wbarugo">Tambah</button><button type="button" class="chip" data-act="wbarux">Batal</button></div>'}
function wKodeDaftar(f,ax,k){
  var d=regDaftar('kode',f.gedung,k),seen={},out=[];
  var add=function(n){n=L.rapi(n);if(!n||seen[L.kunci(n)])return;seen[L.kunci(n)]=1;out.push(n)};
  Object.keys(d).forEach(function(x){add(d[x].nama)});
  (f.xk[ax+'|'+k]||[]).forEach(add);
  if(ax!=='kd'){add(f[ax].n1);add(f[ax].n2)}
  var pref=ax==='a'?'huruf':ax==='b'?'angka':null,tipe=function(n){return /^[0-9]/.test(n)?'angka':'huruf'};
  return out.sort(function(x,y){if(pref){var px=tipe(x)===pref,py=tipe(y)===pref;if(px!==py)return px?-1:1}return L.bandingAlami(x,y)});
}
function wSumbuHtml(f,ax,judul){
  var x=f[ax],k=x.k1,list=wKodeDaftar(f,ax,k),a=L.rapi(x.n1),b=L.rapi(x.n2),ia=-1,ib=-1;
  list.forEach(function(n,i){if(a&&L.kunci(n)===L.kunci(a))ia=i;if(b&&L.kunci(n)===L.kunci(b))ib=i});
  var info=a?(b?a+' sampai '+b:a):'';
  var h='<div class="sumbu"><div class="sh2"><b>'+esc(judul)+'</b><span>'+esc(info)+'</span></div>'+wKelHtml(f,ax,true)+'<div class="kodes">'+
    list.map(function(n,i){var on=(i===ia||i===ib),mid=(ia>=0&&ib>=0&&i>Math.min(ia,ib)&&i<Math.max(ia,ib));return '<button type="button" class="kc'+(on?' on':mid?' mid':'')+'" data-act="wkod" data-ax="'+ax+'" data-v="'+esc(n)+'">'+esc(n)+'</button>'}).join('')+
    '<button type="button" class="kc dash" data-act="wbaru" data-ax="'+ax+'" data-j="kod" aria-label="Tambah kode">+</button></div>';
  if(f.baru&&f.baru.ax===ax&&f.baru.j==='kod')h+=wBaruHtml('Kode baru (mis. F atau 4)',10);
  return h+'</div>';
}
function wKodeHtml(f){
  var k=f.kd.k,n=L.rapi(f.kd.n),d=regDaftar('kode',f.gedung,k),ada=n&&d[L.kunci(L.kode(n).ok?L.kode(n).val:n)];
  var cod=wKodeDaftar(f,'kd',k),maxN=0;cod.forEach(function(c){if(/^\d+$/.test(c))maxN=Math.max(maxN,parseInt(c,10))});
  var sering=Object.keys(d).map(function(x){return d[x]}).sort(function(a,b){return (b.n-a.n)||L.bandingAlami(a.nama,b.nama)}).slice(0,4).map(function(e){return e.nama}).sort(L.bandingAlami);
  var h=wKelHtml(f,'kd',false)+'<div class="kdisp"><div><span class="lbl">Kode</span><b>'+(n?esc(n):'<i>&ndash;</i>')+'</b></div>'+(n?(ada?'<span class="ok">sudah terdaftar &middot; '+(ada.n||0)+' temuan</span>':'<span class="baru">kode baru</span>'):'')+'</div>';
  h+='<div class="epil">'+sering.map(function(c){return '<button type="button" class="chip'+(L.kunci(c)===L.kunci(n)?' on blue':'')+'" data-act="wkey" data-v="=" data-c="'+esc(c)+'">'+esc(c)+'</button>'}).join('')+(maxN?'<button type="button" class="chip dash" data-act="wkey" data-v="=" data-c="'+(maxN+1)+'">+ '+(maxN+1)+'</button>':'')+'</div>';
  var keys=f.abc?"ABCDEFGHIJKLMNOPQRSTUVWXYZ'.".split(''):['1','2','3','4','5','6','7','8','9'];
  h+='<div class="kpad'+(f.abc?' abc':'')+'">'+keys.map(function(c){return '<button type="button" data-act="wkey" data-v="'+esc(c)+'">'+esc(c)+'</button>'}).join('')+
    '<button type="button" class="fn" data-act="wabc">'+(f.abc?'123':'ABC')+'</button>'+(f.abc?'':'<button type="button" data-act="wkey" data-v="0">0</button>')+'<button type="button" class="fn" data-act="wkey" data-v="bs" aria-label="Hapus">&#9003;</button></div>';
  return h;
}
function wTeksHtml(f){
  return '<div class="row dikte"><div style="flex:1;min-width:0"><span class="lbl">Posisi (nama jalan, STA, zona)</span><input type="text" id="teks" maxlength="100" autocomplete="off" placeholder="Mis. STA 2+3" value="'+esc(f.teks)+'"></div></div><div id="tkl">'+wTeksSaran(f)+'</div>'+
    '<div class="note">Teks bebas. Tidak perlu dipilih dari daftar. Saran hanya agar penulisan seragam.</div>';
}
function wTeksSaran(f){
  var d=regDaftar('teks',f.gedung),q=L.kunci(f.teks),arr=Object.keys(d).map(function(x){return d[x]}).filter(function(e){return !q||L.kunci(e.nama).indexOf(q)>=0}).sort(function(a,b){return (b.n-a.n)||L.bandingNama(a.nama,b.nama)}).slice(0,6);
  return arr.length?'<div class="list">'+arr.map(function(e){return '<button type="button" class="row elrow" data-act="wteks" data-v="'+esc(e.nama)+'"><span>'+esc(e.nama)+'</span><small>'+e.n+' temuan</small></button>'}).join('')+'</div>':'';
}
function wBaruSimpan(f){
  var el=$('wbaru'),b=f.baru;if(!el||!b)return;
  if(b.j==='kel'){var r=L.kelompok(el.value);if(!r.ok||!r.val){toast(r.err||'Isi nama kelompok.');return}
    if(b.ax==='kd')f.kd.k=r.val;else{f[b.ax].k1=r.val;f[b.ax].n1='';f[b.ax].n2=''}}
  else{var c=L.kode(el.value);if(!c.ok){toast(c.err);return}
    var k=f[b.ax].k1,key=b.ax+'|'+k;(f.xk[key]=f.xk[key]||[]).push(c.val);wTapKode(f,b.ax,c.val)}
  f.baru=null;fRender();
}
function wTapKode(f,ax,v){
  var x=f[ax];x.k2='';
  if(!L.rapi(x.n1)){x.n1=v;x.n2=''}
  else if(!L.rapi(x.n2)){if(L.kunci(v)===L.kunci(x.n1))x.n1='';else{x.n2=v;if(L.bandingAlami(x.n1,x.n2)>0){var tm=x.n1;x.n1=x.n2;x.n2=tm}}}
  else{x.n1=v;x.n2=''}
}
/** Foto yang sudah tersimpan di dialog Ubah temuan, dengan tombol hapus dua langkah (ketuk x, lalu konfirmasi Hapus). */
function fotoEditHtml(f){
  var d=findDefect(f.id);if(!d)return '';
  var adm=isAdmin();
  function blok(jenis,items){
    var lbl='<div class="phl"><span>'+(jenis==='before'?'Before':'After')+'</span></div>';
    var jobs=S.up.filter(function(j){return j.did===d.id&&j.jenis===jenis});
    var tombol=jenis==='before'?'<div class="pbtn"><button type="button" class="pill" data-act="fadd" data-cam="1">'+ic('cam')+'Kamera</button><button type="button" class="pill" data-act="fadd">'+ic('img')+'Galeri</button></div>':'';
    if(!items.length&&!jobs.length)return lbl+'<div class="none">Belum ada foto '+jenis+'</div>'+tombol;
    return lbl+'<div class="thumbs">'+items.map(function(x){
      var tanya=adm&&f.hapusFoto===x.id;
      return '<div class="fitem"><div class="thumb"><img loading="lazy" referrerpolicy="no-referrer" alt="Foto '+jenis+'" src="'+(S.pv[x.id]||thumb(x.id,400))+'">'+
        (tanya?'<div class="ov2 ask"><b>Hapus foto?</b><span><button type="button" class="pill bad" data-act="fdelya" data-f="'+esc(x.id)+'" data-j="'+jenis+'">Hapus</button><button type="button" class="pill" data-act="fdelbatal">Batal</button></span></div>'
          :(adm?'<button type="button" class="x" data-act="fdel" data-f="'+esc(x.id)+'" aria-label="Hapus foto">&times;</button>':''))+'</div>'+
        (adm?'<button type="button" class="pill" data-act="fcoret" data-j="'+jenis+'" data-f="'+esc(x.id)+'">'+ic('pena')+'Coret</button>':'')+'</div>';
    }).join('')+jobs.map(upHtml).join('')+'</div>'+tombol;
  }
  return blok('before',d.fotoBefore)+'<div style="height:10px"></div>'+blok('after',d.fotoAfter);
}
function fotoEditRefresh(){var el=$('fsfoto');if(el&&S.modal&&S.modal.f)el.innerHTML=fotoEditHtml(S.modal.f)}
/** Pindah ruangan pada Ubah temuan: hanya ruangan lain di Gedung dan Lantai yang sama. Tidak untuk lokasi umum; yang sudah Close atau bermemo hanya Admin (server menegakkan). */
function bolehPindah(f){return !!f.id&&!f.lama&&!f.kunciBidang&&(isAdmin()||(!f.memoId&&f.ver!=='Diterima'))}
function pindahHtml(f){
  if(!bolehPindah(f))return '';
  if(!f.pindah)return '<div class="row"><button type="button" class="pill" data-act="fpindah">Pindah ruangan</button></div>';
  return '<div class="row"><span class="lbl">Pindah ke ('+esc(labelBidang(f.bidang).lokasi.toLowerCase())+' lain)</span>'+cbHtml('ruang','Ketik atau pilih ruangan tujuan',f.ruang)+'</div>'+
    '<div class="note">Nomor temuan diganti mengikuti ruangan tujuan, dan foto ikut dipindah. <button type="button" class="pill" data-act="fpindahbatal">Batal pindah</button></div>';
}
/** Satu dialog untuk Tambah temuan (HP) dan Ubah temuan: komponen tampilan baru (chip Bidang, tombol Tingkat, chip Elemen, Titik)
 * dalam satu layar gulir. Elemen dan Titik terbuka di tempat (f.bukaEl, f.bukaTitik), bukan pindah layar. */
function fSatuHtml(m){
  var f=m.f,baru=!f.id,tg=fTitik(f,false),judul=baru?'Tambah temuan':'Ubah temuan';
  var h='<div class="ov" data-act="modalbg"><div class="sheet wz satu" role="dialog" aria-label="'+judul+'">'+
    '<div class="wh"><h2>'+judul+'</h2><button type="button" class="btn-ic wx" data-act="mtutup" aria-label="Tutup">'+ic('x')+'</button></div>';
  h+='<div class="chips wb" role="group" aria-label="Bidang">'+BIDANG.map(function(b){return '<button type="button" class="chip'+(b===f.bidang?' on':'')+'"'+(f.kunciBidang&&b!==f.bidang?' disabled':'')+' data-act="wbid" data-v="'+esc(b)+'">'+esc(KODE_BID[b]||b)+'</button>'}).join('')+'</div>';
  // lokasi
  if(baru){
    var o=wTerakhir();
    if(o&&!(o.bidang===f.bidang&&o.gedung===f.gedung&&o.lantai===f.lantai&&(o.lok==='ruang'?o.ruang===f.ruang:true)))
      h+='<button type="button" class="pakai" data-act="wpakai"><span>'+esc(o.gedung+' \u203a '+o.lantai+' \u203a '+(o.lok==='ruang'?o.ruang:'Umum - '+o.bidang))+'</span><b>Pakai</b></button>';
    h+=fLokasiHtml(f);
    if(f.lok==='ruang')h+='<div class="row"><span class="lbl">'+esc(labelBidang(f.bidang).lokasi)+'</span>'+cbHtml('ruang','Ketik atau pilih nama ruangan',f.ruang)+'</div>'+
      '<div class="note">Ketuk untuk memilih. Ketik untuk menambah yang baru; nama yang mirip akan ditandai.</div>';
    else h+='<div class="row fix"><span class="lbl">Lokasi</span><div>Umum - '+esc(f.bidang)+'</div><span class="oto">otomatis</span></div>'+
      '<div class="note">'+esc(f.bidang)+' tidak memakai ruangan, jadi lokasinya otomatis.</div>';
  }else h+='<div class="row fix"><span class="lbl">Lokasi</span><div>'+esc(f.gedung+' / '+f.lantai+' / '+f.lokasiTeks)+'</div></div>'+pindahHtml(f);
  // foto
  if(baru)h+='<div class="cap">Foto Before</div><div id="mph" class="phs">'+mphHtml(f)+'</div>'+
    '<div class="pbtn"><button type="button" class="pill" data-act="mfoto" data-cam="1">'+ic('cam')+'Kamera</button><button type="button" class="pill" data-act="mfoto">'+ic('img')+'Galeri</button></div>';
  else if(canEdit())h+='<div class="cap">Foto</div><div id="fsfoto">'+fotoEditHtml(f)+'</div>'+(isAdmin()?'<div class="note">Foto yang dihapus dipindah ke folder Sampah di Drive.</div>':'');
  // detail
  h+=fDetailHtml(f)+'<div class="cap">Temuan</div><div class="row dikte" id="mUr"><textarea id="mU" aria-label="Temuan" placeholder="Apa temuannya?">'+esc(f.uraian)+'</textarea></div>';
  h+='<div class="cap">Seberapa parah?</div><div class="sev" role="group" aria-label="Tingkat">'+TINGKAT.map(function(x,i){return '<button type="button" class="s'+i+(x===f.tingkat?' on':'')+'" data-act="wsev" data-v="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div>';
  var all=regDaftar('elemen',f.bidang),arr=Object.keys(all).map(function(k){return all[k]}).sort(function(x,y){return (y.n-x.n)||(y.t-x.t)||L.bandingNama(x.nama,y.nama)}),top=arr.slice(0,4).map(function(e){return e.nama});
  if(f.elemen&&top.every(function(n){return L.kunci(n)!==L.kunci(f.elemen)}))top.unshift(f.elemen);
  h+='<div class="cap">Elemen <small>(opsional)</small></div><div class="epil">'+top.map(function(n){return '<button type="button" class="chip'+(L.kunci(n)===L.kunci(f.elemen)?' on blue':'')+'" data-act="welpick" data-v="'+esc(n)+'">'+esc(n)+'</button>'}).join('')+
    '<button type="button" class="chip dash" data-act="'+(f.bukaEl?'wtutupel':'welbuka')+'">'+(f.bukaEl?'Tutup daftar':(arr.length>=8?'Semua / cari':'+ Elemen lain'))+' &rsaquo;</button></div>';
  if(f.bukaEl)h+='<div id="elsek"><div class="sbar"><span class="si">'+ic('search')+'</span><input type="text" id="elq" class="sinp" maxlength="60" autocomplete="off" placeholder="Cari atau ketik elemen baru" value="'+esc(f.elq||'')+'"></div><div id="ell">'+wElemenList(f)+'</div></div>';
  if(!BID_RUANG[f.bidang]){
    if(f.bukaTitik){
      var mm=fModeElemen(f);
      h+='<div id="titiksek"><div class="cap">Titik'+(f.elemen?' \u00b7 '+esc(f.elemen):'')+'</div><div class="seg in" role="group" aria-label="Bentuk titik">'+
        [['grid','Grid'],['kode','Kode'],['teks','Teks'],['tanpa','Tanpa']].map(function(o){return '<button type="button" data-act="fmode" data-v="'+o[0]+'"'+(f.mode===o[0]?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div>';
      if(mm&&mm!==f.mode)h+='<div class="note">Terakhir untuk "'+esc(f.elemen)+'" dipakai bentuk '+esc(mm)+'.</div>';
      if(f.mode==='grid')h+=wSumbuHtml(f,'a','Sumbu 1')+wSumbuHtml(f,'b','Sumbu 2');
      if(f.mode==='kode')h+=wKodeHtml(f);
      if(f.mode==='teks')h+=wTeksHtml(f);
      h+='<div id="fpem" class="note"></div><div id="fprev" class="note"></div><button type="button" class="btn sec" data-act="wtitikok">Selesai isi titik</button></div>';
    }else h+='<button type="button" class="row titikrow" data-act="wtitik"><span class="lbl">Titik ('+esc(f.mode)+')</span><div>'+(tg.ok&&tg.teks?esc(tg.teks):'<span class="mute">Belum diisi (opsional)</span>')+'</div><svg class="chev" viewBox="0 0 12 18"><path d="M3 3l6 6-6 6"/></svg></button>';
  }
  h+='<label class="row"><span class="lbl">Tanggal temuan</span><input type="date" id="mD" value="'+esc(f.tgl)+'"></label>';
  h+='<button type="button" class="btn rect" data-act="msimpan">Simpan</button>'+(baru?'<button type="button" class="btn sec" data-act="msimpanlagi">Simpan &amp; tambah lagi di lokasi ini</button>':'')+'<button type="button" class="btn sec" data-act="mtutup">Batal</button>';
  return h+'</div></div>';
}
/** Posisi tepat di dalam ruangan (teks bebas). Nama ruangan hanya jenis tempatnya; detail posisi ditulis di sini. */
function fDetailHtml(f){
  if(f.lama)return '';
  return '<label class="row"><span class="lbl">Lokasi detail <small>(opsional)</small></span><input type="text" id="mL" maxlength="120" autocomplete="off" placeholder="Mis. depan ruang LVMDP, dekat tangga" value="'+esc(f.detail||'')+'"></label>';
}
function fHtml(m){
  if(m.f.satu)return fSatuHtml(m);
  if(!m.f.id&&!m.f.lama&&desk())return fWizHtml(m);   // desktop: layar lebar O3; HP: satu dialog seperti Ubah temuan
  var f=m.f,mm=fModeElemen(f),h;
  h='<div class="ov" data-act="modalbg"><div class="sheet ubah" role="dialog" aria-label="Temuan"><div class="grab"></div><h2>'+(f.id?'Ubah temuan':'Tambah temuan')+'</h2>';
  h+='<section class="group vis"><div class="list">';
  if(f.id||f.lama)h+='<div class="row ro"><span class="lbl">'+(f.id?'Lokasi':labelBidang(f.bidang).area+' / '+labelBidang(f.bidang).level)+'</span><div>'+esc(f.id?(f.gedung+' / '+f.lantai+' / '+f.lokasiTeks):(f.gedung+' / '+f.lantai))+'</div></div>'+pindahHtml(f);
  else h+=fLokasiHtml(f);
  h+='<div class="two"><label class="row"><span class="lbl">Bidang</span><select id="mB"'+(f.kunciBidang?' disabled':'')+'>'+BIDANG.map(function(b){return '<option'+(b===f.bidang?' selected':'')+'>'+esc(b)+'</option>'}).join('')+'</select></label>'+
    '<label class="row"><span class="lbl">Tingkat</span><select id="mT">'+TINGKAT.map(function(b){return '<option'+(b===f.tingkat?' selected':'')+'>'+esc(b)+'</option>'}).join('')+'</select></label></div>';
  if(!f.lama&&!f.id){
    h+='<div class="row"><span class="lbl">Lokasi</span><div class="seg in" role="group" aria-label="Lokasi"><button type="button" data-act="flok" data-v="ruang"'+(f.lok==='ruang'?' class="on"':'')+'>Ruangan</button><button type="button" data-act="flok" data-v="umum"'+(f.lok==='umum'?' class="on"':'')+'>Umum - '+esc(f.bidang)+'</button></div></div>';
    if(f.lok==='ruang')h+='<div class="row"><span class="lbl">Ruangan</span>'+cbHtml('ruang','Ketik nama ruangan',f.ruang)+'</div>';
  }
  if(!f.lama)h+='<div class="row"><span class="lbl">Elemen (opsional)</span>'+cbHtml('elemen','Mis. Kolom, Pintu',f.elemen)+'</div>';
  h+='</div></section>';
  if(!f.lama){
    h+='<section class="group vis"><div class="sh">Titik</div><div class="row" style="padding-top:0"><div class="seg in" role="group" aria-label="Bentuk titik">'+
      [['grid','Grid'],['kode','Kode'],['teks','Teks'],['tanpa','Tanpa']].map(function(o){return '<button type="button" data-act="fmode" data-v="'+o[0]+'"'+(f.mode===o[0]?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div></div>';
    if(mm&&mm!==f.mode)h+='<div class="note" style="padding-top:0">Terakhir untuk "'+esc(f.elemen)+'" dipakai bentuk '+esc(mm)+'.</div>';
    if(f.mode==='grid')h+='<div class="list">'+fAxisHtml(f,'a','Sumbu 1')+fAxisHtml(f,'b','Sumbu 2')+'</div>';
    if(f.mode==='kode')h+='<div class="list"><div class="two"><div class="row"><span class="lbl">Kelompok</span>'+cbHtml('kdk','Mis. BP',f.kd.k)+'</div><div class="row"><span class="lbl">Kode</span>'+cbHtml('kdn','Mis. 12',f.kd.n)+'</div></div></div>';
    if(f.mode==='teks')h+='<div class="list"><div class="row"><span class="lbl">Posisi</span>'+cbHtml('teks','Mis. nama jalan atau STA',f.teks)+'</div></div>';
    h+='<div id="fpem" class="note"></div><div id="fprev" class="note"></div></section>';
  }
  h+='<section class="group"><div class="list">'+
    '<label class="row"><span class="lbl">Tanggal temuan</span><input type="date" id="mD" value="'+esc(f.tgl)+'"></label>'+
    (f.lama?'':fDetailHtml(f))+'<label class="row" id="mUr"><span class="lbl">Temuan / catatan</span><textarea id="mU" placeholder="Tulis atau dikte temuan dengan mikrofon keyboard">'+esc(f.uraian)+'</textarea></label></div></section>';
  if(f.id&&canEdit())h+='<section class="group pad"><div class="cap" style="margin-bottom:8px">Foto</div><div id="fsfoto">'+fotoEditHtml(f)+'</div>'+(isAdmin()?'<div class="note" style="padding:8px 0 0">Foto yang dihapus dipindah ke folder Sampah di Drive.</div>':'')+'</section>';
  if(!f.id){
    h+='<section class="group pad"><div class="cap" style="margin-bottom:8px">Foto Before</div>'+
      '<div id="mph">'+mphHtml(f)+'</div>'+
      '<div class="pbtn"><button type="button" class="pill" data-act="mfoto" data-cam="1">'+ic('cam')+'Kamera</button><button type="button" class="pill" data-act="mfoto">'+ic('img')+'Galeri</button></div></section>';
  }
  h+='<div class="gap"><button type="button" class="btn rect" data-act="msimpan">Simpan</button>'+(!f.id&&!f.lama?'<button type="button" class="btn sec" data-act="msimpanlagi">Simpan &amp; tambah lagi di lokasi ini</button>':'')+'<button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>';
  return h;
}

/* ----- simpan ----- */
function fGalat(m,id){
  toast(m);
  var el=id&&$(id);
  if(el){var row=el.closest('.row');if(row)row.classList.add('bad');try{el.scrollIntoView({block:'center'})}catch(e){}el.focus();if(el.getAttribute('data-cb'))cbBuka(id)}
  return false;
}
function fPeriksaDaftar(f){
  var bm=null;
  function cek(id,wajib){
    if(bm)return;var el=$(id);if(!el)return;var v=L.rapi(el.value);
    if(!v){if(wajib)bm=[id,'Isi dulu.'];return}
    var s=cbSumber(id);
    if(s.d[L.kunci(v)])return;                          // sudah terdaftar (termasuk nama lama): dipakai apa adanya
    var nv=s.norm(v);
    if(nv===null||nv===undefined){if(s.galat)bm=[id,s.galat(v)];return}   // nama lokasi tidak lolos aturan; galat bentuk Titik ditangkap fTitik
    if(!s.tambah)return;
    if(s.d[L.kunci(nv)])return;
    if(f.conf[id]===L.kunci(nv))return;
    bm=[id,'Belum ada. Pilih "+ Tambah" di daftar.'];
  }
  if(f.lok==='ruang'&&!f.id)cek('ruang',true);
  cek('elemen',false);
  if(f.mode==='grid')['ak1','an1','ak2','an2','bk1','bn1','bk2','bn2'].forEach(function(i){cek(i,false)});
  if(f.mode==='kode'){cek('kdk',false);cek('kdn',false)}
  return bm;
}
function wToastSimpan(lagi,f,res,pesan){
  if(lagi||f.id||f.lama){toast(pesan);return}
  toastAksi(pesan,'+ Tambah lagi',function(){
    var nf=fBuat(null,{bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?(res.ruangan||f.ruang):''),elemen:res.elemen||'',mode:f.mode,a:{k1:f.a.k1},b:{k1:f.b.k1},kd:{k:f.kd.k}});
    nf.step='foto';openModal({t:'temuan',f:nf});
  });
}
/** Menerapkan hasil defect_simpan yang berhasil ke tampilan dan penyimpanan lokal, lalu mengantrekan foto. Dipakai simpan langsung dan kirim draf. */
function terapkanHasil(res,f,files,isNew){
  lsSet('dl-bidang',f.bidang);
  if(isNew)lsSet('dl-lok',JSON.stringify({bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?(res.ruangan||f.ruang):'')}));
  if(res.lokasi&&res.lokasi.baru){ // ruangan atau lokasi umum baru dibuat di server
    var lk=res.lokasi;S.rooms.push({id:lk.id,gedung:lk.gedung,lantai:lk.lantai,nama:lk.nama,jenis:lk.jenis,nomor:lk.nomor,bidang:lk.bidang,urut:S.rooms.length,open:0,proses:0,close:0,total:0});
    lsSet('dl-rooms-'+S.paket.id,JSON.stringify(S.rooms));
  }
  if(isNew&&res.lokasi&&res.lokasi.baru&&S.defects[res.ruanganId]===undefined){S.defects[res.ruanganId]=[]}   // ruangan yang baru dibuat memang kosong
  putDefect(res);regTerapkan(res,f);
  if(isNew){S.baru=res.id;setTimeout(function(){if(S.baru===res.id)S.baru=null},900)}
  if(isNew&&(S.sel.r!==res.ruanganId)){S.sel={g:res.gedung,l:res.lantai,r:res.ruanganId};lsSet('dl-sel',JSON.stringify(S.sel))}
  if(isNew&&files.length)files.forEach(function(x){var jb2={k:nk(),did:res.id,jenis:'before',data:x,st:'wait'};S.up.push(jb2);qSave(jb2)});
}

/* ---------- draf offline ----------
 * Temuan baru yang gagal disimpan karena jaringan putus disimpan di IndexedDB (kv, kunci draf:<paket>:<k>) berikut fotonya,
 * lalu dikirim otomatis saat sinyal kembali. Waktu habis (server mungkin sudah menyimpan) TIDAK dijadikan draf, supaya tidak ganda.
 * Draf yang ditolak server atau namanya mirip diberi status 'cek' dan dibuka manual lewat tombol Buka. */
var DRAF=[],drafRun=false;
function drafKunci(k){return 'draf:'+S.paket.id+':'+k}
async function drafTulis(d){try{await IDB.run('kv','readwrite',function(o){return o.put(d,drafKunci(d.k))});return true}catch(e){return false}}
async function drafSimpan(p,f,files){
  var snap=JSON.parse(JSON.stringify(Object.assign({},f,{files:[],pend:0,lagiTmp:null})));
  var d={k:nk(),pid:S.paket.id,p:p,f:snap,files:files,t:Date.now(),st:'wait',pesan:''};
  if(!(await drafTulis(d))){toast('Penyimpanan di HP penuh atau diblokir. Draf tidak bisa dibuat; coba simpan lagi saat ada sinyal.');return false}
  if(f.drafK)drafHapus(f.drafK);
  DRAF.push(d);upBar();
  toast('Tidak ada sinyal. Temuan disimpan sebagai draf dan dikirim otomatis saat sinyal kembali.');
  return true;
}
function drafHapus(k){DRAF=DRAF.filter(function(x){return x.k!==k});if(S.paket)IDB.del('kv',drafKunci(k));upBar()}
function drafLanjut(f){   // "Simpan dan tambah lagi" saat offline: lanjut ke temuan berikutnya di lokasi yang sama
  var nf=fBuat(null,{bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?f.ruang:''),elemen:'',mode:f.mode,a:{k1:f.a.k1},b:{k1:f.b.k1},kd:{k:f.kd.k}});
  nf.step='foto';openModal({t:'temuan',f:nf});
}
async function drafMuat(){
  if(!S.paket)return;
  var pre='draf:'+S.paket.id+':',ks=await IDB.keys('kv'),out=[];
  for(var i=0;i<ks.length;i++)if(String(ks[i]).indexOf(pre)===0){var d=await IDB.get('kv',ks[i]);if(d&&d.p)out.push(d)}
  out.sort(function(a,b){return a.t-b.t});DRAF=out;upBar();drafKirim();
}
async function drafKirim(){
  if(drafRun||!S.user||!S.paket)return;
  var ada=DRAF.filter(function(x){return x.st==='wait'});if(!ada.length)return;
  drafRun=true;var terkirim=0;
  try{
    for(var i=0;i<ada.length;i++){
      var d=ada[i];
      try{
        var res=await api('defect_simpan',d.p);
        if(res&&res.perluKonfirmasi){d.st='cek';d.pesan='Nama '+(res.mirip&&res.mirip.jenis==='lantai'?'lantai':'gedung')+' mirip "'+(res.mirip&&res.mirip.entri)+'". Buka draf lalu pilih.';await drafTulis(d);continue}
        terapkanHasil(res,d.f,d.files,true);drafHapus(d.k);terkirim++;
      }catch(e){
        if(e&&e.server){
          if(/Kode tidak dikenal|nonaktif/i.test(e.message||'')){gagal(e);break}
          d.st='cek';d.pesan=e.message||'Ditolak server.';await drafTulis(d);
        }else if(e&&e.name==='AbortError'){d.st='cek';d.pesan='Pengiriman terputus. Cek daftar temuan dulu: mungkin sudah tersimpan.';await drafTulis(d)}
        else break;   // masih offline: berhenti, coba lagi nanti
      }
    }
  }finally{
    drafRun=false;
    if(terkirim){S.drafOk=terkirim;setTimeout(function(){S.drafOk=0;upBar()},1800)}
    upBar();
  }
  if(terkirim){toast(terkirim+' draf terkirim.');render();runQueue()}
}
function drafBuka(){
  var d=DRAF.filter(function(x){return x.st==='cek'})[0];if(!d)return;
  var f=d.f;f.files=d.files.slice();f.pend=0;f.step='detail';f.drafK=d.k;f.konfirmasiBaru=false;f.satu=!f.lama&&!desk();
  if(d.pesan)toast(d.pesan);
  openModal({t:'temuan',f:f});
}
window.addEventListener('online',function(){upBar();drafKirim();segarkan(true)});
window.addEventListener('offline',function(){upBar()});
/* Sinkron otomatis: saat aplikasi kembali ke depan atau sinyal pulih, muat ulang data layar aktif bila sudah lebih dari semenit.
   Dilewati selama ada dialog, foto, kolom yang sedang diisi, atau proses sibuk, supaya isian tidak hilang dan layar tidak melompat. */
var TSEGAR=Date.now();
function segarkan(paksa){
  if(!S.paket||!S.user||document.hidden||navigator.onLine===false)return;
  if(!paksa&&Date.now()-TSEGAR<60000)return;
  var ae=document.activeElement,tg=ae&&ae.tagName;
  if(S.modal||S.zoom||S.file||S.busy||tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
  TSEGAR=Date.now();
  var v=S.view;
  if(v==='verif')loadSiap();
  else if(v==='perbaikan')loadPerlu();
  else if(v==='memo'){if(M_)M_.muatDaftar()}
  else if(v==='form'){var s=S.sel;if(s&&s.r)loadDefects(s.r,true)}
  else if(v==='kelola'||v==='rekap')loadRooms();
  if(v!=='kelola'&&v!=='rekap'){if(canEdit())loadSiap();if(isPJ())loadPerlu()}
  if((v==='form'||v==='rekap')&&S.all&&!S.allBusy){S.allBusy=true;api('defect_semua',{}).then(function(r){S.all=r;S.allBusy=false;render()}).catch(function(){S.allBusy=false})}   // daftar Semua area ikut disegarkan, tanpa layar memuat
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)segarkan(false)});
/* Tarik ke bawah dari paling atas untuk memuat ulang (HP). Hanya di layar utama, bukan di dialog, foto, atau kolom isian. */
(function(){
  var y0=0,x0=0,tarik=false,dy=0,el=null,SAMBUNG=84,sibuk=false;
  function ind(){if(!el){el=document.createElement('div');el.id='ptr';el.className='ptr';el.setAttribute('aria-hidden','true');el.hidden=true;el.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 5v10M7.5 11l4.5 4.5 4.5-4.5"/></svg>';document.body.appendChild(el)}return el}
  function atur(d,aktif){var e=ind(),p=Math.min(1,d/SAMBUNG);e.hidden=false;e.style.transform='translate(-50%,'+Math.round(Math.min(d,SAMBUNG+20)*0.55-40)+'px)';e.style.opacity=String(Math.max(.2,p));e.classList.toggle('siap',p>=1);e.classList.toggle('putar',!!aktif)}
  function sembunyi(){if(el){el.hidden=true;el.classList.remove('siap','putar')}}
  document.addEventListener('touchstart',function(ev){
    tarik=false;dy=0;
    if(sibuk||ev.touches.length!==1||!S.paket||!S.user||S.modal||S.zoom||S.file||S.busy)return;
    if((window.pageYOffset||0)>0)return;
    var t=ev.target;if(t&&t.closest&&(t.closest('#overlay,.ov,textarea,select,#dock')||(t.closest('input')&&(t.closest('input')===document.activeElement||!t.closest('.sinp')))))return;   // kolom cari yang belum fokus boleh dipakai menarik
    y0=ev.touches[0].clientY;x0=ev.touches[0].clientX;tarik=true;
  },{passive:true});
  document.addEventListener('touchmove',function(ev){
    if(!tarik)return;
    var c=ev.touches[0];dy=c.clientY-y0;
    if(Math.abs(c.clientX-x0)>Math.abs(dy)||dy<=8||(window.pageYOffset||0)>0){if(dy<=0){tarik=false;sembunyi()}return}
    atur(dy-8,false);
  },{passive:true});
  function selesai(){
    if(!tarik)return;tarik=false;
    if(dy-8>=SAMBUNG){
      sibuk=true;atur(SAMBUNG,true);
      if(navigator.onLine===false){toast('Tidak ada sinyal.');sembunyi();sibuk=false;return}
      var t0=Date.now();segarkan(true);
      setTimeout(function(){sembunyi();sibuk=false},Math.max(0,700-(Date.now()-t0)));
    }else sembunyi();
  }
  document.addEventListener('touchend',selesai,{passive:true});
  document.addEventListener('touchcancel',function(){tarik=false;sembunyi()},{passive:true});
})();
setInterval(function(){if(DRAF.length&&navigator.onLine!==false)drafKirim()},60000);

async function saveForm(lagi){
  fBaca();var f=S.modal.f;
  if(!f.id&&!f.lama&&desk()&&f.step!=='detail')return;
  if(!f.uraian.trim()){$('mUr').classList.add('bad');toast('Isi temuan terlebih dahulu.');return}
  if(f.pend){toast('Foto masih disiapkan, tunggu sebentar.');return}
  if(!f.id&&!f.lama){   // Gedung atau Lantai baru: harus ada di daftar resmi (bila dipakai), dirapikan dan diperiksa sesuai aturan nama
    var lbG=labelBidang(f.bidang);
    if(masterAktif()){
      if(f.gMode)return fGalat(lbG.area+' "'+L.rapi(f.gedung)+'" belum ada di daftar. Pilih dari daftar; yang baru ditambahkan Admin di tab Kelola.','gedung');
      if(f.lMode&&!isAdmin()&&masterLantaiDaftar(f.gedung).length)return fGalat(lbG.level+' "'+L.rapi(f.lantai)+'" tidak ada di daftar '+f.gedung+'. Pilih dari daftar; yang baru ditambahkan Admin.','lantai');
    }
    if(f.gMode){var ng=L.namaGedung(f.gedung);if(!ng.ok)return fGalat(ng.err,'gedung');f.gedung=ng.val}
    if(f.lMode||f.gMode){var nl=L.namaLantai(f.lantai);if(!nl.ok)return fGalat(nl.err,'lantai');f.lantai=nl.val;if(nl.detail&&!f.detail)f.detail=nl.detail}
  }
  var p={id:f.id,bidang:f.bidang,tingkat:f.tingkat,tglTemuan:f.tgl,uraian:f.uraian,gedung:f.gedung,lantai:f.lantai,ukur:UKUR?1:0};
  var rmIni=null;
  if(f.lama||f.id)p.ruanganId=f.ruanganId;
  else{
    if(!L.rapi(f.gedung))return fGalat('Isi nama '+labelBidang(f.bidang).area+'.','gedung');
    if(!L.rapi(f.lantai))return fGalat('Isi nama '+labelBidang(f.bidang).level+'.','lantai');
    if(f.konfirmasiBaru)p.konfirmasiBaru=true;
  }
  if(!f.lama){
    if(!f.id&&f.lok==='ruang'&&!L.rapi(f.ruang))return fGalat('Pilih atau tambah ruangan.','ruang');
    var t=fTitik(f,true);if(!t.ok)return fGalat(t.err);
    var bm=fPeriksaDaftar(f);if(bm)return fGalat(bm[1],bm[0]);
    p.detail=L.rapi(f.detail||'');p.elemen=L.rapi(f.elemen);p.mode=(f.mode==='tanpa')?'':f.mode;p.titik=t.data||{};p.pemBaru=f.pemBaru;
    if(!f.id){
      if(f.lok==='umum')p.umum=true;
      else{var ex=regDaftar('ruang',f.gedung,f.lantai)[L.kunci(f.ruang)];if(ex)p.ruanganId=ex.id;else p.ruanganBaru=L.rapi(f.ruang)}
    }
  }
  var pindahKe=null;
  if(f.id&&f.pindah){
    if(!L.rapi(f.ruang))return fGalat('Pilih ruangan tujuan, atau batalkan pindah.','ruang');
    if(L.kunci(f.ruang)!==L.kunci(f.lokasiTeks)){var ex2=regDaftar('ruang',f.gedung,f.lantai)[L.kunci(f.ruang)];pindahKe=ex2?{id:f.id,ruanganId:ex2.id}:{id:f.id,ruanganBaru:L.rapi(f.ruang)}}
  }
  var files=f.files.slice(),isNew=!f.id,t0=Date.now();
  closeModal();
  var gagalNet=false;   // jaringan putus seketika (bukan waktu habis): aman disimpan sebagai draf, tidak mungkin sudah tersimpan di server
  var res=await work('Menyimpan temuan...',function(){return api('defect_simpan',p).catch(function(e){if(isNew&&e&&!e.server&&e.name!=='AbortError')gagalNet=true;throw e})});
  if(!res){
    if(gagalNet&&await drafSimpan(p,f,files)){if(lagi)drafLanjut(f);return}
    f.files=files;openModal({t:'temuan',f:f});return;
  }
  if(res.perluKonfirmasi){f.files=files;f.lagiTmp=lagi;openModal({t:'mirip',f:f,mirip:res.mirip});return}   // nama mirip yang sudah ada: tanya pengguna
  if(UKUR)console.log('[ukur] simpan temuan, klien total '+(Date.now()-t0)+'ms, server',res.ms);
  var pindahOk=false;
  if(pindahKe){var rp=await work('Memindahkan ruangan...',function(){return api('defect_pindah',pindahKe)});if(rp){res=rp;pindahOk=true;var lo=S.defects[f.ruanganId];if(lo){S.defects[f.ruanganId]=lo.filter(function(x){return x.id!==rp.id});recount(f.ruanganId);simpanDef(f.ruanganId)}await loadRooms()}else toast('Perubahan tersimpan, tetapi temuan belum dipindah.')}
  terapkanHasil(res,f,files,isNew);
  if(f.drafK)drafHapus(f.drafK);
  if(isNew&&files.length)wToastSimpan(lagi,f,res,'Tersimpan. Foto diunggah di latar.');
  else wToastSimpan(lagi,f,res,pindahOk?'Tersimpan dan dipindah ke '+res.ruangan+' No '+res.no+'.':'Tersimpan.');
  render();upBar();runQueue();
  if(isNew&&!lagi)kartuLihat(res.id);
  if(lagi&&isNew){var nf=fBuat(null,{bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?res.ruangan:''),elemen:res.elemen||'',mode:f.mode,a:{k1:f.a.k1},b:{k1:f.b.k1},kd:{k:f.kd.k}});nf.step='foto';openModal({t:'temuan',f:nf})}
}

async function onClick(ev){
  var el=ev.target.closest('[data-act]');if(!el)return;
  var a=el.getAttribute('data-act');
  if(a==='modalbg'&&ev.target!==el)return;
  if(a==='zoomx'&&ev.target.closest('img')&&!ev.target.closest('.btn-ic'))return;
  var id=el.getAttribute('data-d');
  if(S.modal&&S.modal.t==='aksi'&&a!=='mtutup'&&a!=='modalbg')closeModal();
  if(M_&&M_.milik(a))return M_.klik(a,el,ev);
  switch(a){
    case 'tempel': {
      var ki=$('kode');if(!ki)return;ki.focus({preventScroll:true});
      if(navigator.clipboard&&navigator.clipboard.readText){
        navigator.clipboard.readText().then(function(t){ki.value=t||'';ki.dispatchEvent(new Event('input',{bubbles:true}))})
          .catch(function(){toast('Tidak bisa membaca papan klip. Tekan lama kotak kode lalu pilih Tempel.')});
      }else toast('Tekan lama kotak kode lalu pilih Tempel.');
      return;
    }
    case 'fpindah': fBaca();S.modal.f.pindah=true;S.modal.f.ruang='';return fRender();
    case 'fpindahbatal': fBaca();S.modal.f.pindah=false;S.modal.f.ruang='';return fRender();
    case 'paket': return pilihPaket(el.getAttribute('data-id'),true);
    case 'ganti': resetHist(false);S.paket=null;S.user=null;S.kode='';S.loginErr='';S.modal=null;S.zoom=null;S.file=null;lsDel(STORE);renderOverlay();return render();
    case 'keluar': keluar();return render();
    case 'masuk': return masuk();
    case 'tab': {
      var nv=el.getAttribute('data-v');if(nv==='lain'){if(LAIN.some(function(x){return x[0]===S.view}))return;nv=S.lain||'verif'}if(nv===S.view)return;if(nv==='verif'||nv==='perbaikan'||nv==='memo')S.lain=nv;
      if(nv==='form')hpopTop('view');else if(S.view==='form')hpush('view');
      S.view=nv;}
      lsSet('dl-view',S.view);if(S.view==='rekap'){S.all=null;S.allErr=false}render();
      if(S.view==='verif')loadSiap();
      else if(S.view==='perbaikan')loadPerlu();
      else if(S.view==='memo'){if(M_)M_.muatDaftar()}
      else if(S.view==='rekap'||S.view==='kelola'){loadRooms();if(S.view==='rekap'&&M_&&S.rekapMode==='memo')M_.muatDaftar()}
      else{var s=ensureSel(tree());if(s)loadDefects(s.r.id,false)}
      return;
    case 'nav': {var T=tree(),fl=flat(T),ix=fl.map(function(x){return x.r}).indexOf(S.sel.r),n=fl[ix+(+el.getAttribute('data-d'))];if(!n)return;S.sel=n;lsSet('dl-sel',JSON.stringify(n));render();loadDefects(n.r,false);window.scrollTo(0,0);return}
    case 'muat': return loadDefects(S.sel.r,true);
    case 'tambah': return openForm(null);
    case 'edit': return openForm(findDefect(id));
    case 'fotocoba': {var fid=el.getAttribute('data-id'),zi=el.parentNode.querySelector('img');FOTO_COBA[fid]=0;el.remove();if(zi){zi.style.display='';zi.src=thumb(fid,1024)}return}
    case 'zoom': FOTO_COBA[el.getAttribute('data-f')]=0;return openZoom(thumb(el.getAttribute('data-f'),1024));
    case 'zoomx': return closeZoom();
    case 'mzoom': readForm();return openZoom(S.modal.f.files[+el.getAttribute('data-i')]);
    case 'foto': {
      var jenis=el.getAttribute('data-j');
      pick(!!el.getAttribute('data-cam'),function(items){
        if((jenis==='before'&&canEdit())||jenis==='after')fotoCoret(id,items,jenis);else enqueue(id,jenis,items);   // Before dan After sama-sama ditawari tahap coret
      });
      if(S.modal&&S.modal.t==='unggah')closeModal();
      return;
    }
    case 'miripPakai': {var mq=S.modal,fq=mq.f;if(mq.mirip.jenis==='gedung'){fq.gedung=mq.mirip.entri;fq.gMode=false;fq.lMode=false}else{fq.lantai=mq.mirip.entri;fq.lMode=false}
      fq.konfirmasiBaru=false;openModal({t:'temuan',f:fq});return saveForm(fq.lagiTmp)}
    case 'miripBaru': {var mn=S.modal,fn=mn.f;fn.konfirmasiBaru=true;openModal({t:'temuan',f:fn});return saveForm(fn.lagiTmp)}
    case 'miripBatal': {var fb=S.modal.f;openModal({t:'temuan',f:fb});return}
    case 'lokpilih': return openModal({t:'lokpilih'});
    case 'filterbuka': return openModal({t:'filter'});
    case 'menuaksi': return openModal({t:'aksi'});
    case 'fclr2': {var s0=ensureSel(tree());S.flt={rid:S.flt.rid,q:S.flt.q,st:S.flt.st,bd:'',tk:'',el:''};if(S.modal&&S.modal.t==='filter')renderOverlay();refreshList();render();return}
    case 'kmenu': return openModal({t:'kmenu',d:findDefect(id)});
    case 'fotodetail': {var df=findDefect(id);if(df)openModal({t:'ttx',d:df});return}   // lencana +N di kartu: semua ukuran layar
    case 'rmtoggle': {var ur=document.querySelector('.sheet .note.ur');if(ur){var o=ur.classList.toggle('open');el.textContent=o?'Tutup sebagian':'Baca selengkapnya'}return}
    case 'ttx': {var dt=findDefect(id);if(dt)openModal({t:'ttx',d:dt});return}
    case 'unggah': return openModal({t:'unggah',d:findDefect(id),j:el.getAttribute('data-j')||'after'});
    case 'mfoto': readForm();return pick(!!el.getAttribute('data-cam'),function(items){modalFotos(S.modal.f,items)});
    case 'upretry': {var jr=S.up.filter(function(x){return String(x.k)===el.getAttribute('data-k')})[0];if(jr){jr.st='wait';upUi(jr.did);runQueue()}return}
    case 'upbuang': {var jb=S.up.filter(function(x){return String(x.k)===el.getAttribute('data-k')})[0];S.up=S.up.filter(function(x){return x!==jb});if(jb){qDel(jb.k);upUi(jb.did)}return}
    case 'drafkirim': {if(navigator.onLine===false)toast('Belum ada sinyal.');drafKirim();return}
    case 'drafbuka': return drafBuka();
    case 'mdel': readForm();S.modal.f.files.splice(+el.getAttribute('data-i'),1);return mphRefresh();
    case 'msimpan': return saveForm(false);
    case 'msimpanlagi': return saveForm(true);
    case 'pdfbidang': {var sb=ensureSel(tree());var lb=lsGet('dl-bidang');openModal({t:'pdfbidang',g:sb?sb.g.nama:'',b:BIDANG.indexOf(lb)>=0?lb:BIDANG[0]});return}
    case 'pdfbidangya': {var pg=$('pbG').value,pb=$('pbB').value;lsSet('dl-bidang',pb);closeModal();return exportPdfBidang(pg,pb)}
    case 'rgmuat': {S.rg.gagal=false;var pk=await work('Memuat...',function(){return api('registri_pakai')});if(pk){S.rg.pakai=pk;render()}return}
    case 'rgatur': {openModal({t:'rgatur',j:el.getAttribute('data-j'),area:rgArea(),k:el.getAttribute('data-k')||'',n:el.getAttribute('data-n')||'',bidang:el.getAttribute('data-b')||'',nama:el.getAttribute('data-nama')||''});return}
    case 'rgpem': {
      var mp=S.modal;closeModal();
      var np=await jalankanRegistri('registri_pemisah',{area:mp.area,kelompok:mp.k,pemisah:el.getAttribute('data-v')},'Menulis ulang titik');
      if(np!==null){await rgSegarkan();toast('Pemisah diubah. '+np+' temuan diperbarui.')}return;
    }
    case 'rggabung': {
      var mg0=S.modal,sT=$('rgTujuan'),tujuan0=sT?sT.value:'';
      if(!tujuan0){toast('Pilih entri tujuan lebih dulu.');return}
      var nn=rgPakaiEntri(mg0);
      openModal({t:'rgyakin',m:mg0,tujuan:tujuan0,n:nn});return;
    }
    case 'rgyakinya': {
      var yk=S.modal,mg=yk.m;closeModal();
      var pg={jenis:mg.j,area:mg.area,bidang:mg.bidang,kelompok:mg.k,dari:mg.j==='kelompok'?mg.k:mg.j==='kode'?mg.n:mg.nama,ke:yk.tujuan};
      var ng=await jalankanRegistri('registri_gabung',pg,'Menggabungkan');
      if(ng!==null){await rgSegarkan();toast('Digabung. '+ng+' temuan diperbarui.')}return;
    }
    case 'rghapus': {
      var mh=S.modal;closeModal();
      var rh=await work('Menghapus...',function(){return api('registri_hapus',{jenis:mh.j,area:mh.area,bidang:mh.bidang,kelompok:mh.k,nama:mh.j==='kode'?mh.n:mh.nama})});
      if(rh){await rgSegarkan();toast('Dihapus.')}return;
    }
    case 'rgseed': {
      var ek=expansiKode($('rgD').value,$('rgS').value);
      if(ek.err){toast(ek.err);return}
      if(!L.rapi($('rgK').value)){toast('Isi Kelompok. Untuk grid tanpa kelompok, ketik langsung di form temuan.');return}
      var rs=await work('Menambahkan...',function(){return api('registri_seed',{area:rgArea(),kelompok:$('rgK').value,pemisah:$('rgP').value,daftarKode:ek.kode})});
      if(rs){await rgSegarkan();toast(rs.kodeBaru+' kode ditambahkan'+(rs.kelompokBaru?', kelompok baru':'')+'.')}return;
    }
    case 'wgo': {var wf=S.modal.f,wv=el.getAttribute('data-v');
      if(wf.step==='lokasi'&&!wLanjutLokasi(wf))return;
      return wStep(wv)}
    case 'wback': {var wb=S.modal.f,mp={foto:'lokasi',detail:desk()?'lokasi':'foto',elemen:'detail',titik:'detail'};
      if(wb.step==='lokasi'||(desk()&&wb.step==='detail'))return closeModal();
      if(wb.step==='titik'){fBaca();var tt=fTitik(wb,false);if(!tt.ok){toast(tt.err);return}}
      return wStep(mp[wb.step]||'lokasi')}
    case 'wbid': {fBaca();var wd=S.modal.f,nb=el.getAttribute('data-v');if(nb===wd.bidang)return;
      if(wd.id){wd.bidang=nb;return fRender()}
      wd.bidang=nb;wd.conf={};wd.elemen='';var ss=ensureSel(tree());fAtur(wd,ss?ss.r:null);return wStep('lokasi')}
    case 'wpakai': {var po=wTerakhir(),wp=S.modal.f;if(!po)return;fBaca();   // simpan isian lain dulu; lokasi diatur di bawah
      wp.bidang=po.bidang;wp.gedung=po.gedung;wp.lantai=po.lantai;wp.gMode=false;wp.lMode=false;wp.conf={};
      wp.lok=po.lok;wp.ruang=po.lok==='ruang'?po.ruang:'';wp.mode=BID_RUANG[wp.bidang]?'tanpa':(wp.mode==='tanpa'?(wp.bidang==='Struktur'?'grid':'teks'):wp.mode);
      return wStep('foto',true)}
    case 'wsev': {fBaca();S.modal.f.tingkat=el.getAttribute('data-v');return wStep('detail')}
    case 'wtutupel': {fBaca();S.modal.f.bukaEl=false;return fRender()}
    case 'welbuka': {S.modal.f.elq='';return wStep('elemen')}
    case 'welpick': {fBaca();return wPilihElemen(el.getAttribute('data-v'))}
    case 'weltambah': {fBaca();return wPilihElemen(L.rapi(el.getAttribute('data-v')))}
    case 'wtitik': return wStep('titik');
    case 'wtitikok': {fBaca();var wt=S.modal.f,tk=fTitik(wt,true);if(!tk.ok)return fGalat(tk.err);var bk=fPeriksaDaftar(wt);if(bk)return fGalat(bk[1],bk[0]);return wStep('detail')}
    case 'wkel': {fBaca();var wk=S.modal.f,ak=el.getAttribute('data-ax'),kv=el.getAttribute('data-v');
      if(ak==='kd'){wk.kd.k=kv;wk.kd.n=''}else{if(wk[ak].k1!==kv){wk[ak].n1='';wk[ak].n2=''}wk[ak].k1=kv}
      wk.baru=null;return fRender()}
    case 'wbaru': {S.modal.f.baru={ax:el.getAttribute('data-ax'),j:el.getAttribute('data-j')};fRender();var bi=$('wbaru');if(bi)bi.focus();return}
    case 'wbarux': S.modal.f.baru=null;return fRender();
    case 'wbarugo': return wBaruSimpan(S.modal.f);
    case 'wkod': {fBaca();wTapKode(S.modal.f,el.getAttribute('data-ax'),el.getAttribute('data-v'));return fRender()}
    case 'wabc': S.modal.f.abc=!S.modal.f.abc;return fRender();
    case 'wkey': {var wy=S.modal.f,kk=el.getAttribute('data-v'),cc=el.getAttribute('data-c');
      if(cc!==null){wy.kd.n=cc}else if(kk==='bs')wy.kd.n=(wy.kd.n||'').slice(0,-1);else if((wy.kd.n||'').length<10)wy.kd.n=(wy.kd.n||'')+kk;
      return fRender()}
    case 'wteks': {S.modal.f.teks=el.getAttribute('data-v');return fRender()}
    case 'wtutup': return closeModal();
    case 'flok': {fBaca();var ff=S.modal.f;ff.lok=el.getAttribute('data-v');ff.conf={};cbTutup();return fRender()}
    case 'fmode': {fBaca();S.modal.f.mode=el.getAttribute('data-v');cbTutup();return fRender()}
    case 'fpem': {S.modal.f.pemBaru[el.getAttribute('data-k')]=el.getAttribute('data-v');return fSegar()}
    case 'mtutup': case 'modalbg': return closeModal();
    case 'mulai': {
      /* Optimistik: kartu langsung berubah, server mengonfirmasi di belakang; bila gagal, kartu dikembalikan. */
      var salin=semuaSalinan(id);if(!salin.length){return}
      var lama=salin.map(function(c){return {c:c,mulai:c.mulai,diisiOleh:c.diisiOleh,status:c.status}}),now=new Date(),iso=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
      salin.forEach(function(c){c.mulai=iso;c.diisiOleh=S.user&&S.user.nama||'';if(c.status==='Open')c.status='Dalam proses'});
      toast('Perbaikan dicatat dimulai.');render();
      try{var r=await api('perbaikan_mulai',{id:id});if(r){putDefect(r);render()}}
      catch(e){lama.forEach(function(o){if(o.mulai===undefined)delete o.c.mulai;else o.c.mulai=o.mulai;if(o.diisiOleh===undefined)delete o.c.diisiOleh;else o.c.diisiOleh=o.diisiOleh;o.c.status=o.status});render();gagal(e)}
      return;
    }
    case 'verif': return openModal({t:'verif',d:findDefect(id)});
    case 'vset': {
      var d=S.modal.d,cat=$('vC').value,h=el.getAttribute('data-h');
      closeModal();
      /* Optimistik hanya untuk hasil yang pasti: temuan tanpa memo yang Diterima (Close) atau Ditolak (kembali diproses). Bermemo dan pembatalan menunggu server. */
      var asli=findDefect(d.id)||d;
      if((h==='Diterima'||h==='Ditolak')&&!asli.memoId&&navigator.onLine!==false){
        var awO=S.view==='verif'?kartuPosisi():null,baru=Object.assign({},asli,{verifikasi:h,catatan:String(cat||'').trim().slice(0,1000),tglVerif:hariIni(),verifOleh:S.user&&S.user.nama||'',status:h==='Diterima'?'Close':'Dalam proses',siap:false,perlu:h==='Ditolak'});
        if(awO)await kartuKeluar(d.id);
        putDefect(baru);toast(h==='Diterima'?'Diterima. Temuan Close.':'Ditolak. Temuan kembali dalam proses.');render();if(awO)kartuNaik(awO);
        try{var rr=await api('verifikasi',{id:d.id,hasil:h,catatan:cat});if(rr){putDefect(rr);if(M_)M_.muatDaftar();render()}}
        catch(e){putDefect(asli);render();gagal(e);openModal({t:'verif',d:asli})}
        return;
      }
      var r2=await work('Menyimpan verifikasi...',function(){return api('verifikasi',{id:d.id,hasil:h,catatan:cat})});
      if(r2){var aw2=S.view==='verif'?kartuPosisi():null;if(aw2&&!r2.siap)await kartuKeluar(r2.id);putDefect(r2);if(M_)M_.muatDaftar();toast(h==='Diterima'?(r2.memoId&&r2.status!=='Close'?'Diterima. Temuan Close setelah memo lengkap (tanda tangan QC).':'Diterima. Temuan Close.'):h==='Ditolak'?'Ditolak. Temuan kembali dalam proses.':'Verifikasi dibatalkan.');render();if(aw2)kartuNaik(aw2)}
      else openModal({t:'verif',d:d});
      return;
    }
    case 'hapus': return openModal({t:'hapus',d:findDefect(id)});
    case 'hapusya': {
      var dd=S.modal.d;closeModal();
      var r3=await work('Menghapus...',function(){return api('defect_hapus',{id:dd.id})});
      if(r3){var awal=kartuPosisi();await kartuKeluar(dd.id);dropDefect(dd.id,dd.ruanganId);if(isAdmin())toastAksi('Temuan dihapus.','Urungkan',function(){urungkanHapus(dd)});else toast('Temuan dihapus.');render();kartuNaik(awal)}return;
    }
    case 'fadd': {var fa=S.modal&&S.modal.f;if(!fa)return;pick(!!el.getAttribute('data-cam'),function(items){fotoCoret(fa.id,items,'before')});return}
    case 'fcoret': {var fc=S.modal&&S.modal.f;if(!fc)return;readForm();return coretTersimpan({d:fc.id,j:el.getAttribute('data-j')==='after'?'after':'before',f:el.getAttribute('data-f')})}
    case 'fdel': {var fd=S.modal&&S.modal.f;if(fd){fd.hapusFoto=el.getAttribute('data-f');fotoEditRefresh()}return}
    case 'fdelbatal': {var fb=S.modal&&S.modal.f;if(fb){fb.hapusFoto=null;fotoEditRefresh()}return}
    case 'fdelya': {
      var fy=S.modal&&S.modal.f;if(!fy||!isAdmin())return;
      readForm();
      var r5=await work('Menghapus foto...',function(){return api('foto_hapus',{id:fy.id,jenis:el.getAttribute('data-j'),fotoId:el.getAttribute('data-f')})});
      fy.hapusFoto=null;if(r5){putDefect(r5);render()}fotoEditRefresh();return;
    }
    case 'delfoto': {
      var r4=await work('Menghapus foto...',function(){return api('foto_hapus',{id:id,jenis:el.getAttribute('data-j'),fotoId:el.getAttribute('data-f')})});
      if(r4){putDefect(r4);render()}return;
    }
    case 'pdf': return exportPdf();
    case 'xlsx': return exportXlsx();
    case 'rkall': S.rkAll=!S.rkAll;return render();
    case 'rfset': {var pv=String(el.getAttribute('data-v')||'').split('|'),rk0=pv[0],rv0=pv.slice(1).join('|');
      if(RF[rk0]===rv0)RF[rk0]='';else{RF[rk0]=rv0;if(rk0==='ak')RF.st='';if(rk0==='st')RF.ak=''}
      if(!S.all&&!S.allBusy){var okm=await work('Memuat semua temuan...',loadAll);if(!okm)return}
      render();var sc=$('rfsec');if(sc&&sc.scrollIntoView&&rk0==='ak')sc.scrollIntoView({block:'start',behavior:'smooth'});return}
    case 'rfbuka': {var rid0=el.getAttribute('data-d');if(RF.buka[rid0])delete RF.buka[rid0];else RF.buka[rid0]=1;return render()}
    case 'rfg': {var gv=el.getAttribute('data-v');S.rkG=S.rkG===gv?'':gv;return render()}
    case 'rfclr': RF.bd='';RF.st='';RF.ak='';S.rkG='';return render();
    case 'rfn': RF.n=parseInt(el.getAttribute('data-v'),10)||0;lsSet('dl-rfn',String(RF.n));return render();
    case 'rekapall': {var ok=await work('Memuat semua temuan...',loadAll);if(ok)render();return}
    case 'addroom': return tambahRuangan();
    case 'addgedung': return tambahGedung();
    case 'kllbaru': return tambahLantai(el.getAttribute('data-g'),el.getAttribute('data-i'));
    case 'kltab': S.klTab=el.getAttribute('data-v');lsSet('dl-kltab',S.klTab);return render();
    case 'klisu': S.klIsuOpen=S.klIsuOpen===false;return render();
    case 'klisuall': S.klIsuAll=!S.klIsuAll;return render();
    case 'klg': {var kg0=el.getAttribute('data-g'),T0=tree(),buka0=!!String(S.klq||'').trim()||S.klOpen[kg0]===true||(T0.length===1&&S.klOpen[kg0]!==false);S.klOpen[kg0]=!buka0;return render()}
    case 'klsemua': {var ov=el.getAttribute('data-v')==='1';tree().forEach(function(g){S.klOpen[g.nama]=ov});S.klq='';return render()}
    case 'kltambah': S.klTambah=!S.klTambah;return render();
    case 'klnon': S.klNon=!S.klNon;render();if(S.klNon&&!S.klNonList)klMuatNon();return;
    case 'klakt': {
      var ra=await work('Mengaktifkan...',function(){return api('ruangan_aktifkan',{ids:[el.getAttribute('data-r')]})});
      if(ra){if(ra.ditolak&&ra.ditolak.length)toast(ra.ditolak[0].alasan);else toast('Ruangan diaktifkan.');S.klNonList=null;await loadRooms();klMuatNon()}return;
    }
    case 'klrapi': {
      var rp=await work('Menyimpan...',function(){var x=S.rooms.filter(function(q){return q.id===el.getAttribute('data-r')})[0];return api('ruangan_ubah',{id:x.id,gedung:x.gedung,lantai:x.lantai,ruangan:el.getAttribute('data-n')})});
      if(rp){S.defects={};S.all=null;await loadRooms();toast('Ruangan diperbarui.')}return;
    }
    case 'klmirip': {var rmi=S.rooms.filter(function(x){return x.id===el.getAttribute('data-r')})[0];if(rmi)openModal({t:'ruang',r:rmi,pre:{n:el.getAttribute('data-n')}});return}
    case 'klxls': return exportRuangan();
    case 'glubah': return openModal({t:'glubah',k:el.getAttribute('data-k'),g:el.getAttribute('data-g'),l:el.getAttribute('data-l')||'',nama:el.getAttribute('data-n')});
    case 'glsimpan': {
      var gm=S.modal,nn=$('glN').value;closeModal();
      var rg=await work('Menyimpan...',function(){return gm.k==='g'?api('gedung_ubah',{nama:gm.g,baru:nn}):api('lantai_ubah',{gedung:gm.g,lantai:gm.l,baru:nn})});
      if(rg){toast('Nama diubah.');await klSesudahMaster(rg,true)}return;
    }
    case 'glgeser': {
      var kk=el.getAttribute('data-k'),dd=parseInt(el.getAttribute('data-d'),10),gg=el.getAttribute('data-g'),ll=el.getAttribute('data-l');
      var rgs=await work('Mengubah urutan...',function(){return kk==='g'?api('gedung_ubah',{nama:gg,geser:dd}):api('lantai_ubah',{gedung:gg,lantai:ll,geser:dd})});
      if(rgs){toast('Urutan diubah.');await klSesudahMaster(rgs,false)}return;
    }
    case 'glaktif': {
      var ak=el.getAttribute('data-k'),av=el.getAttribute('data-v')==='1',ac=parseInt(el.getAttribute('data-c'),10)||0;
      if(!av&&ac)return openModal({t:'glnon',k:ak,g:el.getAttribute('data-g'),l:el.getAttribute('data-l')||'',c:ac});
      return glAktif(ak,el.getAttribute('data-g'),el.getAttribute('data-l')||'',av);
    }
    case 'glnonya': {var gn=S.modal;closeModal();return glAktif(gn.k,gn.g,gn.l,false)}
    case 'fst': S.flt.st=el.getAttribute('data-v')||'';return refreshList();
    case 'aqclr': if(AQ[S.view]){var pn0=AQ[S.view].pn;AQ[S.view]=aqBaru();AQ[S.view].pn=pn0}return render();
    case 'aqmenu': return openModal({t:'aqmenu'});
    case 'aqst': if(AQ[S.view]){AQ[S.view].st=el.getAttribute('data-v')||'';AQ[S.view].n=60}return render();
    case 'aqcari': {var tb0=$('tbar');if(AQ[S.view]&&tb0&&tb0.classList.contains('min')&&!AQ[S.view].qo){AQ[S.view].qo=1;render();var qi=$('aqq');if(qi)qi.focus()}return}
    case 'aqpn': if(AQ[S.view])AQ[S.view].pn=AQ[S.view].pn?0:1;return render();
    case 'pdfsemua': return exportPdfSemua();
    case 'aqsy': if(AQ[S.view]){AQ[S.view].sy=el.getAttribute('data-v')==='1'?1:0;AQ[S.view].n=60}render();return aqMenuRe();
    case 'aqmm': if(AQ[S.view]){AQ[S.view].mm=el.getAttribute('data-v')==='1'?1:0;AQ[S.view].n=60}render();return aqMenuRe();
    case 'aqlebih': if(AQ[S.view])AQ[S.view].n=(AQ[S.view].n||60)+60;return render();
    case 'muatsemua': S.all=null;S.allErr=false;S.allBusy=false;return render();
    case 'tmode': S.semua=el.getAttribute('data-v')==='semua';lsSet('dl-semua',S.semua?'1':'0');return render();
    case 'aqtl': if(AQ[S.view])AQ[S.view].tl=el.getAttribute('data-v')==='1'?1:0;render();return aqMenuRe();
    case 'fclr': S.flt={rid:S.flt.rid,q:'',st:'',bd:'',tk:'',el:''};return render();
    case 'zipg': S.zipOff[el.getAttribute('data-g')]=!el.checked;return;
    case 'zipgo': return exportZip();
    case 'zipbatal': S.zipStop=true;S.busy='Membatalkan...';return renderOverlay();
    case 'ubahroom': {var rr=S.rooms.filter(function(x){return x.id===el.getAttribute('data-r')})[0];if(rr)openModal({t:'ruang',r:rr});return}
    case 'rsimpan': {
      var rm=S.modal.r,g=$('rG').value,l=$('rL').value,n=$('rN').value,dt=$('rD').value;
      var kk=LOGIKA.kunci(g)+'|'+LOGIKA.kunciLantai(l)+'|'+LOGIKA.kunci(n);
      var sama=S.rooms.filter(function(x){return x.id!==rm.id&&LOGIKA.kunci(x.gedung)+'|'+LOGIKA.kunciLantai(x.lantai)+'|'+LOGIKA.kunci(x.nama)===kk})[0];
      if(sama){var pv=await work('Memeriksa...',function(){return api('ruangan_pratinjau',{id:rm.id,ke:sama.id})});if(!pv)return;
        return openModal({t:'gabung',r:rm,g:sama.gedung,l:sama.lantai,n:sama.nama,d:dt,gd:g,gl:l,gn:n,pv:pv})}
      closeModal();
      var r5=await work('Menyimpan...',function(){return api('ruangan_ubah',{id:rm.id,gedung:g,lantai:l,ruangan:n,detail:dt})});
      if(r5){S.defects={};S.all=null;await loadRooms();toast('Ruangan diperbarui.')}return;
    }
    case 'gabungya': {
      var mg=S.modal;closeModal();
      var r9=await work('Menggabung...',function(){return api('ruangan_ubah',{id:mg.r.id,gedung:mg.gd,lantai:mg.gl,ruangan:mg.gn,detail:mg.d,gabung:true})});
      if(r9){S.defects={};S.all=null;await loadRooms();toast('Digabung. '+(r9.diperbarui||0)+' temuan dipindah.')}return;
    }
    case 'delroom': {var r6=S.rooms.filter(function(x){return x.id===el.getAttribute('data-r')})[0];if(r6)openModal({t:'nonaktif',r:r6});return}
    case 'nonya': {
      var rn=S.modal.r;closeModal();
      var r7=await work('Menyimpan...',function(){return api('ruangan_hapus',{ids:[rn.id]})});
      if(r7){S.klNonList=null;await loadRooms();toast('Ruangan dinonaktifkan.');if(S.klNon)klMuatNon()}return;
    }
    case 'lihatsampah': {var t=await work('Memuat...',function(){return api('defect_terhapus')});if(t){S.terhapus=t;render()}return}
    case 'pulih': {
      var r8=await work('Memulihkan...',function(){return api('defect_pulihkan',{id:id})});
      if(r8){S.terhapus=S.terhapus.filter(function(x){return x.id!==id});delete S.defects[r8.ruanganId];S.all=null;await loadRooms();toast('Temuan dipulihkan.')}return;
    }
    case 'setelan': return openModal({t:'set'});
    case 'tema': S.tema=el.getAttribute('data-v');lsSet('dl-tema',S.tema);applyTema();return renderOverlay();
    case 'bersih': return bersihCache();
    case 'anim': S.anim=el.getAttribute('data-v');lsSet('dl-anim',S.anim);applyAnim();return renderOverlay();
    case 'muatsiap': S.siap=null;S.siapErr='';render();return loadSiap();
    case 'muatperlu': S.perlu=null;S.perluErr='';render();return loadPerlu();
    case 'batalmulai': return openModal({t:'batalmulai',d:findDefect(id)});
    case 'batalmulaiya': {
      var bd=S.modal.d;closeModal();
      var rb=await work('Membatalkan...',function(){return api('perbaikan_mulai',{id:bd.id,batal:true})});
      if(rb){putDefect(rb);toast('Mulai perbaikan dibatalkan.');render()}return;
    }
    case 'permanen': return openModal({t:'permanen',d:S.terhapus.filter(function(x){return x.id===id})[0]});
    case 'permanenya': {
      var pd=S.modal.d;closeModal();
      var r9=await work('Menghapus permanen...',function(){return api('defect_hapus_permanen',{id:pd.id})});
      if(r9){S.terhapus=S.terhapus.filter(function(x){return x.id!==pd.id});toast('Temuan dihapus permanen.');render()}return;
    }
    case 'imptpl': return unduhTemplate();
    case 'impfile': {var fx=$('fXls');fx.value='';return fx.click()}
    case 'impbatal': S.imp=null;S.impRes=null;return render();
    case 'impgo': return jalankanImpor();
    case 'tutupfile': return closeFile();
    case 'bagi': try{await navigator.share({files:[S.file.fileObj],title:S.file.name})}catch(e){}return;
  }
}
document.addEventListener('click',onClick);
['gesturestart','gesturechange'].forEach(function(t){document.addEventListener(t,function(e){if(!(e.target.closest&&e.target.closest('.ov.zoom')))e.preventDefault()},{passive:false})});
document.addEventListener('change',function(e){
  if((e.target.id==='pbG'||e.target.id==='pbB')&&$('pbinfo')){var ti=pbInfo($('pbG').value,$('pbB').value);if(ti)$('pbinfo').textContent=ti;return}
  if(e.target.id==='rkG'){S.rkG=e.target.value;render();return}
  if(e.target.getAttribute&&e.target.getAttribute('data-rg')==='area'){S.rg.area=e.target.value;render();return}
  if((e.target.id==='fG'||e.target.id==='fL')&&S.modal&&S.modal.t==='temuan'){
    fBaca();var fg=S.modal.f;fg.konfirmasiBaru=false;
    if(e.target.id==='fG'){
      if(fg.gMode){fg.gedung='';fg.lantai='';fg.lMode=true}
      else{var gx=tree().filter(function(x){return x.nama===fg.gedung})[0];fg.lMode=false;if(gx&&gx.lantai.length&&!gx.lantai.some(function(l){return l.nama===fg.lantai}))fg.lantai=gx.lantai[0].nama}
    }else if(fg.lMode)fg.lantai='';
    cbTutup();fRender();return;
  }
  if(e.target.id==='mB'&&S.modal&&S.modal.t==='temuan'){
    fBaca();var f0=S.modal.f;
    if(!f0.id){f0.conf={};var s0=ensureSel(tree());fAtur(f0,s0?s0.r:null);var mm0=fModeElemen(f0);if(mm0)f0.mode=mm0}
    cbTutup();fRender();return;
  }
  var fk=e.target.getAttribute&&e.target.getAttribute('data-fil');if(fk){S.flt[fk]=e.target.value;refreshList();return}
  var ak=e.target.getAttribute&&e.target.getAttribute('data-aq');
  if(ak&&AQ[S.view]){var aa=AQ[S.view];aa[ak]=e.target.value;if(ak==='gd')aa.lt='';aa.n=60;render();aqMenuRe();return}
  var k=e.target.getAttribute&&e.target.getAttribute('data-sel');if(!k)return;
  var T=tree(),v=e.target.value;
  if(k==='g'){S.sel={g:v,l:'',r:''}}else if(k==='l'){S.sel={g:S.sel.g,l:v,r:''}}else S.sel={g:S.sel.g,l:S.sel.l,r:v};
  var s=ensureSel(T);lsSet('dl-sel',JSON.stringify(S.sel));render();if(S.modal&&S.modal.t==='lokpilih')renderOverlay();loadDefects(s.r.id,false);
});
document.addEventListener('input',function(e){
  if(e.target.id==='teks'&&S.modal&&S.modal.f&&!S.modal.f.id&&!S.modal.f.lama){var tf=S.modal.f;tf.teks=e.target.value;var tl=$('tkl');if(tl)tl.innerHTML=wTeksSaran(tf);fSegar();return}
  if(e.target.id==='elq'&&S.modal&&S.modal.f){S.modal.f.elq=e.target.value;var ll=$('ell');if(ll)ll.innerHTML=wElemenList(S.modal.f);return}
  if(e.target.id==='fq'){S.flt.q=e.target.value;refreshList();return}
  if(e.target.id==='aqq'&&AQ[S.view]){AQ[S.view].q=e.target.value;aqSegar();return}
  if(e.target.id==='klq'){S.klq=e.target.value;var kl=$('kllist');if(kl)kl.innerHTML=klListHtml();return}
  if(e.target.id==='kode'){
    var v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);e.target.value=v;S.kode=v;
    var cs=document.querySelectorAll('#boxes .cb'),i,prev=e.target._n||0;
    for(i=0;i<cs.length;i++){cs[i].textContent=v[i]||'';cs[i].classList.toggle('f',i<v.length);cs[i].classList.toggle('on',i===Math.min(v.length,5))}
    if(v.length>prev){for(i=prev;i<v.length;i++)(function(k){setTimeout(function(){akUlang(cs[k],'jatuh',480);if(cs[k+1])akUlang(cs[k+1],'jejak',620)},(k-prev)*60)})(i)}
    else if(v.length<prev){for(i=v.length;i<prev;i++)akUlang(cs[i],'hapus',300)}
    e.target._n=v.length;
    var w=e.target.parentNode;if(w)w.classList.remove('bad');
    return;
  }
  var row=e.target.closest&&e.target.closest('.row');if(row)row.classList.remove('bad')});
document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='kode'){e.preventDefault();masuk()}if(e.key==='Enter'&&e.target.id==='wbaru'&&S.modal&&S.modal.f){e.preventDefault();wBaruSimpan(S.modal.f)}});
/* kotak pilihan pada form temuan */
if(window.visualViewport){['resize','scroll'].forEach(function(ev){window.visualViewport.addEventListener(ev,function(){if(AKTIFCB)cbPosisi(AKTIFCB)})})}
function cbAktifForm(){return !!(S.modal&&S.modal.t==='temuan')}
document.addEventListener('pointerdown',function(e){
  if(!cbAktifForm())return;
  var o=e.target.closest&&e.target.closest('.cko[data-id]');
  if(o){e.preventDefault();cbPilih(o.getAttribute('data-id'),o.getAttribute('data-v'),!!o.getAttribute('data-tambah'));return}
  if(AKTIFCB&&!(e.target.closest&&e.target.closest('.ck')))cbTutup();
});
document.addEventListener('focusin',function(e){
  if(!cbAktifForm())return;var id=e.target.getAttribute&&e.target.getAttribute('data-cb');
  if(id){fBaca();cbBuka(id)}
});
document.addEventListener('input',function(e){
  if(!cbAktifForm())return;var id=e.target.getAttribute&&e.target.getAttribute('data-cb');
  if(id){delete S.modal.f.conf[id];AKTIFCB=id;IDXCB=-1;cbIsi(id,e.target.value);fSegar();return}
  if(e.target.closest&&e.target.closest('#overlay'))fSegar();
});
document.addEventListener('keydown',function(e){
  if(!AKTIFCB)return;var box=$(AKTIFCB+'_l');if(!box||box.classList.contains('hide'))return;
  var os=[].slice.call(box.querySelectorAll('.cko[data-id]'));if(!os.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();IDXCB=(IDXCB+(e.key==='ArrowDown'?1:-1)+os.length)%os.length;os.forEach(function(o,i){o.classList.toggle('on',i===IDXCB);o.setAttribute('aria-selected',i===IDXCB?'true':'false')});$(AKTIFCB).setAttribute('aria-activedescendant',os[IDXCB].id);os[IDXCB].scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'&&IDXCB>=0){e.preventDefault();var o=os[IDXCB];cbPilih(o.getAttribute('data-id'),o.getAttribute('data-v'),!!o.getAttribute('data-tambah'))}
});
/* Escape menutup lapisan teratas; Tab berputar di dalam dialog yang terbuka. */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(S.busy)return;
    if(cbAktif()){cbTutup();return}
    if(S.zoom){closeZoom();return}
    if(S.file){closeFile();return}
    if(S.modal){closeModal();return}
  }
  if(e.key==='Tab'&&overlay.firstChild){
    var fs=Array.prototype.filter.call(overlay.querySelectorAll('button,a[href],input,select,textarea,[tabindex]'),function(x){return !x.disabled&&x.tabIndex>=0&&x.offsetParent!==null});
    if(!fs.length){e.preventDefault();return}
    var first=fs[0],last=fs[fs.length-1],a=document.activeElement;
    if(!overlay.contains(a)){e.preventDefault();first.focus();return}
    if(e.shiftKey&&a===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&a===last){e.preventDefault();first.focus()}
  }
});
/* Pengganti onload/onerror inline pada thumbnail (tahap capture, karena load/error tidak menggelembung). */
document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.closest&&t.closest('.thumb')){t.style.opacity='';t.classList.add('in');t.closest('.thumb').classList.add('ok')}},true);   // opacity dibersihkan: foto cadangan yang berhasil dimuat tidak boleh tetap redup
document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.classList.contains('zmain')){var o=t.closest('.ov.zoom');if(o)o.classList.add('ld')}},true);
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.closest&&t.closest('.thumb')){t.classList.add('in');t.style.opacity=.25;var th=t.closest('.thumb');setTimeout(function(){th.classList.add('ok')},6000)}},true);   // kilau berhenti setelah cadangan foto sempat mencoba

async function tambahRuangan(){
  var g=$('klG').value,l=$('klL').value,n=$('klN').value;
  S.kl={g:g,l:l,n:n};
  var baris=[];
  n.split(/\r?\n/).forEach(function(line){
    line=line.trim();if(!line)return;
    var p=line.split('\t');
    if(p.length>=3)baris.push({gedung:p[0],lantai:p[1],ruangan:p.slice(2).join(' ')});
    else baris.push({gedung:g,lantai:l,ruangan:line});
  });
  if(!baris.length){toast('Isi minimal satu ruangan.');return}
  if(baris.some(function(b){return !b.gedung.trim()||!b.lantai.trim()})){toast('Gedung dan lantai wajib diisi.');return}
  var r=await work('Menambah ruangan...',function(){return api('ruangan_tambah',{baris:baris})});
  if(r){
    var tolak=r.ditolak||[];
    S.kl={g:g,l:l,n:tolak.map(function(x){return x.nama}).join('\n')};   // baris yang ditolak tetap di kotak supaya bisa diperbaiki
    await loadRooms();
    toast(r.ditambah+' ruangan ditambah'+(r.dilewati?', '+r.dilewati+' sudah ada':'')+(tolak.length?', '+tolak.length+' ditolak: '+tolak[0].alasan:'.'));
    if(tolak.length)render();
  }
}

/* ---------- masuk / keluar ---------- */
function pilihPaket(id,push){
  var p=PAKET_LIST.filter(function(x){return x.id===id})[0];if(!p)return;
  if(push)hpush('paket');
  S.paket=p;lsSet(STORE,id);S.user=null;S.kode=lsGet('dl-kode-'+id)||'';S.loginErr='';S.rooms=[];S.roomsReady=false;S.defects={};S.all=null;S.siap=null;S.perlu=null;S.terhapus=null;
  try{var c=JSON.parse(lsGet('dl-rooms-'+id)||'null');if(c&&c.length){S.rooms=c}}catch(e){}
  S.reg=null;S.regOk=false;try{var cr=JSON.parse(lsGet('dl-reg-'+id)||'null');if(cr&&cr.kode){S.reg=cr;S.regOk=true}}catch(e){}
  S.master=null;try{var cm=JSON.parse(lsGet('dl-master-'+id)||'null');if(cm&&cm.gedung)S.master=cm}catch(e){}
  if(S.kode&&p.apiUrl)return cobaMasuk(true);
  render();
}
function keluar(){
  resetHist(true);
  if(S.paket){lsDel('dl-kode-'+S.paket.id);bersihLokal(S.paket.id)}
  S.up=[];DRAF=[];upBar();S.stale={};S.pv={};S.loading={};S.errs={};S.reg=null;S.regOk=false;S.rg={area:'',pakai:null};S.user=null;S.kode='';S.defects={};S.all=null;S.siap=null;S.perlu=null;S.terhapus=null;S.modal=null;S.zoom=null;S.file=null;S.view='form';renderOverlay();
}
/* ----- animasi kode akses (kelas .ak: memuat, sukses; .codewrap.bad: salah). Mati otomatis di mode hemat animasi. ----- */
function akHemat(){return document.documentElement.classList.contains('hemat')}
function akUlang(el,kelas,ms){if(!el)return;el.classList.remove(kelas);void el.offsetWidth;el.classList.add(kelas);setTimeout(function(){el.classList.remove(kelas)},ms)}
document.addEventListener('animationend',function(e){if(e.animationName==='ak-naik')e.target.classList.remove('ak-masuk')});
function akSukses(){   // gelombang hijau dan centang, lalu lanjut ke aplikasi
  var a=$('ak');if(!a)return Promise.resolve();
  a.classList.remove('memuat','salah');a.classList.add('sukses');
  return akHemat()?Promise.resolve():new Promise(function(r){setTimeout(r,650)});
}
function akKosongkan(){   // setelah kode salah: kosongkan kotak tanpa menggambar ulang layar (galat tetap tampil)
  var i=$('kode');if(i){i.value='';i._n=0}
  var cs=document.querySelectorAll('#boxes .cb');
  for(var k=0;k<cs.length;k++){cs[k].textContent='';cs[k].classList.remove('f','on','jatuh','jejak')}
  if(cs[0])cs[0].classList.add('on');
  var w=document.querySelector('.codewrap');if(w)w.classList.remove('bad');
  if(i)i.focus({preventScroll:true});
}
async function masuk(){
  var el=$('kode');S.kode=(el?el.value:S.kode).trim().toUpperCase();
  if(!S.kode){S.loginErr='Masukkan kode akses.';return render()}
  return cobaMasuk(false);
}
/* Buka aplikasi dalam satu permintaan (mulai). Server lama yang belum punya aksi ini dilayani lewat masuk + ruangan. */
async function ambilMulai(){
  try{return await api('mulai')}
  catch(e){
    if(e&&e.server&&/Aksi tidak dikenal/i.test(e.message)){var u=await api('masuk');return {nama:u.nama,peran:u.peran}}
    throw e;
  }
}
function aturPengguna(u){
  S.user={nama:u.nama,peran:u.peran,qc:u.qc||'',ta:u.ta||0,qcBidang:u.qcBidang||''};
  var v=lsGet('dl-view');S.view=((v==='rekap'||v==='verif')&&u.peran!=='PJ')||(v==='perbaikan'&&u.peran==='PJ')||(v==='kelola'&&u.peran==='ADMIN')||(v==='memo'&&M_&&M_.punyaTab(u))?v:'form';
  if(S.view!=='form'&&S.hist[S.hist.length-1]!=='view')hpush('view');
  try{var sv=JSON.parse(lsGet('dl-sel')||'null');if(sv&&sv.g)S.sel=sv}catch(e){}
}
async function cobaMasuk(auto){
  var b=$('bMasuk');if(b){
    b.disabled=true;var lb=b.querySelector('.ak-label'),ak0=$('ak');
    if(lb&&ak0){   // percobaan baru: galat sebelumnya dihapus dari layar
      lb.textContent='Memeriksa...';S.loginErr='';
      Array.prototype.forEach.call(ak0.querySelectorAll('.err,.errbox'),function(x){x.remove()});
      var cw=ak0.querySelector('.codewrap');if(cw)cw.classList.remove('bad');
      ak0.classList.remove('salah','sukses');ak0.classList.add('memuat');
    }
    else b.innerHTML='<span class="spin"></span>Memeriksa...';
  }
  var pid=S.paket.id,cu=null;
  if(auto){try{cu=JSON.parse(lsGet('dl-user-'+pid)||'null')}catch(e){}}
  // Buka kembali: tampilkan dulu dari data tersimpan, periksa kode ke server di belakang layar.
  var cepat=!!(auto&&cu&&cu.nama&&cu.peran&&S.rooms.length);
  if(cepat){
    S.roomsReady=true;aturPengguna(cu);render();
    var s0=ensureSel(tree());if(s0&&S.view==='form')loadDefects(s0.r.id,false);
  }else if(auto){app.innerHTML=skel('page')}
  try{
    var r=await ambilMulai();
    if(!auto)await akSukses();
    aturPengguna(r);S.loginErr='';S.net='';
    lsSet('dl-kode-'+pid,S.kode);lsSet('dl-user-'+pid,JSON.stringify({nama:r.nama,peran:r.peran,qc:r.qc||'',ta:r.ta||0,qcBidang:r.qcBidang||''}));
    if(r.ruangan){S.rooms=r.ruangan;S.roomsReady=true;lsSet('dl-rooms-'+pid,JSON.stringify(S.rooms))}
    if(r.siap)S.siap=r.siap;
    if(r.perlu)S.perlu=r.perlu;
    if(r.registri){S.reg=r.registri;S.regOk=true;lsSet('dl-reg-'+pid,JSON.stringify(S.reg))}else{S.reg=null;S.regOk=false}
    if(r.master){S.master=r.master;lsSet('dl-master-'+pid,JSON.stringify(S.master))}
    render();
    if(r.ruangan){var s=ensureSel(tree());if(s&&S.view==='form')loadDefects(s.r.id,false)}
    else loadRooms();
    qPulihkan();drafMuat();if(M_)M_.muatDaftar();
    aksiPintas();
  }catch(e){
    if(e&&e.server){
      if(/Kode tidak dikenal|nonaktif/i.test(e.message||'')){   // hanya kode yang benar-benar ditolak yang dihapus
        var kodeSalah=S.kode;
        S.user=null;S.loginNet=false;S.loginErr=cepat?'':'Kode tidak cocok. Periksa lalu coba lagi.';lsDel('dl-kode-'+pid);lsDel('dl-user-'+pid);
        if(cepat){S.kode='';render();openModal({t:'sesi'});return}
        render();   // kode yang salah tetap terlihat merah dan bergetar, lalu dikosongkan
        try{if(navigator.vibrate)navigator.vibrate(120)}catch(e2){}
        setTimeout(function(){if(S.kode===kodeSalah&&!S.user){S.kode='';akKosongkan()}},akHemat()?0:800);
        return;
      }
      if(cepat){toast(e.message);return}                      // error server lain: tetap pakai tampilan tersimpan
      S.user=null;S.loginNet=false;S.loginErr=e.message;render();return;
    }
    if(cepat){S.net='Tidak terhubung. Menampilkan data terakhir yang tersimpan.';render();drafMuat();return}
    S.user=null;S.loginNet=true;S.loginErr='Tidak terhubung ke server. Periksa sinyal lalu coba lagi.';render();
  }
}

/* ---------- impor temuan dari Excel (ADMIN) ---------- */
var IMP_COLS=[['gedung',['gedung']],['lantai',['lantai']],['ruangan',['ruangan']],['bidang',['bidang']],['tingkat',['tingkat','keparahan']],['tgl',['tanggal temuan','tanggal','tgl','tgl temuan']],['uraian',['uraian temuan','uraian','temuan','temuan / catatan']]];
function normKey(v){return String(v==null?'':v).replace(/\s+/g,' ').trim().toLowerCase()}
function parseTgl(v){
  if(v===''||v==null)return {ok:true,val:today()};
  var y,m,d;
  if(typeof v==='number'){
    if(!(v>20000&&v<80000))return {ok:false};
    var dt=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);y=dt.getUTCFullYear();m=dt.getUTCMonth()+1;d=dt.getUTCDate();
  }else{
    var t=String(v).trim(),a=t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/),b=t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if(a){y=+a[1];m=+a[2];d=+a[3]}else if(b){d=+b[1];m=+b[2];y=+b[3]}else return {ok:false};
  }
  var c=new Date(Date.UTC(y,m-1,d));
  if(c.getUTCFullYear()!==y||c.getUTCMonth()!==m-1||c.getUTCDate()!==d)return {ok:false};
  return {ok:true,val:y+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2)};
}
function impHtml(){
  var im=S.imp,rs=S.impRes;
  var h='<section class="group klimp"><div class="klimph"><div class="klrn"><b>Impor dari Excel</b><span class="note">Tambah banyak temuan sekaligus dari berkas .xlsx</span></div><div class="kla"><button type="button" class="pill" data-act="imptpl">Unduh template</button><button type="button" class="pill go" data-act="impfile">Pilih file</button></div></div>';
  var bad=function(arr){return arr.length?'<details class="klbad"><summary>'+arr.length+' baris bermasalah</summary><ul>'+arr.slice(0,15).map(function(x){return '<li>Baris '+x.baris+': '+esc(x.alasan)+'</li>'}).join('')+(arr.length>15?'<li>dan '+(arr.length-15)+' lainnya.</li>':'')+'</ul></details>':''};
  var st=function(n,t,cls){return n?'<span class="klst'+(cls?' '+cls:'')+'"><b>'+n+'</b> '+t+'</span>':''};
  if(rs){
    h+='<div class="klstats" role="status">'+st(rs.ditambah,'temuan masuk','ok')+st(rs.ruanganBaru,'ruangan baru')+st(rs.dilewati,'duplikat dilewati')+st(rs.ditolak.length,'ditolak','bad')+'</div>'+bad(rs.ditolak)+
      '<div class="acts klimpa"><button type="button" class="pill" data-act="impbatal">Tutup</button></div>';
  }
  if(im){
    h+='<div class="klstats">'+st(im.rows.length,'temuan siap','ok')+st(im.baru,'ruangan baru')+st(im.dupFile,'kembar dalam file dilewati')+st(im.bad.length,'bermasalah, tidak diimpor','bad')+'</div>'+bad(im.bad)+
      '<div class="acts klimpa">'+(im.rows.length?'<button type="button" class="pill go" data-act="impgo">Impor '+im.rows.length+' temuan</button>':'')+'<button type="button" class="pill" data-act="impbatal">Batal</button></div>';
  }
  return h+'</section>';
}
async function unduhTemplate(){
  var ok=await work('Menyusun template...',async function(){await loadLib(XLSX_URL,'XLSX');return true});
  if(!ok)return;
  var X=window.XLSX,wb=X.utils.book_new();
  var ws=X.utils.aoa_to_sheet([['Gedung','Lantai','Ruangan','Bidang','Tingkat','Tanggal temuan','Uraian temuan']]);
  ws['!cols']=[22,14,26,16,12,16,60].map(function(w){return {wch:w}});
  X.utils.book_append_sheet(wb,ws,'Isian');
  var n=Math.max(S.rooms.length,BIDANG.length,TINGKAT.length),rows=[['Gedung','Lantai','Ruangan','','Bidang','Tingkat']];
  for(var i=0;i<n;i++){var r=S.rooms[i];rows.push([r?r.gedung:'',r?r.lantai:'',r?r.nama:'','',BIDANG[i]||'',TINGKAT[i]||'']);}
  var w2=X.utils.aoa_to_sheet(rows);w2['!cols']=[22,14,26,3,16,12].map(function(w){return {wch:w}});
  X.utils.book_append_sheet(wb,w2,'Daftar');
  var out=X.write(wb,{bookType:'xlsx',type:'array'});
  showFile('Template_Impor_Temuan_'+clean(S.paket.nama)+'.xlsx',out,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
async function bacaExcel(file){
  S.impRes=null;
  var rows=await work('Membaca file...',async function(){
    await loadLib(XLSX_URL,'XLSX');
    var buf=await file.arrayBuffer(),wb=window.XLSX.read(buf,{type:'array'});
    var name=wb.SheetNames.filter(function(n){return normKey(n)==='isian'})[0]||wb.SheetNames[0];
    return window.XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''});
  });
  if(!rows)return;
  var hi=-1,map={};
  for(var i=0;i<Math.min(rows.length,15)&&hi<0;i++){
    var m={};rows[i].forEach(function(c,ci){var k=normKey(c);IMP_COLS.forEach(function(d){if(d[1].indexOf(k)>=0&&m[d[0]]===undefined)m[d[0]]=ci})});
    if(m.gedung!==undefined&&m.ruangan!==undefined&&m.uraian!==undefined){hi=i;map=m}
  }
  if(hi<0){toast('Format tidak dikenali. Gunakan template dari tombol Unduh template.');return}
  ['lantai','bidang','tingkat'].forEach(function(k){if(map[k]===undefined)map[k]=-1});
  var have={};S.rooms.forEach(function(r){have[normKey(r.gedung)+'|'+normKey(r.lantai)+'|'+normKey(r.nama)]=1});
  var good=[],bad=[],seen={},baru={},dupFile=0;
  function bakuan(list,v){var k=normKey(v);return list.filter(function(x){return normKey(x)===k})[0]}
  for(var r=hi+1;r<rows.length;r++){
    var row=rows[r],no=r+1,get=function(k){return map[k]<0?'':row[map[k]]};
    if(row.every(function(c){return String(c).trim()===''}))continue;
    var g=String(get('gedung')).replace(/\s+/g,' ').trim(),l=String(get('lantai')).replace(/\s+/g,' ').trim(),n=String(get('ruangan')).replace(/\s+/g,' ').trim(),u=String(get('uraian')).trim();
    var bd=bakuan(BIDANG,get('bidang')),tk=bakuan(TINGKAT,get('tingkat')),tg=parseTgl(get('tgl'));
    var why=!g||!l||!n?'Gedung, lantai, atau ruangan kosong.':!u?'Temuan kosong.':!bd?'Bidang "'+String(get('bidang'))+'" tidak dikenal. Pilihan: '+BIDANG.join(', ')+'.':!tk?'Tingkat "'+String(get('tingkat'))+'" tidak dikenal. Pilihan: '+TINGKAT.join(', ')+'.':!tg.ok?'Tanggal tidak dikenal.':'';
    if(why){bad.push({baris:no,alasan:why});continue}
    var rk=normKey(g)+'|'+normKey(l)+'|'+normKey(n),dk=rk+'|'+tg.val+'|'+normKey(u);
    if(seen[dk]){dupFile++;continue}seen[dk]=1;
    if(!have[rk])baru[rk]=1;
    good.push({baris:no,gedung:g,lantai:l,ruangan:n,bidang:bd,tingkat:tk,tgl:tg.val,uraian:u});
  }
  S.imp={rows:good,bad:bad,dupFile:dupFile,baru:Object.keys(baru).length};
  render();
}
async function jalankanImpor(){
  var rows=S.imp.rows,tot={ditambah:0,ruanganBaru:0,dilewati:0,ditolak:[]},bad=S.imp.bad.length;
  var ok=await work('Mengimpor temuan...',async function(){
    for(var i=0;i<rows.length;i+=300){
      S.busy='Mengimpor '+Math.min(i+300,rows.length)+' dari '+rows.length+'...';renderOverlay();
      var r=await api('defect_impor',{baris:rows.slice(i,i+300)});
      tot.ditambah+=r.ditambah;tot.ruanganBaru+=r.ruanganBaru;tot.dilewati+=r.dilewati;tot.ditolak=tot.ditolak.concat(r.ditolak);
    }
    return true;
  });
  S.defects={};S.all=null;S.siap=null;
  if(ok||tot.ditambah){S.imp=null;S.impRes=tot}
  await loadRooms();
  if(!ok&&tot.ditambah)toast('Sebagian terimpor, lalu terhenti. Periksa hasil sebelum mengulang.');
}

/* ---------- ekspor ---------- */
var libs={};
function loadLib(src,g){
  if(window[g])return Promise.resolve();
  if(libs[src])return libs[src];
  return libs[src]=new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=function(){window[g]?res():rej(new Error('lib'))};s.onerror=function(){delete libs[src];rej(new Error('lib'))};document.head.appendChild(s)});
}
function showFile(name,data,mime){
  var blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),fo=null,can=false;
  try{fo=new File([blob],name,{type:mime});can=!!(navigator.canShare&&navigator.canShare({files:[fo]}))}catch(e){}
  S.file={name:name,url:url,fileObj:fo,canShare:can,size:(data&&data.byteLength)||0,mime:mime};hpush('file');renderOverlay();
}

async function exportXlsx(){
  S.busy='Menyusun Excel...';renderOverlay();
  try{
    await loadLib(XLSX_URL,'XLSX');
    var all=await loadAll();
    var X=window.XLSX,T=tree(),by={};
    all.forEach(function(d){(by[d.ruanganId]=by[d.ruanganId]||[]).push(d)});
    var head=[LBL_GAB.area,LBL_GAB.level,LBL_GAB.lokasi,'No','Bidang','Defect Pekerjaan','Tingkat','Tanggal Temuan','Status','Tanggal Close','Diverifikasi oleh','Catatan MK','Jumlah Foto Before','Jumlah Foto After','Elemen','Titik','Lokasi Detail'];
    var rows=[head],rooms=[];
    var toDate=function(s){return s?new Date(s+'T00:00:00'):''};
    T.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){
      rooms.push([g.nama,l.nama,r.nama]);
      (by[r.id]||[]).forEach(function(d,i){var st=d.status;
        rows.push([g.nama,l.nama,r.nama,d.no||i+1,d.bidang,d.uraian,d.tingkat,toDate(d.tglTemuan),st,st==='Close'?toDate(d.tglVerif):'',d.verifOleh||'',d.catatan||'',d.fotoBefore.length,d.fotoAfter.length,d.elemen||'',d.titik||'',d.detail||''])});
    })})});
    var ws1=X.utils.aoa_to_sheet(rows,{cellDates:true});
    ws1['!cols']=[22,14,22,5,13,48,9,14,13,14,20,32,10,10,16,26,30].map(function(w){return {wch:w}});
    for(var r=1;r<rows.length;r++){['H','J'].forEach(function(c){var cell=ws1[c+(r+1)];if(cell&&cell.t==='d')cell.z='dd/mm/yyyy'})}
    var last=Math.max(rows.length,2),R=function(c){return "'Daftar Defect'!$"+c+'$2:$'+c+'$'+last};
    var cr=function(ref){return 'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE('+ref+',"~","~~"),"*","~*"),"?","~?")'};
    var calc=function(match){var n=0;rows.slice(1).forEach(function(x){if(match(x))n++});return n};
    var rk=[[LBL_GAB.area,LBL_GAB.level,LBL_GAB.lokasi,'Total Defect','Open','Dalam proses','Close','% Close']];
    var ws2=X.utils.aoa_to_sheet(rk);
    rooms.forEach(function(rm,i){
      var k=i+2,base='COUNTIFS('+R('A')+','+cr('A'+k)+','+R('B')+','+cr('B'+k)+','+R('C')+','+cr('C'+k);
      var m=function(st){return calc(function(x){return x[0]===rm[0]&&x[1]===rm[1]&&x[2]===rm[2]&&(!st||x[8]===st)})};
      var vals=[m(''),m('Open'),m('Dalam proses'),m('Close')];
      ws2['A'+k]={t:'s',v:rm[0]};ws2['B'+k]={t:'s',v:rm[1]};ws2['C'+k]={t:'s',v:rm[2]};
      ws2['D'+k]={t:'n',f:base+')',v:vals[0]};
      ws2['E'+k]={t:'n',f:base+','+R('I')+',"Open")',v:vals[1]};
      ws2['F'+k]={t:'n',f:base+','+R('I')+',"Dalam proses")',v:vals[2]};
      ws2['G'+k]={t:'n',f:base+','+R('I')+',"Close")',v:vals[3]};
      ws2['H'+k]={t:'n',f:'IF(D'+k+'=0,"",G'+k+'/D'+k+')',v:vals[0]?vals[3]/vals[0]:'',z:'0%'};
    });
    var tk=rooms.length+2,tot=[0,0,0,0];
    rooms.forEach(function(rm,i){['D','E','F','G'].forEach(function(c,j){tot[j]+=ws2[c+(i+2)].v})});
    ws2['A'+tk]={t:'s',v:'Total'};
    ['D','E','F','G'].forEach(function(c,j){ws2[c+tk]={t:'n',f:'SUM('+c+'2:'+c+(tk-1)+')',v:tot[j]}});
    ws2['H'+tk]={t:'n',f:'IF(D'+tk+'=0,"",G'+tk+'/D'+tk+')',v:tot[0]?tot[3]/tot[0]:'',z:'0%'};
    ws2['!ref']='A1:H'+tk;ws2['!cols']=[22,14,22,12,8,13,8,9].map(function(w){return {wch:w}});
    var ws3=X.utils.aoa_to_sheet([['Bidang','Total Defect','Open','Dalam proses','Close','% Close']]);
    BIDANG.forEach(function(b,i){var k=i+2,m=function(st){return calc(function(x){return x[4]===b&&(!st||x[8]===st)})},vals=[m(''),m('Open'),m('Dalam proses'),m('Close')];
      ws3['A'+k]={t:'s',v:b};
      ws3['B'+k]={t:'n',f:'COUNTIFS('+R('E')+','+cr('A'+k)+')',v:vals[0]};
      ws3['C'+k]={t:'n',f:'COUNTIFS('+R('E')+','+cr('A'+k)+','+R('I')+',"Open")',v:vals[1]};
      ws3['D'+k]={t:'n',f:'COUNTIFS('+R('E')+','+cr('A'+k)+','+R('I')+',"Dalam proses")',v:vals[2]};
      ws3['E'+k]={t:'n',f:'COUNTIFS('+R('E')+','+cr('A'+k)+','+R('I')+',"Close")',v:vals[3]};
      ws3['F'+k]={t:'n',f:'IF(B'+k+'=0,"",E'+k+'/B'+k+')',v:vals[0]?vals[3]/vals[0]:'',z:'0%'}});
    var bk=BIDANG.length+2;
    ws3['A'+bk]={t:'s',v:'Total'};
    ['B','C','D','E'].forEach(function(c){var s=0;for(var i=2;i<bk;i++)s+=ws3[c+i].v;ws3[c+bk]={t:'n',f:'SUM('+c+'2:'+c+(bk-1)+')',v:s}});
    ws3['F'+bk]={t:'n',f:'IF(B'+bk+'=0,"",E'+bk+'/B'+bk+')',v:ws3['B'+bk].v?ws3['E'+bk].v/ws3['B'+bk].v:'',z:'0%'};
    ws3['!ref']='A1:F'+bk;ws3['!cols']=[16,12,8,13,8,9].map(function(w){return {wch:w}});
    var lvs=[];T.forEach(function(g){g.lantai.forEach(function(l){lvs.push([g.nama,l.nama])})});
    var ws4=X.utils.aoa_to_sheet([[LBL_GAB.area,LBL_GAB.level,'Total Defect','Open','Dalam proses','Close','% Close']]);
    lvs.forEach(function(lv,i){
      var k=i+2,base='COUNTIFS('+R('A')+','+cr('A'+k)+','+R('B')+','+cr('B'+k);
      var m=function(st){return calc(function(x){return x[0]===lv[0]&&x[1]===lv[1]&&(!st||x[8]===st)})};
      var vv=[m(''),m('Open'),m('Dalam proses'),m('Close')];
      ws4['A'+k]={t:'s',v:lv[0]};ws4['B'+k]={t:'s',v:lv[1]};
      ws4['C'+k]={t:'n',f:base+')',v:vv[0]};
      ws4['D'+k]={t:'n',f:base+','+R('I')+',"Open")',v:vv[1]};
      ws4['E'+k]={t:'n',f:base+','+R('I')+',"Dalam proses")',v:vv[2]};
      ws4['F'+k]={t:'n',f:base+','+R('I')+',"Close")',v:vv[3]};
      ws4['G'+k]={t:'n',f:'IF(C'+k+'=0,"",F'+k+'/C'+k+')',v:vv[0]?vv[3]/vv[0]:'',z:'0%'};
    });
    var lk=lvs.length+2,lt=[0,0,0,0];
    lvs.forEach(function(lv,i){['C','D','E','F'].forEach(function(c,j){lt[j]+=ws4[c+(i+2)].v})});
    ws4['A'+lk]={t:'s',v:'Total'};
    ['C','D','E','F'].forEach(function(c,j){ws4[c+lk]={t:'n',f:'SUM('+c+'2:'+c+(lk-1)+')',v:lt[j]}});
    ws4['G'+lk]={t:'n',f:'IF(C'+lk+'=0,"",F'+lk+'/C'+lk+')',v:lt[0]?lt[3]/lt[0]:'',z:'0%'};
    ws4['!ref']='A1:G'+lk;ws4['!cols']=[22,18,12,8,13,8,9].map(function(w){return {wch:w}});
    var wb=X.utils.book_new();
    X.utils.book_append_sheet(wb,ws1,'Daftar Defect');X.utils.book_append_sheet(wb,ws2,'Rekap');X.utils.book_append_sheet(wb,ws3,'Rekap Bidang');X.utils.book_append_sheet(wb,ws4,'Rekap Level');
    var out=X.write(wb,{bookType:'xlsx',type:'array',cellDates:true});
    S.busy='';renderOverlay();
    showFile('Rekap_Defect_List_'+clean(S.paket.nama)+'_'+today()+'.xlsx',out,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }catch(e){S.busy='';renderOverlay();if(e&&e.server)gagal(e);else toast('Excel tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}

function imgSize(url){return new Promise(function(res){var im=new Image();im.onload=function(){res({url:url,w:im.naturalWidth,h:im.naturalHeight})};im.onerror=function(){res(null)};im.src=url})}
async function fetchImgs(ids,onStep){
  var need=ids.filter(function(id){return !S.img[id]});
  for(var i=0;i<need.length;i+=6){
    var part=need.slice(i,i+6);
    onStep(i);
    var res=await api('foto_data',{ids:part,w:900});
    for(var j=0;j<res.length;j++){S.img[res[j].id]=res[j].data?await imgSize(res[j].data):{fail:true}}
  }
}
var STC={'Open':[192,28,32],'Dalam proses':[176,92,0],'Close':[24,128,56]};
var MAKS_TEMUAN_PDF=60,MAKS_FOTO_PDF=120;   // batas satu berkas PDF; lebih dari itu dipecah supaya HP tidak kehabisan memori
function titikBaris(d){var a=[];if(d.elemen)a.push(d.elemen);if(d.titik)a.push(d.titik);if(d.detail)a.push(d.detail);return a.join(' · ')}
/**
 * Menyusun PDF. cfg: { info: [[label, nilai] x3], cont: teks header halaman lanjutan, all: semua temuan (untuk hitungan Close),
 * daftar: [ {judul} | {d, n, konteks:[baris...]} ] }. Tepat 3 temuan per lembar.
 */
function bangunPdf(cfg){
    var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
    var PW=210,PH=297,M=15,CW=PW-2*M,LIM=PH-18,y=M;   // LIM: batas isi, di bawahnya footer
    var T_=function(t,x,yy,o){doc.text(String(t),x,yy,o)};
    var ink=function(){doc.setTextColor(20,20,20)},grey=function(){doc.setTextColor(95,95,95)};
    var cont=function(){doc.setFont('helvetica','normal');doc.setFontSize(8);grey();T_(cfg.cont,M,y);y+=6;ink()};
    var pg=0,cn=0,np=function(){doc.addPage();y=M;cont();pg++;cn=1};
    var need=function(h){if(y+h>LIM)np()};
    doc.setFont('helvetica','bold');doc.setFontSize(10);ink();
    doc.splitTextToSize(S.paket.proyek||S.paket.nama||'',CW).forEach(function(t){T_(t,M,y);y+=5});
    doc.setFontSize(15);T_('DEFECT LIST',M,y+2);doc.setFont('helvetica','normal');doc.setFontSize(9);grey();T_('Dicetak '+fmt(today()),PW-M,y+2,{align:'right'});ink();doc.setFont('helvetica','bold');y+=5;doc.setDrawColor(20,20,20);doc.setLineWidth(.4);doc.line(M,y,PW-M,y);y+=6;
    var c=cnt(cfg.all);
    var info=cfg.info,info2=[['Total Defect',c.total],['Total Closing',c.close],['Persentase Closing',pct(c)]];
    doc.setFontSize(10);
    for(var i=0;i<info.length;i++){doc.setFont('helvetica','normal');T_(info[i][0],M,y);T_(': '+info[i][1],M+22,y);T_(info2[i][0],M+CW/2+8,y);T_(': '+info2[i][1],M+CW/2+40,y);y+=5.5}
    y+=2;doc.line(M,y,PW-M,y);y+=6;
    var items=cfg.daftar;
    /* foto landscape 4:3: kotak 51 x 38 mm (kartu) atau 29 x 22 mm (tabel); gambar sudah 4:3, jadi memenuhi kotak */
    function gambar(ph,x,yy,bw,bh){
      var im=S.img[ph.id];
      if(im&&!im.fail){var sc=Math.min(bw/im.w,bh/im.h),w=im.w*sc,h=im.h*sc;doc.addImage(im.url,'JPEG',x+(bw-w)/2,yy+(bh-h)/2,w,h);doc.setDrawColor(180,180,180);doc.setLineWidth(.2);doc.rect(x,yy,bw,bh)}
      else{doc.setFont('helvetica','normal');doc.setFontSize(7);grey();T_('Foto tidak termuat',x+bw/2,yy+bh/2,{align:'center'});ink()}
    }
    function kosong(x,yy,bw,bh,teks){
      doc.setDrawColor(150,150,150);doc.setLineWidth(.2);doc.setLineDashPattern([1,1],0);doc.rect(x,yy,bw,bh);doc.setLineDashPattern([],0);
      doc.setFont('helvetica','normal');doc.setFontSize(7);grey();T_(teks,x+bw/2,yy+bh/2,{align:'center'});ink();
    }
    function judulKelompok(it,minRuang){
      if(cn>=3){np();cn=0}
      var pgh=pg;need(minRuang);if(pg!==pgh)cn=0;
      doc.setFont('helvetica','bold');doc.setFontSize(11);ink();T_(it.judul,M,y+1);y+=2.5;
      doc.setDrawColor(20,20,20);doc.setLineWidth(.3);doc.line(M,y,PW-M,y);y+=5;
    }
    if(cfg.tabel){
      /* ===== tabel: No, Lokasi, Uraian, Bidang, Tingkat, Status, Foto Before, Foto After (laporan Gedung x Bidang) ===== */
      var COL=[['No',7],['Lokasi',37],['Uraian',37],['Bidang',13],['Tingkat',13],['Status',15],['Foto Before',29],['Foto After',29]],XS=[],ax=M;
      COL.forEach(function(k){XS.push(ax);ax+=k[1]});
      var PHW=29,PHH=22;
      var kepala=function(){
        doc.setFillColor(242,242,247);doc.rect(M,y,CW,6.5,'F');doc.setDrawColor(20,20,20);doc.setLineWidth(.3);doc.line(M,y,PW-M,y);doc.line(M,y+6.5,PW-M,y+6.5);
        doc.setFont('helvetica','bold');doc.setFontSize(8);ink();
        COL.forEach(function(k,ci){T_(k[0],XS[ci]+1,y+4.4)});
        y+=6.5;
      };
      var kepalaBaru=true;
      for(var ti=0;ti<items.length;ti++){
        var iz=items[ti];
        if(iz.judul!==undefined){
          if(!kepalaBaru)y+=6;   // jarak dari garis bawah baris terakhir kelompok sebelumnya (jangan menimpa judul)
          judulKelompok(iz,36);kepalaBaru=true;continue;
        }
        var dz=iz.d,stz=dz.status,bf=dz.fotoBefore,af=dz.fotoAfter,kz=iz.konteks||[];
        doc.setFont('helvetica','normal');doc.setFontSize(8);
        var lokL=[];kz.forEach(function(k){doc.splitTextToSize(k,COL[1][1]-2).forEach(function(s){lokL.push(s)})});
        var urL=doc.splitTextToSize(dz.uraian,COL[2][1]-2),bdL=doc.splitTextToSize(dz.bidang,COL[3][1]-1.5);
        var rowH=Math.max(PHH+4,Math.max(lokL.length,urL.length)*3.7+4);
        if(y+rowH+(kepalaBaru?6.5:0)>LIM){np();cn=0;kepalaBaru=true}
        if(kepalaBaru){kepala();kepalaBaru=false}
        var ty=y+4;
        doc.setFont('helvetica','normal');doc.setFontSize(8);ink();
        T_(iz.n||dz.no||ti+1,XS[0]+1,ty);
        lokL.forEach(function(s,k){T_(s,XS[1]+1,ty+k*3.7)});
        urL.forEach(function(s,k){T_(s,XS[2]+1,ty+k*3.7)});
        bdL.forEach(function(s,k){T_(s,XS[3]+1,ty+k*3.7)});
        doc.setFont('helvetica',(dz.tingkat==='Kritis'||dz.tingkat==='Mayor')?'bold':'normal');T_(dz.tingkat,XS[4]+1,ty);
        var c4=STC[stz]||[95,95,95];doc.setFont('helvetica','bold');doc.setTextColor(c4[0],c4[1],c4[2]);
        doc.splitTextToSize(stz==='Dalam proses'?'Proses':stz,COL[5][1]-1.5).forEach(function(s,k){T_(s,XS[5]+1,ty+k*3.7)});ink();
        var fy=y+2;
        if(bf[0])gambar(bf[0],XS[6]+0.5,fy,PHW,PHH);else kosong(XS[6]+0.5,fy,PHW,PHH,'Belum ada');
        if(af[0])gambar(af[0],XS[7]+0.5,fy,PHW,PHH);else kosong(XS[7]+0.5,fy,PHW,PHH,'Belum ada');
        if(bf.length>1||af.length>1){doc.setFont('helvetica','normal');doc.setFontSize(6.5);grey();if(bf.length>1)T_('+'+(bf.length-1)+' foto',XS[6]+0.5,fy+PHH+2.5);if(af.length>1)T_('+'+(af.length-1)+' foto',XS[7]+0.5,fy+PHH+2.5);ink()}
        y+=rowH;doc.setDrawColor(199,199,204);doc.setLineWidth(.2);doc.line(M,y,PW-M,y);
      }
    }else{
      /* ===== kartu: 3 temuan per lembar; Foto Before, Foto After, dan kotak Catatan MK berdampingan (laporan per ruangan) ===== */
      var BW=51,BH=38,GX=4,X3=M+2*(BW+GX),CATW=CW-2*(BW+GX);
      for(var di=0;di<items.length;di++){
        var it=items[di];
        if(it.judul!==undefined){judulKelompok(it,14);continue}
        var d=it.d,st=d.status,before=d.fotoBefore,after=d.fotoAfter,kons=it.konteks||[];
        doc.setFont('helvetica','normal');doc.setFontSize(10);
        var lines=doc.splitTextToSize(d.uraian,CW-10);
        if(cn>=3){np();cn=0}
        var pg0=pg;need(6+kons.length*4.2+lines.length*4.8+5+BH+10);if(pg!==pg0)cn=0;cn++;
        if(kons.length){doc.setFont('helvetica','normal');doc.setFontSize(8.5);grey();kons.forEach(function(k){T_(k,M+8,y);y+=4.2});ink()}
        doc.setFont('helvetica','bold');doc.setFontSize(10);T_((it.n||d.no||di+1)+'.',M,y);
        doc.setFont('helvetica','normal');lines.forEach(function(t,i){T_(t,M+8,y+i*4.8)});y+=lines.length*4.8+1;
        doc.setFontSize(8.5);
        var segs=[d.bidang,d.tingkat,st,'Temuan '+fmt(d.tglTemuan)];
        if(st==='Close')segs.push('Close '+fmt(d.tglVerif)+(d.verifOleh?' ('+d.verifOleh+')':''));
        var SEP='  |  ',xx=M+8;
        segs.forEach(function(t,k){
          if(k>0){doc.setFont('helvetica','normal');grey();T_(SEP,xx,y+3);xx+=doc.getTextWidth(SEP)}
          if(k===2){doc.setFont('helvetica','bold');var c3=STC[st]||[95,95,95];doc.setTextColor(c3[0],c3[1],c3[2])}
          else{doc.setFont('helvetica','normal');grey()}
          T_(String(t),xx,y+3);xx+=doc.getTextWidth(String(t));
        });
        doc.setFont('helvetica','normal');y+=4;ink();y+=3;
        var rws=Math.max(before.length,after.length,1);
        for(var ri=0;ri<rws;ri++){
          need(BH+10);
          doc.setFont('helvetica','bold');doc.setFontSize(8);
          if(ri===0){T_('Foto Before',M,y+2.5);T_('Foto After',M+BW+GX,y+2.5);T_('Catatan MK',X3,y+2.5)}
          y+=4;
          var sides=[[before[ri],M,'Belum ada foto before'],[after[ri],M+BW+GX,'Belum ada foto after']];
          for(var si=0;si<2;si++){
            var ph=sides[si][0],x=sides[si][1];
            if(ph){
              gambar(ph,x,y,BW,BH);
              if(ph.t){doc.setFont('helvetica','normal');doc.setFontSize(7);grey();T_(fmt(ph.t),x,y+BH+3);ink()}
            }else if(ri===0)kosong(x,y,BW,BH,sides[si][2]);
          }
          if(ri===0){   // kotak Catatan MK: hasil verifikasi dan catatan; tetap digambar walau kosong (bisa ditulis tangan di cetakan)
            doc.setDrawColor(180,180,180);doc.setLineWidth(.2);doc.rect(X3,y,CATW,BH);
            var kt=[];
            if(d.verifikasi)kt.push((d.verifikasi==='Diterima'?'Diterima':'Ditolak')+' MK '+fmt(d.tglVerif)+(d.verifOleh?' oleh '+d.verifOleh:'')+'.');
            if(d.catatan)kt.push(d.catatan);
            doc.setFont('helvetica','normal');doc.setFontSize(8.5);
            if(!kt.length){grey();T_('Belum ada catatan.',X3+2,y+5)}
            else{ink();var cl=[];kt.forEach(function(s){doc.splitTextToSize(s,CATW-4).forEach(function(z){cl.push(z)})});
              var maks=Math.floor((BH-4)/4);if(cl.length>maks){cl=cl.slice(0,maks);cl[maks-1]=cl[maks-1].replace(/.{0,3}$/,'...')}
              cl.forEach(function(s,k){T_(s,X3+2,y+5+k*4)})}
            ink();
          }
          y+=BH+5;
        }
        y+=0;doc.setDrawColor(200,200,200);doc.setLineWidth(.2);doc.line(M,y,PW-M,y);y+=5;
      }
    }
    /* footer semua halaman: "Dicetak oleh ..." dan "Halaman X dari N" (sama dengan laporan ringkas) */
    var N=doc.getNumberOfPages(),oleh='Dicetak oleh '+(S.user?S.user.nama+' ('+S.user.peran+')':'');
    for(var fp=1;fp<=N;fp++){
      doc.setPage(fp);doc.setDrawColor(199,199,204);doc.setLineWidth(.2);doc.line(M,PH-12,PW-M,PH-12);
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(60,60,67);
      T_(oleh,M,PH-8);T_('Halaman '+fp+' dari '+N,PW-M,PH-8,{align:'right'});
    }
    return doc.output('arraybuffer');
}
/** PDF per ruangan (serah terima): satu ruangan, memuat Elemen dan Titik bila ada. */
function buildPdf(g,l,r,list,all){
  var lbp=labelBidang(r.bidang||(list[0]&&list[0].bidang)||'');
  return bangunPdf({info:[[lbp.area,g.nama],[lbp.level,l.nama],[lbp.lokasi,r.nama]],cont:g.nama+' / '+l.nama+' / '+r.nama,all:all||list,
    daftar:list.map(function(d,i){var tb=titikBaris(d);return {d:d,n:d.no||i+1,konteks:tb?[tb]:[]}})});
}

/* ----- PDF per Gedung x Bidang ----- */
function konteksTemuan(d){var a=[d.lantai+' · '+d.ruangan+' · No '+(d.no||'')],tb=titikBaris(d);if(tb)a.push(tb);return a}
/**
 * Mengurutkan temuan (Level menurut urutan di aplikasi, lalu Lokasi, lalu Titik secara natural, lalu nomor) dan memecahnya
 * menjadi bagian-bagian berisi paling banyak MAKS_TEMUAN_PDF temuan dan MAKS_FOTO_PDF foto. Level utuh tidak dipotong
 * bila masih muat dalam satu bagian; judul Level diulang di awal tiap bagian.
 */
function susunBagian(gedung,list){
  var T=tree(),pos={},lv={};
  T.forEach(function(g){if(g.nama!==gedung)return;g.lantai.forEach(function(l,li){lv[l.nama]=li;l.ruangan.forEach(function(r,ri){pos[r.id]=ri})})});
  var sorted=list.slice().sort(function(a,b){
    var la=lv[a.lantai]===undefined?999:lv[a.lantai],lb=lv[b.lantai]===undefined?999:lv[b.lantai];
    return (la-lb)||((pos[a.ruanganId]||0)-(pos[b.ruanganId]||0))||L.bandingAlami(a.titik||'',b.titik||'')||((a.no||0)-(b.no||0));
  });
  var groups=[],gm={};
  sorted.forEach(function(d){var gr=gm[d.lantai];if(!gr){gr=gm[d.lantai]={level:d.lantai,items:[],foto:0};groups.push(gr)}gr.items.push(d);gr.foto+=d.fotoBefore.length+d.fotoAfter.length});
  var parts=[],cur={items:[],n:0,f:0,last:null};
  function tutup(){if(cur.n)parts.push(cur);cur={items:[],n:0,f:0,last:null}}
  groups.forEach(function(gr){
    if(cur.n&&gr.items.length<=MAKS_TEMUAN_PDF&&(cur.n+gr.items.length>MAKS_TEMUAN_PDF||cur.f+gr.foto>MAKS_FOTO_PDF))tutup();
    gr.items.forEach(function(d){
      var f=d.fotoBefore.length+d.fotoAfter.length;
      if(cur.n&&(cur.n>=MAKS_TEMUAN_PDF||cur.f+f>MAKS_FOTO_PDF))tutup();
      if(cur.last!==gr.level){cur.items.push({judul:gr.level});cur.last=gr.level}
      cur.items.push({d:d,n:d.no,konteks:konteksTemuan(d)});cur.n++;cur.f+=f;
    });
  });
  tutup();
  return parts;
}
/** Membuat satu atau beberapa berkas PDF untuk satu Gedung dan Bidang. Foto dimuat per bagian lalu dilepas dari memori. */
async function buatBerkasBidang(gedung,bidang,list,onStep){
  var parts=susunBagian(gedung,list),out=[];
  for(var i=0;i<parts.length;i++){
    var ids=[];parts[i].items.forEach(function(it){if(it.d)it.d.fotoBefore.concat(it.d.fotoAfter).forEach(function(f){ids.push(f.id)})});
    if(onStep)onStep(i+1,parts.length,ids.length);
    await fetchImgs(ids,function(){});
    var buf=bangunPdf({info:[[labelBidang(bidang).area,gedung],['Bidang',bidang],['Bagian',(i+1)+' dari '+parts.length]],cont:gedung+' / '+bidang+' / bagian '+(i+1),all:list,daftar:parts[i].items,tabel:true});
    out.push({nama:'Defect_List_'+clean(gedung)+'_'+clean(bidang)+(parts.length>1?'_bagian-'+(i+1):''),buf:buf});
    ids.forEach(function(id){delete S.img[id]});
  }
  return out;
}
function pbInfo(g,b){
  if(!S.all)return '';
  var l=S.all.filter(function(d){return d.gedung===g&&d.bidang===b}),f=0;l.forEach(function(d){f+=(d.fotoBefore||[]).length+(d.fotoAfter||[]).length});
  var c=cnt(l);return l.length+' temuan \u00b7 '+c.close+' Close \u00b7 '+f+' foto. Laporan besar dipecah otomatis menjadi beberapa bagian (maks '+MAKS_TEMUAN_PDF+' temuan atau '+MAKS_FOTO_PDF+' foto) dan dikemas dalam satu ZIP.';
}
function pbHtml(m){
  var T=tree();
  if(desk())return '<div class="ov mid" data-act="modalbg"><div class="sheet gap pbd" role="dialog" aria-label="Cetak laporan PDF"><h2>Cetak laporan PDF</h2><div class="cap">Jenis laporan</div>'+
    '<div class="seg" role="group" aria-label="Jenis laporan"><button type="button" class="on">'+esc(LBL.area)+' &times; Bidang</button></div>'+
    '<div class="pbsel"><label class="row"><span class="lbl">'+esc(LBL.area)+'</span><select id="pbG">'+T.map(function(g){return '<option'+(g.nama===m.g?' selected':'')+'>'+esc(g.nama)+'</option>'}).join('')+'</select></label>'+
    '<label class="row"><span class="lbl">Bidang</span><select id="pbB">'+BIDANG.map(function(b){return '<option'+(b===m.b?' selected':'')+'>'+esc(b)+'</option>'}).join('')+'</select></label></div>'+
    '<div class="note" id="pbinfo" style="padding:0">'+(pbInfo(m.g,m.b)||'Semua temuan satu bidang di satu '+esc(LBL.area.toLowerCase())+', dikelompokkan per '+esc(LBL.level.toLowerCase())+'. PDF yang besar dipecah otomatis dan dikemas dalam ZIP.')+'</div>'+
    '<div class="btnrow end"><button type="button" class="btn sec sm" data-act="mtutup">Batal</button><button type="button" class="btn sm" data-act="pdfbidangya">Buat PDF</button></div></div></div>';
  return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="PDF per bidang"><h2>PDF per bidang</h2><div class="note" style="padding:0">Semua temuan satu bidang di satu '+esc(LBL.area.toLowerCase())+', dikelompokkan per '+esc(LBL.level.toLowerCase())+'. PDF yang besar dipecah otomatis dan dikemas dalam ZIP.</div>'+
    '<section class="group"><div class="list"><label class="row"><span class="lbl">'+esc(LBL.area)+'</span><select id="pbG">'+T.map(function(g){return '<option'+(g.nama===m.g?' selected':'')+'>'+esc(g.nama)+'</option>'}).join('')+'</select></label>'+
    '<label class="row"><span class="lbl">Bidang</span><select id="pbB">'+BIDANG.map(function(b){return '<option'+(b===m.b?' selected':'')+'>'+esc(b)+'</option>'}).join('')+'</select></label></div></section>'+
    '<button type="button" class="btn" data-act="pdfbidangya">Buat PDF</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
}
async function exportPdfBidang(gedung,bidang){
  S.busy='Memuat temuan...';renderOverlay();
  try{
    await loadLib(PDF_URL,'jspdf');
    var list=await api('defect_bidang',{gedung:gedung,bidang:bidang});
    if(!list.length){S.busy='';renderOverlay();toast('Tidak ada temuan '+bidang+' di '+gedung+'.');return}
    var files=await buatBerkasBidang(gedung,bidang,list,function(i,n,nf){S.busy='Menyusun PDF bagian '+i+' dari '+n+(nf?' ('+nf+' foto)':'')+'...';renderOverlay()});
    if(files.length===1){S.busy='';renderOverlay();showFile(files[0].nama+'.pdf',files[0].buf,'application/pdf');return}
    S.busy='Mengemas ZIP...';renderOverlay();
    await loadLib(ZIP_URL,'JSZip');
    var zip=new window.JSZip();files.forEach(function(f){zip.file(f.nama+'.pdf',f.buf)});
    var out=await zip.generateAsync({type:'arraybuffer',compression:'STORE'});
    S.busy='';renderOverlay();
    showFile('Defect_List_'+clean(gedung)+'_'+clean(bidang)+'.zip',out,'application/zip');
  }catch(e){S.busy='';renderOverlay();if(e&&e.server)gagal(e);else toast('PDF tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}
async function exportPdf(){
  var T=tree(),s=ensureSel(T);if(!s)return;
  var g=s.g,l=s.l,r=s.r,all=S.defects[r.id];if(!all){toast('Temuan belum dimuat.');return}
  var list=fltList(all);if(!list.length){toast('Tidak ada temuan yang cocok dengan penyaring.');return}
  var ids=[];list.forEach(function(d){d.fotoBefore.concat(d.fotoAfter).forEach(function(f){ids.push(f.id)})});
  S.busy='Menyusun PDF...';renderOverlay();
  try{
    await loadLib(PDF_URL,'jspdf');
    await fetchImgs(ids,function(i){S.busy='Memuat foto '+Math.min(i+1,ids.length)+' dari '+ids.length+'...';renderOverlay()});
    S.busy='Menyusun PDF...';renderOverlay();
    var out=buildPdf(g,l,r,list,all);
    S.busy='';renderOverlay();
    showFile('Defect_List_'+clean(g.nama)+'_'+clean(l.nama)+'_'+clean(r.nama)+'.pdf',out,'application/pdf');
  }catch(e){S.busy='';renderOverlay();if(e&&e.server)gagal(e);else toast('PDF tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}

/* ----- PDF tab Temuan, mode Semua area: mengikuti penyaring dan urutan yang sedang aktif ----- */
function bagiSemua(list){
  var parts=[],cur=[],f=0;
  list.forEach(function(d,i){
    var nf=Math.min(1,d.fotoBefore.length)+Math.min(1,d.fotoAfter.length);
    if(cur.length&&(cur.length>=MAKS_TEMUAN_PDF||f+nf>MAKS_FOTO_PDF)){parts.push(cur);cur=[];f=0}
    var tb=titikBaris(d),k=[d.gedung+' / '+d.lantai,d.ruangan+' \u00b7 No '+(d.no||'')];if(tb)k.push(tb);
    cur.push({d:d,n:i+1,konteks:k});f+=nf;
  });
  if(cur.length)parts.push(cur);
  return parts;
}
async function exportPdfSemua(){
  var all=semuaList();if(!all)return;
  var a=AQ.form,list=aqList(all,a);
  if(!list.length){toast('Tidak ada temuan yang cocok dengan penyaring.');return}
  S.busy='Menyiapkan PDF...';renderOverlay();
  try{
    await loadLib(PDF_URL,'jspdf');
    var parts=bagiSemua(list),out=[],ring=aqRingkas(a),urut=(AQ_URUT.filter(function(x){return x[0]===(a.so||'')})[0]||AQ_URUT[0])[1];
    var sing=function(t,n){return t.length>n?t.slice(0,n-3)+'...':t};
    for(var i=0;i<parts.length;i++){
      var ids=[];parts[i].forEach(function(it){var b=it.d.fotoBefore[0],f=it.d.fotoAfter[0];if(b)ids.push(b.id);if(f)ids.push(f.id)});
      S.busy='Menyusun PDF bagian '+(i+1)+' dari '+parts.length+(ids.length?' ('+ids.length+' foto)':'')+'...';renderOverlay();
      await fetchImgs(ids,function(){});
      var buf=bangunPdf({info:[['Cakupan','Semua area'+(parts.length>1?' (bagian '+(i+1)+' dari '+parts.length+')':'')],['Penyaring',sing(ring,36)],['Urutan',sing(urut,36)]],cont:'Semua area / '+sing(ring,60)+(parts.length>1?' / bagian '+(i+1):''),all:list,daftar:parts[i],tabel:true});
      out.push({nama:'Defect_List_Semua_Area_'+today()+(parts.length>1?'_bagian-'+(i+1):''),buf:buf});
      ids.forEach(function(id){delete S.img[id]});
    }
    if(out.length===1){S.busy='';renderOverlay();showFile(out[0].nama+'.pdf',out[0].buf,'application/pdf');return}
    S.busy='Mengemas ZIP...';renderOverlay();
    await loadLib(ZIP_URL,'JSZip');
    var zip=new window.JSZip();out.forEach(function(f){zip.file(f.nama+'.pdf',f.buf)});
    var z=await zip.generateAsync({type:'arraybuffer',compression:'STORE'});
    S.busy='';renderOverlay();
    showFile('Defect_List_Semua_Area_'+today()+'.zip',z,'application/zip');
  }catch(e){S.busy='';renderOverlay();if(e&&e.server)gagal(e);else toast('PDF tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}

/* PDF massal (ZIP) */
function dirName(t){return String(t||'').replace(/[\\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'-'}
async function exportZip(){
  var T=tree(),g2=T.filter(function(g){return !S.zipOff[g.nama]});
  if(!g2.length){toast('Pilih minimal satu '+LBL.area.toLowerCase()+'.');return}
  S.zipRun=true;S.zipStop=false;S.busy='Menyiapkan...';renderOverlay();
  var gagalR=[],jml=0;
  try{
    await loadLib(PDF_URL,'jspdf');await loadLib(ZIP_URL,'JSZip');
    S.all=null;var all=await loadAll();
    var tugas=[];
    g2.forEach(function(g){BIDANG.forEach(function(b){var ls=all.filter(function(d){return d.gedung===g.nama&&d.bidang===b});if(ls.length)tugas.push([g.nama,b,ls])})});
    if(!tugas.length){S.zipRun=false;S.busy='';renderOverlay();toast('Tidak ada temuan pada pilihan ini.');return}
    var zip=new window.JSZip();
    for(var i=0;i<tugas.length;i++){
      if(S.zipStop){S.zipRun=false;S.busy='';renderOverlay();toast('Dibatalkan.');return}
      var ge=tugas[i][0],bi=tugas[i][1],ls=tugas[i][2];
      S.busy=(i+1)+' dari '+tugas.length+': '+ge+' / '+bi;renderOverlay();
      try{
        var fl=await buatBerkasBidang(ge,bi,ls,function(p,n){S.busy=(i+1)+' dari '+tugas.length+': '+ge+' / '+bi+(n>1?' (bagian '+p+' dari '+n+')':'');renderOverlay()});
        fl.forEach(function(f){zip.file(dirName(ge)+'/'+dirName(bi)+'/'+f.nama+'.pdf',f.buf);jml++});
      }catch(e){if(e&&e.server)throw e;gagalR.push(ge+' / '+bi)}
    }
    S.busy='Mengemas ZIP...';renderOverlay();
    var out=await zip.generateAsync({type:'arraybuffer',compression:'STORE'});
    S.zipRun=false;S.busy='';renderOverlay();
    showFile('Defect_List_'+clean(S.paket.nama)+'_'+today()+'.zip',out,'application/zip');
    if(gagalR.length)toast(gagalR.length+' kelompok gagal dan dilewati: '+gagalR.slice(0,2).join(', ')+(gagalR.length>2?', dan lainnya':''));
  }catch(e){S.zipRun=false;S.busy='';renderOverlay();if(e&&e.server)gagal(e);else toast('ZIP tidak bisa disusun. Periksa koneksi lalu coba lagi.')}
}

/* ---------- mulai ---------- */
(function start(){
  S.anim=({sistem:1,penuh:1,hemat:1})[lsGet('dl-anim')]?lsGet('dl-anim'):'sistem';applyAnim();
  S.tema=({sistem:1,terang:1,gelap:1})[lsGet('dl-tema')]?lsGet('dl-tema'):'sistem';
  applyTema();
  try{var mq=window.matchMedia('(prefers-reduced-motion: reduce)');(mq.addEventListener?mq.addEventListener('change',applyAnim):mq.addListener(applyAnim))}catch(e){}
  if('serviceWorker' in navigator){try{
    var adaSw=!!navigator.serviceWorker.controller;
    // Versi baru siap: muat ulang sendiri bila tidak ada yang sedang dikerjakan; bila ada, tawarkan tombol Muat ulang.
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(!adaSw){adaSw=true;return}
      if(S.modal||S.zoom||S.file||S.busy||(S.up&&S.up.some(function(x){return x.st!=='err'})))toastAksi('Versi baru tersedia.','Muat ulang',function(){location.reload()});
      else location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(function(reg){
      var cek=function(){try{reg.update()}catch(e){}};
      document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')cek()});
      setInterval(cek,30*60*1000);
    }).catch(function(){});
  }catch(e){}}
  var id=lsGet(STORE),p=PAKET_LIST.filter(function(x){return x.id===id})[0];
  if(p)pilihPaket(p.id);else render();
})();
})();
