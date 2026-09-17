"""Gera index.html e favicon.svg a partir de src/index.src.html + assets/js/duck-shape.js."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
js = (root / 'assets/js/duck-shape.js').read_text()
def arr(name):
    nums = [float(v) for v in re.search(name + r' = \[([^\]]+)\]', js).group(1).split(',')]
    return list(zip(nums[0::2], nums[1::2]))
def path(pts):
    return 'M' + 'L'.join(f'{(x + .5) * 100:.1f} {(-y + .5) * 100:.1f}' for x, y in pts) + 'Z'
d = path(arr('DUCK_OUTER')) + path(arr('DUCK_HOLE'))
src = (root / 'src/index.src.html').read_text()
(root / 'index.html').write_text(src.replace('{{DUCK}}', d))
(root / 'assets/favicon.svg').write_text(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='#0f00d7'/>"
    f"<path fill='white' fill-rule='evenodd' transform='translate(18 20) scale(.64)' d='{d}'/></svg>")
print('ok', len(d))
