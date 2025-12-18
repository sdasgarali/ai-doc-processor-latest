"""
Policy Engine - Configurable Auto-Merge Decisions.

Reads policy from .ai/AUTO_MERGE_POLICY.yaml.
Security can change policy without code changes.
"""

import fnmatch
from pathlib import Path
from typing import Any

import yaml

POLICY_FILE = Path(__file__).parent.parent / ".ai" / "AUTO_MERGE_POLICY.yaml"


class PolicyError(Exception):
    """Policy configuration error."""

    pass


def load_policy() -> dict[str, Any]:
    """Load auto-merge policy from YAML file."""
    if not POLICY_FILE.exists():
        raise PolicyError(
            f"Auto-merge policy missing: {POLICY_FILE}\n"
            "Create .ai/AUTO_MERGE_POLICY.yaml to enable policy-driven auto-merge."
        )

    try:
        content = POLICY_FILE.read_text(encoding="utf-8")
        policy = yaml.safe_load(content)
        if not policy or "auto_merge" not in policy:
            raise PolicyError("Invalid policy file: missing 'auto_merge' section")
        return policy
    except yaml.YAMLError as e:
        raise PolicyError(f"Invalid YAML in policy file: {e}") from e


def is_file_blocked(filepath: str, blocked_patterns: list[str]) -> bool:
    """Check if a file matches any blocked pattern."""
    for pattern in blocked_patterns:
        if fnmatch.fnmatch(filepath, pattern):
            return True
        # Also check if path starts with pattern (for directory patterns)
        clean_pattern = pattern.replace("*", "").replace("**", "").rstrip("/")
        if clean_pattern and filepath.startswith(clean_pattern):
            return True
    return False


def is_auto_merge_allowed(ai_result: dict[str, Any]) -> tuple[bool, str]:
    """
    Determine if auto-merge is allowed based on policy.

    Args:
        ai_result: Dictionary containing:
            - risk_level: str (LOW/MEDIUM/HIGH/CRITICAL)
            - confidence: float (0.0 - 1.0)
            - category: str (formatting/lint/tests/docs/etc.)
            - touched_files: list[str]
            - lines_changed: int (optional)
            - files_changed: int (optional)

    Returns:
        Tuple of (allowed: bool, reason: str)
    """
    try:
        policy = load_policy()["auto_merge"]
    except PolicyError as e:
        return False, f"Policy error: {e}"

    # Check master switch
    if not policy.get("enabled", False):
        return False, "Auto-merge is disabled in policy"

    # Check risk level
    risk_level = ai_result.get("risk_level", "UNKNOWN")
    max_risk = policy.get("max_risk", "LOW")
    if risk_level != max_risk:
        return False, f"Risk level {risk_level} exceeds max allowed ({max_risk})"

    # Check AI confidence
    confidence = ai_result.get("confidence", 0.0)
    min_confidence = policy.get("require_ai_confidence", 0.85)
    if confidence < min_confidence:
        return False, f"AI confidence {confidence:.2f} below threshold ({min_confidence})"

    # Check category
    category = ai_result.get("category", "unknown")
    allowed_categories = policy.get("allowed_categories", [])
    if allowed_categories and category not in allowed_categories:
        return False, f"Category '{category}' not in allowed list"

    # Check blocked files
    touched_files = ai_result.get("touched_files", [])
    blocked_patterns = policy.get("blocked_files", [])
    for filepath in touched_files:
        if is_file_blocked(filepath, blocked_patterns):
            return False, f"File '{filepath}' matches blocked pattern"

    # Check file count limit
    max_files = policy.get("max_files_changed", 10)
    files_changed = ai_result.get("files_changed", len(touched_files))
    if files_changed > max_files:
        return False, f"Too many files changed ({files_changed} > {max_files})"

    # Check lines changed limit
    max_lines = policy.get("max_lines_changed", 100)
    lines_changed = ai_result.get("lines_changed", 0)
    if lines_changed > max_lines:
        return False, f"Too many lines changed ({lines_changed} > {max_lines})"

    return True, "All policy checks passed"


def get_policy_summary() -> dict[str, Any]:
    """Get a summary of current policy settings."""
    try:
        policy = load_policy()
        auto_merge = policy.get("auto_merge", {})
        return {
            "enabled": auto_merge.get("enabled", False),
            "max_risk": auto_merge.get("max_risk", "LOW"),
            "min_confidence": auto_merge.get("require_ai_confidence", 0.85),
            "allowed_categories": auto_merge.get("allowed_categories", []),
            "blocked_patterns": len(auto_merge.get("blocked_files", [])),
            "max_files": auto_merge.get("max_files_changed", 10),
            "max_lines": auto_merge.get("max_lines_changed", 100),
        }
    except PolicyError:
        return {"error": "Policy file not found or invalid"}


if __name__ == "__main__":
    # Test the policy engine
    print("Policy Engine Test")
    print("=" * 40)

    summary = get_policy_summary()
    print(f"Policy Summary: {summary}")

    # Test case: LOW risk, formatting change
    test_result = {
        "risk_level": "LOW",
        "confidence": 0.95,
        "category": "formatting",
        "touched_files": ["src/utils.py"],
        "files_changed": 1,
        "lines_changed": 10,
    }

    allowed, reason = is_auto_merge_allowed(test_result)
    print("\nTest Case 1 (LOW risk formatting):")
    print(f"  Allowed: {allowed}")
    print(f"  Reason: {reason}")

    # Test case: MEDIUM risk
    test_result2 = {
        "risk_level": "MEDIUM",
        "confidence": 0.95,
        "category": "feature",
        "touched_files": ["src/api.py"],
    }

    allowed2, reason2 = is_auto_merge_allowed(test_result2)
    print("\nTest Case 2 (MEDIUM risk):")
    print(f"  Allowed: {allowed2}")
    print(f"  Reason: {reason2}")

    # Test case: Blocked file
    test_result3 = {
        "risk_level": "LOW",
        "confidence": 0.95,
        "category": "docs",
        "touched_files": [".github/workflows/ci.yml"],
    }

    allowed3, reason3 = is_auto_merge_allowed(test_result3)
    print("\nTest Case 3 (Blocked file):")
    print(f"  Allowed: {allowed3}")
    print(f"  Reason: {reason3}")
