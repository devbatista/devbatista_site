<?php

declare(strict_types=1);

/**
 * DevBatista — formulário de contato (/contato).
 *
 * Aceita apenas POST com JSON. Valida, grava o envio no mesmo JSONL dos
 * leads (storage/leads/, com "source": "contact"), responde e só depois
 * manda o lead ao Admin, pelo mesmo caminho do Diagnóstico: crm_request(),
 * servidor a servidor, com o SITE_LEADS_TOKEN.
 *
 * O front (js/main.js) abre o WhatsApp com a resposta, com um erro ou depois
 * de 4 s sem resposta: nada aqui pode travar o visitante.
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
const CONTACT_MAX_BODY_BYTES = 16384;  // 16 KB
const CONTACT_MAX_NAME = 120;
const CONTACT_MAX_COMPANY = 120;
const CONTACT_MAX_EMAIL = 160;
const CONTACT_MAX_MESSAGE = 2000;
const CONTACT_MAX_TRACKING = 255;
const CONTACT_MIN_ELAPSED_MS = 2000;   // abaixo disso ninguém preencheu nome, WhatsApp e dois selects

// ============================================================
// Opções do formulário: valor => rótulo. Espelham CONTACT_LABELS em js/main.js.
// ============================================================
const CONTACT_SEGMENTS = [
    'contabilidade' => 'Contabilidade',
    'saude_estetica' => 'Saúde e estética',
    'imobiliario' => 'Imobiliário',
    'servicos' => 'Prestador de serviços',
    'comercio' => 'Comércio',
    'outro' => 'Outro',
];

const CONTACT_NEEDS = [
    'whatsapp_ia' => 'Atendimento com IA no WhatsApp',
    'automacao_ia' => 'Automação de tarefas com IA',
    'ia_sistemas' => 'IA conectada aos meus sistemas',
    'sob_medida' => 'Sistema, site ou app sob medida',
    'manutencao' => 'Manutenção de sistema existente',
    'agencia' => 'Sou agência ou software house',
    'nao_sei' => 'Ainda não sei',
];

const CONTACT_VOLUMES = [
    'ate_300' => 'Até 300',
    '300_1000' => '300 a 1.000',
    'mais_1000' => 'Mais de 1.000',
    'nao_sei' => 'Não sei',
];

const CONTACT_ENGAGEMENTS = [
    'continuo' => 'Contínuo',
    'pontual' => 'Pontual',
    'nao_sei' => 'Ainda não sei',
];

const CONTACT_TRACKING_FIELDS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
    'landing_page', 'referrer', 'page',
];

// ============================================================
// Resposta
// ============================================================
function contact_respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function contact_fail(int $status, string $code, string $message, array $fields = []): void
{
    $error = ['code' => $code, 'message' => $message];
    if ($fields !== []) {
        $error['fields'] = $fields;
    }
    contact_respond($status, ['ok' => false, 'error' => $error]);
}

/**
 * Entrega a resposta e segue processando em segundo plano: o envio já está
 * gravado, e o Admin não pode segurar o WhatsApp do visitante.
 */
