#!/bin/bash
set -e
cd /opt/jiqun_ai
echo "---PYTHON VERSION---"
.venv/bin/python --version
echo "---IMPORT WEB---"
.venv/bin/python -c "
import sys
sys.path.insert(0, '.')
from web import app as a
print('web app loads OK, routes count:', len(list(a.app.url_map.iter_rules())))
"
echo "---HEALTH ENDPOINT---"
.venv/bin/python -c "
import sys
sys.path.insert(0, '.')
from web import app as a
with a.app.test_client() as c:
    resp = c.get('/api/health')
    print('GET /api/health =>', resp.status_code, resp.get_data(as_text=True)[:200])
"
