<?php
ini_set('display_errors', '0');
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function sort_signals(&$signals) {
    usort($signals, function ($left, $right) {
        return (strtotime($right['createdAt'] ?? '') ?: 0) <=> (strtotime($left['createdAt'] ?? '') ?: 0);
    });
    $signals = array_slice($signals, 0, 300);
}

function timestamp_ms($value) {
    try {
        $date = new DateTimeImmutable((string)$value);
        return ((int)$date->format('U') * 1000) + (int)substr($date->format('u'), 0, 3);
    } catch (Exception $error) {
        $timestamp = strtotime((string)$value);
        return $timestamp === false ? 0 : $timestamp * 1000;
    }
}

function with_signal_store($operation) {
    $paths = array_unique(array(
        __DIR__ . '/didehbon_signals_log.json',
        rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'didehbon_signals_log.json',
    ));

    foreach ($paths as $path) {
        $handle = @fopen($path, 'c+');
        if ($handle === false) {
            continue;
        }
        if (!@flock($handle, LOCK_EX)) {
            fclose($handle);
            continue;
        }

        rewind($handle);
        $raw = stream_get_contents($handle);
        $signals = json_decode($raw ?: '[]', true);
        if (!is_array($signals)) {
            $signals = array();
        }
        $result = $operation($signals);

        if (!empty($result['write'])) {
            $signals = $result['signals'];
            sort_signals($signals);
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($signals, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));
            fflush($handle);
        }

        flock($handle, LOCK_UN);
        fclose($handle);
        return $result['response'];
    }

    return null;
}

function read_request_json() {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw ?: '', true);
    return is_array($payload) ? $payload : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = with_signal_store(function ($signals) {
        sort_signals($signals);
        return array(
            'signals' => $signals,
            'response' => array('success' => true, 'signals' => $signals),
            'write' => false,
        );
    });
    if ($response === null) {
        respond(500, array('success' => false, 'error' => 'Signal history storage is unavailable.'));
    }
    respond(200, $response);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST, OPTIONS');
    respond(405, array('success' => false, 'error' => 'Method not allowed.'));
}

$payload = read_request_json();
if ($payload === null) {
    respond(400, array('success' => false, 'error' => 'Invalid JSON payload.'));
}

$action = $payload['action'] ?? '';
if ($action === 'create') {
    $record = $payload['signal'] ?? null;
    if (!is_array($record)) {
        respond(400, array('success' => false, 'error' => 'Signal record is required.'));
    }

    $symbol = strtoupper(trim((string)($record['symbol'] ?? '')));
    $direction = $record['direction'] ?? '';
    $id = trim((string)($record['id'] ?? ''));
    $createdAt = (string)($record['createdAt'] ?? gmdate('c'));
    $createdTimestamp = strtotime($createdAt);
    $valid = preg_match('/^[A-Z0-9._-]{1,24}$/', $symbol)
        && strlen($id) > 0
        && strlen($id) <= 120
        && is_string($record['nameFa'] ?? null)
        && is_string($record['persianDate'] ?? null)
        && is_string($record['persianTime'] ?? null)
        && in_array($direction, array('bullish', 'bearish'), true)
        && is_numeric($record['predictedUsdtPct'] ?? null)
        && is_numeric($record['confidencePct'] ?? null)
        && is_numeric($record['entryPriceUsdt'] ?? null)
        && is_numeric($record['targetPriceUsdt'] ?? null)
        && in_array($record['guaranteeTier'] ?? '', array('gold', 'high', 'medium'), true)
        && in_array($record['status'] ?? '', array('pending'), true)
        && $createdTimestamp !== false
        && (float)$record['entryPriceUsdt'] > 0
        && (float)$record['targetPriceUsdt'] > 0;
    if (!$valid) {
        respond(400, array('success' => false, 'error' => 'Invalid signal record.'));
    }

    $record['symbol'] = $symbol;
    $record['createdAt'] = gmdate('c', $createdTimestamp);
    $record['status'] = 'pending';
    $record['resolvedAt'] = null;
    $record['id'] = $id;
    $record['updatedAt'] = $record['createdAt'];
    $record['currentPriceUsdt'] = (float)$record['entryPriceUsdt'];
    $record['actualMovePct'] = 0;
    $record['realizedGoalPct'] = 0;

    $response = with_signal_store(function ($signals) use ($record, $symbol, $direction, $createdTimestamp) {
        foreach ($signals as $existing) {
            if (($existing['id'] ?? '') === $record['id']) {
                return array(
                    'signals' => $signals,
                    'response' => array('success' => true, 'duplicate' => true, 'signal' => $existing),
                    'write' => false,
                );
            }
            $existingTime = strtotime($existing['createdAt'] ?? '') ?: 0;
            if (
                strtoupper((string)($existing['symbol'] ?? '')) === $symbol
                && ($existing['direction'] ?? '') === $direction
                && abs($createdTimestamp - $existingTime) < 7200
            ) {
                return array(
                    'signals' => $signals,
                    'response' => array('success' => true, 'duplicate' => true, 'signal' => $existing),
                    'write' => false,
                );
            }
        }
        array_unshift($signals, $record);
        sort_signals($signals);
        return array(
            'signals' => $signals,
            'response' => array('success' => true, 'duplicate' => false, 'signal' => $record),
            'write' => true,
        );
    });

    if ($response === null) {
        respond(500, array('success' => false, 'error' => 'Signal history storage is unavailable.'));
    }
    respond(200, $response);
}

