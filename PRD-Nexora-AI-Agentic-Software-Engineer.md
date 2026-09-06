# Product Requirements Document (PRD)
# Nexora — AI Agentic Software Engineering Platform

| | |
|---|---|
| **Product Name** | Nexora |
| **Tagline** | From GitHub Issue to Pull Request — an AI Software Engineer that plans, codes, tests, and ships. |
| **Document Version** | 1.1 |
| **Status** | Draft — MVP Definition |
| **Owner** | Product & Engineering |
| **Last Updated** | 28 Agustus 2026 |
| **Internal Codename (dev)** | `nexora` (sebelumnya dibahas dengan nama kerja *DevAgent* / *NazarForge* pada diskusi awal — nama produk final tetap **Nexora**) |

**Changelog**

| Versi | Perubahan |
|---|---|
| 1.0 | PRD awal — definisi produk, scope MVP, arsitektur, roadmap. |
| 1.1 | Menambahkan Lampiran B: Local Development Setup (tooling, struktur monorepo, environment variables, rencana setup harian, definisi milestone pertama). Menetapkan **Gemini API** sebagai LLM provider awal. |

---

## 1. Ringkasan Eksekutif

**Nexora** adalah platform AI Agentic Software Engineering yang menghubungkan GitHub Issue milik developer dengan sebuah AI Agent yang mampu memahami konteks repository, menyusun rencana implementasi, menulis kode, menjalankan test, memperbaiki error secara iteratif, dan membuat Pull Request — dengan human tetap menjadi pengambil keputusan akhir di setiap tahap kritikal.

Nexora **bukan** autonomous coding bot yang langsung merge ke production. Nexora adalah **co-engineer** yang bekerja transparan, dapat diaudit, dan dapat dihentikan/dikoreksi kapan saja oleh manusia.

### Alur inti (core loop)

```
GitHub Issue
     ↓
Repository Understanding (agent membaca kode yang relevan saja)
     ↓
Implementation Plan (structured JSON, bukan free text)
     ↓
Human Approval / Reject + Feedback
     ↓
Coding Agent (read/write/edit file)
     ↓
Sandbox Execution (install, build, test)
     ↓
Automatic Debugging (max N iterasi)
     ↓
Git Branch + Commit + Push
     ↓
Pull Request
     ↓
Human Code Review (approve / request changes)
```

---

## 2. Latar Belakang & Masalah

Developer individu maupun tim kecil menghabiskan banyak waktu untuk:

1. Membaca ulang codebase untuk memahami di mana suatu perubahan harus dilakukan.
2. Menulis boilerplate implementation yang sebenarnya bisa diprediksi dari issue description.
3. Melakukan siklus test → fix → test yang repetitif.
4. Menulis PR description yang informatif secara manual.

Tools AI coding assistant yang ada saat ini (inline autocomplete, chat-based copilot) membantu di level baris kode, tetapi belum banyak yang menjalankan **seluruh siklus engineering** (plan → code → test → debug → PR) sebagai satu alur yang dapat diawasi dan diukur.

### Kenapa sekarang?

- LLM sudah cukup mampu melakukan tool-calling dan structured output secara reliable.
- Biaya inference untuk model kecil/menengah sudah cukup murah untuk tugas eksplorasi/klasifikasi, sehingga hanya tugas berat (coding, debugging) yang perlu model kuat.
- Infrastruktur serverless (Vercel, Cloud Run) dan Supabase membuat MVP bisa dijalankan nyaris tanpa biaya di awal.

---

## 3. Tujuan Produk

### 3.1 Goals

| # | Goal |
|---|---|
| G1 | Agent dapat memahami sebuah GitHub Issue dan menerjemahkannya menjadi implementation plan yang terstruktur. |
| G2 | Agent hanya membaca bagian repository yang relevan (tidak membaca seluruh codebase), untuk efisiensi token dan kualitas reasoning. |
| G3 | Setiap plan wajib melalui human approval sebelum eksekusi kode dimulai. |
| G4 | Agent dapat menulis/mengedit kode, menjalankan test di sandbox terisolasi, dan memperbaiki error secara iteratif dengan batas maksimum percobaan. |
| G5 | Agent menghasilkan Pull Request yang siap direview manusia — bukan langsung merge. |
| G6 | Setiap langkah agent (tool call, keputusan, hasil) tercatat untuk observability dan audit. |
| G7 | Performa agent dapat diukur secara kuantitatif (acceptance rate, iteration count, dsb), bukan sekadar klaim kualitatif. |

