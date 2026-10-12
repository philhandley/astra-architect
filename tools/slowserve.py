"""Test server like serve.py, plus /hold?s=N, which answers after N seconds.

dev/test-sw.html asks for /hold so headless Edge keeps the page open while the service worker
installs, then prints what was cached. Usage: python tools/slowserve.py 8401
"""
import sys
import time
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import NoCache, ROOT  # noqa: E402


class Slow(NoCache):
    def do_GET(self):
        u = urlparse(self.path)
        if u.path.endswith('/hold'):
            time.sleep(min(60, float(parse_qs(u.query).get('s', ['30'])[0])))
            self.send_response(200)
            self.send_header('Content-Type', 'image/gif')
            self.end_headers()
            self.wfile.write(b'GIF89a\x01\x00\x01\x00\x00\x00\x00;')
            return
        super().do_GET()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8401
    ThreadingHTTPServer(('127.0.0.1', port), partial(Slow, directory=str(ROOT))).serve_forever()
