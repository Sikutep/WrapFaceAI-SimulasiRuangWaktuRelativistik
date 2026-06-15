# WrapFaceAI - Simulasi Ruang Waktu Relativistik

**WrapFaceAI** adalah aplikasi web eksperimental tingkat lanjut yang menggabungkan **pelacakan wajah AI secara real-time** dengan **shader WebGL sinematik** dan **Web Audio API** dinamis. Aplikasi ini secara harfiah mensimulasikan fisika benda yang bergerak mendekati kecepatan cahaya (Teori Relativitas Khusus Albert Einstein) langsung di dalam browser Anda.

Semua pemrosesan, baik kecerdasan buatan (AI) maupun grafis, dilakukan 100% di sisi klien (Client-Side) secara lokal untuk menjamin privasi dan latensi sangat rendah.

![Status](https://img.shields.io/badge/Status-Eksperimental-red.svg) ![React](https://img.shields.io/badge/React-18.0-blue.svg) ![ThreeJS](https://img.shields.io/badge/Three.js-WebGL-black.svg) ![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-FaceMesh-orange.svg)

---

## Teori Fisika yang Diaplikasikan

Aplikasi ini tidak hanya menggunakan filter visual biasa, tetapi didasarkan pada rumus-rumus fisika nyata. Semakin dekat nilai *slider velocity* dengan `1.0c` (kecepatan cahaya), semakin nyata efek ini diterapkan:

### 1. Faktor Lorentz ($\gamma$)
Faktor Lorentz digunakan untuk menghitung seberapa besar distorsi ruang dan waktu yang dialami oleh pengamat. Rumus yang diimplementasikan di dalam `SpacetimeCanvas`:

$$ \gamma = \frac{1}{\sqrt{1 - \frac{v^2}{c^2}}} $$

Di mana:
- $v$ adalah kecepatan (velocity slider).
- $c$ adalah kecepatan cahaya (dalam simulasi ini dinormalisasi menjadi 1).

### 2. Kontraksi Panjang (Lorentz Contraction)
Benda yang bergerak sangat cepat akan tampak memendek (gepeng) searah dengan arah gerakannya.
Di dalam WebGL Shader, ini disimulasikan dengan mengompresi koordinat horizontal wajah (`center.x /= gamma`).

### 3. Efek Doppler Relativistik (Pergeseran Merah/Biru)
Saat Anda bergerak mendekati sumber cahaya, gelombang cahaya memampat ke frekuensi tinggi (Blueshift). Saat menjauh, gelombang merenggang ke frekuensi rendah (Redshift). Kami menangkap pergerakan wajah Anda menggunakan AI dan menerjemahkannya ke dalam dispersi spektrum warna.

---

## Fitur Utama

### 1. Shader Sinematik (WebGL/Three.js)
Jantung dari visual aplikasi ini adalah Fragment Shader GLSL kustom dengan lebih dari 10 lapis efek:
- **Wormhole Warp**: Selain kontraksi Lorentz, seluruh ruangan di latar belakang ikut melengkung seperti tertarik masuk ke dalam lubang hitam (Barrel Distortion bergradien eksponensial).
- **Aberasi Kromatik Radial**: Pemisahan channel RGB di mana channel biru ditarik ke dalam (Blueshift) dan merah ditarik keluar (Redshift) berdasarkan vektor radial dari pusat layar.
- **Doppler Neon Glow**: Cahaya neon yang beradaptasi dengan kecepatan. Berubah menjadi *cyan* terang saat melaju cepat, atau merah saat mengerem mendadak.
- **Hyperspace Streaks**: Efek partikel garis-garis kecepatan cahaya ala *Star Wars* yang keluar dari titik pusat layar saat menembus `0.30c`.
- **Distorsi Glitch & Film Grain**: Getaran layar dan noise film saat menembus *G-Force* ekstrim (> `0.80c`).

### 2. AI Doppler Tracking (TensorFlow.js)
Memanfaatkan `@tensorflow-models/face-landmarks-detection` (MediaPipe FaceMesh) secara unik:
- Mengukur diferensial luas *bounding box* wajah Anda dari frame ke frame.
- Mengubah diferensial tersebut menjadi matriks percepatan (mundur/maju).
- Kecepatan gerakan kepala Anda memicu *micro-bursts* warna dan modulasi frekuensi audio seketika.

### 3. Mesin Audio Ruang Angkasa (Web Audio API)
Efek audio generatif tingkat lanjut tanpa menggunakan aset `.mp3` apa pun, 100% diproses langsung dari mikrofon Anda:
- **Filter Frekuensi Doppler**: Jika Anda memajukan kepala, suara berubah cempreng berfrekuensi tinggi (`highpass`). Jika mundur, suara menjadi bergema rendah (`lowpass`).
- **Space Echo (Feedback Loop)**: Menerapkan `DelayNode` berlapis yang memantulkan suara Anda terus-menerus. Gema ini makin intens saat Anda bergerak mendekati kecepatan cahaya.
- **Hyperdrive Engine Hum**: Sebuah `OscillatorNode` (gelombang *Sawtooth*) yang menghasilkan frekuensi bass `40Hz-120Hz`. Mirip suara deru mesin warp yang beresonansi di dalam pesawat ruang angkasa.

### 4. Mode Tantangan (Gamification)
- Mode di mana tuas akselerasi otomatis ditarik hingga mentok `0.99c`.
- Anda harus menahan wajah Anda agar tetap tenang menghadapi G-Force virtual.
- Sistem akan merender **Sertifikat Kelulusan Spacetime** bergaya Sci-Fi dalam format `.png` siap unduh menggunakan `html2canvas`.

### 5. Mode Spacetime Duet (WebRTC/PeerJS)
- Fitur *teleconference* peer-to-peer terdesentralisasi murni.
- Lihat kamera teman Anda dalam aliran "waktu normal" sementara Anda terjebak di dalam lubang cacing.

---

## Arsitektur & Tumpukan Teknologi (Tech Stack)

| Domain | Teknologi | Fungsi |
|--------|-----------|---------|
| **Core** | React 18 + Vite + TypeScript | Kerangka antarmuka pengguna, state management, dan hot-reloading. |
| **Graphics** | Three.js + GLSL WebGL 2.0 | Akselerasi perangkat keras untuk manipulasi piksel secara matematis pada video. |
| **AI / Vision**| TensorFlow.js (MediaPipe) | Melacak koordinat geometris 468 titik wajah di memori CPU secara paralel. |
| **Audio** | Web Audio API | Modulasi sinyal digital (DSP) dan node routing (Mic -> Filter -> Delay -> Destination). |
| **Networking**| PeerJS (WebRTC) | Menembus NAT untuk streaming media langsung antar browser tanpa server penengah. |
| **UI/UX** | CSS3 Murni + Orbitron | Rendering HUD Sci-Fi organik tanpa menggunakan library berat seperti Tailwind. |

---

## Pembahasan Teknis & Solusi Tingkat Lanjut (Bugfixes)

Selama proses pengembangan, sistem ini melewati serangkaian penyesuaian arsitektur yang sangat ekstrim untuk mengakali limitasi keamanan dan efisiensi browser modern:

1. **Mem-bypass Pemblokiran Video (Throttling) Chrome/Edge**
   Browser modern sangat agresif "membunuh" tag `<video>` yang tersembunyi (`display: none` atau `opacity: 0`). Ini sebelumnya menyebabkan shader WebGL kami membeku total.
   **Solusi:** Kami tetap me-render tag video asli dengan `opacity: 1` (terlihat 100%) seukuran layar penuh, namun kami mengakali susunannya (`z-index: 1`). WebGL Canvas (`z-index: 2`) kemudian diletakkan tepat menimpanya. Alhasil, browser "mengira" video sedang ditonton oleh manusia, dan suplai frame ke GPU tidak pernah diputus.

2. **Mencegah GPU Context Starvation (Crash)**
   Three.js dan TensorFlow.js sama-sama memonopoli *WebGL Backend* secara default. Menggabungkan keduanya menyebabkan GPU Context terputus dan aplikasi *hang*.
   **Solusi:** Model AI TensorFlow dipaksa pindah ke *backend CPU*. Mengingat kami hanya butuh 5-10 FPS kalkulasi matriks untuk deteksi jarak, CPU modern sangat mampu menangani FaceMesh sambil membiarkan 100% tenaga GPU murni digunakan oleh Three.js untuk merender shader 60 FPS yang sangat berat.

3. **Perbaikan Layar Hitam (NPOT Textures)**
   Secara default, tekstur kamera (misal `640x480`) bukan termasuk dalam ukuran *Power of Two* (seperti `512x512` atau `1024x1024`). Driver GPU bawaan Windows sering mogok diam-diam saat memproses tekstur ini ke WebGL.
   **Solusi:** Mengimplementasikan fitur *Hardware Accelerated* `THREE.VideoTexture` murni, dikombinasikan secara paksa dengan konfigurasi `generateMipmaps = false` serta `THREE.SRGBColorSpace` untuk menjamin stabilitas driver.

4. **Operasi Boolean Paralel GPU**
   Menulis `if(condition)` atau fungsi boolean di dalam fungsi inti GLSL menyebabkan crash *driver* tersembunyi.
   **Solusi:** Merombak total seluruh logika boolean menjadi perkalian matematika murni menggunakan fungsi `step()` dan `clamp()`, yang sangat efisien dijalankan secara masif-paralel oleh *compute cores* pada GPU.

---

## Instalasi & Menjalankan Aplikasi

1. **Clone repositori ini:**
   ```bash
   git clone <repo-url>
   cd WrapFaceAI
   ```

2. **Instal seluruh *dependencies*:**
   ```bash
   npm install
   ```

3. **Jalankan *Development Server*:**
   ```bash
   npm run dev
   ```
   *Buka `http://localhost:5173` di browser. Pastikan browser Anda mengizinkan akses Kamera & Mikrofon.*

4. **Kompilasi ke *Production*:**
   ```bash
   npm run build
   ```

---
*Dikembangkan secara khusus sebagai demonstrasi fusi tingkat lanjut antara model Kecerdasan Buatan dan Grafika Komputer (Computer Graphics).*