### 3.2 Non-Goals (Out of Scope untuk MVP)

- Autonomous deployment ke production.
- Auto-merge tanpa review manusia.
- Multi-agent orchestration (Planner/Coder/Tester/Reviewer terpisah) — MVP menggunakan agent tunggal dengan tahapan internal.
- Integrasi Jira/Slack/voice.
- RAG kompleks atas dokumentasi eksternal.
- Sandbox eksekusi di cloud (MVP menggunakan sandbox lokal developer).
- Dukungan multi-bahasa pemrograman penuh di hari pertama (mulai dari 1–2 stack yang paling umum, mis. TypeScript/Node.js).

---

## 4. Target Pengguna & Persona

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Solo Developer / Indie Hacker** | Mengelola satu atau beberapa repository kecil–menengah sendirian. | Mempercepat siklus issue → PR tanpa harus context-switch manual. |
| **Tech Lead di Startup Kecil** | Mengelola backlog issue tim kecil (2–5 orang). | Delegasi task repetitif/low-risk ke agent, sambil tetap mengontrol kualitas via review. |
| **Engineering Manager (evaluator)** | Tertarik mengevaluasi ROI AI agent sebelum adopsi skala tim. | Observability dashboard & metrik keberhasilan yang terukur. |

### User Stories Inti

- Sebagai developer, saya ingin menghubungkan repository GitHub saya sehingga Nexora bisa membaca struktur dan file yang relevan.
- Sebagai developer, saya ingin memilih satu issue dan meminta Nexora menyusun implementation plan sebelum ada kode yang diubah.
- Sebagai developer, saya ingin bisa **menolak plan** dan memberi feedback bebas teks, lalu agent menyusun ulang plan.
- Sebagai developer, saya ingin melihat progres agent secara real-time (analyzing → planning → implementing → testing → PR created).
- Sebagai developer, saya ingin agent menjalankan test di lingkungan terisolasi, bukan langsung di mesin/server utama.
- Sebagai developer, saya ingin agent mencoba memperbaiki test yang gagal secara otomatis, tapi berhenti setelah batas iterasi tertentu agar tidak infinite loop.
- Sebagai developer, saya ingin menerima Pull Request lengkap dengan ringkasan perubahan dan hasil test, siap saya review.
- Sebagai tech lead, saya ingin melihat dashboard yang mencatat semua tool call, durasi, dan hasil dari setiap agent run.

---

## 5. Lingkup MVP (Scope)

### 5.1 Fitur MVP — "DevAgent Core Loop"

| Modul | Deskripsi |
|---|---|
| **GitHub Connect** | OAuth/GitHub App untuk menghubungkan akun & memilih repository. |
| **Issue Selector** | Menampilkan daftar open issue dari repository terhubung, lengkap dengan judul, deskripsi, komentar. |
| **Repository Understanding** | Tools `search_code()`, `list_files()`, `read_file()`, `get_git_diff()` agar agent membaca kode secara selektif berbasis relevansi terhadap issue. |
| **Planning Agent** | Menghasilkan implementation plan dalam format JSON terstruktur (summary, risk, files_to_modify, files_to_create, steps). |
| **Human Approval Gate** | UI approve/reject plan; reject disertai feedback teks bebas yang dikirim kembali ke agent untuk revisi plan. |
| **Coding Agent** | Melakukan read/write/edit/create/delete file berdasarkan plan yang sudah disetujui, dengan tool access terbatas (bukan shell unlimited). |
| **Sandbox Execution (Local V1)** | Menjalankan `npm install`, `npm test`, `npm run build` di Docker sandbox milik developer (bukan cloud) dengan batas CPU/memory/time/network. |
| **Automatic Debugging** | Loop error → analyze → locate → modify → re-test, dengan `MAX_ITERATIONS = 3` (configurable). |
| **Git & PR Automation** | Membuat branch (`agent/task-<id>`), commit, push, dan membuka Pull Request dengan deskripsi otomatis (summary, changes, test results). |
| **Task Dashboard** | Status task secara async (queued → analyzing → planning → implementing → testing → pr_created / failed), menggunakan polling. |
| **Observability Log** | Pencatatan agent_runs, tool_calls, token_usage, execution_time, test_results per task. |
| **Evaluation Metrics** | Perhitungan metrik dasar: plan acceptance rate, test pass rate, avg iterations, task completion time. |

