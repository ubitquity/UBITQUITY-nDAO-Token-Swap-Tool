<?php
/**
 * GET /api/csrf-token — Generate a CSRF token
 */

declare(strict_types=1);

if (!check_rate_limit('csrf', 20)) {
    json_error('Rate limit exceeded.', 429);
}

$token = generate_csrf_token();
json_response(['token' => $token]);
