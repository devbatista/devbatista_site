<?php

declare(strict_types=1);

/**
 * DevBatista — configuração compartilhada do endpoint de leads.
 *
 * Usado por leads.php e health.php. Só define funções: incluir este
 * arquivo não produz saída nem efeito colateral.
 */

// ============================================================
// Configuração
// Segredos ficam fora do código: api/config.php (não versionado) ou
// variáveis de ambiente. Ver api/config.example.php.
// ============================================================
function lead_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $defaults = [
        'storage_dir' => __DIR__ . '/storage',
        'allowed_origins' => ['https://www.devbatista.com', 'https://devbatista.com'],
        'rate_limit_enabled' => true,
        'rate_limit_max' => 5,          // envios por IP
        'rate_limit_window' => 600,     // em 10 minutos
        'health_token' => '',           // vazio = /api/health.php responde 404
        'hubspot_enabled' => false,
        'hubspot_token' => '',
        'hubspot_portal_id' => '',
        'hubspot_create_note' => true,  // anexa o diagnóstico como nota no contato e no negócio
        'hubspot_create_deal' => true,  // cria negócio no pipeline comercial
        'hubspot_pipeline' => 'default',              // "Novos negócios"
        'hubspot_deal_stage' => 'appointmentscheduled', // "Oportunidade identificada"
        'hubspot_properties' => [],     // ['diagnostic_score' => 'nome_da_prop_no_portal']
        // Landing page do e-book (api/ebook.php). Topo de funil: cria o
        // contato como subscriber, sem abrir negócio no pipeline.
        'ebook_hubspot_enabled' => false,
        'ebook_hubspot_note' => true,   // registra a origem/UTM como nota no contato
        'email_enabled' => false,
        'email_to' => '',
        'email_from' => '',
        'ses_region' => '',
        'whatsapp_enabled' => false,
        'whatsapp_endpoint' => '',
        'whatsapp_token' => '',
        'whatsapp_to' => '',
    ];

    $file = __DIR__ . '/config.php';
    $fromFile = is_readable($file) ? (require $file) : [];
    if (!is_array($fromFile)) {
        $fromFile = [];
    }

    // Variáveis de ambiente têm a última palavra (útil em CI/hospedagem).
    // getenv() não enxerga SetEnv do Apache em todas as SAPIs; $_SERVER e
    // $_ENV cobrem PHP-FPM, mod_php e CGI.
    $fromEnv = [];
    foreach (array_keys($defaults) as $key) {
        $name = 'DEVBATISTA_' . strtoupper($key);
        $env = $_SERVER[$name] ?? $_ENV[$name] ?? getenv($name);

        if ($env === false || $env === null || $env === '') {
            continue;
        }

        if (is_bool($defaults[$key])) {
            $fromEnv[$key] = filter_var($env, FILTER_VALIDATE_BOOLEAN);
        } elseif (is_int($defaults[$key])) {
            $fromEnv[$key] = (int) $env;
        } elseif (is_array($defaults[$key])) {
            // Lista separada por vírgula: "https://a.com,https://b.com"
            $fromEnv[$key] = array_values(array_filter(array_map('trim', explode(',', (string) $env))));
        } else {
            $fromEnv[$key] = (string) $env;
        }
    }

    $config = array_merge($defaults, $fromFile, $fromEnv);
    return $config;
}

// ============================================================
// Armazenamento
// ============================================================
function storage_dir(string $sub = ''): ?string
{
    $base = rtrim((string) lead_config()['storage_dir'], '/');
    $path = $sub === '' ? $base : $base . '/' . $sub;

    if (!is_dir($path) && !@mkdir($path, 0750, true) && !is_dir($path)) {
        return null;
    }
    return is_writable($path) ? $path : null;
}


// ============================================================
// Cliente HTTP
// ============================================================

/** Tempo máximo, em segundos, que uma integração pode consumir. */
const HTTP_CONNECT_TIMEOUT = 3;
const HTTP_TOTAL_TIMEOUT = 8;

/**
 * POST/GET JSON com orçamento de tempo curto.
 *
 * Nunca lança e nunca devolve o corpo cru num erro — só o suficiente para
 * diagnosticar. Usa cURL quando disponível; cai para stream context.
 *
 * @return array{ok:bool,http_code:int,body:array,message:string}
 */
function http_json(string $method, string $url, ?array $payload = null, array $headers = []): array
{
    $method = strtoupper($method);
    $body = $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE);
    $headers = array_merge($headers, ['Accept: application/json']);
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $raw = null;
    $status = 0;
    $transportError = '';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => HTTP_CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT => HTTP_TOTAL_TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($raw === false) {
            $transportError = curl_error($ch) ?: 'falha de conexão';
        }
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body ?? '',
            'timeout' => HTTP_TOTAL_TIMEOUT,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $context);
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $status = (int) $m[1];
            }
        }
        if ($raw === false) {
            $transportError = 'falha de conexão (sem cURL)';
        }
    }

    if ($transportError !== '') {
        return ['ok' => false, 'http_code' => 0, 'body' => [], 'message' => $transportError];
    }

    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    $ok = $status >= 200 && $status < 300;
    $message = $ok ? '' : (string) ($decoded['message'] ?? ('HTTP ' . $status));

    return ['ok' => $ok, 'http_code' => $status, 'body' => $decoded, 'message' => $message];
}
