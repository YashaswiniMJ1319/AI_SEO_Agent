import * as vscode from 'vscode';
// Import the SEO service (which now targets the Python brain)
import { seoService } from '../api/seoService';
import { AUTH_PROVIDER_ID } from '../auth/AuthProvider'; // Import the Auth Provider ID

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
                return; // Stop if not logged in
            }
            console.log(`User logged in as ${session.account.label}. Token: ${session.accessToken.substring(0, 10)}...`);

            // 2. Get Active Editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active text editor found.');
                return;
            }

            // 3. Get Document Content & Type
            const document = editor.document;
            const content = document.getText();
            const contentType = getContentTypeFromLanguageId(document.languageId);

            console.log(`Language ID: ${document.languageId}, Mapped ContentType: ${contentType}`);

            if (!content.trim()) {
                vscode.window.showInformationMessage('The file is empty. Cannot analyze.');
                return;
            }

            // --- Configuration (Placeholders & Fixed Spread) ---
            // TODO: Get projectId from a selection in the sidebar or extension state
            const projectId: string | undefined = undefined; // Example: 'project-123'
            // TODO: Get targetKeyword perhaps from an input box or sidebar setting
            const targetKeyword: string | undefined = undefined; // Example: 'AI SEO tools'

            // Correctly build the config object, handling undefined targetKeyword
            const analysisConfig: { targetKeyword?: string } = {};
            if (targetKeyword) {
                analysisConfig.targetKeyword = targetKeyword;
            }
            // Add any other config options the Python brain expects here
            // analysisConfig.someOtherOption = 'value';
            // ----------------------------------------------------

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

                    // 5. Display Basic Results (Temporary)
                    const suggestionsCount = result.suggestions?.length || 0;
                    const issuesCount = result.issues?.length || 0;
                    vscode.window.showInformationMessage(
                        `Analysis Complete! Score: ${result.seoScore}, Issues: ${issuesCount}, AI Suggestions: ${suggestionsCount}`
                    );

                    // --- Next Steps: Display results properly ---
                    // TODO: Pass 'result' to a function that updates a Sidebar Webview.
                    // TODO: Pass 'result.issues' and 'result.suggestions' to a function
                    //       that creates vscode.Diagnostic items to show inline in the editor.
                    // --- ------------------------------------ ---

                } catch (error: any) {
                    console.error('Analysis API Call Failed:', error);
                     if (error.message !== "Authentication failed (AI Brain).") {
                         vscode.window.showErrorMessage(`Analysis Failed: ${error.message || 'Could not connect to the analysis server.'}`);
                     }
                }
            });

        } catch (error: any) {
            console.error("Error during analyze command execution:", error);
             if (error.message !== "Authentication failed (AI Brain).") {
                 vscode.window.showErrorMessage(`An unexpected error occurred during analysis: ${error.message}`);
             }
        }
    });

    context.subscriptions.push(analyzeCommand);
}

