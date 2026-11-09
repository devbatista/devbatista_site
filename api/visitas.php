<?php

declare(strict_types=1);

/**
 * DevBatista — visitas do site (Admin DevBatista → Marketing → Visitas do site).
 *
 * Funções compartilhadas por api/v.php (o beacon do navegador, js/visitas.js)
 * e api/agente.php (as páginas servidas a robôs e agentes de IA). Só define
 * funções: incluir este arquivo não produz saída.
 *
 * O PHP não decide nada: junta o evento, o IP e os headers da lista e repassa
 * ao Admin (POST /webhooks/site-visits), que classifica, descarta robôs e
 * calcula o visitante anônimo. Nada é gravado aqui.
 */

require_once __DIR__ . '/leads-config.php';

/** Headers repassados ao Admin. Nunca cookie nem autenticação. */
const VISIT_HEADERS = [
    'User-Agent', 'Referer', 'Accept', 'Accept-Language', 'From',
    'Signature-Agent', 'Signature-Input', 'Signature',
    'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'Sec-CH-UA', 'Sec-Purpose', 'Purpose',
];

/** Perder uma página vista é aceitável; segurar o PHP, não. */
const VISIT_TIMEOUT = 2;

/** @return array<string,string> nomes em minúsculas */
function visit_headers(): array
{
    $headers = [];
    foreach (VISIT_HEADERS as $name) {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER[$key] ?? '';
        if ($value !== '') {
            $headers[strtolower($name)] = substr((string) $value, 0, 1000);
        }
    }
    return $headers;
}

/**
 * Só o REMOTE_ADDR. O site não está atrás da Cloudflare, então um
 * CF-Connecting-IP viria do próprio cliente — e um robô falso poderia usá-lo
 * para se passar por um IP oficial da OpenAI na conferência do Admin.
 */
function visit_client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

/** Entrega a resposta ao cliente agora; o repasse ao Admin roda depois. */
function visit_finish_response(): void
{
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    } else {
        // mod_php/CGI: sem como soltar a conexão. O cliente espera no máximo
        // VISIT_TIMEOUT segundos (o beacon nem espera; o robô não se importa).
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        flush();
    }
}

/** Repassa o evento ao Admin. Nunca lança; falha só vai para o log. */
function visit_forward(array $event): void
{
    $config = lead_config();
    if (empty($config['visits_enabled']) || (string) $config['visits_token'] === '') {
        return;
    }

    $event['ip'] = visit_client_ip();
    $event['headers'] = visit_headers();
    if ($event['ip'] === '') {
        return;
    }

    $body = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($body === false) {
        return;
    }

    $headers = [
        'Authorization: Bearer ' . $config['visits_token'],
        'Content-Type: application/json',
    ];
    $url = (string) $config['visits_url'];
    $status = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => VISIT_TIMEOUT,
            CURLOPT_TIMEOUT => VISIT_TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $ok = curl_exec($ch) !== false;
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = $ok ? '' : curl_error($ch);
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'timeout' => VISIT_TIMEOUT,
            'ignore_errors' => true,
        ]]);
        $ok = @file_get_contents($url, false, $context) !== false;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $status = (int) $m[1];
            }
        }
        $error = $ok ? '' : 'falha de conexão (sem cURL)';
    }

    if ($status !== 202) {
        error_log('[visitas] Admin não aceitou o evento ' . ($event['type'] ?? '?') . ': '
            . ($error !== '' ? $error : 'HTTP ' . $status));
    }
}
