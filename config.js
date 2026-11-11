// Daftar paket. Isi apiUrl dengan URL web app (/exec) hasil deploy Kode.gs tiap paket.
// Ini API Defect List, terpisah dari API Site Memo.
var PAKET_LIST = [
  {
    id: 'MAPK',
    nama: 'MA-PK',
    label: 'Paket MA · PK · IKN',
    proyek: 'Paket MA-PK',
    apiUrl: ''
  },
  {
    id: 'MKKY',
    nama: 'MK-KY-Masjid',
    label: 'Paket MK · KY · Masjid · IKN',
    proyek: 'Paket MK-KY-Masjid',
    apiUrl: ''
  }
];

// Pilihan isian form. Ubah di sini bila perlu.
var BIDANG = ['Arsitektur', 'Struktur', 'Mekanikal', 'Elektrikal', 'Plumbing', 'Lansekap'];
var TINGKAT = ['Minor', 'Mayor', 'Kritis'];
