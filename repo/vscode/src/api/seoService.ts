import apiClient from './apiClient'; // This apiClient points to Node API (port 4000)
import axios from 'axios'; // Import axios directly for the brain call
import * as vscode from 'vscode';
import { TokenManager } from '../auth/tokenManager'; // To get the token

// --- Define expected response types (based on Python service's SeoResponse) ---
interface PythonIssue {
    type: string;
    message: string;
    line?: number | null;
}

interface PythonSuggestion {
    type: string;
    message: string;
    content: string;
    context?: string | null;
}

interface PythonKeywordAnalysis {
    targetKeyword: string;
    foundInTitle: boolean;
    foundInMeta: boolean;
    foundInH1: boolean;
    bodyCount: number;
    density: number;
}

interface PythonAnalysisResult {
    seoScore: number;
    issues: PythonIssue[];
    suggestions: PythonSuggestion[];
    keywordAnalysis?: PythonKeywordAnalysis | null;
}
// --- End Python Types ---

// --- Define request payload type (based on Python service's SeoRequest) ---
interface AnalyzeRequest {
    content: string;
    contentType: 'html' | 'markdown' | string; // Adjust as needed
    config?: {
        targetKeyword?: string;
        // Add other config options the brain might expect
    };
}
// --------------------

// --- Configuration for the AI Brain service ---
const BRAIN_API_BASE_URL = 'http://localhost:8000'; // AI Brain runs on port 8000
// ---------------------------------------------


/**
 * Handles SEO-related API calls.
 */
export class SeoService {
    /**
     * Sends content to the backend AI Brain service for SEO analysis.
     * @param content The text content to analyze.
     * @param contentType The type of content ('html', 'markdown', etc.).
     * @param config Optional configuration like targetKeyword.
     * @returns A Promise resolving to the AnalysisResult data, or rejects on API error.
     */
    async analyzeContent(content: string, contentType: string = 'html', config?: AnalyzeRequest['config']): Promise<PythonAnalysisResult> {
        console.log(`Sending content to AI Brain for analysis (Config: ${JSON.stringify(config)})`);
        try {
            const payload: AnalyzeRequest = { content, contentType, config };
            const token = await TokenManager.instance.getToken();

            // IMPORTANT: Make the call directly to the Python service (port 8000)
            const response = await axios.post<PythonAnalysisResult>(
                `${BRAIN_API_BASE_URL}/analyze`, // Target the Python service endpoint
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        // --- Pass the token ---
                        // The Python service MUST be updated to validate this token
                        ...(token && { 'Authorization': `Bearer ${token}` })
                    }
                }
            );

            // Basic check if the response looks like an AnalysisResult
            if (response.data && typeof response.data.seoScore === 'number' && Array.isArray(response.data.issues)) {
                console.log('AI Brain Analysis API call successful.');
                return response.data;
            }
            // Add specific handling for 401 from Python service if needed (though interceptor won't catch it here)
            // else if (response.status === 401) { ... }
             else {
                console.error('AI Brain Analysis API response missing expected fields:', response.data);
                throw new Error('Analysis failed: Invalid response from AI Brain server.');
            }
        } catch (error: any) {
            console.error('Error during AI Brain analysis API call:', error);

            // Extract meaningful error message
            let errorMessage = 'Analysis failed. Please check your network connection or the AI Brain server.';
            // Handle Axios errors specifically if needed
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    // Specific handling for 401 from Python service
                    errorMessage = 'Authentication failed with AI Brain. Please log in again.';
                    // Trigger re-login?
                    TokenManager.instance.deleteToken();
                     vscode.window.showErrorMessage(errorMessage, 'Login').then(selection => {
                         if (selection === 'Login') {
                             vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                         }
                     });
                     // Throw specific error to stop command flow
                     throw new Error("Authentication failed (AI Brain).");

                } else if (error.response?.data?.detail) { // FastAPI often uses 'detail' for errors
                    errorMessage = `Analysis Failed (AI Brain): ${error.response.data.detail}`;
                } else if (error.message.includes('ECONNREFUSED')) {
                     errorMessage = 'Analysis Failed: Could not connect to the AI Brain service (is it running on port 8000?).';
                }
                 else {
                    errorMessage = `Analysis Failed (AI Brain): ${error.message}`;
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }


            throw new Error(errorMessage);
        }
    }

    // You might still need functions to interact with the Node API for projects/users
    // async getProjects(): Promise<any[]> {
    //    const response = await apiClient.get('/projects'); // Uses Node API client
    //    return response.data;
    // }
}

// Export an instance for easy use
export const seoService = new SeoService();

