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
require_once __DIR__ . '/mailer.php';

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

/**
 * Rótulos legíveis das respostas — usados nas notificações (HubSpot,
 * e-mail, WhatsApp). Quem lê o lead precisa de "Grande parte da operação",
 * não de "maioria". Espelham as opções de js/lead-quiz.js.
 */
const ANSWER_LABELS = [
    'employees' => [
        'label' => 'Porte da empresa',
        'options' => [
            'solo' => 'Somente o responsável',
            '2_5' => '2 a 5 pessoas',
            '6_10' => '6 a 10 pessoas',
            '11_25' => '11 a 25 pessoas',
            '26_mais' => '26 ou mais',
        ],
    ],
    'it_responsible' => [
        'label' => 'Responsável pela tecnologia',
        'options' => [
            'interno' => 'Equipe ou profissional interno',
            'terceirizado' => 'Prestador terceirizado',
            'acumula' => 'Alguém da empresa acumula a função',
            'ninguem' => 'Ninguém responsável',
        ],
    ],
    'process_management' => [
        'label' => 'Controle dos processos',
        'options' => [
            'sistemas' => 'Sistemas integrados',
            'sistemas_planilhas' => 'Sistemas + planilhas',
            'planilhas' => 'Principalmente planilhas',
            'manual' => 'WhatsApp, planilhas e processos manuais',
        ],
    ],
    'manual_tasks' => [
        'label' => 'Trabalho manual repetitivo',
        'options' => [
            'quase_nenhum' => 'Quase nenhum',
            'algumas' => 'Algumas tarefas',
            'muitas' => 'Muitas tarefas',
            'maioria' => 'Grande parte da operação',
        ],
    ],
    'systems_integration' => [
        'label' => 'Sistemas conversam entre si',
        'options' => [
            'sim' => 'Sim',
            'parcialmente' => 'Parcialmente',
            'nao' => 'Não',
            'nao_sabemos' => 'Não sabem como integrar',
        ],
    ],
    'automation_interest' => [
        'label' => 'Intenção de automatizar',
        'options' => [
            'nao_prioridade' => 'Não é prioridade',
            'avaliando' => 'Estão avaliando',
            'precisamos' => 'Precisam automatizar',
            'prioridade' => 'É prioridade agora',
        ],
    ],
    'development_need' => [
        'label' => 'Necessidade de desenvolvimento',
        'options' => [
            'nao' => 'Não',
            'futuramente' => 'Talvez futuramente',
            'sim' => 'Sim',
            'definida' => 'Necessidade já definida',
        ],
    ],
    'technology_impact' => [
        'label' => 'Tecnologia limita o crescimento',
        'options' => [
            'nao' => 'Não',
            'pouco' => 'Pouco',
            'as_vezes' => 'Às vezes',
            'bastante' => 'Sim, bastante',
        ],
    ],
];

const MAIN_PROBLEM_LABELS = [
    'suporte_ti' => 'Suporte e gestão de TI',
    'processos' => 'Organização dos processos',
    'automacao' => 'Automatização de tarefas',
    'ia' => 'Inteligência Artificial',
    'desenvolvimento' => 'Desenvolvimento de sistema',
    'integracao' => 'Integração entre sistemas',
    'infraestrutura' => 'Infraestrutura / segurança',
    'outro' => 'Outro',
];