### 5.2 Eksplisit Tidak Termasuk MVP

Lihat bagian **3.2 Non-Goals**.

---

## 6. Alur Pengguna (User Flow)

### 6.1 Flow Utama

```
1. Developer login → Connect GitHub
2. Pilih repository → Nexora sinkronisasi metadata repo
3. Pilih issue dari daftar open issues
4. Klik "Start Agent"
5. Nexora:
   a. Analisis issue
   b. Cari file relevan (search_code / list_files / read_file)
   c. Susun Implementation Plan (JSON)
6. UI menampilkan plan → Developer Approve / Reject
   - Jika Reject → Developer isi feedback → kembali ke (5c)
   - Jika Approve → lanjut ke (7)
7. Coding Agent mengeksekusi perubahan file sesuai plan
8. Sandbox lokal menjalankan install/build/test
9. Jika test gagal → Automatic Debugging (maks 3 iterasi)
   - Jika berhasil dalam batas iterasi → lanjut ke (10)
   - Jika gagal setelah batas iterasi → status "needs_human_help", developer diminta intervensi manual
10. Nexora membuat branch, commit, push, dan membuka Pull Request
11. Developer menerima notifikasi PR siap direview
12. Developer melakukan code review manual di GitHub (approve/request changes)
```

### 6.2 Status Task (State Machine)

```
queued → analyzing_issue → analyzing_repo → planning
  → awaiting_approval → (rejected → planning) 
  → implementing → testing → debugging (loop ≤3)
  → pr_creating → pr_created
  → (failed | needs_human_help) [exit states]
```

---

## 7. Arsitektur Teknis

### 7.1 Prinsip Desain

1. **Lean by default** — hindari infrastruktur berat (Kubernetes, Kafka, Redis, Celery cluster, vector DB, GPU khusus) sampai benar-benar dibutuhkan.
2. **GitHub sebagai source of truth kode.** Nexora tidak pernah menyimpan salinan penuh source code di database sendiri.
3. **Supabase hanya menyimpan state & metadata agent**, bukan kode.
4. **Sandbox eksekusi terisolasi** dari server utama — kode hasil generate AI diperlakukan sebagai *untrusted code*.
5. **Model routing** — gunakan model murah/cepat untuk eksplorasi, klasifikasi, dan summarization; gunakan model kuat hanya untuk coding & debugging yang kompleks.
6. **Async by design** — semua task berjalan di background, frontend melakukan polling status (tidak perlu WebSocket/Redis di MVP).

### 7.2 Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend / Agent Engine | Python, FastAPI |
| Database | Supabase (PostgreSQL) |
| Version Control Integration | GitHub API / GitHub App |
| LLM | **Gemini API** sebagai provider awal (melalui AI Gateway dengan model routing cheap/fast vs strong model) |
| Sandbox | Docker (lokal developer untuk V1) |
| Hosting Frontend | Vercel (Hobby tier di tahap awal) |
| Hosting Backend | Google Cloud Run (free tier di tahap awal) |
| Repo Structure | Monorepo (`apps/web`, `apps/api`, `sandbox/`, `docs/`) |

### 7.3 Diagram Arsitektur (V1)

```
                         ┌─────────────┐
                         │    User     │
                         └──────┬──────┘
                                │
                                ▼
                     ┌──────────────────┐
                     │      Vercel      │
                     │     Next.js      │
                     │     Dashboard    │
                     └────────┬─────────┘
                              │ HTTPS
                              ▼
                     ┌──────────────────┐
                     │    Cloud Run     │
                     │     FastAPI      │
                     │   Agent Engine   │
                     └──────┬───┬───┬───┘
                            │   │   │
              ┌─────────────┘   │   └─────────────┐
              ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐    ┌────────────┐
       │  Supabase  │    │  LLM API   │    │   GitHub   │
       │ PostgreSQL │    │ (Gateway)  │    │    API     │
       │ (state)    │    │            │    │  (source)  │
       └────────────┘    └────────────┘    └──────┬─────┘
                                                    ▼
                                             ┌─────────────┐
                                             │ Git Branch  │
                                             └──────┬──────┘
                                                     ▼
                                             ┌─────────────┐
                                             │   Docker    │
                                             │  Sandbox    │
                                             │  (Local V1) │
                                             └─────────────┘
```

### 7.4 Repository Understanding — Tool Design

Agent **tidak** membaca seluruh repository sekaligus. Agent bekerja lewat tools:

