# NxtUpdate interface and security update

## Plan

- [x] Inventory the local dependency tree, GitHub Dependabot alerts, and relevant pull requests.
- [x] Confirm the product context required before changing the terminal interface.
- [x] Resolve each actionable dependency advisory using the smallest supported version changes.
- [x] Use Context7 to verify any version-specific APIs or migration steps before editing code.
- [x] Add the Mole application affiliate link while preserving the Mole CLI instructions.
- [x] Modernize the terminal interface with a consistent hierarchy, navigation language, responsive terminal behavior, and accessible status cues.
- [x] Improve scan/update responsiveness based on measured bottlenecks.
- [x] Verify tests, type checking, production build, dependency audit, and diff quality.

## Review

- GitHub has five open alerts represented by two vulnerable packages: `shell-quote` and `ws`.
- PRs #3 and #5 update only `package-lock.json`; the Bun lockfile used by this project would have remained vulnerable.
- Moved Ink's optional `react-devtools-core` peer to development-only use so Bun can still compile a standalone binary.
- Regenerated both lockfiles with explicit safe overrides: `shell-quote@1.10.0` and `ws@8.21.1`. Neither lockfile installs a vulnerable `ws@7` branch.
- `npm audit --json` and `bun audit` both report zero vulnerabilities after the cleanup.
- Product context is confirmed: product register, sober/fast/reliable personality, narrow-terminal support, non-color status cues, and explicit confirmation for destructive actions.
- Mole now keeps the CLI instructions (`brew install mole`, then `mole`) and presents the application affiliate URL as a separate, explicitly labelled action.
- The TUI uses one navigation vocabulary, preserves menu focus, adapts to 80×24 terminals, loads package paths lazily, and requires an explicit `y` before uninstalling.
- Package-manager scans now run concurrently, update/uninstall work is batched per manager, npm outdated data is fetched once, and artificial delays were removed.
- The measured startup path dropped from roughly 7.93 seconds to 4.35 seconds on this machine (about 45%, with system/network variability).
- Final verification: 6 interface and lifecycle tests pass, TypeScript passes, the compiled binary reports `1.0.5`, the real CLI scan detects all five managers, both frozen installs succeed, both audits are clean, and `git diff --check` passes.

## Exit lifecycle follow-up

- [x] Reproduce the blocked shell after quitting through `bun run dev`.
- [x] Remove the persistent watch supervisor from the interactive development command.
- [x] Await the Ink lifecycle and restore the alternate screen from a `finally` block.
- [x] Add exit lifecycle regression coverage.
- [x] Verify that `q` returns the prompt in a real pseudo-terminal without `Ctrl+C`.

### Exit lifecycle review

- Root cause: the TUI exited and restored the alternate buffer, but Bun's persistent `--watch` parent intentionally stayed alive.
- `bun run dev` now launches the interactive CLI directly.
- Commander awaits the asynchronous TUI lifecycle, and alternate-screen restoration is guaranteed by `finally`.
- PTY proof: after pressing `q`, the corrected `bun run dev` exits immediately with code 0 and writes the terminal restoration sequence; no `Ctrl+C` is needed.

## Release 1.0.5

- [x] Confirm the GitHub remote, authentication, default branch, and existing `v1.0.x` tag convention.
- [x] Synchronize tags and verify that local `main` matches `origin/main` before staging.
- [x] Validate npm and Bun installs, dependency audits, tests, type checking, compiled binary, and package contents.
- [x] Commit the scoped 1.0.5 changes and push the release branch.
- [x] Merge the release pull request into `main`.
- [x] Create and push `v1.0.5` from the merged commit.
- [x] Monitor the npm publication workflow and verify the public package version.

### Release review

- Pull request #6 merged after all three CodeQL checks passed.
- Annotated tag `v1.0.5` resolves to merge commit `22f72ae8475730ca6e12bd1f829bff6adbec4070`.
- GitHub Actions run `30599124825` published the package successfully.
- The npm registry reports `nxtupdate@1.0.5` as the `latest` distribution tag.
- GitHub reports zero open Dependabot alerts after the release.

## Live update progress

### Plan

- [x] Reproduce and trace the update screen's jump from 0% to completion.
- [x] Add a deterministic regression test for progress emitted during a long-running manager command.
- [x] Stream native package-manager activity into the TUI while keeping batched updates.
- [x] Keep the progress language honest when a manager cannot expose a numeric download percentage.
- [x] Verify the focused tests, full test suite, type checking, compiled binary, and PTY rendering.

