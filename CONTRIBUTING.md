# Contributing to LogAtlas

Thank you for your interest in contributing! This guide covers environment setup, project layout, and how to add new log parsers.

---

## Development Setup

```bash
git clone <repo-url> logatlas
cd logatlas
npm install
npm run compile     # one-shot compile
# or
npm run watch       # recompile on save
```

Press **F5** in VS Code to launch the Extension Development Host with LogAtlas loaded.

---

## Project Structure

```
src/
├── extension.ts              # Entry point — registers CustomTextEditorProvider and commands
├── LogAtlasEditorProvider.ts  # Reads file, sends LogEntry[] to webview via postMessage
│                             # Handles large files (> 5 MB) by streaming in 512 KB chunks
├── types.ts                  # Shared TypeScript interfaces (LogEntry, LogLevel, LogFormat)
├── parsers/
│   ├── index.ts              # detectFormat() + parseLog() — routes to the right parser
│   ├── laravelParser.ts      # Laravel log format with multi-line stack trace grouping
│   ├── nginxParser.ts        # Nginx access (Combined Log Format)
│   └── apacheParser.ts       # Apache access (Combined Log Format — reuses Nginx regex)
└── webview/
    ├── main.js               # Vanilla JS: virtual scroller, level/search/time filters
    └── styles.css            # Themed entirely with VS Code CSS variables
```

---

## Adding a New Log Format Parser

### 1. Add the format to `LogFormat` in `src/types.ts`

```typescript
export type LogFormat =
  | 'laravel'
  | 'nginx-access'
  | 'apache-access'
  | 'my-format'     // ← add here
  | ...;
```

### 2. Create the parser at `src/parsers/myParser.ts`

Export exactly two functions:

```typescript
import { LogEntry } from '../types';

// Parse full file content → LogEntry[]
export function parseMyFormat(content: string): LogEntry[] {
  // ...
}

// Return the number of sample lines matching this format (used for auto-detection)
export function detectScore(sample: string[]): number {
  // ...
}
```

### 3. Register in `src/parsers/index.ts`

Add a score entry to `detectFormat()`:

```typescript
const scores: Array<[LogFormat, number]> = [
  ['laravel',       laravelScore(sample)],
  ['nginx-access',  nginxScore(sample)],
  ['apache-access', apacheScore(sample)],
  ['my-format',     myScore(sample)],   // ← add here
];
```

Add a `case` to `parseLog()`:

```typescript
case 'my-format':
  return { entries: parseMyFormat(content), format: 'my-format' };
```

### 4. Write tests at `src/test/myParser.test.ts`

See `src/test/laravelParser.test.ts` for the pattern. Cover: field parsing, level mapping, edge cases (blank lines, multi-line entries).

### 5. Update `README.md`

Add a row to the Supported Log Formats table.

---

## Code Style

- TypeScript strict mode is enabled — avoid `any`
- **Parsers must be pure functions** — no VS Code API imports in `src/parsers/`
- `src/webview/main.js` must stay **vanilla JS** — no bundler, no framework
- Use `document.createTextNode()` and DOM APIs for dynamic content in the webview — never build HTML strings from user-controlled data

---

## Running Tests

```bash
npm test
```

Parser tests run with Jest + ts-jest. No VS Code instance needed.

Integration testing is done manually via the Extension Development Host (F5).

---

## Pull Request Checklist

- [ ] `npm run compile` passes with zero TypeScript errors
- [ ] `npm test` passes
- [ ] New parsers include tests in `src/test/`
- [ ] `README.md` updated if a new format is supported
- [ ] One feature or fix per PR

---

## Commit Message Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Apache error log parser
fix: handle empty files without crashing
docs: update README with v2 roadmap
test: add edge cases for Laravel multi-line stack traces
refactor: extract status-to-level mapping into shared util
```
