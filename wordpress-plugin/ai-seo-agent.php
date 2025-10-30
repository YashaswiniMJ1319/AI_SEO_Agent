<?php
/**
 * Plugin Name: AI SEO Agent
 * Description: Analyzes post content using the AI SEO Agent API and provides detailed feedback.
 * Version: 0.3
 * Author: Your Name
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// 1. Add the Meta Box
function ai_seo_register_meta_box() {
    add_meta_box(
        'ai_seo_agent_metabox',           // Unique ID
        'AI SEO Analysis',                // Title
        'ai_seo_render_meta_box_content', // Render callback
        ['post', 'page'],                 // Post types
        'side',                           // Context (side panel)
        'high'                            // Priority
    );
}
add_action( 'add_meta_boxes', 'ai_seo_register_meta_box' );

// 2. Render Meta Box HTML Content
function ai_seo_render_meta_box_content( $post ) {
    ?>
<div id="ai-seo-agent-wrapper">
    
    <div id="ai-seo-controls" class="ai-seo-section">
        <label for="ai-seo-target-keyword" style="display: block; margin-bottom: 3px; font-weight: bold;">Target Keyword:</label>
        <input type="text" id="ai-seo-target-keyword" name="ai-seo-target-keyword" value="" style="width: 100%; margin-bottom: 5px;" placeholder="Enter focus keyword"/>
        <button type="button" id="ai-seo-analyze-button" class="button button-primary" style="margin-top: 5px;">Analyze SEO</button>
        <p id="ai-seo-status" class="status-text" style="font-style: italic; color: #555; margin-top: 8px; min-height: 1.5em;">Ready.</p>
    </div>

    <!-- Results Area - Initially Hidden -->
    <div id="ai-seo-results" style="display: none;">

        <!-- Score Section -->
        <div id="ai-seo-score-section" class="ai-seo-section">
            <h4 style="margin-bottom: 5px; font-size: 1.1em;">Overall SEO Score: <span id="ai-seo-score-value">N/A</span></h4>
            <div class="score-bar-container" style="width: 100%; height: 12px; background-color: #e0e0e0; border-radius: 6px; overflow: hidden; margin-top: 5px;">
                <div id="ai-seo-score-bar" class="score-bar" style="height: 100%; width: 0%; border-radius: 6px; transition: width 0.5s ease-in-out, background-color 0.5s ease-in-out; background-color: #dc3232;"></div>
            </div>
        </div>

        <!-- Keyword Analysis Section -->
        <div id="ai-seo-keywords-section" class="ai-seo-section collapsible closed">
            <button type="button" class="collapsible-trigger">Keyword Analysis <span class="toggle-icon">►</span></button>
            <div class="collapsible-content">
                <!-- JS will populate this -->
            </div>
        </div>

        <!-- Semantic Relevance Section -->
        <div id="ai-seo-semantic-section" class="ai-seo-section collapsible closed" style="display: none;">
            <button type="button" class="collapsible-trigger">Semantic Relevance <span class="toggle-icon">►</span></button>
            <div class="collapsible-content">
                <!-- JS will populate this -->
            </div>
        </div>

        <!-- Issues Section -->
        <div id="ai-seo-issues-section" class="ai-seo-section collapsible open">
            <button type="button" class="collapsible-trigger">Issues Found <span class="toggle-icon">▼</span></button>
            <div class="collapsible-content">
                <ul id="ai-seo-issues"></ul>
            </div>
        </div>

        <!-- AI Suggestions Section -->
        <div id="ai-seo-suggestions-section" class="ai-seo-section collapsible open">
            <button type="button" class="collapsible-trigger">AI Suggestions <span class="toggle-icon">▼</span></button>
            <div class="collapsible-content">
                <ul id="ai-seo-suggestions"></ul>
            </div>
        </div>

        <!-- Link Analysis Section -->
        <div id="ai-seo-links-section" class="ai-seo-section collapsible closed">
            <button type="button" class="collapsible-trigger">Link Analysis <span class="toggle-icon">►</span></button>
            <div class="collapsible-content">
                <!-- JS will populate this -->
            </div>
        </div>
        <div id="ai-seo-behavior-section" class="ai-seo-section collapsible closed" style="display: none;">
  <button type="button" class="collapsible-trigger">User Behavior Insights <span class="toggle-icon">►</span></button>
  <div class="collapsible-content">
    <p>This feature will activate when your site is live and AI SEO Agent can collect real visitor metrics.</p>
  </div>
</div>


    </div> <!-- End #ai-seo-results -->
</div> <!-- End #ai-seo-agent-wrapper -->
 
<?php
}

// 3. Enqueue Scripts and Styles
function ai_seo_enqueue_scripts( $hook ) {
    // Only load on post/page edit screens
    if ( 'post.php' != $hook && 'post-new.php' != $hook ) {
        return;
    }
    // Enqueue JS
    wp_enqueue_script(
        'ai-seo-script',
        plugin_dir_url( __FILE__ ) . 'admin/js/ai-seo-script.js',
        array( 'wp-data', 'wp-editor', 'wp-element', 'wp-components', 'jquery' ), // Ensure all dependencies are listed
        '1.2', // Increment version for cache busting
        true // Load in footer
    );

    // Pass data like API URL to the script
    wp_localize_script( 'ai-seo-script', 'aiSeoData', array(
        'apiUrl' => 'http://localhost:4000/api/seo/analyze', // Your Node API endpoint
        // 'apiKey' => 'YOUR_STATIC_API_KEY' // Uncomment and set if using API key auth
        // 'nonce' => wp_create_nonce( 'wp_rest' ) // Needed if using WP REST API or AJAX actions
    ));

    // Enqueue CSS
    wp_enqueue_style(
        'ai-seo-styles',
        plugin_dir_url( __FILE__ ) . 'admin/css/ai-seo-styles.css',
        array('wp-admin'), // Dependency on admin styles for Dashicons
        '1.1' // Increment version
    );
}
add_action( 'admin_enqueue_scripts', 'ai_seo_enqueue_scripts' );

function aiseo_register_yoast_meta_keys() {
    register_post_meta( '', '_yoast_wpseo_metadesc', [
        'show_in_rest' => true,
        'single' => true,
        'type' => 'string',
        'auth_callback' => function() { 
            return current_user_can('edit_posts'); 
        },
    ]);
}
add_action('init', 'aiseo_register_yoast_meta_keys');

// 4. Output the Meta Description Tag in the HTML Head (Using Custom Key)
// 4. Output the Meta Description Tag in the HTML Head (Using Yoast Key)
/*function ai_seo_output_meta_description() {
    if ( ! is_singular() ) {
        return;
    }

    $post_id = get_queried_object_id();
    if ( ! $post_id ) {
        return;
    }

    // Fetch Yoast SEO Meta Description
    $meta_description = get_post_meta( $post_id, '_yoast_wpseo_metadesc', true );

    if ( ! empty( $meta_description ) ) {
        $meta_description = esc_attr( strip_tags( $meta_description ) );
        echo '<meta name="description" content="' . $meta_description . '" />' . "\n";
    }
}
add_action( 'wp_head', 'ai_seo_output_meta_description' );






*/


