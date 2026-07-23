"""
XIOM Playground Dev Server v0.49.9
Serves static files + compile API endpoint with full diagnostics.
"""
import http.server
import json
import sys
import os
import subprocess
import tempfile

HOST = "localhost"
PORT = 3000
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
XIOM_BIN = os.environ.get("XIOM_BIN", os.path.join(SCRIPT_DIR, "..", "target", "debug", "xiom.exe"))

class PlaygroundHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/compile":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            source = data.get("source", "")
            stages = data.get("stages", "all")  # tokens, ast, checked, ir, contracts, all

            # Write source to temp file
            tmp = tempfile.NamedTemporaryFile(suffix=".xi", delete=False, mode="w", encoding="utf-8")
            tmp.write(source)
            tmp.close()

            result = {
                "success": False,
                "stages": {},
                "diagnostics": [],
                "ir": None,
            }

            try:
                # Try to get full diagnostics JSON
                proc = self._run_xiom([XIOM_BIN, "--emit-ir", "--diagnostics-json", tmp.name])
                if proc is None:
                    proc = self._run_xiom(["cargo", "run", "-p", "xiom", "--", "--emit-ir", "--diagnostics-json", tmp.name])
                
                if proc is None:
                    result["diagnostics"] = [{"code":"S001","kind":"server_error","message":"xiom binary not found. Install with: xiom install","line":0,"col":0}]
                else:
                    result["success"] = proc.returncode == 0
                    result["ir"] = proc.stdout.strip() if proc.returncode == 0 else None
                    result["diagnostics"] = self._parse_diagnostics(proc.stderr)

            finally:
                os.unlink(tmp.name)

            self._send_json(result)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _run_xiom(self, cmd):
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15, cwd=SCRIPT_DIR)
            return proc
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None

    def _parse_diagnostics(self, stderr):
        diagnostics = []
        for line in stderr.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Parse error patterns:
            # error[T001]: line:col: message
            # error: line:col: message
            import re
            m = re.match(r'.*?\[(\w+)\]\s*(\d+):(\d+):\s*(.+)', line)
            if m:
                diagnostics.append({"code": m.group(1), "kind": "error", "line": int(m.group(2)), "col": int(m.group(3)), "message": m.group(4)})
                continue
            # Fallback: capture any error-like line
            if "error" in line.lower() or "warning" in line.lower():
                diagnostics.append({"code": "E001", "kind": "error", "line": 0, "col": 0, "message": line})
        return diagnostics

    def _send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

if __name__ == "__main__":
    print(f"XIOM Playground v0.49.9")
    print(f"Server: http://{HOST}:{PORT}")
    print(f"Compiler: {XIOM_BIN} ({'found' if os.path.exists(XIOM_BIN) else 'not found - falls back to cargo'})")
    print(f"Press Ctrl+C to stop")

    server = http.server.HTTPServer((HOST, PORT), PlaygroundHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
