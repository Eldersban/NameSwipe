#!/usr/bin/env python3
"""Bundle the game into single self-contained HTML files.

build/crawl.html          - standalone page: double-click to play in any browser
build/crawl-artifact.html - same content without the document skeleton (for hosting)
"""
import pathlib, re

root = pathlib.Path(__file__).parent
src = (root / 'index.html').read_text()

def inline(m):
    js = (root / m.group(1)).read_text()
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'

body = re.sub(r'<script src="([^"]+)"></script>', inline, src)
out = root / 'build'
out.mkdir(exist_ok=True)
(out / 'crawl-artifact.html').write_text(body)
head_end = body.index('</style>') + len('</style>')
standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              + body[:head_end] + '\n</head>\n<body>\n' + body[head_end:] + '\n</body>\n</html>\n')
(out / 'crawl.html').write_text(standalone)
print('built', len(standalone), 'bytes')
