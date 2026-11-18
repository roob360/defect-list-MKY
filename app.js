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
  reg:null, regOk:false, rg:{area:'',pakai:null}, imp:null, impRes:null, up:[], pv:{}, stale:{}, fokusAsal:null, kl:{g:'',l:'',n:''}, hist:[], skip:0, seen:{}, ringPrev:{}, drawn:'', ovKey:''
};
var app=document.getElementById('app'), overlay=document.getElementById('overlay');
var toastTimer=null, pickCb=null;

/* ---------- util ---------- */
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function fmt(iso){if(!iso)return '';var p=String(iso).split('-');if(p.length<3)return iso;var m=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return +p[2]+' '+m[+p[1]-1]+' '+p[0]}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function ic(n){return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-'+n+'"/></svg>'}
function toast(m){var t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.hidden=false;t.classList.remove('in');void t.offsetWidth;t.classList.add('in');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true},4500)}
/* Toast dengan satu tombol aksi (mis. Urungkan, hanya Admin) selama 5 detik. */
function toastAksi(m,label,fn){
  var t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent='';var s=document.createElement('span');s.textContent=m;var b=document.createElement('button');b.type='button';b.className='tb';b.textContent=label;
  b.onclick=function(){clearTimeout(toastTimer);t.hidden=true;fn()};
  t.appendChild(s);t.appendChild(b);t.hidden=false;t.classList.remove('in');void t.offsetWidth;t.classList.add('in');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true},5000);
}
async function urungkanHapus(d){
  var r=await work('Memulihkan...',function(){return api('defect_pulihkan',{id:d.id})});
  if(r){delete S.defects[r.ruanganId];S.all=null;await loadRooms();toast('Temuan dipulihkan.')}
}
function clean(s){return String(s).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function pct(c){return c.total?Math.round(c.close/c.total*100)+'%':'-'}
function thumb(id,w){return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w'+(w||400)}
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
  lsDel('dl-user-'+pid);lsDel('dl-rooms-'+pid);lsDel('dl-reg-'+pid);lsDel('dl-sel');lsDel('dl-view');
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
    toast(/Aksi tidak dikenal/i.test(m)?'Server belum diperbarui. Tempel Kode.gs terbaru dan deploy Versi baru.':m);
  }else toast('Tidak terhubung ke server. Periksa internet lalu coba lagi.');
}
async function work(label,fn){
  S.busy=label;renderOverlay();
  try{return await fn()}catch(e){gagal(e)}finally{S.busy='';renderOverlay()}
}

