#!/usr/bin/env python3
"""
Audit Answer Generator.

Generates consistent, evidence-backed answers to common audit questions.
Reads from .ai/COMPLIANCE/CONTROL_EVIDENCE.yaml.

Usage:
    python scripts/generate_audit_answers.py
    python scripts/generate_audit_answers.py --framework SOC2
    python scripts/generate_audit_answers.py --output answers.md
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

EVIDENCE_FILE = Path(__file__).parent.parent / ".ai" / "COMPLIANCE" / "CONTROL_EVIDENCE.yaml"


def load_evidence() -> dict[str, Any]:
    """Load control evidence questionnaire."""
    if not EVIDENCE_FILE.exists():
        raise FileNotFoundError(f"Evidence file not found: {EVIDENCE_FILE}")

    return yaml.safe_load(EVIDENCE_FILE.read_text(encoding="utf-8"))


def format_answer_text(question: dict[str, Any]) -> str:
    """Format a single Q&A as text."""
    lines = [
        f"Q: {question['question']}",
        "",
        "A:",
    ]

    for answer_line in question.get("answer", []):
        lines.append(f"  - {answer_line}")

    lines.append("")
    evidence_list = ", ".join(question.get("evidence", []))
    lines.append(f"Evidence: {evidence_list}")
    lines.append("")
    lines.append(f"Framework: {question.get('framework', 'N/A')} | Control: {question.get('control', 'N/A')}")
    lines.append("-" * 60)

    return "\n".join(lines)


def format_answer_markdown(question: dict[str, Any]) -> str:
    """Format a single Q&A as markdown."""
    lines = [
        f"### {question['id']}",
        "",
        f"**Framework:** {question.get('framework', 'N/A')} | **Control:** {question.get('control', 'N/A')}",
        "",
        f"**Q:** {question['question']}",
        "",
        "**A:**",
    ]

    for answer_line in question.get("answer", []):
        lines.append(f"- {answer_line}")

    lines.append("")
    lines.append("**Evidence:**")
    for evidence_file in question.get("evidence", []):
        lines.append(f"- `{evidence_file}`")

    lines.append("")

    return "\n".join(lines)


def generate_answers(
    data: dict[str, Any],
    framework_filter: str | None = None,
    output_format: str = "text",
) -> str:
    """Generate formatted audit answers."""
    questions = data.get("questions", [])

    if framework_filter:
        questions = [q for q in questions if q.get("framework", "").upper() == framework_filter.upper()]

    if not questions:
        return "No questions found matching the criteria."

    if output_format == "markdown":
        header = [
            "# Audit Questionnaire Answers",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            f"Total Questions: {len(questions)}",
            "",
            "---",
            "",
        ]
        formatted = [format_answer_markdown(q) for q in questions]
        return "\n".join(header + formatted)
    else:
        header = [
            "=" * 60,
            "AUDIT QUESTIONNAIRE ANSWERS",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Questions: {len(questions)}",
            "=" * 60,
            "",
        ]
        formatted = [format_answer_text(q) for q in questions]
        return "\n".join(header + formatted)


def generate_summary(data: dict[str, Any]) -> str:
    """Generate a summary of the audit questionnaire."""
    questions = data.get("questions", [])

    # Count by framework
    frameworks: dict[str, int] = {}
    for q in questions:
        fw = q.get("framework", "Unknown")
        frameworks[fw] = frameworks.get(fw, 0) + 1

    lines = [
        "=" * 60,
        "AUDIT QUESTIONNAIRE SUMMARY",
        "=" * 60,
        "",
        f"Total Questions: {len(questions)}",
        "",
        "Questions by Framework:",
    ]

    for fw, count in sorted(frameworks.items()):
        lines.append(f"  - {fw}: {count}")

    lines.extend([
        "",
        "Evidence Files Referenced:",
    ])

    # Collect all evidence files
    evidence_files: set[str] = set()
    for q in questions:
        evidence_files.update(q.get("evidence", []))

    for ef in sorted(evidence_files):
        lines.append(f"  - {ef}")

    lines.extend([
        "",
        "=" * 60,
    ])

    return "\n".join(lines)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate audit questionnaire answers"
    )
    parser.add_argument(
        "--framework",
        "-f",
        type=str,
        help="Filter by framework (SOC2, ISO27001, Custom)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file (default: stdout)",
    )
    parser.add_argument(
        "--format",
        type=str,
        choices=["text", "markdown"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--summary",
        "-s",
        action="store_true",
        help="Show summary only",
    )

    args = parser.parse_args()

    try:
        data = load_evidence()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if args.summary:
        output = generate_summary(data)
    else:
        output = generate_answers(
            data,
            framework_filter=args.framework,
            output_format=args.format,
        )

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        print(f"[OK] Output written to: {args.output}")
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
