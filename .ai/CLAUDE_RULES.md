# Claude Code – Mandatory Project Rules

> **THIS IS A MANDATORY CONTRACT**
> Claude Code must follow this file for every task in this repository.
> Violation of these rules is considered a **DEFECT**.

---

## 1. CI/CD & Pipelines

- **Never** weaken, bypass, or remove CI/CD gates
- CI must **fail-closed** for:
  - Lint checks
  - Tests
  - Coverage thresholds
  - Security scans
- AI-related steps must always **fail-open** (non-blocking)
- Pipeline modifications require explicit approval

---

## 2. AI Provider Rules

- AI provider MUST remain **model-agnostic**
- `scripts/ai_engine.py` is the **ONLY** place provider logic is allowed
- Default provider is **Groq** unless explicitly changed
- No provider-specific code outside `ai_engine.py`
- All AI integrations must support provider swapping without code changes

---

## 3. Security & Compliance

- **Never** hardcode secrets, API keys, or credentials
- Use environment variables exclusively for sensitive data
- Assume **SOC-2 / HIPAA** level scrutiny for all changes
- Security scans must not be downgraded or bypassed
- Follow OWASP security best practices
- Validate and sanitize all inputs at system boundaries

---

## 4. Code Quality

- **Production-ready code only** – no drafts, sketches, or incomplete implementations
- **No pseudocode** – all code must be executable
- **No TODOs** unless explicitly requested by the user
- Test coverage must remain **≥ 85%**
- All code must pass linting and type checking before commit
- Follow existing code patterns and conventions in the repository

---

## 5. Repository Structure

- Follow the repository structure **exactly**
- **No file relocation** without explicit instruction
- **No silent deletion** of files
- New files must follow established naming conventions
- Directory structure changes require explicit approval

---

## 6. Output Rules

When generating code:
- Output **full file contents** (no snippets unless requested)
- Respect existing patterns and conventions
- Maintain **backward compatibility** unless stated otherwise
- Include appropriate error handling
- Document public APIs and complex logic

---

## 7. Git Practices

- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Reference issue numbers when applicable
- Never force push to main/master without explicit approval
- All changes must be reviewable

---

## 8. Failure Behavior

- If unsure, **STOP and ask** for clarification
- **Never guess** or hallucinate infrastructure behavior
- **Never assume** missing context – request it
- Report blockers immediately rather than working around them

---

## 9. Testing Requirements

- Write tests for all new functionality
- Ensure existing tests pass before committing
- Integration tests required for API changes
- Mock external services appropriately
- Test edge cases and error conditions

---

## 10. Communication Standards

- Be concise and direct
- Provide reasoning for significant decisions
- Document assumptions explicitly
- Break complex tasks into smaller, verifiable steps
- Verify changes work before marking tasks complete

---

## Acknowledgment

By continuing work in this repository, Claude Code agrees to follow these rules without exception. Any deviation requires explicit user approval documented in the conversation.
