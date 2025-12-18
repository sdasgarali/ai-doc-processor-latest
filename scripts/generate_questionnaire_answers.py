#!/usr/bin/env python3
"""
Security Questionnaire Answer Generator.

Generates formatted answers for common security questionnaires:
- SIG (Standardized Information Gathering)
- CAIQ (Consensus Assessment Initiative Questionnaire)

Usage:
    # List available questionnaires
    python scripts/generate_questionnaire_answers.py --list

    # Generate all SIG answers
    python scripts/generate_questionnaire_answers.py --questionnaire SIG

    # Generate CAIQ answers for specific category
    python scripts/generate_questionnaire_answers.py --questionnaire CAIQ --category "AI Governance"

    # Export to markdown
    python scripts/generate_questionnaire_answers.py --questionnaire SIG --output sig_answers.md

    # Search for questions containing keyword
    python scripts/generate_questionnaire_answers.py --search "risk management"
"""

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

QUESTIONNAIRES_DIR = Path(__file__).parent.parent / ".ai" / "COMPLIANCE" / "QUESTIONNAIRES"


def load_questionnaire(name: str) -> dict[str, Any]:
    """Load a questionnaire file."""
    filepath = QUESTIONNAIRES_DIR / f"{name}.yaml"
    if not filepath.exists():
        raise FileNotFoundError(f"Questionnaire not found: {filepath}")

    return yaml.safe_load(filepath.read_text(encoding="utf-8"))


def list_questionnaires() -> list[str]:
    """List available questionnaires."""
    if not QUESTIONNAIRES_DIR.exists():
        return []

    return [f.stem for f in QUESTIONNAIRES_DIR.glob("*.yaml")]


def get_categories(data: dict[str, Any], questionnaire_name: str) -> list[str]:
    """Get unique categories from a questionnaire."""
    questions = data.get(questionnaire_name, [])
    categories = set()
    for q in questions:
        if "category" in q:
            categories.add(q["category"])
    return sorted(categories)


def format_question_text(question: dict[str, Any]) -> str:
    """Format a single question for text output."""
    lines = [
        f"ID: {question.get('id', 'N/A')}",
        f"Category: {question.get('category', 'N/A')}",
        f"Status: {question.get('status', 'N/A')}",
        "",
        f"Q: {question.get('question', 'N/A')}",
        "",
        "A:",
        question.get("answer", "No answer provided").strip(),
        "",
    ]

    evidence = question.get("evidence", [])
    if evidence:
        lines.append("Evidence:")
        for e in evidence:
            lines.append(f"  - {e}")
        lines.append("")

    lines.append("-" * 60)
    return "\n".join(lines)


