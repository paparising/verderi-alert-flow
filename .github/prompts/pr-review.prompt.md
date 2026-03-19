---
agent: ask
model: GPT-5.3-Codex
description: "Run a standardized PR review in quick or deep mode with severity-ranked findings and file references."
---

# PR Review Prompt

Perform a pull request review using the workspace skill `pr-review`.

## Inputs

- Review mode: `${input:reviewMode:quick}`
- Scope: `${input:scope:all changed files}`
- Diff source: `${input:diffSource:staged and unstaged}`
- Run validation commands: `${input:runValidation:no}`
- Focus area (optional): `${input:focusArea:}`

## Mode Rules

### quick

- Fast pass on highest-risk issues only.
- Prioritize correctness, security, and regression blockers.
- Return only actionable findings that should block merge or need immediate follow-up.

### deep

- Full review across correctness, security, reliability, performance, and test quality.
- Include medium/low severity findings where useful.
- Identify test gaps and observability gaps.

## Review Process

1. Inspect the requested diff source and scope.
2. Identify runtime-impact files first (API/auth/data/concurrency/persistence/infrastructure).
3. Evaluate for:
   - correctness and regressions
   - authorization/tenant safety
   - concurrency and transaction semantics
   - performance/scalability risks
   - test and observability coverage
4. If `runValidation` is `yes`, run relevant tests/build/lint commands when possible and include outcomes.
5. Produce findings ordered by severity.

## Output Format

### Findings

- Severity: Critical | High | Medium | Low
- File reference
- Issue and impact
- Recommended fix

### Open Questions / Assumptions

- Clarifications needed to finalize review confidence.

### Coverage and Residual Risk

- What was validated.
- What could not be validated.

## Constraints

- Avoid style-only comments unless they impact correctness, safety, or maintainability significantly.
- Prefer specific and reproducible feedback over broad suggestions.
- If no findings, state that explicitly and note residual risks/testing gaps.
