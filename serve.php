<?php
/**
 * UBITQUITY + nDAO Token Swap Tool — Production Entry Point
 *
 * Serves the Vite-built frontend and routes /api/* to the PHP backend.
 * No .htaccess required — configure your web server to route all requests here,
 * or use the nginx config provided.
 *
 * Usage with PHP built-in server (development):
 *   php -S 0.0.0.0:8080 serve.php
 *
 * Usage with nginx (production):
 *   See deploy/nginx.conf
 *
 * MIT License — (c) UBITQUITY, INC. & nDAO
 */

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = '/' . trim($uri, '/');

// ─── Route /api/* to PHP backend ─────────────────────────────
if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    exit;
}

// ─── Serve static files from dist/ ──────────────────────────
$distDir = __DIR__ . '/dist';

// Map URI to file in dist/
$filePath = $distDir . $uri;

// If exact file exists, serve it
if ($uri !== '/' && is_file($filePath)) {
    // Set proper content types
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeTypes = [
        'html' => 'text/html',
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'json' => 'application/json',
        'svg'  => 'image/svg+xml',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'ico'  => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2'=> 'font/woff2',
        'ttf'  => 'font/ttf',
        'map'  => 'application/json',
    ];

    $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';
    header("Content-Type: $contentType");

    // Cache hashed assets aggressively, HTML never
    if (preg_match('/\.[a-f0-9]{8,}\.(js|css|svg|png|jpg|woff2?)$/', $uri)) {
        header('Cache-Control: public, max-age=31536000, immutable');
    } else {
        header('Cache-Control: no-cache, must-revalidate');
    }

    // Security headers for all responses
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');

    // For PHP built-in server, return false to let it handle static files
    if (PHP_SAPI === 'cli-server') {
        return false;
    }

    readfile($filePath);
    exit;
}

// ─── SPA fallback: serve index.html ──────────────────────────
$indexPath = $distDir . '/index.html';

if (!is_file($indexPath)) {
    http_response_code(503);
    echo '<!DOCTYPE html><html><head><title>Service Unavailable</title></head>';
    echo '<body style="background:#0D0F13;color:#E5E7EB;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">';
    echo '<div style="text-align:center"><h1>Service Unavailable</h1><p>Run <code>npm run build</code> to generate the frontend.</p></div>';
    echo '</body></html>';
    exit;
}

// Inject CSRF token into HTML
require_once __DIR__ . '/api/bootstrap.php';
$csrfToken = generate_csrf_token();

$html = file_get_contents($indexPath);
$html = str_replace(
    '<meta name="csrf-token" content="">',
    '<meta name="csrf-token" content="' . htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') . '">',
    $html
);

// Security headers
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://proton.alcor.exchange https://proton.greymass.com https://xpr.eosusa.io https://api.protonnz.com https://explorer.xprnetwork.org; img-src 'self' data:; frame-ancestors 'none'");

echo $html;
