---
name: post-blog-devbatista
description: Pesquisa, escreve e abre um Pull Request com um novo post do blog da DevBatista (devbatista.com/blog), seguindo a pauta em .claude/blog/pauta.md. Use quando pedirem um post novo para o blog ou na execução semanal agendada.
---

# Post do blog da DevBatista

Você escreve UM post por execução e entrega como Pull Request para o Rafael revisar.
Você nunca faz merge, nunca faz push direto na `main` e nunca publica nada.

## 0. Pré-condições (pare se alguma falhar)

1. Trabalhe a partir da `main` atualizada (`git fetch origin main` e branch nova a partir de `origin/main`).
2. A pasta `blog/` precisa existir na `main`, com `blog/index.html` (listagem). Se não existir, **não crie a estrutura do blog** (isso é trabalho do Rafael no Claude Code): pare e avise que o blog ainda não foi publicado.
3. Se já existe PR aberto com o label/título `[blog]` ainda não mergeado, **não abra outro**: avise que há um post esperando revisão e pare. Assim os rascunhos não se acumulam.

## 1. Escolha do tema

1. Leia `.claude/blog/pauta.md`. Pegue o primeiro item com status `pendente`, na ordem da lista (os de base vêm antes).
2. Se não houver item pendente, proponha um tema novo dentro dos pilares da pauta, com base na pesquisa do passo 2, e adicione-o à pauta no mesmo PR.

## 2. Pesquisa (antes de escrever)

Use busca na web e leia as páginas, não só os snippets:
- Os 5 a 8 primeiros resultados no Google para a busca-alvo do item: o que cobrem, o que deixam de fora, profundidade.
- Perguntas reais sobre o tema ("as pessoas também perguntam", fóruns, comunidades).
- Fatos que mudam com o tempo (preços de API, regras da Meta, versões de protocolo, leis): confirme na fonte oficial e cite.
- Leia as páginas do próprio site relacionadas (páginas de serviço, `/solucoes`, `/tech-partner`, posts anteriores em `blog/`) para não contradizer e para linkar.

O objetivo é escrever algo **mais útil e mais concreto** que o que já existe, não uma paráfrase dos concorrentes. Nunca copie trechos: escreva com suas palavras.

## 3. Público e tom

- Leitor: dono ou gestor de pequena e média empresa brasileira (e, em temas técnicos, quem cuida da TI nessas empresas). Não é para grandes corporações.
- Tom: consultor experiente conversando de igual para igual. Direto, prático, sem jargão desnecessário; quando usar termo técnico, explique em uma frase.
- Posicionamento: a DevBatista é "o parceiro de tecnologia da sua empresa", não "uma empresa que faz sites". O caminho comercial é relacionamento recorrente (Tech Partner, automação e IA gerenciada).
- **Nunca** mostre preços da DevBatista. Faixas de mercado só com fonte.
- Português do Brasil, frases curtas, parágrafos de 2 a 4 linhas.

## 4. Regras de honestidade (inegociáveis)

- **Nunca invente** cases, clientes, depoimentos, números de resultado, anos de experiência ou certificações.
- Onde a experiência real do Rafael fortaleceria o texto (um exemplo de projeto, um erro comum que ele já viu, um detalhe do sistema dele), deixe um marcador visível para ele preencher:
  `<!-- TODO RAFAEL: exemplo real de ... -->` e, no texto, um parágrafo curto entre `[TODO: ...]`.
  Use de 1 a 3 TODOs por post, nos pontos que mais ganham com experiência própria.
- Toda afirmação factual verificável precisa de fonte; liste as fontes no corpo do PR.

## 5. Estrutura do post

- 1.200 a 2.000 palavras, a menos que o tema peça menos.
- Um único `<h1>` com o título do post. Seções com `<h2>`, subseções com `<h3>`, sem pular nível.
- Abertura: responda a pergunta principal nos 2 primeiros parágrafos (é o trecho que buscadores e IAs citam).
- Pelo menos um elemento prático: passo a passo, checklist, tabela comparativa, exemplo de código ou de fluxo.
- Seção final de perguntas frequentes (3 a 5) quando o tema tiver dúvidas recorrentes.
- Fechamento com CTA usando o padrão do site: `<a data-lead-modal="blog-<slug>" href="https://wa.me/5511991308008">...</a>` (abre o modal do Diagnóstico Tecnológico).
- Links internos: **obrigatório** pelo menos 1 link para a página de serviço indicada na pauta (se ela ainda não existir na `main`, use `/solucoes`) e 1 a 2 links para outros posts ou páginas relacionadas.

## 6. Arquivos e SEO técnico

1. Crie `blog/<slug>.html` copiando a estrutura do post mais recente em `blog/` (head, menu, rodapé, scripts, versões `?v=` dos CSS/JS). Se ainda não houver post, use `blog/index.html` como base de layout. Não altere CSS/JS globais.
2. Slug: minúsculo, sem acento, palavras separadas por hífen, curto, com a palavra-chave. URL final: `https://www.devbatista.com/blog/<slug>`.
3. `<title>` até 60 caracteres (terminando em `| DevBatista` se couber), `meta description` até 155, ambos únicos.
4. `canonical`, Open Graph e Twitter Card completos, `og:type` = `article`.
5. JSON-LD `BlogPosting` com `headline`, `description`, `datePublished` e `dateModified` (data de hoje, AAAA-MM-DD), `inLanguage: pt-BR`, `mainEntityOfPage`, `author` referenciando o Person do Rafael e `publisher` referenciando `https://www.devbatista.com/#organizacao` (confira os `@id` reais usados nas outras páginas e use os mesmos). Inclua `BreadcrumbList` (Início > Blog > post). Se houver seção de FAQ, inclua `FAQPage`.
6. Imagens: só se agregarem (diagrama, print ilustrativo). Em WebP, com `width`, `height`, `alt` e `loading="lazy"`. Não use foto de pessoa real tirada da web.
7. Atualize `blog/index.html` (card do post no topo da listagem) e `sitemap.xml` (nova URL, com `<lastmod>` se o sitemap usar).
8. Valide antes de commitar: HTML sem tags quebradas, JSON-LD com JSON válido (parse com Python ou Node), contagem de caracteres de title/description, links internos apontando para arquivos que existem.

## 7. Pauta

No mesmo PR, em `.claude/blog/pauta.md`, mude o status do item para `em revisão (PR #n)` e preencha o slug.

## 8. Pull Request

- Branch: `blog/<slug>`. Um commit com mensagem `blog: <título do post>`.
- Título do PR: `[blog] <título do post>`.
- Corpo do PR, nesta ordem:
  1. **Busca-alvo** e por que o post pode ranquear (o que ele cobre que os concorrentes não cobrem, em 2 a 3 linhas).
  2. **TODOs para o Rafael**: lista de cada marcador com o que se espera nele.
  3. **Post para o LinkedIn**: texto pronto de 120 a 200 palavras, primeira pessoa (Rafael), com um gancho na primeira linha e o link do post no final. Sem hashtags em excesso (no máximo 3).
  4. **Fontes** consultadas (título + URL).
  5. **Checklist de revisão**: preencher TODOs; conferir fatos; ler em voz alta; merge publica automaticamente via FTP.
- Não faça merge. Não marque como pronto para merge além de abrir o PR.

## 9. Encerramento

Termine com uma mensagem curta: título do post, link do PR e quantos TODOs ficaram para o Rafael.
