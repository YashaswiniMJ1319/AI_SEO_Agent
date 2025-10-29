document.addEventListener('DOMContentLoaded', function () {
    const analyzeButton = document.getElementById('ai-seo-analyze-button');
    const resultsDiv = document.getElementById('ai-seo-results');
    const statusP = document.getElementById('ai-seo-status');
    const scoreDiv = document.getElementById('ai-seo-score');
    const issuesContainer = document.getElementById('ai-seo-issues-container');
    const issuesUl = document.getElementById('ai-seo-issues');
    const suggestionsContainer = document.getElementById('ai-seo-suggestions-container');
    const suggestionsUl = document.getElementById('ai-seo-suggestions');
    const keywordsContainer = document.getElementById('ai-seo-keywords');
    const keywordsDetailsDiv = document.getElementById('ai-seo-keyword-details');
    const keywordInput = document.getElementById('ai-seo-target-keyword'); // Get keyword input

    // --- Helper function to create Apply Button ---
    function createApplyButton(suggestionText, type, context = null) {
        const button = document.createElement('button');
        button.textContent = 'Apply';
        button.type = 'button'; // Prevent form submission
        button.className = 'button button-small ai-seo-apply-button'; // Add specific class
        button.style.marginLeft = '10px';
        button.style.verticalAlign = 'middle';

        // Add data attributes to store suggestion details
        button.dataset.suggestionText = suggestionText;
        button.dataset.suggestionType = type;
        if (context) {
             button.dataset.suggestionContext = context;
        }

        button.addEventListener('click', handleApplySuggestion);
        return button;
    }

    // --- Function to handle Apply Button Clicks (Placeholder for now) ---
    function handleApplySuggestion(event) {
        const button = event.target;
        const textToApply = button.dataset.suggestionText;
        const type = button.dataset.suggestionType;
        const context = button.dataset.suggestionContext; // e.g., image src for alt text

        console.log("Apply clicked!", { type, textToApply, context });
        statusP.textContent = 'Apply functionality not yet implemented.'; // Placeholder message

        // --- TODO: Implement actual logic based on type ---
        // Example for Meta Description (requires knowing how Yoast/RankMath/etc store it, or using WP core functions if possible)
        // if (type === 'ai_meta') {
        //   try {
        //      // Example using wp.data for Block Editor meta fields (might need specific meta key)
        //      // The exact meta key depends on the SEO plugin being used (e.g., '_yoast_wpseo_metadesc')
        //      const metaKey = '_yoast_wpseo_metadesc'; // Example, find the correct one!
        //      wp.data.dispatch('core/editor').editPost({ meta: { [metaKey]: textToApply } });
        //      statusP.textContent = 'Meta description applied (check SEO plugin field).';
        //   } catch(e) {
        //      console.error("Error applying meta:", e);
        //      statusP.textContent = 'Error applying suggestion.';
        //   }
        // }

        // Example for Alt Text (requires finding the image in content and updating its alt attribute)
        // if (type === 'ai_alt_text' && context) {
        //   try {
        //     const currentContent = wp.data.select('core/editor').getEditedPostContent();
        //     // Warning: Simple replace might be fragile. Need robust HTML parsing/manipulation
        //     const imgTagRegex = new RegExp(`<img[^>]*src=["']${context}["'][^>]*>`, 'i');
        //     const match = currentContent.match(imgTagRegex);
        //     if (match) {
        //       let imgTag = match[0];
        //       if (imgTag.includes('alt=')) {
        //           imgTag = imgTag.replace(/alt=(["']).*?\1/, `alt="${textToApply}"`);
        //       } else {
        //           imgTag = imgTag.replace(/<img/i, `<img alt="${textToApply}"`);
        //       }
        //       const newContent = currentContent.replace(imgTagRegex, imgTag);
        //       wp.data.dispatch('core/editor').resetEditorBlocks(wp.blocks.parse(newContent));
        //       statusP.textContent = 'Alt text applied (check image block/HTML).';
        //     } else {
        //       statusP.textContent = 'Could not find image tag to apply alt text.';
        //     }
        //   } catch(e) {
        //      console.error("Error applying alt text:", e);
        //      statusP.textContent = 'Error applying suggestion.';
        //   }
        // }
    }


    if (!analyzeButton) {
        console.error('AI SEO Analyze button not found!');
        return;
    }

    analyzeButton.addEventListener('click', function () {
        let postContent = '';
        let postTitle = '';
        const targetKeyword = keywordInput ? keywordInput.value.trim() : ''; // Get keyword

        try {
            if (wp && wp.data && wp.data.select('core/editor')) {
                postContent = wp.data.select('core/editor').getEditedPostContent();
                postTitle = wp.data.select('core/editor').getEditedPostAttribute('title');
                console.log('Using Block Editor data');
            } else if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
                postContent = tinymce.get('content').getContent();
                postTitle = document.getElementById('title') ? document.getElementById('title').value : '';
                console.log('Using Classic Editor data');
            } else {
                 console.error('Could not get editor content.');
                 statusP.textContent = 'Error: Could not access editor content.';
                 return;
            }
        } catch (e) {
             console.error('Error getting editor content:', e);
             statusP.textContent = 'Error accessing editor data.';
             return;
        }

        if (!postContent.trim()) {
            statusP.textContent = 'Error: Content is empty.';
            return;
        }

        statusP.textContent = 'Analyzing...';
        scoreDiv.innerHTML = '';
        issuesUl.innerHTML = '';
        suggestionsUl.innerHTML = '';
        keywordsDetailsDiv.innerHTML = '';
        issuesContainer.style.display = 'none';
        suggestionsContainer.style.display = 'none';
        keywordsContainer.style.display = 'none';
        analyzeButton.disabled = true;

        const apiEndpoint = aiSeoData.apiUrl;
        const requestBody = {
            content: postContent,
            contentType: 'html',
            config: {}
        };

        // Add targetKeyword to config if it exists
        if (targetKeyword) {
            requestBody.config.targetKeyword = targetKeyword;
        }


        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'X-WP-Plugin-Key': aiSeoData.apiKey // If using static API key
            },
            body: JSON.stringify(requestBody),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                     throw new Error(`API Error ${response.status}: ${errData.message || errData.detail || response.statusText}`);
                }).catch(() => {
                    throw new Error(`API Error ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            statusP.textContent = 'Analysis Complete!';
            scoreDiv.textContent = `SEO Score: ${data.seoScore ?? 'N/A'}`;

            // Issues - Display using list items
            if (data.issues && data.issues.length > 0) {
                 issuesUl.innerHTML = ''; // Clear previous
                 data.issues.forEach(issue => {
                    const li = document.createElement('li');
                    // Add class based on type for potential styling
                    li.classList.add(`issue-${issue.type}`); // e.g., issue-error, issue-warning
                    li.textContent = `${issue.message}`;
                    issuesUl.appendChild(li);
                });
                 issuesContainer.style.display = 'block';
            } else {
                 issuesUl.innerHTML = '<li>No issues found.</li>';
                 issuesContainer.style.display = 'block';
            }

            // Suggestions - Display using list items and add Apply buttons
            if (data.suggestions && data.suggestions.length > 0) {
                 suggestionsUl.innerHTML = ''; // Clear previous
                 data.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    let contentHTML = `<strong>${suggestion.message}</strong><br/><em>${suggestion.content}</em>`;
                     if (suggestion.context) {
                         contentHTML += `<br/><small>Context: ${suggestion.context.substring(0, 50)}...</small>`; // Show context snippet
                     }
                     li.innerHTML = contentHTML;

                     // Add Apply button for relevant types
                     if (suggestion.type === 'ai_meta' || suggestion.type === 'ai_alt_text') {
                         const applyButton = createApplyButton(suggestion.content, suggestion.type, suggestion.context);
                         li.appendChild(applyButton);
                     }

                    suggestionsUl.appendChild(li);
                });
                 suggestionsContainer.style.display = 'block';
            } else {
                 suggestionsUl.innerHTML = '<li>No AI suggestions.</li>';
                 suggestionsContainer.style.display = 'block'; // Show even if empty
            }

            // Keyword Analysis
             if (data.keywordAnalysis) {
                 const ka = data.keywordAnalysis;
                 keywordsDetailsDiv.innerHTML = `
                     <p><strong>Target: "${ka.targetKeyword}"</strong></p>
                     <ul>
                         <li>In Title: ${ka.foundInTitle ? '✅ Yes' : '❌ No'}</li>
                         <li>In Meta Desc: ${ka.foundInMeta ? '✅ Yes' : '❌ No'}</li>
                         <li>In H1: ${ka.foundInH1 ? '✅ Yes' : '❌ No'}</li>
                         <li>Body Count: ${ka.bodyCount}</li>
                         <li>Density: ${ka.density}%</li>
                     </ul>`;
                  keywordsContainer.style.display = 'block';
             } else {
                keywordsDetailsDiv.innerHTML = targetKeyword ? '<p>Keyword analysis not available.</p>' : ''; // Show message only if keyword was entered
                keywordsContainer.style.display = targetKeyword ? 'block' : 'none';
             }

        })
        .catch(error => {
            console.error('Error calling AI SEO API:', error);
            statusP.textContent = `Error: ${error.message}`;
            // Clear results on error
            scoreDiv.innerHTML = '';
            issuesUl.innerHTML = '';
            suggestionsUl.innerHTML = '';
            keywordsDetailsDiv.innerHTML = '';
            issuesContainer.style.display = 'none';
            suggestionsContainer.style.display = 'none';
            keywordsContainer.style.display = 'none';
        })
        .finally(() => {
            analyzeButton.disabled = false;
        });
    });
});