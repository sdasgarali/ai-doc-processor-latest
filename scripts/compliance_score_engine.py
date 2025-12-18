#!/usr/bin/env python3
"""
Compliance Score Engine.

Calculates overall compliance health score (0-100) based on:
- SOC-2 control implementation
- ISO 27001 control implementation
- Risk management status
- Evidence collection sufficiency
- CI/CD compliance checks
- Questionnaire readiness

Usage:
    # Calculate and display score
    python scripts/compliance_score_engine.py

    # Output JSON report
    python scripts/compliance_score_engine.py --json

    # Save to file
    python scripts/compliance_score_engine.py --output reports/compliance_score.json

    # Show detailed breakdown
    python scripts/compliance_score_engine.py --verbose

    # Generate SVG badge
    python scripts/compliance_score_engine.py --badge reports/compliance_badge.svg
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).parent.parent
COMPLIANCE_DIR = REPO_ROOT / ".ai" / "COMPLIANCE"
SCORE_CONFIG = COMPLIANCE_DIR / "COMPLIANCE_SCORE.yaml"
SOC2_MAPPING = COMPLIANCE_DIR / "SOC2_MAPPING.yaml"
ISO27001_MAPPING = COMPLIANCE_DIR / "ISO27001_MAPPING.yaml"
RISK_REGISTER = COMPLIANCE_DIR / "ISO_RISK_REGISTER.yaml"
EVIDENCE_LOG = COMPLIANCE_DIR / "SOC2_EVIDENCE_LOG.yaml"
QUESTIONNAIRES_DIR = COMPLIANCE_DIR / "QUESTIONNAIRES"


def load_yaml_safe(filepath: Path) -> dict[str, Any]:
    """Load YAML file if it exists."""
    if filepath.exists():
        return yaml.safe_load(filepath.read_text(encoding="utf-8")) or {}
    return {}


def load_config() -> dict[str, Any]:
    """Load score configuration."""
    return load_yaml_safe(SCORE_CONFIG)


def calculate_soc2_score() -> tuple[float, dict[str, Any]]:
    """Calculate SOC-2 control implementation score."""
    data = load_yaml_safe(SOC2_MAPPING)
    summary = data.get("summary", {})

    implemented = summary.get("implemented", 0)
    total = summary.get("total_controls", 1)

    score = (implemented / total) * 100 if total > 0 else 0

    return score, {
        "implemented": implemented,
        "total": total,
        "coverage": f"{score:.1f}%",
    }


def calculate_iso27001_score() -> tuple[float, dict[str, Any]]:
    """Calculate ISO 27001 control implementation score."""
    data = load_yaml_safe(ISO27001_MAPPING)
    summary = data.get("summary", {})

    implemented = summary.get("implemented", 0)
    total = summary.get("total_controls", 1)

    score = (implemented / total) * 100 if total > 0 else 0

    return score, {
        "implemented": implemented,
        "total": total,
        "coverage": f"{score:.1f}%",
    }


def calculate_risk_score() -> tuple[float, dict[str, Any]]:
    """Calculate risk management score."""
    data = load_yaml_safe(RISK_REGISTER)
    summary = data.get("summary", {})
    by_status = summary.get("by_status", {})

    total = summary.get("total_risks", 0)
    mitigated = by_status.get("mitigated", by_status.get("Mitigated", 0))
    accepted = by_status.get("accepted", by_status.get("Accepted", 0))

    if total == 0:
        return 100.0, {"total": 0, "treated": 0, "message": "No risks registered"}

    treated = mitigated + accepted
    score = (treated / total) * 100

    return score, {
        "total": total,
        "mitigated": mitigated,
        "accepted": accepted,
        "open": total - treated,
        "treatment_rate": f"{score:.1f}%",
    }


def calculate_evidence_score() -> tuple[float, dict[str, Any]]:
    """Calculate evidence collection score."""
    config = load_config()
    target = config.get("components", {}).get("evidence_collection", {}).get("target_entries", 200)

    data = load_yaml_safe(EVIDENCE_LOG)
    entries = len(data.get("evidence_log", []))

    score = min((entries / target) * 100, 100) if target > 0 else 0

    return score, {
        "entries": entries,
        "target": target,
        "sufficiency": f"{score:.1f}%",
    }


def calculate_cicd_score() -> tuple[float, dict[str, Any]]:
    """Calculate CI/CD compliance score."""
    config = load_config()
    checks_config = config.get("components", {}).get("cicd_compliance", {}).get("checks", [])

    if not checks_config:
        # Default checks if not configured
        checks_config = [
            {"name": "CODEOWNERS", "file": ".github/CODEOWNERS", "required": True},
            {"name": "CI workflow", "file": ".github/workflows/ci.yml", "required": True},
            {"name": "Security workflow", "file": ".github/workflows/security.yml", "required": True},
            {"name": "AI review workflow", "file": ".github/workflows/ai-review.yml", "required": True},
            {"name": "Auto-merge policy", "file": ".ai/AUTO_MERGE_POLICY.yaml", "required": True},
        ]

    passed = 0
    failed = 0
    details = []

    for check in checks_config:
        filepath = REPO_ROOT / check["file"]
        exists = filepath.exists()

        if exists:
            passed += 1
            details.append({"name": check["name"], "status": "PASS", "file": check["file"]})
        else:
            failed += 1
            details.append({"name": check["name"], "status": "FAIL", "file": check["file"]})

    total = passed + failed
    score = (passed / total) * 100 if total > 0 else 0

    return score, {
        "passed": passed,
        "failed": failed,
        "total": total,
        "checks": details,
    }


def calculate_questionnaire_score() -> tuple[float, dict[str, Any]]:
    """Calculate questionnaire readiness score."""
    if not QUESTIONNAIRES_DIR.exists():
        return 0.0, {"message": "No questionnaires found"}

    total_questions = 0
    implemented = 0
    questionnaires = []

    for filepath in QUESTIONNAIRES_DIR.glob("*.yaml"):
        data = load_yaml_safe(filepath)
        name = filepath.stem

        questions = data.get(name, [])
        q_total = len(questions)
        q_implemented = sum(1 for q in questions if q.get("status") == "Implemented")

        total_questions += q_total
        implemented += q_implemented

        questionnaires.append({
            "name": name,
            "total": q_total,
            "implemented": q_implemented,
        })

    score = (implemented / total_questions) * 100 if total_questions > 0 else 0

    return score, {
        "total_questions": total_questions,
        "implemented": implemented,
        "coverage": f"{score:.1f}%",
        "questionnaires": questionnaires,
    }


def get_threshold_label(score: float, config: dict[str, Any]) -> tuple[str, str]:
    """Get threshold label and color for a score."""
    thresholds = config.get("overall_thresholds", {})

    if score >= thresholds.get("excellent", {}).get("min_score", 90):
        return "Excellent", thresholds.get("excellent", {}).get("color", "#22c55e")
    elif score >= thresholds.get("good", {}).get("min_score", 75):
        return "Good", thresholds.get("good", {}).get("color", "#3b82f6")
    elif score >= thresholds.get("acceptable", {}).get("min_score", 60):
        return "Acceptable", thresholds.get("acceptable", {}).get("color", "#f59e0b")
    elif score >= thresholds.get("needs_attention", {}).get("min_score", 40):
        return "Needs Attention", thresholds.get("needs_attention", {}).get("color", "#f97316")
    else:
        return "Critical", thresholds.get("critical", {}).get("color", "#ef4444")


def calculate_overall_score(verbose: bool = False) -> dict[str, Any]:
    """Calculate overall compliance score."""
    config = load_config()
    components = config.get("components", {})

    # Calculate each component
    soc2_score, soc2_details = calculate_soc2_score()
    iso_score, iso_details = calculate_iso27001_score()
    risk_score, risk_details = calculate_risk_score()
    evidence_score, evidence_details = calculate_evidence_score()
    cicd_score, cicd_details = calculate_cicd_score()
    questionnaire_score, questionnaire_details = calculate_questionnaire_score()

    # Get weights
    weights = {
        "soc2_controls": components.get("soc2_controls", {}).get("weight", 25),
        "iso27001_controls": components.get("iso27001_controls", {}).get("weight", 20),
        "risk_management": components.get("risk_management", {}).get("weight", 20),
        "evidence_collection": components.get("evidence_collection", {}).get("weight", 15),
        "cicd_compliance": components.get("cicd_compliance", {}).get("weight", 10),
        "questionnaire_readiness": components.get("questionnaire_readiness", {}).get("weight", 10),
    }

    # Calculate weighted score
    weighted_score = (
        soc2_score * weights["soc2_controls"] +
        iso_score * weights["iso27001_controls"] +
        risk_score * weights["risk_management"] +
        evidence_score * weights["evidence_collection"] +
        cicd_score * weights["cicd_compliance"] +
        questionnaire_score * weights["questionnaire_readiness"]
    ) / 100

    label, color = get_threshold_label(weighted_score, config)

    result = {
        "score": round(weighted_score, 1),
        "label": label,
        "color": color,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "components": {
            "soc2_controls": {
                "score": round(soc2_score, 1),
                "weight": weights["soc2_controls"],
                "weighted": round(soc2_score * weights["soc2_controls"] / 100, 1),
                "details": soc2_details if verbose else None,
            },
            "iso27001_controls": {
                "score": round(iso_score, 1),
                "weight": weights["iso27001_controls"],
                "weighted": round(iso_score * weights["iso27001_controls"] / 100, 1),
                "details": iso_details if verbose else None,
            },
            "risk_management": {
                "score": round(risk_score, 1),
                "weight": weights["risk_management"],
                "weighted": round(risk_score * weights["risk_management"] / 100, 1),
                "details": risk_details if verbose else None,
            },
            "evidence_collection": {
                "score": round(evidence_score, 1),
                "weight": weights["evidence_collection"],
                "weighted": round(evidence_score * weights["evidence_collection"] / 100, 1),
                "details": evidence_details if verbose else None,
            },
            "cicd_compliance": {
                "score": round(cicd_score, 1),
                "weight": weights["cicd_compliance"],
                "weighted": round(cicd_score * weights["cicd_compliance"] / 100, 1),
                "details": cicd_details if verbose else None,
            },
            "questionnaire_readiness": {
                "score": round(questionnaire_score, 1),
                "weight": weights["questionnaire_readiness"],
                "weighted": round(questionnaire_score * weights["questionnaire_readiness"] / 100, 1),
                "details": questionnaire_details if verbose else None,
            },
        },
    }

    # Remove None details if not verbose
    if not verbose:
        for component in result["components"].values():
            if "details" in component:
                del component["details"]

    return result


def generate_badge(score: float, label: str, color: str) -> str:
    """Generate SVG badge for compliance score."""
    # Escape color for SVG
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="150" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="85" height="20" fill="#555"/>
    <rect x="85" width="65" height="20" fill="{color}"/>
    <rect width="150" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="42.5" y="15" fill="#010101" fill-opacity=".3">compliance</text>
    <text x="42.5" y="14">compliance</text>
    <text x="117" y="15" fill="#010101" fill-opacity=".3">{score:.0f}%</text>
    <text x="117" y="14">{score:.0f}%</text>
  </g>
</svg>'''
    return svg


def print_score_report(result: dict[str, Any], verbose: bool = False) -> None:
    """Print formatted score report."""
    print("=" * 60)
    print("COMPLIANCE SCORE REPORT")
    print("=" * 60)
    print(f"Generated: {result['timestamp']}")
    print()

    # Overall score
    print(f"OVERALL SCORE: {result['score']:.1f}/100 ({result['label']})")
    print("-" * 60)
    print()

    # Component breakdown
    print("COMPONENT BREAKDOWN")
    print("-" * 60)
    print(f"{'Component':<30} {'Score':>8} {'Weight':>8} {'Weighted':>10}")
    print("-" * 60)

    for name, data in result["components"].items():
        display_name = name.replace("_", " ").title()
        print(f"{display_name:<30} {data['score']:>7.1f}% {data['weight']:>7}% {data['weighted']:>9.1f}")

    print("-" * 60)
    print(f"{'TOTAL':<30} {'':<8} {'100%':>8} {result['score']:>9.1f}")
    print()

    if verbose:
        print("DETAILED BREAKDOWN")
        print("=" * 60)

        for name, data in result["components"].items():
            display_name = name.replace("_", " ").title()
            print(f"\n{display_name}")
            print("-" * 40)

            details = data.get("details", {})
            for key, value in details.items():
                if key != "checks" and key != "questionnaires":
                    print(f"  {key}: {value}")

            if "checks" in details:
                print("  Checks:")
                for check in details["checks"]:
                    status = "[+]" if check["status"] == "PASS" else "[-]"
                    print(f"    {status} {check['name']}")

            if "questionnaires" in details:
                print("  Questionnaires:")
                for q in details["questionnaires"]:
                    print(f"    - {q['name']}: {q['implemented']}/{q['total']}")

    print()
    print("=" * 60)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Compliance Score Engine"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed breakdown",
    )
    parser.add_argument(
        "--output", "-o",
        help="Save JSON report to file",
    )
    parser.add_argument(
        "--badge", "-b",
        help="Generate SVG badge to file",
    )

    args = parser.parse_args()

    # Calculate score
    result = calculate_overall_score(verbose=args.verbose or args.json)

    # Generate badge if requested
    if args.badge:
        badge_svg = generate_badge(result["score"], result["label"], result["color"])
        Path(args.badge).parent.mkdir(parents=True, exist_ok=True)
        Path(args.badge).write_text(badge_svg, encoding="utf-8")
        print(f"[OK] Badge saved to: {args.badge}")

    # Output JSON or text
    if args.json or args.output:
        json_output = json.dumps(result, indent=2)

        if args.output:
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            Path(args.output).write_text(json_output, encoding="utf-8")
            print(f"[OK] Report saved to: {args.output}")
        else:
            print(json_output)
    else:
        print_score_report(result, verbose=args.verbose)

    return 0


if __name__ == "__main__":
    sys.exit(main())
