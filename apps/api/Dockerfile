FROM python:3.12-slim

WORKDIR /app
COPY packages/backend /app/packages/backend
COPY tests /app/tests
COPY .github /app/.github
COPY apps/web/vercel.json /app/apps/web/vercel.json
RUN pip install --no-cache-dir '/app/packages/backend[dev]'

CMD ["uvicorn", "ejikfit.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