if ($action === 'resolve') {
    $updates = $payload['signals'] ?? null;
    if (!is_array($updates)) {
        respond(400, array('success' => false, 'error' => 'Signal resolutions are required.'));
    }
    $normalizedUpdates = array();
    foreach ($updates as $update) {
        if (!is_array($update)) {
            continue;
        }
        $status = $update['status'] ?? '';
        $id = trim((string)($update['id'] ?? ''));
        if ($id === '') {
            continue;
        }
        $normalized = array('updatedAt' => gmdate('c', strtotime((string)($update['updatedAt'] ?? '')) ?: time()));
        if (array_key_exists('resolvedAt', $update)) {
            if ($update['resolvedAt'] === null) {
                $normalized['resolvedAt'] = null;
            } elseif (is_numeric($update['resolvedAt'])) {
                $normalized['resolvedAt'] = (int)$update['resolvedAt'];
            } else {
                $resolvedTimestamp = strtotime((string)$update['resolvedAt']);
                if ($resolvedTimestamp !== false) {
                    $normalized['resolvedAt'] = $resolvedTimestamp * 1000;
                }
            }
        }
        foreach (array('currentPriceUsdt', 'actualMovePct', 'realizedGoalPct') as $metric) {
            if (array_key_exists($metric, $update) && is_numeric($update[$metric]) && is_finite((float)$update[$metric])) {
                $normalized[$metric] = (float)$update[$metric];
            }
        }
        foreach (array('resolvedPersianDate', 'resolvedPersianTime') as $dateField) {
            if (array_key_exists($dateField, $update) && ($update[$dateField] === null || is_string($update[$dateField]))) {
                $normalized[$dateField] = $update[$dateField];
            }
        }
        if (array_key_exists('durationMinutes', $update) && $update['durationMinutes'] === null) {
            $normalized['durationMinutes'] = null;
        } elseif (isset($update['durationMinutes']) && is_numeric($update['durationMinutes']) && is_finite((float)$update['durationMinutes'])) {
            $normalized['durationMinutes'] = max(1, (int)$update['durationMinutes']);
        }
        if (array_key_exists('realizedWindow', $update) && $update['realizedWindow'] === null) {
            $normalized['realizedWindow'] = null;
        } elseif (in_array($update['realizedWindow'] ?? '', array('1 ساعته', '2 ساعته', '3 ساعته', '4 ساعته'), true)) {
            $normalized['realizedWindow'] = $update['realizedWindow'];
        }
        if (array_key_exists('realizedLabel', $update) && ($update['realizedLabel'] === null || is_string($update['realizedLabel']))) {
            $normalized['realizedLabel'] = $update['realizedLabel'];
        }
        if (in_array($status, array('success', 'failed', 'pending'), true)) {
            $normalized['status'] = $status;
            if ($status !== 'pending' && !isset($normalized['resolvedAt'])) {
                $normalized['resolvedAt'] = (int)(microtime(true) * 1000);
            }
        }
        if (count($normalized) > 1 || isset($normalized['status'])) {
            $normalizedUpdates[$id] = $normalized;
        }
    }

    $response = with_signal_store(function ($signals) use ($normalizedUpdates) {
        $updated = array();
        foreach ($signals as &$signal) {
            $id = $signal['id'] ?? '';
            if (!isset($normalizedUpdates[$id])) {
                continue;
            }
            $update = $normalizedUpdates[$id];
            foreach (array('currentPriceUsdt', 'actualMovePct', 'realizedGoalPct') as $metric) {
                if (array_key_exists($metric, $update) && $update[$metric] !== null) {
                    $signal[$metric] = $update[$metric];
                }
            }
            foreach (array('resolvedPersianDate', 'resolvedPersianTime', 'durationMinutes', 'realizedWindow') as $completionField) {
                if (array_key_exists($completionField, $update)) $signal[$completionField] = $update[$completionField];
            }
            if (array_key_exists('realizedLabel', $update)) {
                $signal['realizedLabel'] = $update['realizedLabel'];
            }
            $requestedStatus = $update['status'] ?? null;
            $createdTimestampMs = timestamp_ms($signal['createdAt'] ?? '');
            $elapsedMs = (microtime(true) * 1000) - $createdTimestampMs;
            if (
                $requestedStatus === 'pending'
                && ($signal['status'] ?? '') === 'failed'
                && $elapsedMs < 240 * 60 * 1000
            ) {
                $signal['status'] = 'pending';
                $signal['resolvedAt'] = null;
                $signal['resolvedPersianDate'] = null;
                $signal['resolvedPersianTime'] = null;
                $signal['durationMinutes'] = null;
                $signal['realizedWindow'] = null;
            } elseif (
                $requestedStatus === 'success'
                && ($signal['status'] ?? '') === 'pending'
                && $elapsedMs <= 240 * 60 * 1000
            ) {
                $signal['status'] = 'success';
                if (array_key_exists('resolvedAt', $update)) $signal['resolvedAt'] = $update['resolvedAt'];
            } elseif (
                $requestedStatus === 'failed'
                && ($signal['status'] ?? '') === 'pending'
                && $elapsedMs >= 240 * 60 * 1000
            ) {
                $signal['status'] = 'failed';
                if (array_key_exists('resolvedAt', $update)) $signal['resolvedAt'] = $update['resolvedAt'];
            }
            $signal['updatedAt'] = $update['updatedAt'];
            $updated[] = $signal;
        }
        unset($signal);
        return array(
            'signals' => $signals,
            'response' => array('success' => true, 'signals' => $updated),
            'write' => count($updated) > 0,
        );
    });

    if ($response === null) {
        respond(500, array('success' => false, 'error' => 'Signal history storage is unavailable.'));
    }
    respond(200, $response);
}

respond(400, array('success' => false, 'error' => 'Unknown action.'));
