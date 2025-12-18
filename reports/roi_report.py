#!/usr/bin/env python3
"""
Executive PDF ROI Report Generator.

Generates board-ready PDF reports showing:
- PRs auto-fixed
- CI failures avoided
- Review hours saved
- Cost savings estimate

Requires: pip install reportlab
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# PDF generation - graceful fallback if not installed
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


# Database location
DB_PATH = Path(__file__).parent.parent / ".ai" / "ai_metrics.db"

# Cost assumptions (configurable)
COST_CONFIG = {
    "avg_review_minutes": 30,
    "hourly_rate_usd": 75,
    "ci_failure_cost_usd": 50,  # Developer time to investigate
    "self_heal_value_usd": 100,  # Time saved per auto-fix
}


def get_metrics() -> dict[str, Any]:
    """Fetch metrics from database."""
    if not DB_PATH.exists():
        return {"error": "No metrics database found"}

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    metrics: dict[str, Any] = {}

    # Total events
    cursor.execute("SELECT COUNT(*) FROM events")
    metrics["total_events"] = cursor.fetchone()[0]

    # Events by type
    cursor.execute("""
        SELECT event, COUNT(*) as count
        FROM events
        GROUP BY event
        ORDER BY count DESC
    """)
    metrics["events_by_type"] = dict(cursor.fetchall())

    # Self-heal stats
    cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'self_heal_success'")
    metrics["self_heals_success"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'self_heal_failed'")
    metrics["self_heals_failed"] = cursor.fetchone()[0]

    # AI reviews
    cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'ai_review_completed'")
    metrics["ai_reviews"] = cursor.fetchone()[0]

    # Risk distribution
    cursor.execute("""
        SELECT risk_level, COUNT(*) as count
        FROM events
        WHERE risk_level != ''
        GROUP BY risk_level
    """)
    metrics["risk_distribution"] = dict(cursor.fetchall())

    # Auto-merges
    cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'auto_merge_enabled'")
    metrics["auto_merges"] = cursor.fetchone()[0]

    # Rule violations
    cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'rule_violation_detected'")
    metrics["rule_violations"] = cursor.fetchone()[0]

    # Date range
    cursor.execute("SELECT MIN(ts), MAX(ts) FROM events")
    date_range = cursor.fetchone()
    metrics["date_range"] = {
        "start": date_range[0] if date_range[0] else "N/A",
        "end": date_range[1] if date_range[1] else "N/A",
    }

    conn.close()
    return metrics


def calculate_roi(metrics: dict[str, Any]) -> dict[str, Any]:
    """Calculate ROI estimates from metrics."""
    roi: dict[str, Any] = {}

    # Self-heal savings
    self_heals = metrics.get("self_heals_success", 0)
    roi["self_heal_savings_usd"] = self_heals * COST_CONFIG["self_heal_value_usd"]

    # Review time savings (estimate 40% faster with AI)
    reviews = metrics.get("ai_reviews", 0)
    review_hours_saved = reviews * (COST_CONFIG["avg_review_minutes"] / 60) * 0.4
    roi["review_hours_saved"] = round(review_hours_saved, 1)
    roi["review_savings_usd"] = review_hours_saved * COST_CONFIG["hourly_rate_usd"]

    # CI failure prevention (auto-merges indicate prevented manual work)
    auto_merges = metrics.get("auto_merges", 0)
    roi["ci_savings_usd"] = auto_merges * COST_CONFIG["ci_failure_cost_usd"] * 0.5

    # Total savings
    roi["total_savings_usd"] = (
        roi["self_heal_savings_usd"]
        + roi["review_savings_usd"]
        + roi["ci_savings_usd"]
    )

    return roi


def generate_text_report(metrics: dict[str, Any], roi: dict[str, Any]) -> str:
    """Generate text-based report (fallback if no reportlab)."""
    lines = [
        "=" * 60,
        "AI DevEx ROI Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
        "EXECUTIVE SUMMARY",
        "-" * 40,
        f"Total AI Events: {metrics.get('total_events', 0)}",
        f"Date Range: {metrics.get('date_range', {}).get('start', 'N/A')} to {metrics.get('date_range', {}).get('end', 'N/A')}",
        "",
        "KEY METRICS",
        "-" * 40,
        f"Self-Heal Success: {metrics.get('self_heals_success', 0)}",
        f"Self-Heal Failed: {metrics.get('self_heals_failed', 0)}",
        f"AI Reviews Completed: {metrics.get('ai_reviews', 0)}",
        f"Auto-Merges Enabled: {metrics.get('auto_merges', 0)}",
        f"Rule Violations Detected: {metrics.get('rule_violations', 0)}",
        "",
        "RISK DISTRIBUTION",
        "-" * 40,
    ]

    for level, count in metrics.get("risk_distribution", {}).items():
        lines.append(f"  {level}: {count}")

    lines.extend([
        "",
        "ROI ESTIMATES",
        "-" * 40,
        f"Review Hours Saved: {roi.get('review_hours_saved', 0)} hrs",
        f"Self-Heal Savings: ${roi.get('self_heal_savings_usd', 0):,.2f}",
        f"Review Savings: ${roi.get('review_savings_usd', 0):,.2f}",
        f"CI Savings: ${roi.get('ci_savings_usd', 0):,.2f}",
        "-" * 40,
        f"TOTAL ESTIMATED SAVINGS: ${roi.get('total_savings_usd', 0):,.2f}",
        "",
        "=" * 60,
        "Note: Savings estimates based on industry averages.",
        "Actual values may vary based on team size and workflows.",
        "=" * 60,
    ])

    return "\n".join(lines)


def generate_pdf_report(
    metrics: dict[str, Any], roi: dict[str, Any], output_path: str
) -> None:
    """Generate PDF report using reportlab."""
    if not REPORTLAB_AVAILABLE:
        raise ImportError("reportlab not installed. Run: pip install reportlab")

    doc = SimpleDocTemplate(output_path, pagesize=LETTER)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=24,
        spaceAfter=30,
        alignment=1,  # Center
    )
    story.append(Paragraph("AI DevEx ROI Report", title_style))

    # Date
    date_style = ParagraphStyle(
        "Date",
        parent=styles["Normal"],
        fontSize=12,
        alignment=1,
        textColor=colors.grey,
    )
    story.append(
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", date_style
        )
    )
    story.append(Spacer(1, 0.5 * inch))

    # Executive Summary
    story.append(Paragraph("Executive Summary", styles["Heading2"]))
    summary_data = [
        ["Total AI Events", str(metrics.get("total_events", 0))],
        [
            "Date Range",
            f"{metrics.get('date_range', {}).get('start', 'N/A')[:10]} to {metrics.get('date_range', {}).get('end', 'N/A')[:10]}",
        ],
        [
            "Total Estimated Savings",
            f"${roi.get('total_savings_usd', 0):,.2f}",
        ],
    ]
    summary_table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
    summary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.lightgrey),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("GRID", (0, 0), (-1, -1), 1, colors.white),
        ])
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * inch))

    # Key Metrics
    story.append(Paragraph("Key Metrics", styles["Heading2"]))
    metrics_data = [
        ["Metric", "Value"],
        ["Self-Heal Success", str(metrics.get("self_heals_success", 0))],
        ["Self-Heal Failed", str(metrics.get("self_heals_failed", 0))],
        ["AI Reviews Completed", str(metrics.get("ai_reviews", 0))],
        ["Auto-Merges Enabled", str(metrics.get("auto_merges", 0))],
        ["Rule Violations Detected", str(metrics.get("rule_violations", 0))],
    ]
    metrics_table = Table(metrics_data, colWidths=[3 * inch, 3 * inch])
    metrics_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ])
    )
    story.append(metrics_table)
    story.append(Spacer(1, 0.3 * inch))

    # ROI Breakdown
    story.append(Paragraph("ROI Breakdown", styles["Heading2"]))
    roi_data = [
        ["Category", "Value"],
        ["Review Hours Saved", f"{roi.get('review_hours_saved', 0)} hrs"],
        ["Self-Heal Savings", f"${roi.get('self_heal_savings_usd', 0):,.2f}"],
        ["Review Time Savings", f"${roi.get('review_savings_usd', 0):,.2f}"],
        ["CI/CD Savings", f"${roi.get('ci_savings_usd', 0):,.2f}"],
        ["Total Savings", f"${roi.get('total_savings_usd', 0):,.2f}"],
    ]
    roi_table = Table(roi_data, colWidths=[3 * inch, 3 * inch])
    roi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.darkgreen),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("BACKGROUND", (0, -1), (-1, -1), colors.lightgreen),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ])
    )
    story.append(roi_table)
    story.append(Spacer(1, 0.5 * inch))

    # Footer
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
    )
    story.append(
        Paragraph(
            "Note: Savings estimates based on industry averages. "
            "Actual values may vary based on team size and workflows.",
            footer_style,
        )
    )

    doc.build(story)


def main() -> int:
    """Generate ROI report."""
    print("AI DevEx ROI Report Generator")
    print("=" * 40)

    metrics = get_metrics()
    if "error" in metrics:
        print(f"Error: {metrics['error']}")
        print("Run some AI workflows first to generate metrics.")
        return 1

    roi = calculate_roi(metrics)

    # Generate text report
    text_report = generate_text_report(metrics, roi)
    print(text_report)

    # Save text report
    text_path = Path(__file__).parent / "AI_ROI_Report.txt"
    text_path.write_text(text_report)
    print(f"\nText report saved to: {text_path}")

    # Generate PDF if reportlab available
    if REPORTLAB_AVAILABLE:
        pdf_path = Path(__file__).parent / "AI_ROI_Report.pdf"
        generate_pdf_report(metrics, roi, str(pdf_path))
        print(f"PDF report saved to: {pdf_path}")
    else:
        print("\nNote: Install reportlab for PDF generation: pip install reportlab")

    return 0


if __name__ == "__main__":
    sys.exit(main())
