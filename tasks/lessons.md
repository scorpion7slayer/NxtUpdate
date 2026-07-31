# Project lessons

- Treat the Mole application and the Mole CLI as separate products: keep the CLI installation instructions intact and label any application or affiliate link explicitly.
- An interactive `dev` script must not use Bun's persistent `--watch` supervisor: quitting the TUI should resolve the awaited Ink lifecycle, restore the alternate screen in `finally`, and return the shell prompt without requiring `Ctrl+C`.
