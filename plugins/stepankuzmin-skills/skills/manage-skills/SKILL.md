---
name: manage-skills
description: Add, update, remove, or install skills in the stepankuzmin-skills plugin from any repo, through the repo's GitHub workflows.
disable-model-invocation: true
---

# Manage skills

Two `workflow_dispatch` workflows in https://github.com/stepankuzmin/skills do
the work on a runner: `skills.yml` vendors a skill and opens a PR, and
`release.yml` bumps the version and tags. This skill triggers them with `gh`.

Request: $ARGUMENTS

## 1. Pick the operation

| Request | Command |
| --- | --- |
| add `<skill>` from `<source>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=add -f skill=<skill> -f source=<source>` |
| update `<skill>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=update -f skill=<skill>` |
| update everything | `gh workflow run skills.yml -R stepankuzmin/skills -f op=update` |
| remove `<skill>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=remove -f skill=<skill>` |
| release | `gh workflow run release.yml -R stepankuzmin/skills -f bump=<patch\|minor\|major>` |
| install | section 3 |

`<source>` is `owner/repo`, `owner/repo#ref`, a GitHub tree URL, or a git URL.
The runner cannot read local disk, so a skill in the current repo must be
pushed first; then pass the repo as `owner/repo#branch`. If the skill, source,
or bump is unclear, ask with `AskUserQuestion`.

## 2. Run and watch

```bash
gh workflow run ...
gh run list -R stepankuzmin/skills -w skills.yml -L 1 --json databaseId -q '.[0].databaseId'
gh run watch <id> -R stepankuzmin/skills --exit-status
gh pr list -R stepankuzmin/skills --head <op>-<skill or all> --json url -q '.[0].url'
```

The run appears a few seconds after dispatch. On failure, show the log
(`gh run view <id> -R stepankuzmin/skills --log-failed`) and stop. On success,
report the PR URL. Reviewing and merging is the user's step.

For release, watch `release.yml` the same way and report the new tag.

## 3. Install

Installed plugins pin the version in `plugin.json`, so a merge alone changes
nothing locally. After the merge: run the release operation, then

```bash
claude plugin marketplace update stepankuzmin
claude plugin update stepankuzmin-skills@stepankuzmin
```

and `/reload-plugins` in the open session. These are Claude Code commands; in
Codex, reinstall the plugin as the README describes and start a new thread.
