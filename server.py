"""
XIOM Playground Dev Server v0.49.9
Serves static files + compile API endpoint.
For production, the playground uses the WASM compiler directly in the browser.
"""
import http.server
import json
import sys
import os
import subprocess
import tempfile

HOST = "localhost"
PORT = 3000
XIOM_BIN = os.environ.get("XIOM_BIN", os.path.join(os.path.dirname(__file__), "..", "target", "debug", "xiom.exe"))

class PlaygroundHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/compile":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            source = data.get("source", "")

            # Write source to temp file
            tmp = tempfile.NamedTemporaryFile(suffix=".xi", delete=False, mode="w", encoding="utf-8")
            tmp.write(source)
            tmp.close()

            try:
                # Try xiom binary first, fall back to cargo
                result = None
                for cmd in [
                    [XIOM_BIN, "--emit-ir", tmp.name],
                    ["cargo", "run", "-p", "xiom", "--", "--emit-ir", tmp.name],
                ]:
                    try:
                        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10, cwd=os.path.dirname(os.path.abspath(__file__)))
                        if proc.returncode == 0 or proc.stderr:
                            result = {
                                "success": proc.returncode == 0,
                                "ir": proc.stdout if proc.returncode == 0 else None,
                                "diagnostics": parse_errors(proc.stderr) if proc.returncode != 0 else [],
                                "raw_stdout": proc.stdout,
                                "raw_stderr": proc.stderr,
                            }
                            break
                    except (FileNotFoundError, subprocess.TimeoutExpired):
                        continue

                if result is None:
                    result = {"success": False, "diagnostics": [{"code":"S001","kind":"server_error","message":"xiom binary not found. Install xiom or build with cargo.","line":0,"col":0}],"ir":None}

            finally:
                os.unlink(tmp.name)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def parse_errors(stderr):
    diagnostics = []
    for line in stderr.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Parse error: <kind> at line <N>:<M>: <message>
        parts = line.split(":", 3)
        if len(parts) >= 3:
            code = "E001"
            msg = line
            line_num = 0
            col = 0
            diagnostics.append({"code": code, "kind": "error", "message": msg, "line": line_num, "col": col})
    return diagnostics

if __name__ == "__main__":
    print(f"XIOM Playground v0.49.9")
    print(f"Server running at http://{HOST}:{PORT}")
    print(f"Open http://{HOST}:{PORT} in your browser")
    print(f"Press Ctrl+C to stop")

    server = http.server.HTTPServer((HOST, PORT), PlaygroundHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