/* ---------- data turunan ---------- */
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
function findDefect(id){
  var rid,list;
  for(rid in S.defects){list=S.defects[rid];for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i]}
  if(S.siap)for(var j=0;j<S.siap.length;j++)if(S.siap[j].id===id)return S.siap[j];
  if(S.perlu)for(var m=0;m<S.perlu.length;m++)if(S.perlu[m].id===id)return S.perlu[m];
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
async function loadRooms(){
  try{
    S.rooms=await api('ruangan');S.roomsReady=true;S.net='';
    if(!S.reg&&S.regOk!==false&&!S.regTry){S.regTry=true;muatRegistri()}
    lsSet('dl-rooms-'+S.paket.id,JSON.stringify(S.rooms));
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
  if(pr.getAttribute('data-k')!==k||S.user){pr.setAttribute('data-k',k);pr.innerHTML=S.user?'<span>'+esc(String(S.user.nama||S.user.peran).trim().charAt(0).toUpperCase())+'</span>':ic('gear');pr.className='prof'+(S.user?' role '+String(S.user.peran).toLowerCase():'');pr.setAttribute('aria-label',S.user?'Pengaturan, '+S.user.nama+' ('+S.user.peran+')':'Pengaturan');pr.title=S.user?S.user.nama+' · '+S.user.peran:'Pengaturan';pr.parentNode.classList.toggle('in',!!S.user)}
  $('bBack').hidden=!(S.paket&&!S.user);
}
function skb(w,h,c){return '<div class="sk'+(c?' c':'')+'" style="width:'+w+';height:'+h+'px"></div>'}
function skEntry(){return '<section class="group"><div class="skel-in">'+skb('92%',18)+skb('70%',18)+'<div class="r">'+skb('64px',24)+skb('78px',24)+skb('60px',24)+'</div>'+skb('90px',12)+'<div class="r">'+skb('100px',100)+skb('100px',100)+'</div></div></section>'}
function skel(kind){
  var h='<div class="skel" role="status" aria-label="Memuat">';
  if(kind==='page')h+='<div style="padding:4px 0 18px">'+skb('90px',12)+skb('220px',34)+'</div>';
  if(kind==='page'||kind==='room')h+='<section class="group"><div>'+skb('60px',12)+skb('55%',20)+'<div class="r" style="margin-top:14px">'+skb('45%',40)+skb('45%',40)+'</div></div></section>';
  if(kind==='room'||kind==='entries'||kind==='page')h+='<section class="group"><div class="r">'+skb('64px',64,1)+skb('60px',36)+skb('60px',36)+skb('60px',36)+skb('60px',36)+'</div></section>'+skEntry()+skEntry();
  if(kind==='table')h+='<section class="group"><div>'+skb('100%',16)+skb('100%',22)+skb('100%',22)+skb('100%',22)+skb('100%',22)+skb('100%',22)+'</div></section>';
  if(kind==='kelola')h+='<section class="group"><div>'+skb('40%',14)+skb('100%',44)+skb('100%',44)+skb('100%',44)+'</div></section><section class="group"><div>'+skb('40%',14)+skb('100%',44)+skb('100%',44)+'</div></section>';
  return h+'</div>';
}
function render(){
  setHead();setDock();
  if(!S.paket)renderPick();else if(!S.user)renderLogin();else renderMain();
  var key=!S.paket?'pick':!S.user?'login':S.view+(S.view==='form'?':'+S.sel.r:'');
  if(S.drawn!==key){S.drawn=key;app.classList.remove('enter');void app.offsetWidth;app.classList.add('enter')}
}
function renderPick(){
  var h='<div class="centered"><div class="brand"><img src="icon-192.png" alt="" width="76" height="76"><h1>Defect List</h1><div class="note" style="padding:6px 0 0;text-align:center">Catatan temuan pekerjaan konstruksi</div></div><section class="group pick"><div class="sh">Pilih paket</div><div class="list">';
  PAKET_LIST.forEach(function(p){
    h+='<button type="button" class="row actionrow big" data-act="paket" data-id="'+esc(p.id)+'"><span class="t"><b>'+esc(p.nama)+'</b><span>'+esc(p.ringkas||p.label)+'</span></span><svg class="chev" viewBox="0 0 12 18"><path d="M3 3l6 6-6 6"/></svg></button>';
  });
  app.innerHTML=h+'</div></section></div>';
}
function renderLogin(){
  var p=S.paket;
  var h='<div class="centered"><div class="pagehead"><div class="cap">'+esc(p.nama)+' &middot; '+esc(p.label)+'</div><h1>Masuk</h1><div class="note" style="padding:4px 0 0">Masukkan kode akses 6 karakter dari admin.</div></div>';
  if(!p.apiUrl)h+='<section class="group pad"><div class="err" style="padding:0">URL API paket ini belum diisi di config.js.</div></section>';
  else{
    var kv=(S.kode||'').slice(0,6),bx='';
    for(var i=0;i<6;i++)bx+='<span class="cb'+(i<kv.length?' f':'')+(i===Math.min(kv.length,5)?' on':'')+'">'+esc(kv[i]||'')+'</span>';
    h+='<div class="codewrap'+(S.loginErr?' bad':'')+'"><div class="cap">Kode akses</div><div class="boxes" id="boxes" aria-hidden="true">'+bx+'</div>'+
      '<input type="text" id="kode" class="cin" maxlength="6" autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" aria-label="Kode akses, 6 karakter" value="'+esc(kv)+'"></div>'+
      '<div style="height:18px"></div>';
    if(S.loginErr)h+=S.loginNet?'<div class="errbox" role="alert">'+esc(S.loginErr)+'</div>':'<div class="err" role="alert" style="padding:0 4px 14px">'+esc(S.loginErr)+'</div>';
    h+='<button type="button" class="btn" id="bMasuk" data-act="masuk">'+(S.loginNet&&S.loginErr?'Coba lagi':'Masuk')+'</button>';
  }
  app.innerHTML=h+'</div>';
  var ki=$('kode');if(ki&&S.paket.apiUrl)ki.focus({preventScroll:true});
}

function setDock(){
  var el=$('dock'),show=!!(S.paket&&S.user&&(canEdit()||isPJ()));
  if(show){
    var t=isPJ()?[['form','Form'],['perbaikan','Perbaikan']]:isAdmin()?[['form','Form'],['verif','Verifikasi'],['perbaikan','Perbaikan'],['rekap','Rekap'],['kelola','Kelola']]:[['form','Form'],['verif','Verifikasi'],['rekap','Rekap']];
    var add=canEdit();
    var keys=t.map(function(x){return x[0]}).join(',')+(add?'+':'');
    if(el.getAttribute('data-keys')!==keys){
      el.setAttribute('data-keys',keys);el.classList.remove('anim');
      var bt=t.map(function(x){return '<button type="button" data-act="tab" data-v="'+x[0]+'">'+ic(x[0])+'<span>'+x[1]+'</span>'+((x[0]==='verif'||x[0]==='perbaikan')?'<i class="bdg" hidden></i>':'')+'</button>'});
      if(add)bt.push('<button type="button" class="dockadd" data-act="tambah" aria-label="Tambah temuan">'+ic('plus')+'</button>');
      el.innerHTML='<span class="ind"></span>'+bt.join('');
    }
    el.classList.toggle('wadd',add);
    var ad=el.querySelector('.dockadd');
    if(ad){var vis=S.view==='form';el.classList.toggle('noadd',!vis);ad.tabIndex=vis?0:-1;ad.setAttribute('aria-hidden',vis?'false':'true')}
    Array.prototype.forEach.call(el.querySelectorAll('button'),function(bt){
      var bg=bt.querySelector('.bdg');if(!bg)return;
      var pj=bt.getAttribute('data-v')==='perbaikan',n=pj?(S.perlu?S.perlu.length:0):(S.siap?S.siap.length:0);
      bg.textContent=n>99?'99+':n;bg.hidden=!n;bg.setAttribute('aria-label',n+(pj?' perlu dikerjakan':' menunggu verifikasi'));
    });
    Array.prototype.forEach.call(el.querySelectorAll('button'),function(b){
      var on=b.getAttribute('data-v')===S.view;b.classList.toggle('on',on);
      if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
  }
  el.hidden=!show;document.body.classList.toggle('hasdock',show);
  if(show)moveInd();
}
function moveInd(){
  var el=$('dock'),b=el.querySelector('button.on'),ind=el.querySelector('.ind');
  if(!b||!ind||!b.offsetWidth)return;
  el.style.setProperty('--dadd',b.offsetHeight+'px');
  ind.style.width=b.offsetWidth+'px';ind.style.height=b.offsetHeight+'px';
  ind.style.transform='translate('+b.offsetLeft+'px,'+b.offsetTop+'px)';
  if(!el.classList.contains('anim'))requestAnimationFrame(function(){el.classList.add('anim')});
}
window.addEventListener('resize',moveInd);window.addEventListener('load',moveInd);
function renderMain(){
  var h='';
  if(S.net)h+='<div class="err" role="status">'+esc(S.net)+'</div>';
  if(S.view==='verif'&&canEdit())h+=verifHtml();
  else if(S.view==='perbaikan'&&(isPJ()||isAdmin()))h+=perbaikanHtml();
  else if(S.view==='rekap'&&canEdit())h+=rekapHtml();
  else if(S.view==='kelola'&&isAdmin())h+=kelolaHtml();
  else h+=formHtml();
  app.innerHTML=h;
}

function selHtml(id,opts,val,label){
  return '<label class="row"><span class="lbl">'+label+'</span><select data-sel="'+id+'"'+(opts.length===1?' class="one" disabled':'')+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===val?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>';
}
function fltList(list){
  var f=S.flt,q=f.q.trim().toLowerCase();
  return list.filter(function(d){return (!f.st||d.status===f.st)&&(!f.bd||d.bidang===f.bd)&&(!f.tk||d.tingkat===f.tk)&&(!f.el||d.elemen===f.el)&&(!q||String(d.uraian+' '+(d.titik||'')+' '+(d.elemen||'')).toLowerCase().indexOf(q)>=0)});
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
  if(!T.length)return '<div class="empty">Belum ada ruangan.'+(isAdmin()?' Tambahkan di tab Kelola.':' Hubungi admin.')+'</div>';
  var s=ensureSel(T),rid=s.r.id,list=S.defects[rid];
  if(S.flt.rid!==rid)S.flt={rid:rid,q:'',st:'',bd:'',tk:'',el:''};
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Temuan</h1></div>';
  h+='<div class="locbar"><button type="button" class="btn-ic" data-act="nav" data-d="-1" aria-label="Ruangan sebelumnya">'+ic('prev')+'</button>'+
    '<button type="button" class="locbtn" data-act="lokpilih" aria-label="Pilih lokasi"><span class="lk">'+esc(s.g.nama)+' &rsaquo; '+esc(s.l.nama)+'</span><b>'+esc(s.r.nama)+'</b><svg class="chv" viewBox="0 0 12 18" aria-hidden="true"><path d="M2 7l4-4 4 4M2 11l4 4 4-4"/></svg></button>'+
    '<button type="button" class="btn-ic" data-act="nav" data-d="1" aria-label="Ruangan berikutnya">'+ic('next')+'</button></div>';
  if(!list&&!S.errs[rid]){
    if(!S.loading[rid])setTimeout(function(){if(!S.defects[rid]&&!S.loading[rid]&&!S.errs[rid])loadDefects(rid,false)},0);   // jangan pernah terjebak tanpa pemuatan
    return h+skel('entries');
  }
  if(!list){
    h+='<div class="err">'+esc(S.errs[rid])+'</div><button type="button" class="btn sec" data-act="muat">Coba lagi</button>';
    return h;
  }
  if(S.stale[rid])h+='<div class="note" style="padding:0 0 10px" role="status">Data tersimpan, belum diperbarui dari server.</div>';
  var c=cnt(list),p=c.total?Math.round(c.close/c.total*100):0;
  var ringGo=S.ringPrev[rid]!==p;S.ringPrev[rid]=p;
  h+='<div class="summary"><div class="ring'+(c.total&&c.close===c.total?' full':'')+'"><svg viewBox="0 0 72 72"><circle class="tr" cx="36" cy="36" r="30"/><circle class="on'+(ringGo?' go':'')+'" cx="36" cy="36" r="30" style="stroke-dashoffset:'+(188.5*(1-p/100)).toFixed(1)+'"/></svg><div class="c">'+pct(c)+'</div></div>'+
    '<div class="stats"><div><b>'+c.total+'</b><span>Total</span></div><div class="o"><b>'+c.open+'</b><span>Open</span></div><div class="p"><b>'+c.proses+'</b><span>Proses</span></div><div class="c"><b>'+c.close+'</b><span>Close</span></div></div>'+
    '<button type="button" class="pdfbtn" data-act="pdf" aria-label="PDF ruangan ini">'+ic('pdf')+'<span>PDF</span></button></div>';
  if(!list.length)return h+'<div class="empty">Belum ada temuan di ruangan ini.</div>';
  var f=S.flt,nf=(f.bd?1:0)+(f.tk?1:0)+(f.el?1:0);
  h+='<div class="sbar"><label class="sinp">'+ic('search')+'<input type="text" id="fq" placeholder="Cari uraian, elemen, titik" autocomplete="off" value="'+esc(f.q)+'"></label>'+
    '<button type="button" class="btn-sq" data-act="filterbuka">Filter'+(nf?' &middot; '+nf:'')+'</button><button type="button" class="btn-sq ic" data-act="menuaksi" aria-label="Menu aksi">&#8943;</button></div>';
  return h+filterHtml(list,c)+'<div id="elist">'+entriesHtml(list)+'</div>';
}
function thumbsHtml(items,jenis,d,removable){
  var jobs=S.up.filter(function(j){return j.did===d.id&&j.jenis===jenis});
  if(!items.length&&!jobs.length)return '<div class="none">Belum ada foto '+jenis+'</div>';
  return '<div class="thumbs">'+items.map(function(f){
    return '<div class="thumb"><button type="button" data-act="zoom" data-f="'+esc(f.id)+'" aria-label="Lihat foto"><img loading="lazy" alt="Foto '+jenis+'" src="'+(S.pv[f.id]||thumb(f.id,400))+'"></button>'+
      (f.t?'<span class="dt">'+esc(fmt(f.t))+'</span>':'')+
      (removable?'<button type="button" class="x" data-act="delfoto" data-d="'+esc(d.id)+'" data-j="'+jenis+'" data-f="'+esc(f.id)+'" aria-label="Hapus foto">&times;</button>':'')+'</div>';
  }).join('')+jobs.map(upHtml).join('')+'</div>';
}
function phHtml(d,jenis,ro){
  var ed=canEdit()&&!ro;
  return '<div class="phl">'+(jenis==='before'?'Before':'After')+'</div>'+thumbsHtml(jenis==='before'?d.fotoBefore:d.fotoAfter,jenis,d,ed);
}
/* Stepper empat tahap: Temuan, Perbaikan, After, Verifikasi. Hijau selesai, oranye sedang, merah ditolak. */
function stepperHtml(d){
  var af=d.fotoAfter.length>0,vd=d.verifikasi,tolak=vd==='Ditolak';
  var st=['on',d.mulai?(af&&!tolak?'on':'go'):'',af&&!tolak?'on':'',vd==='Diterima'?'on':tolak?'bad':af?'go':''];
  var nm=['Temuan','Perbaikan','After','Verifikasi'];
  return '<div class="stp" aria-label="Tahap: '+nm.map(function(n,i){return n+(st[i]==='on'?' selesai':st[i]==='go'?' sedang':st[i]==='bad'?' ditolak':'')}).join(', ')+'">'+
    '<div class="bars">'+st.map(function(s){return '<i class="'+s+'"></i>'}).join('')+'</div>'+
    '<div class="lbls">'+nm.map(function(n,i){return '<span class="'+st[i]+'">'+n+'</span>'}).join('')+'</div></div>';
}
function bisaMulai(){return !!(S.user&&(S.user.peran==='PJ'||S.user.peran==='ADMIN'))}
/* Satu aksi utama menurut peran dan tahap; sisanya di menu kartu (kmenuItems). */
function aksiUtama(d){
  var closed=d.status==='Close',af=d.fotoAfter.length>0,vd=d.verifikasi,id=esc(d.id);
  if(closed||vd==='Diterima')return '';
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
  if(canEdit())a.push({a:'edit',t:'Ubah temuan'});
  if(canEdit()&&d.verifikasi)a.push({a:'verif',t:'Ubah keputusan verifikasi'});
  if(bisaMulai()&&!closed&&d.mulai&&!d.fotoAfter.length)a.push({a:'batalmulai',t:'Batalkan mulai perbaikan'});
  if(canEdit())a.push({a:'hapus',t:'Hapus',bad:true});
  return a;
}
function entryHtml(d,n,ix,ro){
  var fresh=!S.seen[d.id];S.seen[d.id]=1;
  var h='<article class="group entry'+(fresh?' pop':'')+'"'+(fresh?' style="animation-delay:'+Math.min(ix||0,8)*50+'ms"':'')+' data-id="'+esc(d.id)+'" data-ro="'+(ro?1:0)+'"><div class="eh"><span class="no">'+n+'</span><span class="tx">'+esc(d.uraian)+'</span></div>'+
    '<div class="meta"><span class="tag '+stCls(d.status)+'">'+esc(d.status)+'</span><span class="tag">'+esc(d.bidang)+'</span><span class="tag '+esc(String(d.tingkat).toLowerCase())+'">'+esc(d.tingkat)+'</span><span class="tag">Temuan '+esc(fmt(d.tglTemuan))+'</span>'+(d.elemen?'<span class="tag">'+esc(d.elemen)+'</span>':'')+(d.titik?'<span class="tag" style="color:var(--label1)"><b>'+esc(d.titik)+'</b></span>':'')+'</div>'+
    stepperHtml(d);
  if(d.mulai)h+='<div class="note">Perbaikan dimulai '+esc(fmt(d.mulai))+(d.diisiOleh?' oleh '+esc(d.diisiOleh):'')+'</div>';
  if(d.verifikasi)h+='<div class="note'+(d.verifikasi==='Ditolak'?' tolak':' ok')+'">'+(d.verifikasi==='Diterima'?'Diterima':'Ditolak')+' MK '+esc(fmt(d.tglVerif))+(d.verifOleh?' oleh '+esc(d.verifOleh):'')+(d.catatan?'. Catatan: '+esc(d.catatan):'')+'</div>';
  if(isPJ()&&d.verifikasi==='Ditolak')h+='<div class="note tolak">Unggah foto After yang baru supaya diverifikasi ulang oleh MK.</div>';
  h+='<div class="phs"><div class="ph" data-j="before">'+phHtml(d,'before',ro)+'</div><div class="ph" data-j="after">'+phHtml(d,'after',ro)+'</div></div>';
  h+='<div class="acts">'+aksiUtama(d);
  if(kmenuItems(d).length)h+='<button type="button" class="pill menu" data-act="kmenu" data-d="'+esc(d.id)+'" aria-label="Menu temuan">&#8943;</button>';
  return h+'</div></article>';
}

/* ----- antrean verifikasi ----- */
function verifHtml(){
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Verifikasi</h1></div>';
  if(!S.siap&&S.siapErr)return h+'<div class="err">'+esc(S.siapErr)+'</div><button type="button" class="btn sec" data-act="muatsiap">Coba lagi</button>';
  if(!S.siap)return h+skel('entries');
  h+='<div class="banner" role="status"><span>'+S.siap.length+' temuan menunggu keputusan MK</span><button type="button" data-act="muatsiap">Muat ulang</button></div>';
  if(!S.siap.length)return h+'<div class="empty">Tidak ada temuan yang menunggu verifikasi.</div>';
  S.siap.forEach(function(d,i){h+='<div class="cap path">'+esc(d.gedung)+' / '+esc(d.lantai)+' / '+esc(d.ruangan)+'</div>'+entryHtml(d,d.no||i+1,i,true)});
  return h;
}

/* ----- antrean perbaikan (PJ) ----- */
function perbaikanHtml(){
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Perbaikan</h1></div>';
  if(!S.perlu&&S.perluErr)return h+'<div class="err">'+esc(S.perluErr)+'</div><button type="button" class="btn sec" data-act="muatperlu">Coba lagi</button>';
  if(!S.perlu)return h+skel('entries');
  var tl=S.perlu.filter(function(d){return d.verifikasi==='Ditolak'}).length;
  h+='<div class="banner" role="status"><span>'+S.perlu.length+' perlu dikerjakan'+(tl?' &middot; '+tl+' ditolak MK':'')+'</span><button type="button" data-act="muatperlu">Muat ulang</button></div>';
  if(!S.perlu.length)return h+'<div class="empty">Semua temuan sudah dikerjakan. Tidak ada yang perlu di-close.</div>';
  S.perlu.forEach(function(d,i){h+='<div class="cap path">'+esc(d.gedung)+' / '+esc(d.lantai)+' / '+esc(d.ruangan)+'</div>'+entryHtml(d,d.no||i+1,i)});
  return h;
}

/* ----- rekap ----- */
function rekapHtml(){
  var T=tree();
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Rekap</h1></div>';
  if(!S.roomsReady&&!S.rooms.length)return h+skel('table');
  if(!T.length)return h+'<div class="empty">Belum ada ruangan.</div>';
  var tot={total:0,open:0,proses:0,close:0};
  T.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){['total','open','proses','close'].forEach(function(k){tot[k]+=r[k]||0})})})});
  h+='<div class="kpis"><div class="kpi o"><b>'+tot.open+'</b><span>Open</span></div><div class="kpi p"><b>'+tot.proses+'</b><span>Proses</span></div><div class="kpi c"><b>'+tot.close+'</b><span>Close</span></div></div>';
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
    BIDANG.forEach(function(b){var c=cnt(S.all.filter(function(d){return d.bidang===b}));h+='<tr><td>'+esc(b)+'</td><td>'+c.total+'</td><td>'+c.open+'</td><td>'+c.proses+'</td><td>'+c.close+'</td><td>'+pct(c)+'</td></tr>'});
    h+='</tbody></table></div>';
  }
  h+='</section><div class="btnrow"><button type="button" class="btn" data-act="xlsx">Unduh Excel</button><button type="button" class="btn out" data-act="pdfbidang">'+ic('pdf')+'Cetak PDF</button></div>';
  return h;
}

