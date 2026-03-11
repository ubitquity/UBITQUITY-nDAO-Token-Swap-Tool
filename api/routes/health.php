<?php
/**
 * GET /api/health — Health check endpoint
 */

declare(strict_types=1);

$checks = [
    'status'   => 'ok',
    'version'  => '0.1.0',
    'php'      => PHP_VERSION,
    'sqlite'   => false,
    'time'     => gmdate('Y-m-d\TH:i:s\Z'),
];

try {
    $db = get_db();
    $row = $db->query("SELECT sqlite_version() AS v")->fetch();
    $checks['sqlite'] = $row['v'] ?? true;
} catch (\Throwable $e) {
    $checks['status'] = 'degraded';
    $checks['sqlite'] = false;
    if (APP_DEBUG) $checks['db_error'] = $e->getMessage();
}

json_response($checks);
