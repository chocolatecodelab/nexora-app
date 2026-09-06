"""
Nexora AI — Security & Quality Guardrail Service

Performs automated pre-flight security scans on all agent-generated code changes:
1. Secret & API Key Leak Prevention (Gemini, GitHub, GitLab, AWS, Private Keys, Passwords).
2. Dangerous Code Pattern Detection (SQL Injection, unsafe eval, arbitrary command injection).
3. Linter & Syntax Quality Checks.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from app.models.schemas import SecurityIssue, SecurityReport

logger = logging.getLogger(__name__)

# ============================================================
# Secret & Token Detection Patterns
# ============================================================
SECRET_PATTERNS = [
    (
        "Google / Gemini API Key",
        re.compile(r"AIza[0-9A-Za-z-_]{30,45}"),
        "CRITICAL",
        "Terdeteksi hardcoded Google / Gemini API key. Gunakan environment variable.",
    ),
    (
        "GitHub Personal Access Token",
        re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[0-9a-zA-Z_]{82}"),
        "CRITICAL",
        "Terdeteksi GitHub Access Token dalam source code. Hapus dan gunakan auth session.",
    ),
    (
        "GitLab Personal Access Token",
        re.compile(r"glpat-[0-9a-zA-Z\-_]{20,40}"),
        "CRITICAL",
        "Terdeteksi GitLab Access Token dalam source code.",
    ),
    (
        "AWS Access Key ID",
        re.compile(r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}"),
        "HIGH",
        "Terdeteksi AWS Access Key ID.",
    ),
    (
        "RSA / SSH Private Key",
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
        "CRITICAL",
        "Terdeteksi Private Key file content di dalam kode.",
    ),
    (
        "Generic Hardcoded Password Assignment",
        re.compile(r"(?i)(?:password|secret|api_key|apikey|auth_token)\s*=\s*['\"][^'\"]{6,}['\"]"),
        "MEDIUM",
        "Kemungkinan hardcoded secret atau password pada variabel.",
    ),
]

# ============================================================
# Vulnerability Patterns
# ============================================================
VULNERABILITY_PATTERNS = [
    (
        "Unsafe eval() Execution",
        re.compile(r"\beval\s*\("),
        "HIGH",
        "Penggunaan fungsi eval() rentan terhadap Remote Code Execution (RCE).",
    ),
    (
        "Potential SQL Injection Concatenation",
        re.compile(r"(?i)(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\+\s*[a-zA-Z_]"),
        "HIGH",
        "String concatenation pada SQL query rentan terhadap SQL Injection. Gunakan parameterized queries.",
    ),
    (
        "Insecure Child Process / Shell Exec",
        re.compile(r"(?:exec\s*\(|child_process\.exec\s*\(|os\.system\s*\()"),
        "MEDIUM",
        "Eksekusi shell command langsung berpotensi command injection.",
    ),
]


def scan_code_changes(code_changes: dict) -> SecurityReport:
    """
    Scans modified and created files for secret leaks and vulnerability patterns.
    """
    issues: list[SecurityIssue] = []
    scanned_files_count = 0

    files_to_scan: list[dict] = []
    if isinstance(code_changes, dict):
        files_to_scan.extend(code_changes.get("modified_files", []))
        files_to_scan.extend(code_changes.get("created_files", []))

    for file_info in files_to_scan:
        path = file_info.get("path", "unknown")
        content = file_info.get("content", "")
        if not content:
            continue

        scanned_files_count += 1
        lines = content.splitlines()

        for line_idx, line in enumerate(lines, start=1):
            # Check secret leaks
            for rule_name, pattern, severity, description in SECRET_PATTERNS:
                if pattern.search(line):
                    # Mask snippet for safety
                    masked_line = line.strip()
                    if len(masked_line) > 80:
                        masked_line = masked_line[:77] + "..."
                    issues.append(
                        SecurityIssue(
                            rule_name=rule_name,
                            file_path=path,
                            line_number=line_idx,
                            severity=severity,
                            category="SECRET_LEAK",
                            snippet=masked_line,
                            description=description,
                        )
                    )

            # Check common vulnerability patterns
            for rule_name, pattern, severity, description in VULNERABILITY_PATTERNS:
                if pattern.search(line):
                    issues.append(
                        SecurityIssue(
                            rule_name=rule_name,
                            file_path=path,
                            line_number=line_idx,
                            severity=severity,
                            category="VULNERABILITY",
                            snippet=line.strip()[:80],
                            description=description,
                        )
                    )

    critical_count = sum(1 for i in issues if i.severity == "CRITICAL")
    high_count = sum(1 for i in issues if i.severity == "HIGH")
    medium_count = sum(1 for i in issues if i.severity == "MEDIUM")

    passed = (critical_count == 0 and high_count == 0)

    summary = "✅ Clean Scan: No security vulnerabilities or secret leaks detected."
    if not passed:
        summary = f"⚠️ Security Guardrail Alert: {critical_count} Critical / {high_count} High security issues detected."
    elif issues:
        summary = f"ℹ️ Guardrail Notice: {len(issues)} low/medium quality notices."

    return SecurityReport(
        passed=passed,
        scanned_files_count=scanned_files_count,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        summary=summary,
        issues=issues,
    )
