#!/usr/bin/env python3
"""
Compliance Evidence Export.

Generates a comprehensive evidence bundle for SOC-2 and ISO 27001 auditors.
Includes control mappings, evidence files, and audit questionnaire answers.

Usage:
    python scripts/export_compliance_evidence.py
    python scripts/export_compliance_evidence.py --output custom_name.zip
"""

import argparse
import hashlib
import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent

# Evidence files to include in the package
EVIDENCE_FILES = [
    # AI Governance
    ".ai/CLAUDE_RULES.md",
    ".ai/AUTO_MERGE_POLICY.yaml",
    ".ai/AI_CHANGELOG.md",
    ".ai/BOOTSTRAP_PROMPT.md",
    # Compliance Mappings
    ".ai/COMPLIANCE/SOC2_MAPPING.yaml",
    ".ai/COMPLIANCE/ISO27001_MAPPING.yaml",
    ".ai/COMPLIANCE/CONTROL_EVIDENCE.yaml",
    # CI/CD Controls
    ".github/workflows/ci.yml",
    ".github/workflows/ai-rules-enforcement.yml",
    ".github/workflows/security.yml",
    ".github/workflows/ai-review.yml",
    ".github/workflows/auto-merge.yml",
    ".github/workflows/self-heal.yml",
    ".github/workflows/cd-staging.yml",
    ".github/workflows/cd-prod.yml",
    # Access Controls
    ".github/CODEOWNERS",
    # Configuration
    "pyproject.toml",
    ".pre-commit-config.yaml",
    # Control Matrix Reports
    "reports/SOC2_Control_Matrix.md",
    "reports/ISO27001_Control_Matrix.md",
    # Scripts (for audit trail)
    "scripts/ai_engine.py",
    "scripts/ai_rules_audit.py",
    "scripts/pr_self_heal.py",
    "scripts/slack_notifier.py",
    "scripts/ai_metrics.py",
    "scripts/policy_engine.py",
]


