# Design Specification — Nexora
## Autonomous AI Software Engineering Workstation

| | |
|---|---|
| **Companion Document** | `PRD-Nexora-AI-Agentic-Software-Engineer.md` v1.1 |
| **Design Document Version** | 1.2 |
| **Design System** | Nexora Engineering System (NES) — Developer-Grade Precision |
| **Aesthetic Philosophy** | Anti-AI Cliché, Terminal-Accurate, High-Density Git Workspace |
| **Last Updated** | 30 Agustus 2026 |

---

## 0. Design Brief & Anti-AI Design Philosophy

### Subjek & Karakter Produk
Nexora **bukan** dashboard SaaS generik, bukan chatbot dengan widget melayang, dan bukan alat "magic AI" dengan gradien ungu neon. Nexora adalah **Autonomous AI Software Engineering Workstation** — tempat developer dan tech lead mengawasi, membimbing, dan mengaudit agen AI yang bekerja langsung di repositori mereka.

Objek dunia nyata dan inspirasi visual utama:
- **Git Diff & GitHub PR Review**: bahasa visual tambah/kurang, split view, gutter baris kode.
- **Terminal CI/CD & Test Runner**: output deterministik, log streaming monospaced, exit code, execution timestamps.
- **Linear & JetBrains IDE**: densitas informasi tinggi, micro-borders tajam, tipografi presisi, dan palette warna yang menenangkan untuk fokus berjam-jam.

### 🚫 Aturan Anti-Generic-AI (Strictly Forbidden)
Agar Nexora tidak terlihat seperti aplikasi hasil generate AI instan yang murahan:
1. **Dilarang keras menggunakan gradien ungu / indigo / violet** (`#6B46C1`, `#7C3AED`, `#8B5CF6`) pada tombol, header, atau background.
2. **Dilarang menggunakan partikel melayang, background glow/orb neon, dan efek kaca blur (glassmorphism) yang berlebihan**.
3. **Dilarang menggunakan ikon "AI Magic" klise** seperti bintang bercahaya (`Sparkles`), otak neon, atau robot ilustrasi kartun. Gunakan ikon teknis: `GitBranch`, `Terminal`, `GitMerge`, `ShieldCheck`, `Cpu`, `Layers`.
4. **Dilarang menggunakan chip warna-warni solid khas Material Design**. Gunakan *CI-style monospaced pill badges* dengan border 1px dan dark background.
5. **Dilarang membuat card bertumpuk dengan drop shadow tebal**. Gunakan hairline border (`#2B2F3D`) yang tegas dan elevasi datar (flat-plane).
6. **Tidak ada nada marketing/hype** ("Supercharge your coding!"). Gunakan copy teknis, faktual, dan transparan ("13 files modified · 100% sandbox tests passed · 0 secret leaks detected").

---

## 1. Design Tokens & Palette

### 1.1 Color System (Semantic Developer Palette)
Palet dibangun dari 4 peran: **Canvas Kerja**, **Semantik Git Diff**, **Status CI/Agent**, dan **Aksen Referensi**.

| Token | Hex Value | Semantic Role |
|---|---|---|
| `--canvas` | `#12141C` | Latar utama — Ink Navy-Black (bukan hitam pekat OLED, nyaman di mata) |
| `--surface` | `#1A1D28` | Container kartu, panel utama, sidebar |
| `--surface-raised` | `#242838` | Container di atas surface (modal, card hover, tab aktif) |
| `--surface-subtle` | `#161922` | Inner well, code editor background, log container |
| `--border` | `#2B2F3D` | Hairline border standar 1px |
| `--border-strong` | `#3A3F52` | Border elemen interaktif, input focus, hover state |
| `--text-primary` | `#E7E9F2` | Teks utama, judul, diff content baru |
| `--text-muted` | `#8D91A6` | Teks sekunder, metadata, caption |
| `--text-faint` | `#5E6275` | Timestamps, token counters, border separator |
| `--diff-add` | `#4CB782` | **Emerald**: Tambah kode (`+`), approval, test pass, 1-Click Merge, PR ready |
| `--diff-add-bg` | `#1B2B23` | Latar badge/banner status sukses dan diff addition |
| `--diff-remove` | `#E0594A` | **Ruby**: Hapus kode (`-`), error test, plan rejection, secret leak alert |
| `--diff-remove-bg` | `#2E1D1B` | Latar badge/banner error dan diff deletion |
| `--agent-active` | `#E3A73B` | **Amber**: Status in-progress CI, agent sedang beraksi, pending approval |
| `--agent-active-bg` | `#2E260F` | Latar badge in-progress |
| `--link-git` | `#6C9BFF` | **Sapphire**: Git branch ref, commit SHA, file path, link GitHub/GitLab |
| `--link-git-bg` | `#1E293B` | Latar branch badge dan tag |

