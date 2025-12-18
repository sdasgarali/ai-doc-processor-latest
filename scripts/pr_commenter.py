"""
PR Commenter - GitHub PR commenting utility.

Posts comments to GitHub Pull Requests via API.
No external dependencies - uses stdlib only.
"""

import json
import os
import urllib.request

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY")
PR_NUMBER = os.getenv("PR_NUMBER")


def post_pr_comment(body: str) -> None:
    """
    Post a comment to the current PR.

    Args:
        body: Comment body (supports GitHub markdown)
    """
    if not all([GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER]):
        print("[WARNING] Missing GitHub context. Skipping PR comment.")
        return

    url = f"https://api.github.com/repos/{GITHUB_REPOSITORY}/issues/{PR_NUMBER}/comments"

    payload = {"body": body}

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )

    try:
        urllib.request.urlopen(req, timeout=10)  # noqa: S310
        print("[OK] PR comment posted.")
    except Exception as e:
        print(f"[WARNING] Failed to post PR comment: {e}")
