# AI Governance Controller

Org-wide governance enforcement for AI-assisted repositories.

## Purpose

This controller ensures all repositories in your organization comply with AI governance requirements:

- Required files exist (`.ai/CLAUDE_RULES.md`, CI workflows, etc.)
- Required concepts are documented (fail-closed gates, coverage thresholds, etc.)
- Drift detection with Slack alerts

## Setup

1. **Create a dedicated repo** for the controller (e.g., `ai-governance-controller`)
2. **Copy this directory** to the new repo
3. **Configure repos.yaml** with your organization and repositories
4. **Set secrets**:
   - `GOVERNANCE_TOKEN`: GitHub PAT with `repo` scope for all target repos
   - `SLACK_WEBHOOK_URL`: Slack incoming webhook for alerts

## Usage

### Manual Check

```bash
export GITHUB_TOKEN=your_pat_here
python controller.py
```

### Automated (GitHub Actions)

The workflow runs nightly at 2 AM UTC. Configure the schedule in:
`.github/workflows/governance-check.yml`

## Configuration

Edit `repos.yaml`:

```yaml
org: your-github-org

repositories:
  - repo-1
  - repo-2

required_files:
  - .ai/CLAUDE_RULES.md
  - .github/workflows/ci.yml

required_concepts:
  - "fail-closed"
  - "coverage.*85"
```

## Output

- Console output with pass/fail status
- `compliance_report.md` with detailed findings
- Slack alert for any non-compliant repositories

## Security

- Uses GitHub API with authenticated requests
- Never stores or logs tokens
- Read-only access to repositories
