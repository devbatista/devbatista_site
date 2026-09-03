<?php

declare(strict_types=1);

/**
 * Modelo de configuração de api/leads.php.
 *
 * Copie para api/config.php e preencha. O arquivo config.php NÃO é
 * versionado (ver .gitignore) e não deve conter nada em texto claro que
 * você não possa rotacionar.
 *
 * Alternativa: definir variáveis de ambiente DEVBATISTA_<CHAVE_EM_MAIÚSCULAS>
 * (ex.: DEVBATISTA_HUBSPOT_TOKEN). O ambiente tem precedência sobre este arquivo.
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

    // HubSpot — Private App token
    'hubspot_enabled' => false,
    'hubspot_token' => '',
    'hubspot_portal_id' => '',

    // Notificação por e-mail (AWS SES ou SMTP)
    'email_enabled' => false,
    'email_to' => 'rafael@devbatista.com',
    'email_from' => 'no-reply@devbatista.com',
    'ses_region' => 'sa-east-1',

    // Notificação interna via WhatsApp Cloud API
    'whatsapp_enabled' => false,
    'whatsapp_endpoint' => '',
    'whatsapp_token' => '',
    'whatsapp_to' => '',
];
