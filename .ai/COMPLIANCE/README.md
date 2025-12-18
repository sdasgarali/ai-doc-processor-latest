# Compliance Framework

This directory contains compliance control mappings for SOC-2, ISO 27001, HIPAA, and HITRUST audits.

## Overview

The compliance framework maps CI/CD and AI governance controls to regulatory requirements:

| Framework | Directory/File | Report |
|-----------|----------------|--------|
| SOC-2 Type I | `SOC2_MAPPING.yaml` | `reports/SOC2_Control_Matrix.md` |
| SOC-2 Type II | `SOC2_TYPE2_CONTROLS.yaml` | `reports/SOC2_TypeII_Evidence_Report.md` |
| ISO 27001 | `ISO27001_MAPPING.yaml` | `reports/ISO27001_Control_Matrix.md` |
| ISO Risk Register | `ISO_RISK_REGISTER.yaml` | `reports/ISO_Risk_Register_Report.md` |
| HIPAA | `HIPAA/` | `reports/HIPAA_Compliance_Report.md` |
| HITRUST CSF | `HITRUST/` | `reports/HITRUST_Readiness_Report.md` |
| Security Questionnaires | `QUESTIONNAIRES/` | Generated on demand |
| Compliance Score | `COMPLIANCE_SCORE.yaml` | `reports/compliance_score.json` |
| Audit Q&A | `CONTROL_EVIDENCE.yaml` | Generated on demand |

## Files

### SOC2_MAPPING.yaml

Maps controls to SOC-2 Trust Service Criteria:
- **CC6**: Logical and Physical Access Controls
- **CC7**: System Operations
- **CC8**: Change Management

### ISO27001_MAPPING.yaml

Maps controls to ISO 27001:2022 Annex A:
- **A.5**: Organizational Controls
- **A.8**: Technological Controls
- **A.16**: Incident Management

### CONTROL_EVIDENCE.yaml

Pre-written answers to common audit questions with evidence references.

### SOC2_TYPE2_CONTROLS.yaml

SOC-2 Type II configuration for proving controls operated **over time**:
- Evidence collection settings
- Control frequencies
- Audit thresholds

### SOC2_EVIDENCE_LOG.yaml

Living evidence log that grows automatically:
- Timestamps of control operations
- References to PRs, commits, incidents
- Actor and details tracking

### ISO_RISK_REGISTER.yaml

Living ISO 27001 risk register:
- Risk identification and scoring
- Control mappings
- Treatment status (Mitigated/Accepted/Open)

## Usage

### Generate Audit Answers

```bash
# All questions
python scripts/generate_audit_answers.py

# Filter by framework
python scripts/generate_audit_answers.py --framework SOC2
python scripts/generate_audit_answers.py --framework ISO27001

# Output to file
python scripts/generate_audit_answers.py --output audit_answers.md --format markdown

# Show summary
python scripts/generate_audit_answers.py --summary
```

### Export Evidence Package

```bash
# Create evidence ZIP
python scripts/export_compliance_evidence.py

# Custom output path
python scripts/export_compliance_evidence.py --output evidence.zip

# List files (dry run)
python scripts/export_compliance_evidence.py --list
```

### View Control Matrix

- SOC-2: `reports/SOC2_Control_Matrix.md`
- ISO 27001: `reports/ISO27001_Control_Matrix.md`

### SOC-2 Type II Evidence Collection

```bash
# Record evidence (called from CI/CD)
python scripts/collect_type2_evidence.py \
  --control CC6.6 \
  --event "PR merged" \
  --repo myrepo \
  --ref "PR #123"

# Generate evidence report
python scripts/collect_type2_evidence.py --report

# Show statistics
python scripts/collect_type2_evidence.py --stats
```

### ISO Risk Register Management

```bash
# Validate risk register
python scripts/update_risk_register.py --validate

# Check overdue reviews
python scripts/update_risk_register.py --check-reviews

# Generate report
python scripts/update_risk_register.py --report

# Update a risk status
python scripts/update_risk_register.py --update R-001 --status Mitigated

# Show summary
python scripts/update_risk_register.py --summary
```

