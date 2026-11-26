<?php

declare(strict_types=1);

/**
 * DevBatista — captura de e-mail da landing page do e-book.
 *
 * Aceita apenas POST com JSON contendo o e-mail. Valida, grava e repassa
 * ao Admin DevBatista, que é quem envia o e-book por e-mail. A resposta ao
 * visitante depende do Admin ter aceitado o pedido (ver ebook_deliver()).
 *
 * Compartilha configuração, armazenamento e cliente HTTP com o endpoint
 * do diagnóstico (leads-config.php). O Admin fica desligado por padrão —
 * ver api/config.example.php.
 */

// Nunca vazar stack trace para o cliente.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: strict-origin-when-cross-origin');

require_once __DIR__ . '/leads-config.php';

// ============================================================
// Limites
// ============================================================
const EBOOK_MAX_BODY_BYTES = 4096;   // 4 KB: o payload é um e-mail e o tracking
const EBOOK_MAX_EMAIL = 160;
const EBOOK_MAX_SOURCE = 80;
const EBOOK_MAX_TRACKING = 255;
const EBOOK_MIN_ELAPSED_MS = 1200;   // abaixo disso ninguém digitou um e-mail

const EBOOK_TRACKING_FIELDS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'msclkid', 'landing_page', 'referrer', 'page',
];

// ============================================================
// Resposta
// ============================================================
function ebook_respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ebook_fail(int $status, string $code, string $message): void
{
    ebook_respond($status, ['ok' => false, 'error' => ['code' => $code, 'message' => $message]]);
}


// ============================================================
// Entrada
// ============================================================
function ebook_client_ip(): string
{
    $candidates = [$_SERVER['HTTP_CF_CONNECTING_IP'] ?? '', $_SERVER['REMOTE_ADDR'] ?? ''];
    foreach ($candidates as $ip) {
        if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

function ebook_read_json_body(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > EBOOK_MAX_BODY_BYTES) {
        ebook_fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $raw = file_get_contents('php://input', false, null, 0, EBOOK_MAX_BODY_BYTES + 1);
    if ($raw === false || $raw === '') {
        ebook_fail(400, 'empty_body', 'Corpo da requisição vazio.');
    }
    if (strlen($raw) > EBOOK_MAX_BODY_BYTES) {
        ebook_fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $data = json_decode($raw, true, 6);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        ebook_fail(400, 'invalid_json', 'JSON inválido.');
    }

    return $data;
}

function ebook_clean($value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }

    // Remove controles (inclusive quebras de linha) e normaliza espaços.
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $value) ?? '';
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

    return function_exists('mb_substr')
        ? mb_substr($text, 0, $maxLength, 'UTF-8')
        : substr($text, 0, $maxLength);
}

function ebook_normalize(array $input): array
{
    $tracking = [];
    $rawTracking = is_array($input['tracking'] ?? null) ? $input['tracking'] : [];
    foreach (EBOOK_TRACKING_FIELDS as $field) {
        $value = ebook_clean($rawTracking[$field] ?? '', EBOOK_MAX_TRACKING);
        if ($value !== '') {
            $tracking[$field] = $value;
        }
    }

    $meta = is_array($input['meta'] ?? null) ? $input['meta'] : [];

    return [
        'email' => strtolower(ebook_clean($input['email'] ?? '', EBOOK_MAX_EMAIL)),
        'source' => ebook_clean($input['source'] ?? 'ebook', EBOOK_MAX_SOURCE),
        'tracking' => $tracking,
        'honeypot' => ebook_clean($input['website'] ?? '', 50),
        'elapsed_ms' => (int) ($meta['elapsed_ms'] ?? 0),
        'page_url' => ebook_clean($meta['page_url'] ?? '', 500),
    ];
}

