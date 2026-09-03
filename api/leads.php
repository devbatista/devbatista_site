<?php

declare(strict_types=1);

/**
 * DevBatista — Recebimento de leads do Diagnóstico Tecnológico.
 *
 * Aceita apenas POST com JSON. Valida, normaliza, recalcula os scores no
 * servidor (nunca confia no que vem do navegador), grava o lead e devolve
 * JSON.
 *
 * As integrações externas (HubSpot, e-mail, WhatsApp) ficam desacopladas em
 * funções próprias e desligadas por padrão — ver config.example.php.
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
const LEAD_MAX_BODY_BYTES = 16384;   // 16 KB
const LEAD_MAX_NAME = 120;
const LEAD_MAX_COMPANY = 120;
const LEAD_MAX_EMAIL = 160;
const LEAD_MAX_TEXT = 500;
const LEAD_MAX_TRACKING = 255;
const LEAD_MIN_ELAPSED_MS = 3000;    // abaixo disso não é gente respondendo 9 perguntas

// ============================================================
// Tabelas de pontuação — fonte de verdade do servidor.
// O front (js/lead-quiz.js) tem uma cópia só para exibir o resultado
// na hora; o valor que vale é sempre o calculado aqui.
// ============================================================
const DIAGNOSTIC_SCORING = [
    'employees' => [
        'solo' => 0, '2_5' => 1, '6_10' => 2, '11_25' => 3, '26_mais' => 4,
    ],
    'it_responsible' => [
        'interno' => 0, 'terceirizado' => 1, 'acumula' => 3, 'ninguem' => 4,
    ],
    'process_management' => [
        'sistemas' => 0, 'sistemas_planilhas' => 2, 'planilhas' => 3, 'manual' => 4,
    ],
    'manual_tasks' => [
        'quase_nenhum' => 0, 'algumas' => 1, 'muitas' => 3, 'maioria' => 4,
    ],
    'systems_integration' => [
        'sim' => 0, 'parcialmente' => 2, 'nao' => 3, 'nao_sabemos' => 4,
    ],
    'automation_interest' => [
        'nao_prioridade' => 0, 'avaliando' => 1, 'precisamos' => 3, 'prioridade' => 4,
    ],
    'development_need' => [
        'nao' => 0, 'futuramente' => 1, 'sim' => 3, 'definida' => 4,
    ],
    'technology_impact' => [
        'nao' => 0, 'pouco' => 1, 'as_vezes' => 2, 'bastante' => 4,
    ],
];

/** Faixas exibidas ao visitante. */
const DIAGNOSTIC_LEVELS = [
    ['id' => 'simples',  'max' => 8,    'title' => 'Estrutura tecnológica simples'],
    ['id' => 'melhoria', 'max' => 18,   'title' => 'Oportunidades de melhoria'],
    ['id' => 'alto',     'max' => 9999, 'title' => 'Alto potencial de otimização'],
];

/**
 * Score comercial — uso interno. NUNCA vai na resposta HTTP.
 * Mede potencial de negócio, não maturidade tecnológica.
 */
const COMMERCIAL_SCORING = [
    'employees' => [
        'solo' => 0, '2_5' => 2, '6_10' => 4, '11_25' => 6, '26_mais' => 8,
    ],
    'it_responsible' => [
        'interno' => 2, 'terceirizado' => 4, 'acumula' => 5, 'ninguem' => 3,
    ],
    'automation_interest' => [
        'nao_prioridade' => 0, 'avaliando' => 3, 'precisamos' => 6, 'prioridade' => 8,
    ],
    'development_need' => [
        'nao' => 0, 'futuramente' => 2, 'sim' => 5, 'definida' => 8,
    ],
    'technology_impact' => [
        'nao' => 0, 'pouco' => 1, 'as_vezes' => 3, 'bastante' => 6,
    ],
];

const COMMERCIAL_MAIN_PROBLEM = [
    'suporte_ti' => 3,
    'processos' => 3,
    'automacao' => 5,
    'ia' => 4,
    'desenvolvimento' => 5,
    'integracao' => 5,
    'infraestrutura' => 3,
    'outro' => 1,
];

