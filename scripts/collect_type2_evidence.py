#!/usr/bin/env python3
"""
SOC-2 Type II Evidence Collector.

Automatically records control operating evidence over time.
Call this from CI pipelines, self-heal scripts, and governance controller.

Usage:
    # Record a PR merge
    python scripts/collect_type2_evidence.py --control CC6.6 --event "PR merged" --repo myrepo --ref "PR #123"

    # Record a self-heal event
    python scripts/collect_type2_evidence.py --control CC7.2 --event "CI failure remediated" --repo myrepo --ref "commit abc123"

    # Generate summary report
    python scripts/collect_type2_evidence.py --report

    # Show statistics
    python scripts/collect_type2_evidence.py --stats
"""

import argparse
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

EVIDENCE_LOG = Path(__file__).parent.parent / ".ai" / "COMPLIANCE" / "SOC2_EVIDENCE_LOG.yaml"
CONTROLS_CONFIG = Path(__file__).parent.parent / ".ai" / "COMPLIANCE" / "SOC2_TYPE2_CONTROLS.yaml"


def load_evidence_log() -> dict[str, Any]:
    """Load the evidence log file."""
    if not EVIDENCE_LOG.exists():
        return {
            "metadata": {
                "created": datetime.utcnow().isoformat() + "Z",
                "last_updated": datetime.utcnow().isoformat() + "Z",
                "total_entries": 0,
            },
            "evidence_log": [],
        }

    return yaml.safe_load(EVIDENCE_LOG.read_text(encoding="utf-8"))


