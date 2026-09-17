---
name: vendor-skill
description: Vendor an external skill into this marketplace as a first-class plugin, or refresh one already vendored. Use when asked to vendor, import, mirror, or update a skill from skills.sh, `npx skills add`, or any external GitHub skills repo, especially to work around Claude Code Web only allowing one marketplace per GitHub repo name.
---

# Vendor skill

Claude Code Web can only add one marketplace per GitHub repo name (see
anthropics/claude-code#95100), so sending marketplace users to add a second
external marketplace for one skill breaks for them. Vendoring copies the
skill's own files into this repo's `plugins/` tree and publishes it under the
single `stepankuzmin` marketplace instead, alongside `complexity` and `gl-js`.

## Gather the source

Confirm the owner/repo and skill name. If the user only names a skill, look it
up on skills.sh or ask.

Run `npx --yes skills@latest add --help` before relying on any flag below —
the CLI is external and can change. Always pin the `skills@latest` package
specifier, not bare `skills`: from this repo's root, `npx skills` resolves to
the local `skills` package in `package.json` (which has no `bin`) instead of
the external CLI, and fails with "could not determine executable to run".

List what the repo ships:

```bash
npx --yes skills@latest add <owner>/<repo> --list
```

Check the source repo's license permits redistribution before vendoring, and
copy any upstream `LICENSE`/`NOTICE` file and attribution
alongside the vendored skill — even one stored at the source repo root rather
than inside the skill directory — so the original terms travel with the code
(this repo's own MIT `LICENSE:12` requires the same for anything copied from
it).

## Place it in a plugin

Pick a plugin: reuse an existing one under `plugins/` when the skill's topic
matches (more complexity/simplicity tools belong in `complexity`); otherwise
scaffold a new one modeled on `plugins/gl-js`.

Fetch the skill:

```bash
./cli.ts add <owner>/<repo> <skill> <plugin>
```

It pins upstream's current commit and writes
`plugins/<plugin>/skills-lock.json`, which records the source and that commit.
Commit the lockfile; read its `ref` for the `README.md` attribution link.

Read the fetched `SKILL.md` and everything beside it (`assets/`, `references/`,
`scripts/`), and add any upstream `LICENSE`/`NOTICE` file gathered above next
to it. Only rewrite the frontmatter `description` if it doesn't already say
when to use the skill — this repo's
skill frontmatter carries only `name` and `description`, so don't invent
extra fields to record provenance. Attribution goes in the `README.md` skill
row instead: link the source repo at the commit you vendored.

For an existing plugin, update its catalog metadata so the vendored skill is
discoverable and accurately described — it's easy to copy the directory and
stop there, leaving the README and manifests describing the plugin's old,
narrower scope:

- Add a row for the new skill to that plugin's skill table in `README.md`.
- Re-read the plugin's `description` (both `.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json`), the Codex manifest's `interface` block
  (`shortDescription`, `longDescription`, `keywords`, `defaultPrompt`), and
  the `.claude-plugin/marketplace.json` / `.agents/plugins/marketplace.json`
  entries. Revise any of these that describe only the plugin's prior skills
  and would no longer be accurate or complete.

For a new plugin, create:

- `plugins/<plugin>/.claude-plugin/plugin.json` — `name`, `version` (match the
  current `package.json` version, `cli.ts version` will correct it),
  `description`, `author`, `repository`, `license`. Credit the original
  author in `author` if you're vendoring their work largely as-is.
- `plugins/<plugin>/.codex-plugin/plugin.json` — the same fields plus
  `keywords`, `skills: "./skills/"`, and an `interface` block (`displayName`,
  `shortDescription`, `longDescription`, `developerName`, `category`,
  `capabilities`, `websiteURL`, `defaultPrompt`, `brandColor`).
- An entry in `.claude-plugin/marketplace.json` (`name`, `source`,
  `description`) and in `.agents/plugins/marketplace.json` (same, plus that
  file's `policy` and `category`) — match the shape of the existing entries
  exactly.
- A section in `README.md` with the skill table and both install snippets,
  following the `## Complexity` and `## GL JS` sections.

## Sync and verify

Run `npm run version` so `cli.ts` propagates the version and description from
`package.json` and `marketplace.json` into every plugin manifest, then
`claude plugin validate plugins/<plugin>` (and `claude plugin validate .`).

## Updating a vendored skill

```bash
./cli.ts update <skill>
git diff
```

Omit the skill name to refetch every vendored skill. Each one moves to
upstream's current commit and the lockfile `ref` is re-pinned to it.

The refetch is a clean sync, not a merge: it reverts local edits, restores
deleted files, and removes files upstream dropped, so `git diff` is exactly
what upstream changed. Local adaptations do not survive it — reapply them on
top, or don't make them. Update the source link in the `README.md` row to the
new `ref`.

Drop a vendored skill with `./cli.ts remove <skill>`. It refuses any skill no
lockfile claims, so it cannot delete this repo's own skills.

Never use `npx skills update` or `npx skills experimental_install` here. Both
ignore the agent and write `.agents/skills/`, reporting success while the
vendored copy under `plugins/` stays stale.

Leave version bumps to the release flow in the README's `## Release` section
unless the user is ready to cut one.
