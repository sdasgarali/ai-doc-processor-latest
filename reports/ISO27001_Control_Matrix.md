# ISO 27001:2022 Annex A - CI/CD Governance Mapping

This document maps our CI/CD and AI governance controls to ISO 27001:2022 Annex A controls.

## Executive Summary

| Category | Controls | Implemented | Coverage |
|----------|----------|-------------|----------|
| A.5 (Organizational) | 3 | 3 | 100% |
| A.8 (Technological) | 11 | 11 | 100% |
| A.16 (Incident) | 1 | 1 | 100% |
| **Total** | **15** | **15** | **100%** |

---

## A.5 - Organizational Controls

### A.5.1 - Information Security Policies

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Policies for information security | |
| **Implementation** | AI governance rules, Auto-merge policy | `.ai/CLAUDE_RULES.md` |
| **Evidence** | Policy is version-controlled and enforced | `.ai/AUTO_MERGE_POLICY.yaml` |
| **Status** | Implemented | |

### A.5.8 - Security in Project Management

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Security integrated into project management | |
| **Implementation** | Security scans in CI, AI security review | `.github/workflows/security.yml` |
| **Evidence** | Risk classification on all PRs | `scripts/ai_rules_audit.py` |
| **Status** | Implemented | |

### A.5.15 - Access Control

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Access to information is restricted | |
| **Implementation** | GitHub auth, CODEOWNERS | `.github/CODEOWNERS` |
| **Evidence** | Branch protection rules | |
| **Status** | Implemented | |

---

## A.8 - Technological Controls

### A.8.4 - Access to Source Code

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Source code access is restricted | |
| **Implementation** | GitHub access controls, CODEOWNERS | `.github/CODEOWNERS` |
| **Evidence** | PR approval requirements | |
| **Status** | Implemented | |

### A.8.8 - Vulnerability Management

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Technical vulnerabilities are addressed | |
| **Implementation** | Bandit, pip-audit, Safety scans | `.github/workflows/security.yml` |
| **Evidence** | Weekly scheduled scans | |
| **Status** | Implemented | |

### A.8.9 - Configuration Management

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Configurations are maintained | |
| **Implementation** | Version-controlled CI/CD, IaC | `.github/workflows/`, `pyproject.toml` |
| **Evidence** | Pre-commit hooks | `.pre-commit-config.yaml` |
| **Status** | Implemented | |

### A.8.25 - Secure Development Lifecycle

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Security throughout development | |
| **Implementation** | Pre-commit hooks, CI security gates | `.pre-commit-config.yaml` |
| **Evidence** | AI security review | `.github/workflows/ai-review.yml` |
| **Status** | Implemented | |

### A.8.26 - Application Security Requirements

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Security requirements implemented | |
| **Implementation** | AI governance rules, Security scans | `.ai/CLAUDE_RULES.md` |
| **Evidence** | 85% coverage requirement | `pyproject.toml` |
| **Status** | Implemented | |

### A.8.27 - Secure System Architecture

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Security in system design | |
| **Implementation** | AI provider abstraction, Fail-closed gates | `scripts/ai_engine.py` |
| **Evidence** | Defense in depth | `.github/workflows/ci.yml` |
| **Status** | Implemented | |

### A.8.28 - Secure Coding

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Secure coding principles | |
| **Implementation** | Ruff security rules, Bandit | `pyproject.toml` |
| **Evidence** | Pre-commit hooks | `.pre-commit-config.yaml` |
| **Status** | Implemented | |

### A.8.29 - Security Testing

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Security testing during development | |
| **Implementation** | Security scans on PRs | `.github/workflows/security.yml` |
| **Evidence** | AI security review | `.github/workflows/ai-review.yml` |
| **Status** | Implemented | |

### A.8.31 - Environment Separation

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Dev/Test/Prod separation | |
| **Implementation** | Staging and prod workflows | `.github/workflows/cd-staging.yml` |
| **Evidence** | Production gates | `.github/workflows/cd-prod.yml` |
| **Status** | Implemented | |

### A.8.32 - Change Management

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Changes are controlled | |
| **Implementation** | PR workflow, AI governance | `.ai/CLAUDE_RULES.md` |
| **Evidence** | Audit trail | `.ai/AI_CHANGELOG.md` |
| **Status** | Implemented | |

---

## A.16 - Incident Management

### A.16.1 - Incident Management

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| **Control** | Incidents are managed effectively | |
| **Implementation** | CI alerts, Self-healing agent | `scripts/pr_self_heal.py` |
| **Evidence** | Slack notifications | `scripts/slack_notifier.py` |
| **Status** | Implemented | |

---

## Evidence Package

Generate evidence package:
```bash
python scripts/export_compliance_evidence.py
```

## Audit Questionnaire

Generate audit answers:
```bash
python scripts/generate_audit_answers.py
```

---

*Last updated: Auto-generated from `.ai/COMPLIANCE/ISO27001_MAPPING.yaml`*
