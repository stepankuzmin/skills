---
name: grug-implement
description: Implement an accepted grug-design with the smallest clear diff. Use when applying a Grug plan or implementing a planned feature or refactor. If the design is missing, unclear, or conflicts with live code, use grug-design first.
---

# Grug implement

Implement the latest `grug-design` the user accepted. Preserve proven behavior,
not accidental structure. Choose the smallest clear diff that meets the plan.

## Lock the design

Before editing, find the accepted plan in the current context. It must state the
required behavior, what must stay unchanged, where each decision belongs, the
ordered changes, and the non-goals.

If no accepted plan exists, a real design choice remains, or live code
conflicts with the plan, use `grug-design` and get agreement. Resolve design
questions there before editing.

Read the target implementation, callers, and relevant tests. Ask why awkward
code exists before removing it.

## Implement the plan

- Change the code that owns the behavior. Keep each decision with one owner.
- Keep rules separate from storage, network calls, and clock reads. Use the
  project's existing boundaries.
- Add a shared boundary only when a small interface hides hard work and removes
  caller special cases. Three real callers or a trust boundary must justify
  sharing.
- Delete code the change supersedes. Preserve code whose purpose is uncertain.
- Keep unrelated cleanup out of the diff.

If the implementation needs wrappers around wrappers, old and new code deciding
the same thing, duplicated policy, or several owners for one decision, stop and
return to `grug-design`. When existing code causes the problem, use the
smallest behavior-preserving refactor that creates one clear boundary and
removes the workaround. Treat a rewrite as a new design.

## Cull the diff

Audit every changed line and every new file, type, helper, dependency, option,
error handler, test, and comment. Ask what breaks today if it is removed. Delete
it when the answer is nothing, future flexibility, or a trivial inline change.

Add no comments or explanatory docstrings by default. Keep one only when it
records a non-obvious invariant or explains an external workaround that code
cannot make clear. Delete restatements, investigation notes, ticket or URL
references, and test explanations.

## Verify and finish

Run the narrow existing checks that prove the changed behavior. Add a focused
test only when behavior changed and existing tests cannot catch the regression.

The final handoff lists only the change, deleted code, checks, and blockers.
