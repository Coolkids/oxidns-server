#!/bin/sh

set -e

echo "Starting Unbound..."
if [ ! -f /var/lib/unbound/root.key ]; then
    unbound-anchor -a /var/lib/unbound/root.key
fi
unbound -c /etc/unbound/unbound.conf

echo "Starting OxiDNS..."

exec oxidns start \
    -c /etc/oxidns/config.yaml \
    -d /etc/oxidns