def format_question_markdown(question: dict[str, Any]) -> str:
    """Format a single question for markdown output."""
    lines = [
        f"### {question.get('id', 'N/A')} - {question.get('category', 'N/A')}",
        "",
        f"**Status:** {question.get('status', 'N/A')}",
        "",
        f"**Question:** {question.get('question', 'N/A')}",
        "",
        "**Answer:**",
        "",
        question.get("answer", "No answer provided").strip(),
        "",
    ]

    evidence = question.get("evidence", [])
    if evidence:
        lines.append("**Evidence:**")
        for e in evidence:
            lines.append(f"- `{e}`")
        lines.append("")

    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def generate_output(
    data: dict[str, Any],
    questionnaire_name: str,
    category: str | None = None,
    output_format: str = "text",
) -> str:
    """Generate formatted output for a questionnaire."""
    questions = data.get(questionnaire_name, [])

    # Filter by category if specified
    if category:
        questions = [q for q in questions if q.get("category") == category]

    if not questions:
        return "No questions found matching criteria."

    metadata = data.get("metadata", {})

    if output_format == "markdown":
        lines = [
            f"# {questionnaire_name} Questionnaire Answers",
            "",
            f"**Framework:** {metadata.get('framework', 'N/A')}",
            f"**Version:** {metadata.get('version', 'N/A')}",
            f"**Last Updated:** {metadata.get('last_updated', 'N/A')}",
            "",
            "---",
            "",
        ]

        # Group by category
        categories: dict[str, list[dict[str, Any]]] = {}
        for q in questions:
            cat = q.get("category", "Other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(q)

        for cat in sorted(categories.keys()):
            lines.append(f"## {cat}")
            lines.append("")
            for q in categories[cat]:
                lines.append(format_question_markdown(q))

        return "\n".join(lines)

    else:  # text format
        lines = [
            "=" * 60,
            f"{questionnaire_name} Questionnaire Answers",
            "=" * 60,
            f"Framework: {metadata.get('framework', 'N/A')}",
            f"Version: {metadata.get('version', 'N/A')}",
            f"Last Updated: {metadata.get('last_updated', 'N/A')}",
            f"Total Questions: {len(questions)}",
            "=" * 60,
            "",
        ]

        for q in questions:
            lines.append(format_question_text(q))

        return "\n".join(lines)


def search_questions(keyword: str) -> list[tuple[str, dict[str, Any]]]:
    """Search all questionnaires for questions containing keyword."""
    results = []
    keyword_lower = keyword.lower()

    for name in list_questionnaires():
        try:
            data = load_questionnaire(name)
            questions = data.get(name, [])
            for q in questions:
                question_text = q.get("question", "").lower()
                answer_text = q.get("answer", "").lower()
                category = q.get("category", "").lower()

                if keyword_lower in question_text or keyword_lower in answer_text or keyword_lower in category:
                    results.append((name, q))
        except (FileNotFoundError, yaml.YAMLError):
            continue

    return results


def print_summary() -> None:
    """Print summary of all questionnaires."""
    questionnaires = list_questionnaires()

    print("Available Security Questionnaires")
    print("=" * 50)

    if not questionnaires:
        print("No questionnaires found.")
        return

    for name in questionnaires:
        try:
            data = load_questionnaire(name)
            metadata = data.get("metadata", {})
            questions = data.get(name, [])
            categories = get_categories(data, name)

            print(f"\n{name}")
            print("-" * len(name))
            print(f"  Framework: {metadata.get('framework', 'N/A')}")
            print(f"  Questions: {len(questions)}")
            print(f"  Categories: {len(categories)}")

            # Status summary
            implemented = sum(1 for q in questions if q.get("status") == "Implemented")
            print(f"  Implemented: {implemented}/{len(questions)}")
        except Exception as e:
            print(f"\n{name}: Error loading - {e}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Security Questionnaire Answer Generator"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available questionnaires",
    )
    parser.add_argument(
        "--questionnaire", "-q",
        help="Questionnaire name (SIG, CAIQ)",
    )
    parser.add_argument(
        "--category", "-c",
        help="Filter by category",
    )
    parser.add_argument(
        "--search", "-s",
        help="Search for questions containing keyword",
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file (enables markdown format)",
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "markdown"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--categories",
        action="store_true",
        help="List categories in a questionnaire",
    )

    args = parser.parse_args()

    # List questionnaires
    if args.list:
        print_summary()
        return 0

    # Search across all questionnaires
    if args.search:
        results = search_questions(args.search)
        print(f"Search Results for '{args.search}'")
        print("=" * 50)
        print(f"Found {len(results)} matching questions\n")

        for questionnaire, q in results:
            print(f"[{questionnaire}] {q.get('id', 'N/A')}")
            print(f"  Category: {q.get('category', 'N/A')}")
            print(f"  Q: {q.get('question', 'N/A')[:80]}...")
            print()

        return 0

    # Require questionnaire for other operations
    if not args.questionnaire:
        print("Error: --questionnaire required (use --list to see available)")
        return 1

    try:
        data = load_questionnaire(args.questionnaire)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    # List categories
    if args.categories:
        categories = get_categories(data, args.questionnaire)
        print(f"Categories in {args.questionnaire}:")
        for cat in categories:
            print(f"  - {cat}")
        return 0

    # Determine format
    output_format = args.format
    if args.output and args.output.endswith(".md"):
        output_format = "markdown"

    # Generate output
    output = generate_output(
        data,
        args.questionnaire,
        category=args.category,
        output_format=output_format,
    )

    # Write or print
    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        print(f"[OK] Output saved to: {args.output}")
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
