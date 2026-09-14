# Stepan Kuzmin Skills

## Complexity

| Agent | Description |
| --- | --- |
| [`grug`](plugins/stepankuzmin-skills/agents/grug.md) | Complexity review and simplification. |

| Skill | Description |
| --- | --- |
| [`grug-review`](plugins/stepankuzmin-skills/skills/grug-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`marie-kondo`](plugins/stepankuzmin-skills/skills/marie-kondo/SKILL.md) | Aggressive refactor pass that cuts code that doesn't earn its keep. |

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

## Recommendations

| Skill | Description |
| --- | --- |
| [`uncomplect`](https://github.com/joelhooks/skills/blob/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills/uncomplect/SKILL.md) | Pressure-test a stateful system or replacement design through Rich Hickey's simplicity and complection, Greg Young's deletability, Ousterhout's deep modules, DDD boundaries, typed effects, and explicit lifecycle modeling. |

Every agent, via the skills CLI:

```bash
npx skills add joelhooks/skills --skill uncomplect
```

Claude Code:

```bash
npx skills add joelhooks/skills --skill uncomplect -a claude-code
```

Codex:

```bash
npx skills add joelhooks/skills --skill uncomplect -a codex
```

## Release

```bash
npm version <patch|minor|major> --no-git-tag-version --ignore-scripts=false
git commit -am "v<new>"
git tag v<new>
git push --follow-tags
```
