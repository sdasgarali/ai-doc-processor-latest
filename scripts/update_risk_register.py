#!/usr/bin/env python3
"""
ISO 27001 Risk Register Manager.

Validates, updates, and reports on the risk register.

Usage:
    # Validate risk register
    python scripts/update_risk_register.py --validate

    # Generate report
    python scripts/update_risk_register.py --report

    # Check for overdue reviews
    python scripts/update_risk_register.py --check-reviews

    # Update a risk status
    python scripts/update_risk_register.py --update R-001 --status Mitigated

    # Show summary
    python scripts/update_risk_register.py --summary
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

RISK_REGISTER = Path(__file__).parent.parent / ".ai" / "COMPLIANCE" / "ISO_RISK_REGISTER.yaml"


def load_risk_register() -> dict[str, Any]:
    """Load the risk register."""
    if not RISK_REGISTER.exists():
        raise FileNotFoundError(f"Risk register not found: {RISK_REGISTER}")

    return yaml.safe_load(RISK_REGISTER.read_text(encoding="utf-8"))


def save_risk_register(data: dict[str, Any]) -> None:
    """Save the risk register."""
    data["summary"]["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")

    with open(RISK_REGISTER, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)


def validate_register(data: dict[str, Any]) -> list[str]:
    """Validate risk register entries."""
    issues = []
    risks = data.get("risks", [])

    valid_levels = ["Low", "Medium", "High"]
    valid_statuses = ["Mitigated", "Accepted", "Open", "Transferred"]

    for risk in risks:
        risk_id = risk.get("id", "UNKNOWN")

        # Check required fields
        required = ["id", "title", "asset", "threat", "likelihood", "impact", "risk_level", "status"]
        for field in required:
            if not risk.get(field):
                issues.append(f"{risk_id}: Missing required field '{field}'")

        # Check risk level validity
        if risk.get("risk_level") not in valid_levels:
            issues.append(f"{risk_id}: Invalid risk_level '{risk.get('risk_level')}'")

        # Check status validity
        if risk.get("status") not in valid_statuses:
            issues.append(f"{risk_id}: Invalid status '{risk.get('status')}'")

        # Check for controls on non-accepted risks
        if risk.get("status") != "Accepted" and not risk.get("controls"):
            issues.append(f"{risk_id}: Non-accepted risk has no controls defined")

        # Flag high risks that are accepted
        if risk.get("risk_level") == "High" and risk.get("status") == "Accepted":
            issues.append(f"[!] {risk_id}: High risk is ACCEPTED - requires management review")

    return issues


def check_review_dates(data: dict[str, Any]) -> list[str]:
    """Check for overdue risk reviews."""
    alerts = []
    risks = data.get("risks", [])
    today = datetime.utcnow().date()

    for risk in risks:
        risk_id = risk.get("id", "UNKNOWN")
        review_date_str = risk.get("review_date")

        if review_date_str:
            try:
                review_date = datetime.strptime(review_date_str, "%Y-%m-%d").date()
                days_since = (today - review_date).days

                if days_since > 90:
                    alerts.append(f"{risk_id}: Review overdue by {days_since - 90} days")
                elif days_since > 60:
                    alerts.append(f"{risk_id}: Review due in {90 - days_since} days")
            except ValueError:
                alerts.append(f"{risk_id}: Invalid review_date format")
        else:
            alerts.append(f"{risk_id}: No review_date set")

    return alerts


def get_summary(data: dict[str, Any]) -> dict[str, Any]:
    """Get risk register summary."""
    risks = data.get("risks", [])

    by_level = {"High": 0, "Medium": 0, "Low": 0}
    by_status = {"Mitigated": 0, "Accepted": 0, "Open": 0, "Transferred": 0}

    for risk in risks:
        level = risk.get("risk_level", "Unknown")
        status = risk.get("status", "Unknown")

        if level in by_level:
            by_level[level] += 1
        if status in by_status:
            by_status[status] += 1

    return {
        "total_risks": len(risks),
        "by_level": by_level,
        "by_status": by_status,
    }


def generate_report(data: dict[str, Any]) -> str:
    """Generate risk register report."""
    metadata = data.get("metadata", {})
    risks = data.get("risks", [])
    summary = get_summary(data)

    lines = [
        "# ISO 27001 Risk Register Report",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"**Framework:** {metadata.get('framework', 'ISO 27001')}",
        f"**Last Review:** {metadata.get('last_review', 'N/A')}",
        f"**Next Review:** {metadata.get('next_review', 'N/A')}",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        f"- **Total Risks:** {summary['total_risks']}",
        f"- **High Risks:** {summary['by_level']['High']}",
        f"- **Medium Risks:** {summary['by_level']['Medium']}",
        f"- **Low Risks:** {summary['by_level']['Low']}",
        "",
        "### Risk Treatment Status",
        "",
        f"- **Mitigated:** {summary['by_status']['Mitigated']}",
        f"- **Accepted:** {summary['by_status']['Accepted']}",
        f"- **Open:** {summary['by_status']['Open']}",
        "",
        "---",
        "",
        "## Risk Register",
        "",
    ]

    # Sort by risk level (High first)
    level_order = {"High": 0, "Medium": 1, "Low": 2}
    sorted_risks = sorted(risks, key=lambda r: level_order.get(r.get("risk_level", "Low"), 3))

    for risk in sorted_risks:
        level = risk.get("risk_level", "Unknown")
        level_emoji = {"High": "!!!", "Medium": "!!", "Low": "!"}[level] if level in level_order else "?"

        lines.extend([
            f"### {level_emoji} {risk.get('id', 'N/A')} - {risk.get('title', 'Untitled')}",
            "",
            f"**Category:** {risk.get('category', 'N/A')}",
            f"**Asset:** {risk.get('asset', 'N/A')}",
            "",
            f"**Threat:** {risk.get('threat', 'N/A')}",
            "",
            "| Likelihood | Impact | Risk Score | Risk Level |",
            "|------------|--------|------------|------------|",
            f"| {risk.get('likelihood', 'N/A')} | {risk.get('impact', 'N/A')} | {risk.get('risk_score', 'N/A')} | **{level}** |",
            "",
            "**Controls:**",
        ])

        for control in risk.get("controls", []):
            lines.append(f"- {control}")

        lines.extend([
            "",
            f"**Treatment:** {risk.get('treatment', 'N/A')}",
            f"**Status:** {risk.get('status', 'N/A')}",
            f"**Residual Risk:** {risk.get('residual_risk', 'N/A')}",
            f"**Owner:** {risk.get('owner', 'N/A')}",
            "",
            "---",
            "",
        ])

    # Validation issues
    issues = validate_register(data)
    if issues:
        lines.extend([
            "## Validation Issues",
            "",
        ])
        for issue in issues:
            lines.append(f"- {issue}")
        lines.append("")

    # Review alerts
    alerts = check_review_dates(data)
    if alerts:
        lines.extend([
            "## Review Alerts",
            "",
        ])
        for alert in alerts:
            lines.append(f"- {alert}")
        lines.append("")

    lines.extend([
        "---",
        "",
        "*Risk reviews occur quarterly or after significant changes.*",
    ])

    return "\n".join(lines)


def update_risk_status(data: dict[str, Any], risk_id: str, new_status: str) -> bool:
    """Update a risk's status."""
    for risk in data.get("risks", []):
        if risk.get("id") == risk_id:
            old_status = risk.get("status")
            risk["status"] = new_status
            risk["review_date"] = datetime.utcnow().strftime("%Y-%m-%d")
            print(f"[OK] Updated {risk_id}: {old_status} -> {new_status}")
            return True

    print(f"[ERROR] Risk {risk_id} not found")
    return False


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="ISO 27001 Risk Register Manager"
    )
    parser.add_argument("--validate", "-v", action="store_true", help="Validate register")
    parser.add_argument("--report", "-r", action="store_true", help="Generate report")
    parser.add_argument("--check-reviews", action="store_true", help="Check review dates")
    parser.add_argument("--summary", "-s", action="store_true", help="Show summary")
    parser.add_argument("--update", "-u", help="Risk ID to update")
    parser.add_argument("--status", help="New status for update")
    parser.add_argument("--output", "-o", help="Output file for report")

    args = parser.parse_args()

    try:
        data = load_risk_register()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if args.validate:
        print("Risk Register Validation")
        print("=" * 40)
        issues = validate_register(data)
        if issues:
            for issue in issues:
                print(f"  {issue}")
            print(f"\n{len(issues)} issue(s) found")
            return 1
        else:
            print("[OK] Risk register is valid")
        return 0

    if args.check_reviews:
        print("Review Date Check")
        print("=" * 40)
        alerts = check_review_dates(data)
        if alerts:
            for alert in alerts:
                print(f"  {alert}")
        else:
            print("[OK] All reviews are current")
        return 0

    if args.summary:
        summary = get_summary(data)
        print("Risk Register Summary")
        print("=" * 40)
        print(f"Total Risks: {summary['total_risks']}")
        print("\nBy Level:")
        for level, count in summary["by_level"].items():
            print(f"  {level}: {count}")
        print("\nBy Status:")
        for status, count in summary["by_status"].items():
            if count > 0:
                print(f"  {status}: {count}")
        return 0

    if args.report:
        report = generate_report(data)
        if args.output:
            Path(args.output).write_text(report, encoding="utf-8")
            print(f"[OK] Report saved to: {args.output}")
        else:
            print(report)
        return 0

    if args.update:
        if not args.status:
            parser.error("--status required with --update")
        if update_risk_status(data, args.update, args.status):
            # Recalculate summary
            summary = get_summary(data)
            data["summary"] = {
                "total_risks": summary["total_risks"],
                "by_level": summary["by_level"],
                "by_status": summary["by_status"],
            }
            save_risk_register(data)
            return 0
        return 1

    # Default: validate
    issues = validate_register(data)
    if issues:
        print("[!] Validation issues found:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("[OK] Risk register validated")

    return 0


if __name__ == "__main__":
    sys.exit(main())
