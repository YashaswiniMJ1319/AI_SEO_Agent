// vscode/src/providers/SeoPanelViewProvider.ts
import * as vscode from 'vscode';
import { seoService } from '../api/seoService'; // Assuming path is correct
import { AUTH_PROVIDER_ID } from '../auth/AuthProvider'; // For checking login status

export class SeoPanelViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'aiSeoAgentView'; // Must match the ID in package.json

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's directories
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'), // For CSS, JS, images
                vscode.Uri.joinPath(this._extensionUri, 'dist') // If webview JS is bundled here
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview (e.g., analyze button click)
        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'analyzeCurrentFile':
                    {
                        await this.analyzeCurrentFile();
                        break;
                    }
                case 'loginRequest':
                    {
                         vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                         break;
                    }
                case 'logoutRequest':
                    {
                        vscode.commands.executeCommand('ai-seo-agent-vscode.logout');
                        break;
                    }
                 case 'getInitialState': // Message sent by webview on load
                    {
                        await this.updateLoginState();
                        break;
                    }

                // Add more message types as needed (e.g., analyze with specific keyword)
            }
        });

         // Update login state when auth changes
         vscode.authentication.onDidChangeSessions(async e => {
            if (e.provider.id === AUTH_PROVIDER_ID) {
                await this.updateLoginState();
            }
         });

         // Initial state check
         this.updateLoginState();

    }

    // --- Actions ---

    private async analyzeCurrentFile() {
        if (!this._view) {
            return;
        }

        const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: false });
         if (!session) {
             this._view.webview.postMessage({ type: 'showLoginRequired' });
             vscode.window.showWarningMessage('Please log in to AI SEO Agent first.', 'Login').then(selection => {
                if (selection === 'Login') {
                    vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                }
             });
             return;
         }


        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._view.webview.postMessage({ type: 'analysisError', message: 'No active text editor found.' });
            vscode.window.showInformationMessage('No active text editor found.');
            return;
        }

        const document = editor.document;
        const content = document.getText();
        const contentType = this.getContentTypeFromLanguageId(document.languageId);

        if (!content.trim()) {
            this._view.webview.postMessage({ type: 'analysisError', message: 'The file is empty.' });
            vscode.window.showInformationMessage('The file is empty. Cannot analyze.');
            return;
        }

        this._view.webview.postMessage({ type: 'analysisStarted' }); // Notify UI

        try {
            // TODO: Get targetKeyword from webview message if needed
            const analysisConfig: { targetKeyword?: string } = {};
            // if (data.targetKeyword) { analysisConfig.targetKeyword = data.targetKeyword; }

            const result = await seoService.analyzeContent(content, contentType, analysisConfig);

            // Send results back to the webview
            this._view.webview.postMessage({ type: 'analysisComplete', data: result });

        } catch (error: any) {
             console.error('Analysis API Call Failed from Sidebar:', error);
             let errorMessage = `Analysis Failed: ${error.message || 'Could not connect to the analysis server.'}`;
             // Avoid duplicate login prompts if error is handled by seoService
             if (error.message !== "Authentication failed (AI Brain).") {
                 vscode.window.showErrorMessage(errorMessage);
             }
            // Send error to webview
             this._view.webview.postMessage({ type: 'analysisError', message: errorMessage });
        }
    }

    private async updateLoginState() {
        if (!this._view) return;
        const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: false });
        this._view.webview.postMessage({ type: 'loginStateUpdate', isLoggedIn: !!session, userLabel: session?.account.label });
    }

    // --- Helpers ---

    private getContentTypeFromLanguageId(languageId: string): string {
        // (Keep your existing getContentTypeFromLanguageId function logic here or move it to a utils file)
        switch (languageId.toLowerCase()) {
            case 'html':
                return 'html';
            case 'markdown':
                return 'markdown';
            default:
                console.warn(`Unsupported languageId: ${languageId}. Defaulting contentType to 'html'.`);
                return 'html';
        }
    }


    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

        // Do the same for the stylesheet.
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <title>AI SEO Analysis</title>
            </head>
            <body>
                <div id="app">
                    <div id="auth-status">
                        <p id="user-info">Checking login status...</p>
                        <button id="login-button" class="button">Login</button>
                        <button id="logout-button" class="button" style="display: none;">Logout</button>
                    </div>
                    <hr/>
                    <button id="analyze-button" class="button">Analyze Current File</button>
                    <hr/>
                    <div id="results-area">
                         <p id="status-message">Ready.</p>
                         <div id="score"></div>
                         <div id="keyword-analysis"></div>
                         <h3>Issues:</h3>
                         <ul id="issues-list"></ul>
                         <h3>AI Suggestions:</h3>
                         <ul id="suggestions-list"></ul>
                    </div>
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

// Helper function to generate nonce
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}