def calculate_sha256(filepath: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_file_metadata(filepath: Path, repo_root: Path) -> dict[str, Any]:
    """Get metadata for a file."""
    stat = filepath.stat()
    return {
        "path": str(filepath.relative_to(repo_root)),
        "size_bytes": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "sha256": calculate_sha256(filepath),
    }


def generate_manifest(
    files: list[Path],
    missing: list[str],
    repo_root: Path,
) -> dict[str, Any]:
    """Generate comprehensive manifest."""
    return {
        "metadata": {
            "generated": datetime.now().isoformat(),
            "generator": "autonomous-cicd-template/export_compliance_evidence.py",
            "version": "2.0",
            "purpose": "SOC-2 and ISO 27001 Compliance Evidence Package",
        },
        "statistics": {
            "files_included": len(files),
            "files_missing": len(missing),
            "total_expected": len(EVIDENCE_FILES),
        },
        "files": [get_file_metadata(f, repo_root) for f in files],
        "missing_files": missing,
        "frameworks": {
            "SOC2": {
                "mapping_file": ".ai/COMPLIANCE/SOC2_MAPPING.yaml",
                "control_matrix": "reports/SOC2_Control_Matrix.md",
                "criteria_covered": ["CC6", "CC7", "CC8"],
            },
            "ISO27001": {
                "mapping_file": ".ai/COMPLIANCE/ISO27001_MAPPING.yaml",
                "control_matrix": "reports/ISO27001_Control_Matrix.md",
                "annex_a_covered": ["A.5", "A.8", "A.16"],
            },
        },
        "evidence_categories": {
            "ai_governance": [
                ".ai/CLAUDE_RULES.md",
                ".ai/AUTO_MERGE_POLICY.yaml",
                ".ai/BOOTSTRAP_PROMPT.md",
            ],
            "change_management": [
                ".github/workflows/ci.yml",
                ".ai/AI_CHANGELOG.md",
            ],
            "access_control": [
                ".github/CODEOWNERS",
            ],
            "security_controls": [
                ".github/workflows/security.yml",
                ".github/workflows/ai-review.yml",
            ],
            "incident_management": [
                "scripts/pr_self_heal.py",
                "scripts/slack_notifier.py",
            ],
        },
    }


def generate_auditor_readme() -> str:
    """Generate README for auditors."""
    return f"""
================================================================================
COMPLIANCE EVIDENCE PACKAGE
================================================================================

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Repository: autonomous-cicd-template

================================================================================
PACKAGE CONTENTS
================================================================================

This package contains evidence for the following compliance frameworks:

1. SOC-2 Trust Service Criteria
   - Control mapping: .ai/COMPLIANCE/SOC2_MAPPING.yaml
   - Control matrix: reports/SOC2_Control_Matrix.md
   - Criteria: CC6 (Access), CC7 (Operations), CC8 (Change)

2. ISO 27001:2022 Annex A
   - Control mapping: .ai/COMPLIANCE/ISO27001_MAPPING.yaml
   - Control matrix: reports/ISO27001_Control_Matrix.md
   - Controls: A.5, A.8, A.16

================================================================================
EVIDENCE CATEGORIES
================================================================================

1. AI GOVERNANCE
   - CLAUDE_RULES.md: Mandatory AI behavior contract
   - AUTO_MERGE_POLICY.yaml: Policy-driven auto-merge controls
   - BOOTSTRAP_PROMPT.md: AI session initialization rules

2. CHANGE MANAGEMENT
   - ci.yml: CI/CD pipeline (fail-closed gates)
   - AI_CHANGELOG.md: AI action audit trail

3. ACCESS CONTROL
   - CODEOWNERS: Code ownership and review requirements

4. SECURITY CONTROLS
   - security.yml: Automated security scanning
   - ai-review.yml: AI-powered code review

5. INCIDENT MANAGEMENT
   - pr_self_heal.py: Automated incident remediation
   - slack_notifier.py: Incident notification system

================================================================================
FILE INTEGRITY
================================================================================

All files are hashed with SHA-256. See MANIFEST.json for verification.

To verify file integrity:
1. Extract the package
2. Compare each file's SHA-256 hash with MANIFEST.json

================================================================================
AUDIT QUESTIONNAIRE
================================================================================

Pre-written answers to common audit questions are available:

1. Open .ai/COMPLIANCE/CONTROL_EVIDENCE.yaml
2. Or run: python scripts/generate_audit_answers.py

================================================================================
CONTACT
================================================================================

For additional evidence or clarification, contact your security team.

================================================================================
"""


def create_evidence_package(output_path: str | None = None) -> tuple[str, int, int]:
    """
    Create compliance evidence ZIP package.

    Returns:
        Tuple of (output_path, files_included, files_missing)
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if output_path:
        final_path = Path(output_path)
    else:
        final_path = REPO_ROOT / f"Compliance_Evidence_Package_{timestamp}.zip"

    included_files: list[Path] = []
    missing_files: list[str] = []

    with zipfile.ZipFile(final_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filepath_str in EVIDENCE_FILES:
            filepath = REPO_ROOT / filepath_str
            if filepath.exists():
                zf.write(filepath, filepath_str)
                included_files.append(filepath)
            else:
                missing_files.append(filepath_str)

        # Generate and add manifest
        manifest = generate_manifest(included_files, missing_files, REPO_ROOT)
        manifest_json = json.dumps(manifest, indent=2)
        zf.writestr("MANIFEST.json", manifest_json)

        # Add README for auditors
        readme = generate_auditor_readme()
        zf.writestr("README.txt", readme)

    return str(final_path), len(included_files), len(missing_files)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Export compliance evidence package"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file path (default: auto-generated with timestamp)",
    )
    parser.add_argument(
        "--list",
        "-l",
        action="store_true",
        help="List files that would be included (dry run)",
    )

    args = parser.parse_args()

    if args.list:
        print("Files that would be included:")
        print("=" * 60)
        for filepath_str in EVIDENCE_FILES:
            filepath = REPO_ROOT / filepath_str
            status = "[OK]" if filepath.exists() else "[MISSING]"
            print(f"  {status} {filepath_str}")
        return 0

    print("Compliance Evidence Export")
    print("=" * 60)

    output_path, included, missing = create_evidence_package(args.output)

    print(f"\n[OK] Evidence package created: {output_path}")
    print(f"  - Files included: {included}")
    print(f"  - Files missing: {missing}")

    if missing:
        print("\nMissing files:")
        for filepath_str in EVIDENCE_FILES:
            filepath = REPO_ROOT / filepath_str
            if not filepath.exists():
                print(f"  - {filepath_str}")

    print("\n" + "=" * 60)
    print("Package ready for SOC-2 and ISO 27001 auditors.")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
