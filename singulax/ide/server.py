#!/usr/bin/env python3
"""Singulax Studio local web IDE server. Standard library only."""
import base64, io, json, os, shutil, sys, threading, time, traceback, zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IDE = os.path.abspath(os.path.dirname(__file__))
PROJECTS = os.path.join(ROOT, 'projects')
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from sglx import Interpreter, LexError, ParseError, SglxError, ReturnSignal, BreakSignal, ContinueSignal

runs = {}
runs_lock = threading.Lock()

def safe_name(name):
    name = ''.join(c for c in str(name) if c.isalnum() or c in ' _-.').strip()
    return name or 'Untitled'

def project_dir(name):
    return os.path.join(PROJECTS, safe_name(name))

def read_project(name):
    pdir = project_dir(name)
    files = {}
    if not os.path.isdir(pdir):
        return {'name': safe_name(name), 'files': files}
    for root, dirs, fnames in os.walk(pdir):
        dirs[:] = [d for d in dirs if d != '__pycache__']
        for fn in fnames:
            if fn.endswith('.sglx') or fn in ('project.json',):
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, pdir).replace(os.sep, '/')
                try:
                    files[rel] = open(full, encoding='utf-8').read()
                except UnicodeDecodeError:
                    pass
    return {'name': safe_name(name), 'files': files}

def save_project(name, files):
    name = safe_name(name)
    pdir = project_dir(name)
    os.makedirs(pdir, exist_ok=True)
    for rel, content in files.items():
        rel = rel.replace('\\', '/')
        if rel.startswith('/') or '..' in rel.split('/'):
            continue
        full = os.path.normpath(os.path.join(pdir, rel))
        if os.path.commonpath([pdir, full]) != pdir:
            continue
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, 'w', encoding='utf-8') as f:
            f.write(str(content))
    with open(os.path.join(pdir, 'project.json'), 'w', encoding='utf-8') as f:
        json.dump({'name': name}, f, indent=2)
    return read_project(name)

def emit(run, text):
    with run['lock']:
        run['output'].append(str(text))

def run_worker(name, source, filename):
    state = {'keys': {}, 'buttons': {}, 'clicked': {}, 'mouse_x': 0, 'mouse_y': 0}
    run = {'name': name, 'state': state, 'output': [], 'lock': threading.Lock(), 'done': False}
    with runs_lock:
        old = runs.get(name)
        if old:
            old['interp'].stop_requested = True
        runs[name] = run
    pdir = project_dir(name)
    interp = Interpreter(base_dir=pdir, input_state=state)
    run['interp'] = interp
    import contextlib
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            interp.run(source)
        if buf.getvalue(): emit(run, buf.getvalue())
    except (LexError, ParseError) as e:
        if buf.getvalue(): emit(run, buf.getvalue())
        emit(run, f'Syntax error: {e}')
    except SglxError as e:
        if buf.getvalue(): emit(run, buf.getvalue())
        emit(run, f'Runtime error (near line {interp.current_line}): {e.message}')
    except (ReturnSignal, BreakSignal, ContinueSignal):
        emit(run, 'Control-flow statement used outside its valid context.')
    except Exception:
        if buf.getvalue(): emit(run, buf.getvalue())
        emit(run, traceback.format_exc())
    finally:
        if buf.getvalue():
            # capture any output produced after an earlier flush
            text = buf.getvalue()
            with run['lock']:
                joined = ''.join(run['output'])
            if text not in joined:
                emit(run, text)
        run['done'] = True

