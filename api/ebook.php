<?php

declare(strict_types=1);

/**
 * DevBatista — captura de e-mail da landing page do e-book.
 *
 * Aceita apenas POST com JSON contendo o e-mail. Valida, grava e devolve
 * JSON. O front (js/ebook.js) libera o PDF assim que a resposta chega.
 *
 * Compartilha configuração, armazenamento e cliente HTTP com o endpoint
 * do diagnóstico (leads-config.php). O HubSpot fica desligado por padrão —
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
require_once __DIR__ . '/mailer.php';

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

/**
 * Entrega a resposta e segue processando em segundo plano.
 *
 * O lead já está gravado quando esta função é chamada: nada do que rodar
 * depois (HubSpot) pode segurar o download do visitante.
 */
function ebook_respond_and_continue(int $status, array $payload): void
{
    $body = (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    http_response_code($status);
    header('Content-Length: ' . strlen($body));
    header('Connection: close');
    echo $body;

    ignore_user_abort(true);

    foreach (['fastcgi_finish_request', 'litespeed_finish_request'] as $finish) {
        if (function_exists($finish)) {
            $finish();
            return;
        }
    }

    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
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
// Entrega do material
// O e-book agora chega SÓ por e-mail: a página não baixa mais nada. Por
// isso este envio é síncrono e o seu resultado decide a resposta HTTP —
// dizer "enviamos" sem ter enviado perde o lead e a confiança dele.
// ============================================================
function ebook_deliver(array $lead): array
{
    $config = lead_config();

    if (!($config['ebook_email_enabled'] ?? false)) {
        return ['status' => 'disabled'];
    }

    $url = trim((string) ($config['ebook_download_url'] ?? ''));
    if ($url === '') {
        return ['status' => 'error', 'message' => 'ebook_download_url não configurada'];
    }

    // Sai do endereço pessoal, não de um leads@: o material é assinado pelo
    // Rafael e promete resposta direta. Remetente genérico desmente isso —
    // e responder o e-mail já cai na caixa certa, sem Reply-To.
    $sent = ses_send_email(
        $lead['email'],
        'Seu e-book chegou: onde a TI drena o lucro da sua empresa',
        ebook_email_html($url),
        ebook_email_text($url),
        [
            'from' => (string) ($config['ebook_email_from'] ?: $config['email_from']),
            'from_name' => (string) $config['ebook_email_from_name'],
        ]
    );

    if (!$sent['ok']) {
        return ['status' => 'error', 'http_code' => $sent['http_code'], 'message' => $sent['message']];
    }

    return ['status' => 'ok', 'message_id' => (string) ($sent['body']['MessageId'] ?? '')];
}

function ebook_email_text(string $url): string
{
    return implode("\n", [
        'Obrigado pelo interesse!',
        '',
        'Seu e-book "Sua empresa está perdendo dinheiro com a TI sem perceber?"',
        'está disponível neste link:',
        '',
        $url,
        '',
        'São 5 sinais de que a tecnologia está custando mais do que deveria —',
        'e o que fazer sobre cada um deles, sem linguagem técnica.',
        '',
        'Qualquer dúvida, é só responder este e-mail.',
        '',
        'Rafael Batista',
        'DevBatista — devbatista.com',
    ]);
}

function ebook_email_html(string $url): string
{
    $link = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">'
        . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">'

        . '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">Seu e-book está pronto</h1>'

        . '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">'
        . '<strong>Sua empresa está perdendo dinheiro com a TI sem perceber?</strong><br>'
        . '5 sinais de que a tecnologia está custando mais do que deveria — e o que fazer '
        . 'sobre cada um deles, sem linguagem técnica.</p>'

        . '<p style="margin:0 0 28px;"><a href="' . $link . '" '
        . 'style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;'
        . 'padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;">'
        . 'Baixar o e-book (PDF)</a></p>'

        . '<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b;">'
        . 'Se o botão não funcionar, copie este endereço no navegador:<br>'
        . '<a href="' . $link . '" style="color:#1d4ed8;word-break:break-all;">' . $link . '</a></p>'

        . '<p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:14px;line-height:1.6;color:#334155;">'
        . 'Qualquer dúvida, é só responder este e-mail — ele chega direto em mim.<br><br>'
        . '<strong>Rafael Batista</strong><br>'
        . '<span style="color:#64748b;">DevBatista · devbatista.com</span></p>'

        . '</div></body></html>';
}

// ============================================================
// HubSpot — desligado por padrão.
// Topo de funil: cria/atualiza o contato como subscriber. Não abre
// negócio (isso é papel do diagnóstico, em leads.php).
// ============================================================
function ebook_send_to_hubspot(array $lead): array
{
    $config = lead_config();

    $enabled = (bool) ($config['ebook_hubspot_enabled'] ?? false);
    if (!$enabled || (string) $config['hubspot_token'] === '') {
        return ['status' => 'disabled'];
    }

    $properties = array_filter([
        'email' => $lead['email'],
        'lifecyclestage' => 'subscriber',
        'hs_lead_status' => 'NEW',
        'hs_analytics_source' => 'OFFLINE',
    ], static fn($value): bool => $value !== '' && $value !== null);

    // Upsert por e-mail: reenviar o mesmo e-mail atualiza em vez de duplicar.
    $upsert = ebook_hubspot_request('POST', '/crm/v3/objects/contacts/batch/upsert', [
        'inputs' => [[
            'idProperty' => 'email',
            'id' => $lead['email'],
            'properties' => $properties,
        ]],
    ]);

    if (!$upsert['ok']) {
        return ['status' => 'error', 'http_code' => $upsert['http_code'], 'message' => $upsert['message']];
    }

    $contactId = (string) ($upsert['body']['results'][0]['id'] ?? '');
    $result = ['status' => 'ok', 'contact_id' => $contactId, 'http_code' => $upsert['http_code']];

    if ($contactId === '') {
        return $result;
    }

    // Negócio na etapa do e-book: o board mostra o topo do funil.
    $dealId = '';
    if ((string) ($config['ebook_deal_stage'] ?? '') !== '') {
        [$dealId, $result['deal']] = ebook_ensure_deal($lead, $contactId);
        if ($dealId !== '') {
            $result['deal_id'] = $dealId;
        }
    }

    if (($config['ebook_hubspot_note'] ?? true) === false) {
        return $result;
    }

    // A nota registra a origem sem exigir propriedade customizada no portal.
    $associations = [[
        'to' => ['id' => $contactId],
        // 202 = note_to_contact (associação padrão do HubSpot)
        'types' => [['associationCategory' => 'HUBSPOT_DEFINED', 'associationTypeId' => 202]],
    ]];

    if ($dealId !== '') {
        $associations[] = [
            'to' => ['id' => $dealId],
            // 214 = note_to_deal
            'types' => [['associationCategory' => 'HUBSPOT_DEFINED', 'associationTypeId' => 214]],
        ];
    }

    $note = ebook_hubspot_request('POST', '/crm/v3/objects/notes', [
        'properties' => [
            'hs_timestamp' => round(microtime(true) * 1000),
            'hs_note_body' => ebook_hubspot_note_body($lead),
        ],
        'associations' => $associations,
    ]);

    $result['note'] = $note['ok'] ? 'ok' : ('falhou: ' . $note['message']);

    return $result;
}

/**
 * Abre o negócio na etapa do e-book, a menos que o contato já tenha um
 * negócio aberto.
 *
 * Sem essa checagem, quem baixasse o material duas vezes — ou já estivesse
 * em negociação — ganharia um negócio duplicado no pipeline. E um lead que
 * já fez o diagnóstico NÃO pode ser puxado de volta para o topo do funil.
 *
 * @return array{0:string,1:string} [dealId, status legível]
 */
function ebook_ensure_deal(array $lead, string $contactId): array
{
    $config = lead_config();

    $existing = ebook_hubspot_request('GET', '/crm/v4/objects/contacts/' . $contactId . '/associations/deals');
    foreach ($existing['body']['results'] ?? [] as $association) {
        $dealId = (string) ($association['toObjectId'] ?? '');
        if ($dealId === '') {
            continue;
        }

        $deal = ebook_hubspot_request('GET', '/crm/v3/objects/deals/' . $dealId . '?properties=dealstage');
        $stage = (string) ($deal['body']['properties']['dealstage'] ?? '');
        if ($stage !== '' && strpos($stage, 'closed') !== 0) {
            return [$dealId, 'negócio aberto já existia'];
        }
    }

    $created = ebook_hubspot_request('POST', '/crm/v3/objects/deals', [
        'properties' => [
            'dealname' => 'E-book · ' . $lead['email'],
            'pipeline' => (string) ($config['ebook_pipeline'] ?? 'default'),
            'dealstage' => (string) $config['ebook_deal_stage'],
        ],
        'associations' => [[
            'to' => ['id' => $contactId],
            // 3 = deal_to_contact
            'types' => [['associationCategory' => 'HUBSPOT_DEFINED', 'associationTypeId' => 3]],
        ]],
    ]);

    if (!$created['ok']) {
        return ['', 'falhou: ' . $created['message']];
    }

    return [(string) ($created['body']['id'] ?? ''), 'criado'];
}

function ebook_hubspot_request(string $method, string $path, ?array $payload = null): array
{
    $config = lead_config();

    return http_json(
        $method,
        'https://api.hubapi.com' . $path,
        $payload,
        ['Authorization: Bearer ' . $config['hubspot_token']]
    );
}

function ebook_hubspot_note_body(array $lead): string
{
    $lines = ['<strong>Download do e-book</strong>', 'Material: ' . $lead['source']];

    foreach ($lead['tracking'] as $key => $value) {
        $lines[] = htmlspecialchars($key, ENT_QUOTES, 'UTF-8') . ': ' . htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    return implode('<br>', $lines);
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

    // Grava primeiro: nenhuma integração pode custar um lead.
    if (!ebook_store($record)) {
        error_log('[ebook] falha ao gravar lead ' . $record['id']);
    }

    // O e-mail É a entrega — a página não baixa mais o PDF. Então ele roda
    // ANTES da resposta: se o envio falhar, o visitante precisa saber disso
    // e poder tentar de novo, em vez de ficar esperando um e-mail que nunca
    // chegou. O lead já está gravado, então nada se perde nesse caminho.
    $delivery = ebook_deliver($record);

    if (($delivery['status'] ?? '') === 'error') {
        error_log('[ebook] entrega ' . $record['id'] . ': ' . ($delivery['message'] ?? ''));
        ebook_fail(
            502,
            'delivery_failed',
            'Não conseguimos enviar o e-book para esse endereço agora. Confira o e-mail digitado e tente novamente.'
        );
    }

    // Responde antes de falar com o HubSpot: o CRM não segura o visitante.
    ebook_respond_and_continue(201, ['ok' => true, 'data' => ['lead_id' => $record['id']]]);

    // A partir daqui o visitante já recebeu a resposta: uma falha de
    // integração vira log, nunca uma tentativa de responder de novo.
    try {
        $integration = ebook_send_to_hubspot($record);
        if (($integration['status'] ?? '') === 'error') {
            error_log('[ebook] hubspot ' . $record['id'] . ': ' . ($integration['message'] ?? ''));
        }
    } catch (Throwable $integrationError) {
        error_log('[ebook] hubspot ' . $record['id'] . ': ' . $integrationError->getMessage());
    }

    exit;
} catch (Throwable $exception) {
    error_log('[ebook] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    ebook_fail(500, 'internal_error', 'Não foi possível processar o envio agora. Tente novamente em instantes.');
}
