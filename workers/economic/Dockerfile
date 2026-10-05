FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/worker \
    BEC_JOB_ROOT=/var/lib/browneye-economic-jobs

WORKDIR /app/worker

COPY workers/economic/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

COPY workers/economic/ ./

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin worker \
    && mkdir -p /var/lib/browneye-economic-jobs \
    && chown -R worker:worker /app/worker /var/lib/browneye-economic-jobs

USER worker

CMD ["python", "economic_fulfillment_worker.py"]