| Tool | Fungsi |
|---|---|
| `search_code(query)` | Mencari kode berdasarkan keyword/semantic relevansi terhadap issue. |
| `list_files(path)` | Melihat struktur direktori. |
| `read_file(path)` | Membaca isi file spesifik yang relevan. |
| `get_git_diff()` | Melihat perubahan yang sudah dilakukan agent sejauh ini. |

Tujuan: menghemat token, meningkatkan relevansi context, dan menghindari context-window overflow pada repository besar.

### 7.5 Planning Agent — Output Contract

Output Planning Agent **wajib** berupa JSON terstruktur, bukan free text, karena akan dikonsumsi oleh sistem berikutnya (UI approval, Coding Agent).

```json
{
  "summary": "string",
  "risk": "low | medium | high",
  "files_to_modify": ["string"],
  "files_to_create": ["string"],
  "steps": ["string"]
}
```

### 7.6 Coding Agent — Tool Permission

| Diizinkan | Tidak Diizinkan |
|---|---|
| `read_file`, `write_file`, `edit_file`, `create_file`, `delete_file` | Shell access tanpa batas |
| Command allowlist: `npm test`, `npm run lint`, `npm run build` | Command sembarang (`rm -rf`, `curl` ke domain arbitrary, dll) |
| Push ke branch agent (`agent/task-<id>`) | Merge PR |
| Membuat Pull Request | Deploy ke production, akses secrets arbitrary, hapus repository |

### 7.7 Sandbox Constraints

Sandbox eksekusi (Docker) dibatasi pada:
- CPU limit
- Memory limit
- Execution time limit
- Filesystem terisolasi
- Network terbatas/ditutup selama eksekusi test (kecuali domain package registry yang diizinkan)

### 7.8 Automatic Debugging Loop

```
Test gagal
   ↓
Analyze error message
   ↓
Locate source (via search_code/read_file)
   ↓
Modify code
   ↓
Re-run test
   ↓
(ulangi maksimal MAX_ITERATIONS = 3)
   ↓
Jika masih gagal → status "needs_human_help"
```

---

## 8. Data Model (Supabase)

Supabase hanya menyimpan **state & metadata**, bukan source code.

```sql
-- projects: repository yang terhubung
projects
├── id
├── name
├── repository_full_name
├── github_installation_id
├── created_at

-- tasks: satu task = satu issue yang sedang dikerjakan agent
tasks
├── id
├── project_id (FK → projects.id)
├── issue_number
├── issue_title
├── status            -- enum: queued, analyzing_issue, analyzing_repo, planning,
                       --       awaiting_approval, implementing, testing,
                       --       debugging, pr_creating, pr_created,
                       --       failed, needs_human_help
├── plan_json          -- snapshot Implementation Plan terakhir yang disetujui
├── pr_url
├── created_at
├── updated_at

-- agent_runs: eksekusi agent per tahap (planning/coding/testing)
agent_runs
├── id
├── task_id (FK → tasks.id)
├── agent_type         -- enum: planner, coder, tester
├── status
├── started_at
├── completed_at

-- tool_calls: setiap pemanggilan tool oleh agent
tool_calls
├── id
├── agent_run_id (FK → agent_runs.id)
├── tool_name
├── arguments (jsonb)
├── result (jsonb)
├── status
├── created_at

-- approvals: histori approve/reject plan oleh manusia
approvals
├── id
├── task_id (FK → tasks.id)
├── decision           -- enum: approved, rejected
├── feedback_text
├── created_at
```

---

## 9. API Design (Ringkasan)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/auth/github/callback` | GET | Callback OAuth/GitHub App |
| `/projects` | GET/POST | List / hubungkan repository |
| `/projects/{id}/issues` | GET | Ambil daftar open issue dari GitHub |
| `/tasks` | POST | Mulai agent run untuk sebuah issue → return `task_id`, status `queued` |
| `/tasks/{id}` | GET | Polling status & progress task |
| `/tasks/{id}/approve` | POST | Approve implementation plan |
| `/tasks/{id}/reject` | POST | Reject plan + feedback teks |
| `/tasks/{id}/runs` | GET | Detail agent_runs & tool_calls (observability) |
| `/tasks/{id}/metrics` | GET | Metrik evaluasi task tersebut |

**Pola respons async standar:**

```json
// POST /tasks → langsung return, tidak menunggu agent selesai
{
  "task_id": "task_123",
  "status": "queued"
}
```

