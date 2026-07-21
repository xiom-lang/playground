"""XIOM Playground Server — serves the playground and compiles XIOM code."""
import http.server
import json
import subprocess
import sys
import os
import tempfile

PORT = 3000


class PlaygroundHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)

    def do_POST(self):
        if self.path == '/compile':
            content_length = int(self.headers['Content-Length'])
            code = self.rfile.read(content_length).decode('utf-8')

            with tempfile.NamedTemporaryFile(mode='w', suffix='.xi', delete=False, encoding='utf-8') as f:
                f.write(code)
                temp_path = f.name

            try:
                result = subprocess.run(
                    ['cargo', 'run', '-p', 'xiom', '--', '--emit-ir', temp_path],
                    capture_output=True, text=True, timeout=10,
                    cwd=os.path.join(os.path.dirname(__file__), '..')
                )
                ir_output = result.stdout
                errors = []
                if result.returncode != 0:
                    errors.append(result.stderr)
            except subprocess.TimeoutExpired:
                ir_output = ''
                errors = ['Compilation timed out']
            except Exception as e:
                ir_output = ''
                errors = [str(e)]
            finally:
                os.unlink(temp_path)

            response = {'ir': ir_output, 'errors': errors}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f'XIOM Playground running at http://localhost:{PORT}')
    print('Open http://localhost:3000 in your browser')
    print('Press Ctrl+C to stop')
    server = http.server.HTTPServer(('', PORT), PlaygroundHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
