<?php
/**
 * GET /api/audit/log — Read recent audit log entries
 *
 * Query params:
 *   limit  — max rows (default 50, max 200)
 *   event  — filter by event type
 *   actor  — filter by actor
 *
 * Protected by rate limiting. In production, add authentication.
 */

declare(strict_types=1);

$limit = min(max((int)($_GET['limit'] ?? 50), 1), 200);

$db = get_db();
$where = [];
$params = [];

if (!empty($_GET['event'])) {
    $event = preg_replace('/[^a-zA-Z0-9_.-]/', '', substr(trim($_GET['event']), 0, 50));
    if ($event !== '') {
        $where[] = 'event = :event';
        $params[':event'] = $event;
    }
}

if (!empty($_GET['actor'])) {
    $actor = preg_replace('/[^a-z0-9.]/', '', substr(trim($_GET['actor']), 0, 13));
    if ($actor !== '') {
        $where[] = 'actor = :actor';
        $params[':actor'] = $actor;
    }
}

$sql = "SELECT id, created_at, event, actor, detail FROM audit_log";
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY id DESC LIMIT :limit';
$params[':limit'] = $limit;

$stmt = $db->prepare($sql);
foreach ($params as $key => $val) {
    $stmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
}
$stmt->execute();

json_response([
    'entries' => $stmt->fetchAll(),
    'count'   => $stmt->rowCount(),
]);
