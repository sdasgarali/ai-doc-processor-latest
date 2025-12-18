"""
AI Metrics Tracker.

Lightweight SQLite-based metrics for AI activity tracking.
Used for ROI dashboards and leadership reporting.

Events tracked:
- self_heal_success / self_heal_failed
- ai_review_completed
- rule_violation_detected
- risk_classified
- auto_merge_enabled
"""

import sqlite3
from datetime import datetime
from pathlib import Path

# Database location (repo-local)
DB_PATH = Path(__file__).parent.parent / ".ai" / "ai_metrics.db"


def _get_connection() -> sqlite3.Connection:
    """Get database connection, creating tables if needed."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            event TEXT NOT NULL,
            details TEXT,
            pr_number TEXT,
            risk_level TEXT,
            duration_ms INTEGER
        )
    """)
    conn.commit()
    return conn


def record(
    event: str,
    details: str = "",
    pr_number: str = "",
    risk_level: str = "",
    duration_ms: int = 0,
) -> None:
    """
    Record an AI event for metrics tracking.

    Args:
        event: Event type (e.g., 'self_heal_success', 'rule_violation_detected')
        details: Additional context
        pr_number: Associated PR number
        risk_level: Risk classification (LOW/MEDIUM/HIGH/CRITICAL)
        duration_ms: How long the operation took
    """
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO events (ts, event, details, pr_number, risk_level, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.utcnow().isoformat(),
                event,
                details,
                pr_number,
                risk_level,
                duration_ms,
            ),
        )
        conn.commit()
        conn.close()
        print(f"[METRICS] Recorded: {event}")
    except Exception as e:
        # Don't fail the main operation if metrics fail
        print(f"[METRICS] Warning: Could not record event: {e}")


def get_stats() -> dict:
    """Get summary statistics for dashboard."""
    try:
        conn = _get_connection()
        cursor = conn.cursor()

        stats = {}

        # Total events
        cursor.execute("SELECT COUNT(*) FROM events")
        stats["total_events"] = cursor.fetchone()[0]

        # Events by type
        cursor.execute("""
            SELECT event, COUNT(*) as count
            FROM events
            GROUP BY event
            ORDER BY count DESC
        """)
        stats["events_by_type"] = dict(cursor.fetchall())

        # Risk distribution
        cursor.execute("""
            SELECT risk_level, COUNT(*) as count
            FROM events
            WHERE risk_level != ''
            GROUP BY risk_level
        """)
        stats["risk_distribution"] = dict(cursor.fetchall())

        # Self-heal success rate
        cursor.execute("SELECT COUNT(*) FROM events WHERE event = 'self_heal_success'")
        successes = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM events WHERE event LIKE 'self_heal%'")
        total_heals = cursor.fetchone()[0]
        stats["self_heal_success_rate"] = (
            round(successes / total_heals * 100, 1) if total_heals > 0 else 0
        )

        # Recent events
        cursor.execute("""
            SELECT ts, event, details, pr_number
            FROM events
            ORDER BY ts DESC
            LIMIT 10
        """)
        stats["recent_events"] = cursor.fetchall()

        conn.close()
        return stats
    except Exception as e:
        return {"error": str(e)}
