import * as vscode from 'vscode';
import { TokenManager } from './tokenManager';

// --- Configuration ---
export const AUTH_PROVIDER_ID = 'ai-seo-agent-auth';
export const AUTH_PROVIDER_LABEL = 'AI SEO Agent';
export const EXTENSION_ID = 'ai-seo-agent-vscode';
const AUTH_CALLBACK_PATH = 'auth-callback';

const getWebAppBaseUrl = (): string => {
    // TODO: Make this configurable via settings
    return 'http://localhost:5173'; // Your React web app's URL
};
// --------------------

const sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();

// Define the type structure we expect from the dynamic import
type UuidModule = {
    v4: () => string;
};

/**
 * Implements VS Code's AuthenticationProvider interface for AI SEO Agent.
 */
export class AISEOAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
    private _disposable: vscode.Disposable;
    private _callbackPromises = new Map<string, { resolve: (token: string) => void; reject: (reason?: any) => void }>();
    // Store the dynamically imported module instance
    private _uuidModule: UuidModule | undefined;
    private _uuidPromise: Promise<UuidModule> | undefined; // To handle concurrent loads

    constructor(private context: vscode.ExtensionContext) {
        this._disposable = vscode.window.registerUriHandler({
            handleUri: this.handleUri.bind(this) // Use bind here!
        });
        // Start loading uuid asynchronously
        this._initializeUuid();
    }

    // Helper to load uuid safely
    private _initializeUuid(): Promise<UuidModule> {
        if (!this._uuidPromise) {
            this._uuidPromise = import('uuid').then(module => {
                if (typeof module?.v4 === 'function') {
                    this._uuidModule = module as UuidModule;
                    console.log('UUID module loaded successfully.');
                    return this._uuidModule;
                } else {
                    throw new Error("Imported 'uuid' module does not contain a 'v4' function.");
                }
            }).catch(error => {
                console.error("Failed to load UUID module:", error);
                vscode.window.showErrorMessage("AI SEO Agent failed to load a required library (UUID). Authentication may fail.");
                this._uuidPromise = undefined; // Allow retry
                throw error;
            });
        }
        return this._uuidPromise;
    }

    // Helper to get the loaded uuid module
    private async _getUuid(): Promise<UuidModule> {
        if (this._uuidModule) {
            return this._uuidModule;
        }
        // Wait for the promise if loading is in progress, or start loading if not yet started
        return await (this._uuidPromise || this._initializeUuid());
    }


    // --- vscode.AuthenticationProvider Implementation ---

    public get onDidChangeSessions(): vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> {
        return sessionChangeEmitter.event;
    }

    // getSessions Implementation (Single)
    public async getSessions(
        scopes?: readonly string[],
        options?: vscode.AuthenticationProviderSessionOptions
    ): Promise<vscode.AuthenticationSession[]> { // Return mutable array
        console.log('AuthProvider: getSessions called.');
        const token = await TokenManager.instance.getToken();
        if (token) {
            const session = this.createSessionHelper(token, "Logged In User"); // Use helper
            return [session]; // Return mutable array
        }
        return [];
    }

    // createSession Implementation (Single)
    public async createSession(
        scopes?: readonly string[],
        options?: vscode.AuthenticationProviderSessionOptions
    ): Promise<vscode.AuthenticationSession> {
        console.log('AuthProvider: createSession called.');
        let uuid;
        try {
            uuid = await this._getUuid(); // Get the loaded module instance
        } catch (error) {
             throw new Error("UUID library failed to load, cannot proceed with login.");
        }

        try {
            const nonce = uuid.v4(); // Use v4 from the loaded module

            const callbackUri = await vscode.env.asExternalUri(
                vscode.Uri.parse(`${vscode.env.uriScheme}://${EXTENSION_ID}/${AUTH_CALLBACK_PATH}`)
            );
            console.log('Callback URI:', callbackUri.toString(true));

            const loginUrl = new URL('/auth/vscode-login', getWebAppBaseUrl());
            loginUrl.searchParams.set('callback', callbackUri.toString(true));
            loginUrl.searchParams.set('nonce', nonce);
            console.log('Opening login URL:', loginUrl.toString());

            await vscode.env.openExternal(vscode.Uri.parse(loginUrl.toString()));

            const token = await vscode.window.withProgress<string>(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Waiting for AI SEO Agent login in browser...',
                    cancellable: true,
                },
                async (_progress, cancellationToken) => {
                    return new Promise<string>((resolve, reject) => {
                        this._callbackPromises.set(nonce, { resolve, reject });
                        cancellationToken.onCancellationRequested(() => {
                            this._callbackPromises.delete(nonce);
                            reject(new Error('Login cancelled by user.'));
                        });
                        // Optional: Add timeout logic here if desired
                    });
                }
            );

            if (!token) {
                 throw new Error('Login failed: No token received from callback.');
            }

            await TokenManager.instance.setToken(token);
            const session = this.createSessionHelper(token, "Logged In User (New)"); // Use helper
            sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
            vscode.window.showInformationMessage('Successfully logged in via browser!');
            return session;

        } catch (err: any) {
            console.error('Error during createSession:', err);
            vscode.window.showErrorMessage(`Login failed: ${err.message || 'An unexpected error occurred.'}`);
            await TokenManager.instance.deleteToken();
            const existingSessions = await this.getSessions(); // Re-fetch sessions after clearing token
            sessionChangeEmitter.fire({ added: [], removed: existingSessions, changed: [] });
            throw err; // Re-throw the error so getSession call also fails
        }
    }

    // removeSession Implementation (Single)
    public async removeSession(sessionId: string): Promise<void> {
        console.log(`AuthProvider: removeSession called for ID: ${sessionId}`);
        const currentToken = await TokenManager.instance.getToken();
        if (currentToken === sessionId || !sessionId) { // Allow removing even if ID doesn't perfectly match, just clear token
            const existingSessions = await this.getSessions(); // Get session info *before* deleting token
            if (existingSessions.length > 0) {
                 await TokenManager.instance.deleteToken();
                 sessionChangeEmitter.fire({ added: [], removed: existingSessions, changed: [] });
                 vscode.window.showInformationMessage('Successfully logged out.');
            } else {
                 console.log('No active session found to log out.');
                 // Optionally clear token anyway if somehow out of sync
                 await TokenManager.instance.deleteToken();
            }
        } else {
            console.warn('Attempted to remove a session ID that does not match the stored token.');
            // Optionally still clear the token if desired
            // await TokenManager.instance.deleteToken();
            // sessionChangeEmitter.fire({ added: [], removed: await this.getSessions(), changed: [] });
        }
    }

    // handleUri Implementation (Single)
    public async handleUri(uri: vscode.Uri): Promise<void> {
        console.log(`AuthProvider: handleUri called with: ${uri.toString(true)}`);
        if (uri.path !== `/${AUTH_CALLBACK_PATH}`) {
             console.warn(`handleUri received unexpected path: ${uri.path}`);
             return;
        }

        try {
            const query = new URLSearchParams(uri.query);
            const token = query.get('token');
            const error = query.get('error');
            const nonce = query.get('nonce'); // Retrieve the nonce

            if (!nonce) {
                console.error('Callback URI missing nonce.');
                this.resolveOrRejectPending('unknown_nonce', undefined, new Error('Authentication response missing state parameter.'));
                return;
            }

            if (token) {
                console.log(`Callback URI contains token for nonce: ${nonce}`);
                this.resolveOrRejectPending(nonce, token, undefined);
            } else {
                const errorMessage = error || 'Unknown error during authentication.';
                console.error(`Callback URI contains error for nonce ${nonce}: ${errorMessage}`);
                 this.resolveOrRejectPending(nonce, undefined, new Error(errorMessage));
            }
        } catch (err: any) {
            console.error('Error parsing callback URI:', err);
            // Attempt to reject any pending promise, although we don't know the nonce here
             this.rejectAnyPending(`Failed to process authentication response: ${err.message}`);
        }
    }

    // Helper to resolve/reject a specific pending promise
    private resolveOrRejectPending(nonce: string, token: string | undefined, error: Error | undefined): void {
        const promiseCallbacks = this._callbackPromises.get(nonce);
        if (promiseCallbacks) {
            if (token) {
                promiseCallbacks.resolve(token);
            } else {
                promiseCallbacks.reject(error || new Error('Unknown authentication error.'));
            }
            this._callbackPromises.delete(nonce); // Clean up
        } else {
            // This can happen if the user cancels the progress notification or if it times out
            console.warn(`No callback promise found for nonce: ${nonce}. Might have timed out, been cancelled, or already resolved/rejected.`);
             // Show error only if an error was actually passed back and we couldn't find the promise
             if (error) { vscode.window.showErrorMessage(`Authentication Error: ${error.message}`);}
        }
    }

    // Helper to reject *any* pending promise (use if nonce is unknown)
    private rejectAnyPending(errorMessage: string): void {
        const error = new Error(errorMessage);
        this._callbackPromises.forEach((callbacks) => {
            callbacks.reject(error);
        });
        this._callbackPromises.clear();
    }


    // Renamed helper function to avoid conflict with method name
    private createSessionHelper(token: string, userLabel: string): vscode.AuthenticationSession {
        // In a real scenario, decode JWT `token` here to get actual user info (ID, name) and expiration
        return {
            id: token, // Using token as session ID for simplicity
            accessToken: token,
            account: { id: userLabel, label: userLabel }, // Replace with actual user data from token
            scopes: [], // Add scopes if you use them
        };
    }

    // dispose Implementation (Single)
    public dispose() {
        this._disposable.dispose();
         this._callbackPromises.forEach((callbacks, nonce) => {
             callbacks.reject(new Error('Authentication provider disposed.'));
             console.log(`Rejected pending auth for nonce ${nonce} due to disposal.`);
         });
        this._callbackPromises.clear();
        console.log('AISEOAuthProvider disposed.');
    }
}