```json
// GET /tasks/task_123
{
  "status": "implementing",
  "progress": 65
}
```

---

## 10. Observability & Evaluation

### 10.1 Data yang Dicatat

- `agent_runs` — durasi & status per tahap agent.
- `tool_calls` — nama tool, argumen, hasil, status.
- `token_usage` — konsumsi token per run.
- `execution_time` — waktu eksekusi per tahap.
- `test_results` — hasil pass/fail per iterasi debugging.

### 10.2 Metrik Evaluasi (Target Awal)

| Metric | Target |
|---|---:|
| Issue understanding accuracy | > 90% |
| Plan acceptance rate | > 70% |
| Test pass rate | > 70% |
| PR acceptance rate (oleh reviewer manusia) | > 60% |
| Rata-rata iterasi debugging | < 3 |
| Human intervention rate | terukur, tidak ditarget angka pasti di MVP |
| Task completion time | terukur, dijadikan baseline |

Metrik ini ditampilkan di **Task Dashboard** dan **Agent Evaluation Dashboard**, sekaligus menjadi bahan portfolio (bukti kuantitatif, bukan klaim kualitatif).

---

## 11. Keamanan (Security Requirements)

| Area | Kebijakan |
|---|---|
| **Permission model** | Agent hanya boleh: read repository, write ke branch agent, create PR. |
| **Larangan eksplisit** | Agent tidak boleh: delete repository, merge PR, akses secrets arbitrary, deploy ke production. |
| **Command allowlist** | Hanya command yang di-whitelist (`npm test`, `npm run lint`, `npm run build`) yang boleh dieksekusi di sandbox. |
| **Sandbox isolation** | Semua eksekusi kode hasil generate AI berjalan di Docker sandbox dengan limit CPU/memory/time/network — diperlakukan sebagai untrusted code. |
| **Audit log** | Setiap tindakan agent dicatat: WHO (agent/task), WHAT (aksi), WHEN, WHY (berdasarkan plan step mana), RESULT. |
| **Human accountability** | Tidak ada auto-merge. PR selalu menunggu review & approval manusia di GitHub. |

---

## 12. Model Routing & Cost Control

Untuk menghindari biaya LLM yang membengkak, Nexora menggunakan **AI Gateway** yang merutekan task ke model berbeda sesuai kompleksitas:

| Jenis Tugas | Tipe Model |
|---|---|
| Eksplorasi kode, klasifikasi, summarization | Model cepat/murah |
| Coding, reasoning kompleks, debugging | Model kuat |

Selain itu:
- `MAX_ITERATIONS = 3` pada automatic debugging untuk mencegah loop fix→test→fix tanpa henti.
- Repository Understanding berbasis tool selektif (bukan membaca seluruh repo) untuk menghemat token sekaligus meningkatkan kualitas reasoning.

---

## 13. Deployment Strategy

### 13.1 Mode Development (MVP Awal)

```
Vercel (Next.js) → Cloud Run (FastAPI) → Supabase + LLM API + GitHub API
                                              ↓
                                        Git Branch
                                              ↓
                                   Docker Sandbox (LOKAL developer)
```

Sandbox eksekusi test **belum** berjalan di cloud pada tahap ini — dijalankan di mesin developer sendiri untuk menekan biaya dan kompleksitas awal.

### 13.2 Mode Production (Pasca-MVP tervalidasi)

```
Vercel → Cloud Run API → Agent Orchestrator → Cloud Run Job / dedicated sandbox → GitHub PR
```

Sandbox baru dipindah ke cloud setelah MVP terbukti bekerja dan ada kebutuhan nyata untuk eksekusi remote.

### 13.3 Estimasi Biaya Tahap Awal

| Komponen | Layanan | Estimasi Biaya |
|---|---|---:|
| Frontend | Vercel Hobby | $0 |
| Database | Supabase Free | $0 |
| Backend | Cloud Run (free tier) | $0 (dalam batas free tier) |
| Source Control | GitHub | $0 |
| Sandbox | Docker lokal | $0 |
| LLM | API pay-as-you-go | Variabel — komponen biaya utama |

Catatan: Supabase Free dan Vercel Hobby tetap memiliki batas penggunaan (bukan unlimited), sehingga perlu dipantau seiring pertumbuhan penggunaan.

---

## 14. Roadmap Fase Pengembangan