// ============================================================
// Rate limiting — janela deslizante por IP, em arquivo.
// Contador próprio: o formulário do e-book não consome a cota do
// diagnóstico e vice-versa.
// ============================================================
function ebook_rate_limit(string $ip): bool
{
    $config = lead_config();
    if (!$config['rate_limit_enabled']) {
        return true;
    }

    $dir = storage_dir('ratelimit');
    if ($dir === null) {
        return true; // sem storage não bloqueia o lead
    }

    $file = $dir . '/ebook-' . hash('sha256', $ip) . '.json';
    $now = time();
    $window = (int) $config['rate_limit_window'];
    $max = (int) $config['rate_limit_max'];

    $hits = [];
    if (is_readable($file)) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (is_array($decoded)) {
            $hits = array_values(array_filter($decoded, static fn($ts) => is_int($ts) && ($now - $ts) < $window));
        }
    }

    if (count($hits) >= $max) {
        return false;
    }

    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);

    return true;
}

// ============================================================
// Armazenamento
// Nenhum lead depende de integração externa para existir.
// ============================================================
function ebook_store(array $record): bool
{
    $dir = storage_dir('ebook');
    if ($dir === null) {
        error_log('[ebook] diretório de armazenamento indisponível');
        return false;
    }

    if ($record['tracking'] === []) {
        $record['tracking'] = new stdClass();
    }

    $file = $dir . '/' . gmdate('Y-m') . '.jsonl';
    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        return false;
    }

    return @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX) !== false;
}

// ============================================================
// Entrega do material — pelo Admin DevBatista.
// A página não baixa o PDF: quem manda o e-mail com o link é o Admin, ao
// receber o lead com "source": "ebook". Então o repasse É a entrega, e por
// isso é síncrono: o resultado decide a resposta ao visitante. Dizer
// "enviamos" sem o Admin ter aceitado perde o lead e a confiança dele.
// ============================================================

/** Só estas respostas do Admin contam como entregue (201 criado, 200 completado). */
const EBOOK_DELIVERED_HTTP_CODES = [200, 201];

/**
 * Repassa o pedido ao Admin, que cria (ou completa) o lead e manda o e-book.
 *
 * Topo de funil: o lead nasce só com o e-mail, que o Admin usa de nome
 * provisório. Se a pessoa depois fizer o diagnóstico, o mesmo lead é
 * completado (ver sendToCrm() em leads.php).
 *
 * Espera no máximo HTTP_TOTAL_TIMEOUT (8 s, em leads-config.php): sem
 * resposta nesse tempo, conta como falha.
 */
function ebook_deliver(array $lead): array
{
    $config = lead_config();
    if (!$config['crm_enabled'] || (string) $config['crm_token'] === '') {
        return ['status' => 'disabled'];
    }

    $response = crm_request([
        'source' => 'ebook',
        'site_id' => $lead['id'],
        'email' => $lead['email'],
        'summary' => ebook_crm_summary($lead),
    ]);

    if (!in_array($response['http_code'], EBOOK_DELIVERED_HTTP_CODES, true)) {
        return [
            'status' => 'error',
            'http_code' => $response['http_code'],
            'message' => $response['message'] !== '' ? $response['message'] : ('HTTP ' . $response['http_code']),
        ];
    }

    return [
        'status' => 'ok',
        'http_code' => $response['http_code'],
        'crm_lead_id' => (string) ($response['body']['id'] ?? ''),
        'created' => (bool) ($response['body']['created'] ?? false),
    ];
}

/** Uma linha para a timeline do lead: o material e, se houver, a campanha. */
function ebook_crm_summary(array $lead): string
{
    $campaign = array_filter([
        $lead['tracking']['utm_source'] ?? '',
        $lead['tracking']['utm_medium'] ?? '',
        $lead['tracking']['utm_campaign'] ?? '',
    ], static fn($value): bool => $value !== '');

    return 'Baixou o e-book pelo site (' . $lead['source'] . ')'
        . ($campaign !== [] ? ' · ' . implode(' / ', $campaign) : '');
}

/**
 * Registra o resultado da entrega em storage/integrations, no mesmo formato
 * de logIntegrations() em leads.php — é por aqui que se confere se o Admin
 * aceitou cada pedido.
 */
