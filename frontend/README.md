# Nexora AI — Frontend Workstation

A developer-grade workstation UI for **Nexora AI** — Autonomous Agentic Software Engineering Platform. Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, and TypeScript.

---

## 🧭 Overview

The Nexora frontend provides a real-time, terminal-inspired cockpit where developers supervise, inspect, and interact with autonomous AI coding agents.

Key UI modules:
- **Agent Cockpit & Pipeline Tracker**: Real-time visual progress stepper through Planning, Coding, Execution, Testing, and PR Creation stages.
- **Interactive Code Diff Viewer**: Side-by-side / unified diff viewer showing code modifications proposed by the AI engineer.
- **Observability & Tool Logs**: Live streaming execution logs, shell command outputs, and sandbox container feedback.
- **Pre-flight Security Guardrail Card**: Real-time secret and syntax validation reports before any code is committed.
- **Task Management & History**: Filter, inspect, restart, or safely purge task states with live counters.
- **Evaluation & Benchmarks**: Real-time metrics for agent success rates, test pass percentage, and token economy.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server & Client Components)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Language**: TypeScript 5+

---

## 📁 Component Structure

```
frontend/
├── app/
│   ├── favicon.ico
│   ├── globals.css          # Design tokens & base styling
│   ├── layout.tsx           # App root layout & metadata
│   └── page.tsx             # Main workstation dashboard
├── components/
│   ├── AuthAccountModal.tsx        # Git provider authentication
│   ├── CodeDiffViewer.tsx          # Git diff visualizer
│   ├── CommitHistoryTab.tsx        # Commit log browser
│   ├── EvaluationTab.tsx           # Agent benchmarks & metrics
│   ├── ImplementationPlanCard.tsx  # Plan approval card
│   ├── IssueSelector.tsx           # Issue picker & manual creator
│   ├── Navbar.tsx                  # Workstation header & repo picker
│   ├── ObservabilityLogs.tsx       # Live terminal log stream
│   ├── PlanReviewModal.tsx         # Detailed plan inspector modal
│   ├── ProgressStepper.tsx         # 5-stage pipeline progress indicator
│   ├── SecurityGuardrailCard.tsx   # Pre-flight security report
│   ├── SettingsTab.tsx             # Project & branch configuration
│   ├── Sidebar.tsx                 # Workstation tab navigation & status
│   ├── StatusBadge.tsx             # Monospaced status pill
│   ├── TaskCommentPanel.tsx        # Human-in-the-loop task chat
│   ├── TaskPipeline.tsx            # Pipeline execution coordinator
│   └── ToolLogViewer.tsx           # Granular tool execution audit
├── lib/
│   └── api.ts               # Resilient API client (dual local/docker support)
└── types/
    └── index.ts             # TypeScript definitions for Tasks, Logs, Diffs
```

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run production build check
npm run build
```

The application will start at `http://localhost:3000`.

### Backend Connection
By default, the client dynamically determines the backend URL (`http://127.0.0.1:8000` for local dev, or `http://127.0.0.1:8001` when run through Docker Compose). You can also explicitly specify `NEXT_PUBLIC_API_URL` if connecting to a remote deployment.
