"""
WSGI entrypoint for running ai-service under a real WSGI server (gunicorn).

`python app.py` still works for local dev (Werkzeug dev server); production /
the HF Inference Endpoint runs `gunicorn wsgi:app` instead so multiple worker
processes can serve concurrent requests -- see gunicorn.conf.py and
docker/essentia-cpu.Dockerfile.
"""

from app import create_app_with_routes

app = create_app_with_routes()
