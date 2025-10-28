// This script runs in the context of the webview
(function () {
    const vscode = acquireVsCodeApi(); // Get API to communicate with extension

    // --- Get DOM Elements ---
    const analyzeButton = document.getElementById('analyze-button');
    const resultsArea = document.getElementById('results-area');
    const statusMessage = document.getElementById('status-message');
    const scoreDiv = document.getElementById('score');
    const issuesList = document.getElementById('issues-list');
    const suggestionsList = document.getElementById('suggestions-list');
    const keywordDiv = document.getElementById('keyword-analysis');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfo = document.getElementById('user-info');

    // --- Event Listeners ---
    analyzeButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'analyzeCurrentFile' });
    });

     loginButton.addEventListener('click', () => {
         vscode.postMessage({ type: 'loginRequest' });
     });

     logoutButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'logoutRequest' });
      });


    // Listen for messages FROM the extension
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data sent from extension

        switch (message.type) {
            case 'analysisStarted':
                statusMessage.textContent = 'Analyzing...';
                clearResults();
                analyzeButton.disabled = true;
                break;
            case 'analysisComplete':
                analyzeButton.disabled = false;
                statusMessage.textContent = 'Analysis Complete!';
                displayResults(message.data);
                break;
            case 'analysisError':
                analyzeButton.disabled = false;
                statusMessage.textContent = `Error: ${message.message}`;
                clearResults();
                break;
             case 'loginStateUpdate':
                 updateAuthUI(message.isLoggedIn, message.userLabel);
                 break;
             case 'showLoginRequired':
                  statusMessage.textContent = 'Please log in to analyze.';
                  clearResults();
                  updateAuthUI(false); // Ensure UI reflects logged-out state
                  break;

        }
    });

    // --- UI Update Functions ---
    function clearResults() {
        scoreDiv.textContent = '';
        issuesList.innerHTML = '';
        suggestionsList.innerHTML = '';
        keywordDiv.innerHTML = '';
         // Don't clear statusMessage here, it might show an error
    }

    function displayResults(data) {
         if (!data) {
             statusMessage.textContent = 'Received empty results.';
             return;
         }
         scoreDiv.textContent = `SEO Score: ${data.seoScore || 'N/A'}`;

        issuesList.innerHTML = ''; // Clear previous
        if (data.issues && data.issues.length > 0) {
            data.issues.forEach(issue => {
                const li = document.createElement('li');
                li.textContent = `[${issue.type}] ${issue.message}`;
                issuesList.appendChild(li);
            });
        } else {
            issuesList.innerHTML = '<li>No issues found.</li>';
        }

        suggestionsList.innerHTML = ''; // Clear previous
         if (data.suggestions && data.suggestions.length > 0) {
             data.suggestions.forEach(suggestion => {
                 const li = document.createElement('li');
                 li.innerHTML = `[${suggestion.type}] ${suggestion.message}<br/><em>${suggestion.content}</em>`;
                 if (suggestion.context) {
                     li.innerHTML += `<br/><small>Context: ${suggestion.context}</small>`;
                 }
                 suggestionsList.appendChild(li);
             });
         } else {
             suggestionsList.innerHTML = '<li>No AI suggestions generated.</li>';
         }

         keywordDiv.innerHTML = ''; // Clear previous
         if (data.keywordAnalysis) {
             const ka = data.keywordAnalysis;
             keywordDiv.innerHTML = `
                 <h4>Keyword Analysis: "${ka.targetKeyword}"</h4>
                 <ul>
                     <li>Found in Title: ${ka.foundInTitle}</li>
                     <li>Found in Meta Desc: ${ka.foundInMeta}</li>
                     <li>Found in H1: ${ka.foundInH1}</li>
                     <li>Body Count: ${ka.bodyCount}</li>
                     <li>Density: ${ka.density}%</li>
                 </ul>
             `;
         }
    }

    function updateAuthUI(isLoggedIn, userLabel = '') {
        if (isLoggedIn) {
            userInfo.textContent = `Logged in as: ${userLabel}`;
            loginButton.style.display = 'none';
            logoutButton.style.display = 'inline-block';
            analyzeButton.disabled = false; // Enable analysis button
        } else {
            userInfo.textContent = 'Not logged in.';
            loginButton.style.display = 'inline-block';
            logoutButton.style.display = 'none';
            analyzeButton.disabled = true; // Disable analysis button
             // Optionally clear results when logging out
             // statusMessage.textContent = 'Please log in.';
             // clearResults();
        }
    }

     // Request initial state when the webview loads
     vscode.postMessage({ type: 'getInitialState' });


}());