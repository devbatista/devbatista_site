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

    // CRM próprio (Admin DevBatista) — recebe o diagnóstico e o e-book.
    // O token é o mesmo SITE_LEADS_TOKEN configurado no Admin. Para testar
    // contra o Admin local: 'http://localhost:3847/webhooks/site-leads'.
    'crm_enabled' => false,
    'crm_url' => 'https://admin.devbatista.com/webhooks/site-leads',
    'crm_token' => '',

    // Entrega do material. A página não baixa mais o PDF: quem informa um
    // e-mail falso não recebe nada.
    'ebook_email_enabled' => false,
    'ebook_download_url' => 'https://www.devbatista.com/materiais/ebook-devbatista-sua-empresa-esta-perdendo-dinheir-com-a-ti.pdf',
    // Remetente do material — pessoal, não o leads@. Vazio cai em email_from.
    'ebook_email_from' => 'rafael@devbatista.com',
    'ebook_email_from_name' => 'Rafael Batista',

    // Notificação por e-mail — API do Amazon SES v2 (api/mailer.php).
    // Em produção estes valores vêm dos secrets do GitHub; ver a seção
    // Deploy do README. Aqui ficam só para teste local.
    'email_enabled' => false,
    'email_to' => 'rafael@devbatista.com',   // vários? separe por vírgula
    'email_from' => 'leads@devbatista.com',  // identidade verificada no SES
    'email_from_name' => 'DevBatista Leads',
    // Quais faixas de potencial comercial viram e-mail. [] = todas.
    'email_tiers' => ['morno', 'quente'],
    'ses_region' => 'sa-east-1',
    'ses_key' => '',      // usuário IAM com a política ses:SendEmail
    'ses_secret' => '',

    // Notificação interna via WhatsApp Cloud API
    'whatsapp_enabled' => false,
    'whatsapp_endpoint' => '',
    'whatsapp_token' => '',
    'whatsapp_to' => '',
];
