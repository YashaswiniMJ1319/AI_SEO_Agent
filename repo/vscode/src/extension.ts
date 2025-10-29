import * as vscode from 'vscode';
import { TokenManager } from './auth/tokenManager';
import { registerLoginCommand, registerLogoutCommand } from './commands/authCommands';
import { AISEOAuthProvider, AUTH_PROVIDER_ID, AUTH_PROVIDER_LABEL } from './auth/AuthProvider';
// Keep analyze command registration
import { registerAnalyzeCommand } from './commands/analyzeCommand';
import { SeoPanelViewProvider } from './providers/SeoPanelViewProvider'; // Import the new provider

// --- Export a variable to hold the provider instance ---
// Ensure this is declared ONLY ONCE in this file
export let seoPanelProvider: SeoPanelViewProvider | undefined;
// --------------------------------------------------------

// --- Ensure activate function is defined ONLY ONCE ---
export function activate(context: vscode.ExtensionContext) {
    console.log('>>> AI SEO Agent: activate() function STARTED.');

    // --- Auth Provider Setup ---
    const authProvider = new AISEOAuthProvider(context);
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri: (uri: vscode.Uri) => {
                 console.log(`>>> URI received by handler in extension.ts: ${uri.toString(true)}`); // Add log here
                authProvider.handleUri(uri);
            }
        })
    );
     console.log('Specific URI Handler registered in extension.ts.'); // Add log here

    try {
        TokenManager.initialize(context);
        console.log('TokenManager initialized successfully.');
    } catch (error: any) {
        console.error('Failed to initialize TokenManager:', error);
        vscode.window.showErrorMessage('AI SEO Agent failed to initialize secure storage.');
        // It might be better to return here if TokenManager is critical
        // return;
    }

    context.subscriptions.push(
        vscode.authentication.registerAuthenticationProvider(
            AUTH_PROVIDER_ID,
            AUTH_PROVIDER_LABEL,
            authProvider,
            { supportsMultipleAccounts: false }
        )
    );
    context.subscriptions.push(authProvider); // Register for disposal
    console.log('AISEOAuthProvider registered.');
    // --- End Auth Provider Setup ---

    // --- Register Sidebar View Provider ---
    // Store the created instance in the exported variable
    seoPanelProvider = new SeoPanelViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SeoPanelViewProvider.viewType, seoPanelProvider)
    );
    console.log('SeoPanelViewProvider registered.');
    // --- End Sidebar View Provider Registration ---

    // --- Register Commands ---
    registerLoginCommand(context);
    registerLogoutCommand(context);
    registerAnalyzeCommand(context); // Register the analyze command
    console.log('Commands registered.');
    // --- End Command Registration ---

    console.log('Congratulations, your extension "ai-seo-agent-vscode" is now active! 🎉');
}
// --- End activate function ---

// --- Ensure deactivate function is defined ONLY ONCE ---
export function deactivate() {
    console.log('Deactivating AI SEO Agent extension.');
    seoPanelProvider = undefined; // Clean up reference on deactivation
}
// --- End deactivate function ---

