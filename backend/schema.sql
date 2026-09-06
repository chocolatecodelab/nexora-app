-- ============================================================
-- Nexora AI — Supabase Database Schema & Migration Script
-- Version: 1.3
-- Description: Core tables for projects, tasks, agent runs,
--              branch strategies, PR templates, code diffs,
--              and pre-flight security reports.
--              Fully idempotent (safe to run repeatedly in Supabase SQL Editor).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROJECTS — Connected GitHub / GitLab repositories & config
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    TEXT NOT NULL,
    repository_full_name    TEXT NOT NULL UNIQUE,       -- e.g. "user/repo"
    github_installation_id  BIGINT,                     -- GitHub App installation
    git_provider            TEXT DEFAULT 'github',      -- "github" or "gitlab"
    default_branch          TEXT DEFAULT 'main',
    branch_prefix           TEXT DEFAULT 'nexora/issue-',-- e.g. "nexora/issue-", "feat/", "fix/"
    pr_title_template       TEXT DEFAULT '[Nexora AI] {issue_title}',
    pr_draft_mode           BOOLEAN DEFAULT FALSE,
    auto_link_issue         BOOLEAN DEFAULT TRUE,       -- adds "Closes #{issue_number}"
    custom_test_command     TEXT DEFAULT 'npm test',    -- e.g. "npm test", "pytest", "php artisan test"
    max_debug_iterations    INT DEFAULT 3,              -- 1 to 5 attempts
    approval_mode           TEXT DEFAULT 'strict',      -- "strict" or "low_risk_auto"
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent Column Additions for Existing 'projects' Table
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_provider TEXT DEFAULT 'github';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch_prefix TEXT DEFAULT 'nexora/issue-';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS pr_title_template TEXT DEFAULT '[Nexora AI] {issue_title}';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS pr_draft_mode BOOLEAN DEFAULT FALSE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_link_issue BOOLEAN DEFAULT TRUE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_test_command TEXT DEFAULT 'npm test';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_debug_iterations INT DEFAULT 3;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS approval_mode TEXT DEFAULT 'strict';
END $$;

-- ============================================================
-- 2. TASKS — One task = one issue being worked on by the agent
-- ============================================================
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'queued',
        'analyzing_issue',
        'analyzing_repo',
        'planning',
        'awaiting_approval',
        'implementing',
        'testing',
        'debugging',
        'pr_creating',
        'pr_created',
        'failed',
        'needs_human_help',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN
        -- If type already exists, add 'cancelled' if missing
        ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';
END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_number    INT NOT NULL,
    issue_title     TEXT NOT NULL,
    issue_body      TEXT,
    target_files    JSONB,                              -- Specific files targeted by developer
    focus_hints     TEXT,                               -- Specific functions or focus areas
    base_commit_sha TEXT,                               -- Initial commit checkpoint SHA
    code_changes    JSONB,                              -- Generated modified & created files
    security_report JSONB,                              -- Pre-flight security & secret scan results
    attachments     JSONB,                              -- Multimodal uploaded images and supplemental files
    status          task_status DEFAULT 'queued',
    plan_json       JSONB,                              -- Latest approved plan
    pr_url          TEXT,
    branch_name     TEXT,
    error_message   TEXT,
    iteration_count INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent Column Additions for Existing 'tasks' Table
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_files JSONB;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus_hints TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS base_commit_sha TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS code_changes JSONB;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS security_report JSONB;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================
-- 3. AGENT_RUNS — Each execution phase of the agent
-- ============================================================
DO $$ BEGIN
    CREATE TYPE agent_type AS ENUM ('planner', 'coder', 'tester', 'debugger');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE run_status AS ENUM ('running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_type      agent_type NOT NULL,
    status          run_status DEFAULT 'running',
    token_usage     JSONB,                              -- {prompt_tokens, completion_tokens, total}
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON agent_runs(task_id);

-- ============================================================
-- 4. TOOL_CALLS — Every tool invocation by the agent (audit log)
-- ============================================================
DO $$ BEGIN
    CREATE TYPE tool_status AS ENUM ('success', 'error', 'timeout');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tool_calls (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_run_id    UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    tool_name       TEXT NOT NULL,                      -- e.g. search_code, read_file
    arguments       JSONB,
    result          JSONB,
    status          tool_status DEFAULT 'success',
    execution_ms    INT,                                -- Duration in milliseconds
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_agent_run_id ON tool_calls(agent_run_id);

-- ============================================================
-- 5. APPROVALS — Human approve/reject decisions on plans
-- ============================================================
DO $$ BEGIN
    CREATE TYPE approval_decision AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS approvals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    decision        approval_decision NOT NULL,
    feedback_text   TEXT,                               -- Free-text feedback on rejection
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_task_id ON approvals(task_id);

-- ============================================================
-- 6. TASK_COMMENTS — Human Review & Live Intervention Trail
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    comment_text    TEXT NOT NULL,
    is_intervention BOOLEAN DEFAULT FALSE,
    task_status_at  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- ============================================================
-- Auto-update `updated_at` trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
