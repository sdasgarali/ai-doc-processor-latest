#!/usr/bin/env python3
"""
AI DevEx Dashboard.

Real-time metrics and ROI visualization.
Requires: pip install streamlit pandas plotly

Run: streamlit run dashboard/app.py
"""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import pandas as pd
    import plotly.express as px
    import plotly.graph_objects as go
    import streamlit as st
except ImportError:
    print("Dashboard requires: pip install streamlit pandas plotly")
    sys.exit(1)


# Database location
DB_PATH = Path(__file__).parent.parent / ".ai" / "ai_metrics.db"

# Cost assumptions
COST_CONFIG = {
    "avg_review_minutes": 30,
    "hourly_rate_usd": 75,
    "ci_failure_cost_usd": 50,
    "self_heal_value_usd": 100,
}


def get_db_connection() -> sqlite3.Connection | None:
    """Get database connection if exists."""
    if not DB_PATH.exists():
        return None
    return sqlite3.connect(str(DB_PATH))


def load_events() -> pd.DataFrame:
    """Load all events from database."""
    conn = get_db_connection()
    if conn is None:
        return pd.DataFrame()

    df = pd.read_sql_query(
        "SELECT * FROM events ORDER BY ts DESC",
        conn,
        parse_dates=["ts"],
    )
    conn.close()
    return df


def calculate_metrics(df: pd.DataFrame) -> dict[str, Any]:
    """Calculate key metrics from events."""
    if df.empty:
        return {
            "total_events": 0,
            "self_heals_success": 0,
            "self_heals_failed": 0,
            "ai_reviews": 0,
            "auto_merges": 0,
            "rule_violations": 0,
        }

    return {
        "total_events": len(df),
        "self_heals_success": len(df[df["event"] == "self_heal_success"]),
        "self_heals_failed": len(df[df["event"] == "self_heal_failed"]),
        "ai_reviews": len(df[df["event"] == "ai_review_completed"]),
        "auto_merges": len(df[df["event"] == "auto_merge_enabled"]),
        "rule_violations": len(df[df["event"] == "rule_violation_detected"]),
    }


def calculate_roi(metrics: dict[str, Any]) -> dict[str, float]:
    """Calculate ROI estimates."""
    self_heal_savings = metrics["self_heals_success"] * COST_CONFIG["self_heal_value_usd"]

    review_hours = metrics["ai_reviews"] * (COST_CONFIG["avg_review_minutes"] / 60) * 0.4
    review_savings = review_hours * COST_CONFIG["hourly_rate_usd"]

    ci_savings = metrics["auto_merges"] * COST_CONFIG["ci_failure_cost_usd"] * 0.5

    return {
        "self_heal_savings": self_heal_savings,
        "review_hours_saved": round(review_hours, 1),
        "review_savings": review_savings,
        "ci_savings": ci_savings,
        "total_savings": self_heal_savings + review_savings + ci_savings,
    }


