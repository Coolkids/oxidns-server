#!/usr/bin/env python3

import json
import os
import subprocess
import time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


STATIC_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "static"
)

HOST = os.environ.get("UNBOUND_DASHBOARD_HOST", "0.0.0.0")
PORT = int(os.environ.get("UNBOUND_DASHBOARD_PORT", "9198"))

previous_queries = None
previous_time = None


def parse_unbound_stats():
    """
    执行 unbound-control stats_noreset 并解析 key=value 输出
    """

    result = subprocess.run(
        ["unbound-control", "stats_noreset"],
        capture_output=True,
        text=True,
        timeout=5,
        check=True
    )

    stats = {}

    for line in result.stdout.splitlines():
        if "=" not in line:
            continue

        key, value = line.split("=", 1)

        try:
            if "." in value:
                stats[key] = float(value)
            else:
                stats[key] = int(value)
        except ValueError:
            stats[key] = value

    return stats


def get_stat(stats, key, default=0):
    return stats.get(key, default)


def build_response(stats):
    global previous_queries
    global previous_time

    now = time.time()

    total_queries = get_stat(
        stats,
        "total.num.queries"
    )

    cache_hits = get_stat(
        stats,
        "total.num.cachehits"
    )

    cache_misses = get_stat(
        stats,
        "total.num.cachemiss"
    )

    total_recursions = get_stat(
        stats,
        "total.num.recursivereplies"
    )

    prefetch = get_stat(
        stats,
        "total.num.prefetch"
    )

    udp_queries = get_stat(
        stats,
        "total.num.queries"
    )

    tcp_queries = get_stat(
        stats,
        "total.num.tcp"
    )

    # Unbound 的平均递归时间单位通常是秒
    avg_recursion_time = get_stat(
        stats,
        "total.recursion.time.avg"
    )

    avg_latency_ms = avg_recursion_time * 1000

    # 缓存命中率
    cache_total = cache_hits + cache_misses

    if cache_total > 0:
        cache_hit_rate = (
            cache_hits / cache_total * 100
        )
    else:
        cache_hit_rate = 0

    # QPS
    qps = 0

    if (
        previous_queries is not None
        and previous_time is not None
    ):
        query_delta = (
            total_queries - previous_queries
        )

        time_delta = now - previous_time

        if time_delta > 0:
            qps = query_delta / time_delta

    previous_queries = total_queries
    previous_time = now

    # 内存统计
    memory_total = get_stat(
        stats,
        "mem.total.sbrk"
    )

    memory_mb = (
        memory_total / 1024 / 1024
        if memory_total > 0
        else 0
    )

    response = {
        "timestamp": int(now * 1000),

        "qps": round(qps, 2),

        "queries": {
            "total": total_queries,
            "udp": udp_queries,
            "tcp": tcp_queries,
            "recursive": total_recursions
        },

        "cache": {
            "hits": cache_hits,
            "misses": cache_misses,
            "hit_rate": round(cache_hit_rate, 2)
        },

        "performance": {
            "avg_latency_ms": round(
                avg_latency_ms,
                3
            )
        },

        "prefetch": prefetch,

        "memory": {
            "bytes": memory_total,
            "mb": round(memory_mb, 2)
        }
    }

    return response


class DashboardHandler(SimpleHTTPRequestHandler):

    def do_GET(self):

        if self.path == "/api/stats":

            try:

                stats = parse_unbound_stats()

                response = build_response(
                    stats
                )

                data = json.dumps(
                    response,
                    ensure_ascii=False
                ).encode("utf-8")

                self.send_response(200)

                self.send_header(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )

                self.send_header(
                    "Cache-Control",
                    "no-store"
                )

                self.send_header(
                    "Content-Length",
                    str(len(data))
                )

                self.end_headers()

                self.wfile.write(data)

            except subprocess.TimeoutExpired:

                self.send_error(
                    504,
                    "unbound-control timeout"
                )

            except subprocess.CalledProcessError as e:

                self.send_error(
                    500,
                    f"unbound-control failed: {e.stderr}"
                )

            except Exception as e:

                self.send_error(
                    500,
                    str(e)
                )

            return

        if self.path == "/":

            self.path = "/index.html"

        return super().do_GET()

    def log_message(
        self,
        format,
        *args
    ):
        print(
            "[dashboard]",
            format % args
        )


def main():

    os.chdir(STATIC_DIR)

    server = ThreadingHTTPServer(
        (HOST, PORT),
        DashboardHandler
    )

    print(
        f"Unbound Dashboard listening on "
        f"http://{HOST}:{PORT}"
    )

    server.serve_forever()


if __name__ == "__main__":
    main()