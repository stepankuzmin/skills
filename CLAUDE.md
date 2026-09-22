# skills

A plugin marketplace. It ships one plugin, `sk`, carrying every skill and the grug agent to Claude Code and Codex.

## Layout

```
.claude-plugin/marketplace.json   Claude Code marketplace
.agents/plugins/marketplace.json  Codex marketplace
.agents/.claude-plugin/plugin.json   Claude Code manifest
.agents/.codex-plugin/plugin.json    Codex manifest
.agents/agents/<agent>.md
.agents/skills/<skill>/SKILL.md
skills-lock.json                  vendored skills, maintained by npx skills
```

The plugin is rooted at `.agents/`, so its `skills/` is the directory `npx skills` writes to. That is why vendoring needs no wrapper, and why both marketplace files point at `./.agents`. They must otherwise agree.

## Commands

```bash
npm run version              # propagate version and description into both plugin manifests
claude plugin validate .     # validate the marketplace
claude plugin validate .agents
codex plugin marketplace add .
codex plugin add sk@stepankuzmin
```

## Adding a skill

1. Create `.agents/skills/<skill>/SKILL.md`.
2. Add a row to the skill table in `README.md`.
3. Revise the plugin description in `.claude-plugin/marketplace.json` if it no longer describes what ships, then run `npm run version`.
4. Run `claude plugin validate .` and `claude plugin validate .agents`.

To vendor a skill from another repo, use the `vendor-skill` skill.

## Editing manifests

`version` and `description` in both plugin manifests are generated. Set the description in `.claude-plugin/marketplace.json` and the version in `package.json`, then run `npm run version`. Never edit those two fields by hand. The Codex `interface` block is hand-written.
