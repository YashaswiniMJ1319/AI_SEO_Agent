import * as vscode from 'vscode';
import { TokenManager } from './tokenManager';

// --- Configuration ---
export const AUTH_PROVIDER_ID = 'ai-seo-agent-auth';
export const AUTH_PROVIDER_LABEL = 'AI SEO Agent';
// Ensure this matches your package.json 'publisher.name'
export const EXTENSION_ID = 'yashaswinimj1319.ai-seo-agent-vscode';
const AUTH_CALLBACK_PATH = 'auth-callback';
// ------------------------

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
// --- START OF SINGLE CLASS DEFINITION ---
export class AISEOAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
    private _callbackPromises = new Map<string, { resolve: (token: string) => void; reject: (reason?: any) => void }>();
    // Store the dynamically imported module instance
    private _uuidModule: UuidModule | undefined;
    private _uuidPromise: Promise<UuidModule> | undefined; // To handle concurrent loads

    constructor(private context: vscode.ExtensionContext) {
        // URI Handler registration is moved to extension.ts
        this._initializeUuid();
        console.log("AISEOAuthProvider constructed."); // Log construction
    }

    // Helper to load uuid safely
    private _initializeUuid(): Promise<UuidModule> {
        if (!this._uuidPromise) {
            this._uuidPromise = import('uuid').then(module => {
                // Ensure the imported module has the expected structure
                const uuidModule = module as unknown as UuidModule;
                if (typeof uuidModule?.v4 === 'function') {
                    this._uuidModule = uuidModule;
                    console.log('UUID module loaded successfully.');
                    return this._uuidModule;
                } else {
                    // Handle cases where default import might be needed or structure differs
                    const maybeDefault = module as any;
                    if (maybeDefault.default && typeof maybeDefault.default.v4 === 'function') {
                        console.warn("UUID loaded via default import.");
                        this._uuidModule = maybeDefault.default as UuidModule;
                        return this._uuidModule;
                    }
                    throw new Error("Imported 'uuid' module does not contain a 'v4' function.");
                }
            }).catch(error => {
                console.error("Failed to load UUID module:", error);
                vscode.window.showErrorMessage("AI SEO Agent failed to load a required library (UUID). Authentication may fail.");
                this._uuidPromise = undefined; // Allow retry
                throw error; // Re-throw to propagate the error
            });
        }
        return this._uuidPromise;
    }


    // Helper to get the loaded uuid module
    private async _getUuid(): Promise<UuidModule> {
        if (this._uuidModule) {
            return this._uuidModule;
        }
        // If loading is in progress, await it; otherwise, start loading.
        return await (this._uuidPromise || this._initializeUuid());
    }


    // --- vscode.AuthenticationProvider Implementation ---

    public get onDidChangeSessions(): vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> {
        return sessionChangeEmitter.event;
    }

    public async getSessions(
        scopes?: readonly string[],
        options?: vscode.AuthenticationProviderSessionOptions
    ): Promise<vscode.AuthenticationSession[]> { // Removed readonly
        console.log('AuthProvider: getSessions called.');
        const token = await TokenManager.instance.getToken();
        if (token) {
            const session = this.createSessionHelper(token, "Logged In User");
            return [session]; // Return mutable array
        }
        return []; // Return mutable array
    }

    public async createSession(
        scopes?: readonly string[],
        options?: vscode.AuthenticationProviderSessionOptions
    ): Promise<vscode.AuthenticationSession> {
        console.log('AuthProvider: createSession called.');
        let uuid;
        try {
            uuid = await this._getUuid();
        } catch (error) {
             throw new Error("UUID library failed to load, cannot proceed with login.");
        }

        try {
            const nonce = uuid.v4();
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
                    });
                }
            );

            if (!token) {
                 throw new Error('Login failed: No token received from callback.');
            }

            await TokenManager.instance.setToken(token);
            const session = this.createSessionHelper(token, "Logged In User (New)");

            sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
            vscode.window.showInformationMessage('Successfully logged in via browser!');
            return session;

        } catch (err: any) {
            console.error('Error during createSession:', err);
            if (err.message !== 'Login cancelled by user.') {
                vscode.window.showErrorMessage(`Login failed: ${err.message || 'An unexpected error occurred.'}`);
            }
            await TokenManager.instance.deleteToken();
            const existingSessions = await this.getSessions();
            if (existingSessions.length > 0) {
                sessionChangeEmitter.fire({ added: [], removed: existingSessions, changed: [] });
            }
            throw err;
        }
    }

    public async removeSession(sessionId: string): Promise<void> {
        console.log(`AuthProvider: removeSession called for ID: ${sessionId}`);
        const currentToken = await TokenManager.instance.getToken();

        if (!sessionId || currentToken === sessionId) {
            const existingSessions = await this.getSessions();
            if (existingSessions.length > 0) {
                 await TokenManager.instance.deleteToken();
                 sessionChangeEmitter.fire({ added: [], removed: existingSessions, changed: [] });
                 vscode.window.showInformationMessage('Successfully logged out.');
            } else {
                 console.log('No active session found to log out.');
                 await TokenManager.instance.deleteToken();
            }
        } else {
            console.warn('Attempted to remove a session ID that does not match the stored token.');
        }
    }

    // --- RESTORED handleUri with path fix ---
    public async handleUri(uri: vscode.Uri): Promise<void> {
        console.log(`AuthProvider: handleUri ENTERED with: ${uri.toString(true)}`);

        // Extract the pathname *without* the query string
        const pathName = uri.path.split('?')[0];

        // Compare only the pathname
        if (pathName !== `/${AUTH_CALLBACK_PATH}`) {
             console.warn(`handleUri received unexpected path: ${pathName} (full path: ${uri.path})`);
             return; // Ignore URIs not matching the expected callback path
        }

        // Authority check (optional but good practice)
        if (uri.authority !== EXTENSION_ID) {
            console.warn(`handleUri received unexpected authority: ${uri.authority}, expected ${EXTENSION_ID}`);
            // return; // Decide if you want to be strict here
        }

        try {
            // Parse the query parameters from the URI
            const query = new URLSearchParams(uri.query);
            const token = query.get('token');
            const error = query.get('error');
            const nonce = query.get('nonce'); // Retrieve the state parameter

            console.log(`handleUri: Parsed Query - Token: ${token ? 'Present' : 'Missing'}, Error: ${error || 'None'}, Nonce: ${nonce || 'Missing'}`);

            // Nonce is crucial
            if (!nonce) {
                console.error('Callback URI missing nonce parameter.');
                this.resolveOrRejectPending('unknown_nonce', undefined, new Error('Authentication response missing state (nonce) parameter.'));
                vscode.window.showErrorMessage('Authentication failed: Invalid response from server (missing state).');
                return;
            }

            const promiseCallbacks = this._callbackPromises.get(nonce);

            if (!promiseCallbacks) {
                console.warn(`No pending login found for nonce: ${nonce}. Might have timed out, been cancelled, or already resolved.`);
                if(error) {
                    vscode.window.showErrorMessage(`Authentication Error: ${error}`);
                }
                return; // No matching pending request
            }

            // Handle success (token received)
            if (token) {
                console.log(`Callback URI contains token for nonce: ${nonce}. Resolving promise.`);
                promiseCallbacks.resolve(token); // Resolve the promise in createSession
            }
            // Handle error from the server
            else {
                const errorMessage = error || 'Unknown error during authentication.';
                console.error(`Callback URI contains error for nonce ${nonce}: ${errorMessage}. Rejecting promise.`);
                promiseCallbacks.reject(new Error(errorMessage)); // Reject the promise
            }

            // Clean up the promise map for this nonce
            this._callbackPromises.delete(nonce);

        } catch (err: any) {
            console.error('Error processing callback URI:', err);
            // Reject ALL pending promises if URI parsing fails
            const genericError = new Error(`Failed to process authentication response: ${err.message}`);
             this._callbackPromises.forEach((callbacks) => {
                callbacks.reject(genericError);
             });
             this._callbackPromises.clear();
             vscode.window.showErrorMessage(genericError.message);
        }
    }
    // --- END RESTORED handleUri ---

    // Helper to resolve or reject the correct pending promise based on nonce
    private resolveOrRejectPending(nonce: string, token: string | undefined, error: Error | undefined): void {
        const promiseCallbacks = this._callbackPromises.get(nonce);
        if (promiseCallbacks) {
            if (token) {
                promiseCallbacks.resolve(token);
            } else {
                promiseCallbacks.reject(error || new Error('Unknown authentication error.'));
            }
            this._callbackPromises.delete(nonce);
        } else {
            console.warn(`No callback promise found for nonce: ${nonce}. Might have timed out, been cancelled, or already resolved/rejected.`);
             if (error) { vscode.window.showErrorMessage(`Authentication Error: ${error.message}`);}
        }
    }


    // Helper function to create the session object structure VS Code expects
    private createSessionHelper(token: string, userLabel: string): vscode.AuthenticationSession {
        return {
            id: token,
            accessToken: token,
            account: { id: userLabel, label: userLabel },
            scopes: [],
        };
    }

    // Dispose method to clean up resources
    public dispose() {
        // URI Handler disposable is managed in extension.ts
         this._callbackPromises.forEach((callbacks, nonce) => {
             callbacks.reject(new Error('Authentication provider disposed.'));
             console.log(`Rejected pending auth for nonce ${nonce} due to disposal.`);
         });
        this._callbackPromises.clear(); // Clear the map
        console.log('AISEOAuthProvider disposed.');
    }
}
// --- END OF SINGLE CLASS DEFINITION ---