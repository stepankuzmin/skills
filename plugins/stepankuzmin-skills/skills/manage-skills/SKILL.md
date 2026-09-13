---
name: manage-skills
description: Add, update, remove, or install skills in the stepankuzmin-skills plugin. Opens a PR against stepankuzmin/skills from any repo.
disable-model-invocation: true
---

# Manage skills

The plugin lives in https://github.com/stepankuzmin/skills. Its root
`./skills.ts` vendors external skills into `plugins/stepankuzmin-skills/skills/`
through `npx skills`, records the source in
`plugins/stepankuzmin-skills/skills-lock.json`, and syncs the manifests. This
skill runs that CLI in a fresh clone and opens a PR.

Request: $ARGUMENTS

## 1. Pick the operation

| Request | Command in the clone |
| --- | --- |
| add `<skill>` from `<source>` | `./skills.ts add <source> -s <skill>` |
| update `<skill>` (or everything) | `./skills.ts update [<skill>]` |
| remove `<skill>` | `./skills.ts remove <skill>` |
| install (pull the latest release locally) | step 6 only |

`<source>` is anything `npx skills` accepts: `owner/repo`, `owner/repo#ref`, a
GitHub tree URL, a git URL, or a local path. "This repo" or "the skill in
`.claude/skills/<skill>`" means the absolute path of the current repo root.
If the skill or source is unclear, ask with `AskUserQuestion`.

## 2. Clone

```bash
gh repo clone stepankuzmin/skills "$SCRATCH/skills"
cd "$SCRATCH/skills"
git switch -c <add|update|remove>-<skill>
```

`$SCRATCH` is the session scratchpad directory. Node must satisfy the
`engines` field in `package.json`; `.nvmrc` names the tested version.

## 3. Run the command

Run it from the clone root. A non-zero exit means nothing was synced: report
the output and stop.

## 4. Review what landed

```bash
git status --porcelain
git diff -- plugins/stepankuzmin-skills/skills-lock.json
```

For add and update, read the vendored `SKILL.md` and confirm its `name` and
`description` match the request. The lock file must list exactly the vendored
skills present in `plugins/stepankuzmin-skills/skills/`.

`README.md` lists every skill under "The marketplace includes". Add a line for
each new skill in the same form as the existing ones, and drop the line for
each removed one.

## 5. Commit and open the PR

Confirm with `AskUserQuestion` before each of these:

1. Commit: `Add <skill> from <source>`, `Update <skill>`, or `Remove <skill>`.
2. Push the branch and `gh pr create --web --fill`. Never `--draft`.

Report the PR URL. Merging is the user's step.

## 6. Install after the merge

Installed plugins pin the version in `plugin.json`, so a merge alone changes
nothing locally. Tell the user:

1. In the skills repo, run `/release` to bump the version and tag.
2. Then, from anywhere:

```bash
claude plugin marketplace update stepankuzmin
claude plugin update stepankuzmin-skills@stepankuzmin
```

3. Run `/reload-plugins` in the open session.

For the install operation, run steps 2 and 3 directly.
