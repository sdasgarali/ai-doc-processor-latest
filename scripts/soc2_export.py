#!/usr/bin/env python3
"""
SOC-2 Evidence Export.

Generates a machine-readable evidence bundle for SOC-2 auditors.

Exports:
- Change controls (.ai/CLAUDE_RULES.md)
- CI enforcement (.github/workflows/ci.yml)
- AI governance (.github/workflows/ai-rules-enforcement.yml)
- Security controls (.github/workflows/security.yml)
- Auto-merge policy (.ai/AUTO_MERGE_POLICY.yaml)
- Audit trail (.ai/AI_CHANGELOG.md)
"""

import hashlib
import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

# Evidence files to include
EVIDENCE_FILES = [
    # AI Governance
    ".ai/CLAUDE_RULES.md",
    ".ai/AUTO_MERGE_POLICY.yaml",
    ".ai/AI_CHANGELOG.md",
    ".ai/BOOTSTRAP_PROMPT.md",
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
]

# Output location
OUTPUT_DIR = Path(__file__).parent.parent
REPO_ROOT = Path(__file__).parent.parent


def calculate_file_hash(filepath: Path) -> str:
    """Calculate SHA-256 hash of file."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_file_metadata(filepath: Path) -> dict[str, Any]:
    """Get metadata for a file."""
    stat = filepath.stat()
    return {
        "path": str(filepath.relative_to(REPO_ROOT)),
        "size_bytes": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "sha256": calculate_file_hash(filepath),
    }


def generate_manifest(files: list[Path]) -> dict[str, Any]:
    """Generate manifest with file metadata."""
    return {
        "generated": datetime.now().isoformat(),
        "generator": "autonomous-cicd-template/soc2_export.py",
        "version": "1.0",
        "file_count": len(files),
        "files": [get_file_metadata(f) for f in files],
        "compliance_controls": {
            "change_management": [
                ".ai/CLAUDE_RULES.md",
                ".ai/AI_CHANGELOG.md",
                ".github/CODEOWNERS",
            ],
            "ci_enforcement": [
                ".github/workflows/ci.yml",
                ".github/workflows/ai-rules-enforcement.yml",
            ],
            "security_controls": [
                ".github/workflows/security.yml",
                ".ai/AUTO_MERGE_POLICY.yaml",
            ],
            "audit_trail": [
                ".ai/AI_CHANGELOG.md",
            ],
        },
    }


def create_evidence_package() -> tuple[str, int, int]:
    """
    Create SOC-2 evidence ZIP package.

    Returns:
        Tuple of (output_path, files_included, files_missing)
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"SOC2_Evidence_Package_{timestamp}.zip"

    included_files: list[Path] = []
    missing_files: list[str] = []

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filepath_str in EVIDENCE_FILES:
            filepath = REPO_ROOT / filepath_str
            if filepath.exists():
                # Add file to archive
                zf.write(filepath, filepath_str)
                included_files.append(filepath)
            else:
                missing_files.append(filepath_str)

        # Generate and add manifest
        manifest = generate_manifest(included_files)
        manifest["missing_files"] = missing_files

        manifest_json = json.dumps(manifest, indent=2)
        zf.writestr("MANIFEST.json", manifest_json)

        # Add README for auditors
        readme = generate_auditor_readme(manifest)
        zf.writestr("README.txt", readme)

    return str(output_path), len(included_files), len(missing_files)


def generate_auditor_readme(manifest: dict[str, Any]) -> str:
    """Generate README for auditors."""
    return f"""
SOC-2 EVIDENCE PACKAGE
======================

Generated: {manifest['generated']}
Generator: {manifest['generator']}

CONTENTS
--------
This package contains {manifest['file_count']} files demonstrating:

1. CHANGE MANAGEMENT CONTROLS
   - AI governance rules (CLAUDE_RULES.md)
   - Audit trail (AI_CHANGELOG.md)
   - Code ownership (CODEOWNERS)

2. CI/CD ENFORCEMENT
   - Automated CI pipeline (ci.yml)
   - AI rules enforcement (ai-rules-enforcement.yml)
   - Fail-closed quality gates

3. SECURITY CONTROLS
   - Security scanning workflow (security.yml)
   - Auto-merge policy with risk limits (AUTO_MERGE_POLICY.yaml)
   - Pre-commit hooks for local enforcement

4. SEPARATION OF DUTIES
   - AI cannot override human controls
   - Elevated risks require human approval
   - All AI actions are logged and auditable

FILE INTEGRITY
--------------
See MANIFEST.json for SHA-256 hashes of all files.

QUESTIONS
---------
Contact your security team for additional evidence or clarification.
"""


def main() -> int:
    """Generate SOC-2 evidence package."""
    print("SOC-2 Evidence Export")
    print("=" * 40)

    output_path, included, missing = create_evidence_package()

    print(f"\n[OK] Evidence package created: {output_path}")
    print(f"  - Files included: {included}")

    if missing:
        print(f"  - Files missing: {missing}")
        print("\nMissing files:")
        for f in EVIDENCE_FILES:
            filepath = REPO_ROOT / f
            if not filepath.exists():
                print(f"  - {f}")
    else:
        print("  - All expected files present")

    print("\n" + "=" * 40)
    print("Package ready for SOC-2 auditors.")
    print("Upload to: Board decks, SOC-2 evidence, Client trust portals")

    return 0


if __name__ == "__main__":
    sys.exit(main())
