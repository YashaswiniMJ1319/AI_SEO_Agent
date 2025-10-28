import * as vscode from 'vscode';

// --- Add Missing Imports ---
import { TokenManager } from './auth/tokenManager';
import { registerLoginCommand, registerLogoutCommand } from './commands/authCommands';
import { AISEOAuthProvider, AUTH_PROVIDER_ID, AUTH_PROVIDER_LABEL } from './auth/AuthProvider';
import { registerAnalyzeCommand } from './commands/analyzeCommand';
// --- End Missing Imports ---

export function activate(context: vscode.ExtensionContext) {
    console.log('>>> AI SEO Agent: activate() function STARTED.');

    const authProvider = new AISEOAuthProvider(context);

    // --- Register URI Handler EARLY ---
    console.log('Registering specific URI Handler (for authProvider.handleUri)...');
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri: (uri: vscode.Uri) => {
                console.log(`>>> URI received by handler: ${uri.toString(true)}`);
                authProvider.handleUri(uri);
            }
        })
    );
    console.log('Specific URI Handler registered.');
    // --- End URI Handler ---

    console.log('Congratulations, your extension "ai-seo-agent-vscode" is now active! 🎉');

    // --- Initialize TokenManager ---
    try {
        TokenManager.initialize(context);
        console.log('TokenManager initialized successfully.');
    } catch (error: any) {
        console.error('Failed to initialize TokenManager:', error);
        vscode.window.showErrorMessage('AI SEO Agent failed to initialize secure storage.');
        return;
    }

    // --- Register Auth Provider ---
    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(
            AUTH_PROVIDER_ID,
            AUTH_PROVIDER_LABEL,
            authProvider,
            { supportsMultipleAccounts: false }
        )
    );

    // Register provider for disposal
    context.subscriptions.push(authProvider);
    console.log('AISEOAuthProvider registered.');
    // --- End Auth Provider Registration ---

    // --- Register Commands ---
    registerLoginCommand(context);
    registerLogoutCommand(context);
    registerAnalyzeCommand(context);
    console.log('Commands registered.');
    // --- End Command Registration ---
}

export function deactivate() {
    console.log('Deactivating AI SEO Agent extension.');
}
