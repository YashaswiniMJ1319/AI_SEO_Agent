<?php
/**
 * Plugin Name: AI SEO Agent
 * Description: Analyzes post content using the AI SEO Agent API and provides detailed feedback.
 * Version: 0.3
 * Author: Your Name
 */

if (!defined('ABSPATH')) exit; // Exit if accessed directly.

/* ------------------------------------------------------------
 * 1️⃣ Register Meta Box
 * ------------------------------------------------------------ */
function ai_seo_register_meta_box() {
    add_meta_box(
        'ai_seo_agent_metabox',
        '🧠 AI SEO Analysis',
        'ai_seo_render_meta_box_content',
        ['post', 'page'],
        'side',
        'high'
    );
}
add_action('add_meta_boxes', 'ai_seo_register_meta_box');

/* ------------------------------------------------------------
 * 2️⃣ Render Meta Box Content
 * ------------------------------------------------------------ */
function ai_seo_render_meta_box_content($post) {
    ?>
    <div id="ai-seo-agent-wrapper">

        <!-- Controls -->
        <div id="ai-seo-controls" class="ai-seo-section">
            <label for="ai-seo-target-keyword" style="display:block;font-weight:bold;">Target Keyword:</label>
            <input type="text" id="ai-seo-target-keyword" name="ai-seo-target-keyword" value=""
                   style="width:100%;margin-bottom:5px;" placeholder="Enter focus keyword"/>
            <button type="button" id="ai-seo-analyze-button" class="button button-primary">Analyze SEO</button>
            <p id="ai-seo-status" class="status-text">Ready.</p>
        </div>

        <!-- Results Area -->
        <div id="ai-seo-results" style="display:none;">

            <!-- SEO Score -->
            <div id="ai-seo-score-section" class="ai-seo-section">
                <h4>Overall SEO Score: <span id="ai-seo-score-value">N/A</span></h4>
                <div class="score-bar-container">
                    <div id="ai-seo-score-bar" class="score-bar"></div>
                </div>
            </div>

            <!-- Collapsible Sections -->
            <?php
            $sections = [
                'keywords' => 'Keyword Analysis',
                'semantic' => 'Semantic Relevance',
                'issues' => 'Issues Found',
                'suggestions' => 'AI Suggestions',
                'links' => 'Link Analysis',
                'behavior' => 'User Behavior Insights',
                'competitors' => 'Competitor Analysis'
            ];

            foreach ($sections as $key => $label) {
                echo "
                <div id='ai-seo-{$key}-section' class='ai-seo-section collapsible closed'>
                    <button type='button' class='collapsible-trigger'>{$label} <span class='toggle-icon'>►</span></button>
                    <div class='collapsible-content'>
                        <ul id='ai-seo-{$key}'></ul>
                    </div>
                </div>";
            }
            ?>
        </div>
    </div>
    <?php
}

/* ------------------------------------------------------------
 * 3️⃣ Enqueue Scripts & Styles
 * ------------------------------------------------------------ */
function ai_seo_enqueue_scripts($hook) {
    if ($hook !== 'post.php' && $hook !== 'post-new.php') return;

    wp_enqueue_script(
        'ai-seo-script',
        plugin_dir_url(__FILE__) . 'admin/js/ai-seo-script.js',
        ['wp-data', 'wp-editor', 'wp-element', 'wp-components', 'jquery'],
        '1.3',
        true
    );

    wp_localize_script('ai-seo-script', 'aiSeoData', [
        'apiUrl' => 'http://localhost:4000/api/seo/analyze',
    ]);

    wp_enqueue_style(
        'ai-seo-styles',
        plugin_dir_url(__FILE__) . 'admin/css/ai-seo-styles.css',
        [],
        '1.2'
    );
}
add_action('admin_enqueue_scripts', 'ai_seo_enqueue_scripts');

/* ------------------------------------------------------------
 * 4️⃣ Register Yoast Meta Keys
 * ------------------------------------------------------------ */
function aiseo_register_yoast_meta_keys() {
    register_post_meta('', '_yoast_wpseo_metadesc', [
        'show_in_rest' => true,
        'single' => true,
        'type' => 'string',
        'auth_callback' => function() { return current_user_can('edit_posts'); },
    ]);
}
add_action('init', 'aiseo_register_yoast_meta_keys');

/* ------------------------------------------------------------
 * 5️⃣ Auto-Inject Behavior Tracker (Only on Live)
 * ------------------------------------------------------------ */
function ai_seo_insert_behavior_tracker() {
    if (is_admin() || is_user_logged_in()) return;

    if (did_action('ai_seo_behavior_tracker_loaded')) return;
    do_action('ai_seo_behavior_tracker_loaded');

    $current_host = $_SERVER['HTTP_HOST'];
    if (strpos($current_host, 'localhost') !== false || strpos($current_host, '127.0.0.1') !== false) return;

    $api_url = 'https://your-fastapi-server.com/api/behavior';
    $script_url = plugins_url('admin/js/behavior-tracker.js', __FILE__);

    echo "
    <!-- 🧠 AI SEO Behavior Tracker -->
    <script>window.aiSeoBehaviorData = { apiUrl: '{$api_url}' };</script>
    <script src='{$script_url}' async></script>
    <!-- End Tracker -->
    ";
}
add_action('wp_footer', 'ai_seo_insert_behavior_tracker', 100);
?>
