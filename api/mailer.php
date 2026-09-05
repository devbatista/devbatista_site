<?php

declare(strict_types=1);

/**
 * DevBatista — envio transacional pela API do Amazon SES v2.
 *
 * A assinatura SigV4 é feita à mão: a hospedagem não tem Composer e o SDK da
 * AWS traria dezenas de megabytes para uma única chamada. Tudo acontece em
 * HTTPS na 443 — nada de SMTP, que hospedagem compartilhada costuma bloquear.
 *
 * Depende de leads-config.php (lead_config() e http_json()).
 */

require_once __DIR__ . '/leads-config.php';

/** Nome do serviço no escopo da assinatura. Vale também para a API v2. */
const SES_SERVICE = 'ses';

/**
 * Assinatura AWS Signature V4 — devolve os cabeçalhos prontos para enviar.
 *
 * Separada de ses_request() para poder ser conferida contra os vetores de
 * teste oficiais da AWS sem tocar em rede nem em configuração.
 *
 * $signedExtra são cabeçalhos adicionais que entram na assinatura (nome em
 * minúsculas). 'host' e 'x-amz-date' já entram sempre.
 * $credentials: ['key', 'secret', 'region', 'service'] e, opcionalmente,
 * 'amz_date' — que só os testes fixam, para o resultado ser reprodutível.
 *
 * @return string[] linhas de cabeçalho HTTP ('Nome: valor')
 */
function aws_sigv4_headers(
    string $method,
    string $host,
    string $path,
    string $body,
    array $signedExtra,
    array $credentials
): array {
    $method = strtoupper($method);
    $region = (string) $credentials['region'];
    $service = (string) $credentials['service'];

    $amzDate = (string) ($credentials['amz_date'] ?? gmdate('Ymd\THis\Z'));
    $dateStamp = substr($amzDate, 0, 8);
    $scope = $dateStamp . '/' . $region . '/' . $service . '/aws4_request';

    $payloadHash = hash('sha256', $body);

    // O SigV4 exige os cabeçalhos assinados em minúsculas e em ordem
    // alfabética — o ksort garante isso independente da ordem de entrada.
    $signed = array_merge(['host' => $host, 'x-amz-date' => $amzDate], $signedExtra);
    ksort($signed);

    $canonicalHeaders = '';
    foreach ($signed as $name => $value) {
        $canonicalHeaders .= $name . ':' . trim((string) $value) . "\n";
    }
    $signedHeaders = implode(';', array_keys($signed));

    // $canonicalHeaders já termina em "\n"; o implode acrescenta a linha em
    // branco que o formato exige antes de SignedHeaders.
    $canonicalRequest = implode("\n", [
        $method,
        $path,
        '',                 // query string vazia
        $canonicalHeaders,
        $signedHeaders,
        $payloadHash,
    ]);

    $stringToSign = implode("\n", [
        'AWS4-HMAC-SHA256',
        $amzDate,
        $scope,
        hash('sha256', $canonicalRequest),
    ]);

    // Chave derivada em cascata: data → região → serviço → aws4_request.
    $signingKey = hash_hmac('sha256', $dateStamp, 'AWS4' . (string) $credentials['secret'], true);
    $signingKey = hash_hmac('sha256', $region, $signingKey, true);
    $signingKey = hash_hmac('sha256', $service, $signingKey, true);
    $signingKey = hash_hmac('sha256', 'aws4_request', $signingKey, true);

    $signature = hash_hmac('sha256', $stringToSign, $signingKey);

    $headers = [
        'Authorization: AWS4-HMAC-SHA256 Credential=' . (string) $credentials['key'] . '/' . $scope
            . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature,
    ];

    // 'host' sai do próprio URL, pelo cliente HTTP; os demais vão explícitos.
    foreach ($signed as $name => $value) {
        if ($name !== 'host') {
            $headers[] = $name . ': ' . $value;
        }
    }

    return $headers;
}

