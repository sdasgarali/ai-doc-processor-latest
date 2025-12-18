#!/usr/bin/env python3
"""
HIPAA Compliance Report Generator.

Generates HIPAA compliance reports from safeguards mapping, risk assessment,
and evidence collection data.

Usage:
    # Generate summary report
    python scripts/generate_hipaa_report.py

    # Generate detailed report
    python scripts/generate_hipaa_report.py --detailed

    # Output to file
    python scripts/generate_hipaa_report.py --output reports/hipaa_report.md

    # Check compliance status
    python scripts/generate_hipaa_report.py --status

    # Validate safeguards mapping
    python scripts/generate_hipaa_report.py --validate
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).parent.parent
HIPAA_DIR = REPO_ROOT / ".ai" / "COMPLIANCE" / "HIPAA"
SAFEGUARDS_FILE = HIPAA_DIR / "HIPAA_SAFEGUARDS.yaml"
RISK_FILE = HIPAA_DIR / "HIPAA_RISK_ASSESSMENT.yaml"
EVIDENCE_FILE = HIPAA_DIR / "HIPAA_EVIDENCE.yaml"


def load_yaml_safe(filepath: Path) -> dict[str, Any]:
    """Load YAML file if it exists."""
    if filepath.exists():
        return yaml.safe_load(filepath.read_text(encoding="utf-8")) or {}
    return {}


def get_safeguards_summary() -> dict[str, Any]:
    """Get summary of HIPAA safeguards implementation."""
    data = load_yaml_safe(SAFEGUARDS_FILE)

    admin = data.get("administrative_safeguards", {})
    physical = data.get("physical_safeguards", {})
    technical = data.get("technical_safeguards", {})

    implemented = 0
    not_applicable = 0
    total = 0

    for safeguard in list(admin.values()) + list(physical.values()) + list(technical.values()):
        total += 1
        status = safeguard.get("status", "Unknown")
        if status == "Implemented":
            implemented += 1
        elif status == "Not Applicable":
            not_applicable += 1

    return {
        "total": total,
        "implemented": implemented,
        "not_applicable": not_applicable,
        "gaps": total - implemented - not_applicable,
        "coverage": f"{(implemented / (total - not_applicable)) * 100:.1f}%" if (total - not_applicable) > 0 else "N/A",
        "administrative_count": len(admin),
        "physical_count": len(physical),
        "technical_count": len(technical),
    }


def get_risk_summary() -> dict[str, Any]:
    """Get summary of HIPAA risk assessment."""
    data = load_yaml_safe(RISK_FILE)

    risks = data.get("risk_assessment", [])

    by_level = {"High": 0, "Medium": 0, "Low": 0}
    by_status = {"Mitigated": 0, "Accepted": 0, "Open": 0}

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
        "high_risks": by_level["High"],
        "open_risks": by_status["Open"],
    }


def get_evidence_summary() -> dict[str, Any]:
    """Get summary of evidence collection."""
    data = load_yaml_safe(EVIDENCE_FILE)

    evidence_log = data.get("evidence_log", [])

    by_safeguard: dict[str, int] = {}
    for entry in evidence_log:
        safeguard = entry.get("safeguard", "Unknown")
        by_safeguard[safeguard] = by_safeguard.get(safeguard, 0) + 1

    return {
        "total_entries": len(evidence_log),
        "safeguards_covered": len(by_safeguard),
        "by_safeguard": by_safeguard,
    }


def validate_safeguards() -> list[str]:
    """Validate safeguards mapping for completeness."""
    issues = []
    data = load_yaml_safe(SAFEGUARDS_FILE)

    required_admin = [
        "164.308(a)(1)", "164.308(a)(2)", "164.308(a)(3)", "164.308(a)(4)",
        "164.308(a)(5)", "164.308(a)(6)", "164.308(a)(7)", "164.308(a)(8)",
    ]
    required_technical = [
        "164.312(a)(1)", "164.312(b)", "164.312(c)(1)", "164.312(d)", "164.312(e)(1)",
    ]

    admin = data.get("administrative_safeguards", {})
    technical = data.get("technical_safeguards", {})

    for req in required_admin:
        if req not in admin:
            issues.append(f"Missing administrative safeguard: {req}")
        elif not admin[req].get("evidence"):
            issues.append(f"No evidence for {req}")

    for req in required_technical:
        if req not in technical:
            issues.append(f"Missing technical safeguard: {req}")
        elif not technical[req].get("evidence"):
            issues.append(f"No evidence for {req}")

    return issues


def generate_status_report() -> str:
    """Generate quick status report."""
    safeguards = get_safeguards_summary()
    risks = get_risk_summary()
    evidence = get_evidence_summary()

    lines = [
        "HIPAA Compliance Status",
        "=" * 50,
        "",
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "",
        "SAFEGUARDS",
        "-" * 30,
        f"  Total: {safeguards['total']}",
        f"  Implemented: {safeguards['implemented']}",
        f"  Not Applicable: {safeguards['not_applicable']}",
        f"  Coverage: {safeguards['coverage']}",
        "",
        "RISK ASSESSMENT",
        "-" * 30,
        f"  Total Risks: {risks['total_risks']}",
        f"  High: {risks['by_level']['High']}",
        f"  Medium: {risks['by_level']['Medium']}",
        f"  Low: {risks['by_level']['Low']}",
        f"  Open Risks: {risks['open_risks']}",
        "",
        "EVIDENCE",
        "-" * 30,
        f"  Total Entries: {evidence['total_entries']}",
        f"  Safeguards Covered: {evidence['safeguards_covered']}",
        "",
    ]

    # Overall status
    if safeguards["gaps"] == 0 and risks["high_risks"] == 0 and risks["open_risks"] == 0:
        lines.append("[OK] HIPAA compliance status: COMPLIANT")
    elif risks["high_risks"] > 0 or risks["open_risks"] > 0:
        lines.append("[!] HIPAA compliance status: ATTENTION REQUIRED")
    else:
        lines.append("[~] HIPAA compliance status: PARTIAL")

    return "\n".join(lines)


def generate_detailed_report() -> str:
    """Generate detailed markdown report."""
    safeguards_data = load_yaml_safe(SAFEGUARDS_FILE)
    risks_data = load_yaml_safe(RISK_FILE)

    safeguards = get_safeguards_summary()
    risks = get_risk_summary()
    evidence = get_evidence_summary()

    lines = [
        "# HIPAA Compliance Report",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "**Framework:** HIPAA Security Rule (45 CFR Part 164)",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        "| Category | Status |",
        "|----------|--------|",
        f"| Safeguards Implemented | {safeguards['implemented']}/{safeguards['total']} |",
        f"| Coverage | {safeguards['coverage']} |",
        f"| High Risks | {risks['high_risks']} |",
        f"| Open Risks | {risks['open_risks']} |",
        f"| Evidence Entries | {evidence['total_entries']} |",
        "",
        "---",
        "",
        "## Administrative Safeguards",
        "",
    ]

    admin = safeguards_data.get("administrative_safeguards", {})
    for ref, data in admin.items():
        status_icon = "[+]" if data.get("status") == "Implemented" else "[-]"
        lines.append(f"### {status_icon} {ref} - {data.get('title', 'Unknown')}")
        lines.append("")
        lines.append(f"**Status:** {data.get('status', 'Unknown')}")
        lines.append("")

        impl = data.get("implemented_by", [])
        if impl:
            lines.append("**Implementation:**")
            for item in impl:
                lines.append(f"- {item}")
            lines.append("")

    lines.extend([
        "---",
        "",
        "## Technical Safeguards",
        "",
    ])

    technical = safeguards_data.get("technical_safeguards", {})
    for ref, data in technical.items():
        status_icon = "[+]" if data.get("status") == "Implemented" else "[-]"
        lines.append(f"### {status_icon} {ref} - {data.get('title', 'Unknown')}")
        lines.append("")
        lines.append(f"**Status:** {data.get('status', 'Unknown')}")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## Risk Assessment",
        "",
        "| Risk ID | Title | Level | Status |",
        "|---------|-------|-------|--------|",
    ])

    for risk in risks_data.get("risk_assessment", []):
        lines.append(
            f"| {risk.get('id', 'N/A')} | {risk.get('title', 'Unknown')[:40]} | "
            f"{risk.get('risk_level', 'Unknown')} | {risk.get('status', 'Unknown')} |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## Evidence Summary",
        "",
        "| Safeguard | Evidence Count |",
        "|-----------|----------------|",
    ])

    for safeguard, count in sorted(evidence["by_safeguard"].items()):
        lines.append(f"| {safeguard} | {count} |")

    lines.extend([
        "",
        "---",
        "",
        "*This report is auto-generated from HIPAA compliance data.*",
    ])

    return "\n".join(lines)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="HIPAA Compliance Report Generator"
    )
    parser.add_argument(
        "--status", "-s",
        action="store_true",
        help="Show quick status",
    )
    parser.add_argument(
        "--detailed", "-d",
        action="store_true",
        help="Generate detailed report",
    )
    parser.add_argument(
        "--validate", "-v",
        action="store_true",
        help="Validate safeguards mapping",
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path",
    )

    args = parser.parse_args()

    # Validation mode
    if args.validate:
        print("HIPAA Safeguards Validation")
        print("=" * 50)
        issues = validate_safeguards()
        if issues:
            for issue in issues:
                print(f"  [!] {issue}")
            print(f"\n{len(issues)} issue(s) found")
            return 1
        else:
            print("[OK] All required safeguards are documented")
            return 0

    # Generate report
    if args.detailed:
        report = generate_detailed_report()
    else:
        report = generate_status_report()

    # Output
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"[OK] Report saved to: {args.output}")
    else:
        print(report)

    print()
    print("[OK] HIPAA compliance artifacts are maintained via YAML mappings.")
    print("Evidence is continuously collected via CI/CD and AI governance.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
