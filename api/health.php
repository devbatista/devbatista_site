<?php

declare(strict_types=1);

/**
 * DevBatista — Diagnóstico do endpoint de leads.
 *
 * Responde se o ambiente está apto a receber leads: PHP executando, storage
 * gravável, configuração carregada e quais integrações estão ligadas.
 *
 * NUNCA devolve o valor de nenhum segredo — apenas se está preenchido.
 *
 * Protegido por token. Sem token configurado, responde 404: o endpoint
 * simplesmente não existe para quem não deveria alcançá-lo.
 *
 *   GET /api/health.php?token=...
 *   GET /api/health.php   (com header X-Health-Token)
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

require_once __DIR__ . '/leads-config.php';

/** Traduz a falha do HubSpot em algo acionável, sem repetir o corpo cru. */
function hubspot_hint(array $ping): string
{
    switch ($ping['http_code']) {
        case 0:
            return 'não foi possível conectar à api.hubapi.com: ' . $ping['message']
                . ' (a hospedagem pode estar bloqueando conexões de saída)';
        case 401:
            return 'token inválido ou revogado';
        case 403:
            return 'token válido, mas sem o escopo crm.objects.contacts.read/write no Private App';
        case 429:
            return 'limite de requisições do HubSpot atingido';
        default:
            return $ping['message'] !== '' ? $ping['message'] : ('HTTP ' . $ping['http_code']);
    }
}

/** Some sem deixar rastro: mesma resposta para token ausente, errado ou desligado. */
function health_not_found(): void
{
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => ['code' => 'not_found']]);
    exit;
}

try {
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        health_not_found();
    }

    $config = lead_config();
    $expected = (string) ($config['health_token'] ?? '');
    if ($expected === '') {
        health_not_found();
    }

    $given = (string) ($_GET['token'] ?? $_SERVER['HTTP_X_HEALTH_TOKEN'] ?? '');
    if ($given === '' || !hash_equals($expected, $given)) {
        health_not_found();
    }

    // ------------------------------------------------------------
    // Storage: testa gravação de verdade, não só is_writable().
    // Permissão de diretório em hospedagem compartilhada engana.
    // ------------------------------------------------------------
    $storage = ['configured' => (string) $config['storage_dir']];
    $dir = storage_dir('leads');

    if ($dir === null) {
        $storage['writable'] = false;
        $storage['detail'] = 'não foi possível criar ou escrever em ' . $config['storage_dir'] . '/leads';
    } else {
        $probe = $dir . '/.probe-' . bin2hex(random_bytes(4));
        $wrote = @file_put_contents($probe, 'ok') !== false;
        $readBack = $wrote && @file_get_contents($probe) === 'ok';
        @unlink($probe);

        $storage['writable'] = $readBack;
        if (!$readBack) {
            $storage['detail'] = 'diretório existe mas a escrita falhou';
        }
    }

    // Volume já recebido, por mês corrente.
    $leadsFile = rtrim((string) $config['storage_dir'], '/') . '/leads/' . gmdate('Y-m') . '.jsonl';
    $storage['leads_this_month'] = is_readable($leadsFile)
        ? max(0, count(file($leadsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)))
        : 0;
    $storage['last_lead_at'] = is_readable($leadsFile) ? gmdate('c', (int) filemtime($leadsFile)) : null;

    // ------------------------------------------------------------
    // Integrações: só o estado, nunca o valor da credencial.
    // ------------------------------------------------------------
    $secretSet = static fn(string $key): bool => ((string) ($config[$key] ?? '')) !== '';

    $integrations = [
        'hubspot' => [
            'enabled' => (bool) $config['hubspot_enabled'],
            'token_set' => $secretSet('hubspot_token'),
            'portal_id_set' => $secretSet('hubspot_portal_id'),
            'implemented' => true,
            'creates_note' => (bool) ($config['hubspot_create_note'] ?? true),
        ],
        'email' => [
            'enabled' => (bool) $config['email_enabled'],
            'to_set' => $secretSet('email_to'),
            'from_set' => $secretSet('email_from'),
            'region_set' => $secretSet('ses_region'),
            'implemented' => false,
        ],
        'whatsapp' => [
            'enabled' => (bool) $config['whatsapp_enabled'],
            'token_set' => $secretSet('whatsapp_token'),
            'endpoint_set' => $secretSet('whatsapp_endpoint'),
            'implemented' => false,
        ],
    ];

    // ------------------------------------------------------------
    // Teste de conectividade real, sob demanda: ?check=hubspot
    // Read-only — não cria contato nem nota.
    // ------------------------------------------------------------
    if (($_GET['check'] ?? '') === 'hubspot') {
        if (!$integrations['hubspot']['enabled']) {
            $integrations['hubspot']['live_check'] = ['status' => 'skipped', 'reason' => 'integração desligada'];
        } else {
            $ping = http_json('GET', 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1', null, [
                'Authorization: Bearer ' . $config['hubspot_token'],
            ]);

            $integrations['hubspot']['live_check'] = $ping['ok']
                ? ['status' => 'ok', 'http_code' => $ping['http_code'], 'detail' => 'token válido e com acesso a contatos']
                : ['status' => 'failed', 'http_code' => $ping['http_code'], 'detail' => hubspot_hint($ping)];
        }
    }

    // ------------------------------------------------------------
    // Avisos: o que está configurado mas não vai funcionar.
    // ------------------------------------------------------------
    $warnings = [];

    if ($storage['writable'] !== true) {
        $warnings[] = 'STORAGE NÃO GRAVÁVEL: os leads estão sendo perdidos silenciosamente.';
    }
    if (!is_readable(__DIR__ . '/config.php')) {
        $warnings[] = 'api/config.php ausente — rodando com os padrões do código.';
    }
    foreach ($integrations as $name => $state) {
        if ($state['enabled'] && !$state['implemented']) {
            $warnings[] = sprintf('%s: configurado, mas a função ainda é um stub (nada é enviado).', $name);
        }
    }
    $docRoot = realpath(__DIR__ . '/..');
    $storagePath = realpath((string) $config['storage_dir']);
    if ($docRoot !== false && $storagePath !== false && strpos($storagePath, $docRoot . DIRECTORY_SEPARATOR) === 0) {
        $warnings[] = 'storage_dir está dentro do document root; protegido por .htaccess, mas um diretório fora dele é mais seguro.';
    }

    echo json_encode([
        'ok' => $storage['writable'] === true,
        'data' => [
            'checked_at' => gmdate('c'),
            'php_version' => PHP_VERSION,
            'sapi' => PHP_SAPI,
            'curl' => function_exists('curl_init'),
            'background_after_response' => function_exists('fastcgi_finish_request'),
            'config_file' => is_readable(__DIR__ . '/config.php'),
            'rate_limit' => [
                'enabled' => (bool) $config['rate_limit_enabled'],
                'max' => (int) $config['rate_limit_max'],
                'window_seconds' => (int) $config['rate_limit_window'],
            ],
            'storage' => $storage,
            'integrations' => $integrations,
            'warnings' => $warnings,
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
} catch (Throwable $exception) {
    error_log('[health] ' . $exception->getMessage() . ' @ ' . $exception->getFile() . ':' . $exception->getLine());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => ['code' => 'internal_error']]);
}
