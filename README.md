# Stepan Kuzmin Skills

<!-- catalog:start -->

## Complexity

Grug agent and grug-review skill: clarity-first code review.

| Agent | Description |
| --- | --- |
| [`grug`](plugins/stepankuzmin-skills/agents/grug.md) | Complexity review and simplification. |

| Skill | Description |
| --- | --- |
| [`grug-review`](plugins/stepankuzmin-skills/skills/grug-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |

## Joelhooks-skills

uncomplect: pressure-test a stateful system or replacement design through Hickey, Young, Ousterhout, and DDD.

| Skill | Description |
| --- | --- |
| [`uncomplect`](https://github.com/joelhooks/skills/blob/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills/uncomplect/SKILL.md) | Pressure-test a stateful system or replacement design through Rich Hickey's simplicity and complection, Greg Young's deletability, Ousterhout's deep modules, DDD boundaries, typed effects, and explicit lifecycle modeling. |

<!-- catalog:end -->

## Install

```bash
npx skills add stepankuzmin/skills
```

## Release

```bash
npm version <patch|minor|major> --no-git-tag-version --ignore-scripts=false
git commit -am "v<new>"
git tag v<new>
git push --follow-tags
```