### Review

- Root cause: package-manager output was buffered until exit while every package in a manager batch changed state together, forcing the UI from 0% directly to 100%.
- `exec` now emits newline and carriage-return progress without changing its collected stdout/stderr result; stdout and stderr use independent streaming decoders.
- Homebrew, Node, pip, Cargo, and macOS updates forward their native activity to the TUI. The active manager shows a spinner, its latest sanitized line, elapsed time, and a clearly labelled finished-package count instead of a fabricated download percentage.
- Batched manager commands are preserved, so the feedback does not reintroduce repeated `brew update` calls or slow per-package execution.
- Regression coverage proves a carriage-return download event arrives before subprocess exit and appears in an 80×24 Ink render before the batched update resolves.
- Final verification: 9 interface/streaming tests pass, TypeScript passes, `git diff --check` passes, the standalone binary compiles and reports `1.0.5`, and a real PTY shows `Downloading` → `Installing` → final success with animated spinners.

## Externally managed Python environments

### Plan

- [x] Reproduce the mismatch between successful `pip list` and blocked `pip install`.
- [x] Add a side-effect-free pip capability probe that works without network access.
- [x] Hide Python packages from update and uninstall flows when pip cannot modify its environment.
- [x] Preserve support for mutable global Python installations and explicit user overrides.
- [x] Add deterministic regression coverage and update the manager documentation.
- [x] Verify the full test suite, TypeScript, compiled binary, real scan, and diff quality.

### Review

- Local reproduction confirmed that `pip3 list --outdated` reports `pip 26.1.2 → 26.2` while the same Homebrew Python rejects even a no-network dry-run with `externally-managed-environment`.
- The Python manager now runs one cached `pip install --dry-run --no-index --disable-pip-version-check pip` capability probe before listing or mutating packages.
- PEP 668 environments return no update/uninstall candidates, and direct update or uninstall calls fail closed without running a mutating command. NxtUpdate never supplies `--break-system-packages`.
- A generic manager `skipReason` keeps the result truthful: CLI scan/list/update and the TUI distinguish `skipped` from `up to date` and report that Homebrew, pipx, or a virtual environment should own the packages.
- Mutable pip environments retain outdated-package parsing, dry-run behavior, native progress streaming, updates, and removals.
- Final verification: 13 tests pass, TypeScript passes, `git diff --check` passes, the standalone `1.0.5` binary compiles, and real compiled scan/list/update-dry-run commands identify the local Homebrew Python as `skipped: externally managed (PEP 668)` without attempting a package mutation.

## Empty outdated-list access

### Plan

- [x] Disable only the update action when there are no actionable updates.
- [x] Keep the outdated-list action selectable for empty and skipped states.
- [x] Render skipped managers and simplified navigation in the empty list.
- [x] Verify 80×24 rendering, tests, TypeScript, and build.

### Review

- Root cause: `isDisabled` incorrectly grouped the informational outdated-list action with the mutating update action whenever the actionable count was zero.
- Only `Update packages` is now disabled at zero. `View outdated list` remains selectable and renders either the real empty state or skipped-manager explanations.
- Empty-list navigation now shows only the relevant back shortcut, and the skipped panel is included in viewport budgeting.
- Final verification: 15 tests pass, including empty and mixed skipped/outdated 80×24 fixtures; TypeScript, compiled `1.0.5` build, and `git diff --check` pass.

## Release 1.0.6

- [x] Audit the local change scope, GitHub authentication, remote synchronization, tag convention, and npm version.
- [x] Update every release version surface to `1.0.6`.
- [x] Prevent an older public npm version from being advertised as an available update by the newer release binary.
- [x] Validate frozen installs, dependency audits, tests, type checking, compiled binary, and npm package contents.
- [x] Commit the scoped changes and push the release branch.
- [x] Merge the release pull request after required checks pass.
- [x] Create and push annotated tag `v1.0.6` from the merged release commit.
- [x] Monitor the npm publication workflow and verify the public GitHub/npm state.

### Release review

- Pull request #8 merged after all three CodeQL checks passed.
- Annotated tag `v1.0.6` resolves to merge commit `ea14497ffff6279e168c0eedf05aaf543b066ec0`.
- GitHub Actions run `30825076954` published the package successfully.
- The npm registry reports `nxtupdate@1.0.6` as the `latest` distribution tag.
- Release validation caught and fixed the pre-publication binary incorrectly advertising the older registry version as an available update.
