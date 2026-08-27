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
visitante → WhatsApp → diagnóstico → projeto ou contrato recorrente
```

Todos os CTAs comerciais principais apontam para o WhatsApp, com mensagem
pré-preenchida conforme o contexto da página.

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
├── js/main.js            # Interações (vanilla JS, sem dependências)
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

---

## Deploy

Push na branch `main` dispara o workflow do GitHub Actions, que sincroniza os
arquivos por FTP (`.github/workflows/.main.yml`).

O `.htaccess` precisa ser enviado junto — confirme que ele não está na lista de
exclusões do deploy.

---

## Contato

- **WhatsApp:** +55 11 99130-8008
- **E-mail:** rafael@devbatista.com
- **Site:** https://www.devbatista.com
- **CNPJ:** 61.408.507/0001-73
- **Localização:** São Paulo, SP — atendimento em todo o Brasil

---

© 2026 DevBatista. Todos os direitos reservados.
