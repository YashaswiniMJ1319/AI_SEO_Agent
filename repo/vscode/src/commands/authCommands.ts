import * as vscode from 'vscode';
// TokenManager is now primarily used by AuthProvider, not directly here
// import { TokenManager } from '../auth/tokenManager';
// AuthService is also not directly called here anymore for login
// import { authService } from '../api/authService';
// Import the Auth Provider ID
import { AUTH_PROVIDER_ID } from '../auth/AuthProvider';

/**
 * Registers the 'ai-seo-agent-vscode.login' command.
 * This now triggers the VS Code Authentication flow defined by AISEOAuthProvider.
 */
export function registerLoginCommand(context: vscode.ExtensionContext) {
    const loginCommand = vscode.commands.registerCommand('ai-seo-agent-vscode.login', async () => {
        try {
            console.log('Login command triggered. Requesting session via vscode.authentication.getSession...');

            // Trigger the AuthenticationProvider's createSession flow by calling getSession
            // - AUTH_PROVIDER_ID: Identifies which provider to use.
            // - []: Array of scopes (leave empty if not using scopes).
            // - { createIfNone: true }: This crucial option tells VS Code to call
            //   your AuthProvider's createSession method if no valid session exists.
            const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: true });

            if (session) {
                console.log('getSession successfully returned a session after login flow.');
                // A success message is typically shown inside AuthProvider after the callback completes.
                // You could add another one here if desired, but might be redundant.
                // vscode.window.showInformationMessage(`Successfully logged in as ${session.account.label}!`);
            } else {
                 console.warn('getSession call completed after login flow but returned no session.');
                 // Error/Cancellation message should have been shown within AuthProvider.
            }
        } catch (error: any) {
            // Errors during the flow (e.g., user cancellation in browser/progress, callback error) are caught here
            console.error("Error executing login command (getSession failed):", error);
            // Error messages are typically shown within the AuthProvider's createSession catch block.
            // Avoid showing a generic error here unless the provider fails to show one.
            // vscode.window.showErrorMessage(`Login failed: ${error.message || 'An unexpected error occurred.'}`);
        }
    });

    context.subscriptions.push(loginCommand);
}

/**
 * Registers the 'ai-seo-agent-vscode.logout' command.
 * This now triggers the AuthenticationProvider's removeSession logic.
 */
export function registerLogoutCommand(context: vscode.ExtensionContext) {
    const logoutCommand = vscode.commands.registerCommand('ai-seo-agent-vscode.logout', async () => {
        try {
            console.log('Logout command triggered. Checking for current session...');
            // Get the current session *without* triggering login if none exists
            const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: false });

            if (session) {
                console.log(`Found session ID: ${session.id}. Calling removeSession...`);
                // Trigger the AuthenticationProvider's removeSession flow via the API
                // Note: VS Code's API uses removeSession(providerId, sessionId) internally now.
                // However, the standard way is often just to have AuthProvider.removeSession clear the token.
                // Let's rely on our AuthProvider implementation that clears the token.
                // You might need to adjust AuthProvider.removeSession if VS Code's internal
                // handling of this requires passing the session ID specifically.
                // For now, let's assume our provider handles it based on the stored token.
                await TokenManager.instance.deleteToken(); // Directly clear token via TokenManager
                sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] }); // Manually fire event if needed
                vscode.window.showInformationMessage('Successfully logged out.');


                // --- Alternative using VS Code's explicit (but less common) removal ---
                // await vscode.authentication.removeSession(AUTH_PROVIDER_ID, session.id);
                // The success message would typically be inside AuthProvider.removeSession in this case.
                // --- End Alternative ---

            } else {
                 console.log('No active session found to log out.');
                 vscode.window.showInformationMessage('You are not currently logged in.');
            }
        } catch (error: any) {
            console.error("Error executing logout command:", error);
            vscode.window.showErrorMessage(`Logout failed: ${error.message || 'An unexpected error occurred.'}`);
        }
    });

    context.subscriptions.push(logoutCommand);
}

// --- Helper Needed ---
// We need access to the sessionChangeEmitter from AuthProvider or a way to trigger session removal notification
// Let's add it back temporarily here. Better approach would be a shared service/event bus.
import { EventEmitter } from 'vscode';
import type { AuthenticationProviderAuthenticationSessionsChangeEvent, AuthenticationSession } from 'vscode';
const sessionChangeEmitter = new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
// You might need to export/import this properly from AuthProvider or a central place later.
import { TokenManager } from '../auth/tokenManager';
// --- End Helper ---