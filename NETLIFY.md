# Deploy ke Netlify dan Supabase

Versi Netlify memakai Netlify Functions sebagai API dan Supabase sebagai penyimpanan persisten. Situs dapat dibuka dari perangkat mana pun, tetapi data laporan hanya diberikan kepada satu alamat email yang ditetapkan pada environment variable `ETT_ALLOWED_EMAIL`.

**Jangan masukkan `data/store.json`, PIN lokal, atau kunci Supabase ke repository.** Folder `data/` sudah dikecualikan oleh `.gitignore`. Kunci `service_role` hanya dipakai melalui prompt migrasi lokal atau environment Functions di Netlify; jangan pernah menaruhnya di `public/`, source frontend, atau chat.

## 1. Siapkan Supabase

1. Buat project Supabase dan simpan alamat Project URL.
2. Buka **SQL Editor**, jalankan seluruh isi [`supabase/schema.sql`](./supabase/schema.sql). Tabel laporan menggunakan Row Level Security dan tidak memberikan akses langsung kepada browser.
3. Di **Authentication → Providers**, aktifkan Email/password dan matikan pendaftaran publik. Tambahkan satu user dengan email dan kata sandi yang akan dipakai untuk login web; pastikan email sudah dikonfirmasi.
4. Dari **Project Settings → API**, siapkan Project URL, anon/public key, dan legacy `service_role` key. `service_role` bersifat rahasia dan melewati Row Level Security.

## 2. Deploy kode ke Netlify

1. Buat **private repository** GitHub milikmu, lalu unggah kode aplikasi tanpa folder `node_modules` dan `data`. Pastikan `data/store.json`, `data/auth.json`, TLS key, dan backup tidak muncul di daftar file repository.
2. Di Netlify pilih **Add new site → Import an existing project**, sambungkan repository private tersebut.
3. Build command boleh dikosongkan; publish directory adalah `public`. File [`netlify.toml`](./netlify.toml) sudah mengatur fungsi API dan routing.
4. Di pengaturan situs **Environment variables**, tambahkan:

   | Nama | Nilai |
   | --- | --- |
   | `SUPABASE_URL` | Project URL Supabase |
   | `SUPABASE_ANON_KEY` | anon/public key Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | legacy `service_role` key Supabase (**rahasia; scope Functions saja**) |
   | `ETT_ALLOWED_EMAIL` | Email user Supabase yang diizinkan login |

5. Jalankan deploy/redeploy setelah environment variables tersimpan. Netlify akan memberikan URL `https://....netlify.app`; buka URL itu dari ponsel atau komputer.

Halaman login dapat dibuka publik, tetapi API memverifikasi user Supabase dan hanya mengizinkan `ETT_ALLOWED_EMAIL` yang cocok. Jangan aktifkan pendaftaran publik di Supabase.

## 3. Pindahkan laporan lokal

Jalankan setelah tabel Supabase dibuat dan deploy cloud berhasil. Pada PowerShell, dari folder aplikasi:

```powershell
npm.cmd run migrate:supabase
```

Masukkan Project URL dan `service_role` key saat diminta. Input key disamarkan dengan `*`, tidak ditulis ke file, dan jangan dikirim melalui chat. Ketik `MIGRATE` untuk mengonfirmasi pengiriman laporan ke cloud. Script memvalidasi data lokal, mencegah overwrite tanpa konfirmasi, dan **tidak menghapus atau mengubah** `data/store.json` lokal.

Setelah migrasi, login melalui URL Netlify menggunakan email dan kata sandi Supabase. Uji buka arsip beberapa bulan, simpan satu perubahan yang dapat dikenali, lalu unduh Excel. Hapus perubahan uji sesudahnya jika tidak diperlukan.

## Pemecahan masalah

- **Konfigurasi Supabase belum lengkap**: pastikan keempat environment variables tersedia untuk scope Functions dan lakukan redeploy.
- **Database gagal memproses permintaan**: jalankan kembali `supabase/schema.sql` dan pastikan `service_role` key benar.
- **Email atau kata sandi tidak benar**: pastikan user sudah dibuat/dikonfirmasi dan alamat email sama persis dengan `ETT_ALLOWED_EMAIL`.
- **Migrate menolak URL/key**: gunakan Project URL HTTPS dan legacy `service_role` key, bukan anon key.
- Perubahan aplikasi berikutnya perlu di-commit dan dideploy ulang melalui private repository.

## Akses lokal

Deploy cloud tidak menggantikan cara kerja lokal. `START-WEB.bat` dan `npm.cmd start` tetap menggunakan PIN serta `data/store.json` di komputer ini; database lokal dan Supabase cloud terpisah.
