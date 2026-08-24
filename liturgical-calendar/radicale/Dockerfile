FROM python:3.13-alpine

ARG RADICALE_VERSION=3.7.8

RUN pip install --no-cache-dir "Radicale[bcrypt]==${RADICALE_VERSION}" \
    && addgroup -S radicale \
    && adduser -S -G radicale radicale \
    && mkdir -p /var/lib/radicale/collections /run/radicale \
    && chown -R radicale:radicale /var/lib/radicale /run/radicale

COPY config /etc/radicale/config
COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

USER radicale

EXPOSE 5232
VOLUME ["/var/lib/radicale/collections"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import socket; s=socket.create_connection(('127.0.0.1',5232),2); s.close()"

ENTRYPOINT ["/entrypoint.sh"]
