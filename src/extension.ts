import * as vscode from 'vscode';
import { LogAtlasEditorProvider } from './LogAtlasEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'logatlas.logViewer',
      new LogAtlasEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('logatlas.openAsText', async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab?.input instanceof vscode.TabInputCustom) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          activeTab.input.uri,
          'default'
        );
      }
    })
  );
}

export function deactivate(): void {}
