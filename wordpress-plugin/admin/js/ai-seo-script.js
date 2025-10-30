document.addEventListener("DOMContentLoaded", function () {
  console.log("--- 🧠 AI SEO Script File Loaded ---");

  // --- DOM Elements ---
  const analyzeButton = document.getElementById("ai-seo-analyze-button");
  const resultsDiv = document.getElementById("ai-seo-results");
  const statusP = document.getElementById("ai-seo-status");
  const scoreValueSpan = document.getElementById("ai-seo-score-value");
  const scoreBar = document.getElementById("ai-seo-score-bar");
  const issuesUl = document.getElementById("ai-seo-issues");
  const suggestionsUl = document.getElementById("ai-seo-suggestions");
  const keywordsContentDiv = document.querySelector(
    "#ai-seo-keywords-section .collapsible-content"
  );
  const semanticContentDiv = document.querySelector(
    "#ai-seo-semantic-section .collapsible-content"
  );
  const linksContentDiv = document.querySelector(
    "#ai-seo-links-section .collapsible-content"
  );
  const competitorsContentDiv = document.querySelector(
    "#ai-seo-competitors-section .collapsible-content"
  );
  const keywordInput = document.getElementById("ai-seo-target-keyword");

  /* ---------------------------------------------
   * SEO SCORE HELPER
   * --------------------------------------------- */
  function updateSeoScore(pointsToAdd) {
    const currentScore = parseInt(scoreValueSpan.textContent) || 0;
    const newScore = Math.min(100, currentScore + pointsToAdd);
    scoreValueSpan.textContent = newScore;
    scoreBar.style.width = `${newScore}%`;

    scoreBar.className = "score-bar";
    if (newScore < 50) scoreBar.classList.add("low");
    else if (newScore < 80) scoreBar.classList.add("medium");
    else scoreBar.classList.add("high");

    console.log(`✅ SEO Score updated: ${currentScore} → ${newScore}`);
  }

  /* ---------------------------------------------
   * STATUS HELPERS
   * --------------------------------------------- */
  function setStatus(message, type = "info") {
    if (!statusP) return;
    statusP.textContent = message;
    statusP.className = "status-text";
    if (type === "error") statusP.classList.add("error");
    else if (type === "success") statusP.classList.add("success");
  }

  function resetUI() {
    resultsDiv.style.display = "none";
    scoreValueSpan.textContent = "N/A";
    scoreBar.style.width = "0%";
    scoreBar.className = "score-bar";
    issuesUl.innerHTML = "";
    suggestionsUl.innerHTML = "";
    keywordsContentDiv.innerHTML = "";
    semanticContentDiv.innerHTML = "";
    linksContentDiv.innerHTML = "";
    if (competitorsContentDiv) competitorsContentDiv.innerHTML = "";
    setStatus("Ready.");
  }

  /* ---------------------------------------------
   * COLLAPSIBLE HELPERS
   * --------------------------------------------- */
  function openCollapsible(el) {
    el.classList.remove("closed");
    el.classList.add("open");
    const icon = el.querySelector(".toggle-icon");
    if (icon) icon.textContent = "▼";
    const content = el.querySelector(".collapsible-content");
    if (content) content.style.display = "block";
  }

  function closeCollapsible(el) {
    el.classList.remove("open");
    el.classList.add("closed");
    const icon = el.querySelector(".toggle-icon");
    if (icon) icon.textContent = "►";
    const content = el.querySelector(".collapsible-content");
    if (content) content.style.display = "none";
  }

  document
    .querySelectorAll(".collapsible-trigger")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        toggleCollapsible(btn.closest(".collapsible"))
      )
    );

  function toggleCollapsible(el) {
    if (!el) return;
    el.classList.contains("open") ? closeCollapsible(el) : openCollapsible(el);
  }

  /* ---------------------------------------------
   * APPLY BUTTON HANDLING (Yoast + ALT)
   * --------------------------------------------- */
  function createApplyButton(suggestionText, type, scoreGain = 0, context = null) {
    const container = document.createElement("div");
    container.classList.add("suggestion-action");
    const button = document.createElement("button");
    button.textContent = "Apply";
    button.className = "button button-small ai-seo-apply-button";
    button.dataset.suggestionText = suggestionText;
    button.dataset.suggestionType = type;
    if (context) button.dataset.suggestionContext = context;

    button.addEventListener("click", handleApplySuggestion);
    container.appendChild(button);

    if (scoreGain > 0) {
      const scoreSpan = document.createElement("span");
      scoreSpan.classList.add("score-gain");
      scoreSpan.textContent = ` (+${scoreGain} pts)`;
      container.appendChild(scoreSpan);
    }
    return container;
  }

  function handleApplySuggestion(event) {
    const button = event.target;
    const textToApply = button.dataset.suggestionText;
    const type = button.dataset.suggestionType;
    const context = button.dataset.suggestionContext;

    console.log("🪄 Applying Suggestion:", { type, textToApply, context });
    setStatus("Applying suggestion...");
    button.disabled = true;

    try {
      if (type === "ai_meta") {
        const metaKey = "_yoast_wpseo_metadesc";
        wp.data.dispatch("core/editor").editPost({ meta: { [metaKey]: textToApply } });
        const field =
          document.querySelector("textarea[name='yoast_wpseo_metadesc']") ||
          document.querySelector("#yoast_wpseo_metadesc");
        if (field) {
          field.value = textToApply;
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (window.YoastSEO?.app?.refresh) YoastSEO.app.refresh();
        setStatus("Meta description applied! Save the post.", "success");
        button.textContent = "Applied!";
        const scoreGain = button.nextElementSibling?.textContent.match(/\+(\d+)/);
        if (scoreGain) updateSeoScore(parseInt(scoreGain[1]));
      }
    } catch (e) {
      console.error("❌ Apply error:", e);
      setStatus(`Error: ${e.message}`, "error");
    } finally {
      setTimeout(() => setStatus("Ready."), 3000);
      button.disabled = false;
    }
  }

  /* ---------------------------------------------
   * ANALYZE BUTTON LOGIC
   * --------------------------------------------- */
  analyzeButton?.addEventListener("click", function () {
    console.log("🚀 Analyze Clicked");
    setStatus("Analyzing...");
    analyzeButton.disabled = true;

    let postContent = "";
    let postTitle = "";
    const targetKeyword = keywordInput?.value?.trim() || "";

    try {
      if (wp?.data?.select("core/editor")) {
        postContent = wp.data.select("core/editor").getEditedPostContent();
        postTitle = wp.data.select("core/editor").getEditedPostAttribute("title");
      } else if (window.tinymce?.get("content")) {
        postContent = tinymce.get("content").getContent();
        postTitle = document.getElementById("title")?.value || "";
      }
    } catch (e) {
      console.error("Editor error:", e);
      setStatus("Error accessing content", "error");
      return;
    }

    if (!postContent.trim()) {
      setStatus("Content empty.", "error");
      return;
    }

    resetUI();

    fetch(aiSeoData.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: postContent,
        contentType: "html",
        config: { targetKeyword },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log("✅ API Response:", data);
        setStatus("Analysis complete!", "success");
        resultsDiv.style.display = "block";

        // --- Score ---
        const score = data.seoScore || 0;
        scoreValueSpan.textContent = score;
        scoreBar.style.width = `${score}%`;
        scoreBar.className = "score-bar";
        if (score < 50) scoreBar.classList.add("low");
        else if (score < 80) scoreBar.classList.add("medium");
        else scoreBar.classList.add("high");

        // --- Issues ---
        issuesUl.innerHTML = data.issues?.length
          ? data.issues.map((i) => `<li>${i.message}</li>`).join("")
          : "<li>No issues found.</li>";

        // --- Suggestions ---
        suggestionsUl.innerHTML = "";
        if (data.suggestions?.length) {
          data.suggestions.forEach((s) => {
            const li = document.createElement("li");
            li.classList.add("ai-seo-suggestion-item");
            li.innerHTML = `<code>${s.content}</code><p>${s.explanation || ""}</p>`;
            if (s.type === "ai_meta" || s.type === "ai_alt_text") {
              li.appendChild(
                createApplyButton(s.content, s.type, s.potential_score_gain || 0, s.context)
              );
            }
            suggestionsUl.appendChild(li);
          });
        } else {
          suggestionsUl.innerHTML = "<li>No suggestions.</li>";
        }

        // --- Keyword Analysis ---
        if (data.keywordAnalysis) {
          const ka = data.keywordAnalysis;
          keywordsContentDiv.innerHTML = `
            <p><strong>Target:</strong> ${ka.targetKeyword}</p>
            <ul>
              <li>In Title: ${ka.foundInTitle ? "✅" : "❌"}</li>
              <li>In Meta Desc: ${ka.foundInMeta ? "✅" : "❌"}</li>
              <li>Density: ${ka.density}%</li>
            </ul>`;
        }

        // --- Semantic ---
        if (data.semanticAnalysis) {
          const sa = data.semanticAnalysis;
          semanticContentDiv.innerHTML = `
            <p>Score: ${sa.relevance_score}/100</p>
            <p>${sa.justification}</p>`;
        }

        // --- Link Analysis ---
        if (data.linkAnalysis) {
          const la = data.linkAnalysis;
          linksContentDiv.innerHTML = `
            <p><strong>Internal Links:</strong> ${la.internal_link_count}</p>
            <p><strong>External Links:</strong> ${la.external_link_count}</p>`;
        }

// --- Competitor Analysis ---
if (competitorsContentDiv && data.competitorAnalysis) {
  const competitorsData = data.competitorAnalysis.competitors || [];

  console.log("🧠 Rendering Competitor Analysis:", competitorsData);

  if (competitorsData.length > 0) {
    const htmlList = competitorsData
      .map(c => {
        const link = c.link || c.domain || "Unknown Source";
        const desc = c.description || c.summary || c.overview || "No description available";
        return `
          <li style="margin-bottom: 6px;">
            <a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a><br/>
            <span style="color:#555;">${desc}</span>
          </li>`;
      })
      .join("");

    competitorsContentDiv.innerHTML = `<ul>${htmlList}</ul>`;

    const section = document.querySelector("#ai-seo-competitors-section");
    if (section) {
      section.classList.remove("closed");
      section.classList.add("open");
      const icon = section.querySelector(".toggle-icon");
      if (icon) icon.textContent = "▼";
    }
  } else {
    competitorsContentDiv.innerHTML = "<p>No competitors found.</p>";
  }
} else {
  console.warn("⚠️ Competitor section missing or empty response.");
}


      })
      .catch((err) => {
        console.error("❌ API Error:", err);
        setStatus("Analysis failed", "error");
      })
      .finally(() => (analyzeButton.disabled = false));
  });

  /* ---------------------------------------------
   * USER BEHAVIOR TRACKING (only on live sites)
   * --------------------------------------------- */
  const host = window.location.hostname;
  const isLive = !["localhost", "127.0.0.1"].includes(host);
  const apiUrl = window.aiSeoBehaviorData?.apiUrl || "http://localhost:8000/api/behavior";

  if (isLive) {
    window.addEventListener("beforeunload", () => {
      const payload = {
        page_url: window.location.href,
        time_spent_seconds: Math.round(performance.now() / 1000),
        scroll_depth_percent: Math.round(
          ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
        ),
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
      };

      navigator.sendBeacon(apiUrl, JSON.stringify(payload));
      console.log("📡 Sent behavior data:", payload);
    });
  } else {
    console.log("🧠 Behavior tracking disabled (local environment)");
  }

  console.log("--- ✅ AI SEO Script Initialized ---");
});
