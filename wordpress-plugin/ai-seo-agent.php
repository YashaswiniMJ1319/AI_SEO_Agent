<?php
/**
 * Plugin Name: AI SEO Agent
 * Description: Analyzes post content using the AI SEO Agent API.
 * Version: 0.2
 * Author: Your Name
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// 1. Add the Meta Box
function ai_seo_register_meta_box() {
    add_meta_box(
        'ai_seo_agent_metabox',
        'AI SEO Analysis',
        'ai_seo_render_meta_box_content',
        ['post', 'page'],
        'side',
        'high'
    );
}
add_action( 'add_meta_boxes', 'ai_seo_register_meta_box' );

// 2. Render Meta Box HTML
function ai_seo_render_meta_box_content( $post ) {
    ?>
    <div id="ai-seo-controls">
        <p>
            <label for="ai-seo-target-keyword">Target Keyword:</label>
            <input type="text" id="ai-seo-target-keyword" name="ai-seo-target-keyword" value="" style="width: 100%; margin-bottom: 5px;" placeholder="Optional keyword"/>
        </p>
        <button type="button" id="ai-seo-analyze-button" class="button button-primary">Analyze SEO</button>
    </div>
    <hr>
    <div id="ai-seo-results">
        <p id="ai-seo-status" style="font-style: italic; color: #555;">Ready.</p>
        <div id="ai-seo-score" style="font-weight: bold; margin-bottom: 5px; font-size: 1.1em;"></div>

        <div id="ai-seo-issues-container" style="margin-top: 10px; display: none;">
             <h4 style="margin-bottom: 3px; font-size: 1em;">Issues:</h4>
             <ul id="ai-seo-issues" style="list-style: disc; margin-left: 20px; font-size: 0.9em;"></ul>
        </div>

         <div id="ai-seo-suggestions-container" style="margin-top: 10px; display: none;">
            <h4 style="margin-bottom: 3px; font-size: 1em;">Suggestions:</h4>
            <ul id="ai-seo-suggestions" style="list-style: disc; margin-left: 20px; font-size: 0.9em;"></ul>
        </div>

        <div id="ai-seo-keywords" style="margin-top: 10px; display: none;">
             <h4 style="margin-bottom: 3px; font-size: 1em;">Keyword Analysis:</h4>
             <div id="ai-seo-keyword-details" style="font-size: 0.9em;"></div>
        </div>
    </div>
    <?php
}

// 3. Enqueue Scripts and Styles
function ai_seo_enqueue_scripts( $hook ) {
    if ( 'post.php' != $hook && 'post-new.php' != $hook ) {
        return;
    }
    wp_enqueue_script(
        'ai-seo-script',
        plugin_dir_url( __FILE__ ) . 'admin/js/ai-seo-script.js',
        array( 'wp-data', 'wp-editor', 'wp-element', 'jquery' ), // Added wp-element
        '1.1', // Incremented version
        true
    );

    // Pass data to script
    wp_localize_script( 'ai-seo-script', 'aiSeoData', array(
        'apiUrl' => 'http://localhost:4000/api/seo/analyze',
        // 'apiKey' => 'YOUR_STATIC_API_KEY' // If using API key
        // Add nonce here if needed later for WP AJAX actions
        // 'nonce' => wp_create_nonce( 'wp_rest' )
    ));

    // Enqueue CSS
    wp_enqueue_style(
        'ai-seo-styles',
        plugin_dir_url( __FILE__ ) . 'admin/css/ai-seo-styles.css',
        array(),
        '1.0'
    );
}
add_action( 'admin_enqueue_scripts', 'ai_seo_enqueue_scripts' );

?>