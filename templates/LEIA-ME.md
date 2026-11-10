# Modelos (não vão para o servidor)

Esta pasta fica fora do deploy (`exclude` em `.github/workflows/.main.yml`).

## Publicar um post no blog

1. Escolha o slug: minúsculas, sem acento, palavras separadas por hífen
   (`o-que-e-um-servidor-mcp`). A URL será `https://www.devbatista.com/blog/<slug>`.
2. Copie `templates/blog-post.html` para `blog/<slug>.html`.
3. Troque **todos** os `TODO` do arquivo (`grep -n TODO blog/<slug>.html` não pode
   retornar nada):
   - `<title>` com até 60 caracteres e `meta description` com até 155, ambos únicos;
   - `canonical`, `og:url`, `@id`, `url` e `mainEntityOfPage` com a URL final;
   - `headline`, `datePublished`, `dateModified` (AAAA-MM-DD) e `article:published_time`;
   - um único `<h1>`; seções em `<h2>`, subseções em `<h3>`;
   - pelo menos um link para a página de serviço relacionada.
4. Em `blog/index.html`:
   - um card do post na lista (há um modelo comentado), do mais novo para o mais antigo;
   - um item em `"blogPost"` no JSON-LD do `Blog`.
5. Em `sitemap.xml`, uma `<url>` com o `<lastmod>` do dia.
6. **No primeiro post:** em `blog/index.html` troque o `noindex` por
   `index, follow, max-image-preview:large`, inclua `/blog/` no sitemap e adicione
   o link "Blog" no menu e no rodapé de todas as páginas.
7. Depois do deploy, teste a URL no Rich Results Test e peça a indexação no
   Search Console (Inspeção de URL).

Não publique cases, clientes, números ou depoimentos que não sejam reais.
