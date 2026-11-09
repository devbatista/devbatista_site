<?php

declare(strict_types=1);

/**
 * DevBatista — beacon das visitas (js/visitas.js → aqui → Admin).
 *
 * Recebe pageview e leave do navegador, responde 204 na hora e repassa ao
 * Admin com o IP e os headers. O token do Admin nunca vai ao navegador, e a
 * chamada fica no mesmo domínio do site (sem CORS).
 */

require __DIR__ . '/visitas.php';

header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit;
}

// Chamada de outro site não conta. O beacon do próprio site manda Origin
// igual ao do site, ou nenhum.
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && !in_array($origin, (array) lead_config()['allowed_origins'], true)) {
    http_response_code(403);
    exit;
}

$raw = file_get_contents('php://input', false, null, 0, 4097);
http_response_code(204);
visit_finish_response();

if (!is_string($raw) || $raw === '' || strlen($raw) > 4096) {
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data) || !in_array($data['type'] ?? '', ['pageview', 'leave'], true)) {
    exit;
}

// Só os campos do script. IP e headers vêm do servidor, nunca do navegador.
$fields = ['type', 'id', 'url', 'referrer', 'screen_width', 'duration_ms'];
visit_forward(array_intersect_key($data, array_flip($fields)));