def main() -> None:
    """Main dashboard application."""
    st.set_page_config(
        page_title="AI DevEx Dashboard",
        page_icon="🤖",
        layout="wide",
    )

    st.title("🤖 AI DevEx Dashboard")
    st.markdown("Real-time metrics for AI-assisted CI/CD workflows")

    # Load data
    df = load_events()

    if df.empty:
        st.warning("No metrics data found. Run AI workflows to generate data.")
        st.info(f"Database location: {DB_PATH}")
        st.code("""
# To generate sample data, run:
from scripts.ai_metrics import record
record("self_heal_success", "Fixed lint errors", pr_number="123")
record("ai_review_completed", "Review completed", pr_number="123")
        """)
        return

    metrics = calculate_metrics(df)
    roi = calculate_roi(metrics)

    # Key metrics row
    st.header("Key Metrics")
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Events", metrics["total_events"])

    with col2:
        success_rate = (
            metrics["self_heals_success"]
            / max(metrics["self_heals_success"] + metrics["self_heals_failed"], 1)
            * 100
        )
        st.metric("Self-Heal Success Rate", f"{success_rate:.0f}%")

    with col3:
        st.metric("AI Reviews", metrics["ai_reviews"])

    with col4:
        st.metric("Auto-Merges", metrics["auto_merges"])

    # ROI section
    st.header("💰 ROI Estimates")
    roi_col1, roi_col2, roi_col3, roi_col4 = st.columns(4)

    with roi_col1:
        st.metric("Review Hours Saved", f"{roi['review_hours_saved']} hrs")

    with roi_col2:
        st.metric("Self-Heal Savings", f"${roi['self_heal_savings']:,.0f}")

    with roi_col3:
        st.metric("Review Savings", f"${roi['review_savings']:,.0f}")

    with roi_col4:
        st.metric("Total Savings", f"${roi['total_savings']:,.0f}", delta="estimated")

    # Charts row
    st.header("📊 Analytics")
    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:
        # Events by type pie chart
        event_counts = df["event"].value_counts().reset_index()
        event_counts.columns = ["Event", "Count"]

        fig_pie = px.pie(
            event_counts,
            values="Count",
            names="Event",
            title="Events by Type",
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    with chart_col2:
        # Risk distribution bar chart
        risk_df = df[df["risk_level"] != ""]["risk_level"].value_counts().reset_index()
        risk_df.columns = ["Risk Level", "Count"]

        if not risk_df.empty:
            # Order risk levels
            risk_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            risk_df["Risk Level"] = pd.Categorical(
                risk_df["Risk Level"], categories=risk_order, ordered=True
            )
            risk_df = risk_df.sort_values("Risk Level")

            color_map = {
                "LOW": "#28a745",
                "MEDIUM": "#ffc107",
                "HIGH": "#fd7e14",
                "CRITICAL": "#dc3545",
            }

            fig_bar = px.bar(
                risk_df,
                x="Risk Level",
                y="Count",
                title="Risk Distribution",
                color="Risk Level",
                color_discrete_map=color_map,
            )
            st.plotly_chart(fig_bar, use_container_width=True)
        else:
            st.info("No risk data available yet")

    # Timeline chart
    st.header("📈 Activity Timeline")

    # Group by date
    df["date"] = df["ts"].dt.date
    daily_counts = df.groupby("date").size().reset_index(name="Events")

    fig_timeline = px.line(
        daily_counts,
        x="date",
        y="Events",
        title="Daily AI Events",
        markers=True,
    )
    fig_timeline.update_layout(xaxis_title="Date", yaxis_title="Events")
    st.plotly_chart(fig_timeline, use_container_width=True)

    # Recent events table
    st.header("📋 Recent Events")

    recent_df = df.head(20)[["ts", "event", "details", "pr_number", "risk_level"]]
    recent_df.columns = ["Timestamp", "Event", "Details", "PR", "Risk"]

    st.dataframe(
        recent_df,
        use_container_width=True,
        hide_index=True,
    )

    # Self-heal performance
    st.header("🔧 Self-Heal Performance")
    heal_col1, heal_col2 = st.columns(2)

    with heal_col1:
        # Success vs Failed gauge
        total_heals = metrics["self_heals_success"] + metrics["self_heals_failed"]
        if total_heals > 0:
            fig_gauge = go.Figure(
                go.Indicator(
                    mode="gauge+number",
                    value=metrics["self_heals_success"] / total_heals * 100,
                    title={"text": "Self-Heal Success Rate"},
                    gauge={
                        "axis": {"range": [0, 100]},
                        "bar": {"color": "#28a745"},
                        "steps": [
                            {"range": [0, 50], "color": "#dc3545"},
                            {"range": [50, 75], "color": "#ffc107"},
                            {"range": [75, 100], "color": "#d4edda"},
                        ],
                    },
                    number={"suffix": "%"},
                )
            )
            st.plotly_chart(fig_gauge, use_container_width=True)
        else:
            st.info("No self-heal events yet")

    with heal_col2:
        st.subheader("Self-Heal Stats")
        st.write(f"**Successful Heals:** {metrics['self_heals_success']}")
        st.write(f"**Failed Heals:** {metrics['self_heals_failed']}")
        st.write(f"**Rule Violations Caught:** {metrics['rule_violations']}")

        if metrics["self_heals_success"] > 0:
            estimated_hours = metrics["self_heals_success"] * 0.5  # 30 min each
            st.write(f"**Estimated Hours Saved:** {estimated_hours:.1f} hrs")

    # Footer
    st.markdown("---")
    st.caption(
        f"Data from: {DB_PATH} | "
        f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )


if __name__ == "__main__":
    main()
