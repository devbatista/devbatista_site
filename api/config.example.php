<?php

declare(strict_types=1);

/**
 * Modelo de configuração dos endpoints de api/ (leads, e-book, contato,
 * visitas e health).
 *
 * Copie para api/config.php e preencha. O arquivo config.php NÃO é
 * versionado (ver .gitignore) e não deve conter nada em texto claro que
 * você não possa rotacionar.
 *
 * Alternativa: definir variáveis de ambiente DEVBATISTA_<CHAVE_EM_MAIÚSCULAS>
 * (ex.: DEVBATISTA_CRM_TOKEN). O ambiente tem precedência sobre este arquivo.
 */

return [
    // Onde ficam os leads em JSONL e os contadores de rate limit.
    // Se a hospedagem permitir, aponte para fora do document root.
    'storage_dir' => __DIR__ . '/storage',

    'allowed_origins' => [
        'https://www.devbatista.com',
        'https://devbatista.com',
    ],

    // Anti-spam
    'rate_limit_enabled' => true,
    'rate_limit_max' => 5,
    'rate_limit_window' => 600,

    // Token do /api/health.php. Vazio = endpoint responde 404.
    'health_token' => '',

    // CRM próprio (Admin DevBatista) — recebe o diagnóstico, o contato e o
    // e-book. É o Admin quem manda os e-mails: o aviso de lead para o Rafael
    // e o e-book para o visitante. Desligado, o e-book não é entregue.
    // O token é o mesmo SITE_LEADS_TOKEN configurado no Admin. Para testar
    // contra o Admin local: 'http://localhost:3847/webhooks/site-leads'.
    'crm_enabled' => false,
    'crm_url' => 'https://admin.devbatista.com/webhooks/site-leads',
    'crm_token' => '',

    // Visitas do site (Admin → Marketing → Visitas do site): as páginas
    // vistas (js/visitas.js → api/v.php) e os acessos de IA (api/agente.php).
    // O token é o SITE_VISITS_TOKEN do Admin, separado do de leads. Para
    // testar contra o Admin local: 'http://localhost:3847/webhooks/site-visits'.
    'visits_enabled' => false,
    'visits_url' => 'https://admin.devbatista.com/webhooks/site-visits',
    'visits_token' => '',
];
