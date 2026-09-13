---
name: release
description: Cut a new release of this plugins marketplace. Reviews everything since the previous tag, picks a semver bump, bumps the version, publishes it into every manifest, lands it in one commit, then tags and pushes. Use when asked to "release", "cut a release", "ship a version", "bump the version", or "tag a release" in this repo. Always confirms the tag explicitly before creating it.
---

# Release

Version and description live in the root `package.json`; `npm run publish`
propagates them into every plugin manifest listed in `marketplace.json`. This
skill drives that flow end to end, landing all the bumps in a single commit.

## 1. Check the tree is clean

`npm version` refuses to run with uncommitted changes, and a release must not
sweep unrelated edits into its commit.

```bash
git status --porcelain
```

If anything is uncommitted, stop and report it — do not commit it yourself.
Let the user commit or stash first, then re-run.

## 2. Find the previous tag and review what changed

```bash
git describe --tags --abbrev=0   # previous release tag; empty on first release
git log <prev-tag>..HEAD --stat  # commits + files since it (omit range if none)
git diff <prev-tag>..HEAD        # the actual changes
```

Read the changes. Understand them well enough to explain, in one or two
sentences, what this release contains.

## 3. Choose a semver bump

These are skills and agents, so judge by user-visible impact:

- **major** — a skill or agent was removed, or an existing one changed in a way
  that breaks how people already invoke or rely on it.
- **minor** — a new skill or agent was added, or new capability, backward
  compatible.
- **patch** — wording/doc fixes, a bug fix inside a skill, or internal tooling,
  with no change to how users invoke anything.

## 4. Confirm the tag explicitly

Before touching anything, ask with `AskUserQuestion`. State the current version,
the proposed new version and tag (`v<new>`), your one-sentence summary of the
changes, and that confirming will land every bump in **one commit, then tag and
push**. Offer the recommended bump first, the other two bump types, and cancel.
Do not create the tag without an explicit yes.

## 5. Release

On confirmation, bump with `--no-git-tag-version` so npm only edits
`package.json` (no commit, no tag), publish the manifests, then land every bump in
a single commit before tagging and pushing:

```bash
npm version <patch|minor|major> --no-git-tag-version   # bumps package.json only
npm run publish                                            # propagate to the manifests
git commit -am "v<new>"
git tag v<new>
git push origin HEAD v<new>
```

Report the new version and the tag. The pushed tag runs the Release workflow,
which checks the manifests against it and creates the GitHub release.
