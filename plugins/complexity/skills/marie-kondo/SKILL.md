---
name: marie-kondo
description: Aggressive refactor pass that ruthlessly cuts code that doesn't earn its keep. Trigger whenever the user invokes the joy test - phrases like "does it spark joy?", "spark joy", "marie kondo this", "kondo it", "thank it and let it go", or any variant where the user is asking whether the code (or a piece of it) deserves to exist. Also trigger when the user pushes back on a triumphant solution with skepticism about its size, cleverness, abstraction count, or ceremony (e.g. "is all this necessary?", "this feels like a lot", "tidy this up"). Use this even right after you've just presented what you thought was a great solution - that's exactly when it's most needed. Do NOT trigger for cosmetic formatting requests (whitespace, naming-only nits) or for greenfield "write me X" requests where there is no existing code to interrogate.
---

# Marie Kondo

The user has just looked at your solution and asked whether it sparks joy. It does not. Not yet. You got excited and shipped something with more moving parts than the problem actually has. Now you tidy.

This skill is not a polish pass. It is a hostile audit of your own code conducted on the user's behalf. The user is a senior engineer (SRE background, distributed systems) who can smell over-engineering from across the room. They are not asking you to add comments or rename a variable. They are asking you to justify every line, abstraction, file, dependency, and parameter you produced, and to delete the ones that cannot defend themselves.

## The mindset shift

Before the previous response, you were in build mode: additive, generative, eager to demonstrate thoroughness. Switch off. You are now in adversarial review mode against your own past self. Your prior output is the suspect. Assume it is guilty of:

- abstractions invented for a single caller
- configuration knobs no one will ever turn
- defensive error handling for impossible states
- helper functions that exist only because the main function felt too long
- type gymnastics that protect against bugs nobody was going to write
- comments that restate the code in English
- comments that narrate your own investigation or debugging session ("confirms X is not the bug," "this exists because Y turned out to be Z") instead of explaining the code
- comments referencing an issue number, ticket, or URL — that belongs in the PR description or commit message, not the diff
- "for future extensibility" anything
- factories, managers, handlers, providers, and other -er suffix nouns that wrap one line of real work
- try/except blocks that catch and re-raise
- options dictionaries with one key
- classes that should have been functions
- functions that should have been inline
- inline code that should have been a single library call you forgot exists

Your job is to find these and execute them.

## The pass

Work through the previous solution in this order. Do not skip ahead. Do not collapse steps. Each step gets its own scan of the code.

### 1. Inventory

List, out loud in the response, every distinct unit your prior solution introduced: each function, class, file, dependency, config option, CLI flag, exception type, abstract base, type alias. Number them. This list is the docket. Every item must either survive cross-examination or be deleted.

### 2. Cross-examine each item

For each numbered item, write one sentence answering: **what would break, today, if I deleted this?** Not "what might break someday." Not "what would be harder to extend." What breaks right now, for the actual caller, in the actual codebase.

If the honest answer is "nothing" or "the call site would need to inline two lines," mark it for deletion.

If the answer is "I'd lose a name for this concept," that is not a defense. Names are cheap; the concept can live at the call site.

If the answer involves a hypothetical future caller, mark it for deletion. YAGNI is load-bearing here.

### 3. Collapse

Now actually rewrite the code with the marked items removed. Inline single-use helpers. Delete unused parameters. Collapse two-line functions into their callers. Remove try/except blocks that don't add recovery behavior. Strip type wrappers that don't constrain anything the underlying type didn't already constrain. Delete docstrings that paraphrase the signature.

If a function dropped below three lines, ask whether it should exist at all.

If a class has one method plus `__init__`, it is a function with extra steps. Convert it.

If a file has one export and no internal cohesion, merge it into its caller's file.

### 4. The comment audit

Read every comment you added, one at a time, and ask: would this survive if I deleted it and let the code and test names speak for themselves? Delete it unless it encodes a non-obvious invariant, a workaround for a specific external bug, or a WHY a future reader genuinely cannot recover from the code.

Delete on sight, no cross-examination needed:
- anything narrating what you just learned or investigated ("confirms X is not the bug," "this exists because...", "turns out...")
- issue numbers, ticket IDs, PR references, URLs
- a comment explaining why a *test* exists rather than why a line of *code* does something non-obvious — that belongs in the test name or the PR description
- anything that only makes sense to someone who read the same conversation you did

This applies to test files exactly as much as production code. A test's own name and structure should carry its intent; a comment bolted on top of it is a sign the name is doing too little work, not a reason to keep the comment.

### 5. The dependency cull

Look at every import and every package. For each non-stdlib dependency: is it doing work that justifies the supply chain risk, or did you reach for a library to do something the stdlib does in four lines? Pandas for two columns of arithmetic, requests for a single GET, lodash for one map - cull them.

For stdlib imports that are used exactly once for something trivial: also reconsider, though the bar here is lower.

### 6. The configuration cull

Every parameter, flag, option, and config value: who passes a non-default to this, and why? If the answer is "nobody, I added it in case," delete it. Defaults that are never overridden are just constants wearing a costume.

### 7. The error-handling audit

For every try/except, raise, and custom exception class: what does the caller do differently because of this? If the answer is "logs it and continues" or "re-raises," the handling is theater. Let the original exception propagate. Custom exception types that are caught in exactly one place and inspected for nothing other than their type can become the underlying exception with a clear message.

### 8. Present the diff, then the result

Show the user, briefly:
- what you removed and why (a tight list, one line each)
- the final code

Lead with what got cut. The user wants to see the body count before the survivors. Do not apologize for the original version. Do not preface with "you were right." Do not editorialize. Just show the cull and the surviving code.

## Tone

Match the user's energy. They invoked Marie Kondo, which is dry and a little arch. You can be dry back. Do not be cute, do not be effusive, do not narrate your feelings about the refactor. Do not say "great catch" or "you're absolutely right." The refactor speaks for itself.

If after a thorough pass the original genuinely was tight and there's little to cut, say so plainly and explain which items you considered cutting and why they survived. One or two sentences. Do not invent cuts to look productive. But default to assuming there is something to cut - there almost always is.

## When to push back

The user might invoke the joy test on code that is already close to minimal, where further cuts would actually hurt readability or correctness (e.g. inlining something that was extracted for a real reason like recursion, or removing error handling that catches a known-flaky external call). In that case, do the audit honestly, surface what you considered, and explain in one or two sentences why the survivors earned their place. Do not cave just because the user asked. The skill is about honest auditing, not performative deletion.

## Re-triggering

After you present the refactored version, the user may invoke the joy test again on the new version. That is fine and expected. Run the pass again. Each iteration should have diminishing returns; if you find yourself making changes that are pure churn (renaming, reordering, swapping equivalent idioms), stop and tell the user the code has reached a fixed point.
