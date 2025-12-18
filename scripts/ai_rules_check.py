"""
AI Rules Compliance Checker.

Pre-commit hook to verify .ai/CLAUDE_RULES.md exists and contains
all mandatory concepts required for the CI/CD template.
"""

import sys
from pathlib import Path

RULES_FILE = Path(".ai/CLAUDE_RULES.md")

MANDATORY_PHRASES = [
    "CI/CD",
    "AI provider",
    "Security",
    "Coverage",
    "Fail-open",
    "Fail-closed",
]


def main() -> None:
    """Validate AI rules file exists and contains required concepts."""
    if not RULES_FILE.exists():
        print("[ERROR] .ai/CLAUDE_RULES.md is missing.")
        sys.exit(1)

    content = RULES_FILE.read_text(encoding="utf-8")

    missing = [p for p in MANDATORY_PHRASES if p.lower() not in content.lower()]

    if missing:
        print("[ERROR] CLAUDE_RULES.md is missing required concepts:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)

    print("[OK] AI rules file present and validated.")
    sys.exit(0)


if __name__ == "__main__":
    main()
