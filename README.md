# DevBatista — Consultoria e Soluções em Tecnologia

![DevBatista](https://www.devbatista.com/images/logo.png)

> Consultoria de TI, desenvolvimento de software sob medida, automação, inteligência
> artificial e integrações para empresas. Atuamos em projetos pontuais e como parceiro
> tecnológico contínuo (Tech Partner).

[![Site](https://img.shields.io/badge/Website-devbatista.com-003366?style=flat-square)](https://www.devbatista.com)
[![GitHub](https://img.shields.io/badge/GitHub-devbatista-333?style=flat-square)](https://github.com/devbatista)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-DevBatista-0077B5?style=flat-square)](https://linkedin.com/company/devbatista)
[![Instagram](https://img.shields.io/badge/Instagram-@_devbatista-E4405F?style=flat-square)](https://instagram.com/_devbatista)

---

## Posicionamento

O site comunica **"somos o parceiro de tecnologia da sua empresa"** — e não
"desenvolvemos sites e sistemas". A prioridade de conversão é:

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
├── solucoes.html         # Soluções (consultoria, software, automação e IA)
├── tech-partner.html     # Tech Partner + CTO as a Service + IA gerenciada
├── para-agencias.html    # Parceria para agências e software houses
├── produtos.html         # Produtos próprios (SaaS) + cases
├── projetos.html         # Projetos pontuais + galeria
├── sobre.html            # Sobre a empresa e o fundador
├── contato.html          # Canais e briefing → WhatsApp
├── faq.html              # Perguntas frequentes (com schema FAQPage)
├── servicos.html         # Redirecionamento legado → /solucoes
├── 404.html              # Página de erro
├── .htaccess             # URLs limpas, canonicalização, cache, compressão
├── sitemap.xml
├── robots.txt
├── site.webmanifest
├── css/style.css         # Estilos globais (design system + componentes)
├── css/lead-quiz.css     # Modal do Diagnóstico Tecnológico
├── js/main.js            # Interações (vanilla JS, sem dependências)
├── js/lead-quiz.js       # Diagnóstico Tecnológico (modal, scoring, envio)
├── api/leads.php         # Endpoint de recebimento dos leads
├── api/config.example.php# Modelo de configuração (copie para config.php)
├── api/storage/          # Leads em JSONL + rate limit (bloqueado por .htaccess)
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
php -S localhost:8000 -t . /tmp/router.php
```

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

### Configuração e integrações

Copie `api/config.example.php` para `api/config.php` (não versionado) ou use
variáveis de ambiente `DEVBATISTA_<CHAVE>`. As integrações ficam desligadas por
padrão, cada uma em sua função: `sendToHubSpot()`, `sendEmailNotification()` e
`sendWhatsAppNotification()`. Nenhuma delas derruba a resposta ao visitante.

> `css/lead-quiz.css` e `js/lead-quiz.js` são servidos com cache `immutable` de
> 1 ano. Ao editá-los, **incremente o `?v=` nos 9 HTMLs**, senão ninguém verá a
> mudança.

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
- Dados estruturados JSON-LD: `ProfessionalService`, `WebSite`, `OfferCatalog`,
  `Service`, `ItemList`, `SoftwareApplication`, `ContactPage`, `FAQPage`
- `sitemap.xml` e `robots.txt`
- Hierarquia de headings com um único `<h1>` por página

---

## Performance

- CSS e JS únicos, sem bibliotecas externas
- Fonte carregada via `<link>` com `preconnect` (sem `@import` bloqueante)
- `loading="lazy"` e `decoding="async"` nas imagens de conteúdo
- `width`/`height` declarados para evitar layout shift
- Cache de longo prazo e compressão configurados no `.htaccess`
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

`api/config.php` e o conteúdo de `api/storage/leads/` e `api/storage/ratelimit/`
estão no `.gitignore` e **não sobem pelo deploy** — configure-os direto no
servidor.

---

## Contato

- **WhatsApp:** +55 11 99130-8008
- **E-mail:** rafael@devbatista.com
- **Site:** https://www.devbatista.com
- **CNPJ:** 61.408.507/0001-73
- **Localização:** São Paulo, SP — atendimento em todo o Brasil

---

© 2026 DevBatista. Todos os direitos reservados.
