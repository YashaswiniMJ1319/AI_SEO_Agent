// File: assets/js/behavior-tracker.js
(function() {
  // Run only on frontend pages, not admin/editor
  if (typeof window === "undefined" || window.location.href.includes("wp-admin")) return;

  console.log("AI SEO: Behavior Tracker Initialized");

  const sessionStart = Date.now();
  let maxScroll = 0;

  // Track scroll depth
  window.addEventListener("scroll", () => {
    const scrollDepth = Math.floor(
      (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
    );
    if (scrollDepth > maxScroll) maxScroll = scrollDepth;
  });

  // When user leaves page
  window.addEventListener("beforeunload", () => {
    const timeSpent = Math.floor((Date.now() - sessionStart) / 1000);
    const payload = {
      page_url: window.location.href,
      time_spent_seconds: timeSpent,
      scroll_depth_percent: maxScroll,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    };

    // Send data to your backend AI engine
    navigator.sendBeacon("https://your-backend.com/api/behavior", JSON.stringify(payload));
  });
})();