// 🧠 Enqueue Behavior Tracker for frontend only
// 🧠 Auto-inject Behavior Tracker script for live websites
function ai_seo_insert_behavior_tracker() {
    // Only run on frontend for visitors (not admins)
    if ( is_admin() || is_user_logged_in() ) return;

    // Skip if already inserted
    if ( did_action('ai_seo_behavior_tracker_loaded') ) return;
    do_action('ai_seo_behavior_tracker_loaded');

    // Detect local or staging URLs
    $current_host = $_SERVER['HTTP_HOST'];
    $local_hosts = array('localhost', '127.0.0.1');
    foreach ($local_hosts as $lh) {
        if (stripos($current_host, $lh) !== false) {
            // 🔇 Skip for local development
            return;
        }
    }

    // ✅ Production tracking URLs
    $api_url = 'https://your-fastapi-server.com/api/behavior';
    $script_url = plugins_url('admin/js/behavior-tracker.js', __FILE__);

    echo "
    <!-- 🧠 AI SEO Behavior Tracker -->
    <script>
      window.aiSeoBehaviorData = { apiUrl: '{$api_url}' };
    </script>
    <script src='{$script_url}' async></script>
    <!-- End AI SEO Behavior Tracker -->
    ";
}
add_action('wp_footer', 'ai_seo_insert_behavior_tracker', 100);



?>