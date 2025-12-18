# Autonomous CI/CD Template

[![CI Pipeline](https://github.com/YOUR_USERNAME/autonomous-cicd-template/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/autonomous-cicd-template/actions/workflows/ci.yml)
[![Security Scans](https://github.com/YOUR_USERNAME/autonomous-cicd-template/actions/workflows/security.yml/badge.svg)](https://github.com/YOUR_USERNAME/autonomous-cicd-template/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready CI/CD pipeline template with AI-assisted code review, security scanning, and automated deployments.

## Features

- **AI-Powered Code Review** - Automated PR reviews using Claude Code
- **Fail-Closed CI Gates** - Lint, tests, coverage, and security scans block merges
- **Fail-Open AI Steps** - AI failures don't block your pipeline
- **Model-Agnostic AI** - Swap providers (Groq, OpenAI, Anthropic) without code changes
- **Enterprise-Ready** - SOC-2/HIPAA compliance patterns built-in
- **Audit Trail** - Track all AI-assisted changes

## Quick Start

### 1. Use This Template

Click "Use this template" on GitHub to create your repository.

### 2. Configure Secrets

Add these secrets to your repository:

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | For AI code review |
| `GROQ_API_KEY` | Optional | Default AI provider |

### 3. Initialize Claude Code

Paste this into Claude Code at session start:

```
You are Claude Code working inside this repository.

Before doing anything:
1. Read `.ai/CLAUDE_RULES.md`
2. Acknowledge the rules silently
3. Follow them strictly for all future tasks
```

### 4. Start Developing

```bash
# Install dependencies
make install

# Run tests
make test

# Run linters
make lint

# Full CI check
make ci
```

## Project Structure

```
autonomous-cicd-template/
├── .ai/                    # AI rules and configuration
│   ├── CLAUDE_RULES.md     # Mandatory AI contract
│   ├── BOOTSTRAP_PROMPT.md # Session initialization
│   ├── AI_CHANGELOG.md     # Audit trail
│   └── README.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # Main CI pipeline (fail-closed)
│   │   ├── ai-review.yml   # AI code review (fail-open)
│   │   ├── cd-staging.yml  # Deploy to staging
│   │   ├── cd-prod.yml     # Deploy to production
│   │   └── security.yml    # Security scans (fail-closed)
│   └── CODEOWNERS
├── src/                    # Application source code
├── tests/                  # Test suite
├── scripts/
│   └── ai_engine.py        # AI provider logic (ONLY location)
├── requirements.txt
├── Makefile
├── Dockerfile
├── .env.example
└── README.md
```

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Behavior |
|----------|---------|----------|
| `ci.yml` | Push, PR | **Fail-closed** - Blocks on lint/test/coverage failures |
| `ai-review.yml` | PR | **Fail-open** - AI review doesn't block merge |
| `security.yml` | Push, PR, Daily | **Fail-closed** - Blocks on security issues |
| `cd-staging.yml` | Push to main | Auto-deploy to staging |
| `cd-prod.yml` | Release, Manual | Deploy to production with confirmation |

### Coverage Threshold

- Minimum: **85%**
- Enforced in CI

## AI Provider Configuration

Default provider is **Groq**. Configure in `.env`:

```bash
AI_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

To switch providers, change `AI_PROVIDER` to `openai` or `anthropic`.

> **Important**: All AI provider logic must remain in `scripts/ai_engine.py`

## Security

- Secrets via environment variables only
- Daily vulnerability scans
- Secret scanning on every commit
- License compliance checks
- Container scanning for production images

## Contributing

1. Read `.ai/CLAUDE_RULES.md` before contributing
2. All PRs require passing CI checks
3. AI-assisted changes must be logged in `.ai/AI_CHANGELOG.md`
4. Security-sensitive changes require `@security` review

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with AI assistance** - See `.ai/AI_CHANGELOG.md` for audit trail.
