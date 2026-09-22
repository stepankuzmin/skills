# Stepan Kuzmin Skills

One plugin, `sk`, carrying every skill and the grug agent. Skills invoke as `sk:<skill>`.

| Agent | Description |
| --- | --- |
| [`grug`](.agents/agents/grug.md) | Complexity review and simplification. |

| Skill | Description |
| --- | --- |
| [`grug-design`](.agents/skills/grug-design/SKILL.md) | Design the smallest clear change by inspecting existing code or interviewing the user when no implementation exists. |
| [`grug-implement`](.agents/skills/grug-implement/SKILL.md) | Implement a feature or refactor from an accepted plan or enough live context, with the smallest clear diff. |
| [`grug-review`](.agents/skills/grug-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`marie-kondo`](.agents/skills/marie-kondo/SKILL.md) | Aggressive refactor pass that cuts code that doesn't earn its keep. |
| [`uncomplect`](.agents/skills/uncomplect/SKILL.md) | Pressure-test a stateful system or replacement design through Hickey's complection, Ousterhout's deep modules, Young's deletability, DDD boundaries, typed effects, and explicit lifecycle modeling. Vendored from [joelhooks/skills](https://github.com/joelhooks/skills/tree/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills/uncomplect). |
| [`flyover`](.agents/skills/flyover/SKILL.md) | Turn a text description into a cinematic 3D map flyover: GeoJSON camera waypoints plus a self-contained Mapbox GL JS page. Needs `MAPBOX_ACCESS_TOKEN`. |
| [`vendor-skill`](.agents/skills/vendor-skill/SKILL.md) | Vendor an external skill into this marketplace, or refresh one already vendored. |

## Install

Every agent, via the skills CLI:

```bash
npx skills add stepankuzmin/skills
```

Claude Code plugin, with the grug agent:

```bash
claude plugin marketplace add stepankuzmin/skills
claude plugin install sk@stepankuzmin
```

Codex plugin:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add sk@stepankuzmin
```

## Release

```bash
npm version <patch|minor|major> --no-git-tag-version --ignore-scripts=false
git commit -am "v<new>"
git tag v<new>
git push --follow-tags
```
