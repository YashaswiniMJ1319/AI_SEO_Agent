import apiClient from './apiClient'; // Import the configured axios instance
import * as vscode from 'vscode'; // Needed only if you add specific VS Code interactions here

// Define expected request/response types (optional but good practice)
interface LoginRequest {
    email: string;
    password?: string;
}

interface LoginResponse {
    token: string;
    message: string;
    user: {
        id: string;
        email: string;
        phone: string | null;
        fullName: string | null;
    };
}

/**
 * Handles Authentication API calls using the apiClient.
 */
export class AuthService {
    /**
     * Logs in a user via the backend API.
     * @param email User's email
     * @param password User's password
     * @returns A Promise resolving to the login response data (including token), or rejects on API error.
     */
    async login(email: string, password?: string): Promise<LoginResponse> {
        console.log(`Sending login request for email: ${email}`);
        try {
            const response = await apiClient.post<LoginResponse>('/auth/login', {
                email,
                password,
            } as LoginRequest);

            // Handle cases where the interceptor might have already handled an error (like 401)
            // Note: This specific check might vary based on how you structure interceptor responses
            if ((response as any).handled && (response as any).status === 401) {
                // The interceptor already showed an error and prompted login
                // We should prevent further processing in the command's .then() block
                // Throwing a specific error or returning a unique value can signal this
                throw new Error("Authentication failed (handled by interceptor).");
            }

            // Check if data exists and contains a token
            if (response.data && response.data.token) {
                console.log('Login API call successful.');
                return response.data;
            } else {
                console.error('Login API response missing token:', response.data);
                throw new Error('Login failed: Invalid response from server.');
            }
        } catch (error: any) {
            console.error('Error during login API call:', error);

            // Extract meaningful error message from AxiosError if available
            let errorMessage = 'Login failed. Please check your credentials or network connection.';
            if (error.isAxiosError && error.response?.data?.message) {
                errorMessage = `Login Failed: ${error.response.data.message}`;
            } else if (error instanceof Error) {
                // Avoid re-throwing the interceptor's specific message if already handled
                if (error.message !== "Authentication failed (handled by interceptor).") {
                    errorMessage = error.message;
                } else {
                    // If it's the handled error, re-throw to stop the command flow cleanly
                    throw error;
                }
            }

            // Throw a new error with a user-friendly message for the command's catch block
            throw new Error(errorMessage);
        }
    }

    // Add register or other auth-related API calls here later if needed
}

// Export an instance for easy use
export const authService = new AuthService();