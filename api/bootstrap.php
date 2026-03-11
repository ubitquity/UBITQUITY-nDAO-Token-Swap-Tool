<?php
/**
 * UBITQUITY + nDAO Token Swap Tool — PHP Backend Bootstrap
 *
 * Initializes security headers, CSRF protection, rate limiting via SQLite,
 * and provides the database connection.
 *
 * No .htaccess required — runs via front controller (index.php).
 * No CLI dependencies — all config via PHP constants and env vars.
 *
 * MIT License — (c) UBITQUITY, INC. & nDAO
 */

declare(strict_types=1);

// ─── Error handling (production: no leak) ────────────────────
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../data/php-error.log');

// ─── Load environment config ─────────────────────────────────
$envFile = __DIR__ . '/../.env';
if (is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val, " \t\n\r\0\x0B\"'");
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $val;
            putenv("$key=$val");
        }
    }
}

// ─── Constants ───────────────────────────────────────────────
define('APP_ENV', $_ENV['APP_ENV'] ?? 'production');
define('APP_DEBUG', APP_ENV === 'development');
define('DB_PATH', __DIR__ . '/../data/swap_tool.db');
define('RATE_LIMIT_WINDOW', 60);          // seconds
define('RATE_LIMIT_MAX_REQUESTS', 60);    // per window
define('RATE_LIMIT_MAX_AUDIT', 30);       // audit writes per window
define('CSRF_TOKEN_LIFETIME', 7200);      // 2 hours
define('ALLOWED_ORIGINS', $_ENV['ALLOWED_ORIGINS'] ?? '');
define('ALCOR_API_BASE', 'https://proton.alcor.exchange/api/v2');
define('PRICE_CACHE_TTL', 15);            // seconds

// ─── Security Headers ───────────────────────────────────────
function send_security_headers(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://proton.alcor.exchange https://proton.greymass.com https://xpr.eosusa.io https://api.protonnz.com https://explorer.xprnetwork.org; img-src 'self' data:; frame-ancestors 'none'");

    // CORS
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (ALLOWED_ORIGINS !== '') {
        $allowed = array_map('trim', explode(',', ALLOWED_ORIGINS));
        if (in_array($origin, $allowed, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        }
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
}

// ─── SQLite Connection (singleton) ───────────────────────────
function get_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dir = dirname(DB_PATH);
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // WAL mode for concurrent reads
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA foreign_keys=ON');
    $pdo->exec('PRAGMA busy_timeout=5000');

    // Auto-migrate schema
    migrate_schema($pdo);

    return $pdo;
}

// ─── Schema Migration ────────────────────────────────────────
function migrate_schema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            ip_hash     TEXT NOT NULL,
            event       TEXT NOT NULL,
            actor       TEXT DEFAULT NULL,
            detail      TEXT DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_event   ON audit_log(event);
        CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor);

        CREATE TABLE IF NOT EXISTS rate_limits (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_hash     TEXT NOT NULL,
            endpoint    TEXT NOT NULL,
            window_start INTEGER NOT NULL,
            request_count INTEGER NOT NULL DEFAULT 1,
            UNIQUE(ip_hash, endpoint, window_start)
        );

        CREATE INDEX IF NOT EXISTS idx_rate_ip ON rate_limits(ip_hash, endpoint);

        CREATE TABLE IF NOT EXISTS csrf_tokens (
            token       TEXT PRIMARY KEY,
            ip_hash     TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            used        INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_csrf_created ON csrf_tokens(created_at);

        CREATE TABLE IF NOT EXISTS price_cache (
            cache_key   TEXT PRIMARY KEY,
            data        TEXT NOT NULL,
            cached_at   INTEGER NOT NULL
        );
    ");
}

// ─── IP Hashing (privacy-preserving) ─────────────────────────
function get_ip_hash(): string {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_X_REAL_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '0.0.0.0';
    // Take first IP if comma-separated
    $ip = trim(explode(',', $ip)[0]);
    // Salt + hash for privacy
    $salt = $_ENV['IP_HASH_SALT'] ?? 'ubitquity-ndao-swap-2024';
    return hash('sha256', $salt . $ip);
}

