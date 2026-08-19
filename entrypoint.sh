#!/bin/sh

set -e

echo "Initializing Unbound..."

if [ ! -f /var/lib/unbound/root.key ]; then
    echo "Generating root.key..."
    unbound-anchor -a /var/lib/unbound/root.key || \
        echo "Warning: failed to generate root.key"
fi

chown -R unbound:unbound /var/lib/unbound

echo "Checking Unbound configuration..."
unbound-checkconf /etc/unbound/unbound.conf

echo "Checking OxiDNS configuration..."
oxidns check -c /etc/oxidns/config.yaml

echo "Starting Supervisor..."

exec /usr/bin/supervisord \
    -c /etc/supervisor/conf.d/supervisord.conf