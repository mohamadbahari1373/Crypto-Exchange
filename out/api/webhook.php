<?php
declare(strict_types=1);

const WEBHOOK_LOG_LIMIT = 60;

function set_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, x-webhook-secret, X-Client');
}

function send_json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function log_file_path(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'didehbon-webhook-' . hash('sha256', __DIR__) . '.json';
}

function update_logs(callable $callback): array
{
    $handle = @fopen(log_file_path(), 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return [null, []];
    }

    rewind($handle);
    $decoded = json_decode((string) stream_get_contents($handle), true);
    $logs = is_array($decoded) ? $decoded : [];
    $result = $callback($logs);

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($logs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    return [$result, $logs];
}

function request_headers(): array
{
    $headers = [];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() ?: [] as $name => $value) {
            $headers[strtolower((string) $name)] = (string) $value;
        }
    }

    foreach ($_SERVER as $name => $value) {
        if (strncmp($name, 'HTTP_', 5) === 0) {
            $headerName = strtolower(str_replace('_', '-', substr($name, 5)));
            $headers[$headerName] = (string) $value;
        }
    }

    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
    }

    return $headers;
}

function request_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        return $decoded;
    }

    return $raw;
}

function query_params(): array
{
    $query = [];
    foreach ($_GET as $key => $value) {
        $query[(string) $key] = is_scalar($value) ? (string) $value : json_encode($value);
    }
    return $query;
}

function make_log(string $method, $body = null): array
{
    $headers = request_headers();
    $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api/webhook.php');

    return [
        'id' => 'req-' . (string) round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(3)),
        'method' => $method,
        'url' => $requestUri,
        'timestamp' => date('h:i:s A'),
        'receivedAt' => (int) round(microtime(true) * 1000),
        'headers' => $headers,
        'query' => query_params(),
        'body' => $body,
        'ip' => (string) ($headers['x-forwarded-for'] ?? $headers['x-real-ip'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
        'userAgent' => (string) ($headers['user-agent'] ?? 'Unknown'),
        'contentType' => (string) ($headers['content-type'] ?? 'none'),
    ];
}

function record_request(string $method, $body = null): array
{
    $entry = make_log($method, $body);
    update_logs(static function (&$logs) use ($entry): void {
        array_unshift($logs, $entry);
        $logs = array_slice($logs, 0, WEBHOOK_LOG_LIMIT);
    });
    return $entry;
}

set_cors_headers();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$query = query_params();

if ($method === 'OPTIONS') {
    record_request('OPTIONS');
    header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    http_response_code(204);
    exit;
}

if ($method === 'GET') {
    if (($query['logs'] ?? '') === '1' || ($query['action'] ?? '') === 'logs') {
        [, $logs] = update_logs(static function (&$logs): void {});
        send_json(['success' => true, 'count' => count($logs), 'logs' => $logs]);
    }

    if (($query['clear'] ?? '') === '1' || ($query['action'] ?? '') === 'clear') {
        [, $logs] = update_logs(static function (&$logs): void { $logs = []; });
        send_json(['success' => true, 'message' => 'All webhook logs cleared successfully', 'logs' => $logs]);
    }

    $entry = record_request('GET');
    send_json([
        'success' => true,
        'message' => 'Incoming GET API request received and logged successfully',
        'requestId' => $entry['id'],
        'timestamp' => $entry['timestamp'],
        'queryReceived' => $entry['query'],
        'status' => 200,
    ]);
}

if ($method === 'POST') {
    if (($query['action'] ?? '') === 'clear') {
        update_logs(static function (&$logs): void { $logs = []; });
        send_json(['success' => true, 'message' => 'Logs cleared']);
    }

    $body = request_body();
    $entry = record_request('POST', $body);
    send_json([
        'success' => true,
        'message' => 'Incoming POST API request / webhook payload received successfully',
        'requestId' => $entry['id'],
        'timestamp' => $entry['timestamp'],
        'payloadReceived' => $body,
        'status' => 201,
    ], 201);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $body = request_body();
    $entry = record_request($method, $body);
    send_json([
        'success' => true,
        'message' => $method === 'PUT'
            ? 'Incoming PUT API request received and resource updated/logged'
            : 'Incoming PATCH API request received and partially applied',
        'requestId' => $entry['id'],
        'timestamp' => $entry['timestamp'],
        'payloadReceived' => $body,
        'status' => 200,
    ]);
}

if ($method === 'DELETE') {
    if (($query['all'] ?? '') === 'true' || ($query['logs'] ?? '') === '1') {
        [, $logs] = update_logs(static function (&$logs): void { $logs = []; });
        send_json(['success' => true, 'message' => 'All webhook history deleted successfully', 'count' => count($logs)]);
    }

    if (isset($query['id'])) {
        $targetId = $query['id'];
        [, $logs] = update_logs(static function (&$logs) use ($targetId): void {
            $logs = array_values(array_filter($logs, static function ($log) use ($targetId): bool {
                return ($log['id'] ?? null) !== $targetId;
            }));
        });
        send_json(['success' => true, 'message' => 'Request ' . $targetId . ' deleted', 'remainingCount' => count($logs)]);
    }

    $entry = record_request('DELETE');
    send_json([
        'success' => true,
        'message' => 'Incoming DELETE API request processed and logged',
        'requestId' => $entry['id'],
        'timestamp' => $entry['timestamp'],
        'status' => 200,
    ]);
}

if ($method === 'HEAD') {
    record_request('HEAD');
    [, $logs] = update_logs(static function (&$logs): void {});
    header('X-Webhook-Service: Wallex-Crypto-News-API');
    header('X-Logged-Count: ' . count($logs));
    http_response_code(200);
    exit;
}

header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
send_json(['success' => false, 'message' => 'Method not allowed'], 405);