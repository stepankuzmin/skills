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

Fetch into a scratch directory, never straight into this repo, so a bad fetch
or an unfamiliar output layout cannot touch the working tree:

```bash
tmp=$(mktemp -d)
(cd "$tmp" && npx --yes skills@latest add <owner>/<repo> --skill <skill> -a claude-code)
find "$tmp" -name SKILL.md
```

Read the fetched `SKILL.md` and everything beside it (`assets/`, `references/`,
`scripts/`). Check the source repo's license permits redistribution before
vendoring, and copy any upstream `LICENSE`/`NOTICE` file and attribution
alongside the vendored skill — even one stored at the source repo root rather
than inside the skill directory — so the original terms travel with the code
(this repo's own MIT `LICENSE:12` requires the same for anything copied from
it).

## Place it in a plugin

Pick a plugin: reuse an existing one under `plugins/` when the skill's topic
matches (more complexity/simplicity tools belong in `complexity`); otherwise
scaffold a new one modeled on `plugins/gl-js`.

Copy the skill directory verbatim to `plugins/<plugin>/skills/<skill>/`,
keeping `assets/`, `references/`, and `scripts/` next to `SKILL.md`, plus any
upstream `LICENSE`/`NOTICE` file gathered above. Only rewrite the frontmatter
`description` if it doesn't already say when to use the skill — this repo's
skill frontmatter carries only `name` and `description`, so don't invent
extra fields to record provenance.

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

`.github/workflows/ci.yml` lists one `claude plugin validate` line and two
`codex plugin` lines per plugin by hand. You cannot edit workflow files — tell
the user to add the new plugin's lines there.

## Updating a vendored skill

Re-run the fetch into a fresh scratch directory and diff the result against
`plugins/<plugin>/skills/<skill>/`. Apply upstream's changes; keep local
adaptations you made on top unless upstream fixed the same thing. Leave
version bumps to the release flow in the README's `## Release` section unless
the user is ready to cut one.
