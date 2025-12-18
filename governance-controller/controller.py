#!/usr/bin/env python3
"""
Org-Wide Governance Controller.

Validates that all repositories in the org comply with AI governance requirements.
Run nightly via GitHub Actions or manually.

Features:
- Checks for required files in each repo
- Validates content patterns in CLAUDE_RULES.md
- Sends Slack alerts on compliance drift
- Generates compliance report
"""

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import yaml


@dataclass
class ComplianceResult:
    """Result of compliance check for a single repo."""

    repo: str
    compliant: bool
    missing_files: list[str]
    missing_concepts: list[str]
    error: str | None = None


def load_config() -> dict[str, Any]:
    """Load governance configuration."""
    config_path = Path(__file__).parent / "repos.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")
    return yaml.safe_load(config_path.read_text())


def github_api_get(url: str, token: str) -> dict[str, Any] | None:
    """Make authenticated GET request to GitHub API."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Governance-Controller",
    }

    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        if e.code == 404:
            return None
        raise


def check_file_exists(org: str, repo: str, filepath: str, token: str) -> bool:
    """Check if a file exists in a repository."""
    url = f"https://api.github.com/repos/{org}/{repo}/contents/{filepath}"
    result = github_api_get(url, token)
    return result is not None


def get_file_content(org: str, repo: str, filepath: str, token: str) -> str | None:
    """Get file content from repository."""
    import base64

    url = f"https://api.github.com/repos/{org}/{repo}/contents/{filepath}"
    result = github_api_get(url, token)
    if result and "content" in result:
        return base64.b64decode(result["content"]).decode("utf-8")
    return None


def check_repo_compliance(
    org: str,
    repo: str,
    required_files: list[str],
    required_concepts: list[str],
    token: str,
) -> ComplianceResult:
    """Check if a repository is compliant with governance requirements."""
    missing_files = []
    missing_concepts = []

    try:
        # Check required files
        for filepath in required_files:
            if not check_file_exists(org, repo, filepath, token):
                missing_files.append(filepath)

        # Check required concepts in CLAUDE_RULES.md
        if ".ai/CLAUDE_RULES.md" not in missing_files:
            content = get_file_content(org, repo, ".ai/CLAUDE_RULES.md", token)
            if content:
                for concept in required_concepts:
                    if not re.search(concept, content, re.IGNORECASE):
                        missing_concepts.append(concept)

        compliant = len(missing_files) == 0 and len(missing_concepts) == 0

        return ComplianceResult(
            repo=repo,
            compliant=compliant,
            missing_files=missing_files,
            missing_concepts=missing_concepts,
        )

    except Exception as e:
        return ComplianceResult(
            repo=repo,
            compliant=False,
            missing_files=[],
            missing_concepts=[],
            error=str(e),
        )


def send_slack_alert(webhook_url: str, results: list[ComplianceResult]) -> None:
    """Send Slack alert for non-compliant repos."""
    non_compliant = [r for r in results if not r.compliant]

    if not non_compliant:
        return

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "[!] AI Governance Drift Detected",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{len(non_compliant)} repository(s) out of compliance*",
            },
        },
    ]

    for result in non_compliant:
        issues = []
        if result.missing_files:
            issues.append(f"Missing files: {', '.join(result.missing_files)}")
        if result.missing_concepts:
            issues.append(f"Missing concepts: {', '.join(result.missing_concepts)}")
        if result.error:
            issues.append(f"Error: {result.error}")

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{result.repo}*\n" + "\n".join(f"- {i}" for i in issues),
            },
        })

    payload = json.dumps({"blocks": blocks}).encode()
    req = Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=10) as response:
            if response.status != 200:
                print(f"Slack alert failed: {response.status}")
    except Exception as e:
        print(f"Slack alert error: {e}")


def generate_report(results: list[ComplianceResult]) -> str:
    """Generate compliance report."""
    lines = [
        "# AI Governance Compliance Report",
        "",
        f"Total repositories: {len(results)}",
        f"Compliant: {sum(1 for r in results if r.compliant)}",
        f"Non-compliant: {sum(1 for r in results if not r.compliant)}",
        "",
        "## Details",
        "",
    ]

    for result in results:
        status = "[OK]" if result.compliant else "[FAIL]"
        lines.append(f"### {status} {result.repo}")

        if result.compliant:
            lines.append("All governance requirements met.")
        else:
            if result.missing_files:
                lines.append(f"- Missing files: {', '.join(result.missing_files)}")
            if result.missing_concepts:
                lines.append(f"- Missing concepts: {', '.join(result.missing_concepts)}")
            if result.error:
                lines.append(f"- Error: {result.error}")

        lines.append("")

    return "\n".join(lines)


def main() -> int:
    """Run governance compliance check."""
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("Error: GITHUB_TOKEN environment variable required")
        return 1

    try:
        config = load_config()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    org = config["org"]
    repos = config.get("repositories", [])
    required_files = config.get("required_files", [])
    required_concepts = config.get("required_concepts", [])

    print(f"Checking {len(repos)} repositories in {org}...")
    print("=" * 50)

    results = []
    for repo in repos:
        print(f"Checking {repo}...", end=" ")
        result = check_repo_compliance(
            org, repo, required_files, required_concepts, token
        )
        results.append(result)

        if result.compliant:
            print("[OK]")
        else:
            print("[FAIL]")
            if result.missing_files:
                print(f"  Missing files: {result.missing_files}")
            if result.missing_concepts:
                print(f"  Missing concepts: {result.missing_concepts}")
            if result.error:
                print(f"  Error: {result.error}")

    print("=" * 50)

    # Generate report
    report = generate_report(results)
    report_path = Path(__file__).parent / "compliance_report.md"
    report_path.write_text(report)
    print(f"Report saved to: {report_path}")

    # Send Slack alert if configured
    slack_env = config.get("notifications", {}).get("slack_webhook_env")
    if slack_env:
        webhook_url = os.getenv(slack_env)
        if webhook_url:
            send_slack_alert(webhook_url, results)

    # Exit with error if any non-compliant
    non_compliant = [r for r in results if not r.compliant]
    if non_compliant:
        print(f"\n[!] {len(non_compliant)} repository(s) out of compliance!")
        return 1

    print("\n[OK] All repositories compliant!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
