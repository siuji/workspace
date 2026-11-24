#!/usr/bin/env python3
"""Fonte única dos logos de cliente.

Cada logo tem UM arquivo mestre colorido em content/media/brand/<id>.png
(opcional: brand/<id>-dark.png quando a marca tem versão oficial para fundo escuro).
Este script gera todas as cópias usadas no site, para que uma correção apareça em todas as páginas:
  - logos/<id>.png e logos/<id>-dark.png        (topo da página do cliente)
  - clients/<arquivo>                           (máscara cinza da grade do Portfolio e das faixas das agências)
  - clients-color/<arquivo>                     (hover colorido no claro)
  - clients-color-dark/<arquivo>                (hover colorido no escuro)
O nome do arquivo em clients/ pode ser diferente do id (ex.: dominos -> dominos-pizza.png): ver ALIAS.

Uso: python3 -I tools/logos.py [id ...]   (sem argumentos: todos os mestres)
"""
import sys, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'content', 'media')
ALIAS = {'dominos': 'dominos-pizza'}
# Marcas cuja versão escura mantém as cores originais (sem trocar preto/neutros por branco)
KEEP_DARK = {'pontofrio'}

def mask_of(im):
    """Máscara de uma cor: tinta = opaca; partes muito claras (branco/cinza claro do desenho) viram vazado."""
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    src, dst = im.load(), out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = src[x, y]
            if not a: continue
            mx, mn = max(r, g, b), min(r, g, b)
            light = mx > 170 and (mx - mn) < 40  # neutro claro
            dst[x, y] = (255, 255, 255, 0 if light else a)
    return out

def dark_of(im):
    """Versão para fundo escuro: neutros escuros viram branco, cores ficam."""
    out = im.copy(); px = out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if not a: continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / mx if mx else 0
            if sat < 0.25 and mx < 130: px[x, y] = (255, 255, 255, a)
    return out

def build(i):
    master = Image.open(os.path.join(ROOT, 'brand', i + '.png')).convert('RGBA')
    dpath = os.path.join(ROOT, 'brand', i + '-dark.png')
    dark = Image.open(dpath).convert('RGBA') if os.path.exists(dpath) else (master if i in KEEP_DARK else dark_of(master))
    f = ALIAS.get(i, i) + '.png'
    master.save(os.path.join(ROOT, 'logos', i + '.png'))
    dark.save(os.path.join(ROOT, 'logos', i + '-dark.png'))
    if os.path.exists(os.path.join(ROOT, 'clients', f)) or True:
        mask_of(master).save(os.path.join(ROOT, 'clients', f))
        master.save(os.path.join(ROOT, 'clients-color', f))
        dark.save(os.path.join(ROOT, 'clients-color-dark', f))
    print('ok', i, '->', f)

ids = sys.argv[1:] or sorted(n[:-4] for n in os.listdir(os.path.join(ROOT, 'brand')) if n.endswith('.png') and not n.endswith('-dark.png'))
for i in ids: build(i)
