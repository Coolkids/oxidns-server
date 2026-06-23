FROM svenshi/oxidns:latest AS oxidns

FROM debian:13-slim

LABEL maintainer="Coolkid"

RUN apt update && \
    apt install -y --no-install-recommends \
    curl wget \
    unbound \
    unbound-anchor \
    dns-root-data \
    procps \
    net-tools \
    bind9-dnsutils vim \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p etc/oxidns && \
    mkdir -p /var/lib/unbound && \
    unbound-anchor -a /var/lib/unbound/root.key || echo "Please check root.key"

COPY --from=oxidns /usr/local/bin/oxidns /usr/local/bin/oxidns
COPY --from=oxidns /etc/oxidns/config.yaml /etc/oxidns/config.yaml
COPY --from=oxidns /etc/oxidns/webui /etc/oxidns/webui

COPY unbound.conf /etc/unbound/unbound.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY files/root.hints /var/lib/unbound/root.hints


RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/oxidns

EXPOSE 853
EXPOSE 443
EXPOSE 9199/tcp
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]