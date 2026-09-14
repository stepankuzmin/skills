# Stepan Kuzmin Skills

<!-- skills:start -->

| Skill | Description |
| --- | --- |
| [`code-review`](plugins/stepankuzmin-skills/skills/code-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`grug`](plugins/stepankuzmin-skills/skills/grug/SKILL.md) | Apply Grug's clarity-first simplicity lens to any technical subject, including the current conversation, a plan, document, architecture, design, or code. |
| [`grug-review`](plugins/stepankuzmin-skills/skills/grug-review/SKILL.md) | Review code for unnecessary complexity using clarity-first simplification. |

<!-- skills:end -->

## External

<!-- external:start -->

| Skill | Description |
| --- | --- |
| [`uncomplect`](https://github.com/joelhooks/skills/blob/7c0a930d761bc05f50c3d31cf55ba7f289b45861/skills/uncomplect/SKILL.md) | Pressure-test a stateful system or replacement design through Rich Hickey's simplicity and complection, Greg Young's deletability, Ousterhout's deep modules, DDD boundaries, typed effects, and explicit lifecycle modeling. |

<!-- external:end -->

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
