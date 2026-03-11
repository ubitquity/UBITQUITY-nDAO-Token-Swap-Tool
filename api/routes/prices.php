<?php
/**
 * GET /api/prices — Cached proxy to Alcor Exchange API
 *
 * Prevents direct client exposure to external API, adds caching via SQLite,
 * and enforces rate limits. Prices are cached for PRICE_CACHE_TTL seconds.
 */

declare(strict_types=1);

// ─── Token definitions (mirror frontend) ─────────────────────
$tokens = [
    ['symbol' => 'UBQT',    'alcorId' => 'ubqt-ubitquityllc'],
    ['symbol' => 'UBQTX',   'alcorId' => 'ubqtx-tokencreate'],
    ['symbol' => 'TITLET',  'alcorId' => 'titlet-tokencreate'],
    ['symbol' => 'NDAO',    'alcorId' => 'ndao-tokencreate'],
    ['symbol' => 'NDAOX',   'alcorId' => 'ndaox-tokencreate'],
    ['symbol' => 'DEED',    'alcorId' => 'deed-tokencreate'],
    ['symbol' => 'AETHERT', 'alcorId' => 'aethert-tokencreate'],
    ['symbol' => 'GAMES',   'alcorId' => 'games-tokencreate'],
    ['symbol' => 'BEATS',   'alcorId' => 'beats-tokencreate'],
    ['symbol' => 'CAUDIT',  'alcorId' => 'caudit-tokencreate'],
];

// ─── Check cache ─────────────────────────────────────────────
$db = get_db();
$cacheKey = 'all_prices';
$now = time();

$stmt = $db->prepare("SELECT data, cached_at FROM price_cache WHERE cache_key = :key");
$stmt->execute([':key' => $cacheKey]);
$cached = $stmt->fetch();

if ($cached && ($now - (int)$cached['cached_at']) < PRICE_CACHE_TTL) {
    $data = json_decode($cached['data'], true);
    if ($data) {
        json_response([
            'prices'  => $data,
            'cached'  => true,
            'age'     => $now - (int)$cached['cached_at'],
            'max_age' => PRICE_CACHE_TTL,
        ]);
    }
}

// ─── Fetch from Alcor ────────────────────────────────────────
$results = [];
$xprUsdRate = null;

// Fetch XPR/USD rate first
$xprData = alcor_fetch('xpr-eosio.token');
if ($xprData && isset($xprData['usd_price']) && $xprData['usd_price'] > 0) {
    $xprUsdRate = (float)$xprData['usd_price'];
}

// Fetch all token prices
foreach ($tokens as $token) {
    $data = alcor_fetch($token['alcorId']);
    if ($data) {
        $systemPrice = (isset($data['system_price']) && $data['system_price'] > 0)
            ? (float)$data['system_price'] : null;
        $usdPrice = (isset($data['usd_price']) && $data['usd_price'] > 0)
            ? (float)$data['usd_price'] : null;

        $derived = false;
        if ($usdPrice === null && $systemPrice !== null && $xprUsdRate !== null) {
            $usdPrice = $systemPrice * $xprUsdRate;
            $derived = true;
        }

        $results[$token['symbol']] = [
            'system_price' => $systemPrice,
            'usd_price'    => $usdPrice,
            'usd_derived'  => $derived,
            'loaded'       => true,
            'error'        => false,
        ];
    } else {
        $results[$token['symbol']] = [
            'system_price' => null,
            'usd_price'    => null,
            'loaded'       => true,
            'error'        => true,
        ];
    }
}

// ─── Update cache ────────────────────────────────────────────
$stmt = $db->prepare("
    INSERT INTO price_cache (cache_key, data, cached_at) VALUES (:key, :data, :ts)
    ON CONFLICT(cache_key) DO UPDATE SET data = :data, cached_at = :ts
");
$stmt->execute([
    ':key'  => $cacheKey,
    ':data' => json_encode($results),
    ':ts'   => $now,
]);

json_response([
    'prices'  => $results,
    'cached'  => false,
    'age'     => 0,
    'max_age' => PRICE_CACHE_TTL,
]);

// ─── Alcor fetch helper ──────────────────────────────────────
function alcor_fetch(string $tokenId): ?array {
    $url = ALCOR_API_BASE . '/tokens/' . urlencode($tokenId);

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => 5,
            'header'  => "Accept: application/json\r\nUser-Agent: UBITQUITY-nDAO-SwapTool/0.1\r\n",
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) return null;

    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}
