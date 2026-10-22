FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
COPY . ./
RUN useradd --create-home --uid 10001 webuser \
    && chown -R webuser:webuser /app

USER webuser
EXPOSE 8080
CMD ["python", "server.py"]
