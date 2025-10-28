import * as vscode from 'vscode';
// Import the SEO service (which now targets the Python brain)
import { seoService } from '../api/seoService';
import { AUTH_PROVIDER_ID } from '../auth/AuthProvider'; // Import the Auth Provider ID
import { seoPanelProvider } from '../extension'; // Import the provider instance

/**
 * Maps VS Code language identifiers to content types expected by the AI brain.
 * Add more mappings as needed.
 */
function getContentTypeFromLanguageId(languageId: string): string {
    switch (languageId.toLowerCase()) {
        case 'html':
            return 'html';
        case 'markdown':
            return 'markdown';
        // Add mappings for react, vue, etc. if the brain supports them
        // case 'javascriptreact':
        // case 'typescriptreact':
        //     return 'jsx'; // Example
        default:
            // Fallback for unrecognized types, or default to html/text
            console.warn(`Unsupported languageId: ${languageId}. Defaulting contentType to 'html'.`);
            return 'html'; // Or perhaps 'text' depending on brain capabilities
    }
}

/**
 * Registers the 'ai-seo-agent-vscode.analyzeFile' command.
 */
export function registerAnalyzeCommand(context: vscode.ExtensionContext) {
    const analyzeCommand = vscode.commands.registerCommand('ai-seo-agent-vscode.analyzeFile', async () => {
        try {
            // 1. Check Login Status
            console.log('Analyze command triggered. Checking session...');
            const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: false });
            if (!session) {
                console.log('Analysis cancelled: User not logged in.');
                vscode.window.showWarningMessage('Please log in to AI SEO Agent first.', 'Login').then(selection => {
                    if (selection === 'Login') {
                        vscode.commands.executeCommand('ai-seo-agent-vscode.login');
                    }
                });
                 // --- Inform Sidebar ---
                 if (seoPanelProvider && seoPanelProvider['_view']) { // Check if provider and view exist
                    seoPanelProvider['_view'].webview.postMessage({ type: 'showLoginRequired' });
                 }
                 // --------------------
                return; // Stop if not logged in
            }
            console.log(`User logged in as ${session.account.label}. Token: ${session.accessToken.substring(0, 10)}...`);

            // 2. Get Active Editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                 vscode.window.showInformationMessage('No active text editor found.');
                 // --- Inform Sidebar ---
                 if (seoPanelProvider && seoPanelProvider['_view']) {
                     seoPanelProvider['_view'].webview.postMessage({ type: 'analysisError', message: 'No active text editor found.' });
                 }
                 // --------------------
                return;
            }

            // 3. Get Document Content & Type
            const document = editor.document;
            const content = document.getText();
            const contentType = getContentTypeFromLanguageId(document.languageId);

            console.log(`Language ID: ${document.languageId}, Mapped ContentType: ${contentType}`);

            if (!content.trim()) {
                vscode.window.showInformationMessage('The file is empty. Cannot analyze.');
                 // --- Inform Sidebar ---
                 if (seoPanelProvider && seoPanelProvider['_view']) {
                     seoPanelProvider['_view'].webview.postMessage({ type: 'analysisError', message: 'The file is empty.' });
                 }
                 // --------------------
                return;
            }

            // --- Configuration (Placeholders & Fixed Spread) ---
            const projectId: string | undefined = undefined;
            const targetKeyword: string | undefined = undefined; // Example: 'AI SEO tools'

            const analysisConfig: { targetKeyword?: string } = {};
            if (targetKeyword) {
                analysisConfig.targetKeyword = targetKeyword;
            }
            // ----------------------------------------------------

             // --- Inform Sidebar Analysis Started ---
             if (seoPanelProvider && seoPanelProvider['_view']) {
                 seoPanelProvider['_view'].webview.postMessage({ type: 'analysisStarted' });
             }
             // ------------------------------------

            // 4. Show Progress & Call API (Python Brain)
            console.log(`Analyzing content of ${document.fileName} (${content.length} chars)`);
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing content with AI SEO Agent...",
                cancellable: false
            }, async (progress) => {
                try {
                    // Call the seoService targeting the Python brain
                    const result = await seoService.analyzeContent(content, contentType, analysisConfig);

                    console.log('Analysis Result Received:', result);

                    // --- 5. Send results to Sidebar Webview ---
                    if (seoPanelProvider && seoPanelProvider['_view']) { // Check if provider and view exist
                         seoPanelProvider['_view'].webview.postMessage({ type: 'analysisComplete', data: result });
                         console.log('Analysis results sent to sidebar webview.');
                     } else {
                         console.warn('Sidebar panel provider or view not available to send results.');
                         // Fallback: Show basic info message if sidebar isn't ready/visible
                         const suggestionsCount = result.suggestions?.length || 0;
                         const issuesCount = result.issues?.length || 0;
                         vscode.window.showInformationMessage(
                             `Analysis Complete! Score: ${result.seoScore}, Issues: ${issuesCount}, AI Suggestions: ${suggestionsCount} (Sidebar not ready)`
                         );
                     }
                    // --- ------------------------------------ ---

                     // Remove the old temporary message display
                    // const suggestionsCount = result.suggestions?.length || 0;
                    // const issuesCount = result.issues?.length || 0;
                    // vscode.window.showInformationMessage(
                    // 	`Analysis Complete! Score: ${result.seoScore}, Issues: ${issuesCount}, AI Suggestions: ${suggestionsCount}`
                    // );

                    // TODO: Diagnostics part (can remain)
                    // Pass 'result.issues' and 'result.suggestions' to a function
                    //       that creates vscode.Diagnostic items to show inline in the editor.
                    // --- ------------------------------------ ---

                } catch (error: any) {
                    console.error('Analysis API Call Failed:', error);
                     // --- Inform Sidebar of Error ---
                     if (seoPanelProvider && seoPanelProvider['_view']) {
                         seoPanelProvider['_view'].webview.postMessage({ type: 'analysisError', message: error.message || 'Unknown analysis error' });
                     }
                     // -----------------------------
                     if (error.message !== "Authentication failed (AI Brain).") {
                         vscode.window.showErrorMessage(`Analysis Failed: ${error.message || 'Could not connect to the analysis server.'}`);
                     }
                }
            });

        } catch (error: any) {
            console.error("Error during analyze command execution:", error);
             // --- Inform Sidebar of Error ---
             if (seoPanelProvider && seoPanelProvider['_view']) {
                 seoPanelProvider['_view'].webview.postMessage({ type: 'analysisError', message: error.message || 'Unknown analysis error' });
             }
             // -----------------------------
             if (error.message !== "Authentication failed (AI Brain).") {
                 vscode.window.showErrorMessage(`An unexpected error occurred during analysis: ${error.message}`);
             }
        }
    });

    context.subscriptions.push(analyzeCommand);
}