function contact_respond_and_continue(int $status, array $payload): void
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
function contact_client_ip(): string
{
    $candidates = [$_SERVER['HTTP_CF_CONNECTING_IP'] ?? '', $_SERVER['REMOTE_ADDR'] ?? ''];
    foreach ($candidates as $ip) {
        if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

function contact_read_json_body(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > CONTACT_MAX_BODY_BYTES) {
        contact_fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $raw = file_get_contents('php://input', false, null, 0, CONTACT_MAX_BODY_BYTES + 1);
    if ($raw === false || $raw === '') {
        contact_fail(400, 'empty_body', 'Corpo da requisição vazio.');
    }
    if (strlen($raw) > CONTACT_MAX_BODY_BYTES) {
        contact_fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $data = json_decode($raw, true, 6);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        contact_fail(400, 'invalid_json', 'JSON inválido.');
    }

    return $data;
}

function contact_cut(string $text, int $maxLength): string
{
    return function_exists('mb_substr')
        ? mb_substr($text, 0, $maxLength, 'UTF-8')
        : substr($text, 0, $maxLength);
}

/** Uma linha: remove controles (inclusive quebras) e normaliza espaços. */
function contact_clean($value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $value) ?? '';
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    return contact_cut($text, $maxLength);
}

/** Texto livre: mantém as quebras de linha, tira o resto dos controles. */
function contact_clean_multiline($value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", (string) $value);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $text) ?? '';
    $text = trim(preg_replace('/\n{3,}/u', "\n\n", $text) ?? '');
    return contact_cut($text, $maxLength);
}

function contact_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/** DDD + número, sem o 55 (é o formato que o Admin espera em "phone"). */
function contact_phone(string $value): string
{
    $digits = preg_replace('/\D+/', '', $value) ?? '';
    if (strlen($digits) > 11 && strpos($digits, '55') === 0) {
        $digits = substr($digits, 2);
    }
    return substr($digits, 0, 11);
}

function contact_normalize(array $input): array
{
    $rawTracking = is_array($input['tracking'] ?? null) ? $input['tracking'] : [];
    $tracking = [];
    foreach (CONTACT_TRACKING_FIELDS as $field) {
        $value = contact_clean($rawTracking[$field] ?? '', CONTACT_MAX_TRACKING);
        if ($value !== '') {
            $tracking[$field] = $value;
        }
    }

    $meta = is_array($input['meta'] ?? null) ? $input['meta'] : [];
    $email = contact_clean($input['email'] ?? '', CONTACT_MAX_EMAIL + 1);

    return [
        'name' => contact_clean($input['name'] ?? '', CONTACT_MAX_NAME),
        'phone' => contact_phone(contact_clean($input['phone'] ?? '', 32)),
        'email' => function_exists('mb_strtolower') ? mb_strtolower($email, 'UTF-8') : strtolower($email),
        'company' => contact_clean($input['company'] ?? '', CONTACT_MAX_COMPANY),
        'segment' => contact_clean($input['segment'] ?? '', 40),
        'need' => contact_clean($input['need'] ?? '', 40),
        'volume' => contact_clean($input['volume'] ?? '', 40),
        'engagement' => contact_clean($input['engagement'] ?? '', 40),
        'message' => contact_clean_multiline($input['message'] ?? '', CONTACT_MAX_MESSAGE),
        'consent' => ($input['consent'] ?? false) === true,
        'tracking' => $tracking,
        'honeypot' => contact_clean($input['website'] ?? '', 100),
        'elapsed_ms' => (int) ($meta['elapsed_ms'] ?? 0),
        'page_url' => contact_clean($meta['page_url'] ?? '', CONTACT_MAX_TRACKING),
    ];
}

// ============================================================
// Validação (as mesmas regras de validateContact() em js/main.js)
// ============================================================
function contact_validate(array $lead): array
{
    $errors = [];

    if (contact_length($lead['name']) < 2) {
        $errors['name'] = 'Informe seu nome.';
    }

    $digits = $lead['phone'];
    if (strlen($digits) < 10 || strlen($digits) > 11) {
        $errors['phone'] = 'Informe o WhatsApp com DDD.';
    } elseif ((int) substr($digits, 0, 2) < 11) {
        $errors['phone'] = 'DDD inválido.';
    } elseif (strlen($digits) === 11 && $digits[2] !== '9') {
        $errors['phone'] = 'Número de celular inválido.';
    }

    if ($lead['email'] !== '') {
        if (contact_length($lead['email']) > CONTACT_MAX_EMAIL) {
            $errors['email'] = 'E-mail muito longo.';
        } elseif (!filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'E-mail inválido.';
        }
    }

    if (!array_key_exists($lead['segment'], CONTACT_SEGMENTS)) {
        $errors['segment'] = 'Selecione o segmento.';
    }
    if (!array_key_exists($lead['need'], CONTACT_NEEDS)) {
        $errors['need'] = 'Selecione o que você precisa.';
    }
    if ($lead['volume'] !== '' && !array_key_exists($lead['volume'], CONTACT_VOLUMES)) {
        $errors['volume'] = 'Opção inválida.';
    }
    if ($lead['engagement'] !== '' && !array_key_exists($lead['engagement'], CONTACT_ENGAGEMENTS)) {
        $errors['engagement'] = 'Opção inválida.';
    }
    if (!$lead['consent']) {
        $errors['consent'] = 'Para enviar, é preciso concordar com a Política de Privacidade.';
    }

    return $errors;
}

// ============================================================
// Rate limiting — janela deslizante por IP, em arquivo.
// Contador próprio: o contato não consome a cota do diagnóstico.
// ============================================================
function contact_rate_limit(string $ip): bool
{
    $config = lead_config();
    if (!$config['rate_limit_enabled']) {
        return true;
    }

    $dir = storage_dir('ratelimit');
    if ($dir === null) {
        return true; // sem storage não bloqueia o contato
    }

    $file = $dir . '/contato-' . hash('sha256', $ip) . '.json';
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
// Armazenamento: o mesmo JSONL do diagnóstico (storage/leads/AAAA-MM.jsonl)
// e o mesmo log de integrações (storage/integrations/AAAA-MM.jsonl).
// ============================================================
function contact_store(array $record): bool
{
    $dir = storage_dir('leads');
    if ($dir === null) {
        error_log('[contato] diretório de armazenamento indisponível');
        return false;
    }

    if ($record['tracking'] === []) {
        $record['tracking'] = new stdClass();
    }

    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        return false;
    }

    return @file_put_contents($dir . '/' . gmdate('Y-m') . '.jsonl', $line . PHP_EOL, FILE_APPEND | LOCK_EX) !== false;
}

/** Mesmo formato de logIntegrations() em leads.php. */
function contact_log_integration(string $leadId, array $crm): void
{
    if (($crm['status'] ?? '') === 'disabled') {
        return;
    }

    $dir = storage_dir('integrations');
    if ($dir === null) {
        error_log('[contato] não foi possível registrar a integração do envio ' . $leadId);
        return;
    }

    $line = json_encode([
        'lead_id' => $leadId,
        'source' => 'contact',
        'at' => gmdate('c'),
        'results' => ['crm' => $crm],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($line !== false) {
        @file_put_contents($dir . '/' . gmdate('Y-m') . '.jsonl', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

// ============================================================
// CRM (Admin DevBatista)
// ============================================================
function contact_label(array $options, string $value): string
{
    return $options[$value] ?? $value;
}

/** Uma linha para a timeline do lead. */
function contact_crm_summary(array $lead): string
{
    return 'Contato pelo site: ' . contact_label(CONTACT_NEEDS, $lead['need'])
        . ' · ' . contact_label(CONTACT_SEGMENTS, $lead['segment']);
}

/** Todos os campos preenchidos, um por linha, para as observações do lead. */
function contact_crm_details(array $lead): string
{
    $fields = [
        'Nome' => $lead['name'],
        'WhatsApp' => $lead['phone'],
        'E-mail' => $lead['email'],
        'Empresa' => $lead['company'],
        'Segmento' => contact_label(CONTACT_SEGMENTS, $lead['segment']),
        'O que precisa' => contact_label(CONTACT_NEEDS, $lead['need']),
        'Mensagens por mês no WhatsApp' => $lead['volume'] !== '' ? contact_label(CONTACT_VOLUMES, $lead['volume']) : '',
        'Contínuo ou pontual' => $lead['engagement'] !== '' ? contact_label(CONTACT_ENGAGEMENTS, $lead['engagement']) : '',
        'Caso' => $lead['message'],
    ];

    $lines = [];
    foreach ($fields as $label => $value) {
        if ($value !== '') {
            $lines[] = $label . ': ' . $value;
        }
    }

    if ($lead['tracking'] !== []) {
        $lines[] = '';
        foreach ($lead['tracking'] as $key => $value) {
            $lines[] = $key . ': ' . $value;
        }
    }

    return implode("\n", $lines);
}

function contact_send_to_crm(array $lead): array
{
    $config = lead_config();
    if (!$config['crm_enabled'] || (string) $config['crm_token'] === '') {
        return ['status' => 'disabled'];
    }

    $response = crm_request([
        'source' => 'contact',
        'site_id' => $lead['id'],
        'name' => $lead['name'],
        'company' => $lead['company'],
        'email' => $lead['email'],
        'phone' => $lead['phone'],
        'need' => $lead['need'],
        'summary' => contact_crm_summary($lead),
        'details' => contact_crm_details($lead),
    ]);

    if (!$response['ok']) {
        return ['status' => 'error', 'http_code' => $response['http_code'], 'message' => $response['message']];
    }

    return [
        'status' => 'ok',
        'http_code' => $response['http_code'],
        'crm_lead_id' => (string) ($response['body']['id'] ?? ''),
        'created' => (bool) ($response['body']['created'] ?? false),
    ];
}

// ============================================================
// Fluxo
// ============================================================
try {
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? ''));
    if ($method !== 'POST') {
        header('Allow: POST');
        contact_fail(405, 'method_not_allowed', 'Método não permitido.');
    }

    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        contact_fail(415, 'unsupported_media_type', 'Envie os dados como application/json.');
    }

    // Se houver Origin, ela precisa ser conhecida. Requisições same-origin
    // de navegador normalmente não enviam Origin em POST simples.
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $allowed = (array) lead_config()['allowed_origins'];
        $isLocal = (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
        if (!$isLocal && !in_array($origin, $allowed, true)) {
            contact_fail(403, 'forbidden_origin', 'Origem não autorizada.');
        }
    }

    $lead = contact_normalize(contact_read_json_body());

    // Honeypot e tempo mínimo: robô recebe 200 e nada é gravado nem enviado.
    // Vem antes do rate limit e da validação, para não ensinar nada ao robô.
    if ($lead['honeypot'] !== '' || ($lead['elapsed_ms'] > 0 && $lead['elapsed_ms'] < CONTACT_MIN_ELAPSED_MS)) {
        contact_respond(200, ['ok' => true, 'data' => new stdClass()]);
    }

    $ip = contact_client_ip();
    if (!contact_rate_limit($ip)) {
        header('Retry-After: 600');
        contact_fail(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }

    $errors = contact_validate($lead);
    if ($errors !== []) {
        contact_fail(422, 'validation_error', 'Confira os dados informados.', $errors);
    }

    unset($lead['honeypot']);
    $record = [
        'id' => bin2hex(random_bytes(8)),
        'source' => 'contact',
        'created_at' => gmdate('c'),
    ] + $lead + [
        'ip' => $ip,
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ];

    // Grava primeiro: nenhuma integração pode custar um contato.
    if (!contact_store($record)) {
        error_log('[contato] falha ao gravar envio ' . $record['id']);
    }

    contact_respond_and_continue(201, ['ok' => true, 'data' => ['lead_id' => $record['id']]]);

    // A partir daqui o visitante já recebeu a resposta (e o WhatsApp já
    // abriu): uma falha do Admin vira log, nunca uma segunda resposta.
    try {
        $crm = contact_send_to_crm($record);
    } catch (Throwable $integrationError) {
        $crm = ['status' => 'error', 'message' => $integrationError->getMessage()];
    }
    if (($crm['status'] ?? '') === 'error') {
        error_log('[contato] crm ' . $record['id'] . ': ' . ($crm['message'] ?? ''));
    }
    contact_log_integration($record['id'], $crm);

    exit;
} catch (Throwable $exception) {
    error_log('[contato] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    contact_fail(500, 'internal_error', 'Não foi possível processar o envio agora. Tente novamente em instantes.');
}
