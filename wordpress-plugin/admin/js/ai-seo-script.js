document.addEventListener('DOMContentLoaded', function () {
    console.log("--- AI SEO Script File Loaded ---");

    // --- Get DOM Elements ---
    const analyzeButton = document.getElementById('ai-seo-analyze-button');
    const resultsDiv = document.getElementById('ai-seo-results');
    const statusP = document.getElementById('ai-seo-status');

    const scoreSection = document.getElementById('ai-seo-score-section');
    const scoreValueSpan = document.getElementById('ai-seo-score-value');
    const scoreBar = document.getElementById('ai-seo-score-bar');

    const keywordsSection = document.getElementById('ai-seo-keywords-section');
    const keywordsContentDiv = keywordsSection ? keywordsSection.querySelector('.collapsible-content') : null;

    const semanticSection = document.getElementById('ai-seo-semantic-section');
    const semanticContentDiv = semanticSection ? semanticSection.querySelector('.collapsible-content') : null;

    const issuesSection = document.getElementById('ai-seo-issues-section');
    const issuesUl = document.getElementById('ai-seo-issues');

    const suggestionsSection = document.getElementById('ai-seo-suggestions-section');
    const suggestionsUl = document.getElementById('ai-seo-suggestions');

    const linksSection = document.getElementById('ai-seo-links-section');
    const linksContentDiv = linksSection ? linksSection.querySelector('.collapsible-content') : null;

    const keywordInput = document.getElementById('ai-seo-target-keyword');
    // --- Helper: update the SEO score visually ---
function updateSeoScore(pointsToAdd) {
  const currentScore = parseInt(scoreValueSpan.textContent) || 0;
  const newScore = Math.min(100, currentScore + pointsToAdd); // clamp to 100

  scoreValueSpan.textContent = newScore;
  scoreBar.style.width = `${newScore}%`;

  // Update color level
  scoreBar.className = 'score-bar';
  if (newScore < 50) scoreBar.classList.add('low');
  else if (newScore < 80) scoreBar.classList.add('medium');
  else scoreBar.classList.add('high');

  console.log(`SEO Score updated: ${currentScore} → ${newScore}`);
}


    // --- Initial State & Helper Functions ---
    function setStatus(message, type = 'info') { // type: 'info', 'error', 'success'
        if (statusP) {
            statusP.textContent = message;
            statusP.className = 'status-text'; // Reset classes
            if (type === 'error') {
                statusP.classList.add('error');
            } else if (type === 'success') {
                 statusP.classList.add('success');
            }
        }
    }

    function resetUI() {
        if (resultsDiv) resultsDiv.style.display = 'none';
        if (scoreValueSpan) scoreValueSpan.textContent = 'N/A';
        if (scoreBar) {
            scoreBar.style.width = '0%';
            scoreBar.className = 'score-bar';
        }
        if (issuesUl) issuesUl.innerHTML = '';
        if (suggestionsUl) suggestionsUl.innerHTML = '';
        if (keywordsContentDiv) keywordsContentDiv.innerHTML = '';
        if (semanticContentDiv) semanticContentDiv.innerHTML = '';
        if (linksContentDiv) linksContentDiv.innerHTML = '';

        if (keywordsSection) keywordsSection.style.display = 'block';
        if (semanticSection) semanticSection.style.display = 'none';
        if (linksSection) linksSection.style.display = 'block';

        document.querySelectorAll('.ai-seo-section.collapsible').forEach(el => {
            // Default to open issues and suggestions, closed others
            if (el.id === 'ai-seo-issues-section' || el.id === 'ai-seo-suggestions-section') {
                 openCollapsible(el);
            } else {
                 closeCollapsible(el);
            }
        });

        setStatus('Ready.');
        if (analyzeButton) analyzeButton.disabled = false;
    }

     // --- Collapsible Section Logic ---
    function setupCollapsibles() {
        document.querySelectorAll('.collapsible-trigger').forEach(button => {
            // Prevent duplicate listeners if script re-runs somehow
            if (!button.dataset.listenerAttached) {
                button.addEventListener('click', () => {
                    const section = button.closest('.collapsible');
                    if (section) {
                        toggleCollapsible(section);
                    }
                });
                button.dataset.listenerAttached = 'true';
            }
        });
    }

    function toggleCollapsible(sectionElement) {
         if (sectionElement.classList.contains('open')) {
             closeCollapsible(sectionElement);
         } else {
             openCollapsible(sectionElement);
         }
    }
     function openCollapsible(sectionElement) {
        sectionElement.classList.remove('closed');
        sectionElement.classList.add('open');
        const icon = sectionElement.querySelector('.toggle-icon');
        if (icon) icon.textContent = '▼';
        // Make content visible if using display:none/block
        const content = sectionElement.querySelector('.collapsible-content');
        if(content) content.style.display = 'block';
     }
      function closeCollapsible(sectionElement) {
        sectionElement.classList.remove('open');
        sectionElement.classList.add('closed');
        const icon = sectionElement.querySelector('.toggle-icon');
        if (icon) icon.textContent = '►';
         // Hide content if using display:none/block
        const content = sectionElement.querySelector('.collapsible-content');
        if(content) content.style.display = 'none';
      }

    // --- Apply Button Logic ---
    function createApplyButton(suggestionText, type, scoreGain = 0, context = null) {
        const actionDiv = document.createElement('div');
        actionDiv.classList.add('suggestion-action');

        const button = document.createElement('button');
        button.textContent = 'Apply';
        button.type = 'button';
        button.className = 'button button-small ai-seo-apply-button';

        button.dataset.suggestionText = suggestionText;
        button.dataset.suggestionType = type;
        if (context) button.dataset.suggestionContext = context;

        button.addEventListener('click', handleApplySuggestion);
        actionDiv.appendChild(button);

        if (scoreGain > 0) {
            const scoreSpan = document.createElement('span');
            scoreSpan.classList.add('score-gain');
            scoreSpan.textContent = ` (+${scoreGain} pts)`;
            actionDiv.appendChild(scoreSpan);
        }
        return actionDiv;
    }

     function handleApplySuggestion(event) {
        const button = event.target;
        const textToApply = button.dataset.suggestionText;
        const type = button.dataset.suggestionType;
        const context = button.dataset.suggestionContext;

        console.log("Apply clicked!", { type, textToApply, context });
        setStatus('Applying suggestion...');
        button.disabled = true;

        let success = false;
        try {
if (type === 'ai_meta') {
    const metaKey = '_yoast_wpseo_metadesc';
    console.log(`Attempting to apply meta description using Yoast key: ${metaKey}`);

    if (wp && wp.data && wp.data.dispatch('core/editor')) {
        // 1️⃣ Update post meta for Yoast
        wp.data.dispatch('core/editor').editPost({ meta: { [metaKey]: textToApply } });
        console.log('✅ editPost dispatch called successfully for Yoast meta.');

        // 2️⃣ Update visible Yoast meta description field (if Classic UI or metabox visible)
        const yoastField =
            document.querySelector('textarea[name="yoast_wpseo_metadesc"]') ||
            document.querySelector('#yoast_wpseo_metadesc');

        if (yoastField) {
            yoastField.value = textToApply;
            yoastField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('✅ Yoast meta description field updated in UI.');
        }

        // 3️⃣ Force refresh of the Yoast snippet preview
        if (window.YoastSEO && YoastSEO.app && typeof YoastSEO.app.refresh === 'function') {
            YoastSEO.app.refresh();
            console.log('🔄 Yoast snippet preview refreshed.');
        }

        setStatus('Meta description applied! Save the post to persist.', 'success');
        button.textContent = 'Applied!';
        success = true;
    } else {
        throw new Error('WordPress Block Editor API (wp.data) not available.');
    }
}


             else if (type === 'ai_alt_text' && context) {
                 if (wp && wp.data && wp.data.select('core/editor') && wp.data.dispatch('core/editor') && wp.blocks && wp.blocks.createBlock && wp.blocks.cloneBlock) {
                    const currentBlocks = wp.data.select('core/editor').getBlocks();
                    let blockUpdated = false;

                    function findAndUpdateImageBlock(blocks) {
                        return blocks.map(block => {
                            if (blockUpdated) return block;
                            if (block.name === 'core/image' && block.attributes.url === context) {
                                console.log('Found matching image block:', block);
                                const newAttributes = { ...block.attributes, alt: textToApply };
                                blockUpdated = true; // Mark as updated
                                // Return a NEW block object with updated attributes
                                return wp.blocks.createBlock(block.name, newAttributes, block.innerBlocks);
                            }
                            if (block.innerBlocks && block.innerBlocks.length > 0) {
                                const newInnerBlocks = findAndUpdateImageBlock(block.innerBlocks);
                                if (newInnerBlocks !== block.innerBlocks) {
                                     // If inner blocks changed, return a new cloned parent block
                                     return wp.blocks.cloneBlock(block, {}, newInnerBlocks);
                                }
                            }
                            return block; // Return original block if no changes
                        });
                    }

                    const newBlocks = findAndUpdateImageBlock(JSON.parse(JSON.stringify(currentBlocks))); // Work on a deep copy

                    if (blockUpdated) {
                        wp.data.dispatch('core/editor').resetEditorBlocks(newBlocks);
                        setStatus('Alt text applied to image block.', 'success');
                         button.textContent = 'Applied!';
                         success = true;
                    } else {
                         console.warn('Could not find matching core/image block for src:', context);
                         setStatus('Could not find image block to apply alt text.', 'error');
                         button.disabled = false;
                    }
                } else {
                    throw new Error("Block Editor APIs not fully available for alt text update.");
                }
            }
             else {
                 setStatus(`Apply action not configured for type: ${type}.`, 'error');
                 button.disabled = false;
            }

        } catch (e) {
             console.error("Error applying suggestion:", e);
             setStatus(`Error applying: ${e.message}`, 'error');
             button.disabled = false; // Re-enable button on error
        } finally {
            // Only reset success message, keep error message
             if (success) {
                 setTimeout(() => {
                     // Check if status is still the success message before resetting
                     if (statusP && statusP.classList.contains('success')) {
                         setStatus('Ready.');
                     }
                 }, 3000); 
                 // Increase score visually if a score gain exists
const scoreGainText = button.nextElementSibling?.textContent || "";
const match = scoreGainText.match(/\+(\d+)/);
if (match) {
    const points = parseInt(match[1]);
    updateSeoScore(points);
    scoreBar.classList.add("glow");
setTimeout(() => scoreBar.classList.remove("glow"), 1000);

}
// Reset after 3 seconds
             }
        }
    }

    // --- Analyze Button Event Listener ---
    if (!analyzeButton) {
        console.error('!!! AI SEO Analyze button NOT FOUND by getElementById !!!');
        return;
    } else {
        console.log("Analyze button found, attaching listener...");
    }

    analyzeButton.addEventListener('click', function () {
        console.log("--- Analyze Button Clicked! ---");

        let postContent = '';
        let postTitle = '';
        const targetKeyword = keywordInput ? keywordInput.value.trim() : '';

        try { // Get editor content
            if (wp && wp.data && wp.data.select('core/editor')) {
                postContent = wp.data.select('core/editor').getEditedPostContent();
                postTitle = wp.data.select('core/editor').getEditedPostAttribute('title');
                console.log('Using Block Editor data');
            } else if (typeof tinymce !== 'undefined' && tinymce.get('content')) {
                postContent = tinymce.get('content').getContent();
                postTitle = document.getElementById('title') ? document.getElementById('title').value : '';
                console.log('Using Classic Editor data');
            } else {
                 throw new Error('Could not access editor content.');
            }
        } catch (e) {
             console.error('Error getting editor content:', e);
             setStatus('Error accessing editor data.', 'error');
             return;
        }

        if (!postContent.trim()) {
            setStatus('Error: Content is empty.', 'error');
            return;
        }

        // --- Reset UI before API Call ---
        resetUI(); // Use the reset function
        setStatus('Analyzing...');
        analyzeButton.disabled = true;

        const apiEndpoint = aiSeoData.apiUrl;
        const requestBody = {
            content: postContent,
            contentType: 'html',
            config: {}
        };
        if (targetKeyword) {
            requestBody.config.targetKeyword = targetKeyword;
        }

        // --- Fetch API Call ---
        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add Auth headers here if/when needed
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
            console.log("API Response Data:", data); // Log the full response

            // --- Display Results ---
            setStatus('Analysis Complete!', 'success');
            resultsDiv.style.display = 'block'; // Show results area

            // Score
            const score = data.seoScore ?? 0;
            scoreValueSpan.textContent = score;
            scoreBar.style.width = `${score}%`;
            scoreBar.className = 'score-bar'; // Reset class
            if (score < 50) scoreBar.classList.add('low');
            else if (score < 80) scoreBar.classList.add('medium');
            else scoreBar.classList.add('high');

            // Issues
            issuesUl.innerHTML = ''; // Clear previous
            if (data.issues && data.issues.length > 0) {
                 data.issues.forEach(issue => {
                    const li = document.createElement('li');
                    li.classList.add(`issue-${issue.type}`); // error, warning, info
                    li.textContent = `${issue.message}`;
                    issuesUl.appendChild(li);
                });
                 openCollapsible(issuesSection); // Ensure issues are visible
            } else {
                 issuesUl.innerHTML = '<li>No issues found.</li>';
                 closeCollapsible(issuesSection); // Close if empty
            }

            // Suggestions
            suggestionsUl.innerHTML = ''; // Clear previous
            if (data.suggestions && data.suggestions.length > 0) {
                 data.suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.classList.add('ai-seo-suggestion-item');

                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.classList.add('suggestion-content');

                    const suggestionText = document.createElement('code');
                    suggestionText.textContent = suggestion.content;
                    suggestionDiv.appendChild(suggestionText);

                    if (suggestion.explanation) {
                        const explanationP = document.createElement('p');
                        explanationP.classList.add('suggestion-explanation');
                        explanationP.textContent = suggestion.explanation;
                        suggestionDiv.appendChild(explanationP);
                    }
                    if (suggestion.context) {
                         const contextSmall = document.createElement('small');
                         contextSmall.classList.add('suggestion-context');
                         contextSmall.textContent = `Context: ${suggestion.context.substring(0, 70)}...`;
                         suggestionDiv.appendChild(contextSmall);
                     }
                    li.appendChild(suggestionDiv);

                    if (suggestion.type === 'ai_meta' || suggestion.type === 'ai_alt_text') {
                        const scoreGain = suggestion.potential_score_gain || 0;
                        const applyButtonAction = createApplyButton(suggestion.content, suggestion.type, scoreGain, suggestion.context);
                        li.appendChild(applyButtonAction);
                    }
                    suggestionsUl.appendChild(li);
                });
                 openCollapsible(suggestionsSection); // Ensure suggestions are visible
            } else {
                 suggestionsUl.innerHTML = '<li>No AI suggestions.</li>';
                 closeCollapsible(suggestionsSection); // Close if empty
            }

            // Keyword Analysis
            keywordsContentDiv.innerHTML = ''; // Clear previous
             if (data.keywordAnalysis) {
                 const ka = data.keywordAnalysis;
                 keywordsContentDiv.innerHTML = `
                     <p><strong>Target: "${ka.targetKeyword}"</strong></p>
                     <ul>
                         <li>In Title: ${ka.foundInTitle ? '✅ Yes' : '❌ No'}</li>
                         <li>In Meta Desc: ${ka.foundInMeta ? '✅ Yes' : '❌ No'}</li>
                         <li>In H1: ${ka.foundInH1 ? '✅ Yes' : '❌ No'}</li>
                         <li>Body Count: ${ka.bodyCount}</li>
                         <li>Density: ${ka.density}%</li>
                     </ul>`;
                  openCollapsible(keywordsSection); // Open if keyword analysis ran
             } else {
                keywordsContentDiv.innerHTML = targetKeyword ? '<p>Keyword analysis requires a target keyword.</p>' : '<p>Enter a target keyword to enable analysis.</p>';
                 // Keep keyword section closed or open based on preference, but show message
             }

             // Semantic Analysis
             semanticContentDiv.innerHTML = ''; // Clear previous
             if (data.semanticAnalysis) {
                 const sa = data.semanticAnalysis;
                 semanticContentDiv.innerHTML = `
                    <p><strong class="semantic-score">Score: ${sa.relevance_score}/100</strong></p>
                    <p class="semantic-justification">${sa.justification}</p>
                 `;
                 semanticSection.style.display = 'block'; // Show the section
                 openCollapsible(semanticSection); // Open it
             } else {
                 semanticSection.style.display = targetKeyword ? 'block' : 'none'; // Only show if keyword was entered
                 semanticContentDiv.innerHTML = targetKeyword ? '<p>Semantic analysis could not be performed.</p>' : '';
                 closeCollapsible(semanticSection); // Keep closed if no data
             }

             // Link Analysis
             linksContentDiv.innerHTML = ''; // Clear previous
              if (data.linkAnalysis) {
                  const la = data.linkAnalysis;
                  let linkHtml = `
                    <p><strong>Internal Links:</strong> ${la.internal_link_count}</p>
                    <p><strong>External Links:</strong> ${la.external_link_count}</p>
                  `;
                  if (la.external_domains && la.external_domains.length > 0) {
                      linkHtml += `<p><strong>External Domains (${la.external_domains.length}):</strong> ${la.external_domains.slice(0, 5).join(', ')}${la.external_domains.length > 5 ? '...' : ''}</p>`;
                  }
                   // Display AI Link suggestions (if implemented later)
                  if (la.ai_suggestions && la.ai_suggestions.length > 0) {
                       linkHtml += '<h4>AI Link Suggestions:</h4><ul>';
                       la.ai_suggestions.forEach(ls => {
                           linkHtml += `<li class="ai-link-suggestion">Suggest linking anchor text <code>${ls.anchor_text}</code> to a topic about: <strong>${ls.suggested_topic}</strong></li>`;
                       });
                       linkHtml += '</ul>';
                  }

                  linksContentDiv.innerHTML = linkHtml;
                  openCollapsible(linksSection); // Open if data exists
              } else {
                  linksContentDiv.innerHTML = '<p>Link analysis data not available.</p>';
                  closeCollapsible(linksSection); // Keep closed if no data
              }


        })
        .catch(error => {
            console.error('Error calling AI SEO API:', error);
            setStatus(`Error: ${error.message}`, 'error');
            resetUI(); // Reset UI fully on error
            statusP.textContent = `Error: ${error.message}`; // Ensure error message persists
            statusP.classList.add('error');
        })
        .finally(() => {
            // Only re-enable button if it wasn't successful or error handled above
            if (!analyzeButton.disabled && statusP && !statusP.classList.contains('success')) {
                 analyzeButton.disabled = false;
            } else if (analyzeButton.disabled && statusP && !statusP.classList.contains('success')) {
                // Ensure button is re-enabled if fetch fails very early
                 analyzeButton.disabled = false;
            }
        });
    });

    // --- Initial Setup ---
    setupCollapsibles(); // Make sections collapsible
    console.log("--- AI SEO Script Initialized and Listeners Attached ---");
// --- existing plugin JS code above ---

// Track user behavior only if site is live
// --- Track User Behavior ---
if (true) {  // set to true for testing locally
  window.addEventListener("beforeunload", () => {
    const timeSpent = Math.round(performance.now() / 1000);
    const scrollDepth = Math.round(
      ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
    );

    const payload = {
      page_url: window.location.href,
      time_spent_seconds: timeSpent,
      scroll_depth_percent: scrollDepth,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
    };

    console.log("🧠 AI SEO Behavior Payload:", payload);

    fetch("http://localhost:8000/api/behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
    })
      .then((res) => console.log("✅ Behavior logged:", res.status))
      .catch((err) => console.error("❌ Behavior logging failed:", err));
  });
}

}); // End of DOMContentLoaded listener