# LogAtlas

**Your log files, finally readable.**

LogAtlas replaces VS Code's default text view for `.log` files with a purpose-built viewer — auto-parsed, colour-coded, and filterable without leaving your editor.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=logatlas.logatlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![Version](https://img.shields.io/badge/version-0.1.1-orange)]()

---

![LogAtlas screenshot — dark theme](images/screenshot-1.png)

![LogAtlas screenshot — filter bar](images/screenshot-2.png)

---

## What it does

Just open a `.log` file. LogAtlas automatically detects whether it's a Laravel, Nginx, or Apache log and shows every entry in a clean, structured list — no setup, no config.

---

## Features

🎨 **Colour-coded severity** — ERROR, WARNING, INFO, DEBUG each get a distinct badge colour that matches your VS Code theme (light, dark, and high-contrast)

🔍 **Real-time search** — filter by message, URL, or IP address as you type; matches are highlighted inline

⚡ **Level & time filters** — show only the severity you care about, optionally limited to the last 1h / 24h / 7 days

📋 **Stack trace collapse** — multi-line traces are folded by default; click ▶ or press `Enter` to expand

🚀 **Handles huge files** — files over 5 MB stream progressively so entries appear as they load, not after

---

## Supported Formats

| Format | Auto-detected from |
|---|---|
| **Laravel** | `[YYYY-MM-DD HH:mm:ss] env.LEVEL: message` |
| **Nginx access** | Combined Log Format |
| **Apache access** | Combined Log Format |

More formats coming — see the roadmap below.

---

## Usage

1. Install LogAtlas from the Marketplace
2. Open any `.log` file — LogAtlas activates automatically
3. Use the filter bar to narrow down entries by level, keyword, or time

> **Need the raw file?** Click the **Open as Plain Text** icon (↗) in the editor title bar to switch back to the default text view at any time.

---

## License

MIT © 2026 Ahmed Soliman