| Fase | Fokus |
|---|---|
| Phase 0 | Product Design (dokumen ini) |
| Phase 1 | Fondasi aplikasi: Next.js dashboard + FastAPI backend + Supabase schema |
| Phase 2 | Koneksi GitHub: OAuth/App, pemilihan repository & issue |
| Phase 3 | Repository Understanding: implementasi tools `search_code`, `list_files`, `read_file`, `get_git_diff` |
| Phase 4 | Planning Agent: structured JSON implementation plan |
| Phase 5 | Human Approval Gate di UI |
| Phase 6 | Coding Agent: read/write/edit/create/delete file dengan permission terbatas |
| Phase 7 | Docker Sandbox lokal: install/build/test terisolasi |
| Phase 8 | Automatic Debugging loop (maks 3 iterasi) |
| Phase 9 | Git & Pull Request automation |
| Phase 10 | Human Code Review (di GitHub, di luar Nexora) |
| Phase 11 | Observability: agent_runs, tool_calls, token_usage, dsb |
| Phase 12 | Evaluation Dashboard: metrik kuantitatif |
| Phase 13 | Security hardening: permission model, command allowlist, audit log |
| Phase 14+ | V2+: RAG dokumentasi, Code Reviewer Agent, Issue Triage Agent, Multi-agent orchestration |

**Milestone keberhasilan MVP** dianggap tercapai jika alur berikut berjalan end-to-end untuk minimal satu repository nyata:

> GitHub Issue → Repository Understanding → Implementation Plan → Human Approval → Coding → Sandbox Test → Automatic Debugging → Pull Request → Human Review

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Agent salah paham konteks issue/kode besar | Plan tidak relevan, PR salah arah | Human Approval Gate wajib sebelum eksekusi kode |
| Infinite loop debugging | Biaya LLM membengkak, waktu terbuang | `MAX_ITERATIONS` keras, fallback ke status `needs_human_help` |
| Kode AI-generated berbahaya/rusak | Kerusakan environment eksekusi | Sandbox terisolasi dengan resource & network limit |
| Biaya LLM tidak terkontrol | Biaya operasional membengkak | Model routing (cheap vs strong model), pembatasan token per stage |
| Ketergantungan pada free tier cloud | Layanan terhenti saat quota habis | Monitoring usage, desain lean agar jarang menyentuh batas free tier di awal |
| Agent melakukan aksi destruktif | Kehilangan data/kode | Command allowlist ketat + larangan eksplisit (no delete repo, no merge, no deploy) |

---

## 16. Metrik Kesuksesan Produk (Portfolio-Level)

Selain metrik evaluasi agent (bagian 10.2), keberhasilan produk sebagai portfolio diukur dari:

- Kemampuan mendemonstrasikan **satu alur end-to-end nyata** (issue asli → PR asli) dengan hasil terukur.
- Adanya **dashboard observability** yang menunjukkan transparansi keputusan agent, bukan black box.
- Dokumentasi pendukung yang dapat diturunkan dari project ini: README, diagram arsitektur, demo video, artikel teknis, dan CV bullet points.

---

## 17. Lampiran — Ringkasan Prinsip Desain

1. **Jangan mulai dari multi-agent** — satu agent dengan tahapan internal jelas lebih mudah didebug dan dievaluasi.
2. **Human tetap accountable** — tidak ada auto-merge atau auto-deploy di MVP.
3. **Structured output, bukan free text** — semua output antar-tahap agent berupa JSON yang dapat dikonsumsi sistem.
4. **Repository understanding selektif** — agent membaca berdasarkan relevansi, bukan seluruh codebase.
5. **Sandbox dulu, cloud sandbox belakangan** — jangan overengineer infrastruktur eksekusi di awal.
6. **Lean infrastructure** — hindari Kubernetes/Kafka/Redis/vector DB sampai benar-benar diperlukan oleh skala nyata.
7. **Ukur, jangan klaim** — semua keberhasilan agent harus dibuktikan lewat metrik, bukan opini.

---

## 18. Lampiran B — Local Development Setup (Getting Started)

Bagian ini menerjemahkan Phase 1 (Fondasi Aplikasi) menjadi langkah teknis konkret agar development bisa dimulai dengan biaya nyaris nol dan kompleksitas minimal.

### 18.1 Prinsip Setup Lokal

> **Semua service berat berjalan di cloud (Supabase, Gemini, GitHub). Aplikasi Nexora sendiri berjalan 100% lokal di tahap awal.**

