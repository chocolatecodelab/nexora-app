# Contributing to Nexora AI

Thank you for your interest in contributing to **Nexora AI**! Nexora is an autonomous agentic software engineering platform built with FastAPI, Next.js, and Google Gemini.

Whether you're fixing bugs, adding new features, or improving documentation, all contributions are welcome.

---

## 🛠️ Tech Stack Overview

- **Backend**: Python 3.10+, FastAPI, Google Gemini API (`google-genai`), Supabase (PostgreSQL), Pytest
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TypeScript
- **Sandbox Execution**: Docker-based isolated container for testing and running code

---

## 🚀 Getting Started with Local Development

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/nexora-app.git
cd nexora-app
```

### 2. Configure Environment Variables
Copy the example environment files:
```bash
# Backend
cp backend/.env.example backend/.env

# Root Docker (if testing with containers)
cp .env.docker.example .env.docker
```
Fill in your own API keys in `backend/.env`:
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/)
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Get from your [Supabase Project](https://supabase.com/)

### 3. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# Run tests to verify setup
pytest -v

# Start FastAPI server
uvicorn main:app --reload --port 8000
```
Backend will be live at `http://127.0.0.1:8000` (Swagger UI at `/docs`).

### 4. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend will be accessible at `http://localhost:3000`.

---

## 🐳 Running with Docker

You can run the full stack (Frontend, Backend, Sandbox) using Docker Compose:
```bash
docker compose up --build
```
- Frontend: `http://127.0.0.1:3001`
- Backend: `http://127.0.0.1:8001`

---

## 🌿 Branching Strategy & PR Guidelines

1. **Branch Names**:
   - Features: `feat/short-description`
   - Bug fixes: `fix/issue-description`
   - Documentation: `docs/what-changed`
   - Autonomous Agent branches: `nexora/issue-{number}`
2. **Commit Messages**: Follow Conventional Commits format:
   - `feat: add GitLab CI token validation`
   - `fix: correct active task reset on empty pipeline`
   - `docs: update setup instructions in README`
3. **Pre-PR Checklist**:
   - [ ] Run backend tests: `pytest -v` (in `backend/`)
   - [ ] Run frontend build check: `npm run build` (in `frontend/`)
   - [ ] Ensure no credentials or `.env` files are tracked in git

---

## 🔒 Security & Secrets Policy

- **Never** commit API keys, service role tokens, or private keys to the repository.
- GitHub Push Protection is enabled.
- All secrets must be injected via environment variables or CI/CD repository secrets.

---

## 📄 Code of Conduct

Please be respectful, collaborative, and constructive when reviewing pull requests or participating in issue discussions.
