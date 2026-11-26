# DevBatista — IA aplicada a pequenas e médias empresas

![DevBatista](https://www.devbatista.com/images/logo.png)

> IA que trabalha no negócio: atendimento com IA no WhatsApp, automação de tarefas com
> IA e IA conectada aos sistemas da empresa (servidores MCP), sob medida, com implantação
> e acompanhamento mensal. Por trás disso, consultoria de TI, software sob medida e
> parceria tecnológica contínua (Tech Partner).

[![Site](https://img.shields.io/badge/Website-devbatista.com-003366?style=flat-square)](https://www.devbatista.com)
[![GitHub](https://img.shields.io/badge/GitHub-devbatista-333?style=flat-square)](https://github.com/devbatista)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-DevBatista-0077B5?style=flat-square)](https://linkedin.com/company/devbatista)
[![Instagram](https://img.shields.io/badge/Instagram-@_devbatista-E4405F?style=flat-square)](https://instagram.com/_devbatista)

---

## Posicionamento

O site comunica **"IA que trabalha no seu negócio"**, para pequenas e médias
empresas. A home apresenta três ofertas — atendimento com IA no WhatsApp,
automação de tarefas com IA e IA conectada aos sistemas (MCP) — e mostra a IA
funcionando numa demonstração em vídeo (`/#demo`). Consultoria e
desenvolvimento aparecem como a base que sustenta as ofertas ("Como
entregamos"). A prioridade de conversão é:

```
visitante → Diagnóstico Tecnológico → lead qualificado → WhatsApp
          → projeto ou contrato recorrente
```

Os CTAs comerciais principais **não abrem mais o WhatsApp diretamente**: eles
abrem o modal do Diagnóstico Tecnológico, que qualifica o visitante antes do
contato. O WhatsApp entra no fim do fluxo, já com contexto.

Continuam apontando direto para o WhatsApp apenas os canais diretos: o botão
flutuante (`.wa-float`) e a lista "Canais diretos" de `/contato`.

### Públicos

| Público | Necessidade |
|---|---|
| PMEs | processos manuais, planilhas, sistemas que não se comunicam, automação, IA, sistemas internos, modernização |
| Agências e software houses | terceirização de desenvolvimento, ampliação de capacidade técnica, atuação white-label |

### Modelos comerciais

- **Tech Partner** — parceria tecnológica contínua (modelo prioritário)
- **CTO as a Service** — acompanhamento estratégico de tecnologia
- **Automação e IA gerenciada** — desenvolvimento + operação contínua
- **Parceria com agências** — pontual ou recorrente, white-label
- **Projetos pontuais** — porta de entrada para o relacionamento recorrente

Preços não são exibidos em nenhuma página.

---

## Estrutura

```
.
├── index.html            # Home
├── solucoes.html         # Soluções: página central, linka as páginas de serviço
├── automacao-whatsapp.html            # Oferta de IA: atendimento com IA no WhatsApp
├── automacao-de-tarefas-com-ia.html   # Oferta de IA: automação de tarefas com IA
├── servidores-mcp.html                # Oferta de IA: IA conectada aos sistemas (MCP)
├── sistemas-web-sob-medida.html       # Serviço (noindex até revisar o texto)
├── integracoes-entre-plataformas.html # Serviço (noindex até revisar o texto)
├── tech-partner.html     # Tech Partner + CTO as a Service + IA gerenciada
├── para-agencias.html    # Parceria para agências e software houses
├── produtos.html         # Produtos próprios (SaaS) + cases
├── projetos.html         # Projetos pontuais + galeria
├── sobre.html            # Sobre a empresa e o fundador
├── contato.html          # Canais e formulário → api/contato.php → WhatsApp
├── faq.html              # Perguntas frequentes (com schema FAQPage)
├── blog/index.html       # Blog (/blog/), noindex até o primeiro post
├── bio.html              # /bio: link da bio do Instagram (noindex, fora do sitemap)
├── bio-whatsapp.html     # /bio/whatsapp, /bio/site, /bio/linkedin: passagens
├── bio-site.html         #   que contam o clique no Admin e redirecionam
├── bio-linkedin.html     #   (ver "Visitas do site" → Link da bio)
├── templates/            # Modelo de post + LEIA-ME (fora do deploy)
├── 404.html              # Página de erro
├── .htaccess             # URLs limpas, canonicalização, cache, compressão
├── sitemap.xml
├── robots.txt
├── site.webmanifest
├── css/style.css         # Estilos globais (design system + componentes)
├── css/lead-quiz.css     # Modal do Diagnóstico Tecnológico
├── css/bio.css           # Estilos da /bio (independente do style.css)
├── js/main.js            # Interações (vanilla JS, sem dependências)
├── js/lead-quiz.js       # Diagnóstico Tecnológico (modal, scoring, envio)
├── js/visitas.js         # Medição de visitas (beacon para api/v.php)
├── api/leads.php         # Endpoint de recebimento dos leads
├── api/contato.php       # Formulário de /contato → Admin (mesmo webhook dos leads)
├── api/ebook.php         # Landing page do e-book → Admin (o Admin envia o e-mail)
├── api/leads-config.php  # Configuração compartilhada (leads, e-book, contato, health e visitas)
├── api/visitas.php       # Repasse das visitas ao Admin (funções)
├── api/v.php             # Beacon das visitas (pageview e leave)
├── api/agente.php        # Páginas para robôs e agentes de IA (conta os acessos)
├── api/health.php        # Diagnóstico do ambiente (protegido por token)
├── api/config.example.php# Modelo de configuração (copie para config.php)
├── api/storage/          # Leads em JSONL + rate limit (bloqueado por .htaccess)
├── assets/videos/        # Vídeos da demonstração da home (ver "Demonstração em vídeo")
├── tests/                # node --test 'tests/*.test.mjs' (fora do deploy)
└── images/               # Imagens (.webp servidas, .png como originais)
```

Stack: **HTML, CSS e JavaScript puro**. Sem frameworks, sem build step,
sem dependências de runtime.

---

## URLs

O site usa **URLs sem extensão** (`/solucoes`, `/tech-partner`, `/sobre`),
resolvidas pelo `.htaccess` via Apache:

- `/pagina.html` → **301** → `/pagina`
- `/pagina` → serve `pagina.html` (rewrite interno, sem redirect)
- `/pagina/` → **301** → `/pagina`
- `/index.html`, `/index` → **301** → `/` (num salto só; vale para `/blog/index`)
- `/servicos` → **301** → `/solucoes` (endereço antigo)
- `/blog/` serve `blog/index.html`; `/blog/slug` serve `blog/slug.html`
- `/bio/whatsapp`, `/bio/site`, `/bio/linkedin` servem `bio-*.html` (regra 4a);
  `/bio-whatsapp` → **301** → `/bio/whatsapp`. Não crie uma pasta `bio/`: com
  ela, o Apache ignora as regras para `/bio` e redireciona para `/bio/`
- `devbatista.com` e `http://` → **301** → `https://www.devbatista.com`

Os arquivos continuam sendo `.html` no disco. Os links internos, os `canonical`
e o `sitemap.xml` usam sempre a forma limpa.

> **Após o primeiro deploy**, confirme que `https://www.devbatista.com/solucoes`
> responde 200. Se responder 404, o `.htaccess` não subiu ou o `AllowOverride`
> está desativado no servidor — nesse caso, fale com a hospedagem.

---

## Desenvolvimento local

O servidor estático simples **não aplica as regras do `.htaccess`**, então
`/solucoes` dará 404. Para testar as URLs limpas localmente:

```bash
python3 - << 'EOF'
import http.server, os, socketserver
ROOT = os.getcwd()
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0].split('#')[0]
        if p in ('/', ''): return os.path.join(ROOT, 'index.html')
        c = os.path.join(ROOT, p.lstrip('/'))
        if os.path.isfile(c): return c
        if os.path.isfile(c + '.html'): return c + '.html'
        return c
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(("", 8000), H).serve_forever()
EOF
```

Depois acesse `http://localhost:8000`.

O servidor acima **não executa PHP** — o modal do diagnóstico vai mostrar a tela
de erro ao enviar. Para testar o fluxo inteiro, use o servidor embutido do PHP
com um router que emula as URLs limpas:

```bash
cat > /tmp/router.php << 'EOF'
<?php
// $_SERVER['DOCUMENT_ROOT'] é o diretório passado em -t, não o do router.
$root = rtrim($_SERVER['DOCUMENT_ROOT'], '/');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/' || $path === '') { require $root . '/index.html'; return true; }
if (is_file($root . $path)) { return false; }
if (is_file($root . $path . '.html')) { require $root . $path . '.html'; return true; }
http_response_code(404); require $root . '/404.html'; return true;
EOF
php -S 0.0.0.0:8000 -t . /tmp/router.php
```

Depois acesse `http://127.0.0.1:8000`.

> Use `0.0.0.0`, **não** `localhost`. Com `localhost` o PHP escuta apenas em
> IPv6 (`[::1]`), e um servidor estático (Live Server, `http-server`) pode
> ocupar `127.0.0.1:8000` em paralelo sem acusar conflito — o navegador então
> alterna entre os dois e o `POST` do formulário cai no estático, resultando em
> 404. Não deixe os dois rodando juntos: só o PHP executa `api/leads.php`.

---

## Diagnóstico Tecnológico (captação de leads)

Modal de qualificação que substitui o clique direto no WhatsApp nos CTAs
comerciais. Vanilla JS, sem dependências, no mesmo padrão de `js/main.js`.

### Fluxo

```
CTA [data-lead-modal] → intro → identificação → 8 perguntas pontuadas
→ principal desafio → POST /api/leads.php → resultado → WhatsApp
```

### Ligando um CTA ao modal

Basta o atributo `data-lead-modal` no elemento — o valor vira o rótulo do
gatilho em `meta.trigger` e nos eventos de analytics. Um único listener
delegado no `document` cuida de todos:

```html
<a data-lead-modal="tech-partner" href="https://wa.me/...">Falar com especialista</a>
```

O `href` do WhatsApp permanece como fallback: sem JavaScript, ou com
Ctrl/Cmd+clique, o link original continua funcionando.

Abertura programática: `?diagnostico=1`, `#diagnostico` ou
`window.DevBatistaLeadQuiz.open()`.

### Scoring

`QUIZ_SCORING` em `js/lead-quiz.js` (exibição imediata) e `DIAGNOSTIC_SCORING`
em `api/leads.php` (valor oficial). **As duas tabelas precisam ser alteradas
juntas.** O servidor sempre recalcula e ignora o `diagnostic_score` recebido.

| Pontos | Classificação |
|---|---|
| 0–8 | Estrutura tecnológica simples |
| 9–18 | Oportunidades de melhoria |
| 19+ | Alto potencial de otimização |

Existe também um `commercial_score` (`COMMERCIAL_SCORING`, só no PHP) para
priorização interna do lead. **Nunca é devolvido ao navegador nem exibido.**

### Analytics

Os eventos `lead_quiz_opened`, `lead_quiz_started`,
`lead_quiz_identification_completed`, `lead_quiz_completed`, `lead_submitted` e
`lead_whatsapp_clicked` são enviados para o que existir na página
(`dataLayer`/GTM, `gtag`/GA4, `fbq`/Meta) e também emitidos como
`CustomEvent` (`devbatista:<evento>`) no `document`. Nada é instalado pelo
próprio script.

UTMs e identificadores de campanha (`fbclid`, `gclid`, `msclkid`, …) são lidos
da URL na primeira visita e guardados em `sessionStorage`, sobrevivendo à
navegação entre páginas.

### Endpoint

`POST /api/leads.php` com `Content-Type: application/json`.

- **201** `{"ok":true,"data":{diagnostic_score, diagnostic_level, diagnostic_title, lead_id}}`
- **422** erro de validação, com `error.fields` por campo
- **405 / 415 / 400 / 413 / 429 / 403 / 500** com `error.code` e mensagem amigável

Proteções: honeypot invisível, tempo mínimo de preenchimento, rate limit por IP
(5 envios / 10 min), limite de corpo (16 KB), validação de origem, tamanho
máximo por campo e nenhum stack trace na resposta.

Os leads são gravados em `api/storage/leads/AAAA-MM.jsonl` enquanto as
integrações não estão ligadas — **nenhum lead se perde**. Em produção, prefira
apontar `storage_dir` para um diretório fora do document root.

### Verificar o ambiente (`/api/health.php`)

Diagnóstico protegido por token: informa se o PHP executa, se o storage é
**gravável de fato** (testa uma escrita real, não só `is_writable()`), quais
integrações estão ligadas e quantos leads chegaram no mês.

```bash
curl -s "https://www.devbatista.com/api/health.php?token=SEU_TOKEN" | jq
```

Ligue com o secret `HEALTH_TOKEN` no GitHub (ou `health_token` no
`config.php`). **Sem token configurado o endpoint responde 404** — assim como
com token errado, para não revelar que ele existe.

Nunca devolve o valor de um segredo, apenas se está preenchido (`token_set`).

O campo `warnings` é o que importa. O mais grave:

> `STORAGE NÃO GRAVÁVEL: os leads estão sendo perdidos silenciosamente.`

Esse caso é invisível de fora — o endpoint de leads continua respondendo `201`
e o visitante vê o resultado normalmente, mas nada é gravado.

Uma verificação sob demanda, que não cria lead nem dispara e-mail:

```bash
curl -s ".../api/health.php?token=SEU_TOKEN&check=crm" | jq .data.integrations.crm
```

`check=crm` manda um lead vazio ao Admin: ele confere o token antes dos dados,
então a resposta `422` prova conexão e token válidos. `401` é token divergente.

### E-mails dos leads (enviados pelo Admin)

**O site não envia e-mail nenhum.** Os três formulários só gravam o envio no
JSONL e repassam ao Admin DevBatista (`crm_request()`); é o Admin quem manda:

- o aviso de lead para o Rafael — diagnóstico e contato;
- o e-book para o visitante.

Por isso não há SES, remetente nem destinatário configurados aqui: tudo isso
mora no Admin. Sem o Admin ligado (`crm_enabled` + `crm_token`), os leads
continuam gravados, mas ninguém é avisado e o e-book não é entregue — o
`/api/health.php` avisa nesse caso.

### Landing page do e-book (`api/ebook.php`)

O visitante informa o e-mail e **o PDF não é baixado na página**: o site
repassa o pedido ao Admin (`"source": "ebook"`), e o Admin manda o link por
e-mail. Endereço inventado não recebe nada, o que filtra o lead na origem.

O repasse **é** a entrega, então é **síncrono**, ao contrário do diagnóstico e
do contato:

1. grava o pedido em `api/storage/ebook/AAAA-MM.jsonl` (sempre, mesmo que o
   Admin falhe depois);
2. faz `POST` no Admin e espera a resposta por até **8 s**
   (`HTTP_TOTAL_TIMEOUT` em `api/leads-config.php`);
3. `200` ou `201` do Admin → `201` para o visitante ("enviamos o e-book para o
   seu e-mail");
4. qualquer outro código, erro de conexão, Admin desligado ou falta de resposta
   em 8 s → `502` `delivery_failed`, com a mensagem para ele conferir o e-mail e
   tentar de novo.

O resultado de cada entrega fica em `api/storage/integrations/AAAA-MM.jsonl`
com `"source": "ebook"`, e a falha vai também para o log de erro do PHP
(`[ebook] entrega ... não confirmada pelo Admin`).

No CRM o e-book abre um lead "Novo Lead" com origem **Site** e o próprio
e-mail como nome provisório. Quem depois preenche o diagnóstico **não ganha um
segundo lead**: o lead em aberto com o mesmo e-mail é completado com nome,
empresa, WhatsApp e o diagnóstico (ver a seção CRM abaixo).

### Configuração e integrações

A configuração é resolvida em três camadas, nesta ordem de precedência:

```
padrões em lead_config()  →  api/config.php  →  variáveis DEVBATISTA_*
```

Nenhuma delas é obrigatória: sem `config.php` e sem ambiente, tudo roda com os
padrões e as integrações desligadas.

**Local:** copie `api/config.example.php` para `api/config.php` (não versionado).

**Produção:** os secrets do GitHub geram o `api/config.php` durante o deploy —
ver a seção Deploy. Se a hospedagem permitir variáveis de ambiente no painel
(PHP-FPM), prefira `DEVBATISTA_CRM_TOKEN` etc. e dispense o arquivo: aí o
segredo não existe em disco nem passa pelo CI. Aceita `int`, `bool` (`true`/`1`)
e listas separadas por vírgula. **Não** use `SetEnv` no `.htaccess` — ele é
versionado.

A única integração é o Admin, desligada por padrão. No diagnóstico
(`sendToCrm()`) e no contato ela roda **depois** de o visitante já ter
recebido a resposta e nunca derruba o formulário; no e-book ela é a própria
entrega e roda antes (ver acima). O resultado fica em
`api/storage/integrations/AAAA-MM.jsonl`.

### CRM (Admin DevBatista)

O diagnóstico, o contato e o e-book viram lead no CRM próprio, servidor a servidor:
`crm_request()` (em `api/leads-config.php`) faz `POST` em
`https://admin.devbatista.com/webhooks/site-leads` com
`Authorization: Bearer <crm_token>`. O token é o `SITE_LEADS_TOKEN` do Admin;
os dois lados precisam ter o mesmo valor (`openssl rand -hex 32`).

```json
{
  "source": "diagnosis",            // ou "ebook" (só email, site_id e summary)
  "site_id": "a1b2c3d4e5f60718",    // id do envio no JSONL
  "name": "...", "company": "...", "email": "...", "phone": "11987654321",
  "tier": "quente",                 // potencial comercial
  "summary": "uma linha, vai para a timeline do lead",
  "details": "o diagnóstico completo, vai para as observações"
}
```

O Admin não conhece as tabelas do quiz: recebe os textos prontos de
`crm_summary()` e `crm_details()`. Do lado de lá:

- o lead em aberto com o mesmo e-mail é **completado**, não duplicado. Só os
  campos vazios são preenchidos e o diagnóstico novo se soma às observações.
  Lead perdido ou convertido não é reaberto: um envio novo abre outro lead;
- o responsável é o administrador ativo mais antigo;
- cada envio vira uma interação (nota) na timeline;
- o diagnóstico e o contato avisam o responsável, e o e-book é enviado ao
  visitante — todos os e-mails saem do Admin, nenhum daqui;
- o WhatsApp informado vincula sozinho a conversa que já existir com o número.

Respostas: `201` criado, `200` completado, `401` token, `422` dados inválidos
(com `errors`). O resultado fica em `api/storage/integrations/` como `crm`.

### Formulário de contato (`api/contato.php`)

O formulário de `/contato` (`initContactForm()` em `js/main.js`) valida os
campos, faz `POST` JSON em `/api/contato.php` e **abre o WhatsApp em qualquer
desfecho**: com a resposta do PHP, com um erro ou depois de 4 s sem resposta.
A aba nova é aberta ainda no clique (senão o Safari bloqueia o pop-up) e
recebe o endereço do `wa.me` quando o envio termina; com pop-up bloqueado, o
WhatsApp abre na própria aba.

O PHP grava o envio no mesmo `api/storage/leads/AAAA-MM.jsonl` do diagnóstico
(com `"source": "contact"`), responde `201` e só então chama `crm_request()`:

```json
{
  "source": "contact",
  "site_id": "a1b2c3d4e5f60718",
  "name": "...", "company": "...", "email": "...", "phone": "11987654321",
  "need": "whatsapp_ia",
  "consent": true,
  "summary": "Contato pelo site: Atendimento com IA no WhatsApp · Contabilidade",
  "details": "todos os campos preenchidos, um por linha"
}
```

E-mail, empresa, volume de mensagens, "contínuo ou pontual" e o caso são
opcionais (`email` vai vazio quando não preenchido). `consent` é sempre `true`,
porque o envio sem aceite é barrado antes; o Admin o registra nas observações
do lead ("Consentimento de contato: sim"). Honeypot preenchido (`website`) ou
envio em menos de 2 s respondem `200` sem gravar nem enviar nada. Rate limit
próprio (`contato-*` em `storage/ratelimit/`). O resultado da integração fica
em `api/storage/integrations/` com `"source": "contact"`.

No Admin, o `SiteLeadCapture` cria o lead com origem "site", o serviço de
interesse a partir do `need` (agência e "ainda não sei" ficam sem serviço), o
próximo passo "Responder o contato do site pelo WhatsApp" e uma notificação.
Se o Admin estiver fora do ar ou recusar o envio, o contato continua gravado
no JSONL daqui, o erro vai para `storage/integrations/` e o visitante segue
para o WhatsApp normalmente.

As páginas de oferta levam a `/contato?need=<valor>` ("Contar meu caso"), que
já chega com "O que você precisa" selecionado.

As listas de opções existem nos dois lados e **precisam mudar juntas**:
`CONTACT_LABELS` em `js/main.js` e `CONTACT_SEGMENTS`, `CONTACT_NEEDS`,
`CONTACT_VOLUMES` e `CONTACT_ENGAGEMENTS` em `api/contato.php`.

### Páginas de oferta de IA

`/automacao-whatsapp`, `/automacao-de-tarefas-com-ia` e `/servidores-mcp` têm a
mesma estrutura: primeira dobra, quando faz sentido, o que a IA faz, demonstração
(as duas primeiras; a de MCP tem "Como funciona" com exemplos de pergunta),
segurança, implantação, FAQ (também em `FAQPage`), as outras ofertas e a
chamada final. Os textos usam só o que o site já afirma: sem cases, clientes
ou números. Indexadas e no sitemap.

### Demonstração em vídeo (`/#demo`)

Quatro vídeos em abas, em `assets/videos/` (também usados em
`/automacao-whatsapp` e, os dois primeiros, em `/automacao-de-tarefas-com-ia`): `1-duvida-e-lembrete.mp4` (cobre
duas situações), `2-guia-das-e-paguei.mp4`, `3-transbordo-contratacao.mp4` e
`4-tentativa-de-vazamento.mp4`. O `<video>` sai com `preload="none"` e o
endereço em `data-src`; `initDemoVideos()` só põe o `src` quando a seção
chega perto da tela (IntersectionObserver), e só no vídeo da aba aberta. Se o
arquivo não existir, o painel mostra "Vídeo em breve." no lugar do player.

Cada vídeo tem uma capa em `assets/videos/posters/` (mesmo nome, `.jpg`,
1280 px de largura, até 150 KB), um quadro em que a conversa já aparece. Ela
fica em `data-poster` e vira `poster` junto com o `src`: com o atributo
`poster` direto no HTML, o navegador baixaria as quatro capas logo ao abrir a
página, mesmo com `preload="none"`. O player segue a proporção das gravações
(1514x1074, `aspect-ratio` no `.demo-frame`); ao trocar os vídeos por outros
de proporção diferente, ajuste o `aspect-ratio` e o `width`/`height` do
`<video>`. Arquivo novo com o mesmo nome fica preso no cache de 1 ano do
`.jpg`: troque o nome ou acrescente `?v=N` no `data-poster`.

> `css/lead-quiz.css` e `js/lead-quiz.js` são servidos com cache `immutable` de
> 1 ano. Ao editá-los, **incremente o `?v=` nos 9 HTMLs**, senão ninguém verá a
> mudança.

---

## Visitas do site (Admin DevBatista)

As visitas e os acessos de IA vão para o Admin (Marketing → Visitas do site),
que guarda, classifica e mostra. O site não grava nada. Spec completa no Admin:
`docs/specs/visitas-do-site/README.md`.

```
pessoa  → página estática → js/visitas.js → POST /api/v.php ──┐
robô/IA → .htaccess → api/agente.php (mesmo HTML, ou 403) ────┴→ Admin /webhooks/site-visits
```

- **Pessoas.** `js/visitas.js` (em todas as páginas, menos a `404.html`: link
  quebrado não é página vista) manda a página vista e, na saída, o tempo visível. Não cria cookie: o Admin
  calcula um visitante anônimo que muda todo dia e não guarda IP.
- **O que nunca conta.** Antes de qualquer envio, o `js/visitas.js` desiste se
  (1) o host não for exatamente `devbatista.com`, `www.devbatista.com` ou
  `previews.devbatista.com` (localhost, IP e staging ficam de fora), (2) `navigator.webdriver`
  for `true` (Playwright, Puppeteer, Selenium) ou (3) houver o cookie
  `nao_contar=1`.
- **Segunda camada, no Admin.** Todo evento leva `webdriver` (booleano; o
  `api/v.php` descarta qualquer outro valor) e o Admin recebe o `Origin` e o
  `Referer` nos headers. O Admin descarta, com 204, pageview e leave com
  `webdriver: true`, user agent de automação ou Origin/Referer de outro host.
  O `api/v.php` trata qualquer 2xx do Admin como sucesso.
- **Prévias de clientes** (`previews.devbatista.com`, repositório `previews`).
  Carregam este mesmo script por URL absoluta
  (`https://www.devbatista.com/js/visitas.js?v=N`) e, sem PHP lá, mandam os
  eventos para o `/api/v.php` daqui por `sendBeacon`. O `api/v.php` aceita a
  origem delas por `VISIT_EXTRA_ORIGINS` (`api/visitas.php`), fora do
  `allowed_origins`, para não abrir o formulário de leads. Nos protótipos de
  sistema (`/sys/...`), cada mudança de fragmento (`#resumo`) é uma tela nova.
  O Admin conta as prévias à parte, fora dos números do site.
- **Robôs e agentes de IA** não rodam JavaScript. A regra **3c** do `.htaccess`
  manda as páginas pedidas por eles (user agent de bot/IA ou header
  `Signature-Agent`) ao `api/agente.php`, que entrega o mesmo HTML e avisa o
  Admin. Googlebot, Bingbot e os outros buscadores comuns ficam de fora.
- **Robôs de treino bloqueados** (regra **0a**) continuam levando 403, mas as
  páginas passam pelo `api/agente.php`, que conta a tentativa como bloqueada.
  Imagens, CSS e arquivos são barrados direto, sem contar.
- O PHP não classifica nada: quem decide o que é IA é o catálogo do Admin
  (`config/ai_agents.yml`). Um robô novo só precisa entrar na peneira da regra
  3b se o user agent dele não tiver `bot`, `crawl`, `spider`, `-User`, `GPT`,
  `Claude`, `Perplexity`, `anthropic`, `openai`, `meta-external` ou `MistralAI`.
- **Não contar as próprias visitas:** abra qualquer página com `?nao-contar=1`
  (vale para aquele navegador por 400 dias, no site e nas prévias, porque o
  cookie é de `Domain=devbatista.com`; `?nao-contar=0` volta a contar).
  Quem grava o cookie é o `.htaccess` (header `Set-Cookie`, bloco `<If>` no
  fim do `mod_headers`), não o JavaScript: o Safari corta para 7 dias os
  cookies criados por script. Confira com
  `curl -sI 'https://www.devbatista.com/?nao-contar=1' | grep -i set-cookie`.
- **Ao mexer no `js/visitas.js`**, suba o `?v=` dele em todas as páginas (e em
  `templates/blog-post.html` e nas prévias, no repositório `previews`): o JS
  tem cache `immutable` de 1 ano.
- **Testes:** `node --test 'tests/*.test.mjs'` (Node 20+, sem dependências).
  Testam o script nos 4 casos, o cookie do `.htaccess` num Apache temporário
  em HTTPS e o `api/v.php` contra um Admin falso (`php -S`, sem o
  `api/config.php` local). Sem Apache com `mod_ssl` ou sem PHP na máquina, o
  teste correspondente é pulado.
- O IP repassado é só o `REMOTE_ADDR`: o site não está atrás da Cloudflare, e
  um `CF-Connecting-IP` viria do cliente. **Se um dia entrar um proxy na
  frente, ajuste `visit_client_ip()` em `api/visitas.php`.**
- Liga com o secret `SITE_VISITS_TOKEN` (seção Deploy). Sem ele, o script
  continua mandando para `/api/v.php`, que responde 204 e descarta.

### Link da bio (`/bio`)

A `/bio` é o link da bio do Instagram (`@_devbatista`). Use no perfil:
`https://www.devbatista.com/bio?utm_source=instagram&utm_medium=social&utm_campaign=bio`.

O script só conta páginas vistas (não há eventos), então cada botão passa por
uma página de passagem que conta o clique e segue para o destino:

| Botão                 | Passagem         | Destino                               |
|-----------------------|------------------|---------------------------------------|
| Conversar no WhatsApp | `/bio/whatsapp`  | `wa.me` com a mensagem pronta         |
| Conheça o site        | `/bio/site`      | `/` com os mesmos UTMs                |
| LinkedIn              | `/bio/linkedin`  | `linkedin.com/in/rbatist10`           |

- **Cliques no WhatsApp** = páginas vistas de `/bio/whatsapp` no Admin
  (filtro Página). Os UTMs da `/bio` vão junto nos links.
- A passagem carrega o `js/visitas.js` **síncrono** (o envio sai antes do
  redirecionamento) e segue em seguida, ou em 800 ms se o script demorar.
  Sem CSS externo nem fonte, para nada segurar o script. Sem JavaScript, um
  `meta refresh` leva ao destino (sem contar).
- O redirecionamento usa `location.replace`: o "voltar" do celular cai na
  `/bio`, não na passagem.

---

## Imagens

As imagens de conteúdo são servidas em **WebP**. Os `.png` originais permanecem
no repositório como fonte, mas **não são referenciados pelo HTML** (exceto
favicons e logo).

Para gerar novas versões:

```bash
cwebp -q 76 -resize 1600 0 -m 6 imagem.png -o imagem.webp
```

---

## SEO

- `<title>` e `meta description` próprios por página
- Open Graph e Twitter Card
- `canonical` em todas as páginas (URLs limpas, domínio `www`)
- `<title>` com até 60 caracteres e `meta description` com até 155
- Dados estruturados JSON-LD: `ProfessionalService`, `WebSite`, `OfferCatalog`,
  `Service`, `ItemList`, `SoftwareApplication`, `ContactPage`, `FAQPage`,
  `BreadcrumbList`, `Book`, `Blog` e `BlogPosting` (modelo)
- O fundador é um `Person` com `@id` `https://www.devbatista.com/sobre#rafael-batista`
  (o mesmo `id` do card em `/sobre`), `url` e `sameAs` com o LinkedIn. Reutilize esse
  `@id` como autor em posts e materiais
- Imagem de compartilhamento: `images/og-cover.jpg` (1200x630). WebP também existe,
  mas `og:image` fica em JPEG por compatibilidade com WhatsApp e LinkedIn
- `sitemap.xml` (manual, com `<lastmod>`) e `robots.txt`. Ao criar ou alterar uma
  página pública, atualize o `<lastmod>` dela
- Páginas com texto provisório saem com `noindex` e ficam comentadas no sitemap.
  Para achar o que falta revisar: `grep -rn "TODO" --include=*.html .`
- Hierarquia de headings com um único `<h1>` por página

---

## Performance

- CSS e JS únicos, sem bibliotecas externas
- Fonte carregada via `<link>` com `preconnect` (sem `@import` bloqueante)
- `loading="lazy"` e `decoding="async"` nas imagens de conteúdo
- `width`/`height` declarados para evitar layout shift
- Cache de longo prazo e compressão configurados no `.htaccess`
- CSS e JS próprios têm cache `immutable` de 1 ano: todo `<link>`/`<script>` local
  leva `?v=N`. **Ao editar o arquivo, incremente o `?v=` em todos os HTMLs que o
  carregam** (`grep -rn "main.js?v=" --include=*.html .`), senão quem já visitou o
  site continua com a versão antiga
- `background-attachment: fixed` desativado no mobile

---

## Acessibilidade

- HTML semântico (`main`, `section`, `article`, `aside`, `nav`)
- `aria-expanded` / `aria-controls` no menu mobile, com fechamento por `Esc`
- `aria-current="page"` no item ativo da navegação
- Foco visível (`:focus-visible`) e alvos de toque com no mínimo 48px
- `alt` descritivo em todas as imagens
- `prefers-reduced-motion` respeitado
- Modal do diagnóstico com `role="dialog"`, `aria-modal`, focus trap, `Esc`
  para fechar, retorno do foco ao CTA de origem, `aria-live` nas mudanças de
  etapa e seleção indicada por marca + borda (não só por cor)

---

## Deploy

Push na branch `main` dispara o workflow do GitHub Actions, que sincroniza os
arquivos por FTP (`.github/workflows/.main.yml`).

O `.htaccess` precisa ser enviado junto — confirme que ele não está na lista de
exclusões do deploy. O mesmo vale para `api/storage/.htaccess`, que impede o
acesso web aos leads gravados.

### Secrets das integrações

O `api/config.php` está no `.gitignore`, então não vem no checkout. O workflow
o **gera** antes do sync, a partir dos secrets do repositório, e é esse arquivo
gerado que sobe por FTP.

| Secret | Liga |
|---|---|
| `CRM_TOKEN` | CRM próprio (Admin DevBatista) — liga o diagnóstico, o contato **e** a entrega do e-book. Mesmo valor do `SITE_LEADS_TOKEN` do Admin |
| `SITE_VISITS_TOKEN` | Visitas do site e acessos de IA (Admin → Marketing → Visitas do site). Mesmo valor do `SITE_VISITS_TOKEN` do Admin, separado do de leads |
| `HEALTH_TOKEN` | O `/api/health.php` (sem ele, responde 404) |

Os e-mails não têm secret aqui: saem do Admin (ver "E-mails dos leads").

Cada integração liga sozinha quando o secret correspondente existe. Sem nenhum
secret, o arquivo sai com tudo desligado — igual ao padrão do `leads.php`.

A geração usa `var_export()`, então um segredo com aspas, `$` ou barras não
quebra o arquivo nem injeta código. O step valida com `php -l` e **nunca
imprime o conteúdo** — um `cat` de debug ali vazaria o token, porque o
mascaramento do GitHub não cobre valor derivado.

Três coisas para saber:

- Se você remover o step de geração, o FTP-Deploy vai **apagar** o `config.php`
  do servidor, porque passou a rastrear o arquivo. As integrações somem sem aviso.
- O arquivo gerado **sobrescreve** qualquer `config.php` criado à mão no servidor.
- Quem tem push na `main` consegue exfiltrar os secrets. É inerente a CI.

`api/storage/leads/` e `api/storage/ratelimit/` estão no `exclude` do sync, para
o deploy nunca encostar nos leads já gravados.

---

## Contato

- **WhatsApp:** +55 11 99130-8008
- **E-mail:** rafael@devbatista.com
- **Site:** https://www.devbatista.com
- **CNPJ:** 61.408.507/0001-73
- **Localização:** São Paulo, SP — atendimento em todo o Brasil

---

© 2026 DevBatista. Todos os direitos reservados.
