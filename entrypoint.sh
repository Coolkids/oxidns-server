#!/bin/sh

set -e

echo "Starting Unbound..."
if [ ! -f /var/lib/unbound/root.key ]; then
    unbound-anchor -a /var/lib/unbound/root.key
fi
if [ ! -f /var/lib/unbound/root.hints ]; then
    curl -o /var/lib/unbound/root.hints https://www.internic.net/domain/named.cache
fi
if [ ! -f /var/lib/unbound/root.zone ]; then
    curl -o /var/lib/unbound/root.zone https://www.internic.net/domain/root.zone
fi
chown -R unbound:unbound /var/lib/unbound/
unbound -c /etc/unbound/unbound.conf

echo "Starting OxiDNS..."

exec oxidns start \
    -c /etc/oxidns/config.yaml \
    -d /etc/oxidns