---

### 1.2 Tipografi & Hirarki Text

| Peran | Typeface | Ukuran & Weight | Penerapan |
|---|---|---|---|
| **Headings** | `Space Grotesk` | 600 / 700 SemiBold/Bold | Judul halaman, section header, modal titles |
| **Body / UI** | `Inter` | 400 / 500 Regular/Medium | Label formulir, penjelasan issue, instruksi |
| **Code / Data** | `JetBrains Mono` | 400 / 500 Monospace | File path, branch, SHA hash, diff lines, tool calls, JSON plan |

**Prinsip Tipografi**:
- Semua data yang dihasilkan oleh mesin (SHA commit, branch name, file name, line count, status enum) **wajib** menggunakan `JetBrains Mono`.
- Semua data yang ditulis oleh manusia (judul issue, review comments, manual feedback) menggunakan `Inter`.

---

### 1.3 Spacing, Radius, & Elevation

```
Radius System:
  - Card & Panel   : 10px (rounded-[10px])
  - Button & Input : 8px (rounded-lg)
  - Badge & Pill   : 999px (rounded-full)
  - Code container : 8px (rounded-lg)

Borders & Dividers:
  - Default: 1px solid var(--border) (#2B2F3D)
  - Focused/Active: 1px solid var(--border-strong) (#3A3F52)
  - Accent: 1px solid rgba(76, 183, 130, 0.4) [Emerald] atau rgba(108, 155, 255, 0.4) [Sapphire]

Elevation & Shadows:
  - Default cards: Flat (no drop shadow, border-only)
  - Dropdown / Flyout: shadow-md (0 4px 12px rgba(0,0,0,0.3))
  - Critical Modal / Approval Gate: shadow-modal (0 16px 40px rgba(0,0,0,0.6))
```

---

## 2. Signature Visual Element: "The Diff Rail"

Elemen identitas visual utama Nexora adalah **The Diff Rail** — garis vertikal selebar 3px di sisi paling kiri dari setiap komponen data (Task Card, Plan Step, Tool Log Row, dan Commit Card) yang mengomunikasikan status tanpa mengharuskan pengguna membaca teks:

```
┃ #142 Fix navbar alignment             ● implementing (Amber Rail)
┃ src/components/Nav.tsx  +14 -2        ● diff split (Emerald Rail)
┃ npm test -> 2 failures                ● error log (Ruby Rail)
┃ Pull Request #2 Created               ● completed (Emerald Rail)
```

Gutter vertikal ini memberikan keterbacaan instan saat developer melakukan scanning visual pada log panjang atau daftar tugas.

---

## 3. Komponen Inti (Design System Specs)

### 3.1 Status Badge (CI-Style Pill)
Badge mono kecil, border 1px dengan dot indikator berkedip (untuk status aktif):
- `( ● queued )` — Slate dot, border `#2B2F3D`, text `#8D91A6`
- `( ● implementing )` — Amber pulse dot, border `#E3A73B`/40, text `#E3A73B`
- `( ⏸ awaiting_approval )` — Amber alert dot, border `#E3A73B`/60, text `#E3A73B`
- `( ✓ pr_created )` — Emerald check, border `#4CB782`/40, text `#4CB782`
- `( ✓ merged )` — Emerald GitMerge, border `#4CB782`/50, text `#4CB782`
- `( ✕ failed )` — Ruby cross, border `#E0594A`/40, text `#E0594A`