const DIAGNOSTIC_LEVEL_LABELS = [
    'simples' => 'Estrutura tecnológica simples',
    'melhoria' => 'Oportunidades de melhoria',
    'alto' => 'Alto potencial de otimização',
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

/**
 * Entrega a resposta ao visitante e segue processando em segundo plano.
 *
 * Sem isso, uma chamada HTTP ao HubSpot fica na frente do spinner do
 * formulário. O lead já está gravado quando esta função é chamada, então
 * nada do que rodar depois pode custar a conversão.
 *
 * Retorna true se conseguiu liberar a conexão.
 */
function respond_and_continue(int $status, array $payload): bool
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    http_response_code($status);
    header('Content-Length: ' . strlen((string) $body));
    header('Connection: close');
    echo $body;

    // O visitante pode fechar a aba; o processamento continua.
    ignore_user_abort(true);

    // PHP-FPM e LiteSpeed (LSAPI) têm funções próprias para encerrar a
    // resposta e continuar executando. Sem uma delas, um simples flush()
    // não libera a conexão nesses SAPIs — o visitante esperaria o HubSpot.
    foreach (['fastcgi_finish_request', 'litespeed_finish_request'] as $finish) {
        if (function_exists($finish)) {
            $finish();
            return true;
        }
    }

    // Último recurso: esvazia os buffers e segue.
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();

    return false;
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

/**
 * Cria ou atualiza o contato no HubSpot e anexa o diagnóstico como nota.
 *
 * Usa apenas propriedades padrão: uma propriedade customizada inexistente
 * faz o HubSpot devolver 400 e a requisição inteira falha. O diagnóstico
 * completo vai na nota, que funciona sem configurar nada no portal.
 *
 * Para mandar as respostas em propriedades próprias, preencha
 * 'hubspot_properties' no config: ['diagnostic_score' => 'nome_da_prop'].
 */
function sendToHubSpot(array $lead): array
{
    $config = lead_config();
    if (!$config['hubspot_enabled'] || $config['hubspot_token'] === '') {
        return ['status' => 'disabled'];
    }

    [$firstName, $lastName] = split_name($lead['name']);

    $properties = [
        'email' => $lead['email'],
        'firstname' => $firstName,
        'lastname' => $lastName,
        'phone' => $lead['phone_e164'],
        'company' => $lead['company'],
        'lifecyclestage' => 'lead',
        'hs_lead_status' => 'NEW',
    ];

    // Propriedades customizadas só entram se o portal já as tiver,
    // declaradas explicitamente no config.
    foreach ((array) ($config['hubspot_properties'] ?? []) as $leadKey => $hubspotProperty) {
        $value = $lead[$leadKey] ?? ($lead['answers'][$leadKey] ?? null);
        if ($value !== null && $value !== '') {
            $properties[(string) $hubspotProperty] = is_scalar($value) ? (string) $value : json_encode($value);
        }
    }

    $properties = array_filter($properties, static fn($v): bool => $v !== '' && $v !== null);

    // Upsert por e-mail: reenviar o mesmo lead atualiza em vez de duplicar.
    $upsert = hubspot_request('POST', '/crm/v3/objects/contacts/batch/upsert', [
        'inputs' => [[
            'idProperty' => 'email',
            'id' => $lead['email'],
            'properties' => $properties,
        ]],
    ]);

    if (!$upsert['ok']) {
        return [
            'status' => 'error',
            'http_code' => $upsert['http_code'],
            'message' => $upsert['message'],
        ];
    }

    $contactId = (string) ($upsert['body']['results'][0]['id'] ?? '');
    $result = [
        'status' => 'ok',
        'contact_id' => $contactId,
        'http_code' => $upsert['http_code'],
    ];

    if ($contactId === '') {
        return $result;
    }

    // Negócio no pipeline comercial.
    $dealId = '';
    if (($config['hubspot_create_deal'] ?? true) !== false) {
        [$dealId, $result['deal']] = hubspot_ensure_deal($lead, $contactId);
        if ($dealId !== '') {
            $result['deal_id'] = $dealId;
        }
    }

    // A nota carrega o diagnóstico completo sem exigir propriedade
    // customizada, e fica visível na timeline do contato e do negócio.
    if (($config['hubspot_create_note'] ?? true) !== false) {
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

        $note = hubspot_request('POST', '/crm/v3/objects/notes', [
            'properties' => [
                'hs_timestamp' => round(microtime(true) * 1000),
                'hs_note_body' => hubspot_note_body($lead),
            ],
            'associations' => $associations,
        ]);

        $result['note'] = $note['ok'] ? 'ok' : ('falhou: ' . $note['message']);
    }

    return $result;
}

/**
 * Cria o negócio, a menos que o contato já tenha um negócio aberto.
 *
 * Sem essa verificação, quem refizesse o diagnóstico geraria um negócio
 * duplicado no pipeline a cada envio.
 *
 * @return array{0:string,1:string} [dealId, status legível]
 */
function hubspot_ensure_deal(array $lead, string $contactId): array
{
    $config = lead_config();

    $existing = hubspot_request('GET', '/crm/v4/objects/contacts/' . $contactId . '/associations/deals');
    foreach ($existing['body']['results'] ?? [] as $association) {
        $dealId = (string) ($association['toObjectId'] ?? '');
        if ($dealId === '') {
            continue;
        }

        $deal = hubspot_request('GET', '/crm/v3/objects/deals/' . $dealId . '?properties=dealstage');
        $stage = (string) ($deal['body']['properties']['dealstage'] ?? '');
        if ($stage === '' || strpos($stage, 'closed') === 0) {
            continue;
        }

        // Quem baixou o e-book e agora fez o diagnóstico não pode ficar
        // parado na coluna do topo de funil: o negócio já existe, então
        // ninguém o criaria de novo e o board mentiria.
        $ebookStage = (string) ($config['ebook_deal_stage'] ?? '');
        $diagnosticStage = (string) ($config['hubspot_deal_stage'] ?? 'appointmentscheduled');

        if ($ebookStage !== '' && $stage === $ebookStage && $diagnosticStage !== $ebookStage) {
            $moved = hubspot_request('PATCH', '/crm/v3/objects/deals/' . $dealId, [
                'properties' => ['dealstage' => $diagnosticStage],
            ]);

            return [$dealId, $moved['ok'] ? 'avançado do e-book' : ('avanço falhou: ' . $moved['message'])];
        }

        return [$dealId, 'negócio aberto já existia'];
    }

    $company = $lead['company'] !== '' ? $lead['company'] : $lead['name'];
    $problem = MAIN_PROBLEM_LABELS[$lead['main_problem']] ?? 'Diagnóstico Tecnológico';

    $created = hubspot_request('POST', '/crm/v3/objects/deals', [
        'properties' => [
            'dealname' => $company . ' — ' . $problem,
            'pipeline' => (string) ($config['hubspot_pipeline'] ?? 'default'),
            'dealstage' => (string) ($config['hubspot_deal_stage'] ?? 'appointmentscheduled'),
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

/** Divide o nome informado em firstname / lastname. */
function split_name(string $name): array
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $first = (string) array_shift($parts);
    return [$first, implode(' ', $parts)];
}

/** Traduz o valor cru de uma resposta para o rótulo legível. */
function answer_label(string $question, string $value): string
{
    return ANSWER_LABELS[$question]['options'][$value] ?? ($value !== '' ? $value : '—');
}

/** Corpo da nota: o diagnóstico legível dentro do HubSpot. */
function hubspot_note_body(array $lead): string
{
    $escape = static fn(string $text): string => htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

    $lines = ['<b>Diagnóstico Tecnológico</b>', ''];
    $lines[] = sprintf(
        'Resultado: <b>%s</b> (%d pontos)<br>Potencial comercial: <b>%s</b>',
        $escape(DIAGNOSTIC_LEVEL_LABELS[$lead['diagnostic_level']] ?? $lead['diagnostic_level']),
        $lead['diagnostic_score'],
        $escape(ucfirst((string) $lead['commercial_tier']))
    );
    $lines[] = '';
    $lines[] = '<b>Principal desafio:</b> '
        . $escape(MAIN_PROBLEM_LABELS[$lead['main_problem']] ?? $lead['main_problem']);

    if ($lead['main_problem_other'] !== '') {
        $lines[] = '<i>' . $escape($lead['main_problem_other']) . '</i>';
    }

    $lines[] = '';
    $lines[] = '<b>Respostas</b>';
    foreach (ANSWER_LABELS as $key => $meta) {
        $lines[] = $meta['label'] . ': ' . $escape(answer_label($key, (string) ($lead['answers'][$key] ?? '')));
    }

    $tracking = (array) $lead['tracking'];
    if ($tracking !== []) {
        $lines[] = '';
        $lines[] = '<b>Origem</b>';
        foreach ($tracking as $key => $value) {
            $lines[] = $key . ': ' . $escape((string) $value);
        }
    }

    return implode('<br>', $lines);
}

/**
 * Chamada à API do HubSpot com orçamento de tempo curto.
 * Nunca lança: devolve sempre o resultado normalizado.
 */
function hubspot_request(string $method, string $path, ?array $payload = null): array
{
    $config = lead_config();

    return http_json(
        $method,
        'https://api.hubapi.com' . $path,
        $payload,
        ['Authorization: Bearer ' . $config['hubspot_token']]
    );
}

/**
 * Avisa por e-mail que chegou um lead qualificado.
 *
 * Só as faixas listadas em 'email_tiers' viram notificação — a caixa de
 * entrada é para agir, não para arquivar. O lead frio continua gravado no
 * JSONL e criado no HubSpot; apenas não interrompe ninguém.
 */
function sendEmailNotification(array $lead): array
{
    $config = lead_config();
    if (!$config['email_enabled'] || $config['email_to'] === '') {
        return ['status' => 'disabled'];
    }

    $tiers = array_map('strval', (array) ($config['email_tiers'] ?? []));
    $tier = (string) ($lead['commercial_tier'] ?? '');
    if ($tiers !== [] && !in_array($tier, $tiers, true)) {
        return ['status' => 'skipped', 'reason' => 'tier "' . $tier . '" fora de email_tiers'];
    }

    $sent = ses_send_email(
        (string) $config['email_to'],
        lead_email_subject($lead),
        lead_email_html($lead),
        lead_email_text($lead),
        ['reply_to' => (string) $lead['email']]   // responder cai direto no lead
    );

    if (!$sent['ok']) {
        return ['status' => 'error', 'http_code' => $sent['http_code'], 'message' => $sent['message']];
    }

    return [
        'status' => 'ok',
        'http_code' => $sent['http_code'],
        'message_id' => (string) ($sent['body']['MessageId'] ?? ''),
        'tier' => $tier,
    ];
}

/** Faixa comercial em rótulo legível. */
function commercial_tier_label(string $tier): string
{
    $labels = ['quente' => 'Quente', 'morno' => 'Morno', 'frio' => 'Frio'];
    return $labels[$tier] ?? ucfirst($tier);
}

/** Data do lead no fuso de quem vai ler, não em UTC. */
function lead_local_time(string $iso): string
{
    try {
        $date = new DateTimeImmutable($iso !== '' ? $iso : 'now');
        return $date->setTimezone(new DateTimeZone('America/Sao_Paulo'))->format('d/m/Y H:i');
    } catch (Throwable $exception) {
        return gmdate('d/m/Y H:i') . ' UTC';
    }
}

/**
 * Assunto: o suficiente para decidir se abre agora, direto na lista de
 * e-mails — faixa, empresa e o desafio declarado.
 */
function lead_email_subject(array $lead): string
{
    $company = $lead['company'] !== '' ? $lead['company'] : $lead['name'];

    // Em "Outro", o rótulo genérico não diz nada — o que o lead escreveu diz.
    $problem = MAIN_PROBLEM_LABELS[$lead['main_problem']] ?? 'Diagnóstico Tecnológico';
    if ($lead['main_problem'] === 'outro' && $lead['main_problem_other'] !== '') {
        $problem = str_replace("\n", ' ', $lead['main_problem_other']);
        if (text_length($problem) > 70) {
            $problem = rtrim(function_exists('mb_substr')
                ? mb_substr($problem, 0, 70, 'UTF-8')
                : substr($problem, 0, 70)) . '…';
        }
    }

    return sprintf(
        'Lead %s · %s — %s',
        strtolower(commercial_tier_label((string) $lead['commercial_tier'])),
        $company,
        $problem
    );
}

/** Versão texto — clientes que não renderizam HTML e prévia no celular. */
function lead_email_text(array $lead): string
{
    $lines = [
        sprintf(
            'Lead %s (%d pontos comerciais) — %s',
            commercial_tier_label((string) $lead['commercial_tier']),
            $lead['commercial_score'],
            lead_local_time((string) ($lead['created_at'] ?? ''))
        ),
        '',
        'Nome: ' . $lead['name'],
        'Empresa: ' . $lead['company'],
        'E-mail: ' . $lead['email'],
        'WhatsApp: ' . $lead['phone_e164'],
        '',
        'Principal desafio: ' . (MAIN_PROBLEM_LABELS[$lead['main_problem']] ?? $lead['main_problem']),
    ];

    if ($lead['main_problem_other'] !== '') {
        $lines[] = $lead['main_problem_other'];
    }

    $lines[] = '';
    $lines[] = sprintf(
        'Diagnóstico: %s (%d pontos)',
        DIAGNOSTIC_LEVEL_LABELS[$lead['diagnostic_level']] ?? $lead['diagnostic_level'],
        $lead['diagnostic_score']
    );
    $lines[] = '';
    $lines[] = 'RESPOSTAS';
    foreach (ANSWER_LABELS as $key => $meta) {
        $lines[] = $meta['label'] . ': ' . answer_label($key, (string) ($lead['answers'][$key] ?? ''));
    }

    $tracking = (array) $lead['tracking'];
    if ($tracking !== []) {
        $lines[] = '';
        $lines[] = 'ORIGEM';
        foreach ($tracking as $key => $value) {
            $lines[] = $key . ': ' . $value;
        }
    }

    $lines[] = '';
    $lines[] = 'Lead #' . ($lead['id'] ?? '');

    return implode("\n", $lines);
}

/**
 * Corpo HTML. Tabelas e estilo inline de propósito: cliente de e-mail não
 * entende folha de estilo externa nem flexbox de forma confiável.
 */
function lead_email_html(array $lead): string
{
    $e = static fn($text): string => htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');

    $tier = (string) $lead['commercial_tier'];
    $tierColor = ['quente' => '#b91c1c', 'morno' => '#b45309'][$tier] ?? '#475569';

    $whatsapp = 'https://wa.me/' . (preg_replace('/\D+/', '', (string) $lead['phone_e164']) ?? '');

    // Linhas de "rótulo: valor" com o mesmo desenho em todo o e-mail.
    $row = static function (string $label, string $value) use ($e): string {
        return '<tr>'
            . '<td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap;">'
            . $e($label) . '</td>'
            . '<td style="padding:6px 0;color:#0f172a;font-size:14px;">' . $value . '</td>'
            . '</tr>';
    };

    $contact = $row('Empresa', '<strong>' . $e($lead['company']) . '</strong>')
        . $row('Nome', $e($lead['name']))
        . $row('E-mail', '<a href="mailto:' . $e($lead['email']) . '" style="color:#1d4ed8;">' . $e($lead['email']) . '</a>')
        . $row('WhatsApp', '<a href="' . $e($whatsapp) . '" style="color:#1d4ed8;">' . $e($lead['phone_e164']) . '</a>');

    $answers = '';
    foreach (ANSWER_LABELS as $key => $meta) {
        $answers .= $row($meta['label'], $e(answer_label($key, (string) ($lead['answers'][$key] ?? ''))));
    }

    $origin = '';
    foreach ((array) $lead['tracking'] as $key => $value) {
        $origin .= $row((string) $key, $e($value));
    }
    $origin = $origin === ''
        ? ''
        : '<h2 style="margin:28px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Origem</h2>'
            . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' . $origin . '</table>';

    $problem = '<p style="margin:0;font-size:15px;color:#0f172a;"><strong>'
        . $e(MAIN_PROBLEM_LABELS[$lead['main_problem']] ?? $lead['main_problem']) . '</strong></p>';
    if ($lead['main_problem_other'] !== '') {
        $problem .= '<p style="margin:6px 0 0;font-size:14px;color:#334155;font-style:italic;">'
            . nl2br($e($lead['main_problem_other'])) . '</p>';
    }

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">'

        . '<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' . $tierColor . ';">'
        . 'Lead ' . $e(commercial_tier_label($tier)) . ' · ' . (int) $lead['commercial_score'] . ' pontos comerciais</p>'
        . '<p style="margin:0 0 20px;font-size:13px;color:#64748b;">'
        . $e(lead_local_time((string) ($lead['created_at'] ?? ''))) . '</p>'

        . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
        . $contact . '</table>'

        . '<h2 style="margin:28px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Principal desafio</h2>'
        . $problem

        . '<h2 style="margin:28px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Diagnóstico</h2>'
        . '<p style="margin:0;font-size:15px;color:#0f172a;"><strong>'
        . $e(DIAGNOSTIC_LEVEL_LABELS[$lead['diagnostic_level']] ?? $lead['diagnostic_level'])
        . '</strong> · ' . (int) $lead['diagnostic_score'] . ' pontos</p>'

        . '<h2 style="margin:28px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Respostas</h2>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
        . $answers . '</table>'

        . $origin

        . '<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">'
        . 'Lead #' . $e($lead['id'] ?? '') . ' · responder este e-mail fala direto com o contato.</p>'

        . '</div></body></html>';
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

    // Responde ao visitante antes de falar com serviços externos: o lead já
    // está salvo, então nada daqui pra frente pode segurar o formulário.
    $response['lead_id'] = $record['id'];
    respond_and_continue(201, ['ok' => true, 'data' => $response]);

    logIntegrations($record['id'], [
        'hubspot' => runIntegration('sendToHubSpot', $record),
        'email' => runIntegration('sendEmailNotification', $record),
        'whatsapp' => runIntegration('sendWhatsAppNotification', $record),
    ]);

    exit;
} catch (Throwable $exception) {
    error_log('[leads] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    fail(500, 'internal_error', 'Não foi possível processar o envio agora. Tente novamente em instantes.');
}
