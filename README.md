# Filter Withdraw

Aplikasi web lokal untuk **REVIEW**, **ADMIN Withdraw**, dan **NTT ⇄ VENDOR → DOC**.

## Prinsip integritas data

Aplikasi memakai aturan ketat untuk alur NTT:

**1 transaksi = 1 KODE NTT + 1 NOREK + 1 NOMINAL + 1 BANK.**

Pada tampilan normal, transaksi hanya masuk ke DATA DOC jika DATA NTT dan DATA VENDOR sama-sama tersedia dan seluruh field inti tervalidasi:

- KODE NTT sama
- Nominal sama
- No Rek sama
- Bank konsisten
- Tidak ada konflik/dobel yang terdeteksi
- Filter sembunyikan NTT berlaku ke NTT, Vendor, dan DOC secara bersamaan

Jika data inti tidak lengkap atau konflik, transaksi **tidak dipaksakan menjadi MATCH/DOC**. Data yang tidak sinkron tetap dapat diperiksa melalui filter/audit yang tersedia.

> **Catatan validitas:** tidak ada aplikasi offline yang dapat dijamin 100% benar untuk semua kemungkinan format input tanpa pengujian terhadap seluruh data produksi. Versi ini menggunakan pendekatan fail-safe: data yang tidak lolos validasi tidak dipaksakan masuk ke output valid.

## Fitur

### REVIEW
- Paste data review → otomatis filter & format
- Filter bank/e-wallet
- Prefix e-wallet DANA, OVO, GOPAY, LINKAJA
- Deteksi antrian lama
- Grouping hasil berdasarkan bank tanpa memisahkan field transaksi
- Copy TSV

### ADMIN Withdraw
- Filter batas nominal maksimum
- Prefix e-wallet
- Deteksi antrian lama
- Grouping berdasarkan bank
- Copy/reset

### NTT ⇄ VENDOR → DOC
- DATA NTT (MASTER)
- DATA VENDOR — MATCH KODE+REK+NOMINAL
- DATA DOC — NOREK & NOMINAL DARI NTT
- Match KODE + NOREK + NOMINAL
- Validasi bank
- Audit nominal/rekening/bank
- Anti-dobel berdasarkan KODE NTT
- MODE MINERA dengan validasi format 8 kolom
- Filter `Sembunyikan NTT + Nominal`
- Filter tersembunyi disinkronkan ke NTT + Vendor + DOC
- Copy DOC/Vendor/NTT
- Trace transaksi
- Auto-clear berdasarkan hari lokal
- LocalStorage untuk refresh pada hari yang sama
- 100% client-side/local, tanpa backend

## MODE MINERA

Format yang diterima harus tepat 8 kolom TSV:

```text
0 datetime | 1 status | 2 brand/user | 3 NNT | 4 bank | 5 no rek | 6 nama | 7 nominal
```

Baris yang tidak memenuhi struktur atau field inti tidak dimasukkan sebagai transaksi valid.

## Deploy ke GitHub Pages

1. Buat repository GitHub baru.
2. Upload seluruh isi repository ini ke root repository.
3. Pastikan `index.html` berada di root.
4. Buka **Settings → Pages**.
5. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
6. Simpan dan tunggu GitHub Pages selesai melakukan deployment.

Aplikasi tidak membutuhkan server atau database.

## Struktur

```text
.
├── index.html
├── ntt.html
├── script.js
├── style.css
├── README.md
└── .gitignore
```
