# Project lessons

- Treat the Mole application and the Mole CLI as separate products: keep the CLI installation instructions intact and label any application or affiliate link explicitly.
- An interactive `dev` script must not use Bun's persistent `--watch` supervisor: quitting the TUI should resolve the awaited Ink lifecycle, restore the alternate screen in `finally`, and return the shell prompt without requiring `Ctrl+C`.
- Do not treat a successful package listing as proof that the manager can mutate the environment: probe pip safely before offering updates or removals, respect `EXTERNALLY-MANAGED`, and never add `--break-system-packages` automatically.
- Do not append redundant `unavailable` labels to disabled menu actions when the adjacent system status already explains why; keep the disabled styling compact and avoid line wrapping.
- Do not disable an informational screen merely because its primary collection is empty: the outdated list must remain accessible to explain an empty result and any skipped managers.
