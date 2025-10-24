import * as vscode from 'vscode';
import { TokenManager } from './auth/tokenManager';
import { registerLoginCommand, registerLogoutCommand } from './commands/authCommands';
import { AISEOAuthProvider, AUTH_PROVIDER_ID, AUTH_PROVIDER_LABEL } from './auth/AuthProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('>>> AI SEO Agent: activate() function STARTED.');
    console.log('Congratulations, your extension "ai-seo-agent-vscode" is now active! 🎉');

    try {
        TokenManager.initialize(context);
        console.log('TokenManager initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize TokenManager:', error);
        vscode.window.showErrorMessage('AI SEO Agent failed to initialize secure storage.');
        return;
    }

    const authProvider = new AISEOAuthProvider(context);
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(
            AUTH_PROVIDER_ID,
            AUTH_PROVIDER_LABEL,
            // --- Cast to ensure compatibility, assuming implementation matches intent ---
            authProvider as vscode.AuthenticationProvider,
            // --- End Cast ---
            { supportsMultipleAccounts: false }
        )
    );
    context.subscriptions.push(authProvider);
    console.log('AISEOAuthProvider registered.');


    registerLoginCommand(context);
    registerLogoutCommand(context);

    const analyzeDisposable = vscode.commands.registerCommand('ai-seo-agent-vscode.analyzeFile', async () => {
        try {
             const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: false });
             if (!session) {
                 vscode.window.showWarningMessage('Please log in to AI SEO Agent first.', 'Login').then(selection => {
                     if (selection === 'Login') {
                         vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                     }
                 });
                 return;
             }
             vscode.window.showInformationMessage(`Analyze File command triggered! (Logged in as ${session.account.label})`);
             // TODO: Get active editor content, call API using session.accessToken, display results
        } catch (error) {
             console.error("Error checking session for analysis:", error);
             vscode.window.showErrorMessage("Could not verify login status.");
        }
    });
    context.subscriptions.push(analyzeDisposable);
}

export function deactivate() {
    console.log('Deactivating AI SEO Agent extension.');
}