const COMMERCIAL_TIERS = [
    ['id' => 'frio',   'max' => 12],
    ['id' => 'morno',  'max' => 24],
    ['id' => 'quente', 'max' => 9999],
];

const MAIN_PROBLEMS = [
    'suporte_ti', 'processos', 'automacao', 'ia',
    'desenvolvimento', 'integracao', 'infraestrutura', 'outro',
];

const TRACKING_FIELDS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id',
    'landing_page', 'referrer', 'page',
];


// ============================================================
// Resposta
// ============================================================
function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $code, string $message, array $fields = []): void
{
    $error = ['code' => $code, 'message' => $message];
    if ($fields !== []) {
        $error['fields'] = $fields;
    }
    respond($status, ['ok' => false, 'error' => $error]);
}

// ============================================================
// Entrada
// ============================================================
function client_ip(): string
{
    $candidates = [$_SERVER['HTTP_CF_CONNECTING_IP'] ?? '', $_SERVER['REMOTE_ADDR'] ?? ''];
    foreach ($candidates as $ip) {
        if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

function read_json_body(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > LEAD_MAX_BODY_BYTES) {
        fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $raw = file_get_contents('php://input', false, null, 0, LEAD_MAX_BODY_BYTES + 1);
    if ($raw === false || $raw === '') {
        fail(400, 'empty_body', 'Corpo da requisição vazio.');
    }
    if (strlen($raw) > LEAD_MAX_BODY_BYTES) {
        fail(413, 'payload_too_large', 'Requisição maior que o permitido.');
    }

    $data = json_decode($raw, true, 8);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        fail(400, 'invalid_json', 'JSON inválido.');
    }

    return $data;
}

// ============================================================
// Normalização
// ============================================================
function clean_text($value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $text = (string) $value;
    // Remove caracteres de controle (inclusive quebras usadas em header injection).
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text) ?? '';
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    $text = trim($text);

    if ($text !== '' && function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength, 'UTF-8');
    }
    return substr($text, 0, $maxLength);
}

function clean_multiline($value, int $maxLength): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $text = (string) $value;
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $text) ?? '';
    $text = preg_replace('/\n{3,}/u', "\n\n", $text) ?? '';
    $text = trim($text);

    if ($text !== '' && function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength, 'UTF-8');
    }
    return substr($text, 0, $maxLength);
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function normalize_phone(string $value): array
{
    $digits = preg_replace('/\D+/', '', $value) ?? '';

    // Tolera o 55 vindo colado do front.
    if (strlen($digits) > 11 && strpos($digits, '55') === 0) {
        $digits = substr($digits, 2);
    }
    $digits = substr($digits, 0, 11);

    return [
        'digits' => $digits,
        'e164' => $digits !== '' ? '+55' . $digits : '',
    ];
}

function normalizeLead(array $input): array
{
    $answers = is_array($input['answers'] ?? null) ? $input['answers'] : [];
    $tracking = is_array($input['tracking'] ?? null) ? $input['tracking'] : [];
    $meta = is_array($input['meta'] ?? null) ? $input['meta'] : [];

    $normalizedAnswers = [];
    foreach (array_keys(DIAGNOSTIC_SCORING) as $key) {
        $normalizedAnswers[$key] = clean_text($answers[$key] ?? '', 40);
    }

    $normalizedTracking = [];
    foreach (TRACKING_FIELDS as $key) {
        $value = clean_text($tracking[$key] ?? '', LEAD_MAX_TRACKING);
        if ($value !== '') {
            $normalizedTracking[$key] = $value;
        }
    }

    $email = clean_text($input['email'] ?? '', LEAD_MAX_EMAIL);
    $phone = normalize_phone(clean_text($input['phone'] ?? '', 32));
    $mainProblem = clean_text($input['main_problem'] ?? '', 40);

    return [
        'name' => clean_text($input['name'] ?? '', LEAD_MAX_NAME),
        'company' => clean_text($input['company'] ?? '', LEAD_MAX_COMPANY),
        'email' => function_exists('mb_strtolower') ? mb_strtolower($email, 'UTF-8') : strtolower($email),
        'phone' => $phone['digits'],
        'phone_e164' => $phone['e164'],
        'answers' => $normalizedAnswers,
        'main_problem' => $mainProblem,
        'main_problem_other' => $mainProblem === 'outro'
            ? clean_multiline($input['main_problem_other'] ?? '', LEAD_MAX_TEXT)
            : '',
        'tracking' => $normalizedTracking,
        'honeypot' => clean_text($input['website'] ?? '', 100),
        'elapsed_ms' => (int) ($meta['elapsed_ms'] ?? 0),
        'page_url' => clean_text($meta['page_url'] ?? '', LEAD_MAX_TRACKING),
        'trigger' => clean_text($meta['trigger'] ?? '', 80),
    ];
}

