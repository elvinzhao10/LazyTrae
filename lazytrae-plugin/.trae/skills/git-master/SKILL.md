<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
name: git-master
description: "Git workflow discipline and best practices. Use for any work involving git: commits, branches, rebases, merges, bisects, cherry-picks. Triggers: git, commit, branch, rebase, merge, bisect, cherry-pick, revert, stash."
---

# git-master

Git workflow discipline for LazyTrae. Ensures clean, atomic, well-documented commits and a maintainable history. Good git hygiene makes debugging, review, and collaboration easier.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/git-master/SKILL.md` — git workflow discipline: conventional commits, atomic commits, clean history, rebasing, branching strategies, bisect for debugging, stash, cherry-pick, revert.

## Purpose

Maintain a clean, readable, and useful git history. Every commit should be a self-contained logical change with a clear purpose. Good git discipline pays off during debugging, code review, and release management.

## Required Context to Inspect

- The current git status and branch.
- The project's branching strategy (main/develop, feature branches, etc.).
- The commit message conventions (conventional commits, etc.).
- The base branch for PRs and merges.
- Any protected branch rules.
- The project's code review process.

## Step-by-Step Procedure

### 1. Conventional Commits

1. **Use conventional commit format:**
   ```
   <type>(<scope>): <imperative subject>

   <body — what and why, not how>

   <footer — BREAKING CHANGE, Fixes #123, etc.>
   ```

2. **Types:**
   - `feat` — new feature
   - `fix` — bug fix
   - `refactor` — code change that neither fixes a bug nor adds a feature
   - `perf` — performance improvement
   - `test` — adding or fixing tests
   - `docs` — documentation only
   - `style` — formatting, white-space, missing semicolons, etc.
   - `chore` — build process, tooling, dependency updates
   - `ci` — CI/CD changes
   - `revert` — revert a previous commit

3. **Subject line rules:**
   - Imperative mood: "add", "fix", not "added" or "fixes"
   - No period at the end
   - 50 characters or less
   - Capitalize the first letter

4. **Body rules:**
   - Wrap at 72 characters
   - Explain WHAT and WHY, not HOW (the code shows how)
   - Separate from subject with a blank line

### 2. Atomic Commits

1. **One logical change per commit.** A commit should do ONE thing.
2. **Every commit builds and tests green on its own.** You should be able to check out any commit and have a working system.
3. **No "WIP" commits on the final branch.** Squash or amend before merging.
4. **No "fix review feedback" commits.** Fold fixes into the original commit.
5. **If you need to make two changes, make two commits.** Don't bundle unrelated changes.

### 3. Staging — Stage Only What You Changed

1. **Stage specific files, not everything.**
   - `git add <file>` — stage a whole file
   - `git add -p` — stage specific hunks interactively
   - `git add -i` — interactive staging
2. **Review before committing.**
   - `git diff --cached` — see what's staged
   - `git status` — confirm what you're committing
3. **Never use `git add -A` or `git add .`** — you'll accidentally commit things you don't want.

### 4. Branches

1. **Short-lived feature branches.** Create, use, delete.
2. **Branch naming:**
   - `feat/<description>` — feature work
   - `fix/<description>` — bug fixes
   - `chore/<description>` — maintenance
   - `refactor/<description>` — refactoring
3. **Delete branches after merging.** Don't accumulate stale branches.
4. **Rebase feature branches on the base branch regularly.** Stay up to date.

### 5. Rebasing

1. **Rebase to keep history linear.** No unnecessary merge commits.
2. **Interactive rebase for cleanup:**
   ```bash
   git rebase -i main
   ```
3. **Interactive rebase commands:**
   - `pick` — keep the commit as-is
   - `reword` — change the commit message
   - `edit` — split or amend the commit
   - `squash` — combine with previous commit, edit message
   - `fixup` — combine with previous commit, discard message
   - `drop` — remove the commit
4. **Never rebase public/shared branches.** Only rebase your own feature branches.
5. **After rebase, force push carefully:**
   ```bash
   git push --force-with-lease
   ```

### 6. Git Bisect for Debugging

1. **Find the commit that introduced a bug:**
   ```bash
   git bisect start
   git bisect bad          # current commit is broken
   git bisect good <sha>   # this commit was working
   ```
2. **Git will binary-search through commits.** Test each one, mark good or bad.
3. **When found, it shows you the first bad commit.**
4. **Reset bisect state:**
   ```bash
   git bisect reset
   ```
5. **Automate with a script or test command:**
   ```bash
   git bisect run npm test
   ```

### 7. Stash

1. **Save work-in-progress without committing:**
   ```bash
   git stash push -m "description"
   ```
2. **List stashes:**
   ```bash
   git stash list
   ```
3. **Apply and remove the top stash:**
   ```bash
   git stash pop
   ```
4. **Apply without removing:**
   ```bash
   git stash apply stash@{0}
   ```
5. **Drop a stash:**
   ```bash
   git stash drop stash@{0}
   ```

### 8. Cherry-Pick

1. **Apply a specific commit to the current branch:**
   ```bash
   git cherry-pick <commit-sha>
   ```
2. **If there are conflicts, resolve them and continue:**
   ```bash
   git cherry-pick --continue
   ```
3. **Or abort and go back:**
   ```bash
   git cherry-pick --abort
   ```
4. **Cherry-pick a range:**
   ```bash
   git cherry-pick A..B    # commits after A up to and including B
   ```

### 9. Revert

1. **Undo a commit by creating a new commit that reverses it:**
   ```bash
   git revert <commit-sha>
   ```
2. **Use revert on public branches** — it's safe and doesn't rewrite history.
3. **Use reset/amend on your own branches** when you haven't pushed yet.

### 10. Useful Commands

| Command | Purpose |
|---------|---------|
| `git log --oneline -20` | Recent commits, one line each |
| `git log --graph --oneline --all` | Branch graph overview |
| `git diff <branch1>..<branch2>` | Compare two branches |
| `git blame <file>` | See who changed each line |
| `git show <sha>` | Show a specific commit |
| `git reflog` | History of HEAD movements (undo mistakes) |
| `git clean -fd` | Remove untracked files and directories |
| `git checkout -b <branch>` | Create and switch to new branch |
| `git branch -d <branch>` | Delete merged branch |
| `git branch -D <branch>` | Force delete unmerged branch |

## Allowed Edits

- Git operations (commits, branches, rebases, etc.).
- Source code files (when making the changes being committed).
- Test files (when making the changes being committed).
- Documentation files.

## Forbidden Behavior

- Do NOT use `git add -A` or `git add .` — stage specific files.
- Do NOT commit unrelated changes together.
- Do NOT push WIP commits to shared branches.
- Do NOT force push to shared branches.
- Do NOT rebase public branches.
- Do NOT commit secrets, API keys, or credentials.
- Do NOT commit `node_modules`, `dist`, `build`, or generated files.
- Do NOT commit large binary files — use Git LFS or external storage.
- Do NOT amend commits that are already pushed to shared branches.
- Do NOT use `git push --force` — use `--force-with-lease` instead.

## Verification Gates

1. **Plan reread**: Commit history is clean and tells a logical story.
2. **Automated verification**: Every commit builds and tests green.
3. **Manual-QA**: Commits are atomic, well-described, follow conventions.
4. **Adversarial QA**: `git bisect` works, history is bisectable.
5. **Cleanup**: No WIP commits, no fixup commits, no stale branches.

## Failure Handling

- If you make a bad commit: `git commit --amend` (if not pushed) or `git revert` (if pushed).
- If you stage the wrong thing: `git reset HEAD <file>` to unstage.
- If you lose work: check `git reflog` — it's almost always recoverable.
- If you mess up a rebase: `git rebase --abort` and try again.
- If you push something you shouldn't have: fix it locally, force-push carefully, communicate with the team.

## Output Format

```
GIT WORKFLOW SUMMARY
=====================

Branch: <current branch>
Base: <base branch>
Commits:
  <sha1> <type>(<scope>): <subject>
  <sha2> <type>(<scope>): <subject>
  ...

Verification:
  - Atomic commits: yes / no
  - Conventional format: yes / no
  - Every commit builds: yes / no
  - Clean history: yes / no
```

## Handoff Target

After git operations, hand off to the next phase of work. If commits are ready for review, hand off to `review-work`. If commits need more work, hand back to `start-work`.
