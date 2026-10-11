"""Gera index.html e favicon.svg a partir de src/index.src.html + assets/brand/*.svg.

Os SVGs de assets/brand/ são a fonte única da identidade: daqui saem os símbolos
inlinados na página e o favicon. Só o atributo `d` é aproveitado — o `fill` fixo
dos arquivos é descartado de propósito, para a marca herdar a cor do contexto
(céu claro / espaço escuro) via currentColor.
"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent

def paths(name):
    """Todos os 'd' do SVG oficial, na ordem em que aparecem."""
    svg = (root / 'assets/brand' / name).read_text(encoding='utf-8')
    return re.findall(r'<path[^>]*\bd="([^"]+)"', svg)

mark = paths('avatar.svg')[0]
wordmark = ''.join('<path d="%s"/>' % d for d in paths('nome.svg'))

src = (root / 'src/index.src.html').read_text(encoding='utf-8')
(root / 'index.html').write_text(
    src.replace('{{MARK}}', mark).replace('{{WORDMARK}}', wordmark),
    encoding='utf-8', newline='\n')

# favicon: monograma branco centrado no disco azul da marca (56% de 100×100)
k = 56 / 182
(root / 'assets/favicon.svg').write_text(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
    "<rect width='100' height='100' rx='50' fill='#0f00d7'/>"
    "<path fill='white' transform='translate(22 22.92) scale(%.4f)' d='%s'/></svg>" % (k, mark),
    encoding='utf-8', newline='\n')

print('ok', len(mark), len(wordmark))