// ============================================================
// Validação
// ============================================================
function validateLead(array $lead): array
{
    $errors = [];

    $nameLength = text_length($lead['name']);
    if ($nameLength < 2) {
        $errors['name'] = 'Informe seu nome.';
    } elseif ($nameLength > LEAD_MAX_NAME) {
        $errors['name'] = 'Nome muito longo.';
    }

    $companyLength = text_length($lead['company']);
    if ($companyLength < 2) {
        $errors['company'] = 'Informe o nome da empresa.';
    } elseif ($companyLength > LEAD_MAX_COMPANY) {
        $errors['company'] = 'Nome da empresa muito longo.';
    }

    if ($lead['email'] === '' || !filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'E-mail inválido.';
    } elseif (text_length($lead['email']) > LEAD_MAX_EMAIL) {
        $errors['email'] = 'E-mail muito longo.';
    }

    $digits = $lead['phone'];
    if (strlen($digits) < 10 || strlen($digits) > 11) {
        $errors['phone'] = 'Informe o WhatsApp com DDD.';
    } elseif ((int) substr($digits, 0, 2) < 11) {
        $errors['phone'] = 'DDD inválido.';
    } elseif (strlen($digits) === 11 && $digits[2] !== '9') {
        $errors['phone'] = 'Número de celular inválido.';
    }

    foreach (DIAGNOSTIC_SCORING as $question => $options) {
        $answer = $lead['answers'][$question] ?? '';
        if ($answer === '' || !array_key_exists($answer, $options)) {
            $errors['answers.' . $question] = 'Resposta ausente ou inválida.';
        }
    }

    if (!in_array($lead['main_problem'], MAIN_PROBLEMS, true)) {
        $errors['main_problem'] = 'Selecione o principal desafio.';
    }

    if (text_length($lead['main_problem_other']) > LEAD_MAX_TEXT) {
        $errors['main_problem_other'] = 'Texto muito longo.';
    }

    return $errors;
}

// ============================================================
// Scores
// ============================================================
function calculateDiagnosticScore(array $answers): int
{
    $score = 0;
    foreach (DIAGNOSTIC_SCORING as $question => $options) {
        $answer = $answers[$question] ?? '';
        if (array_key_exists($answer, $options)) {
            $score += $options[$answer];
        }
    }
    return $score;
}

function diagnosticLevel(int $score): array
{
    foreach (DIAGNOSTIC_LEVELS as $level) {
        if ($score <= $level['max']) {
            return $level;
        }
    }
    return DIAGNOSTIC_LEVELS[count(DIAGNOSTIC_LEVELS) - 1];
}

/** Uso interno: qualificação comercial. Não é devolvida ao navegador. */
function calculateCommercialScore(array $lead): int
{
    $score = 0;
    foreach (COMMERCIAL_SCORING as $question => $options) {
        $answer = $lead['answers'][$question] ?? '';
        if (array_key_exists($answer, $options)) {
            $score += $options[$answer];
        }
    }
    $score += COMMERCIAL_MAIN_PROBLEM[$lead['main_problem']] ?? 0;

    // Lead vindo de campanha paga entra um degrau acima na fila.
    $paidSignals = ['utm_medium', 'fbclid', 'gclid', 'msclkid', 'ttclid'];
    foreach ($paidSignals as $signal) {
        if (($lead['tracking'][$signal] ?? '') !== '') {
            $score += 2;
            break;
        }
    }

    return $score;
}

