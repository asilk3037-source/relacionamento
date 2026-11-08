#!/usr/bin/env bash
# Monta o site estático (GitHub Pages) em _site/: vitrine, protótipo navegável, documentação e galeria de arte.
# O app completo precisa da API (Node) e NÃO roda em hospedagem estática — veja docs/IMPLEMENTACAO.md.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=_site; rm -rf "$OUT"; mkdir -p "$OUT/docs" "$OUT/prototipo" "$OUT/arte"
CSS='<style>:root{color-scheme:light dark;--p:#2865EB}body{font:17px/1.65 system-ui,sans-serif;max-width:820px;margin:0 auto;padding:24px 18px 70px}a{color:var(--p)}pre{overflow:auto;padding:12px;border-radius:10px;background:rgba(127,127,127,.14);white-space:pre-wrap}code{font-size:.92em}table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid rgba(127,127,127,.35);padding:6px 10px;text-align:left}@media(prefers-color-scheme:dark){:root{--p:#FF672E}}nav{margin-bottom:24px}</style>'
for f in ARTE-PROMPTS IMPLEMENTACAO ANDROID; do
  pandoc "docs/$f.md" -f gfm -s --metadata title="Elo — $f" -H <(echo "$CSS") -o "$OUT/docs/$(echo $f | tr 'A-Z' 'a-z').html" --toc --toc-depth=2
done
cp docs/referencia/prototipo.html "$OUT/prototipo/index.html"
cp docs/referencia/documentacao.html "$OUT/docs/documentacao-original.html"
cp docs/Elo-ARTE-PROMPTS.docx "$OUT/docs/Elo-ARTE-PROMPTS.docx"
cp public/assets/art/*.svg "$OUT/arte/"
{
  echo "<!doctype html><html lang=pt-BR><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Elo — arte</title>$CSS<body><nav><a href=../>← Início</a></nav><h1>Artes do app (placeholders)</h1><p>Estas são as ilustrações-reserva. Gere as finais seguindo <a href=../docs/arte-prompts.html>o guia de prompts</a> e salve com o mesmo nome.</p><div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px'>"
  for f in "$OUT"/arte/*.svg; do n=$(basename "$f" .svg); echo "<figure style=margin:0><img src='$n.svg' alt='$n' style='width:100%;border-radius:14px'><figcaption><code>$n</code></figcaption></figure>"; done
  echo "</div></body></html>"
} > "$OUT/arte/index.html"
cat > "$OUT/index.html" <<HTML
<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elo — vitrine do projeto</title>$CSS
<body><h1>Elo</h1><p>Aplicativo de relacionamento para maiores de 18 anos (Android primeiro). Esta página reúne o material do projeto.</p>
<ul>
<li><a href="prototipo/">Protótipo navegável</a> — referência visual e de interação (dados fictícios, tudo simulado no navegador).</li>
<li><a href="docs/arte-prompts.html">Arte necessária e prompts para IA</a> · <a href="docs/Elo-ARTE-PROMPTS.docx">versão .docx</a> · <a href="arte/">galeria dos placeholders</a></li>
<li><a href="docs/implementacao.html">Mapa da implementação</a> (regras, decisões assumidas e pendências)</li>
<li><a href="docs/android.html">Empacotar para Android</a></li>
<li><a href="docs/documentacao-original.html">Documentação original</a></li>
</ul>
<p><b>Sobre o app completo:</b> a API (Node + SQLite) e o app ficam no repositório (<code>server/</code> e <code>public/</code>). Como o GitHub Pages só hospeda arquivos estáticos, o app com contas, matches e chat precisa ser executado em um servidor Node (ex.: Render, Fly.io, Railway) — veja o README do repositório.</p>
</body></html>
HTML
touch "$OUT/.nojekyll"
echo "site gerado em $OUT"