// ─── Rate Limiting ───────────────────────────────────────────
function check_rate_limit(string $endpoint, int $maxRequests = RATE_LIMIT_MAX_REQUESTS): bool {
    $db = get_db();
    $ipHash = get_ip_hash();
    $window = intdiv(time(), RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW;

    // Upsert counter
    $stmt = $db->prepare("
        INSERT INTO rate_limits (ip_hash, endpoint, window_start, request_count)
        VALUES (:ip, :ep, :ws, 1)
        ON CONFLICT(ip_hash, endpoint, window_start)
        DO UPDATE SET request_count = request_count + 1
    ");
    $stmt->execute([':ip' => $ipHash, ':ep' => $endpoint, ':ws' => $window]);

    // Check count
    $stmt = $db->prepare("
        SELECT request_count FROM rate_limits
        WHERE ip_hash = :ip AND endpoint = :ep AND window_start = :ws
    ");
    $stmt->execute([':ip' => $ipHash, ':ep' => $endpoint, ':ws' => $window]);
    $row = $stmt->fetch();

    if ($row && (int)$row['request_count'] > $maxRequests) {
        return false; // rate limited
    }

    // Cleanup old windows (probabilistic — 5% of requests)
    if (mt_rand(1, 20) === 1) {
        $cutoff = time() - (RATE_LIMIT_WINDOW * 2);
        $db->prepare("DELETE FROM rate_limits WHERE window_start < :cutoff")
           ->execute([':cutoff' => $cutoff]);
    }

    return true;
}

// ─── CSRF Token Management ───────────────────────────────────
function generate_csrf_token(): string {
    $token = bin2hex(random_bytes(32));
    $db = get_db();

    $stmt = $db->prepare("
        INSERT INTO csrf_tokens (token, ip_hash, created_at) VALUES (:token, :ip, :ts)
    ");
    $stmt->execute([
        ':token' => hash('sha256', $token),
        ':ip'    => get_ip_hash(),
        ':ts'    => time(),
    ]);

    // Cleanup expired tokens (probabilistic)
    if (mt_rand(1, 10) === 1) {
        $cutoff = time() - CSRF_TOKEN_LIFETIME;
        $db->prepare("DELETE FROM csrf_tokens WHERE created_at < :cutoff")
           ->execute([':cutoff' => $cutoff]);
    }

    return $token;
}

function validate_csrf_token(string $token): bool {
    if (strlen($token) < 32) return false;

    $db = get_db();
    $hashed = hash('sha256', $token);
    $cutoff = time() - CSRF_TOKEN_LIFETIME;

    $stmt = $db->prepare("
        SELECT token FROM csrf_tokens
        WHERE token = :token AND ip_hash = :ip AND created_at > :cutoff AND used = 0
    ");
    $stmt->execute([
        ':token'  => $hashed,
        ':ip'     => get_ip_hash(),
        ':cutoff' => $cutoff,
    ]);

    if (!$stmt->fetch()) return false;

    // Mark used (single-use for POST)
    $db->prepare("UPDATE csrf_tokens SET used = 1 WHERE token = :token")
       ->execute([':token' => $hashed]);

    return true;
}

// ─── Audit Logger ────────────────────────────────────────────
function audit_log(string $event, ?string $actor = null, ?string $detail = null): void {
    try {
        $db = get_db();
        $stmt = $db->prepare("
            INSERT INTO audit_log (ip_hash, event, actor, detail)
            VALUES (:ip, :event, :actor, :detail)
        ");
        $stmt->execute([
            ':ip'     => get_ip_hash(),
            ':event'  => substr($event, 0, 50),
            ':actor'  => $actor ? substr($actor, 0, 13) : null,
            ':detail' => $detail ? substr($detail, 0, 500) : null,
        ]);
    } catch (\Throwable $e) {
        error_log("Audit log failed: " . $e->getMessage());
    }
}

// ─── JSON Response Helpers ───────────────────────────────────
function json_response(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never {
    json_response(['error' => $message], $status);
}
