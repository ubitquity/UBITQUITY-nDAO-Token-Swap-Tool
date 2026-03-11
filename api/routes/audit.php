<?php
/**
 * POST /api/audit — Record an audit event
 *
 * Accepts JSON: { event: string, actor?: string, detail?: string }
 * All inputs are sanitized and length-limited before storage.
 */

declare(strict_types=1);

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input) || empty($input['event'])) {
    json_error('Missing required field: event', 400);
}

// Sanitize inputs
$event  = preg_replace('/[^a-zA-Z0-9_.-]/', '', substr(trim($input['event']), 0, 50));
$actor  = isset($input['actor']) ? preg_replace('/[^a-z0-9.]/', '', substr(trim($input['actor']), 0, 13)) : null;
$detail = isset($input['detail']) ? htmlspecialchars(substr(trim($input['detail']), 0, 500), ENT_QUOTES, 'UTF-8') : null;

if ($event === '') {
    json_error('Invalid event name', 400);
}

audit_log($event, $actor, $detail);

json_response(['ok' => true]);
