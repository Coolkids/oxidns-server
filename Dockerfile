FROM svenshi/oxidns

LABEL maintainer="Coolkid"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl wget \
    unbound \
    unbound-anchor \
    dns-root-data \
    procps \
    net-tools \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/unbound

COPY unbound.conf /etc/unbound/unbound.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY files/root.hints /var/lib/unbound/root.hints
COPY files/root.zone /var/lib/unbound/root.zone

RUN chown -R unbound:unbound /var/lib/unbound/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 853
EXPOSE 443
EXPOSE 9199/tcp
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]