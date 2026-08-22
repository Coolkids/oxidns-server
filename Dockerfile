FROM svenshi/oxidns:latest AS oxidns

FROM debian:13-slim

LABEL maintainer="Coolkid"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    unbound \
    unbound-anchor \
    dns-root-data \
    procps \
    net-tools \
    bind9-dnsutils \
    vim \
    supervisor \
    valkey-server && \
    rm -rf /var/lib/apt/lists/*

# OxiDNS
RUN mkdir -p /etc/oxidns \
    /var/lib/oxidns \
    /var/lib/unbound

COPY --from=oxidns /usr/local/bin/oxidns /usr/local/bin/oxidns
COPY --from=oxidns /etc/oxidns/config.yaml /etc/oxidns/config.yaml
COPY --from=oxidns /etc/oxidns/webui /etc/oxidns/webui

# Unbound
COPY unbound.conf /etc/unbound/unbound.conf
COPY files/root.hints /var/lib/unbound/root.hints

# Supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# valkey
RUN mkdir -p /var/lib/valkey /var/log/valkey && \
    chown -R valkey:valkey /var/lib/valkey /var/log/valkey
COPY valkey.conf /etc/valkey/valkey.conf

# Entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    /usr/local/bin/oxidns && \
    chown -R unbound:unbound /var/lib/unbound && \
    unbound-anchor -a /var/lib/unbound/root.key || \
    echo "Please check root.key"

EXPOSE 853
EXPOSE 443
EXPOSE 9199/tcp

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]