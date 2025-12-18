"""
Slack Notifier - Reusable notification utility.

Sends formatted messages to Slack via webhook.
No external dependencies - uses stdlib only.
"""

import json
import os
import urllib.request

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")


def notify_slack(title: str, message: str, color: str = "#36a64f") -> None:
    """
    Send a notification to Slack.

    Args:
        title: Message title
        message: Message body (supports Slack mrkdwn)
        color: Attachment color (hex). Defaults to green.
            - Green: #36a64f (success)
            - Yellow: #ffcc00 (warning)
            - Red: #ff0000 (error)
    """
    if not SLACK_WEBHOOK_URL:
        print("[WARNING] Slack webhook not configured. Skipping notification.")
        return

    payload = {
        "attachments": [
            {
                "color": color,
                "title": title,
                "text": message,
                "mrkdwn_in": ["text"],
            }
        ]
    }

    req = urllib.request.Request(
        SLACK_WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        urllib.request.urlopen(req, timeout=10)  # noqa: S310
        print("[OK] Slack notification sent.")
    except Exception as e:
        print(f"[WARNING] Failed to send Slack notification: {e}")
