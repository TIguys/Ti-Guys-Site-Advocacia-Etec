FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_PROVIDER=ollama \
    AI_MODEL=qwen2.5:7b \
    OLLAMA_BASE_URL=http://ollama:11434 \
    AI_KNOWLEDGE_DB=/app/data/legal_knowledge.sqlite3 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./
RUN mkdir -p /app/data \
    && useradd --create-home --uid 10001 lawai \
    && chown -R lawai:lawai /app

USER lawai
EXPOSE 8080

CMD ["python", "server.py"]
