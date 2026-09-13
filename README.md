# Stepan Kuzmin Skills

Reusable agents and skills for practical, clarity-first engineering.

The marketplace includes:

- `grug` - applies a simplicity lens to conversations, plans, architecture,
  documents, and code.
- `grug-review` - reviews code for unnecessary complexity and proposes concrete
  simplifications.
- `code-review` - reviews a diff for correctness bugs and unnecessary
  complexity, posting only findings backed by a failure scenario or a simpler
  alternative.
- `manage-skills` - adds, updates, or removes skills in this plugin from any repo by
  opening a PR against `stepankuzmin/skills`.

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
