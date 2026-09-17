# Stepan Kuzmin Skills

## Complexity

| Agent | Description |
| --- | --- |
| [`grug`](plugins/complexity/agents/grug.md) | Complexity review and simplification. |

| Skill | Description |
| --- | --- |
| [`grug-design`](plugins/complexity/skills/grug-design/SKILL.md) | Design the smallest clear change by inspecting existing code or interviewing the user when no implementation exists. |
| [`grug-implement`](plugins/complexity/skills/grug-implement/SKILL.md) | Implement a feature or refactor from an accepted plan or enough live context, with the smallest clear diff. |
| [`grug-review`](plugins/complexity/skills/grug-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`marie-kondo`](plugins/complexity/skills/marie-kondo/SKILL.md) | Aggressive refactor pass that cuts code that doesn't earn its keep. |
| [`uncomplect`](plugins/complexity/skills/uncomplect/SKILL.md) | Pressure-test a stateful system or replacement design through Hickey's complection, Ousterhout's deep modules, Young's deletability, DDD boundaries, typed effects, and explicit lifecycle modeling. Vendored from [joelhooks/skills](https://github.com/joelhooks/skills/tree/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills/uncomplect). |

## Install

Every agent, via the skills CLI:

```bash
npx skills add stepankuzmin/skills
```

Claude Code plugin, with the grug agent:

```bash
claude plugin marketplace add stepankuzmin/skills
claude plugin install complexity@stepankuzmin
```

Codex plugin:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add complexity@stepankuzmin
```

## GL JS

| Skill | Description |
| --- | --- |
| [`flyover`](plugins/gl-js/skills/flyover/SKILL.md) | Turn a text description into a cinematic 3D map flyover: GeoJSON camera waypoints plus a self-contained Mapbox GL JS page. Needs `MAPBOX_ACCESS_TOKEN`. |

Claude Code plugin:

```bash
claude plugin marketplace add stepankuzmin/skills
claude plugin install gl-js@stepankuzmin
```

Codex plugin:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add gl-js@stepankuzmin
```

## Marketplace

| Skill | Description |
| --- | --- |
| [`vendor-skill`](plugins/marketplace/skills/vendor-skill/SKILL.md) | Vendor an external skill into this marketplace as a first-class plugin, or refresh one already vendored. |

Claude Code plugin:

```bash
claude plugin marketplace add stepankuzmin/skills
claude plugin install marketplace@stepankuzmin
```

Codex plugin:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add marketplace@stepankuzmin
```

## Release

```bash
npm version <patch|minor|major> --no-git-tag-version --ignore-scripts=false
git commit -am "v<new>"
git tag v<new>
git push --follow-tags
```
