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

