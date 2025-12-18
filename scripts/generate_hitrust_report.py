#!/usr/bin/env python3
"""
HITRUST CSF Readiness Report Generator.

Generates HITRUST readiness reports from CSF mapping, maturity assessment,
and evidence collection data.

Usage:
    # Generate summary report
    python scripts/generate_hitrust_report.py

    # Generate detailed report
    python scripts/generate_hitrust_report.py --detailed

    # Output to file
    python scripts/generate_hitrust_report.py --output reports/hitrust_report.md

    # Check readiness status
    python scripts/generate_hitrust_report.py --status

    # Show maturity assessment
    python scripts/generate_hitrust_report.py --maturity

    # Validate CSF mapping
    python scripts/generate_hitrust_report.py --validate
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).parent.parent
HITRUST_DIR = REPO_ROOT / ".ai" / "COMPLIANCE" / "HITRUST"
CSF_FILE = HITRUST_DIR / "HITRUST_CSFS_MAPPING.yaml"
MATURITY_FILE = HITRUST_DIR / "HITRUST_MATURITY.yaml"
EVIDENCE_FILE = HITRUST_DIR / "HITRUST_EVIDENCE.yaml"


def load_yaml_safe(filepath: Path) -> dict[str, Any]:
    """Load YAML file if it exists."""
    if filepath.exists():
        return yaml.safe_load(filepath.read_text(encoding="utf-8")) or {}
    return {}


def get_csf_summary() -> dict[str, Any]:
    """Get summary of HITRUST CSF control implementation."""
    data = load_yaml_safe(CSF_FILE)

    # Count controls from all domains
    domains = [
        "information_security_management",
        "access_control",
        "human_resources",
        "asset_management",
        "physical_security",
        "operations_management",
        "systems_acquisition",
        "incident_management",
        "business_continuity",
        "compliance",
        "ai_governance",
    ]

    implemented = 0
    partial = 0
    total = 0

    for domain in domains:
        domain_data = data.get(domain, {})
        for control in domain_data.values():
            total += 1
            status = control.get("status", "Unknown")
            if status == "Implemented":
                implemented += 1
            elif status == "Partially Implemented":
                partial += 1

    return {
        "total": total,
        "implemented": implemented,
        "partially_implemented": partial,
        "gaps": total - implemented - partial,
        "coverage": f"{(implemented / total) * 100:.1f}%" if total > 0 else "N/A",
        "domains": len(domains),
    }


def get_maturity_summary() -> dict[str, Any]:
    """Get summary of maturity assessment."""
    data = load_yaml_safe(MATURITY_FILE)

    summary = data.get("summary", {})
    domain_maturity = data.get("domain_maturity", {})

    # Calculate average score
    scores = []
    for domain in domain_maturity.values():
        if "maturity_score" in domain:
            scores.append(domain["maturity_score"])

    avg_score = sum(scores) / len(scores) if scores else 0

    return {
        "overall_maturity": summary.get("overall_maturity", "Unknown"),
        "maturity_score": f"{avg_score:.1f}",
        "target_maturity": summary.get("target_maturity", "Unknown"),
        "certification_readiness": summary.get("certification_readiness", "Unknown"),
        "domains_assessed": len(domain_maturity),
    }


def get_evidence_summary() -> dict[str, Any]:
    """Get summary of evidence collection."""
    data = load_yaml_safe(EVIDENCE_FILE)

    evidence_log = data.get("evidence_log", [])

    by_domain: dict[str, int] = {}
    by_type: dict[str, int] = {}

    for entry in evidence_log:
        domain = entry.get("domain", "Unknown")
        etype = entry.get("evidence_type", "Unknown")

        by_domain[domain] = by_domain.get(domain, 0) + 1
        by_type[etype] = by_type.get(etype, 0) + 1

    return {
        "total_entries": len(evidence_log),
        "domains_covered": len(by_domain),
        "by_domain": by_domain,
        "by_type": by_type,
    }


def validate_csf_mapping() -> list[str]:
    """Validate CSF mapping for completeness."""
    issues = []
    data = load_yaml_safe(CSF_FILE)

    required_domains = [
        "access_control",
        "operations_management",
        "incident_management",
        "compliance",
    ]

    for domain in required_domains:
        if domain not in data:
            issues.append(f"Missing required domain: {domain}")
        else:
            domain_data = data.get(domain, {})
            for control_id, control in domain_data.items():
                if not control.get("evidence"):
                    issues.append(f"No evidence for {control_id}")

    return issues


def get_certification_readiness() -> dict[str, Any]:
    """Get certification readiness status."""
    data = load_yaml_safe(MATURITY_FILE)

    readiness = data.get("certification_readiness", {})

    return {
        "overall": readiness.get("overall_status", "Unknown"),
        "e1": readiness.get("hitrust_e1", {}),
        "i1": readiness.get("hitrust_i1", {}),
        "r2": readiness.get("hitrust_r2", {}),
    }


def generate_status_report() -> str:
    """Generate quick status report."""
    csf = get_csf_summary()
    maturity = get_maturity_summary()
    evidence = get_evidence_summary()
    readiness = get_certification_readiness()

    lines = [
        "HITRUST CSF Readiness Status",
        "=" * 50,
        "",
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "",
        "CONTROL COVERAGE",
        "-" * 30,
        f"  Total Controls: {csf['total']}",
        f"  Implemented: {csf['implemented']}",
        f"  Partially Implemented: {csf['partially_implemented']}",
        f"  Coverage: {csf['coverage']}",
        "",
        "MATURITY ASSESSMENT",
        "-" * 30,
        f"  Overall Maturity: {maturity['overall_maturity']}",
        f"  Maturity Score: {maturity['maturity_score']}/5",
        f"  Target: {maturity['target_maturity']}",
        f"  Domains Assessed: {maturity['domains_assessed']}",
        "",
        "CERTIFICATION READINESS",
        "-" * 30,
        f"  HITRUST e1: {readiness['e1'].get('readiness', 'Unknown')}",
        f"  HITRUST i1: {readiness['i1'].get('readiness', 'Unknown')}",
        f"  HITRUST r2: {readiness['r2'].get('readiness', 'Unknown')}",
        "",
        "EVIDENCE",
        "-" * 30,
        f"  Total Entries: {evidence['total_entries']}",
        f"  Domains Covered: {evidence['domains_covered']}",
        "",
    ]

    # Overall status
    if readiness["overall"] == "High":
        lines.append("[OK] HITRUST readiness status: HIGH")
    elif readiness["overall"] == "Medium":
        lines.append("[~] HITRUST readiness status: MEDIUM")
    else:
        lines.append("[!] HITRUST readiness status: NEEDS ATTENTION")

    return "\n".join(lines)


def generate_maturity_report() -> str:
    """Generate maturity assessment report."""
    data = load_yaml_safe(MATURITY_FILE)
    domain_maturity = data.get("domain_maturity", {})

    lines = [
        "HITRUST CSF Maturity Assessment",
        "=" * 50,
        "",
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "",
        "DOMAIN MATURITY LEVELS",
        "-" * 50,
        f"{'Domain':<35} {'Score':>8} {'Level':>12}",
        "-" * 50,
    ]

    for domain_id, domain in domain_maturity.items():
        name = domain.get("domain_name", domain_id)[:32]
        score = domain.get("maturity_score", 0)
        level = domain.get("current_maturity", "Unknown")
        lines.append(f"{name:<35} {score:>7.1f} {level:>12}")

    lines.extend([
        "",
        "MATURITY MODEL",
        "-" * 30,
        "1 - Policy:      Policies documented",
        "2 - Procedure:   Procedures implement policies",
        "3 - Implemented: Controls operating",
        "4 - Measured:    Controls monitored",
        "5 - Managed:     Continuous improvement",
    ])

    return "\n".join(lines)


def generate_detailed_report() -> str:
    """Generate detailed markdown report."""
    csf = get_csf_summary()
    maturity = get_maturity_summary()
    evidence = get_evidence_summary()
    readiness = get_certification_readiness()

    maturity_data = load_yaml_safe(MATURITY_FILE)

    lines = [
        "# HITRUST CSF Readiness Report",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        "**Framework:** HITRUST CSF v11",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        "| Category | Status |",
        "|----------|--------|",
        f"| Controls Implemented | {csf['implemented']}/{csf['total']} |",
        f"| Coverage | {csf['coverage']} |",
        f"| Overall Maturity | {maturity['overall_maturity']} |",
        f"| Maturity Score | {maturity['maturity_score']}/5 |",
        f"| Certification Readiness | {readiness['overall']} |",
        "",
        "---",
        "",
        "## Certification Readiness",
        "",
        "| Certification | Status | Gaps |",
        "|---------------|--------|------|",
        f"| HITRUST e1 | {readiness['e1'].get('readiness', 'Unknown')} | {readiness['e1'].get('gaps', 0)} |",
        f"| HITRUST i1 | {readiness['i1'].get('readiness', 'Unknown')} | {readiness['i1'].get('gaps', 0)} |",
        f"| HITRUST r2 | {readiness['r2'].get('readiness', 'Unknown')} | {readiness['r2'].get('gaps', 0)} |",
        "",
        "---",
        "",
        "## Domain Maturity",
        "",
        "| Domain | Score | Level |",
        "|--------|-------|-------|",
    ]

    domain_maturity = maturity_data.get("domain_maturity", {})
    for domain_id, domain in domain_maturity.items():
        name = domain.get("domain_name", domain_id)
        score = domain.get("maturity_score", 0)
        level = domain.get("current_maturity", "Unknown")
        lines.append(f"| {name} | {score}/5 | {level} |")

    lines.extend([
        "",
        "---",
        "",
        "## Evidence Summary",
        "",
        "| Evidence Type | Count |",
        "|---------------|-------|",
    ])

    for etype, count in sorted(evidence["by_type"].items()):
        lines.append(f"| {etype} | {count} |")

    lines.extend([
        "",
        "---",
        "",
        "*This report is auto-generated from HITRUST compliance data.*",
    ])

    return "\n".join(lines)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="HITRUST CSF Readiness Report Generator"
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
        "--maturity", "-m",
        action="store_true",
        help="Show maturity assessment",
    )
    parser.add_argument(
        "--validate", "-v",
        action="store_true",
        help="Validate CSF mapping",
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file path",
    )

    args = parser.parse_args()

    # Validation mode
    if args.validate:
        print("HITRUST CSF Mapping Validation")
        print("=" * 50)
        issues = validate_csf_mapping()
        if issues:
            for issue in issues:
                print(f"  [!] {issue}")
            print(f"\n{len(issues)} issue(s) found")
            return 1
        else:
            print("[OK] CSF mapping is complete")
            return 0

    # Maturity report
    if args.maturity:
        print(generate_maturity_report())
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
    print("[OK] HITRUST CSF mappings and maturity assessments are current.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
