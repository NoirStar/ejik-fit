FROM python:3.12-slim

WORKDIR /app
COPY packages/backend /app/packages/backend
RUN pip install --no-cache-dir /app/packages/backend

CMD ["celery", "-A", "ejikfit.worker:celery_app", "worker", "--loglevel=INFO", "--concurrency=2"]
