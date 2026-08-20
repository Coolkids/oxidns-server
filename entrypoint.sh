#!/bin/sh

set -e

echo "Initializing Valkey..."
if [ ! -d /var/lib/valkey ]; then
    echo "Creating Valkey data directory..."
    mkdir -p /var/lib/valkey
fi

echo "Fixing Valkey data directory permissions..."
chown -R valkey:valkey /var/lib/valkey


echo "Initializing Unbound..."

if [ ! -f /var/lib/unbound/root.key ]; then
    echo "Generating root.key..."
    unbound-anchor -a /var/lib/unbound/root.key || \
        echo "Warning: failed to generate root.key"
fi

chown -R unbound:unbound /var/lib/unbound

echo "Checking Unbound configuration..."
unbound-checkconf /etc/unbound/unbound.conf
echo "Checking if Unbound is already running..."

if unbound-control -c "/etc/unbound/unbound.conf" status >/dev/null 2>&1; then
    echo "Existing Unbound instance detected, stopping..."

    unbound-control -c "/etc/unbound/unbound.conf" stop || true

    # 等待 Unbound 完全退出
    for i in 1 2 3 4 5; do
        if ! unbound-control -c "/etc/unbound/unbound.conf" status >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

echo "Checking OxiDNS configuration..."
oxidns check -c /etc/oxidns/config.yaml

echo "Starting Supervisor..."

exec /usr/bin/supervisord \
    -c /etc/supervisor/conf.d/supervisord.conf