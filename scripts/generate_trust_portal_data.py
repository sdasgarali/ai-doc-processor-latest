#!/usr/bin/env python3
"""
Trust Portal Data Generator.

Generates data.json for the customer-facing trust portal.
Updates security certifications, compliance status, and control information.

Usage:
    python scripts/generate_trust_portal_data.py
    python scripts/generate_trust_portal_data.py --output custom/path/data.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).parent.parent
RISK_REGISTER = REPO_ROOT / ".ai" / "COMPLIANCE" / "ISO_RISK_REGISTER.yaml"
SOC2_MAPPING = REPO_ROOT / ".ai" / "COMPLIANCE" / "SOC2_MAPPING.yaml"
ISO_MAPPING = REPO_ROOT / ".ai" / "COMPLIANCE" / "ISO27001_MAPPING.yaml"
EVIDENCE_LOG = REPO_ROOT / ".ai" / "COMPLIANCE" / "SOC2_EVIDENCE_LOG.yaml"
TRUST_PORTAL_DATA = REPO_ROOT / "trust-portal" / "data.json"


def load_yaml_safe(filepath: Path) -> dict[str, Any]:
    """Load YAML file if it exists."""
    if filepath.exists():
        return yaml.safe_load(filepath.read_text(encoding="utf-8")) or {}
    return {}


def get_soc2_status() -> dict[str, Any]:
    """Get SOC-2 compliance status."""
    mapping = load_yaml_safe(SOC2_MAPPING)
    evidence = load_yaml_safe(EVIDENCE_LOG)

    summary = mapping.get("summary", {})
    evidence_count = len(evidence.get("evidence_log", []))

    return {
        "framework": "SOC-2 Type II",
        "status": "Evidence Collection Active",
        "controls_implemented": summary.get("implemented", 0),
        "total_controls": summary.get("total_controls", 0),
        "coverage_percentage": summary.get("coverage_percentage", 0),
        "evidence_entries": evidence_count,
        "criteria_covered": ["CC6", "CC7", "CC8"],
    }


def get_iso27001_status() -> dict[str, Any]:
    """Get ISO 27001 compliance status."""
    mapping = load_yaml_safe(ISO_MAPPING)
    risks = load_yaml_safe(RISK_REGISTER)

    summary = mapping.get("summary", {})
    risk_summary = risks.get("summary", {})

    return {
        "framework": "ISO 27001:2022",
        "status": "Aligned",
        "controls_implemented": summary.get("implemented", 0),
        "total_controls": summary.get("total_controls", 0),
        "coverage_percentage": summary.get("coverage_percentage", 0),
        "annex_a_covered": ["A.5", "A.8", "A.16"],
        "risk_register": {
            "total_risks": risk_summary.get("total_risks", 0),
            "high_risks": risk_summary.get("by_level", {}).get("high", 0),
            "mitigated": risk_summary.get("by_status", {}).get("mitigated", 0),
        },
    }


def generate_trust_portal_data() -> dict[str, Any]:
    """Generate complete trust portal data."""
    now = datetime.utcnow()

    return {
        "metadata": {
            "generated": now.isoformat() + "Z",
            "version": "1.0",
            "organization": "Your Organization",
        },
        "security": {
            "certifications": [
                {
                    "name": "SOC-2 Type II",
                    "status": "Evidence Collection Active",
                    "details": "Automated evidence collection in progress",
                },
                {
                    "name": "ISO 27001:2022",
                    "status": "Aligned",
                    "details": "Controls mapped and implemented",
                },
            ],
            "controls": [
                {
                    "name": "Change Management",
                    "description": "All code changes require PR approval and pass automated CI checks",
                    "evidence": "GitHub Actions CI pipeline",
                },
                {
                    "name": "Access Control",
                    "description": "Role-based access via CODEOWNERS with mandatory code review",
                    "evidence": "GitHub branch protection rules",
                },
                {
                    "name": "Security Scanning",
                    "description": "Automated vulnerability scanning on every change",
                    "evidence": "Bandit, pip-audit, Safety scans",
                },
                {
                    "name": "AI Governance",
                    "description": "AI-assisted development with strict governance rules",
                    "evidence": ".ai/CLAUDE_RULES.md contract",
                },
                {
                    "name": "Incident Response",
                    "description": "Automated incident detection and remediation",
                    "evidence": "Self-healing PR agent",
                },
            ],
            "features": [
                "Multi-factor authentication required",
                "Encrypted data in transit and at rest",
                "Audit logging enabled",
                "Regular security assessments",
            ],
        },
        "availability": {
            "monitoring": {
                "type": "Continuous",
                "description": "CI/CD pipeline monitors all code changes",
                "alerting": "Slack notifications for failures",
            },
            "incident_response": {
                "type": "Automated + Human",
                "mean_time_to_detect": "< 1 minute",
                "mean_time_to_respond": "< 5 minutes (automated)",
                "escalation": "Human review for complex issues",
            },
            "business_continuity": {
                "local_fallback": "Local LLM (Ollama) for air-gapped environments",
                "fail_open": "Non-critical AI steps fail-open",
            },
        },
        "compliance": {
            "soc2": get_soc2_status(),
            "iso27001": get_iso27001_status(),
            "evidence_automation": {
                "enabled": True,
                "collection": "Continuous",
                "retention": "365 days",
            },
        },
        "governance": {
            "ai_governance": {
                "enabled": True,
                "rules_document": ".ai/CLAUDE_RULES.md",
                "enforcement": "Automated via CI/CD",
                "human_override": "Always available",
            },
            "change_approval": {
                "auto_merge": "LOW risk only",
                "human_review": "Required for MEDIUM/HIGH/CRITICAL",
                "policy_driven": True,
            },
            "audit_trail": {
                "enabled": True,
                "format": "YAML + SQLite",
                "exports": ["SOC-2 Evidence Package", "ISO Evidence Package"],
            },
        },
        "contact": {
            "security": "security@example.com",
            "compliance": "compliance@example.com",
            "support": "support@example.com",
        },
    }


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate Trust Portal Data"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help=f"Output file (default: {TRUST_PORTAL_DATA})",
    )
    parser.add_argument(
        "--pretty", "-p",
        action="store_true",
        help="Pretty print JSON",
    )

    args = parser.parse_args()

    # Generate data
    data = generate_trust_portal_data()

    # Determine output path
    output_path = Path(args.output) if args.output else TRUST_PORTAL_DATA
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON
    indent = 2 if args.pretty else None
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent)

    print(f"[OK] Trust portal data generated: {output_path}")
    print(f"  - SOC-2 controls: {data['compliance']['soc2']['controls_implemented']}")
    print(f"  - ISO 27001 controls: {data['compliance']['iso27001']['controls_implemented']}")
    print(f"  - Evidence entries: {data['compliance']['soc2']['evidence_entries']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
