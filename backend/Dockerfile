FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

# Seed only when there's no existing database, so demo data is present on a
# fresh instance but user-created data survives warm restarts. Render/Railway
# provide $PORT; default to 8000 locally.
CMD ["sh", "-c", "[ -f signal.db ] || python -m app.seed; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