def current_run(name):
    with runs_lock:
        return runs.get(name)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=IDE, **kwargs)

    def log_message(self, fmt, *args):
        print('[Singulax Studio]', fmt % args)

    def send_json(self, data, code=200):
        raw = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers(); self.wfile.write(raw)

    def body_json(self):
        n = int(self.headers.get('Content-Length', '0'))
        return json.loads(self.rfile.read(n) or b'{}')

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/api/projects':
            os.makedirs(PROJECTS, exist_ok=True)
            names = sorted([x for x in os.listdir(PROJECTS) if os.path.isdir(os.path.join(PROJECTS,x))])
            return self.send_json({'projects': names})
        if u.path == '/api/project':
            name = parse_qs(u.query).get('name', ['Untitled'])[0]
            return self.send_json(read_project(name))
        if u.path == '/api/status':
            name = parse_qs(u.query).get('name', ['Untitled'])[0]
            r = current_run(name)
            if not r: return self.send_json({'running': False, 'output': '', 'done': True, 'frame': []})
            with r['lock']:
                out = ''.join(r['output']); r['output'].clear()
                frame = list(r['interp'].presented_frame)
            return self.send_json({'running': not r['done'], 'done': r['done'], 'output': out, 'frame': frame})
        if u.path == '/api/export':
            name = safe_name(parse_qs(u.query).get('name', ['Untitled'])[0]); pdir = project_dir(name); os.makedirs(pdir, exist_ok=True)
            raw = io.BytesIO()
            with zipfile.ZipFile(raw, 'w', zipfile.ZIP_DEFLATED) as z:
                for root, dirs, files in os.walk(pdir):
                    for fn in files:
                        full = os.path.join(root, fn); z.write(full, os.path.relpath(full, pdir))
            b = raw.getvalue(); self.send_response(200); self.send_header('Content-Type','application/zip'); self.send_header('Content-Disposition', f'attachment; filename=\"{name}.sglxproj.zip\"'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == '/api/project':
            data = self.body_json(); return self.send_json(save_project(data.get('name','Untitled'), data.get('files',{})))
        if u.path == '/api/run':
            data = self.body_json(); name = safe_name(data.get('name','Untitled')); filename = data.get('file','main.sglx')
            source = data.get('source')
            if source is None:
                source = read_project(name)['files'].get(filename, '')
            t = threading.Thread(target=run_worker, args=(name, source, filename), daemon=True); t.start()
            return self.send_json({'ok': True})
        if u.path == '/api/input':
            data = self.body_json(); name = safe_name(data.get('name','Untitled')); r = current_run(name)
            if r:
                st = r['state']; st['keys'] = data.get('keys', st.get('keys',{})); st['buttons'] = data.get('buttons', st.get('buttons',{})); st['mouse_x'] = data.get('mouse_x',0); st['mouse_y'] = data.get('mouse_y',0)
                clicks = data.get('clicked')
                if clicks: st['clicked'].update(clicks)
            return self.send_json({'ok': True})
        if u.path == '/api/stop':
            data = self.body_json(); r = current_run(safe_name(data.get('name','Untitled')))
            if r: r['interp'].stop_requested = True
            return self.send_json({'ok': True})
        if u.path == '/api/export':
            data = self.body_json(); name = safe_name(data.get('name','Untitled')); pdir = project_dir(name); os.makedirs(pdir, exist_ok=True)
            raw = io.BytesIO()
            with zipfile.ZipFile(raw, 'w', zipfile.ZIP_DEFLATED) as z:
                for root, dirs, files in os.walk(pdir):
                    for fn in files:
                        if fn == '__pycache__': continue
                        full = os.path.join(root,fn); z.write(full, os.path.relpath(full,pdir))
            b = raw.getvalue(); self.send_response(200); self.send_header('Content-Type','application/zip'); self.send_header('Content-Disposition', f'attachment; filename="{name}.sglxproj.zip"'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b); return
        if u.path == '/api/import':
            data = self.body_json(); name = safe_name(data.get('name','Imported')); blob = base64.b64decode(data.get('zip',''))
            pdir = project_dir(name); os.makedirs(pdir, exist_ok=True)
            with zipfile.ZipFile(io.BytesIO(blob)) as z:
                for member in z.infolist():
                    rel = os.path.normpath(member.filename)
                    if rel.startswith('..') or os.path.isabs(rel): continue
                    dest = os.path.normpath(os.path.join(pdir,rel))
                    if os.path.commonpath([pdir,dest]) != pdir: continue
                    if member.is_dir(): os.makedirs(dest,exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(dest),exist_ok=True)
                        with z.open(member) as src, open(dest,'wb') as dst: shutil.copyfileobj(src,dst)
            return self.send_json(read_project(name))
        self.send_error(404)

def main():
    os.makedirs(PROJECTS, exist_ok=True)
    port = int(sys.argv[1]) if len(sys.argv)>1 else 8765
    print(f'Singulax Studio: http://127.0.0.1:{port}/')
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()

if __name__ == '__main__': main()