function commercialTier(int $score): string
{
    foreach (COMMERCIAL_TIERS as $tier) {
        if ($score <= $tier['max']) {
            return $tier['id'];
        }
    }
    return 'quente';
}

// ============================================================
// Armazenamento
// ============================================================
/**
 * Grava o lead em JSONL enquanto o HubSpot não está ligado.
 * Nenhum lead se perde por causa de integração pendente.
 */
function storeLead(array $record): bool
{
    $dir = storage_dir('leads');
    if ($dir === null) {
        error_log('[leads] diretório de armazenamento indisponível');
        return false;
    }

    // Mantém tracking/answers como objeto no JSON mesmo quando vazios.
    foreach (['tracking', 'answers'] as $key) {
        if (($record[$key] ?? null) === []) {
            $record[$key] = new stdClass();
        }
    }

    $file = $dir . '/' . gmdate('Y-m') . '.jsonl';
    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        return false;
    }

    return @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX) !== false;
}

// ============================================================
// Rate limiting (janela deslizante por IP, em arquivo)
// ============================================================
function checkRateLimit(string $ip): bool
{
    $config = lead_config();
    if (!$config['rate_limit_enabled']) {
        return true;
    }

    $dir = storage_dir('ratelimit');
    if ($dir === null) {
        return true; // sem storage não bloqueia o lead
    }

    $file = $dir . '/' . hash('sha256', $ip) . '.json';
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

    // Faxina barata: 1 em cada 50 requisições.
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/*.json') ?: [] as $old) {
            if (@filemtime($old) < $now - ($window * 4)) {
                @unlink($old);
            }
        }
    }

    return true;
}

// ============================================================
// Integrações — desligadas por padrão.
// Cada função é independente e nunca derruba a resposta ao visitante.
// ============================================================

/**
 * Executa uma integração isolando qualquer falha dela.
 * O lead já está gravado neste ponto: uma exceção aqui não pode virar
 * um 500 para o visitante (ele tentaria de novo e geraria lead duplicado).
 */
function runIntegration(string $function, array $lead): array
{
    $startedAt = microtime(true);

    try {
        $result = $function($lead);
        if (!is_array($result) || !isset($result['status'])) {
            $result = ['status' => 'invalid_response'];
        }
    } catch (Throwable $exception) {
        error_log('[leads] integração ' . $function . ' falhou: ' . $exception->getMessage());
        $result = ['status' => 'error', 'message' => $exception->getMessage()];
    }

    $result['duration_ms'] = (int) round((microtime(true) - $startedAt) * 1000);
    return $result;
}

/**
 * Registra o resultado das integrações em arquivo separado, indexado pelo
 * lead. É por aqui que se verifica se uma integração rodou, foi pulada
 * por configuração ou falhou.
 */
function logIntegrations(string $leadId, array $results): void
{
    // Enquanto tudo está desligado, não há o que registrar.
    $relevant = array_filter($results, static fn(array $r): bool => $r['status'] !== 'disabled');
    if ($relevant === []) {
        return;
    }

    $dir = storage_dir('integrations');
    if ($dir === null) {
        error_log('[leads] não foi possível registrar integrações do lead ' . $leadId);
        return;
    }

    $line = json_encode([
        'lead_id' => $leadId,
        'at' => gmdate('c'),
        'results' => $results,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($line !== false) {
        @file_put_contents($dir . '/' . gmdate('Y-m') . '.jsonl', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

/** TODO: criar/atualizar contato + negócio no HubSpot (Private App token). */
function sendToHubSpot(array $lead): array
{
    $config = lead_config();
    if (!$config['hubspot_enabled'] || $config['hubspot_token'] === '') {
        return ['status' => 'disabled'];
    }

    // Ponto de entrada da integração. O mapeamento previsto:
    //   name          -> firstname / lastname
    //   company       -> company
    //   email         -> email
    //   phone_e164    -> phone
    //   answers.*     -> propriedades customizadas do diagnóstico
    //   diagnostic_*  -> propriedades do diagnóstico
    //   commercial_*  -> propriedades internas de qualificação
    //   tracking.*    -> utm_* / hs_analytics_source
    return ['status' => 'not_implemented'];
}

/** TODO: notificação por e-mail (AWS SES ou SMTP). */
function sendEmailNotification(array $lead): array
{
    $config = lead_config();
    if (!$config['email_enabled'] || $config['email_to'] === '') {
        return ['status' => 'disabled'];
    }

    return ['status' => 'not_implemented'];
}

/** TODO: notificação interna via WhatsApp Cloud API. */
function sendWhatsAppNotification(array $lead): array
{
    $config = lead_config();
    if (!$config['whatsapp_enabled'] || $config['whatsapp_endpoint'] === '') {
        return ['status' => 'disabled'];
    }

    return ['status' => 'not_implemented'];
}

// ============================================================
// Fluxo
// ============================================================
try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? '');
    if ($method !== 'POST') {
        header('Allow: POST');
        fail(405, 'method_not_allowed', 'Método não permitido.');
    }

    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        fail(415, 'unsupported_media_type', 'Envie os dados como application/json.');
    }

    // Se houver Origin, ela precisa ser conhecida. Requisições same-origin
    // de navegador normalmente não enviam Origin em POST simples.
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $allowed = (array) lead_config()['allowed_origins'];
        $isLocal = (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
        if (!$isLocal && !in_array($origin, $allowed, true)) {
            fail(403, 'forbidden_origin', 'Origem não autorizada.');
        }
    }

    $ip = client_ip();
    if (!checkRateLimit($ip)) {
        header('Retry-After: 600');
        fail(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }

    $lead = normalizeLead(read_json_body());

    // Honeypot e tempo mínimo: bot recebe 200 e nada é gravado.
    $looksLikeBot = $lead['honeypot'] !== ''
        || ($lead['elapsed_ms'] > 0 && $lead['elapsed_ms'] < LEAD_MIN_ELAPSED_MS);

    $errors = validateLead($lead);
    if ($errors !== []) {
        fail(422, 'validation_error', 'Confira os dados informados.', $errors);
    }

    // Scores recalculados aqui. O diagnostic_score recebido do navegador é
    // ignorado de propósito — serve apenas para exibição imediata no front.
    $diagnosticScore = calculateDiagnosticScore($lead['answers']);
    $level = diagnosticLevel($diagnosticScore);
    $commercialScore = calculateCommercialScore($lead);

    $response = [
        'diagnostic_score' => $diagnosticScore,
        'diagnostic_level' => $level['id'],
        'diagnostic_title' => $level['title'],
    ];

    if ($looksLikeBot) {
        respond(200, ['ok' => true, 'data' => $response]);
    }

    $record = $lead + [
        'id' => bin2hex(random_bytes(8)),
        'created_at' => gmdate('c'),
        'diagnostic_score' => $diagnosticScore,
        'diagnostic_level' => $level['id'],
        'commercial_score' => $commercialScore,      // interno
        'commercial_tier' => commercialTier($commercialScore), // interno
        'ip' => $ip,
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ];
    unset($record['honeypot']);

    // Grava primeiro: nenhuma integração pode custar um lead.
    $stored = storeLead($record);
    if (!$stored) {
        // O visitante não pode ser penalizado por falha de disco, mas
        // precisamos saber que aconteceu.
        error_log('[leads] falha ao gravar lead ' . $record['id']);
    }

    logIntegrations($record['id'], [
        'hubspot' => runIntegration('sendToHubSpot', $record),
        'email' => runIntegration('sendEmailNotification', $record),
        'whatsapp' => runIntegration('sendWhatsAppNotification', $record),
    ]);

    $response['lead_id'] = $record['id'];
    respond(201, ['ok' => true, 'data' => $response]);
} catch (Throwable $exception) {
    error_log('[leads] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    fail(500, 'internal_error', 'Não foi possível processar o envio agora. Tente novamente em instantes.');
}