Jangan install atau setup lebih dari yang dibutuhkan hari itu. Urutan belajar mengikuti urutan kebutuhan project, bukan sebaliknya.

### 18.2 Software Prasyarat

| Tool | Untuk | Wajib |
|---|---|:---:|
| VS Code | Coding | ✅ |
| Git | Version control | ✅ |
| Node.js LTS | Next.js | ✅ |
| Python 3.12+ | FastAPI / Agent Engine | ✅ |
| Docker Desktop | Sandbox menjalankan kode hasil agent | ✅ |
| Akun Google | Gemini API | ✅ |
| Akun GitHub | Repository & Pull Request | ✅ |
| Akun Supabase | PostgreSQL (state & metadata) | ✅ |
| AI coding assistant (mis. Google Antigravity) | Membantu proses development Nexora itu sendiri | Opsional |

**Belum dibutuhkan di tahap ini:** Redis, Kubernetes, Terraform, Cloud SQL, Firebase, Vector Database, Kafka, AWS.

Catatan penting: AI assistant yang membantu *menulis kode Nexora* (mis. Antigravity) adalah hal yang berbeda dari Gemini API yang dipanggil *oleh* Nexora sebagai agent engine — jangan campur adukkan keduanya.

### 18.3 Struktur Monorepo

```text
nexora/
│
├── apps/
│   ├── web/          ← Next.js (dashboard, approval UI, task status)
│   │
│   └── api/           ← FastAPI (agent engine, tools, workflows)
│       ├── main.py
│       ├── agents/
│       ├── tools/
│       ├── workflows/
│       ├── services/
│       └── models/
│
├── sandbox/           ← Docker sandbox untuk eksekusi kode hasil agent
│   ├── Dockerfile
│   ├── runner.py
│   └── workspace/
│
├── docs/               ← PRD, technical design docs, diagram
│
├── .gitignore
├── README.md
└── docker-compose.yml
```

### 18.4 Setup Frontend (Next.js)

```bash
npx create-next-app@latest apps/web
```

Pilihan saat inisialisasi:

| Opsi | Pilihan |
|---|---|
| TypeScript | Yes |
| ESLint | Yes |
| Tailwind CSS | Yes |
| App Router | Yes |
| `src/` directory | Yes |

Jalankan:

```bash
cd apps/web
npm run dev
```

Akses di `http://localhost:3000`.

**Target UI pertama (belum ada AI sama sekali):**

```text
┌──────────────────────────────────┐
│ Nexora                            │
│ AI Software Engineering Agent    │
├──────────────────────────────────┤
│                                  │
│ Repository                       │
│ [ Select Repository ]            │
│                                  │
│ Issue                            │
│ [ #142 Add email verification ] │
│                                  │
│          [ Start Agent ]         │
└──────────────────────────────────┘
```

### 18.5 Setup Backend (FastAPI)

```bash
cd apps
mkdir api && cd api
python -m venv .venv
```

Aktivasi (Windows):

```bash
.venv\Scripts\activate
```

Install dependency dasar:

```bash
pip install fastapi uvicorn
```

`main.py` minimal:

```python
from fastapi import FastAPI

app = FastAPI(title="Nexora API")

@app.get("/health")
def health():
    return {"status": "ok"}
```

Jalankan:

```bash
uvicorn main:app --reload
```

Verifikasi di `http://localhost:8000/health` → `{"status": "ok"}`.

### 18.6 Setup Supabase

Buat satu project Supabase, gunakan hanya untuk PostgreSQL di tahap ini. Buat lima tabel awal sesuai bagian 8 (Data Model): `projects`, `tasks`, `agent_runs`, `tool_calls`, `approvals`. Jangan menambah tabel di luar kebutuhan MVP.

### 18.7 Setup Gemini API

Alur pemanggilan:

```text
FastAPI (Nexora backend)
      ↓
Gemini API
      ↓
AI reasoning (planning, coding, debugging)
```

Simpan API key di `apps/api/.env`, **jangan pernah commit** file ini ke GitHub. Tambahkan ke `.gitignore`:

```text
.env
.venv/
__pycache__/
```

Untuk tahap development, Gemini API free tier dapat digunakan selama masih dalam batas quota akun/project.

### 18.8 Setup GitHub

Untuk produksi, integrasi GitHub dibangun sebagai **GitHub App** (bukan Personal Access Token bebas), agar permission dapat dibatasi secara eksplisit sesuai bagian 7.6 (Coding Agent — Tool Permission).