### Customer Trust Portal

```bash
# Generate trust portal data
python scripts/generate_trust_portal_data.py

# Serve locally
cd trust-portal && python -m http.server 8000
```

Host via GitHub Pages, Vercel, or internal portal.

## Evidence Package Contents

The exported evidence package includes:

1. **AI Governance**
   - `.ai/CLAUDE_RULES.md` - AI behavior contract
   - `.ai/AUTO_MERGE_POLICY.yaml` - Auto-merge policy
   - `.ai/AI_CHANGELOG.md` - Audit trail

2. **Compliance Mappings**
   - Control mapping YAML files
   - Pre-written audit answers

3. **CI/CD Controls**
   - GitHub Actions workflows
   - Configuration files

4. **Access Controls**
   - CODEOWNERS file

5. **Manifest**
   - SHA-256 hashes for integrity verification
   - File metadata and timestamps

## Maintaining Compliance

### Quarterly Review

1. Review control mappings for accuracy
2. Update evidence references if files change
3. Verify audit answers are current
4. Regenerate control matrix reports

### After Significant Changes

1. Update relevant mapping YAML files
2. Add new evidence references
3. Update `CONTROL_EVIDENCE.yaml` if Q&A affected
4. Commit changes with audit trail entry

### Audit Preparation

1. Run `python scripts/export_compliance_evidence.py`
2. Generate audit answers: `python scripts/generate_audit_answers.py --format markdown --output audit_answers.md`
3. Review control matrices
4. Prepare any additional context auditors may need

## Control Coverage

### SOC-2 Coverage

| Criteria | Controls | Status |
|----------|----------|--------|
| CC6.1 | Logical access | Implemented |
| CC6.2 | Authentication | Implemented |
| CC6.3 | Access removal | Implemented |
| CC6.6 | Change management | Implemented |
| CC6.7 | Infrastructure changes | Implemented |
| CC7.1 | Monitoring | Implemented |
| CC7.2 | Incident response | Implemented |
| CC7.3 | Change testing | Implemented |
| CC7.4 | Configuration | Implemented |
| CC8.1 | Change authorization | Implemented |

### ISO 27001 Coverage

| Control | Description | Status |
|---------|-------------|--------|
| A.5.1 | Security policies | Implemented |
| A.5.8 | Project security | Implemented |
| A.5.15 | Access control | Implemented |
| A.8.4 | Source code access | Implemented |
| A.8.8 | Vulnerability mgmt | Implemented |
| A.8.9 | Configuration mgmt | Implemented |
| A.8.25 | Secure SDLC | Implemented |
| A.8.26 | Security requirements | Implemented |
| A.8.27 | Secure architecture | Implemented |
| A.8.28 | Secure coding | Implemented |
| A.8.29 | Security testing | Implemented |
| A.8.31 | Environment separation | Implemented |
| A.8.32 | Change management | Implemented |
| A.16.1 | Incident management | Implemented |

## HIPAA Compliance

Healthcare-specific compliance for systems that may process ePHI.

### HIPAA Files

| File | Description |
|------|-------------|
| `HIPAA/HIPAA_SAFEGUARDS.yaml` | Administrative, Physical, Technical safeguards mapping |
| `HIPAA/HIPAA_RISK_ASSESSMENT.yaml` | HIPAA-specific risk assessment |
| `HIPAA/HIPAA_EVIDENCE.yaml` | Evidence collection log |

### HIPAA Report Generation

```bash
# Quick status
python scripts/generate_hipaa_report.py --status

# Detailed report
python scripts/generate_hipaa_report.py --detailed

# Validate safeguards mapping
python scripts/generate_hipaa_report.py --validate

# Output to file
python scripts/generate_hipaa_report.py --output reports/hipaa_report.md
```

### HIPAA Coverage

