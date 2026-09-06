"""
Nexora AI — QA Test Suite: Pre-Flight Security Guardrail Service
Tests regex pattern matchers, false positive resilience, and security quality gate.
"""

import pytest
from app.services.security_service import scan_code_changes


def test_clean_code_scan_passes():
    code_changes = {
        "modified_files": [
            {
                "path": "src/utils/math.ts",
                "content": "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
            }
        ],
        "created_files": [
            {
                "path": "src/services/logger.ts",
                "content": "export const log = (msg: string) => console.log(`[INFO] ${msg}`);\n",
            }
        ],
    }
    report = scan_code_changes(code_changes)
    assert report.passed is True
    assert report.critical_count == 0
    assert report.high_count == 0
    assert report.scanned_files_count == 2
    assert "Clean Scan" in report.summary


def test_gemini_api_key_leak_detected():
    code_changes = {
        "modified_files": [
            {
                "path": "src/ai.ts",
                "content": 'const KEY = "AIzaSyD1234567890abcdef1234567890abcde";\n',
            }
        ]
    }
    report = scan_code_changes(code_changes)
    assert report.passed is False
    assert report.critical_count >= 1
    assert any(i.rule_name == "Google / Gemini API Key" for i in report.issues)


def test_github_token_leak_detected():
    code_changes = {
        "created_files": [
            {
                "path": "src/git.ts",
                "content": 'const token = "ghp_1234567890abcdef1234567890abcdef1234";\n',
            }
        ]
    }
    report = scan_code_changes(code_changes)
    assert report.passed is False
    assert report.critical_count >= 1
    assert any(i.rule_name == "GitHub Personal Access Token" for i in report.issues)


def test_gitlab_token_leak_detected():
    code_changes = {
        "modified_files": [
            {
                "path": "config/gitlab.json",
                "content": '{"token": "glpat-1234567890abcdef12345678"}\n',
            }
        ]
    }
    report = scan_code_changes(code_changes)
    assert report.passed is False
    assert report.critical_count >= 1
    assert any(i.rule_name == "GitLab Personal Access Token" for i in report.issues)


def test_sql_injection_pattern_detected():
    code_changes = {
        "modified_files": [
            {
                "path": "src/db/users.ts",
                "content": 'const q = "SELECT * FROM users WHERE email = " + userEmail;\n',
            }
        ]
    }
    report = scan_code_changes(code_changes)
    assert report.passed is False
    assert report.high_count >= 1
    assert any(i.rule_name == "Potential SQL Injection Concatenation" for i in report.issues)


def test_unsafe_eval_detected():
    code_changes = {
        "modified_files": [
            {
                "path": "src/calc.js",
                "content": "function run(formula) { return eval(formula); }\n",
            }
        ]
    }
    report = scan_code_changes(code_changes)
    assert report.passed is False
    assert report.high_count >= 1
    assert any(i.rule_name == "Unsafe eval() Execution" for i in report.issues)


def test_empty_code_changes_handled():
    report = scan_code_changes({})
    assert report.passed is True
    assert report.scanned_files_count == 0
