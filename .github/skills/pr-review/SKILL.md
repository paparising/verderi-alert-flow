---
name: pr-review
description: "Use when reviewing pull requests, doing code review, checking git diffs, identifying bugs/regressions, validating tests, assessing security/performance risk, and preparing actionable review feedback with severity and file references."
---

# PR Review Skill

## Purpose

Provide a consistent, high-signal pull request review process that prioritizes correctness, regressions, risk, and missing tests over style-only feedback.

## Use When

- User asks for a PR review or code review.
- User asks to review staged/unstaged git changes.
- User asks for risk assessment before merge.
- User asks for test gap analysis tied to changes.

## Inputs To Gather

1. Scope of review:

- Entire PR or selected files.
- Staged changes, unstaged changes, or both.

2. Quality bar:

- Blocking defects only, or full findings including suggestions.

3. Validation expectations:

- Whether build/tests/lint should be run.

## Workflow

1. Collect the change surface.

- Read changed files from git diff (staged + unstaged unless user specifies otherwise).
- Identify files with runtime impact (API, data layer, auth, concurrency, persistence, infra, migrations).

2. Review for correctness and regressions first.

- Confirm behavior remains compatible with existing contracts.
- Look for logic errors, unsafe assumptions, partial updates, race conditions, null/edge-path failures, and broken error handling.

3. Review for security and data safety.

- AuthN/AuthZ checks still enforced.
- Input validation and sanitization preserved.
- Secrets handling and sensitive logging are safe.
- Transaction boundaries and idempotency remain sound.

4. Review performance and scalability impact.

- N+1 queries, expensive loops, unbounded scans, memory growth risks.
- Missing indexes for new query patterns.
- Hot path latency and retry amplification risks.

5. Review tests and observability.

- New/changed logic should have tests for success + failure + edge cases.
- If behavior changed, verify test updates reflect the intended contract.
- Ensure logs/metrics are adequate for diagnosing failures.

6. Produce findings with severity and evidence.

- Order by severity: critical, high, medium, low.
- Each finding includes: impact, why it is a problem, file reference, and concrete fix suggestion.
- If no issues, state that explicitly and mention residual risk/testing gaps.

## Output Format

Use this structure in the response:

1. Findings

- Severity: Critical/High/Medium/Low
- File reference
- Problem and impact
- Recommended fix

2. Open Questions / Assumptions

- Any unclear behavior or assumptions that affect confidence.

3. Coverage and Residual Risk

- What was validated.
- What was not validated (for example: tests not run, env-dependent behavior).

## Severity Guide

- Critical: security vulnerability, data corruption/loss, auth bypass, crash in normal flow.
- High: likely regression, incorrect business behavior, broken API contract, significant concurrency risk.
- Medium: reliability/perf risk under load, incomplete edge-case handling, weak observability.
- Low: maintainability issues, minor inefficiencies, non-blocking quality gaps.

## Review Checklist

- [ ] Authorization and tenancy checks preserved.
- [ ] DTO/entity validation aligns with controller/service behavior.
- [ ] Transactions are atomic for multi-write operations.
- [ ] Concurrency semantics are explicit for mutable resources.
- [ ] Retry/circuit-breaker behavior is safe and bounded.
- [ ] Query/index pattern supports expected scale.
- [ ] Tests cover changed behavior and edge paths.
- [ ] Error messages are actionable and safe.

## Notes

- Prioritize behavior and risk over formatting preferences.
- Do not suggest large refactors unless needed to fix correctness or safety.
- Keep findings concise, specific, and reproducible.
