# Materiais para download

Arquivos entregues após a conversão nas landing pages.

## Arquivos esperados

| Arquivo | Usado por |
| --- | --- |
| `ebook-devbatista-sua-empresa-esta-perdendo-dinheir-com-a-ti.pdf` | `/sua-empresa-esta-perdendo-dinheiro-com-a-ti-sem-perceber` — e-book "Sua empresa está perdendo dinheiro com a TI sem perceber?" |

O PDF **não é entregue pela página**: `api/ebook.php` manda o link por e-mail
depois que o visitante informa o endereço. A URL fica em `ebook_download_url`
(`api/config.php`), gerado pelo deploy a partir de `.github/workflows/.main.yml`.
Se o PDF mudar de nome, ajuste nesses dois lugares — o front não conhece mais
o arquivo.

Como o link é público, quem tiver o endereço baixa sem preencher nada. Isso é
proposital: o mesmo link precisa funcionar quando o lead abrir o e-mail dias
depois, em outro dispositivo.

> O diretório se chama `materiais/` para ficar separado das páginas: um
> diretório com o mesmo nome de uma página faria o Apache sequestrar a URL.

## Capa do e-book

A capa do mockup 3D já foi extraída da página 1 do PDF e está em
`images/ebook-capa.png` (760x1074) e `images/ebook-capa.webp`. Se o PDF mudar,
regere as duas. Se os arquivos sumirem, `js/ebook.js` detecta a falha de
carregamento e exibe a capa desenhada em CSS como fallback.

Para regerar a capa a partir do PDF:

```sh
pdftoppm -png -r 150 -f 1 -l 1 materiais/*.pdf /tmp/ebook-capa
python3 -c "
from PIL import Image
im = Image.open('/tmp/ebook-capa-01.png')
out = im.resize((760, round(760*im.height/im.width)), Image.LANCZOS).convert('RGB')
out.save('images/ebook-capa.png', optimize=True)
out.save('images/ebook-capa.webp', quality=88, method=6)
"
```