function ebook_log_delivery(string $leadId, array $crm): void
{
    $dir = storage_dir('integrations');
    if ($dir === null) {
        error_log('[ebook] não foi possível registrar a entrega do pedido ' . $leadId);
        return;
    }

    $line = json_encode([
        'lead_id' => $leadId,
        'source' => 'ebook',
        'at' => gmdate('c'),
        'results' => ['crm' => $crm],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($line !== false) {
        @file_put_contents($dir . '/' . gmdate('Y-m') . '.jsonl', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

// ============================================================
// Fluxo
// ============================================================
try {
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? ''));
    if ($method !== 'POST') {
        header('Allow: POST');
        ebook_fail(405, 'method_not_allowed', 'Método não permitido.');
    }

    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        ebook_fail(415, 'unsupported_media_type', 'Envie os dados como application/json.');
    }

    // Se houver Origin, ela precisa ser conhecida. Requisições same-origin
    // de navegador normalmente não enviam Origin em POST simples.
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $allowed = (array) lead_config()['allowed_origins'];
        $isLocal = (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
        if (!$isLocal && !in_array($origin, $allowed, true)) {
            ebook_fail(403, 'forbidden_origin', 'Origem não autorizada.');
        }
    }

    $ip = ebook_client_ip();
    if (!ebook_rate_limit($ip)) {
        header('Retry-After: 600');
        ebook_fail(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }

    $lead = ebook_normalize(ebook_read_json_body());

    if ($lead['email'] === '' || !filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
        ebook_fail(422, 'validation_error', 'Confira o e-mail informado.');
    }

    // Honeypot e tempo mínimo: bot recebe 200 e nada é gravado. Devolver
    // erro só ensinaria o bot a acertar na próxima.
    $looksLikeBot = $lead['honeypot'] !== ''
        || ($lead['elapsed_ms'] > 0 && $lead['elapsed_ms'] < EBOOK_MIN_ELAPSED_MS);

    if ($looksLikeBot) {
        ebook_respond(200, ['ok' => true, 'data' => new stdClass()]);
    }

    $record = [
        'id' => bin2hex(random_bytes(8)),
        'created_at' => gmdate('c'),
        'email' => $lead['email'],
        'source' => $lead['source'],
        'tracking' => $lead['tracking'],
        'page_url' => $lead['page_url'],
        'ip' => $ip,
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ];

    // Grava primeiro: o pedido fica no JSONL mesmo se o Admin falhar.
    if (!ebook_store($record)) {
        error_log('[ebook] falha ao gravar lead ' . $record['id']);
    }

    // O repasse ao Admin É a entrega: ele é quem manda o e-mail com o link.
    // Por isso roda ANTES da resposta. Se falhar, o visitante precisa saber
    // e poder tentar de novo, em vez de esperar um e-mail que não vai sair.
    $startedAt = microtime(true);
    try {
        $delivery = ebook_deliver($record);
    } catch (Throwable $deliveryError) {
        $delivery = ['status' => 'error', 'message' => $deliveryError->getMessage()];
    }
    $delivery['duration_ms'] = (int) round((microtime(true) - $startedAt) * 1000);
    ebook_log_delivery($record['id'], $delivery);

    if (($delivery['status'] ?? '') !== 'ok') {
        error_log(sprintf(
            '[ebook] entrega %s não confirmada pelo Admin (%s, HTTP %d, %d ms): %s',
            $record['id'],
            (string) ($delivery['status'] ?? ''),
            (int) ($delivery['http_code'] ?? 0),
            $delivery['duration_ms'],
            ($delivery['status'] ?? '') === 'disabled' ? 'crm desligado na configuração' : (string) ($delivery['message'] ?? '')
        ));
        ebook_fail(
            502,
            'delivery_failed',
            'Não conseguimos enviar o e-book para esse endereço agora. Confira o e-mail digitado e tente novamente.'
        );
    }

    ebook_respond(201, ['ok' => true, 'data' => ['lead_id' => $record['id']]]);
} catch (Throwable $exception) {
    error_log('[ebook] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    ebook_fail(500, 'internal_error', 'Não foi possível processar o envio agora. Tente novamente em instantes.');
}
