#!/bin/sh

set -e

unbound -d -c /etc/unbound/unbound.conf &
UNBOUND_PID=$!

sleep 2

oxidns start \
  -c /etc/oxidns/config.yaml \
  -d /etc/oxidns &

OXIDNS_PID=$!

wait -n

kill $UNBOUND_PID $OXIDNS_PID 2>/dev/null || true