Untuk tahap development awal, cukup gunakan satu repository test milik sendiri sebagai sandbox eksperimen, misalnya `<username>/nexora-playground`, dan berikan agent akses hanya ke repository tersebut.

### 18.9 Setup Docker Sandbox

Docker Desktop wajib sebelum masuk ke Phase 6–7 (Coding Agent & Sandbox Execution). Agent **tidak** diberi akses shell langsung ke mesin host. Struktur awal:

```text
sandbox/
├── Dockerfile
├── runner.py
└── workspace/
```

Berkembang menjadi:

```text
Coding Agent
      ↓
Sandbox Manager
      ↓
Docker Container
      ↓
Clone branch → npm install → npm test
      ↓
Return result ke FastAPI
```

### 18.10 Environment Variables

**Backend (`apps/api/.env`):**

```env
GEMINI_API_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

**Frontend (`apps/web/.env.local`):**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

⚠️ **`SUPABASE_SERVICE_ROLE_KEY` tidak boleh pernah masuk ke frontend/browser.** Hanya digunakan di backend.

### 18.11 Arsitektur Lokal (Ringkasan Visual)

```text
                   LAPTOP DEVELOPER
┌─────────────────────────────────────────┐
│                                         │
│   Next.js  :3000                        │
│       │                                 │
│       ▼                                 │
│   FastAPI  :8000                        │
│       │                                 │
│   ┌───┼──────────────┐                  │
│   ▼   ▼               ▼                  │
│ Gemini  GitHub      Supabase             │
│  API     API       PostgreSQL            │
│ (cloud) (cloud)      (cloud)             │
│       │                                 │
│       ▼                                 │
│   Docker Sandbox (lokal)                │
│                                         │
└─────────────────────────────────────────┘
```

Gemini, GitHub, dan Supabase berjalan di cloud pihak ketiga; aplikasi Nexora sendiri (web, api, sandbox) berjalan sepenuhnya di laptop developer pada tahap ini.

### 18.12 Kenapa LangGraph Ditunda

Agent orchestration dibangun bertahap, bukan langsung memakai framework workflow seperti LangGraph:

```text
1. Gemini API → prompt → response (dasar)
2. Gemini API → tool calling → search_code(), dst.
3. Gemini API → state → workflow sederhana
4. Baru: LangGraph (setelah tools & state sudah stabil)
```

Memasukkan LangGraph + tools + Docker + GitHub sekaligus di awal akan membuat debugging jauh lebih sulit untuk menelusuri sumber masalah.

### 18.13 Rencana Setup 5 Hari Pertama

| Hari | Checklist |
|---|---|
| **Day 1** | Install Node.js, Python, Docker · Setup Git · Buat repository GitHub · Buat project Supabase |
| **Day 2** | Inisialisasi Next.js & FastAPI · Hubungkan frontend ↔ backend · Endpoint `/health` berjalan |
| **Day 3** | Hubungkan Supabase · Buat lima tabel awal · Uji CRUD dasar |
| **Day 4** | Setup Gemini API · Uji request sederhana · Uji structured output (JSON) |
| **Day 5** | Setup GitHub API · Baca repository · Baca issue |

Setelah Day 5 selesai, baru masuk ke **Agent V1** (Planning Agent — Phase 4).

### 18.14 Definisi Milestone Pertama (Revisi)

Milestone pertama **sengaja dibuat kecil**, bukan "AI sudah bisa coding":

> **Developer bisa membuka `localhost:3000`, memilih repository & issue GitHub, klik "Start Agent", dan FastAPI berhasil menerima data issue tersebut lalu menyimpannya ke Supabase.**

```text
Browser → Next.js → FastAPI → Supabase
```

Urutan milestone berikutnya, satu langkah pada satu waktu:

```text
Supabase   →  Gemini            (agent bisa "berpikir")
Gemini     →  GitHub tools      (agent bisa membaca repo)
GitHub     →  Code modification (agent bisa mengubah kode)
Docker     →  Testing           (agent bisa menguji hasilnya)

Akhirnya:
Issue → Plan → Approve → Code → Test → Fix → PR
```

Jalur ini adalah jalur paling murah dan paling mudah didebug untuk membangun Nexora dari laptop developer hingga akhirnya di-deploy ke Vercel + Cloud Run.

---

*Dokumen ini adalah PRD versi awal (MVP Definition) untuk Nexora dan akan diperbarui seiring validasi teknis di setiap fase pengembangan.*
