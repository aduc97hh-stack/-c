#!/usr/bin/env python3
"""Scan the Git source manifest; print paths only, never matched secret values."""
from pathlib import Path
import os
import re
import subprocess
files = [p for p in subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z']).decode().split('\0') if p]
forbidden = []
for p in files:
    parts = Path(p).parts
    if any(x in parts for x in ['node_modules', '.next', '.local', 'coverage', 'test-results', 'playwright-report', '__pycache__']) or (Path(p).name.startswith('.env') and p != '.env.example') or p.endswith(('.log', '.tsbuildinfo', '.pem', '.key', '.tmp')):
        forbidden.append(p)
values = []
for cfg in ['.env.local', '.local/stack.env']:
    if Path(cfg).exists():
        for line in Path(cfg).read_text().splitlines():
            if '=' in line:
                name, val = line.split('=', 1)
                val = val.strip().strip('"\'')
                if any(k in name.upper() for k in ['PASSWORD', 'SECRET', 'SERVICE_ROLE', 'ANON_KEY']) and len(val) > 12:
                    values.append(val)
for name, val in os.environ.items():
    if any(k in name for k in ['TOKEN', 'SECRET', 'PASSWORD']) and len(val) > 20:
        values.append(val)
pattern = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}')
hits = []
for path in files:
    data = Path(path).read_bytes()
    if any(val.encode() in data for val in values) or pattern.search(data):
        hits.append(path)
print('Source manifest files:', len(files))
print('Forbidden artifacts:', forbidden)
print('Credential matches (paths only):', hits)
if forbidden or hits:
    raise SystemExit(1)
print('Secret/artifact scan PASS')
