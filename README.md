# Laporan Operasional PT. ETT Bogor

Aplikasi web pribadi untuk mengelola laporan bulanan berdasarkan workbook kosong yang diberikan. Tersedia tiga sheet Excel: **Master Data**, **BOP**, dan **BBM CASH**.

Untuk menggunakan situs melalui link Netlify di ponsel, ikuti panduan [deploy Netlify + Supabase](./NETLIFY.md). Deploy cloud menggunakan login email/password Supabase dan database terpisah; aplikasi lokal tetap memakai PIN serta `data/store.json`.

## Menjalankan di komputer host

Perlu Node.js 18 atau lebih baru. Buka PowerShell pada folder aplikasi, lalu jalankan:

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd start
```

Untuk pemakaian berikutnya, cukup klik dua kali [START-WEB.bat](./START-WEB.bat). File ini memasang dependensi jika diperlukan, meminta pembuatan PIN bila belum diatur, menjalankan server, lalu membuka `https://127.0.0.1:3443` otomatis. Jendela hitam yang terbuka harus tetap menyala saat menggunakan web.

Saat setup, buat PIN 6–12 angka. Ketikan PIN disamarkan dengan tanda `*` di PowerShell; tekan **Enter** setelah selesai dan ulangi PIN saat diminta. PIN tidak disimpan sebagai teks biasa. Saat server berjalan, akses `https://127.0.0.1:3443` dari komputer host atau alamat LAN yang dicetak di terminal dari perangkat lain pada jaringan yang sama.

Arsip laporan Juni–Oktober 2026 tersedia sebagai tombol bulan pada dashboard dan juga bisa dipilih melalui pengatur periode. Untuk mengimpor kembali workbook dari folder sumber:

```powershell
npm.cmd run import-reports -- --dry-run
npm.cmd run import-reports
```

Importer menggunakan workbook bulan Juni, Juli, Agustus, September, dan Oktober 2026 dari folder `Z:\KERANGKA LAPORAN OPERASIONAL BULANAN\BERKAS DATA PT. ETT BOGOR\2026`. Opsi `--dry-run` hanya menampilkan pratinjau. Impor normal menambahkan transaksi yang belum pernah diimpor, mengabaikan subtotal Excel, mempertahankan laporan web yang telah ada, dan membuat cadangan `data\store.json` sebelum menyimpan. Setelah impor, tutup dan jalankan ulang `START-WEB.bat`.

Sertifikat HTTPS dibuat lokal dan ditandatangani sendiri. Browser akan menampilkan peringatan sertifikat saat pertama kali dibuka; pastikan alamat yang dibuka adalah alamat host yang Anda jalankan sebelum melanjutkan. Tidak diperlukan layanan cloud atau koneksi internet untuk memakai aplikasi setelah dependensi terpasang.

## Akses jaringan lokal

Server hanya membuka alamat loopback dan alamat IPv4 privat (LAN), bukan alamat publik. Untuk perangkat lain, komputer host harus tetap menyala dan `npm.cmd start` harus tetap berjalan. Jika Windows Firewall meminta izin, izinkan hanya pada profil **Private**. Jika perlu membuat aturan secara manual dari PowerShell Administrator:

```powershell
New-NetFirewallRule -DisplayName "ETT Operasional LAN" -Direction Inbound -Protocol TCP -LocalPort 3443 -Action Allow -Profile Private
```

Jangan membuat port forwarding pada router. Perangkat yang berada pada jaringan lokal yang sama dapat menjangkau halaman login; PIN tetap diperlukan untuk membuka data.

Ganti PIN dari terminal dengan:

```powershell
npm.cmd run change-pin
```

## Fitur

- Laporan disimpan terpisah per bulan; master kendaraan dan tarif uang inap berlaku untuk semua bulan.
- Tambah, ubah, dan hapus kendaraan, tarif uang inap, rincian BOP, serta transaksi BBM.
- Tombol **Tambah baris** atau **Tambah pengisian** membuka formulir bertahap dengan kelompok pertanyaan dan indikator progres ala Google Forms. Gunakan tombol **Edit** di tabel untuk mengubah transaksi; tampilan dashboard dan tabel laporan tetap dipertahankan.
- Nama driver, nomor polisi, dan tipe armada tidak lagi saling mengubah otomatis saat diketik atau diedit. Jika perlu, pilih **Pilih armada dari Master Data** untuk menyalin ketiganya sekali; setelah itu setiap kolom bebas diedit.
- Pada tabel lebar, bilah geser horizontal tetap tersedia di bagian bawah layar dan tersinkron dengan tabel, sehingga kolom samping dapat dibuka tanpa menggulir halaman ke bagian bawah terlebih dahulu.
- Formulir nyaman digunakan di perangkat mobile; tabel menampilkan catatan yang sudah disimpan. Tombol **Cetak** mencetak bagian laporan yang sedang dibuka.
- Untuk mencetak, buka bagian Ringkasan, BOP, BBM, atau Master Data lalu tekan **Cetak** di kanan atas. Dialog browser menyediakan pilihan printer atau **Save as PDF**; tabel dicetak dalam orientasi landscape.
- Saat mengisi BOP maupun BBM, data armada dapat disalin sekali melalui pilihan Master Data atau dimasukkan manual; mengedit nama driver atau plat tidak memicu perubahan otomatis pada kolom lainnya.
- Pada formulir BBM, tanggal isi sebelumnya dan KM sebelumnya mengikuti pengisian terakhir untuk armada yang sama sebelum tanggal pengisian; keduanya tetap dapat dikoreksi. Harga/liter terisi otomatis: MB **Rp10.000**, CC/CDE/CDD Standar/CDD Ekstra Panjang **Rp6.800**. Tarif otomatis hanya berlaku untuk tipe armada yang dikenal.
- Total BOP, jarak, liter BBM, skala, dan ringkasan dihitung otomatis.
- Dashboard menampilkan jumlah seluruh armada menurut tipe, jumlah driver terdata, tren biaya harian, dan rincian pengeluaran tiap kategori BOP.
- Logo perusahaan dan latar dekoratif berlapis ditampilkan tanpa memuat sumber eksternal.
- Isi master data awal dari template: **16 unit** — MB 2, CC 2, CDE 4, CDD Standar 5, dan CDD Ekstra Panjang 3; **14 nama driver** terisi. Angka dashboard mengikuti master data yang dapat diedit.
- Data transaksi arsip yang diimpor: Juni (21 BOP/155 BBM), Juli (11/164), Agustus (12/164), September (26/217), dan Oktober (14/213).
- Unduh workbook `.xlsx` dengan tiga sheet, filter, freeze panes, format tanggal/mata uang, dan rumus Excel dengan hasil awal yang dihitung.
- Data aplikasi, konfigurasi PIN, dan sertifikat tersimpan di folder `data`; folder tersebut tidak disajikan sebagai konten web.
- Server menggunakan HTTPS, cookie sesi `HttpOnly`/`Secure`/`SameSite`, perlindungan percobaan PIN, header keamanan, dan pemeriksaan nama host untuk menolak DNS rebinding. Server hanya bind ke loopback dan alamat IPv4 privat.

Jika web ETT sudah berjalan, klik `START-WEB.bat` akan membuka halaman yang aktif tanpa menjalankan server kedua. Jika port dipakai aplikasi lain, jendela start menampilkan pesan agar port dapat dibebaskan. Jika browser tidak terbuka otomatis, salin tautan `https://127.0.0.1:3443` yang ditampilkan di jendela start.

## Pengujian

```powershell
npm.cmd test
```
