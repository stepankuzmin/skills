# Stepan Kuzmin Skills

Reusable agents and skills for practical, clarity-first engineering.

The marketplace includes:

<!-- skills:start -->

| Skill | Description |
| --- | --- |
| [`code-review`](plugins/stepankuzmin-skills/skills/code-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`grug`](plugins/stepankuzmin-skills/skills/grug/SKILL.md) | Apply Grug's clarity-first simplicity lens to any technical subject, including the current conversation, a plan, document, architecture, design, or code. |
| [`grug-review`](plugins/stepankuzmin-skills/skills/grug-review/SKILL.md) | Review code for unnecessary complexity using clarity-first simplification. |
| [`manage-skills`](plugins/stepankuzmin-skills/skills/manage-skills/SKILL.md) | Add, update, remove, or install skills in the stepankuzmin-skills plugin from any repo, through the repo's vendor workflow. |
| [`uncomplect`](plugins/stepankuzmin-skills/skills/uncomplect/SKILL.md) ([joelhooks/skills](https://github.com/joelhooks/skills/blob/HEAD/skills/uncomplect/SKILL.md)) | Pressure-test a stateful system or replacement design through Rich Hickey's simplicity and complection, Greg Young's deletability, Ousterhout's deep modules, DDD boundaries, typed effects, and explicit lifecycle modeling. |

<!-- skills:end -->

Run `npm run publish` after adding, updating, or removing a skill; it regenerates
the table above from the skills on disk.

## Install

Point your agent at this repo and ask it to install the skills:

```text
Install the skills from https://github.com/stepankuzmin/skills
```

Or install them with the [skills](https://npmjs.com/package/skills) CLI:

```bash
npx skills add stepankuzmin/skills
```

Add `-s <skill>` to pick specific skills, or `-g` to install for every project.
