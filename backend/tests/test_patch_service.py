"""
Tests for Nexora AI — Search/Replace Block Diff Engine (patch_service)
"""

import pytest
from app.services.patch_service import (
    apply_file_patch,
    apply_search_replace_blocks,
    apply_single_block,
    parse_search_replace_text,
)


def test_exact_match_single_block():
    original = """def add(a, b):
    return a - b  # bug!
"""
    blocks = [
        {
            "search": "    return a - b  # bug!",
            "replace": "    return a + b",
        }
    ]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is True
    assert "return a + b" in patched
    assert "return a - b" not in patched


def test_exact_match_multiple_blocks():
    original = """line 1
line 2
line 3
line 4
"""
    blocks = [
        {"search": "line 2", "replace": "line TWO"},
        {"search": "line 4", "replace": "line FOUR"},
    ]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is True
    assert "line TWO" in patched
    assert "line FOUR" in patched
    assert "line 1" in patched
    assert "line 3" in patched


def test_line_ending_normalization_crlf():
    original = "line 1\r\nline 2\r\nline 3\r\n"
    # Search block has LF endings
    blocks = [{"search": "line 2", "replace": "line 2 modified"}]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is True
    assert "line 2 modified" in patched
    assert "\r\n" in patched  # Preserves Windows CRLF


def test_whitespace_tolerant_matching():
    original = "function test() {   \n    const x = 10;   \n    return x;\n}"
    # Search string has different trailing whitespace
    blocks = [
        {
            "search": "function test() {\n    const x = 10;\n    return x;",
            "replace": "function test() {\n    const x = 20;\n    return x;",
        }
    ]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is True
    assert "const x = 20;" in patched


def test_indentation_tolerant_matching():
    original = """class Service:
    def execute(self):
        val = 1
        return val
"""
    # Model used 8 spaces instead of 4, or vice-versa
    blocks = [
        {
            "search": "def execute(self):\n    val = 1",
            "replace": "def execute(self):\n    val = 99",
        }
    ]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is True
    assert "val = 99" in patched


def test_markdown_parser():
    diff_text = """Here is the fix:
<<<<<<< SEARCH
    const port = 3000;
=======
    const port = process.env.PORT || 3000;
>>>>>>>
End of diff.
"""
    blocks = parse_search_replace_text(diff_text)
    assert len(blocks) == 1
    assert "const port = 3000;" in blocks[0]["search"]
    assert "process.env.PORT || 3000" in blocks[0]["replace"]


def test_apply_file_patch_with_markdown_text():
    original = "const host = 'localhost';\nconst port = 3000;\n"
    patch_dict = {
        "path": "config.js",
        "content": "<<<<<<< SEARCH\nconst port = 3000;\n=======\nconst port = 8080;\n>>>>>>>",
    }
    patched, ok, logs = apply_file_patch(original, patch_dict)
    assert ok is True
    assert "const port = 8080;" in patched
    assert "const host = 'localhost';" in patched


def test_apply_file_patch_backward_compatible_whole_file():
    original = "old content"
    patch_dict = {
        "path": "main.py",
        "content": "brand new whole content",
    }
    patched, ok, logs = apply_file_patch(original, patch_dict)
    assert ok is True
    assert patched == "brand new whole content"


def test_no_match_safety():
    original = "function unaffected() { return true; }"
    blocks = [{"search": "non_existent_code()", "replace": "replacement()"}]
    patched, ok, logs = apply_search_replace_blocks(original, blocks)
    assert ok is False
    assert patched == original  # Did not corrupt original file


def test_large_file_preservation():
    """Verify that a 600-line file has targeted changes applied without losing any intermediate lines."""
    lines = [f"// Line {i}: const item_{i} = {i};" for i in range(1, 601)]
    lines[299] = "export const TARGET_FLAG = false;"
    original = "\n".join(lines)

    patch_dict = {
        "path": "src/large_module.ts",
        "diff_blocks": [
            {
                "search": "export const TARGET_FLAG = false;",
                "replace": "export const TARGET_FLAG = true;",
            }
        ],
    }

    patched, ok, logs = apply_file_patch(original, patch_dict)
    assert ok is True
    assert "export const TARGET_FLAG = true;" in patched
    assert "export const TARGET_FLAG = false;" not in patched
    # Ensure line 1, line 150, line 450, line 600 are all perfectly intact
    assert "// Line 1: const item_1 = 1;" in patched
    assert "// Line 150: const item_150 = 150;" in patched
    assert "// Line 450: const item_450 = 450;" in patched
    assert "// Line 600: const item_600 = 600;" in patched
    assert len(patched.splitlines()) == 600

