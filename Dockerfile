FROM svenshi/oxidns

LABEL maintainer="Coolkid"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    unbound \
    unbound-anchor \
    dns-root-data \
    procps \
    net-tools \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY unbound.conf /etc/unbound/unbound.conf
COPY start.sh /usr/local/bin/start.sh

RUN chmod +x /usr/local/bin/start.sh

EXPOSE 853
EXPOSE 443
EXPOSE 9199/tcp
ENTRYPOINT ["/usr/local/bin/start.sh"]