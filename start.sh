#!/bin/sh

set -e

echo "Starting Unbound..."

unbound -c /etc/unbound/unbound.conf

echo "Starting OxiDNS..."

exec oxidns start \
    -c /etc/oxidns/config.yaml \
    -d /etc/oxidns

