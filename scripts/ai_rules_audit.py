"""
AI Rules Semantic Auditor.

Uses AI to analyze git diffs for rule violations and risk classification.
Detects weakening of CI/CD gates, security downgrades,
and AI provider abstraction violations.

Behavior:
- AI detects rule violations -> PR blocked (exit 1)
- AI call fails -> PR allowed (exit 0, fail-open)

Risk Classification:
- LOW: Formatting, lint, docs, comments (safe for auto-merge)
- MEDIUM: Minor logic changes, test updates
- HIGH: Business logic, API changes
- CRITICAL: Security, infrastructure, CI/CD changes
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# Add scripts directory to path for ai_engine import
sys.path.insert(0, str(Path(__file__).parent))

from ai_engine import ask_ai
from ai_metrics import record

# Output file for risk assessment (consumed by other workflows)
RISK_OUTPUT_FILE = "/tmp/ai_risk_assessment.json"


def get_diff() -> str:
    """Get git diff for analysis."""
    try:
        # Try to get diff from main branch
        return subprocess.check_output(
            ["git", "diff", "origin/main...HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode()
    except Exception:
        try:
            # Fallback to last commit diff
            return subprocess.check_output(
                ["git", "diff", "HEAD~1"],
                stderr=subprocess.DEVNULL,
            ).decode()
        except Exception:
            return ""


def write_risk_output(data: dict) -> None:
    """Write risk assessment to file for other workflows."""
    try:
        with open(RISK_OUTPUT_FILE, "w") as f:
            json.dump(data, f)
        # Also set GitHub output if available
        github_output = os.getenv("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write(f"risk_level={data.get('risk_level', 'UNKNOWN')}\n")
                f.write(f"safe_for_auto_merge={data.get('safe_for_auto_merge', False)}\n")
    except Exception as e:
        print(f"[WARNING] Could not write risk output: {e}")


def apply_risk_label(risk_level: str) -> None:
    """Apply risk label to PR via GitHub CLI."""
    pr_number = os.getenv("PR_NUMBER")
    if not pr_number:
        print("[WARNING] PR_NUMBER not set, skipping label.")
        return

    label = f"risk:{risk_level}"
    try:
        subprocess.run(
            ["gh", "pr", "edit", pr_number, "--add-label", label],
            check=True,
            capture_output=True,
        )
        print(f"[OK] Applied label: {label}")
    except Exception as e:
        print(f"[WARNING] Could not apply label: {e}")


def main() -> None:
    """Run AI semantic audit on git diff."""
    diff = get_diff()

    if not diff.strip():
        print("[OK] No changes to audit.")
        write_risk_output({"risk_level": "NONE", "safe_for_auto_merge": False})
        sys.exit(0)

    # Truncate diff if too large (token limits)
    max_diff_chars = 10000
    if len(diff) > max_diff_chars:
        diff = diff[:max_diff_chars] + "\n... [truncated]"

    prompt = f"""
You are an AI governance auditor.

Repository rules are defined in .ai/CLAUDE_RULES.md.

Analyze the following git diff and:
1. Check for rule violations
2. Classify the risk level

Risk Classification (STRICT):
- LOW: ONLY formatting, lint fixes, docs, comments, whitespace
- MEDIUM: Minor logic changes, test updates, non-critical refactoring
- HIGH: Business logic, API changes, new features
- CRITICAL: Security, infrastructure, CI/CD, authentication, database

LOW means:
- No business logic change
- No security impact
- No infra or CI/CD weakening
- Pure cosmetic / formatting / documentation

Respond STRICTLY in JSON:
{{
  "violation": true|false,
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "explanation": "Brief explanation of the changes",
  "safe_for_auto_merge": true|false
}}

IMPORTANT: safe_for_auto_merge should ONLY be true if:
- risk_level is "LOW"
- violation is false
- Changes are purely cosmetic/formatting/docs

Git diff:
{diff}
"""

    try:
        response = ask_ai(prompt)
        print(response)

        # Parse JSON response
        try:
            # Extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(response[json_start:json_end])
            else:
                result = {}
        except json.JSONDecodeError:
            result = {}

        # Extract values with safe defaults
        violation = result.get("violation", False)
        risk_level = result.get("risk_level", "HIGH")  # Default to HIGH if uncertain
        safe_for_auto_merge = result.get("safe_for_auto_merge", False)

        # Safety override: Never auto-merge if violation or high risk
        if violation or risk_level in ("MEDIUM", "HIGH", "CRITICAL"):
            safe_for_auto_merge = False

        # Write output for other workflows
        write_risk_output({
            "violation": violation,
            "risk_level": risk_level,
            "safe_for_auto_merge": safe_for_auto_merge,
            "explanation": result.get("explanation", ""),
        })

        # Apply risk label
        apply_risk_label(risk_level)

        # Record metrics
        pr_number = os.getenv("PR_NUMBER", "")
        record(
            event="risk_classified",
            details=result.get("explanation", ""),
            pr_number=pr_number,
            risk_level=risk_level,
        )

        # Check for violation
        if violation:
            record(
                event="rule_violation_detected",
                details=result.get("explanation", ""),
                pr_number=pr_number,
                risk_level=risk_level,
            )
            print("\n[ERROR] AI RULE VIOLATION DETECTED")
            sys.exit(1)

        # Record auto-merge eligibility
        if safe_for_auto_merge:
            record(
                event="auto_merge_enabled",
                details="LOW risk PR eligible for auto-merge",
                pr_number=pr_number,
                risk_level=risk_level,
            )

        print(f"\n[OK] Risk level: {risk_level}")
        print(f"[OK] Safe for auto-merge: {safe_for_auto_merge}")
        sys.exit(0)

    except Exception as e:
        # Fail-open: AI failures don't block PR
        print("[WARNING] AI audit failed, falling back to human review.")
        print(f"Error: {e}")
        write_risk_output({
            "risk_level": "UNKNOWN",
            "safe_for_auto_merge": False,
            "error": str(e),
        })
        sys.exit(0)


if __name__ == "__main__":
    main()
