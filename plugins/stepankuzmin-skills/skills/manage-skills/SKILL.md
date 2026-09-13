---
name: manage-skills
description: Add, update, remove, or install skills in the stepankuzmin-skills plugin from any repo, in Claude Code. Opens a PR against stepankuzmin/skills.
disable-model-invocation: true
---

# Manage skills

The plugin lives in https://github.com/stepankuzmin/skills. Its root
`./skills.ts` vendors external skills into `plugins/stepankuzmin-skills/skills/`
through `npx skills`, records the source in
`plugins/stepankuzmin-skills/skills-lock.json`, and syncs the manifests and the
README catalog. This skill runs that CLI in a fresh clone and opens a PR.

Request: $ARGUMENTS

## 1. Pick the operation

| Request | Command in the clone | Branch |
| --- | --- | --- |
| add `<skill>` from `<source>` | `./skills.ts add <source> -s <skill>` | `add-<skill>` |
| update `<skill>` | `./skills.ts update <skill>` | `update-<skill>` |
| update everything | `./skills.ts update` | `update-all` |
| remove `<skill>` | `./skills.ts remove <skill>` | `remove-<skill>` |
| install (pull the latest release locally) | section 6, items 2 and 3 | none |

`<source>` is anything `npx skills` accepts: `owner/repo`, `owner/repo#ref`, a
GitHub tree URL, a git URL, or a local path. The command runs inside the
clone, so resolve every local path to an absolute path now, before leaving the
current directory. "This repo" means the absolute path of the current repo
root. If the skill or source is unclear, ask with `AskUserQuestion`.

## 2. Clone

```bash
dir=$(mktemp -d)
gh repo clone stepankuzmin/skills "$dir/skills"
cd "$dir/skills"
git switch -c <branch>
```

Without push access to `stepankuzmin/skills`, use `gh repo fork
stepankuzmin/skills --clone "$dir/skills"` instead; `gh` then targets the fork.
Node must satisfy `engines` in `package.json`; `.nvmrc` names the tested
version.

## 3. Run the command

Run it from the clone root. On a non-zero exit the manifest sync did not run
and copied files may be left behind. Report the output, discard them
(`git restore . && git clean -fd`; the clone holds nothing else), and stop.

## 4. Review what landed

```bash
git add -A
git diff --cached --stat
git diff --cached -- plugins/stepankuzmin-skills/skills-lock.json README.md
```

For add and update, read the vendored `SKILL.md` and confirm its `name` and
`description` match the request. The lock file must list exactly the vendored
skills present in `plugins/stepankuzmin-skills/skills/`, and the README
table must show the skill added or removed.

## 5. Commit and open the PR

Confirm with `AskUserQuestion` before each of these:

1. Commit: `Add <skill> from <source>`, `Update <skill>`, or `Remove <skill>`.
2. Push the branch, then `gh pr create --web --fill`. Never `--draft`.

`--web` opens the PR form in the browser; the user submits it. Report the
branch name and that the form is open. Merging is the user's step.

## 6. Install after the merge

Installed plugins pin the version in `plugin.json`, so a merge alone changes
nothing locally. Tell the user:

1. In a checkout of the skills repo on `main`, pulled past the merge, run
   `/release` to bump the version and tag.
2. Then, from anywhere:

```bash
claude plugin marketplace update stepankuzmin
claude plugin update stepankuzmin-skills@stepankuzmin
```

3. Run `/reload-plugins` in the open session.

These commands are Claude Code's. In Codex, reinstall the plugin as the README
describes and start a new thread.

For the install operation, run items 2 and 3 directly.