---

### 3.2 7-Stage Progress Stepper
Menampilkan alur eksekusi agent yang deterministik:
`Analyzing` $\to$ `Planning` $\to$ `Approval` $\to$ `Implementing` $\to$ `Testing` $\to$ `PR` $\to$ `Review`

- **Node Selesai**: Lingkaran emerald dengan ikon centang kecil (`✓`).
- **Node Aktif**: Lingkaran biru/amber dengan dot berkedip + ring halus.
- **Node Menunggu**: Lingkaran outline slate tipis.
- **Sub-step Activity Banner**: Baris teks di bawah stepper yang menampilkan aksi real-time (misal: *"Running sandbox test: npm test (Iteration 1/3)..."*).

---

### 3.3 Visual Code Diff Viewer (Split & Unified)
Menampilkan perbandingan kode sebelum vs sesudah:
- **Left/Right Split View**: Kolom kiri (Old Code dengan highlight ruby `-`), kolom kanan (New Code dengan highlight emerald `+`).
- **Line Numbering**: Nomor baris monospaced presisi di setiap sisi.
- **File Explorer Sidebar**: Daftar file yang dimodifikasi di sebelah kiri dengan indikator badge `+24 / -5` dan filter pencarian file.
- **Action Buttons**: Salin raw patch, salin new file content, dan toggle Split vs Unified view.

---

### 3.4 Hero Completion Card & 1-Click Merge
Saat task mencapai status `pr_created` atau `merged`:
- **Warna & Tampilan**: Background `#1B2B23`, border `#4CB782`/40, ikon centang emerald besar.
- **Tombol Aksi**:
  - `[ ⎇ View Pull Request / Merge Request ]` (Link langsung ke GitHub/GitLab).
  - `[ ⑂ Merge to Main ]` (**Tombol Emerald Solid**: `bg-[#4CB782] hover:bg-[#4CB782]/90 text-[#12141C] font-bold` — **Bebas dari warna ungu**).
  - `[ ↩ Revert PR ]` (Tombol Rollback otomatis dengan border amber).
  - `[ ✕ Close PR ]` (Tombol pembatalan PR tanpa merge).
  - `[ + Work on Another Issue ]` (Tombol reset workspace untuk task berikutnya).

---

### 3.5 Pre-Flight Security Guardrail Card
Tab inspeksi keamanan kode sebelum atau sesudah PR:
- **Secret Leak Scanner**: Deteksi otomatis kebocoran token GitHub, GitLab, Gemini API Key, AWS Secrets, dan Private Keys.
- **Code Safety Rules**: Deteksi pola SQL Injection mentah dan penggunaan `eval()` berbahaya.
- **Audit Badge**: Menampilkan status *Clean (0 Vulnerabilities)* atau daftar temuan baris kode yang mencurigakan.

---

### 3.6 Multimodal Attachment Dropper (Clipboard Paste & Drag-and-Drop)
- Area drop interaktif untuk mengunggah screenshot bug, Figma UI mockup, dan file log/error.
- Mendukung **Ctrl+V Instant Paste** langsung dari clipboard.
- Chip preview attachment dengan thumbnail gambar, ukuran file, dan tombol hapus cepat.

---

### 3.7 Visual Git Topology & Commit Graph (`CommitHistoryTab`)
- **Interactive SVG Canvas**: Visualisasi garis percabangan (*lanes*), titik merge commit, parent links, dan commit head.
- **Branch Focus Selector**: Dropdown dinamis berisi semua remote branch (`main`, `dev`, `staging`, dll).
- **Live Sync Polling**: Refresh otomatis setiap 10 detik dan saat window browser mendapatkan fokus kembali (`focus` listener).
- **Commit Details Drawer**: Inspeksi SHA commit, author, commit message, parent hashes, dan link eksternal ke provider.

---

## 4. Spesifikasi Per Layar (Page Specifications)

