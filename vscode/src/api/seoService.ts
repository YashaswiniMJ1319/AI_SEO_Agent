import apiClient from './apiClient'; // Import the configured axios instance
import * as vscode from 'vscode';

// --- Define expected response types (based on schema) ---
// These should match what your backend /api/analyze endpoint will return
interface KeywordDensity {
    [keyword: string]: number; // Example: { "AI": 5, "SEO": 3 }
}

interface Suggestion {
    id: string;
    analysisId: string;
    text: string;
    createdAt: string; // Assuming ISO string date
}

interface AnalysisResult {
    id: string;
    userId: string;
    projectId?: string;
    content: string; // Maybe omit sending back the full content?
    wordCount: number;
    readability: string;
    seoScore: number;
    keywordDensity: KeywordDensity | null; // Allow null if not calculated
    createdAt: string; // Assuming ISO string date
    suggestions: Suggestion[];
}

// --- Define request payload type ---
interface AnalyzeRequest {
    content: string;
    projectId?: string; // Optional for now
}


/**
 * Handles SEO-related API calls using the apiClient.
 */
export class SeoService {
    /**
     * Sends content to the backend for SEO analysis.
     * @param content The text content to analyze.
     * @param projectId The optional ID of the project context.
     * @returns A Promise resolving to the AnalysisResult data, or rejects on API error.
     */
    async analyzeContent(content: string, projectId?: string): Promise<AnalysisResult> {
        console.log(`Sending content for analysis (Project ID: ${projectId || 'None'})`);
        try {
            const payload: AnalyzeRequest = { content, projectId };
            // IMPORTANT: The backend endpoint '/analyze' needs to be created!
            const response = await apiClient.post<AnalysisResult>('/analyze', payload);

            // Basic check if the response looks like an AnalysisResult
            if (response.data && typeof response.data.seoScore === 'number' && Array.isArray(response.data.suggestions)) {
                console.log('Analysis API call successful.');
                return response.data;
            } else if ((response as any).handled && (response as any).status === 401) {
                 // The interceptor already showed an error and prompted login
                 throw new Error("Authentication failed (handled by interceptor).");
            }
             else {
                console.error('Analysis API response missing expected fields:', response.data);
                throw new Error('Analysis failed: Invalid response from server.');
            }
        } catch (error: any) {
            console.error('Error during analysis API call:', error);

            // Extract meaningful error message
            let errorMessage = 'Analysis failed. Please check your network connection or the server.';
            if (error.isAxiosError && error.response?.data?.message) {
                errorMessage = `Analysis Failed: ${error.response.data.message}`;
            } else if (error instanceof Error && error.message !== "Authentication failed (handled by interceptor).") {
                 errorMessage = error.message;
            } else if (error.message === "Authentication failed (handled by interceptor).") {
                 // Re-throw handled auth error to prevent generic message in command
                 throw error;
            }


            throw new Error(errorMessage);
        }
    }

    // TODO: Add functions to get projects, keywords etc. later for sidebar
    // async getProjects(): Promise<any[]> { ... }
}

// Export an instance for easy use
export const seoService = new SeoService();
