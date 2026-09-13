---
name: manage-skills
description: Add, update, remove, or install skills in the stepankuzmin-skills plugin from any repo, through the repo's vendor workflow.
disable-model-invocation: true
---

# Manage skills

`skills.yml` in https://github.com/stepankuzmin/skills is a `workflow_dispatch`
workflow that vendors a skill on a runner and opens a PR. This skill triggers
it with `gh`.

Request: $ARGUMENTS

## 1. Pick the operation

| Request | Command |
| --- | --- |
| add `<skill>` from `<source>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=add -f skill=<skill> -f source=<source>` |
| update `<skill>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=update -f skill=<skill>` |
| update everything | `gh workflow run skills.yml -R stepankuzmin/skills -f op=update` |
| remove `<skill>` | `gh workflow run skills.yml -R stepankuzmin/skills -f op=remove -f skill=<skill>` |
| install | section 3 |

`<source>` is `owner/repo`, `owner/repo#ref`, a GitHub tree URL, or a git URL.
The runner cannot read local disk, so a skill in the current repo must be
pushed first; then pass the repo as `owner/repo#branch`. If the skill or source is
unclear, ask with `AskUserQuestion`.

## 2. Run and watch

```bash
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run ...
gh run list -R stepankuzmin/skills -w skills.yml -u "$(gh api user -q .login)" -L 1 \
  --json databaseId,createdAt -q ".[] | select(.createdAt >= \"$since\") | .databaseId"
gh run watch <id> -R stepankuzmin/skills --exit-status
gh run view <id> -R stepankuzmin/skills --log | grep -oE 'Nothing changed|https://github.com/[^ ]*/pull/[0-9]+'
```

The run appears a few seconds after dispatch; when the list is empty, wait
five seconds and list again. On failure, show
`gh run view <id> -R stepankuzmin/skills --log-failed` and stop. The last
command yields either "Nothing changed" or the PR URL; report it. Reviewing
and merging is the user's step.

## 3. Install

Installed plugins pin the version in `plugin.json`, so a merge alone changes
nothing locally. After the merge, run `/release` in a checkout of the skills
repo on `main`; the pushed tag creates the GitHub release. Then

```bash
claude plugin marketplace update stepankuzmin
claude plugin update stepankuzmin-skills@stepankuzmin
```

and `/reload-plugins` in the open session. These are Claude Code commands; in
Codex, reinstall the plugin as the README describes and start a new thread.