/* ----- kelola ----- */
function kelolaHtml(){
  var T=tree();
  var h='<div class="pagehead"><div class="cap">'+esc(S.paket.nama)+'</div><h1>Kelola</h1></div>';
  if(!S.roomsReady&&!S.rooms.length)return h+skel('kelola');
  h+='<section class="group"><div class="sh">Tambah ruangan</div><div class="list kform">'+
    '<label class="row"><span class="lbl">Gedung</span><input type="text" id="klG" list="dlG" placeholder="Contoh: Gedung A" value="'+esc(S.kl.g)+'"></label>'+
    '<label class="row"><span class="lbl">Lantai</span><input type="text" id="klL" placeholder="Contoh: Lantai 1" value="'+esc(S.kl.l||'')+'"></label>'+
    '<label class="row"><span class="lbl">Ruangan (satu per baris)</span><textarea id="klN" placeholder="Ruang Rapat&#10;Lobi&#10;Toilet Pria">'+esc(S.kl.n)+'</textarea></label></div>'+
    '<datalist id="dlG">'+T.map(function(g){return '<option value="'+esc(g.nama)+'">'}).join('')+'</datalist>'+
    
    '<div class="acts" style="padding-top:0;padding-bottom:14px"><button type="button" class="btn" data-act="addroom">Tambah</button></div></section>';
  h+=impHtml();
  h+='<section class="group"><div class="sh">Daftar ruangan</div>';
  if(!T.length)h+='<div class="gf">Belum ada ruangan.</div>';
  T.forEach(function(g){
    g.lantai.forEach(function(l){
      h+='<div class="note" style="padding-left:var(--margin);font-weight:600;padding-top:10px">'+esc(g.nama)+' / '+esc(l.nama)+'</div><div class="list">';
      l.ruangan.forEach(function(r){
        h+='<div class="row" style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0;overflow-wrap:anywhere">'+esc(r.nama)+'<span class="note" style="display:block;padding:2px 0 0">'+esc(g.nama)+' &middot; '+esc(l.nama)+' &middot; '+r.total+' temuan</span></span>'+
          (r.bidang?'':'<button type="button" class="pill" data-act="ubahroom" data-r="'+esc(r.id)+'">Ubah</button>')+'<button type="button" class="pill bad" data-act="delroom" data-r="'+esc(r.id)+'">Nonaktifkan</button></div>';
      });
      h+='</div>';
    });
  });
  h+='</section>';
  h+=regAdminHtml();
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
  h+='</section>';
  return h;
}

