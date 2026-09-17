# skills

A plugin marketplace. Each plugin under `plugins/` ships skills, and sometimes agents, to Claude Code and Codex.

## Layout

```
plugins/<plugin>/
  .claude-plugin/plugin.json   Claude Code manifest
  .codex-plugin/plugin.json    Codex manifest
  skills/<skill>/SKILL.md
  agents/<agent>.md            optional
  skills-lock.json             only when the plugin vendors external skills
```

Two marketplace files list every plugin and must agree: `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.

## Commands

```bash
npm run version              # propagate version and description into every plugin manifest
npm run vendor               # refetch every vendored skill at the commit in its plugin's skills-lock.json
claude plugin validate .     # validate the marketplace
claude plugin validate plugins/<plugin>
codex plugin marketplace add .
codex plugin add <plugin>@stepankuzmin
```

## Adding a plugin

1. Create `plugins/<plugin>/` with both manifests and at least one skill.
2. Add the entry to both marketplace files.
3. Run `npm run version`.
4. Add a section to `README.md` with a skill table and the install commands.
5. Run `claude plugin validate .` and `claude plugin validate plugins/<plugin>`.

`.github/workflows/ci.yml` loops over `plugins/*`, so a new plugin needs no workflow change.

## Editing manifests

`version` and `description` in each plugin manifest are generated. Set the description in `.claude-plugin/marketplace.json` and the version in `package.json`, then run `npm run version`. Never edit those two fields by hand.
