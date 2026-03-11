<?php
/**
 * UBITQUITY + nDAO Token Swap Tool — PHP Front Controller / API Router
 *
 * Routes all /api/* requests without .htaccess.
 * Deploy behind nginx with: try_files $uri /api/index.php;
 * Or use PHP built-in server for dev: php -S 0.0.0.0:8080 api/index.php
 *
 * No CLI dependencies. No .htaccess. Pure PHP routing.
 *
 * MIT License — (c) UBITQUITY, INC. & nDAO
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// ─── Send security headers on every request ──────────────────
send_security_headers();

// ─── Handle CORS preflight ──────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    header('Access-Control-Max-Age: 86400');
    exit;
}

// ─── Parse route ─────────────────────────────────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = '/' . trim($uri, '/');

// Strip /api prefix if present
if (str_starts_with($uri, '/api')) {
    $uri = substr($uri, 4) ?: '/';
}

$method = $_SERVER['REQUEST_METHOD'];

// ─── Route Dispatch ──────────────────────────────────────────

// Health check
if ($uri === '/health' && $method === 'GET') {
    require __DIR__ . '/routes/health.php';
    exit;
}

// CSRF token endpoint
if ($uri === '/csrf-token' && $method === 'GET') {
    require __DIR__ . '/routes/csrf.php';
    exit;
}

// Price feed (cached proxy to Alcor)
if ($uri === '/prices' && $method === 'GET') {
    if (!check_rate_limit('prices')) {
        json_error('Rate limit exceeded. Try again shortly.', 429);
    }
    require __DIR__ . '/routes/prices.php';
    exit;
}

// Audit log write
if ($uri === '/audit' && $method === 'POST') {
    if (!check_rate_limit('audit', RATE_LIMIT_MAX_AUDIT)) {
        json_error('Rate limit exceeded.', 429);
    }

    // Validate CSRF for POST
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($csrfToken !== '' && !validate_csrf_token($csrfToken)) {
        // Non-blocking — audit is best-effort from frontend
        // Still log but note the CSRF issue
        audit_log('csrf_warn', null, 'Invalid CSRF on audit POST');
    }

    require __DIR__ . '/routes/audit.php';
    exit;
}

// Audit log read (admin)
if ($uri === '/audit/log' && $method === 'GET') {
    if (!check_rate_limit('audit_read', 10)) {
        json_error('Rate limit exceeded.', 429);
    }
    require __DIR__ . '/routes/audit_read.php';
    exit;
}

// ─── 404 ─────────────────────────────────────────────────────
json_error('Not found', 404);
