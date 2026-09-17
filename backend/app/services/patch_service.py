"""
Nexora AI — Search/Replace Block Diff Engine

Provides robust, multi-level matching algorithms to apply SEARCH/REPLACE diff blocks
to existing files without requiring full-file regeneration:
1. Level 1: Exact string match
2. Level 2: Line-ending normalization (CRLF vs LF)
3. Level 3: Whitespace & trailing-space tolerant match
4. Level 4: Indentation-flexible match
5. Markdown parser for `<<<<<<< SEARCH ... ======= ... >>>>>>>` syntax
6. Fallback support for whole-content replacements (backward compatibility)
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Union

logger = logging.getLogger(__name__)

SEARCH_REPLACE_REGEX = re.compile(
    r"<<<<<<<\s*SEARCH\r?\n(.*?)\r?\n=======\r?\n(.*?)\r?\n>>>>>>>",
    re.DOTALL,
)


def parse_search_replace_text(text: str) -> list[dict[str, str]]:
    """
    Parses a string containing one or more Aider/Git style search/replace blocks:
    <<<<<<< SEARCH
    original code
    =======
    replacement code
    >>>>>>>
    Returns a list of dicts with 'search' and 'replace' keys.
    """
    blocks: list[dict[str, str]] = []
    if not text:
        return blocks

    matches = SEARCH_REPLACE_REGEX.findall(text)
    for search_part, replace_part in matches:
        blocks.append({
            "search": search_part,
            "replace": replace_part,
        })
    return blocks


def _detect_line_ending(content: str) -> str:
    """Detect dominant line ending: \r\n (Windows) or \n (Unix)."""
    return "\r\n" if "\r\n" in content else "\n"


def _exact_match_replace(content: str, search: str, replace: str) -> tuple[Optional[str], bool]:
    """Level 1: Exact substring match."""
    if search in content:
        # Replace only the first occurrence for safety
        return content.replace(search, replace, 1), True
    return None, False


def _line_ending_normalized_replace(content: str, search: str, replace: str) -> tuple[Optional[str], bool]:
    """Level 2: Normalize line endings to LF, match, and restore dominant line ending."""
    content_lf = content.replace("\r\n", "\n")
    search_lf = search.replace("\r\n", "\n")
    replace_lf = replace.replace("\r\n", "\n")

    if search_lf in content_lf:
        patched_lf = content_lf.replace(search_lf, replace_lf, 1)
        # Restore detected original line ending
        delim = _detect_line_ending(content)
        if delim == "\r\n":
            return patched_lf.replace("\n", "\r\n"), True
        return patched_lf, True

    return None, False


def _whitespace_tolerant_replace(content: str, search: str, replace: str) -> tuple[Optional[str], bool]:
    """
    Level 3: Match lines ignoring trailing whitespace differences.
    """
    delim = _detect_line_ending(content)
    content_lines = content.replace("\r\n", "\n").split("\n")
    search_lines = search.replace("\r\n", "\n").split("\n")
    replace_lines = replace.replace("\r\n", "\n").split("\n")

    if not search_lines or len(search_lines) > len(content_lines):
        return None, False

    search_trimmed = [line.rstrip() for line in search_lines]
    num_search = len(search_trimmed)

    for i in range(len(content_lines) - num_search + 1):
        window = [content_lines[i + j].rstrip() for j in range(num_search)]
        if window == search_trimmed:
            # Match found! Replace content_lines[i : i + num_search] with replace_lines
            new_lines = content_lines[:i] + replace_lines + content_lines[i + num_search:]
            result = "\n".join(new_lines)
            if delim == "\r\n":
                result = result.replace("\n", "\r\n")
            return result, True

    return None, False


def _indentation_tolerant_replace(content: str, search: str, replace: str) -> tuple[Optional[str], bool]:
    """
    Level 4: Indentation-flexible match.
    Matches lines when stripped of leading and trailing whitespace,
    and applies proportional indentation to replacement lines.
    """
    delim = _detect_line_ending(content)
    content_lines = content.replace("\r\n", "\n").split("\n")
    search_lines = search.replace("\r\n", "\n").split("\n")
    replace_lines = replace.replace("\r\n", "\n").split("\n")

    if not search_lines or len(search_lines) > len(content_lines):
        return None, False

    search_stripped = [line.strip() for line in search_lines]
    # Guard against matching empty blocks
    if not any(search_stripped):
        return None, False

    num_search = len(search_stripped)

    for i in range(len(content_lines) - num_search + 1):
        window_stripped = [content_lines[i + j].strip() for j in range(num_search)]
        if window_stripped == search_stripped:
            # Measure target indentation from first matched line in content
            target_indent = len(content_lines[i]) - len(content_lines[i].lstrip())
            search_first_indent = len(search_lines[0]) - len(search_lines[0].lstrip())
            indent_delta = target_indent - search_first_indent

            adapted_replace_lines = []
            for r_line in replace_lines:
                if not r_line.strip():
                    adapted_replace_lines.append("")
                else:
                    curr_indent = len(r_line) - len(r_line.lstrip())
                    new_indent = max(0, curr_indent + indent_delta)
                    adapted_replace_lines.append(" " * new_indent + r_line.strip())

            new_lines = content_lines[:i] + adapted_replace_lines + content_lines[i + num_search:]
            result = "\n".join(new_lines)
            if delim == "\r\n":
                result = result.replace("\n", "\r\n")
            return result, True

    return None, False


def apply_single_block(content: str, search: str, replace: str) -> tuple[str, bool, str]:
    """
    Attempts to apply a single search/replace block using multi-level matching:
    Returns (new_content, success, strategy_used).
    """
    if not search:
        # Edge case: empty search block cannot be matched
        return content, False, "empty_search"

    # Level 1: Exact match
    res, ok = _exact_match_replace(content, search, replace)
    if ok and res is not None:
        return res, True, "exact_match"

    # Level 2: Line-ending normalized match (CRLF / LF)
    res, ok = _line_ending_normalized_replace(content, search, replace)
    if ok and res is not None:
        return res, True, "line_ending_normalized"

    # Level 3: Trailing whitespace-tolerant match
    res, ok = _whitespace_tolerant_replace(content, search, replace)
    if ok and res is not None:
        return res, True, "whitespace_tolerant"

    # Level 4: Indentation-flexible match
    res, ok = _indentation_tolerant_replace(content, search, replace)
    if ok and res is not None:
        return res, True, "indentation_flexible"

    return content, False, "no_match_found"


def apply_search_replace_blocks(
    original_content: str,
    blocks: Union[list[dict[str, str]], str],
) -> tuple[str, bool, list[str]]:
    """
    Applies a series of search/replace diff blocks sequentially to original_content.

    Returns:
    - patched_content (str)
    - all_successful (bool)
    - log_messages (list[str])
    """
    if isinstance(blocks, str):
        parsed = parse_search_replace_text(blocks)
        if not parsed:
            # String didn't have search/replace markers, treat as full replacement or invalid
            return original_content, False, ["No SEARCH/REPLACE blocks found in diff string."]
        blocks = parsed

    if not blocks:
        return original_content, True, ["No diff blocks to apply."]

    current_content = original_content
    logs: list[str] = []
    all_ok = True

    for idx, block in enumerate(blocks, start=1):
        search_str = block.get("search", "")
        replace_str = block.get("replace", "")

        new_content, ok, strategy = apply_single_block(current_content, search_str, replace_str)
        if ok:
            current_content = new_content
            logs.append(f"Block #{idx}: Applied successfully using '{strategy}'.")
            logger.debug("Diff Block #%d applied via %s", idx, strategy)
        else:
            all_ok = False
            first_line = search_str.strip().splitlines()[0] if search_str.strip() else "(empty)"
            error_msg = f"Block #{idx} FAILED: Target block starting with '{first_line[:40]}' not matched in file."
            logs.append(error_msg)
            logger.warning("Diff Block #%d failed to match: %s", idx, error_msg)

    return current_content, all_ok, logs


def apply_file_patch(
    original_content: str,
    patch_dict: dict,
) -> tuple[str, bool, list[str]]:
    """
    High-level entry point to patch an existing file:
    1. If patch_dict has 'diff_blocks': applies Search/Replace blocks.
    2. If patch_dict has 'content' containing <<<<<<< SEARCH: parses and applies.
    3. If patch_dict has 'content' without markers: uses content as whole replacement (backward compatibility).
    4. If patch_dict has neither: returns original content.
    """
    diff_blocks = patch_dict.get("diff_blocks")
    raw_content = patch_dict.get("content")

    # Case 1: Structured diff_blocks array
    if diff_blocks and isinstance(diff_blocks, list) and len(diff_blocks) > 0:
        return apply_search_replace_blocks(original_content, diff_blocks)

    # Case 2: Content string contains markdown Search/Replace markers
    if raw_content and isinstance(raw_content, str) and "<<<<<<< SEARCH" in raw_content:
        return apply_search_replace_blocks(original_content, raw_content)

    # Case 3: Whole-file content provided (backward compatibility)
    if raw_content and isinstance(raw_content, str):
        return raw_content, True, ["Applied as whole-file replacement (fallback mode)."]

    # Case 4: No valid patch instructions found
    return original_content, False, ["No diff_blocks or valid content found in patch object."]
