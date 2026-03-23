# ⬆️ NxtUpdate

> Universal package updater for macOS — auto-detects and updates everything from one command.

[![npm version](https://img.shields.io/npm/v/nxtupdate)](https://www.npmjs.com/package/nxtupdate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/scorpion7slayer/NxtUpdate/blob/main/LICENSE)
[![Requires Bun](https://img.shields.io/badge/runtime-bun-%23f9f1e1)](https://bun.sh)

NxtUpdate detects every package manager installed on your Mac and updates them all in one go — with an interactive TUI or simple CLI commands.

---

## Features

- **Interactive TUI** — full terminal UI to browse, select, and update packages
- **Auto-detection** — finds every package manager you have installed automatically
- **Selective updates** — choose which managers or packages to update
- **Dry-run mode** — preview what would change before touching anything
- **Uninstall support** — remove packages from any manager via the TUI
- **macOS system updates** — includes `softwareupdate` (with sudo support)
- **Zero config** — just run `nxtupdate`

---

## Supported Package Managers

| Manager | Icon | Command | Notes |
|---|---|---|---|
| Homebrew | 🍺 | `brew` | Formulae + Casks |
| Node.js | 📦 | `npm` / `pnpm` / `yarn` / `bun` | Auto-selects active PM |
| Python | 🐍 | `pip3` / `pip` | Skips virtualenvs |
| Rust / Cargo | 🦀 | `cargo` | Requires `cargo-install-update` |
| macOS System | 🍎 | `softwareupdate` | Runs with sudo |

---

## Requirements

- **macOS** (this tool is macOS-only)
- **[Bun](https://bun.sh) ≥ 1.0.0** — used as the runtime

Install Bun if you don't have it:

```sh
curl -fsSL https://bun.sh/install | bash
```

---

## Installation

```sh
# Via npm (global)
npm install -g nxtupdate

# Via bun (global)
bun add -g nxtupdate
```

---

## Usage

### Interactive TUI (default)

```sh
nxtupdate
```

Launches a full-screen terminal UI. Use arrow keys to navigate, `Enter` to confirm, `Ctrl+C` to quit.

**TUI screens:**
- **Scan** — detects managers and checks for outdated packages
- **Main Menu** — choose to update, list packages, or uninstall
- **Select Packages** — pick exactly which packages to update or remove
- **Update** — live progress for each manager

### CLI Commands

```sh
# Detect all installed package managers
nxtupdate scan

# List outdated packages across all managers
nxtupdate list

# Update everything
nxtupdate update

# Update only one manager
nxtupdate update --only homebrew
nxtupdate update --only npm

# Launch TUI explicitly
nxtupdate tui
```

### Options

| Flag | Description |
|---|---|
| `--only <manager>` | Target a specific package manager |
| `-d, --dry-run` | Show what would be updated, make no changes |
| `--no-sudo` | Skip updates that require sudo (macOS system) |
| `-v, --verbose` | Show package names during update |
| `-y, --yes` | Skip all confirmation prompts |

---

## Rust / Cargo Notes

Cargo does not natively support listing outdated packages. NxtUpdate uses [`cargo-install-update`](https://github.com/nabijaczleweli/cargo-update) for this. Install it once:

```sh
cargo install cargo-install-update
```

---

## Repository

[https://github.com/scorpion7slayer/NxtUpdate](https://github.com/scorpion7slayer/NxtUpdate)

---

## License

MIT © [scorpion7slayer](https://github.com/scorpion7slayer)
