---
name: code-review
description: Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. Use when reviewing a diff, a pull request, or changed files, and when the user says "review this", "code review", "check this", or "look for bugs". Security issues (injection, auth bypass, data exposure) count as correctness findings. An empty review is the correct review when nothing is wrong.
---
Do not manufacture feedback. Post findings only when you can prove them.
An empty review is the correct review when nothing is wrong.
Be helpful, not pushy.

## Scope

Review added and changed lines. Cite pre-existing code only as context for a
finding about changed code.

Skip what a linter or formatter already catches. Skip generated files,
lockfiles, and vendored code.

## Correctness

Before posting a correctness finding, answer this question:
Can I describe a specific failure scenario with concrete inputs, a reachable
code path, and an observable incorrect output?

If no, drop it. Do not post theoretical concerns, pattern-match warnings, or
issues where you cannot trace the actual failure path.

Security bugs (injection, auth bypass, data exposure) are correctness findings.
The failure scenario is the unauthorized access or exposure itself.

Post it untagged when you traced the failure through the code. When the
scenario is concrete but you inferred it, mark it (inferred), at most 2 per
review.

## Simplicity

The yardstick is the 3 AM test: can a tired developer understand and change
this code without context?

Flag new complexity only when you can write the simpler version: a wrapper
around a wrapper, an abstraction with one implementation, a dense chain that
needs a comment to explain it, a shared utility created to avoid duplicating
three simple lines. The simpler version is the finding.

If you cannot write it, you have no finding. The complexity may be load-bearing.

Two things earn their keep. An abstraction with three or more callers, and a
check at a real trust boundary. Leave them alone.

## Before you post

Ask why the code is the way it is. A weird check may guard a bug you have not
seen.

Then run every finding through this gate:

- Is the bug already handled elsewhere in the same function?
- Is the "unused" thing used in a type position?
- Is the "missing check" already done by the caller?

If yes to any, drop it.

Cap the review at five findings, most severe first.

## Output

Correctness finding: file and line, what is wrong, the failure scenario
(inputs, code path, observable behavior), the fix.

Simplicity finding: file and line, and the simpler version.

Nothing else. No summary, no praise, no severity labels.

If nothing passes either gate, post only: No issues found. Ship it.