def save_evidence_log(data: dict[str, Any]) -> None:
    """Save the evidence log file."""
    EVIDENCE_LOG.parent.mkdir(parents=True, exist_ok=True)
    data["metadata"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    data["metadata"]["total_entries"] = len(data.get("evidence_log", []))

    with open(EVIDENCE_LOG, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False)


def record_evidence(
    control: str,
    event: str,
    repo: str,
    reference: str,
    actor: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """
    Record a new evidence entry.

    Args:
        control: SOC-2 control ID (e.g., CC6.6, CC7.2)
        event: Description of the event
        repo: Repository where event occurred
        reference: Reference ID (PR number, commit hash, etc.)
        actor: Who/what performed the action
        details: Additional details as key-value pairs
    """
    data = load_evidence_log()

    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "control": control,
        "event": event,
        "repo": repo,
        "reference": reference,
    }

    if actor:
        entry["actor"] = actor

    if details:
        entry["details"] = details

    data["evidence_log"].append(entry)
    save_evidence_log(data)

    print(f"[OK] Evidence recorded: {control} - {event}")


def get_statistics() -> dict[str, Any]:
    """Get statistics about collected evidence."""
    data = load_evidence_log()
    entries = data.get("evidence_log", [])

    if not entries:
        return {"total": 0, "message": "No evidence collected yet"}

    # Count by control
    by_control = Counter(e.get("control", "unknown") for e in entries)

    # Count by repo
    by_repo = Counter(e.get("repo", "unknown") for e in entries)

    # Date range
    timestamps = [e.get("timestamp", "") for e in entries if e.get("timestamp")]
    if timestamps:
        timestamps.sort()
        date_range = {
            "earliest": timestamps[0][:10],
            "latest": timestamps[-1][:10],
        }
    else:
        date_range = {"earliest": "N/A", "latest": "N/A"}

    return {
        "total": len(entries),
        "by_control": dict(by_control),
        "by_repo": dict(by_repo),
        "date_range": date_range,
    }


def generate_report() -> str:
    """Generate a Type II evidence summary report."""
    data = load_evidence_log()
    stats = get_statistics()

    # Load controls config for context
    if CONTROLS_CONFIG.exists():
        controls_config = yaml.safe_load(CONTROLS_CONFIG.read_text(encoding="utf-8"))
        period = controls_config.get("period", {})
    else:
        period = {"start": "N/A", "end": "N/A"}

    lines = [
        "# SOC-2 Type II Evidence Report",
        "",
        f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"**Reporting Period:** {period.get('start', 'N/A')} to {period.get('end', 'N/A')}",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        f"- **Total Evidence Entries:** {stats.get('total', 0)}",
        f"- **Date Range:** {stats.get('date_range', {}).get('earliest', 'N/A')} to {stats.get('date_range', {}).get('latest', 'N/A')}",
        f"- **Controls Covered:** {len(stats.get('by_control', {}))}",
        f"- **Repositories:** {len(stats.get('by_repo', {}))}",
        "",
        "---",
        "",
        "## Evidence by Control",
        "",
    ]

    by_control = stats.get("by_control", {})
    if by_control:
        lines.append("| Control | Description | Evidence Count |")
        lines.append("|---------|-------------|----------------|")

        control_descriptions = {
            "CC6.1": "Logical access security",
            "CC6.2": "Authentication and authorization",
            "CC6.6": "Change management",
            "CC6.7": "Infrastructure changes",
            "CC7.1": "System monitoring",
            "CC7.2": "Incident response",
            "CC7.3": "Change evaluation",
            "CC8.1": "Change authorization",
        }

        for control, count in sorted(by_control.items()):
            desc = control_descriptions.get(control, "Other control")
            lines.append(f"| {control} | {desc} | {count} |")
    else:
        lines.append("*No evidence collected yet.*")

    lines.extend([
        "",
        "---",
        "",
        "## Evidence by Repository",
        "",
    ])

    by_repo = stats.get("by_repo", {})
    if by_repo:
        lines.append("| Repository | Evidence Count |")
        lines.append("|------------|----------------|")
        for repo, count in sorted(by_repo.items(), key=lambda x: -x[1]):
            lines.append(f"| {repo} | {count} |")
    else:
        lines.append("*No evidence collected yet.*")

    lines.extend([
        "",
        "---",
        "",
        "## Recent Evidence (Last 10)",
        "",
    ])

    entries = data.get("evidence_log", [])
    recent = entries[-10:] if entries else []
    recent.reverse()

    if recent:
        lines.append("| Timestamp | Control | Event | Reference |")
        lines.append("|-----------|---------|-------|-----------|")
        for entry in recent:
            ts = entry.get("timestamp", "")[:19].replace("T", " ")
            ctrl = entry.get("control", "N/A")
            event = entry.get("event", "N/A")[:30]
            ref = entry.get("reference", "N/A")
            lines.append(f"| {ts} | {ctrl} | {event} | {ref} |")
    else:
        lines.append("*No evidence collected yet.*")

    lines.extend([
        "",
        "---",
        "",
        "## Audit Readiness",
        "",
    ])

    # Check minimum evidence requirements
    min_per_control = 50
    gaps = []
    for control, count in by_control.items():
        if count < min_per_control:
            gaps.append(f"- {control}: {count}/{min_per_control} entries")

    if gaps:
        lines.append("**Evidence Gaps Detected:**")
        lines.extend(gaps)
        lines.append("")
        lines.append("*Consider running more CI/CD cycles before audit.*")
    else:
        lines.append("**All controls have sufficient evidence for Type II audit.**")

    lines.extend([
        "",
        "---",
        "",
        "*This report demonstrates operating effectiveness over time.*",
    ])

    return "\n".join(lines)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="SOC-2 Type II Evidence Collector"
    )
    parser.add_argument("--control", "-c", help="Control ID (e.g., CC6.6)")
    parser.add_argument("--event", "-e", help="Event description")
    parser.add_argument("--repo", "-r", help="Repository name")
    parser.add_argument("--ref", help="Reference (PR number, commit, etc.)")
    parser.add_argument("--actor", "-a", help="Actor (user or bot)")
    parser.add_argument("--details", "-d", help="JSON details")
    parser.add_argument("--stats", action="store_true", help="Show statistics")
    parser.add_argument("--report", action="store_true", help="Generate report")
    parser.add_argument("--output", "-o", help="Output file for report")

    args = parser.parse_args()

    if args.stats:
        stats = get_statistics()
        print("SOC-2 Type II Evidence Statistics")
        print("=" * 40)
        print(f"Total entries: {stats.get('total', 0)}")
        print("\nBy Control:")
        for ctrl, count in sorted(stats.get("by_control", {}).items()):
            print(f"  {ctrl}: {count}")
        print("\nBy Repository:")
        for repo, count in sorted(stats.get("by_repo", {}).items()):
            print(f"  {repo}: {count}")
        return 0

    if args.report:
        report = generate_report()
        if args.output:
            Path(args.output).write_text(report, encoding="utf-8")
            print(f"[OK] Report saved to: {args.output}")
        else:
            print(report)
        return 0

    # Record evidence
    if not all([args.control, args.event, args.repo, args.ref]):
        parser.error("--control, --event, --repo, and --ref are required to record evidence")

    details = None
    if args.details:
        import json
        details = json.loads(args.details)

    record_evidence(
        control=args.control,
        event=args.event,
        repo=args.repo,
        reference=args.ref,
        actor=args.actor,
        details=details,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
