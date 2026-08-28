FROM svenshi/oxidns:latest AS oxidns

FROM alpine:latest

LABEL maintainer="Coolkid"

# 安装运行依赖
RUN apk add --no-cache \
    ca-certificates \
    curl \
    unbound \
    hiredis \
    procps-ng \
    net-tools \
    iputils-ping \
    bind-tools \
    vim \
    supervisor \
    valkey

# 创建目录
RUN mkdir -p \
    /etc/oxidns \
    /var/lib/oxidns \
    /var/lib/unbound \
    /var/lib/valkey \
    /var/log/valkey

# =========================
# OxiDNS
# =========================

COPY --from=oxidns /usr/local/bin/oxidns /usr/local/bin/oxidns
COPY --from=oxidns /etc/oxidns/config.yaml /etc/oxidns/config.yaml
COPY --from=oxidns /etc/oxidns/webui /etc/oxidns/webui

# =========================
# Unbound
# =========================

COPY unbound.conf /etc/unbound/unbound.conf

# 构建镜像时下载最新 root.hints
RUN curl -fL --retry 3 --retry-delay 2 \
        -o /var/lib/unbound/root.hints \
        https://www.internic.net/domain/named.root && \
    test -s /var/lib/unbound/root.hints && \
    chown -R unbound:unbound /var/lib/unbound

# =========================
# Valkey
# =========================

RUN chown -R valkey:valkey \
    /var/lib/valkey \
    /var/log/valkey

COPY valkey.conf /etc/valkey/valkey.conf

# =========================
# Supervisor
# =========================

COPY supervisord.conf /etc/supervisord.conf

# =========================
# Entrypoint
# =========================

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x \
        /usr/local/bin/entrypoint.sh \
        /usr/local/bin/oxidns && \
    unbound-anchor -a /var/lib/unbound/root.key || \
        echo "Warning: failed to generate root.key"

EXPOSE 853
EXPOSE 443
EXPOSE 9199/tcp

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]