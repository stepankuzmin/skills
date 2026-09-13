# Stepan Kuzmin Skills

Reusable agents and skills for practical, clarity-first engineering.

The marketplace includes:

<!-- skills:start -->

| Skill | Description |
| --- | --- |
| [`code-review`](plugins/stepankuzmin-skills/skills/code-review/SKILL.md) | Review changed code for correctness bugs and unnecessary complexity, posting only findings backed by a concrete failure scenario or a concrete simpler version. |
| [`grug`](plugins/stepankuzmin-skills/skills/grug/SKILL.md) | Apply Grug's clarity-first simplicity lens to any technical subject, including the current conversation, a plan, document, architecture, design, or code. |
| [`grug-review`](plugins/stepankuzmin-skills/skills/grug-review/SKILL.md) | Review code for unnecessary complexity using clarity-first simplification. |
| [`uncomplect`](plugins/stepankuzmin-skills/skills/uncomplect/SKILL.md) ([joelhooks/skills](https://github.com/joelhooks/skills/blob/HEAD/skills/uncomplect/SKILL.md)) | Pressure-test a stateful system or replacement design through Rich Hickey's simplicity and complection, Greg Young's deletability, Ousterhout's deep modules, DDD boundaries, typed effects, and explicit lifecycle modeling. |

<!-- skills:end -->

Run `npm run sync` after adding, updating, or removing a skill; it regenerates
the table above from the skills on disk.

## Install in Codex

Add this repository as a marketplace, then install the plugin:

```bash
codex plugin marketplace add stepankuzmin/skills
codex plugin add stepankuzmin-skills@stepankuzmin
```

Restart the ChatGPT desktop app and start a new Codex thread so the installed
skills are discovered. The marketplace appears as **Stepan Kuzmin** in the
Plugins Directory.

Example prompts:

```text
Ask grug to simplify this plan.
Give me a grug second opinion on this design.
Run a grug review on the current branch.
```

The plugin always provides the Grug skills. If `grug` does not show up as an
agent in your harness, invoke the same behavior by prompting the `grug` skill
directly, e.g. "Ask grug to review X".

## Install in Claude Code

```text
/plugin marketplace add stepankuzmin/skills
/plugin install stepankuzmin-skills@stepankuzmin
```
