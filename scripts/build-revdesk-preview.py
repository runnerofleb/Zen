"""Build a self-contained, download-and-open review copy of Revenue Desk."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = (root / 'revdesk.html').read_text()
css = (root / 'revdesk/styles.css').read_text()
html = html.replace('<link rel="stylesheet" href="revdesk/styles.css">', '<style>\n' + css + '\n</style>')
for name in ('core', 'data', 'app'):
    code = (root / f'revdesk/{name}.js').read_text()
    if name == 'app':
        code = 'window.REVENUE_DESK_PREVIEW = true;\n' + code
        code = code.replace('href="junecallguideofficial.html"', 'href="https://runnerofleb.github.io/Zen/junecallguideofficial.html"')
    code = code.replace('</script', '<\\/script')
    # Defer does not apply to inline scripts. Put app boot after its DOM nodes.
    html = html.replace(f'<script src="revdesk/{name}.js" defer></script>', '')
    html = html.replace('</body>', '<script>\n' + code + '\n</script>\n</body>')
html = html.replace('<title>Revenue Desk · ZenBusiness</title>', '<title>Revenue Desk · Review preview</title>')
(root / 'revdesk-preview.html').write_text(html)
print('Built revdesk-preview.html — opens in the isolated practice workspace.')
