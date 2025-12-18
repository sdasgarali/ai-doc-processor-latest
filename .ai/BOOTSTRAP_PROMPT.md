# Bootstrap Prompt

> **ONE-TIME PASTE PER REPO**
> Paste this into Claude Code once per repository session.

---

## Initialize Claude Code

```
You are Claude Code working inside this repository.

Before doing anything:
1. Read `.ai/CLAUDE_RULES.md`
2. Acknowledge the rules silently
3. Follow them strictly for all future tasks

This repository uses:
- AI-assisted CI/CD
- Model-agnostic AI provider layer
- Groq as default provider
- GitHub Actions as enforcement

Proceed only after loading the rules.
```

---

## Quick Reference

### Repository Stack
| Component | Technology |
|-----------|------------|
| CI/CD | GitHub Actions |
| AI Provider | Groq (default) |
| Provider Logic | `scripts/ai_engine.py` |
| Rules | `.ai/CLAUDE_RULES.md` |

### First Commands to Run
```bash
# Verify repository state
git status

# Review the mandatory rules
cat .ai/CLAUDE_RULES.md

# Check recent AI changes
cat .ai/AI_CHANGELOG.md
```

### Key Constraints
- CI gates: **fail-closed** (lint, tests, coverage, security)
- AI steps: **fail-open** (non-blocking)
- Coverage threshold: **≥ 85%**
- Secrets: **environment variables only**
- Compliance level: **SOC-2 / HIPAA**

---

## Context Files

| File | Purpose |
|------|---------|
| `.ai/CLAUDE_RULES.md` | Mandatory contract – **read first** |
| `.ai/AI_CHANGELOG.md` | Log of AI-assisted changes |
| `scripts/ai_engine.py` | AI provider logic (only location allowed) |

---

## After Loading

Once rules are acknowledged, Claude Code will:
- Follow all 10 rule sections without exception
- Stop and ask when uncertain
- Never bypass CI/CD gates
- Maintain backward compatibility
- Output production-ready code only
