// Daftar paket. Isi apiUrl dengan URL web app (/exec) hasil deploy Kode.gs tiap paket.
// Ini API Defect List, terpisah dari API Site Memo.
var PAKET_LIST = [
  {
    id: 'MAPK',
    nama: 'MA-PK',
    label: 'Paket MA · PK · IKN',
    proyek: 'Paket MA-PK',
    apiUrl: 'https://script.google.com/macros/s/AKfycbzHaGK3b9SwUN7ami4e0VnZ0RNLFsxBHxMkau2HlOVzLq3erd6SwkumafIx50SMrrB9WQ/exec'
  },
  {
    id: 'MKKY',
    nama: 'MK-KY-Masjid',
    label: 'Paket MK · KY · Masjid · IKN',
    proyek: 'Paket MK-KY-Masjid',
    apiUrl: 'https://script.google.com/macros/s/AKfycbxlUo6-ktSlad_TbweyBckkJDW1-1SrT9DEipdpSucCwhjt_eLYh7TOfbrubN6AH8k8/exec'
  }
];

// Pilihan isian form. Ubah di sini bila perlu.
var BIDANG = ['Arsitektur', 'Struktur', 'MEEP', 'Infrastruktur', 'Lansekap'];
var TINGKAT = ['Minor', 'Mayor', 'Kritis'];