/* ---------- overlay ---------- */
function renderOverlay(){
  var h='';
  if(S.busy)h='<div class="ov mid" style="z-index:90"><div class="sheet"><div class="busy"><div class="spin d"></div><span>'+esc(S.busy)+'</span></div>'+(S.zipRun?'<button type="button" class="btn sec" data-act="zipbatal" style="margin-top:10px">Batal</button>':'')+'</div></div>';
  else if(S.zoom)h='<div class="ov zoom" data-act="zoomx"><img alt="Foto" src="'+esc(S.zoom)+'"><button type="button" class="btn-ic" data-act="zoomx" aria-label="Tutup">'+ic('x')+'</button></div>';
  else if(S.file)h='<div class="ov mid"><div class="sheet gap"><h2>File siap</h2><div class="note" style="padding:0 0 4px">'+esc(S.file.name)+'</div>'+
    '<a class="btn" id="dl" href="'+esc(S.file.url)+'" download="'+esc(S.file.name)+'">Unduh</a>'+
    (S.file.canShare?'<button type="button" class="btn sec" data-act="bagi">Bagikan</button>':'')+
    '<button type="button" class="btn sec" data-act="tutupfile">Tutup</button></div></div>';
  else if(S.modal)h=modalHtml();
  var key=S.busy?'busy':S.zoom?'zoom':S.file?'file':S.modal?'m'+S.modal.t:'',prev=S.ovKey;
  overlay.classList.toggle('fx',!!key&&key!==S.ovKey);S.ovKey=key;
  overlay.innerHTML=h;
  aturDialog(key,prev);
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
  if(m.t==='temuan')return fHtml(m);
  if(m.t==='rgatur')return rgHtml(m);
  if(m.t==='rgyakin')return rgYakinHtml(m);
  if(m.t==='pdfbidang')return pbHtml(m);
  if(m.t==='verif'){
    var d=m.d;
    return '<div class="ov" data-act="modalbg"><div class="sheet" role="dialog" aria-label="Verifikasi"><h2>Verifikasi MK</h2><div class="note" style="padding:0 0 10px;overflow-wrap:anywhere">'+esc(d.uraian)+'</div>'+
      '<section class="group"><div class="list"><label class="row"><span class="lbl">Catatan MK (opsional)</span><textarea id="vC" style="min-height:80px">'+esc(d.catatan||'')+'</textarea></label></div></section>'+
      (d.fotoAfter.length?'':'<div class="note" style="padding:0 0 10px">Belum ada foto After dari penanggung jawab, jadi belum bisa diterima atau ditolak.</div>')+
      '<div class="gap"><button type="button" class="btn"'+(d.fotoAfter.length&&d.verifikasi!=='Diterima'?'':' disabled')+' data-act="vset" data-h="Diterima">'+(d.verifikasi==='Diterima'?'Sudah diterima (Close)':'Diterima (Close)')+'</button><button type="button" class="btn bad"'+(d.fotoAfter.length&&d.verifikasi!=='Ditolak'?'':' disabled')+' data-act="vset" data-h="Ditolak">'+(d.verifikasi==='Ditolak'?'Sudah ditolak':'Ditolak')+'</button>'+
      (d.verifikasi?'<button type="button" class="btn sec" data-act="vset" data-h="">Batalkan verifikasi</button>':'')+
      '<button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div></div>';
  }
  if(m.t==='set'){
    var us=S.user;
    return '<div class="ov" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Pengaturan"><div class="grab" aria-hidden="true"></div><h2>Pengaturan</h2>'+
      (us?'<div class="ucard"><span class="av" aria-hidden="true">'+esc((us.nama||'?').trim().charAt(0).toUpperCase())+'</span><div><b>'+esc(us.nama)+'</b><span>'+esc(us.peran)+' &middot; '+esc(S.paket.nama)+'</span></div></div>':'')+
      '<div><div class="cap" style="margin:0 4px 8px">Tema</div><div class="seg">'+
      [['sistem','Ikuti sistem'],['terang','Terang'],['gelap','Gelap']].map(function(o){return '<button type="button" data-act="tema" data-v="'+o[0]+'"'+(S.tema===o[0]?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div></div>'+
      '<div><div class="cap" style="margin:0 4px 8px">Animasi</div><div class="seg">'+
      [['sistem','Ikuti sistem'],['penuh','Penuh'],['hemat','Hemat']].map(function(o){return '<button type="button" data-act="anim" data-v="'+o[0]+'"'+(S.anim===o[0]?' class="on"':'')+'>'+o[1]+'</button>'}).join('')+'</div></div>'+
      (us?'<div class="btnrow"><button type="button" class="btn sec" data-act="ganti">Ganti paket</button><button type="button" class="btn bad" data-act="keluar">Keluar</button></div>':'')+
      '<button type="button" class="btn sec" data-act="bersih">Bersihkan cache aplikasi</button>'+
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
  if(m.t==='mirip'){
    var mp=m.mirip,lbm=labelBidang(m.f.bidang),tj=mp.jenis==='gedung'?lbm.area:lbm.level;
    return '<div class="ov mid"><div class="sheet gap" role="dialog" aria-label="Nama mirip"><h2>Sudah ada '+esc(mp.entri)+'</h2><div class="note" style="padding:0;overflow-wrap:anywhere">Anda mengetik "'+esc(mp.masuk)+'"'+(mp.jenis==='lantai'?' di '+esc(mp.gedung):'')+'. '+esc(tj)+' yang sudah ada: "'+esc(mp.entri)+'". Pakai yang sudah ada supaya tidak ganda.</div>'+
      '<button type="button" class="btn" data-act="miripPakai">Pakai '+esc(mp.entri)+'</button><button type="button" class="btn sec" data-act="miripBaru">Tetap buat baru</button><button type="button" class="btn sec" data-act="miripBatal">Batal</button></div></div>';
  }
  if(m.t==='kmenu')
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Menu temuan"><div class="group kmenu"><div class="list">'+kmenuItems(m.d).map(function(it){return '<button type="button" class="row act'+(it.bad?' bad':'')+'" data-act="'+it.a+'" data-d="'+esc(m.d.id)+'">'+it.t+'</button>'}).join('')+'</div></div><button type="button" class="btn sec" data-act="mtutup">Tutup</button></div></div>';
  if(m.t==='unggah')
    return '<div class="ov mid" data-act="modalbg"><div class="sheet gap" role="dialog" aria-label="Unggah foto"><h2>Foto '+(m.j==='before'?'Before':'After')+'</h2><div class="note" style="padding:0">Foto dipotong otomatis ke rasio 4:3 (landscape) lalu dikecilkan sebelum diunggah.</div>'+
      '<button type="button" class="btn" data-act="foto" data-d="'+esc(m.d.id)+'" data-j="'+m.j+'" data-cam="1">'+ic('cam')+'Ambil foto (kamera)</button>'+
      '<button type="button" class="btn sec" data-act="foto" data-d="'+esc(m.d.id)+'" data-j="'+m.j+'">'+ic('img')+'Pilih dari galeri</button>'+
      '<button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='hapus')
    return '<div class="ov mid"><div class="sheet gap"><h2>Hapus temuan?</h2><div class="note" style="padding:0;overflow-wrap:anywhere">'+esc(m.d.uraian)+'</div><div class="note" style="padding:0">Temuan hilang dari daftar dan foto dipindah ke folder Sampah. Hanya Admin yang bisa memulihkannya.</div>'+
      '<button type="button" class="btn bad" data-act="hapusya">Hapus</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div>';
  if(m.t==='ruang')
    return '<div class="ov"><div class="sheet" role="dialog" aria-label="Ubah ruangan"><h2>Ubah ruangan</h2><section class="group"><div class="list">'+
      '<label class="row"><span class="lbl">Gedung</span><input type="text" id="rG" value="'+esc(m.r.gedung)+'"></label>'+
      '<label class="row"><span class="lbl">Lantai</span><input type="text" id="rL" value="'+esc(m.r.lantai)+'"></label>'+
      '<label class="row"><span class="lbl">Ruangan</span><input type="text" id="rN" value="'+esc(m.r.nama)+'"></label></div></section>'+
      '<div class="gap"><button type="button" class="btn" data-act="rsimpan">Simpan</button><button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>';
  if(m.t==='nonaktif')
    return '<div class="ov mid"><div class="sheet gap"><h2>Nonaktifkan ruangan?</h2><div class="note" style="padding:0">'+esc(m.r.gedung)+' / '+esc(m.r.lantai)+' / '+esc(m.r.nama)+'. Temuannya tetap tersimpan di sheet.</div>'+
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
function onFiles(ev){
  var files=Array.prototype.slice.call(ev.target.files||[]);ev.target.value='';
  if(!files.length||!pickCb)return;
  var cb=pickCb;pickCb=null;cb(files);
}
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
  return '<div class="thumb up">'+pv+'<div class="ov2"><span class="sp"></span><small>'+lbl+'</small></div></div>';
}
function upUi(did){
  var d=did&&findDefect(did);
  if(d){
    var a=Array.prototype.filter.call(document.querySelectorAll('article.entry'),function(x){return x.getAttribute('data-id')===did})[0];
    if(a){var ro=a.getAttribute('data-ro')==='1';['before','after'].forEach(function(jn){var p=a.querySelector('.ph[data-j="'+jn+'"]');if(p)p.innerHTML=phHtml(d,jn,ro)})}
  }
  upBar();
}
function upBar(){
  var el=$('upbar');if(!el){el=document.createElement('div');el.id='upbar';el.className='upbar';el.setAttribute('role','status');document.body.appendChild(el)}
  var n=S.up.filter(function(x){return x.st!=='err'}).length,e=S.up.length-n;
  if(!S.user||(!n&&!e)){el.hidden=true;return}
  el.innerHTML=n?'<span class="sp"></span>Mengunggah '+n+' foto'+(e?', '+e+' gagal':''):e+' foto gagal diunggah';
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
  var h='<section class="group"><div class="sh">Daftar isian</div>';
  if(!S.regOk||!S.reg)return h+'<div class="gf">Server belum mendukung daftar isian. Pasang Kode.gs terbaru lalu jalankan siapkan().</div></section>';
  var T=tree(),a=rgArea();
  h+='<div class="list"><label class="row"><span class="lbl">Area</span><select data-rg="area">'+T.map(function(g){return '<option value="'+esc(g.nama)+'"'+(g.nama===a?' selected':'')+'>'+esc(g.nama)+'</option>'}).join('')+'</select></label></div>';
  if(!S.rg.pakai)return h+'<div class="gf">Kelompok grid dan Elemen terbentuk sendiri dari temuan. Di sini admin merapikan yang salah ketik.</div><div class="acts" style="padding-top:0;padding-bottom:14px"><button type="button" class="pill" data-act="rgmuat">Tampilkan daftar</button></div></section>';
  var P=S.rg.pakai,ka=L.kunci(a);
  var kand=rgKandidat(a);
  if(kand.length){
    h+='<div class="note" style="font-weight:600;padding-top:12px">Perlu dicek</div><div class="list">'+kand.map(function(c){
      var atr=c.j==='kelompok'?'data-j="kelompok" data-k="'+esc(c.x)+'"':'data-j="elemen" data-b="'+esc(c.bidang)+'" data-nama="'+esc(c.x)+'"';
      return '<div class="row" style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0;overflow-wrap:anywhere"><b>'+esc(c.x)+'</b> ('+c.nx+') mirip <b>'+esc(c.y)+'</b> ('+c.ny+')'+(c.bidang?' <span class="tag">'+esc(c.bidang)+'</span>':'')+'</span><button type="button" class="pill" data-act="rgatur" '+atr+'>Atur</button></div>'}).join('')+'</div>';
  }
  var kels=S.reg.kelompok.filter(function(e){return L.kunci(e.area)===ka}).sort(function(x,y){return L.bandingNama(x.k,y.k)});
  var tanpa=S.reg.kode.filter(function(e){return L.kunci(e.area)===ka&&e.k===''});
  h+='<div class="note" style="font-weight:600;padding-top:12px">Kelompok grid</div><div class="list">';
  if(!kels.length&&!tanpa.length)h+='<div class="gf">Belum ada. Terbentuk otomatis dari temuan, atau isi awal di bawah.</div>';
  function kodeTags(k,list){return '<div class="meta" style="padding:8px 0 0">'+list.sort(function(x,y){return L.bandingAlami(x.n,y.n)}).map(function(c){var nn=P.kode[ka+'|'+k+'|'+c.n]||0;return '<button type="button" class="tag" style="border:0;cursor:pointer" data-act="rgatur" data-j="kode" data-k="'+esc(k)+'" data-n="'+esc(c.n)+'">'+esc(c.n)+' · '+nn+'</button>'}).join('')+'</div>'}
  kels.forEach(function(e){
    var n=P.kelompok[ka+'|'+e.k]||0,kodes=S.reg.kode.filter(function(x){return L.kunci(x.area)===ka&&x.k===e.k});
    h+='<div class="row"><div style="display:flex;align-items:center;gap:10px"><span style="flex:1;min-width:0"><b>'+esc(e.k)+'</b> <span class="tag">'+(e.pem===''?'tanpa pemisah':'pemisah '+esc(e.pem))+'</span> <span class="tag">'+n+' temuan</span></span><button type="button" class="pill" data-act="rgatur" data-j="kelompok" data-k="'+esc(e.k)+'">Atur</button></div>'+kodeTags(e.k,kodes)+'</div>';
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
  h+='<div class="note" style="font-weight:600;padding-top:12px">Isi awal dari gambar kerja</div><div class="list">'+
    '<div class="two"><label class="row"><span class="lbl">Kelompok</span><input type="text" id="rgK" placeholder="Mis. T3" autocomplete="off"></label><label class="row"><span class="lbl">Pemisah</span><select id="rgP"><option value="-">T3-C</option><option value=".">T3.C</option><option value="">T3C</option></select></label></div>'+
    '<div class="two"><label class="row"><span class="lbl">Kode dari</span><input type="text" id="rgD" placeholder="A atau 1" autocomplete="off"></label><label class="row"><span class="lbl">sampai</span><input type="text" id="rgS" placeholder="E atau 20" autocomplete="off"></label></div></div>'+
    '<div class="acts" style="padding-top:12px;padding-bottom:14px"><button type="button" class="pill" data-act="rgseed">'+ic('plus')+'Tambahkan</button><button type="button" class="pill" data-act="rgmuat">'+ic('refresh')+'Muat ulang</button></div></section>';
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
async function modalFotos(f,files){
  f.pend=(f.pend||0)+files.length;mphRefresh();
  for(var i=0;i<files.length;i++){
    try{var x=await prep(files[i]);if(S.modal&&S.modal.f===f)f.files.push(x)}catch(e){toast('Foto tidak bisa dibaca. Coba foto lain.')}
    f.pend--;if(S.modal&&S.modal.f===f)mphRefresh();
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
  else if(jenis==='ruang')S.rooms.forEach(function(r){if(r.gedung===a&&r.lantai===b&&!r.bidang)add(r.nama,r.total,0,{id:r.id})});
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
    var T0=tree(),LB0=labelBidang(f.bidang),d0={},add=function(n){if(L.rapi(n))d0[L.kunci(n)]={nama:n,n:0,t:0}};
    if(id==='gedung')T0.forEach(function(g){add(g.nama)});
    else{var g0=T0.filter(function(x){return L.kunci(x.nama)===L.kunci(f.gedung)})[0];if(g0)g0.lantai.forEach(function(l){add(l.nama)})}
    return {d:d0,fuzzy:true,urut:'alami',tambah:(id==='gedung'?LB0.area:LB0.level).toLowerCase(),norm:function(v){return L.rapi(v)}};
  }
  if(id==='ruang')return {d:regDaftar('ruang',f.gedung,f.lantai),fuzzy:true,urut:'frek',tambah:'ruangan',norm:function(v){return L.rapi(v)}};
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
  var urut=s.urut==='alami'?function(x,y){if(s.pref){var px=tipe(x.nama)===s.pref,py=tipe(y.nama)===s.pref;if(px!==py)return px?-1:1}return L.bandingAlami(x.nama,y.nama)}:function(x,y){return (y.n-x.n)||(y.t-x.t)||L.bandingNama(x.nama,y.nama)};
  if(!kq)out=all.slice().sort(urut).slice(0,s.urut==='alami'?40:6).map(function(e){return {e:e}});
  else{
    var sk=all.map(function(e){var k=L.kunci(e.nama),sc=k===kq?0:k.indexOf(kq)===0?1:k.indexOf(kq)>=0?2:(s.fuzzy&&kq.length>=4&&(L.jarak(kq,k)<=1||(k.length>=4&&kq.indexOf(k)===0)))?3:9;return {e:e,sc:sc}})
      .filter(function(x){return x.sc<9}).sort(function(x,y){return (x.sc-y.sc)||urut(x.e,y.e)});
    out=sk.slice(0,8).map(function(x){return {e:x.e,mirip:x.sc===3}});
  }
  var ada=kq&&all.some(function(e){return L.kunci(e.nama)===kq}),nv=kq?s.norm(q):null;
  return {opsi:out,tambah:(kq&&!ada&&s.tambah&&nv)?{nilai:nv,label:s.tambah}:null};
}
function cbIsi(id,q){
  var r=cbOpsi(id,q),box=$(id+'_l'),el=$(id);if(!box)return;
  var h=r.opsi.map(function(o,i){return '<div class="cko" role="option" id="'+id+'_o'+i+'" aria-selected="false" data-id="'+id+'" data-v="'+esc(o.e.nama)+'"><span>'+esc(o.e.nama)+(o.mirip?' <small>(mirip)</small>':'')+'</span>'+(o.e.n?'<small>'+o.e.n+'</small>':'')+'</div>'}).join('');
  if(r.tambah)h+='<div class="cko add" role="option" data-id="'+id+'" data-tambah="1" data-v="'+esc(r.tambah.nilai)+'">+ Tambah '+esc(r.tambah.label)+' "'+esc(r.tambah.nilai)+'"</div>';
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
    if(id==='gedung'){var gx=tree().filter(function(x){return x.nama===f.gedung})[0],ok=gx&&gx.lantai.some(function(l){return l.nama===f.lantai});
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
  var T=tree(),s=ensureSel(T),cur=s.r,reg=S.regOk;
  var f={id:null,gedung:s.g.nama,lantai:s.l.nama,bidang:BIDANG[0],tingkat:TINGKAT[0],tgl:today(),uraian:'',files:[],lama:!reg,
    ruanganId:cur.id,lok:'ruang',ruang:'',elemen:'',mode:'tanpa',a:{k1:'',n1:'',k2:'',n2:''},b:{k1:'',n1:'',k2:'',n2:''},kd:{k:'',n:''},teks:'',pemBaru:{},conf:{},kunciBidang:false,lokasiTeks:'',step:d?null:'lokasi',xk:{},baru:null,abc:false};
  if(d){
    f.id=d.id;f.gedung=d.gedung;f.lantai=d.lantai;f.bidang=d.bidang;f.tingkat=d.tingkat;f.tgl=d.tglTemuan||today();f.uraian=d.uraian;f.ruanganId=d.ruanganId;f.lokasiTeks=d.ruangan;
    var rm=S.rooms.filter(function(r){return r.id===d.ruanganId})[0];f.kunciBidang=!!(rm&&rm.bidang);
    f.elemen=d.elemen||'';
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
  return f;
}
/** Bawaan Lokasi dan bentuk Titik menurut bidang. cur = ruangan yang sedang dibuka di layar Form. */
function fAtur(f,cur){
  if(BID_RUANG[f.bidang]){f.lok='ruang';f.ruang=(cur&&!cur.bidang)?cur.nama:'';f.mode='tanpa'}
  else{f.lok='umum';f.mode=f.bidang==='Struktur'?'grid':'teks'}
}
function openForm(d){
  var s=ensureSel(tree());if(!s)return;
  openModal({t:'temuan',f:fBuat(d,null)});
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
  ['a','b'].forEach(function(ax){['k1','n1','k2','n2'].forEach(function(x){var e=$(ax+x);if(e)f[ax][x]=e.value})});
  if($('kdk'))f.kd.k=$('kdk').value;if($('kdn'))f.kd.n=$('kdn').value;
  var eg=$('gedung'),el=$('lantai');
  if(eg){
    f.gedung=eg.value;var T=tree(),gm=T.filter(function(x){return L.kunci(x.nama)===L.kunci(f.gedung)})[0];
    f.gMode=!gm&&!!L.rapi(f.gedung);if(gm)f.gedung=gm.nama;
    if(el){f.lantai=el.value;var lm=gm&&gm.lantai.filter(function(x){return L.kunci(x.nama)===L.kunci(f.lantai)})[0];f.lMode=!lm&&!!L.rapi(f.lantai);if(lm)f.lantai=lm.nama}
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
var KODE_BID={Arsitektur:'ARS',Struktur:'STR',MEEP:'MEEP',Infrastruktur:'INF',Lansekap:'LAN'};
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
  var f=m.f,h='<div class="ov" data-act="modalbg"><div class="sheet wz" role="dialog" aria-label="Tambah temuan">';
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
    h+='<button type="button" class="btn" data-act="wgo" data-v="foto">Lanjut: foto</button>';
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
      '<div class="row dikte" id="mUr"><textarea id="mU" aria-label="Temuan" placeholder="Apa temuannya? (ketuk, bicara, atau ketik)">'+esc(f.uraian)+'</textarea></div>'+
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
function wStep(s){
  var f=S.modal&&S.modal.f;if(!f)return;fBaca();cbTutup();f.step=s;renderOverlay();fSegar();
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
function fHtml(m){
  if(!m.f.id&&!m.f.lama)return fWizHtml(m);
  var f=m.f,mm=fModeElemen(f),h;
  h='<div class="ov" data-act="modalbg"><div class="sheet" role="dialog" aria-label="Temuan"><h2>'+(f.id?'Ubah temuan':'Tambah temuan')+'</h2>';
  h+='<section class="group vis"><div class="list">';
  if(f.id||f.lama)h+='<div class="row"><span class="lbl">'+(f.id?'Lokasi':labelBidang(f.bidang).area+' / '+labelBidang(f.bidang).level)+'</span><div>'+esc(f.id?(f.gedung+' / '+f.lantai+' / '+f.lokasiTeks):(f.gedung+' / '+f.lantai))+'</div></div>';
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
    '<label class="row" id="mUr"><span class="lbl">Temuan / catatan</span><textarea id="mU" placeholder="Tulis atau dikte temuan dengan mikrofon keyboard">'+esc(f.uraian)+'</textarea></label></div></section>';
  if(!f.id){
    h+='<section class="group pad"><div class="cap" style="margin-bottom:8px">Foto Before</div>'+
      '<div id="mph">'+mphHtml(f)+'</div>'+
      '<div class="pbtn"><button type="button" class="pill" data-act="mfoto" data-cam="1">'+ic('cam')+'Kamera</button><button type="button" class="pill" data-act="mfoto">'+ic('img')+'Galeri</button></div></section>';
  }
  h+='<div class="gap"><button type="button" class="btn" data-act="msimpan">Simpan</button>'+(!f.id&&!f.lama?'<button type="button" class="btn sec" data-act="msimpanlagi">Simpan &amp; tambah lagi di lokasi ini</button>':'')+'<button type="button" class="btn sec" data-act="mtutup">Batal</button></div></div></div>';
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
    var s=cbSumber(id),nv=s.norm(v);
    if(nv===null||nv===undefined)return;               // galat bentuk ditangkap fTitik
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
async function saveForm(lagi){
  fBaca();var f=S.modal.f;
  if(!f.id&&!f.lama&&f.step!=='detail')return;
  if(!f.uraian.trim()){$('mUr').classList.add('bad');toast('Isi temuan terlebih dahulu.');return}
  if(f.pend){toast('Foto masih disiapkan, tunggu sebentar.');return}
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
    p.elemen=L.rapi(f.elemen);p.mode=(f.mode==='tanpa')?'':f.mode;p.titik=t.data||{};p.pemBaru=f.pemBaru;
    if(!f.id){
      if(f.lok==='umum')p.umum=true;
      else{var ex=regDaftar('ruang',f.gedung,f.lantai)[L.kunci(f.ruang)];if(ex)p.ruanganId=ex.id;else p.ruanganBaru=L.rapi(f.ruang)}
    }
  }
  var files=f.files.slice(),isNew=!f.id,t0=Date.now();
  closeModal();
  var res=await work('Menyimpan temuan...',function(){return api('defect_simpan',p)});
  if(!res){f.files=files;openModal({t:'temuan',f:f});return}
  if(res.perluKonfirmasi){f.files=files;f.lagiTmp=lagi;openModal({t:'mirip',f:f,mirip:res.mirip});return}   // nama mirip yang sudah ada: tanya pengguna
  lsSet('dl-bidang',f.bidang);
  if(isNew)lsSet('dl-lok',JSON.stringify({bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?(res.ruangan||f.ruang):'')}));
  if(UKUR)console.log('[ukur] simpan temuan, klien total '+(Date.now()-t0)+'ms, server',res.ms);
  if(res.lokasi&&res.lokasi.baru){ // ruangan atau lokasi umum baru dibuat di server
    var lk=res.lokasi;S.rooms.push({id:lk.id,gedung:lk.gedung,lantai:lk.lantai,nama:lk.nama,jenis:lk.jenis,nomor:lk.nomor,bidang:lk.bidang,urut:S.rooms.length,open:0,proses:0,close:0,total:0});
    lsSet('dl-rooms-'+S.paket.id,JSON.stringify(S.rooms));
  }
  if(isNew&&res.lokasi&&res.lokasi.baru&&S.defects[res.ruanganId]===undefined){S.defects[res.ruanganId]=[]}   // ruangan yang baru dibuat memang kosong
  putDefect(res);regTerapkan(res,f);
  if(isNew&&(S.sel.r!==res.ruanganId)){S.sel={g:res.gedung,l:res.lantai,r:res.ruanganId};lsSet('dl-sel',JSON.stringify(S.sel))}
  if(isNew&&files.length){
    files.forEach(function(x){var jb2={k:nk(),did:res.id,jenis:'before',data:x,st:'wait'};S.up.push(jb2);qSave(jb2)});
    wToastSimpan(lagi,f,res,'Tersimpan. Foto diunggah di latar.');
  }else wToastSimpan(lagi,f,res,'Tersimpan.');
  render();upBar();runQueue();
  if(lagi&&isNew){var nf=fBuat(null,{bidang:f.bidang,gedung:f.gedung,lantai:f.lantai,lok:f.lok,ruang:(f.lok==='ruang'?res.ruangan:''),elemen:res.elemen||'',mode:f.mode,a:{k1:f.a.k1},b:{k1:f.b.k1},kd:{k:f.kd.k}});nf.step='foto';openModal({t:'temuan',f:nf})}
}

async function onClick(ev){
  var el=ev.target.closest('[data-act]');if(!el)return;
  var a=el.getAttribute('data-act');
  if(a==='modalbg'&&ev.target!==el)return;
  if(a==='zoomx'&&ev.target.closest('img')&&!ev.target.closest('.btn-ic'))return;
  var id=el.getAttribute('data-d');
  if(S.modal&&S.modal.t==='aksi'&&a!=='mtutup'&&a!=='modalbg')closeModal();
  switch(a){
    case 'paket': return pilihPaket(el.getAttribute('data-id'),true);
    case 'ganti': resetHist(false);S.paket=null;S.user=null;S.kode='';S.loginErr='';S.modal=null;S.zoom=null;S.file=null;lsDel(STORE);renderOverlay();return render();
    case 'keluar': keluar();return render();
    case 'masuk': return masuk();
    case 'tab': {
      var nv=el.getAttribute('data-v');if(nv===S.view)return;
      if(nv==='form')hpopTop('view');else if(S.view==='form')hpush('view');
      S.view=nv;}
      lsSet('dl-view',S.view);if(S.view==='rekap')S.all=null;render();
      if(S.view==='verif')loadSiap();
      else if(S.view==='perbaikan')loadPerlu();
      else if(S.view==='rekap'||S.view==='kelola')loadRooms();
      else{var s=ensureSel(tree());if(s)loadDefects(s.r.id,false)}
      return;
    case 'nav': {var T=tree(),fl=flat(T),ix=fl.map(function(x){return x.r}).indexOf(S.sel.r),n=fl[ix+(+el.getAttribute('data-d'))];if(!n)return;S.sel=n;lsSet('dl-sel',JSON.stringify(n));render();loadDefects(n.r,false);window.scrollTo(0,0);return}
    case 'muat': return loadDefects(S.sel.r,true);
    case 'tambah': return openForm(null);
    case 'edit': return openForm(findDefect(id));
    case 'zoom': return openZoom(thumb(el.getAttribute('data-f'),1024));
    case 'zoomx': return closeZoom();
    case 'mzoom': readForm();return openZoom(S.modal.f.files[+el.getAttribute('data-i')]);
    case 'foto': {
      var jenis=el.getAttribute('data-j');
      pick(!!el.getAttribute('data-cam'),function(items){
        enqueue(id,jenis,items);
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
    case 'unggah': return openModal({t:'unggah',d:findDefect(id),j:el.getAttribute('data-j')||'after'});
    case 'mfoto': readForm();return pick(!!el.getAttribute('data-cam'),function(items){modalFotos(S.modal.f,items)});
    case 'upretry': {var jr=S.up.filter(function(x){return String(x.k)===el.getAttribute('data-k')})[0];if(jr){jr.st='wait';upUi(jr.did);runQueue()}return}
    case 'upbuang': {var jb=S.up.filter(function(x){return String(x.k)===el.getAttribute('data-k')})[0];S.up=S.up.filter(function(x){return x!==jb});if(jb){qDel(jb.k);upUi(jb.did)}return}
    case 'mdel': readForm();S.modal.f.files.splice(+el.getAttribute('data-i'),1);return mphRefresh();
    case 'msimpan': return saveForm(false);
    case 'msimpanlagi': return saveForm(true);
    case 'pdfbidang': {var sb=ensureSel(tree());var lb=lsGet('dl-bidang');openModal({t:'pdfbidang',g:sb?sb.g.nama:'',b:BIDANG.indexOf(lb)>=0?lb:BIDANG[0]});return}
    case 'pdfbidangya': {var pg=$('pbG').value,pb=$('pbB').value;lsSet('dl-bidang',pb);closeModal();return exportPdfBidang(pg,pb)}
    case 'rgmuat': {var pk=await work('Memuat...',function(){return api('registri_pakai')});if(pk){S.rg.pakai=pk;render()}return}
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
    case 'wback': {var wb=S.modal.f,mp={foto:'lokasi',detail:'foto',elemen:'detail',titik:'detail'};
      if(wb.step==='lokasi')return closeModal();
      if(wb.step==='titik'){fBaca();var tt=fTitik(wb,false);if(!tt.ok){toast(tt.err);return}}
      return wStep(mp[wb.step]||'lokasi')}
    case 'wbid': {fBaca();var wd=S.modal.f,nb=el.getAttribute('data-v');if(nb===wd.bidang)return;
      wd.bidang=nb;wd.conf={};wd.elemen='';var ss=ensureSel(tree());fAtur(wd,ss?ss.r:null);return wStep('lokasi')}
    case 'wpakai': {var po=wTerakhir(),wp=S.modal.f;if(!po)return;
      wp.bidang=po.bidang;wp.gedung=po.gedung;wp.lantai=po.lantai;wp.gMode=false;wp.lMode=false;wp.conf={};
      wp.lok=po.lok;wp.ruang=po.lok==='ruang'?po.ruang:'';wp.mode=BID_RUANG[wp.bidang]?'tanpa':(wp.mode==='tanpa'?(wp.bidang==='Struktur'?'grid':'teks'):wp.mode);
      return wStep('foto')}
    case 'wsev': {fBaca();S.modal.f.tingkat=el.getAttribute('data-v');return wStep('detail')}
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
      var r=await work('Menyimpan...',function(){return api('perbaikan_mulai',{id:id})});
      if(r){putDefect(r);toast('Perbaikan dicatat dimulai.');render()}return;
    }
    case 'verif': return openModal({t:'verif',d:findDefect(id)});
    case 'vset': {
      var d=S.modal.d,cat=$('vC').value,h=el.getAttribute('data-h');
      closeModal();
      var r2=await work('Menyimpan verifikasi...',function(){return api('verifikasi',{id:d.id,hasil:h,catatan:cat})});
      if(r2){putDefect(r2);toast(h==='Diterima'?'Diterima. Temuan Close.':h==='Ditolak'?'Ditolak. Temuan kembali dalam proses.':'Verifikasi dibatalkan.');render()}
      else openModal({t:'verif',d:d});
      return;
    }
    case 'hapus': return openModal({t:'hapus',d:findDefect(id)});
    case 'hapusya': {
      var dd=S.modal.d;closeModal();
      var r3=await work('Menghapus...',function(){return api('defect_hapus',{id:dd.id})});
      if(r3){dropDefect(dd.id,dd.ruanganId);if(isAdmin())toastAksi('Temuan dihapus.','Urungkan',function(){urungkanHapus(dd)});else toast('Temuan dihapus.');render()}return;
    }
    case 'delfoto': {
      var r4=await work('Menghapus foto...',function(){return api('foto_hapus',{id:id,jenis:el.getAttribute('data-j'),fotoId:el.getAttribute('data-f')})});
      if(r4){putDefect(r4);render()}return;
    }
    case 'pdf': return exportPdf();
    case 'xlsx': return exportXlsx();
    case 'rekapall': {var ok=await work('Memuat semua temuan...',loadAll);if(ok)render();return}
    case 'addroom': return tambahRuangan();
    case 'fst': S.flt.st=el.getAttribute('data-v')||'';return refreshList();
    case 'fclr': S.flt={rid:S.flt.rid,q:'',st:'',bd:'',tk:'',el:''};return render();
    case 'zipg': S.zipOff[el.getAttribute('data-g')]=!el.checked;return;
    case 'zipgo': return exportZip();
    case 'zipbatal': S.zipStop=true;S.busy='Membatalkan...';return renderOverlay();
    case 'ubahroom': {var rr=S.rooms.filter(function(x){return x.id===el.getAttribute('data-r')})[0];if(rr)openModal({t:'ruang',r:rr});return}
    case 'rsimpan': {
      var rm=S.modal.r,g=$('rG').value,l=$('rL').value,n=$('rN').value;closeModal();
      var r5=await work('Menyimpan...',function(){return api('ruangan_ubah',{id:rm.id,gedung:g,lantai:l,ruangan:n})});
      if(r5){S.defects={};S.all=null;await loadRooms();toast('Ruangan diperbarui.')}return;
    }
    case 'delroom': {var r6=S.rooms.filter(function(x){return x.id===el.getAttribute('data-r')})[0];if(r6)openModal({t:'nonaktif',r:r6});return}
    case 'nonya': {
      var rn=S.modal.r;closeModal();
      var r7=await work('Menyimpan...',function(){return api('ruangan_hapus',{ids:[rn.id]})});
      if(r7){await loadRooms();toast('Ruangan dinonaktifkan.')}return;
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
  if(e.target.getAttribute&&e.target.getAttribute('data-rg')==='area'){S.rg.area=e.target.value;S.rg.pakai=null;render();return}
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
  var k=e.target.getAttribute&&e.target.getAttribute('data-sel');if(!k)return;
  var T=tree(),v=e.target.value;
  if(k==='g'){S.sel={g:v,l:'',r:''}}else if(k==='l'){S.sel={g:S.sel.g,l:v,r:''}}else S.sel={g:S.sel.g,l:S.sel.l,r:v};
  var s=ensureSel(T);lsSet('dl-sel',JSON.stringify(S.sel));render();if(S.modal&&S.modal.t==='lokpilih')renderOverlay();loadDefects(s.r.id,false);
});
document.addEventListener('input',function(e){
  if(e.target.id==='teks'&&S.modal&&S.modal.f&&!S.modal.f.id&&!S.modal.f.lama){var tf=S.modal.f;tf.teks=e.target.value;var tl=$('tkl');if(tl)tl.innerHTML=wTeksSaran(tf);fSegar();return}
  if(e.target.id==='elq'&&S.modal&&S.modal.f){S.modal.f.elq=e.target.value;var ll=$('ell');if(ll)ll.innerHTML=wElemenList(S.modal.f);return}
  if(e.target.id==='fq'){S.flt.q=e.target.value;refreshList();return}
  if(e.target.id==='kode'){
    var v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);e.target.value=v;S.kode=v;
    var cs=document.querySelectorAll('#boxes .cb'),i;
    for(i=0;i<cs.length;i++){cs[i].textContent=v[i]||'';cs[i].classList.toggle('f',i<v.length);cs[i].classList.toggle('on',i===Math.min(v.length,5))}
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
document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.closest&&t.closest('.thumb'))t.classList.add('in')},true);
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.closest&&t.closest('.thumb')){t.classList.add('in');t.style.opacity=.25}},true);

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
  if(r){S.kl={g:g,l:l,n:''};await loadRooms();toast(r.ditambah+' ruangan ditambah'+(r.dilewati?', '+r.dilewati+' sudah ada.':'.'))}
}

/* ---------- masuk / keluar ---------- */
function pilihPaket(id,push){
  var p=PAKET_LIST.filter(function(x){return x.id===id})[0];if(!p)return;
  if(push)hpush('paket');
  S.paket=p;lsSet(STORE,id);S.user=null;S.kode=lsGet('dl-kode-'+id)||'';S.loginErr='';S.rooms=[];S.roomsReady=false;S.defects={};S.all=null;S.siap=null;S.perlu=null;S.terhapus=null;
  try{var c=JSON.parse(lsGet('dl-rooms-'+id)||'null');if(c&&c.length){S.rooms=c}}catch(e){}
  S.reg=null;S.regOk=false;try{var cr=JSON.parse(lsGet('dl-reg-'+id)||'null');if(cr&&cr.kode){S.reg=cr;S.regOk=true}}catch(e){}
  if(S.kode&&p.apiUrl)return cobaMasuk(true);
  render();
}
function keluar(){
  resetHist(true);
  if(S.paket){lsDel('dl-kode-'+S.paket.id);bersihLokal(S.paket.id)}
  S.up=[];upBar();S.stale={};S.pv={};S.loading={};S.errs={};S.reg=null;S.regOk=false;S.rg={area:'',pakai:null};S.user=null;S.kode='';S.defects={};S.all=null;S.siap=null;S.perlu=null;S.terhapus=null;S.modal=null;S.zoom=null;S.file=null;S.view='form';renderOverlay();
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
  S.user={nama:u.nama,peran:u.peran};
  var v=lsGet('dl-view');S.view=((v==='rekap'||v==='verif')&&u.peran!=='PJ')||(v==='perbaikan'&&u.peran==='PJ')||(v==='kelola'&&u.peran==='ADMIN')?v:'form';
  if(S.view!=='form'&&S.hist[S.hist.length-1]!=='view')hpush('view');
  try{var sv=JSON.parse(lsGet('dl-sel')||'null');if(sv&&sv.g)S.sel=sv}catch(e){}
}
async function cobaMasuk(auto){
  var b=$('bMasuk');if(b){b.disabled=true;b.innerHTML='<span class="spin"></span>Memeriksa...'}
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
    aturPengguna(r);S.loginErr='';S.net='';
    lsSet('dl-kode-'+pid,S.kode);lsSet('dl-user-'+pid,JSON.stringify({nama:r.nama,peran:r.peran}));
    if(r.ruangan){S.rooms=r.ruangan;S.roomsReady=true;lsSet('dl-rooms-'+pid,JSON.stringify(S.rooms))}
    if(r.siap)S.siap=r.siap;
    if(r.perlu)S.perlu=r.perlu;
    if(r.registri){S.reg=r.registri;S.regOk=true;lsSet('dl-reg-'+pid,JSON.stringify(S.reg))}else{S.reg=null;S.regOk=false}
    render();
    if(r.ruangan){var s=ensureSel(tree());if(s&&S.view==='form')loadDefects(s.r.id,false)}
    else loadRooms();
    qPulihkan();
  }catch(e){
    if(e&&e.server){
      if(/Kode tidak dikenal|nonaktif/i.test(e.message||'')){   // hanya kode yang benar-benar ditolak yang dihapus
        S.user=null;S.loginNet=false;S.loginErr=cepat?'':'Kode tidak cocok. Periksa lalu coba lagi.';lsDel('dl-kode-'+pid);lsDel('dl-user-'+pid);S.kode='';render();
        if(cepat)openModal({t:'sesi'});return;
      }
      if(cepat){toast(e.message);return}                      // error server lain: tetap pakai tampilan tersimpan
      S.user=null;S.loginNet=false;S.loginErr=e.message;render();return;
    }
    if(cepat){S.net='Tidak terhubung. Menampilkan data terakhir yang tersimpan.';render();return}
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
  var h='<section class="group"><div class="sh">Impor dari Excel</div>';
  h+='<div class="acts" style="padding-top:0;padding-bottom:'+(im||rs?'8':'14')+'px"><button type="button" class="pill" data-act="imptpl">Unduh template</button><button type="button" class="pill" data-act="impfile">Pilih file Excel</button></div>';
  if(rs){
    h+='<div class="note" style="padding-top:0">Selesai: '+rs.ditambah+' temuan masuk'+(rs.ruanganBaru?', '+rs.ruanganBaru+' ruangan baru':'')+(rs.dilewati?', '+rs.dilewati+' duplikat dilewati':'')+(rs.ditolak.length?', '+rs.ditolak.length+' baris ditolak':'')+'.</div>';
    if(rs.ditolak.length)h+='<div class="note" style="padding-top:0">'+rs.ditolak.slice(0,15).map(function(x){return 'Baris '+x.baris+': '+esc(x.alasan)}).join('<br>')+(rs.ditolak.length>15?'<br>dan '+(rs.ditolak.length-15)+' lainnya.':'')+'</div>';
    h+='<div class="acts" style="padding-top:4px;padding-bottom:14px"><button type="button" class="pill" data-act="impbatal">Tutup</button></div>';
  }
  if(im){
    h+='<div class="list"><div class="row"><b>'+im.rows.length+'</b> temuan siap diimpor</div>'+
      '<div class="row">'+im.baru+' ruangan baru akan dibuat</div>'+
      (im.dupFile?'<div class="row">'+im.dupFile+' baris kembar dalam file dilewati</div>':'')+
      (im.bad.length?'<div class="row">'+im.bad.length+' baris bermasalah, tidak diimpor</div>':'')+'</div>';
    if(im.bad.length)h+='<div class="note">'+im.bad.slice(0,15).map(function(x){return 'Baris '+x.baris+': '+esc(x.alasan)}).join('<br>')+(im.bad.length>15?'<br>dan '+(im.bad.length-15)+' lainnya.':'')+'</div>';
    h+='<div class="acts" style="padding-top:12px;padding-bottom:14px">'+(im.rows.length?'<button type="button" class="pill" data-act="impgo">Impor '+im.rows.length+' temuan</button>':'')+'<button type="button" class="pill" data-act="impbatal">Batal</button></div>';
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
  S.file={name:name,url:url,fileObj:fo,canShare:can};hpush('file');renderOverlay();
}

async function exportXlsx(){
  S.busy='Menyusun Excel...';renderOverlay();
  try{
    await loadLib(XLSX_URL,'XLSX');
    var all=await loadAll();
    var X=window.XLSX,T=tree(),by={};
    all.forEach(function(d){(by[d.ruanganId]=by[d.ruanganId]||[]).push(d)});
    var head=[LBL_GAB.area,LBL_GAB.level,LBL_GAB.lokasi,'No','Bidang','Defect Pekerjaan','Tingkat','Tanggal Temuan','Status','Tanggal Close','Diverifikasi oleh','Catatan MK','Jumlah Foto Before','Jumlah Foto After','Elemen','Titik'];
    var rows=[head],rooms=[];
    var toDate=function(s){return s?new Date(s+'T00:00:00'):''};
    T.forEach(function(g){g.lantai.forEach(function(l){l.ruangan.forEach(function(r){
      rooms.push([g.nama,l.nama,r.nama]);
      (by[r.id]||[]).forEach(function(d,i){var st=d.status;
        rows.push([g.nama,l.nama,r.nama,d.no||i+1,d.bidang,d.uraian,d.tingkat,toDate(d.tglTemuan),st,st==='Close'?toDate(d.tglVerif):'',d.verifOleh||'',d.catatan||'',d.fotoBefore.length,d.fotoAfter.length,d.elemen||'',d.titik||''])});
    })})});
    var ws1=X.utils.aoa_to_sheet(rows,{cellDates:true});
    ws1['!cols']=[22,14,22,5,13,48,9,14,13,14,20,32,10,10,16,26].map(function(w){return {wch:w}});
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
function titikBaris(d){var a=[];if(d.elemen)a.push(d.elemen);if(d.titik)a.push(d.titik);return a.join(' · ')}
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
function pbHtml(m){
  var T=tree();
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
  if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}}
  var id=lsGet(STORE),p=PAKET_LIST.filter(function(x){return x.id===id})[0];
  if(p)pilihPaket(p.id);else render();
})();
})();
