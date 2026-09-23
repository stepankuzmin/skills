# Stepan Kuzmin Skills

| Skill | Description |
| --- | --- |
| [`grug-design`](.agents/skills/grug-design/SKILL.md) | Design the smallest clear change from the existing code, or from your answers when there is no code yet. |
| [`grug-implement`](.agents/skills/grug-implement/SKILL.md) | Implement a plan or a clear request with the smallest diff. |
| [`grug-review`](.agents/skills/grug-review/SKILL.md) | Review a diff for bugs and needless complexity. Each finding comes with a failing case or simpler code. |
| [`flyover`](.agents/skills/flyover/SKILL.md) | Turn a place or route into a 3D map flyover page built on Mapbox GL JS. Needs `MAPBOX_ACCESS_TOKEN`. |

## Sources

- [cursor/plugins#b42effe0aa50f59c693d7e2924714e015e00bf7c](https://github.com/cursor/plugins/tree/b42effe0aa50f59c693d7e2924714e015e00bf7c/pstack/skills)
- [joelhooks/skills#7c0a930d761bc05f50c3d31cf55ba7f289b45861](https://github.com/joelhooks/skills/tree/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills)

## Install

Skills CLI:

```bash
npx skills add stepankuzmin/skills
```

Claude Code, including the grug agent:

```bash
claude plugin marketplace add stepankuzmin/skills
claude plugin install sk@stepankuzmin
```

Codex:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add sk@stepankuzmin
```

## Release

```bash
npm version <patch|minor|major> --no-git-tag-version --ignore-scripts=false
git commit -am "v<new>"
git tag -a v<new> -m "v<new>"
git push --follow-tags
```
