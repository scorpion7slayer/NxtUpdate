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
- [ ] Commit the scoped 1.0.5 changes and push the release branch.
- [ ] Merge the release pull request into `main`.
- [ ] Create and push `v1.0.5` from the merged commit.
- [ ] Monitor the npm publication workflow and verify the public package version.
