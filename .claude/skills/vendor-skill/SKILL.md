---
name: vendor-skill
description: Vendor an external skill into this marketplace, or refresh one already vendored. Use when asked to vendor, import, mirror, or update a skill from skills.sh, `npx skills add`, or any external GitHub skills repo, especially to work around Claude Code Web only allowing one marketplace per GitHub repo name.
---

# Vendor skill

Claude Code Web can only add one marketplace per GitHub repo name (see
anthropics/claude-code#95100), so sending marketplace users to add a second
external marketplace for one skill breaks for them. Vendoring copies the
skill's own files into `.agents/skills/` and publishes it as part of the `sk`
plugin instead.

`npx skills` owns `.agents/skills/`. Run it from the repo root and it writes
exactly where this marketplace serves from, so vendoring needs no wrapper.

This skill lives in `.claude/skills/`, not `.agents/skills/`, so it loads for
whoever works in this repo and never ships to marketplace customers. Keep it
there.

## Gather the source

Confirm the owner/repo and skill name. If the user only names a skill, look it
up on skills.sh or ask.

Always pin the `skills@latest` package specifier, not bare `skills`: from this
repo's root, `npx skills` resolves to the local `skills` package in
`package.json` (which has no `bin`) instead of the external CLI, and fails with
"could not determine executable to run".

List what the repo ships, and resolve the commit to pin:

```bash
npx --yes skills@latest add <owner>/<repo> --list
git ls-remote https://github.com/<owner>/<repo> HEAD
```

Check the source repo's license permits redistribution before vendoring. Note
any `LICENSE`/`NOTICE` file it requires you to carry, including one at the
source repo root rather than inside the skill directory (this repo's own MIT
`LICENSE:12` requires the same for anything copied from it).

## Vendor it

From the repo root:

```bash
npx --yes skills@latest add "<owner>/<repo>#<sha>" --skill <skill> -y
```

That writes `.agents/skills/<skill>/` and records the source and commit in the
root `skills-lock.json`. Commit both.

Read the fetched `SKILL.md` and everything beside it (`assets/`, `references/`,
`scripts/`). Append any upstream `LICENSE`/`NOTICE` to `.agents/LICENSE`
after a `---` line, headed by the skills it covers and their source repo. If
that source already has a section, add the skill to its header. The notice goes
there, not inside `skills/<skill>/`, because a refetch wipes that directory and
would drop a notice you are still required to carry. The root `LICENSE` never
ships, so it can't carry the notice either.

Only rewrite the frontmatter `description` if it doesn't already say when to
use the skill — this repo's skill frontmatter carries only `name` and
`description`, so don't invent extra fields to record provenance. Attribution
goes in the `README.md` skill row instead: link the source repo at the commit
you vendored.

## Sync and verify

Add a row to the skill table in `README.md`, then:

```bash
npm run version
claude plugin validate . && claude plugin validate .agents
```

Revise the plugin description in `.claude-plugin/marketplace.json` and the
Codex `interface` block in `.agents/.codex-plugin/plugin.json` if they no
longer describe what the plugin ships. `cli.ts version` propagates the
description into both manifests; the `interface` block is by hand.

## Updating a vendored skill

```bash
npx --yes skills@latest update -p -y
git diff
```

Each skill moves to its source's current commit and `skills-lock.json` is
re-pinned. The refetch is a clean sync of `.agents/skills/<skill>/`, not a
merge: it reverts local edits, restores deleted files, and removes files
upstream dropped, so `git diff` is exactly what upstream changed. Nothing you
add inside that directory survives, which is why its notice lives in
`.agents/LICENSE`. Update the source link in the `README.md` row to the new
`ref`, and check whether upstream changed its license.

Drop a vendored skill with `npx --yes skills@latest remove <skill> -y`, then
remove it from its `.agents/LICENSE` header, and the whole section if no skill
from that source remains.

Hand-written skills live in `.agents/skills/` too. `add` and `update` only
touch the directories named in `skills-lock.json`, but a blanket
`npx skills remove --all` would take every skill in the repo.
