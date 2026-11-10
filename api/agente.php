<?php

declare(strict_types=1);

/**
 * DevBatista — páginas para robôs e agentes de IA.
 *
 * O .htaccess manda para cá só as requisições com cara de robô ou de agente
 * (user agent de bot, crawler ou agente de IA, ou o header Signature-Agent).
 * Pessoas recebem o HTML estático direto do Apache, como sempre.
 *
 * Entrega o mesmo HTML que o Apache entregaria e, depois de responder, avisa
 * o Admin (server_hit), que decide se é um agente de IA. Robô e agente de IA
 * não rodam JavaScript, então o js/visitas.js nunca os vê: esta é a única
 * forma de contá-los. Qualquer falha no aviso é engolida — a página já foi.
 *
 * Com bloqueado=1 (regra 0 do .htaccess, robôs de treino de IA), responde o
 * mesmo 403 de sempre, sem a página, e só conta a tentativa.
 */

$root = dirname(__DIR__);
$page = (string) ($_GET['pagina'] ?? '');
if ($page === '') {
    $page = 'index';
}

// Páginas da raiz (sobre) e posts do blog (blog/slug, blog/index). Nada além
// disso: o padrão fechado impede subir de pasta (../) ou ler outro arquivo.
$file = preg_match('/\A(?:blog\/)?[a-z0-9-]+\z/', $page) ? $root . '/' . $page . '.html' : '';
$found = $file !== '' && is_file($file);
$blocked = ($_GET['bloqueado'] ?? '') === '1';
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($blocked) {
    http_response_code(403);
    header('Content-Type: text/html; charset=iso-8859-1');
    if ($method !== 'HEAD') {
        echo "<!DOCTYPE HTML PUBLIC \"-//IETF//DTD HTML 2.0//EN\">\n<html><head>\n<title>403 Forbidden</title>\n"
            . "</head><body>\n<h1>Forbidden</h1>\n<p>You don't have permission to access this resource.</p>\n</body></html>\n";
    }
} else {
    serve_page($root, $file, $found, $method);
}

// Só conta o que veio pela regra do .htaccess: chamada direta a /api/agente.php não é página.
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
if (!$found || $method !== 'GET' || strpos($uri, '/api/') === 0) {
    exit;
}

try {
    require __DIR__ . '/visitas.php';
    visit_finish_response();
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'www.devbatista.com');
    $event = [
        'type' => 'server_hit',
        'url' => 'https://' . $host . $uri,
    ];
    if ($blocked) {
        $event['blocked'] = true;
    }
    visit_forward($event);
} catch (Throwable $exception) {
    error_log('[visitas] aviso de acesso de robô falhou: ' . $exception->getMessage());
}

/** O mesmo HTML, cabeçalhos de cache e 304 que o Apache daria à página estática. */
function serve_page(string $root, string $file, bool $found, string $method): void
{
    if (!$found) {
        http_response_code(404);
        $file = $root . '/404.html';
    }

    $modified = (int) filemtime($file);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: public, max-age=0, must-revalidate');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $modified) . ' GMT');

    $since = strtotime((string) ($_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? ''));
    if ($found && $since !== false && $since >= $modified) {
        http_response_code(304);
    } elseif ($method !== 'HEAD') {
        header('Content-Length: ' . filesize($file));
        readfile($file);
    }
}
