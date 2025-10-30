// File: assets/js/behavior-tracker.js
(function() {
  // Avoid running in admin/editor
  if (typeof window === "undefined" || window.location.href.includes("wp-admin")) return;

  console.log("🧠 AI SEO Behavior Tracker Loaded");

  const sessionStart = Date.now();
  let maxScroll = 0;

  // Track scroll depth
  window.addEventListener("scroll", () => {
    const scrollDepth = Math.floor(
      ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
    );
    if (scrollDepth > maxScroll) maxScroll = scrollDepth;
  });

  // Send data when user leaves page
  window.addEventListener("beforeunload", () => {
    const timeSpent = Math.floor((Date.now() - sessionStart) / 1000);
    const payload = {
      page_url: window.location.href,
      time_spent_seconds: timeSpent,
      scroll_depth_percent: maxScroll,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    };

    // Ensure global variable exists
    if (typeof aiSeoBehaviorData === "undefined" || !aiSeoBehaviorData.apiUrl) {
      console.warn("⚠️ AI SEO: apiUrl not configured. Behavior data not sent.");
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(aiSeoBehaviorData.apiUrl, blob);
      console.log("✅ Behavior data sent to:", aiSeoBehaviorData.apiUrl);
    } catch (err) {
      console.error("❌ Behavior tracking failed:", err);
    }
  });
})();
