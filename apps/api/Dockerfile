FROM python:3.12-slim

WORKDIR /app
COPY packages/backend /app/packages/backend
RUN pip install --no-cache-dir /app/packages/backend

CMD ["uvicorn", "ejikfit.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