---

### PAGE 1 — Connect & Authentication Modal
**Tujuan**: Menghubungkan akun GitHub Personal Access Token (PAT) atau GitLab Token dengan aman dan tanpa hardcode.

```
┌──────────────────────────────────────────────────────────────┐
│  Connect Git Provider Account                                │
│  ──────────────────────────────────────────────────────────  │
│  Provider:  ( ● GitHub )    ( ○ GitLab )                     │
│                                                              │
│  Personal Access Token (PAT)                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ghp_************************************               │ │
│  └────────────────────────────────────────────────────────┘ │
│  Scope required: repo, read:user, workflow.                  │
│                                                              │
│  [ Cancel ]                              [ Connect Account ] │
└──────────────────────────────────────────────────────────────┘
```

- **Elemen**: Toggle provider (GitHub/GitLab), password input bertopeng, status badge username terautentikasi (`@username`), tombol disconnect aman.
- **Security Guarantee**: Token disimpan secara aman di backend memory/session, tidak pernah di-hardcode ke repository.

---

### PAGE 2 — Agent Workspace (Target Selection & Multi-Modal Launcher)
**Tujuan**: Memilih repositori, base branch, issue target, melampirkan context (file & screenshot), dan meluncurkan agent.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│  Target Repository & Issue Selection                       [ 🔄 Sync Live Git ] [+ Connect]│
│  ───────────────────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────────┐  │
│  │ Target Repository      │  │ Base Branch            │  │ Target Issue                │  │
│  │ 🐙 chocolatecodelab/   │  │ ⎇ main (default)       │  │ #1 update design based on...│  │
│  │    csr-dashboard       │  │ (3 remote branches)    │  │ (2 open issues)             │  │
│  └────────────────────────┘  └────────────────────────┘  └─────────────────────────────┘  │
│                                                                                           │
│  Target Context & Multimodal Attachments                                                  │
│  [ 🎯 Pick Target Files (3 selected) ]   [ 📎 Attach Screenshot / Logs (Ctrl+V supported)] │
│                                                                                           │
│  Focus & Scoping Hints (Optional)                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Fokuskan perbaikan pada styling navbar dan integrasi file design.md                 │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                           │
│                                                                [ ▶ Launch Autonomous Agent]│
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- **3-Column Selection Grid**: Repositori $\to$ Base Branch $\to$ Target Issue.
- **Tombol Sync Live Git**: Menarik seluruh perubahan branch, issue, dan file langsung dari API remote.
- **Target File Picker**: Modal hierarki folder untuk membatasi file yang boleh diedit oleh agent.

---