/**
 * Assina e executa uma chamada à API do SES.
 *
 * Nunca lança: devolve o mesmo formato normalizado de http_json(), com
 * ok=false e uma mensagem acionável quando falta credencial.
 *
 * @return array{ok:bool,http_code:int,body:array,message:string}
 */
function ses_request(string $method, string $path, ?array $payload = null): array
{
    $config = lead_config();
    $region = trim((string) ($config['ses_region'] ?? ''));
    $key = trim((string) ($config['ses_key'] ?? ''));
    $secret = trim((string) ($config['ses_secret'] ?? ''));

    if ($region === '' || $key === '' || $secret === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'body' => [],
            'message' => 'credenciais do SES ausentes (ses_region, ses_key, ses_secret)',
        ];
    }

    $host = 'email.' . $region . '.amazonaws.com';

    // O corpo é serializado UMA vez: o hash assinado precisa corresponder
    // byte a byte ao que sobe, senão a AWS devolve SignatureDoesNotMatch.
    $body = $payload === null ? '' : (string) json_encode($payload, JSON_UNESCAPED_UNICODE);

    $headers = aws_sigv4_headers(
        $method,
        $host,
        $path,
        $body,
        ['x-amz-content-sha256' => hash('sha256', $body)],
        ['key' => $key, 'secret' => $secret, 'region' => $region, 'service' => SES_SERVICE]
    );

    $response = http_json($method, 'https://' . $host . $path, $payload === null ? null : $body, $headers);

    // A AWS usa "message" ou "Message" conforme o erro, e o tipo vem em
    // __type. Sem isso o log fica com um "HTTP 400" sem pista nenhuma.
    if (!$response['ok']) {
        $detail = (string) ($response['body']['message'] ?? $response['body']['Message'] ?? '');
        $type = (string) ($response['body']['__type'] ?? '');
        if ($detail !== '') {
            $response['message'] = ($type !== '' ? $type . ': ' : '') . $detail;
        }
    }

    return $response;
}

/**
 * Envia um e-mail. $to aceita vários destinatários separados por vírgula.
 *
 * @return array{ok:bool,http_code:int,body:array,message:string}
 */
function ses_send_email(string $to, string $subject, string $html, string $text, string $replyTo = ''): array
{
    $config = lead_config();

    $from = trim((string) ($config['email_from'] ?? ''));
    if ($from === '') {
        return ['ok' => false, 'http_code' => 0, 'body' => [], 'message' => 'email_from não configurado'];
    }

    $recipients = array_values(array_filter(
        array_map('trim', explode(',', $to)),
        static fn(string $address): bool => filter_var($address, FILTER_VALIDATE_EMAIL) !== false
    ));

    if ($recipients === []) {
        return ['ok' => false, 'http_code' => 0, 'body' => [], 'message' => 'nenhum destinatário válido em email_to'];
    }

    // Nome de exibição sem acento e sem aspas: entra cru no header From, e
    // codificar MIME aqui não vale o risco de quebrar a linha.
    $fromName = preg_replace('/[^A-Za-z0-9 .\-]/', '', (string) ($config['email_from_name'] ?? '')) ?? '';
    $fromName = trim($fromName);

    $payload = [
        'FromEmailAddress' => $fromName !== '' ? $fromName . ' <' . $from . '>' : $from,
        'Destination' => ['ToAddresses' => $recipients],
        'Content' => [
            'Simple' => [
                'Subject' => ['Data' => $subject, 'Charset' => 'UTF-8'],
                'Body' => [
                    'Text' => ['Data' => $text, 'Charset' => 'UTF-8'],
                    'Html' => ['Data' => $html, 'Charset' => 'UTF-8'],
                ],
            ],
        ],
    ];

    // Responder o e-mail cai direto no lead, não na caixa do remetente.
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $payload['ReplyToAddresses'] = [$replyTo];
    }

    return ses_request('POST', '/v2/email/outbound-emails', $payload);
}
