# Changelog

All notable changes to LogAtlas are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.1] — 2026-03-27

### Added

- `CustomTextEditorProvider` — `.log` files open in LogAtlas by default
- Auto-format detection: samples first 20 lines, scores each parser, picks the winner
- **Laravel parser** — parses `[YYYY-MM-DD HH:mm:ss] env.LEVEL: message` with multi-line stack trace grouping
- **Nginx access parser** — Combined Log Format; level derived from HTTP status code
- **Apache access parser** — Combined Log Format (reuses Nginx regex, sets `format: apache-access`)
- Level filter dropdown (All / ERROR / CRITICAL / WARNING / NOTICE / INFO / DEBUG)
- Text search with match highlighting via `<mark>` elements
- Time range filter (All time / Last 1h / Last 24h / Last 7d, relative to newest timestamp)
- Virtual scrolling with estimated row heights (`heights[]` + `offsets[]` arrays, binary search for visible range)
- Stack trace collapse/expand toggle per entry
- Level colour coding via VS Code CSS variables (works in light + dark themes)
- Large file streaming: files > 5 MB are parsed in 512 KB chunks and sent progressively
- `LogAtlas: Open as Plain Text` command in editor title bar
- 42 Jest unit tests covering all parsers and auto-detection logic
