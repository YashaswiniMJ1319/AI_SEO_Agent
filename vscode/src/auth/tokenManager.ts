import * as vscode from 'vscode';

// Key used to store the token in SecretStorage
const TOKEN_KEY = 'ai-seo-agent.jwtToken'; // Use a unique key for your extension

/**
 * Manages the JWT token using VS Code's secure SecretStorage.
 */
export class TokenManager {
    private static _instance: TokenManager | undefined;
    private _secretStorage: vscode.SecretStorage;

    // Make constructor private for singleton pattern
    private constructor(secretStorage: vscode.SecretStorage) {
        this._secretStorage = secretStorage;
    }

    /**
     * Initializes the TokenManager instance. MUST be called once during extension activation.
     * @param context The extension context provided by VS Code.
     */
    static initialize(context: vscode.ExtensionContext): void {
        if (!TokenManager._instance) {
            TokenManager._instance = new TokenManager(context.secrets);
        } else {
            console.warn('TokenManager already initialized.');
        }
    }

    /**
     * Gets the singleton instance of the TokenManager.
     * Throws an error if initialize() has not been called.
     * @returns The TokenManager instance.
     */
    static get instance(): TokenManager {
        if (!TokenManager._instance) {
            throw new Error('TokenManager not initialized. Call TokenManager.initialize() first.');
        }
        return TokenManager._instance;
    }

    /**
     * Retrieves the stored JWT token.
     * @returns The token string, or undefined if not found.
     */
    async getToken(): Promise<string | undefined> {
        return await this._secretStorage.get(TOKEN_KEY);
    }

    /**
     * Stores the JWT token securely.
     * @param token The JWT token string to store.
     */
    async setToken(token: string): Promise<void> {
        await this._secretStorage.store(TOKEN_KEY, token);
        console.log('Token stored successfully.'); // For debugging, remove in production
    }

    /**
     * Deletes the stored JWT token.
     */
    async deleteToken(): Promise<void> {
        await this._secretStorage.delete(TOKEN_KEY);
        console.log('Token deleted successfully.'); // For debugging, remove in production
    }
}

// Ensure initialize is called before instance is accessed elsewhere
// You will call TokenManager.initialize(context) in your extension.ts activate function.