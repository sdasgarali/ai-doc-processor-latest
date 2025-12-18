# AI Rules Folder

This folder defines how AI tools (Claude Code, etc.) must behave inside this repository.

These rules are:
- **Persistent** – remain in effect across all sessions
- **Explicit** – no ambiguity in requirements
- **Enforced by CI/CD** – violations fail the pipeline

---

## Contents

| File | Purpose |
|------|---------|
| `CLAUDE_RULES.md` | Mandatory contract for Claude Code |
| `BOOTSTRAP_PROMPT.md` | One-time initialization prompt per repo |
| `AI_CHANGELOG.md` | Audit trail of AI-assisted changes |
| `README.md` | This file |

---

## Usage

1. **New Session**: Paste `BOOTSTRAP_PROMPT.md` into Claude Code
2. **During Work**: Follow `CLAUDE_RULES.md` strictly
3. **After Changes**: Log significant work in `AI_CHANGELOG.md`

---

## Modification Policy

> **Do not modify without architectural approval.**

Changes to this folder require:
- Explicit approval from repository owner
- Documentation of the change rationale
- Update to AI_CHANGELOG.md
