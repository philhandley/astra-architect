"""Local test server that never lets the browser cache files (so edited modules always reload).

Usage: python tools/serve.py [port]   (default 8400)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCache(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # Testing aid: the page can PUT a screenshot to /__shot/<name> (saved as dev/shots/<name>.jpg).
    def do_PUT(self):
        name = self.path.rsplit('/', 1)[-1]
        if not self.path.startswith('/__shot/') or not name.replace('-', '').replace('_', '').isalnum():
            self.send_error(404)
            return
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        out = ROOT / 'dev' / 'shots'
        out.mkdir(parents=True, exist_ok=True)
        (out / f'{name}.jpg').write_bytes(data)
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        if '404' in (fmt % args):
            sys.stderr.write('404 ' + (fmt % args) + '\n')


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8400
    ThreadingHTTPServer(('127.0.0.1', port), partial(NoCache, directory=str(ROOT))).serve_forever()