| Safeguard Type | Implemented | Not Applicable |
|----------------|-------------|----------------|
| Administrative (164.308) | 8 | 0 |
| Physical (164.310) | 1 | 3 |
| Technical (164.312) | 5 | 0 |

---

## HITRUST CSF Compliance

HITRUST Common Security Framework alignment for healthcare and high-security environments.

### HITRUST Files

| File | Description |
|------|-------------|
| `HITRUST/HITRUST_CSFS_MAPPING.yaml` | CSF control mapping to CI/CD |
| `HITRUST/HITRUST_MATURITY.yaml` | Maturity assessment by domain |
| `HITRUST/HITRUST_EVIDENCE.yaml` | Evidence collection log |

### HITRUST Report Generation

```bash
# Quick status
python scripts/generate_hitrust_report.py --status

# Maturity assessment
python scripts/generate_hitrust_report.py --maturity

# Detailed report
python scripts/generate_hitrust_report.py --detailed

# Validate CSF mapping
python scripts/generate_hitrust_report.py --validate

# Output to file
python scripts/generate_hitrust_report.py --output reports/hitrust_report.md
```

### HITRUST Certification Readiness

| Certification | Status | Gaps |
|---------------|--------|------|
| HITRUST e1 | Ready | 0 |
| HITRUST i1 | Near Ready | 3 |
| HITRUST r2 | Ready | 2 |

---

## Security Questionnaires

Pre-written answers for common security questionnaires.

### Available Questionnaires

| Questionnaire | File | Questions |
|---------------|------|-----------|
| SIG (Standardized Information Gathering) | `QUESTIONNAIRES/SIG.yaml` | 12 |
| CAIQ (CSA Consensus Assessment) | `QUESTIONNAIRES/CAIQ.yaml` | 18 |

### Questionnaire Usage

```bash
# List available questionnaires
python scripts/generate_questionnaire_answers.py --list

# Generate all SIG answers
python scripts/generate_questionnaire_answers.py --questionnaire SIG

# Generate CAIQ answers for specific category
python scripts/generate_questionnaire_answers.py --questionnaire CAIQ --category "AI Governance"

# Export to markdown
python scripts/generate_questionnaire_answers.py --questionnaire SIG --output sig_answers.md

# Search across all questionnaires
python scripts/generate_questionnaire_answers.py --search "risk management"
```

---

## Compliance Score Engine

Continuous compliance health scoring (0-100).

### Score Components

| Component | Weight | Source |
|-----------|--------|--------|
| SOC-2 Controls | 25% | SOC2_MAPPING.yaml |
| ISO 27001 Controls | 20% | ISO27001_MAPPING.yaml |
| Risk Management | 20% | ISO_RISK_REGISTER.yaml |
| Evidence Collection | 15% | SOC2_EVIDENCE_LOG.yaml |
| CI/CD Compliance | 10% | Workflow file checks |
| Questionnaire Readiness | 10% | QUESTIONNAIRES/*.yaml |

### Compliance Score Usage

```bash
# Calculate and display score
python scripts/compliance_score_engine.py

# Detailed breakdown
python scripts/compliance_score_engine.py --verbose

# JSON output
python scripts/compliance_score_engine.py --json

# Save report
python scripts/compliance_score_engine.py --output reports/compliance_score.json

# Generate SVG badge
python scripts/compliance_score_engine.py --badge reports/compliance_badge.svg
```

---

## Auditor Packet Generation

Generate auditor-ready artifacts for SOC-2 Type II audits.

```bash
# Generate all artifacts
python scripts/generate_auditor_packet.py

# Custom output directory
python scripts/generate_auditor_packet.py --output-dir reports/auditor

# Outputs:
# - SOC2_TypeII_Evidence.xlsx (Excel evidence table)
# - SOC2_TypeII_Auditor_Packet.pdf (PDF narrative)
# - SOC2_TypeII_Summary.md (Markdown summary)
```

---

## Questions?

Contact your security team for additional guidance.