### PAGE 3 — Active Agent Run & Code Review Workspace
**Tujuan**: Memantau progres agent, mereview implementation plan, menginspeksi code diff side-by-side, memeriksa guardrail keamanan, dan mengeksekusi 1-Click Merge.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│  #1 update design based on design.md file                                   ( ● implem. ) │
│  Branch: nexora/issue-1 · Target: main · Repository: chocolatecodelab/csr-dashboard       │
│                                                                                           │
│  Analyzing ✓ ── Planning ✓ ── Approval ✓ ── Implementing ● ── Testing ○ ── PR ○ ── Done ○  │
│  ● Status: Writing code changes to 13 files and running sandbox validation...             │
│  ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                           │
│  [ Implementation Plan ]  [ Code Diff (13) ]  [ Security Guardrail ]  [ Live Logs ]       │
│                                                                                           │
│  ┌────────────────────────┬────────────────────────────────────────────────────────────┐  │
│  │ MODIFIED FILES (13)    │ Side-by-Side Visual Diff: src/components/Header.tsx        │  │
│  │ ────────────────────── │ ────────────────────────────────────────────────────────── │  │
│  │ ┃ Header.tsx   +18 -4  │  42 │ - <div className="bg-purple-600 p-4">                │  │
│  │ ┃ Sidebar.tsx  +42 -10 │  42 │ + <div className="bg-[#1A1D28] border border-[#2B... │  │
│  │ ┃ layout.tsx   +8  -2  │  43 │ -   <button className="btn-primary">                 │  │
│  │ ┃ ...                  │  43 │ +   <button className="px-4 py-2 bg-[#4CB782]...">   │  │
│  └────────────────────────┴────────────────────────────────────────────────────────────┘  │
│                                                                                           │
│  Hero Completion Card (Saat PR Siap):                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ✓ GitHub Pull Request #2 Created! (Branch: nexora/issue-1)                          │  │
│  │   All 23 sandbox tests passed · 0 security vulnerabilities · Ready to ship.         │  │
│  │                                                                                     │  │
│  │   [ ⎇ View on GitHub ]   [ ⑂ Merge to Main ]   [ ↩ Revert PR ]   [ ✕ Close PR ]     │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### PAGE 4 — Git Graph Timeline & Version Explorer (`CommitHistoryTab`)
**Tujuan**: Visualisasi topologi git, branch branching lanes, titik merge commit, dan time-travel commit browser.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│  Git Graph Timeline & Version Explorer                                    [ 🔄 Refresh ]  │
│  ───────────────────────────────────────────────────────────────────────────────────────  │
│  Repository: [ 🐙 csr-dashboard ▾ ]   Branch Focus: [ ⎇ main (default) ▾ ]  [ Search... ] │
│                                                                                           │
│  GRAPH TOPOLOGY      SHA      MESSAGE                             AUTHOR       TIME       │
│  ───────────────────────────────────────────────────────────────────────────────────────  │
│  * ──┐  (main)       403de24  feat(agent): update design to dark  Nexora AI    5m ago     │
│  │   *  (issue-1)    a1b2c3d  fix(header): navbar layout polish   Nexora AI    12m ago    │
│  * ──┘               e9f8a1b  Merge pull request #1 from dev      Nazar M      2h ago     │
│  *                   88c21ea  initial commit and repository setup Nazar M      1d ago     │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### PAGE 5 — Observability & Tool Audit Trail
**Tujuan**: Audit trail mendalam dari setiap eksekusi tool call, token consumption, latency, dan argumen JSON.

- Menampilkan tabel baris monospaced mirip terminal log.
- Diff Rail di sisi kiri berwarna sesuai status (`Emerald` untuk sukses, `Ruby` untuk test failure/exception).
- Rincian parameter: `search_code()`, `read_file()`, `edit_file()`, `commit_and_push()`, `create_pr()`.

---

### PAGE 6 — Evaluation & Analytics Dashboard
**Tujuan**: Tolok ukur performa kuantitatif AI co-engineer.

- **Plan Acceptance Rate**: % rencana yang disetujui manusia tanpa penolakan.
- **Test Pass Rate**: % kode yang lulus pengujian sandbox di percobaan pertama/kedua.
- **PR Acceptance Rate**: % Pull Request yang dimerge ke main.
- **Average Iterations**: Rata-rata loop perbaikan error otomatis (Target < 2.0).
- **Execution Latency**: Waktu dari issue hingga Pull Request siap review.

---

## 5. Motion, Feedback, & Edge Cases

1. **Deterministic Motion**: Animasi hanya digunakan untuk indikasi proses komputasi yang sedang berjalan (dot pulse 1.6s, spin loader pada tombol yang aktif). Tidak ada animasi dekoratif yang memperlambat alur kerja developer.
2. **Auto-Recovery on Collisions**: Jika branch atau PR dengan nama serupa sudah ada di GitHub/GitLab, sistem secara elegan mendeteksi dan menggunakan PR yang ada tanpa merusak alur kerja.
3. **Live Re-sync on Tab Focus**: Menghilangkan kebutuhan untuk menekan tombol refresh manual setelah melakukan aksi di browser tab GitHub/GitLab.

---

*Dokumen ini merupakan standar resmi implementasi frontend Nexora AI. Seluruh komponen, layout, dan palet warna di dalam repositori wajib mematuhi spesifikasi di atas untuk menjamin pengalaman pengguna bertaraf enterprise dan bebas dari estetika AI generik.*
