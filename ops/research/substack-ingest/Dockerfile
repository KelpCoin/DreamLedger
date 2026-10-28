FROM python:3.12-slim
RUN useradd -r -m ingest
COPY substack_ingest /app/substack_ingest
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt
WORKDIR /data
USER ingest
ENV PYTHONPATH=/app
# mount /data (config.json, ingest.sqlite, outbox/); schedule with host cron or a systemd timer: docker run --rm -v $PWD:/data IMAGE python -m substack_ingest run
CMD ["python", "-m", "substack_ingest", "run"]
