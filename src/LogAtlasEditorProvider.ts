import * as vscode from 'vscode';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parseLog, detectFormat } from './parsers';
import { LogEntry, LogFormat } from './types';

const CHUNK_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const CHUNK_SIZE      = 512 * 1024;       // 512 KB

export class LogAtlasEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
      ],
    };
    webviewPanel.webview.html = this.buildHtml(webviewPanel.webview);

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let activeGeneration = 0;

    const sendContent = async (): Promise<void> => {
      const myGeneration = ++activeGeneration;
      const filePath = document.uri.fsPath;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        return;
      }

      if (stat.size > CHUNK_THRESHOLD) {
        await this.streamFile(filePath, webviewPanel.webview, () => myGeneration !== activeGeneration);
      } else {
        if (myGeneration !== activeGeneration) return;
        const content = document.getText();
        const { entries, format } = parseLog(content);
        webviewPanel.webview.postMessage({
          type: 'init',
          entries,
          format,
          totalLines: content.split('\n').length,
        });
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (msg: { type: string }) => {
      if (msg.type === 'ready') {
        await sendContent();
      } else if (msg.type === 'openAsText') {
        await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
      }
    });

    const watcher = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void sendContent().catch(err => {
            webviewPanel.webview.postMessage({ type: 'error', message: String(err) });
          });
        }, 300);
      }
    });
    webviewPanel.onDidDispose(() => {
      watcher.dispose();
      clearTimeout(debounceTimer);
    });
  }

  private async streamFile(
    filePath: string,
    webview: vscode.Webview,
    isCancelled: () => boolean = () => false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        highWaterMark: CHUNK_SIZE,
      });

      let lineBuffer = '';
      let entryId = 0;
      let lineNumber = 1;
      let format: LogFormat = 'unknown';
      let pendingLines: string[] = [];
      let formatDetected = false;

      const processLines = (lines: string[]): LogEntry[] => {
        if (lines.length === 0) return [];
        const { entries } = parseLog(lines.join('\n'), format);
        entries.forEach(e => {
          e.id = entryId++;
          e.lineNumber = e.lineNumber + lineNumber - 1;
        });
        lineNumber += lines.length;
        return entries;
      };

      stream.on('data', (chunk: string | Buffer) => {
        if (isCancelled()) { stream.destroy(); return; }
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        lineBuffer += chunkStr;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        if (!formatDetected) {
          pendingLines.push(...lines);
          if (pendingLines.length >= 20) {
            format = detectFormat(pendingLines);
            formatDetected = true;
            const entries = processLines(pendingLines);
            pendingLines = [];
            if (!isCancelled()) {
              webview.postMessage({ type: 'init', entries, format, totalLines: -1 });
            }
          }
          // else: keep buffering until format is known
        } else {
          const entries = processLines(lines);
          if (!isCancelled()) {
            webview.postMessage({ type: 'append', entries });
          }
        }
      });

      stream.on('end', () => {
        if (!isCancelled()) {
          if (!formatDetected) {
            // Entire file had fewer than 20 complete lines
            if (lineBuffer.trim()) pendingLines.push(lineBuffer);
            format = detectFormat(pendingLines);
            const entries = processLines(pendingLines);
            webview.postMessage({ type: 'init', entries, format, totalLines: -1 });
          } else if (lineBuffer.trim()) {
            const entries = processLines([lineBuffer]);
            webview.postMessage({ type: 'append', entries });
          }
          webview.postMessage({ type: 'done' });
        }
        resolve();
      });

      stream.on('close', () => resolve()); // resolves the promise when stream.destroy() is called early

      stream.on('error', (err) => {
        if (isCancelled()) { resolve(); return; }
        reject(err);
      });
    });
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'main.js')
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'styles.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${stylesUri}" rel="stylesheet">
  <title>LogAtlas</title>
</head>
<body>
  <div id="filter-bar">
    <select id="level-filter">
      <option value="">All Levels</option>
      <option value="ERROR">ERROR</option>
      <option value="CRITICAL">CRITICAL</option>
      <option value="WARNING">WARNING</option>
      <option value="NOTICE">NOTICE</option>
      <option value="INFO">INFO</option>
      <option value="DEBUG">DEBUG</option>
    </select>
    <input id="search-input" type="text" placeholder="Search message, URL, IP\u2026">
    <button class="quick-time-btn" id="time-btn-1m">1m</button>
    <button class="quick-time-btn" id="time-btn-5m">5m</button>
    <select id="time-filter">
      <option value="0">All time</option>
      <option value="1">Last 1h</option>
      <option value="24">Last 24h</option>
      <option value="168">Last 7d</option>
      <option value="-1">Custom\u2026</option>
    </select>
  </div>
  <div id="custom-range-bar" style="display:none">
    <span class="custom-range-label">From:</span>
    <input type="datetime-local" id="range-start">
    <span class="custom-range-label">To:</span>
    <input type="datetime-local" id="range-end">
  </div>
  <div id="scroller-container">
    <div id="spacer"></div>
    <div id="rows-container"></div>
  </div>
  <div id="status-bar">Loading\u2026</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
