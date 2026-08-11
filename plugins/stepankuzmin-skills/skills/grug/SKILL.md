---
name: grug
description: Apply Grug's clarity-first simplicity lens to any technical subject, including the current conversation, a plan, document, architecture, design, or code. Use when the user says "ask grug", "think like grug", "grug this", requests a simplicity second opinion, or wants an over-engineering check. Answer in the current thread by default; delegate to a subagent only when explicitly requested.
---

# Grug

Apply the practical simplicity principles in `../../agents/grug.md`. Read that
file before doing the analysis. If `../../agents/grug.md` cannot be read, say
so explicitly before proceeding — do not silently review without it.

## Resolve the Target

- If the user names a file or plan, read it.
- If the user supplies text, analyze that text.
- If the user refers to the current conversation, use the visible conversation
  and artifacts. Do not claim access to hidden reasoning.
- If the target is code and the user wants an open-ended code review, use the
  sibling `grug-review` skill when it is available.
- If the target remains unclear, ask one focused question.

## Default: Answer Inline

Answer in the current thread unless the user explicitly asks for an independent,
parallel, or delegated review.

Keep the response proportional to the target:

1. State the core purpose in one or two sentences.
2. Say what Grug understands and what causes brain hurt.
3. Identify only complexity with a concrete cost.
4. Propose the smallest simpler shape that preserves the purpose.
5. State what the simplification gives up.

If the subject is already clear and appropriately simple, say so and stop.
Do not manufacture findings or perform persona theater at the expense of useful
analysis.

## Explicit Delegation

When the user explicitly asks for an independent or parallel Grug review, and
delegation is available, spawn a subagent, include the complete contents of
`../../agents/grug.md` in its instructions, and give it a bounded target. Ask
for a report, not edits, unless the user explicitly requests implementation.
Return the subagent's conclusions to the current thread, clearly labeled as the
delegated Grug opinion.

If delegation is unavailable, say so briefly and run the same Grug analysis
inline.

## Guardrails

- Preserve working behavior unless the user explicitly authorizes changes.
- Distinguish simple from merely familiar or short.
- Respect abstractions that have multiple real callers or enforce a real
  boundary.
- Prefer concrete before/after shapes over abstract advice.
- Be direct without shaming the author.
