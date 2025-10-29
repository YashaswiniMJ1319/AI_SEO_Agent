import axios, { AxiosError } from 'axios';
import { TokenManager } from '../auth/tokenManager'; // Adjust path if needed
import * as vscode from 'vscode';

// --- Configuration ---
// Get the backend URL from VS Code settings or use a default.
// You'll need to define this setting in your package.json later.
const getApiBaseUrl = (): string => {
    // const config = vscode.workspace.getConfiguration('aiSeoAgent');
    // return config.get<string>('backendUrl') || 'http://localhost:4000/api'; // Default
    // For now, hardcode it during development:
    return 'http://localhost:4000/api'; // Make sure your backend is running here
};
// --------------------

const apiClient = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptor to Add Auth Token ---
// This runs before each request is sent.
apiClient.interceptors.request.use(
    async (config) => {
        // Retrieve the token just before sending the request
        config.baseURL = getApiBaseUrl(); // Ensure base URL is up-to-date if settings change
        const token = await TokenManager.instance.getToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Token attached to request.'); // Debugging
        } else {
            console.log('No token found or headers missing.'); // Debugging
        }
        return config;
    },
    (error) => {
        console.error('Error attaching token:', error); // Debugging
        return Promise.reject(error);
    }
);

// --- Interceptor to Handle Response Errors (Optional but Recommended) ---
// This runs when a response is received.
apiClient.interceptors.response.use(
    (response) => response, // Directly return successful responses
    (error: AxiosError) => {
        // Handle common errors like 401 Unauthorized (e.g., token expired)
        if (error.response?.status === 401) {
            console.error('Unauthorized (401) response:', error.response.data);
            // Token might be invalid or expired. Clear it and notify user.
            TokenManager.instance.deleteToken(); // Use await if needed, but often okay async
            vscode.window.showErrorMessage('Authentication error. Please log in again.', 'Login').then(selection => {
                if (selection === 'Login') {
                    vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                }
            });
            // Don't reject here, as we've handled it by asking user to log in
            // Return a specific structure or null to indicate handled auth error
            return Promise.resolve({ data: null, status: 401, handled: true }); // Indicate handled error
        }

        // Handle other errors (network issues, server errors, etc.)
        console.error('API Response Error:', error.response?.data || error.message);

        // Reject the promise so the calling code's .catch() block runs
        return Promise.reject(error);
    }
);


export default apiClient;