#!/usr/bin/env python3

import json
import os
import re
import subprocess
import time

from http.server import (
    ThreadingHTTPServer,
    SimpleHTTPRequestHandler
)


STATIC_DIR = os.path.join(
    os.path.dirname(
        os.path.abspath(__file__)
    ),
    "static"
)


HOST = os.environ.get(
    "UNBOUND_DASHBOARD_HOST",
    "0.0.0.0"
)


PORT = int(
    os.environ.get(
        "UNBOUND_DASHBOARD_PORT",
        "9198"
    )
)


previous_queries = None
previous_time = None


def parse_value(value):

    try:

        if (
            "." in value
            or "e" in value.lower()
        ):

            return float(value)

        return int(value)

    except ValueError:

        return value


def parse_unbound_stats():

    result = subprocess.run(
        [
            "unbound-control",
            "stats_noreset"
        ],
        capture_output=True,
        text=True,
        timeout=5,
        check=True
    )


    stats = {}


    for line in result.stdout.splitlines():

        if "=" not in line:
            continue


        key, value = line.split(
            "=",
            1
        )


        stats[key.strip()] = parse_value(
            value.strip()
        )


    return stats


def stat(
    stats,
    key,
    default=0
):

    return stats.get(
        key,
        default
    )


def memory_mb(value):

    return round(
        value
        / 1024
        / 1024,
        2
    )


def build_histogram(stats):

    histogram = []


    pattern = re.compile(
        r"^histogram\."
        r"([0-9.]+)\."
        r"([0-9.]+)\."
        r"to\."
        r"([0-9.]+)\."
        r"([0-9.]+)$"
    )


    for key, value in stats.items():

        match = pattern.match(
            key
        )


        if not match:
            continue


        start = float(
            f"{match.group(1)}.{match.group(2)}"
        )


        end = float(
            f"{match.group(3)}.{match.group(4)}"
        )


        # 秒转换为毫秒
        start_ms = start * 1000
        end_ms = end * 1000


        histogram.append(
            {
                "start": start,
                "end": end,

                "start_ms": start_ms,
                "end_ms": end_ms,

                "label": (
                    f"{start_ms:.3f} - "
                    f"{end_ms:.3f} ms"
                ),

                "count": value
            }
        )


    histogram.sort(
        key=lambda item:
        item["start"]
    )


    return histogram


def build_response(stats):

    global previous_queries
    global previous_time


    now = time.time()


    # ==========================
    # Queries
    # ==========================

    total_queries = stat(
        stats,
        "total.num.queries"
    )


    cache_hits = stat(
        stats,
        "total.num.cachehits"
    )


    cache_misses = stat(
        stats,
        "total.num.cachemiss"
    )


    cache_total = (
        cache_hits
        + cache_misses
    )


    cache_hit_rate = 0


    if cache_total > 0:

        cache_hit_rate = (
            cache_hits
            / cache_total
            * 100
        )


    # ==========================
    # QPS
    # ==========================

    qps = 0


    if (
        previous_queries
        is not None
        and previous_time
        is not None
    ):

        query_delta = (
            total_queries
            - previous_queries
        )


        time_delta = (
            now
            - previous_time
        )


        if time_delta > 0:

            qps = (
                query_delta
                / time_delta
            )


    previous_queries = total_queries
    previous_time = now


    # ==========================
    # Recursion Time
    # ==========================

    recursion_avg = stat(
        stats,
        "total.recursion.time.avg"
    )


    recursion_median = stat(
        stats,
        "total.recursion.time.median"
    )


    # 秒 → ms
    recursion_avg_ms = (
        recursion_avg
        * 1000
    )


    recursion_median_ms = (
        recursion_median
        * 1000
    )


    # ==========================
    # Memory
    # ==========================

    memory_stats = {

        "rrset": stat(
            stats,
            "mem.cache.rrset"
        ),

        "message": stat(
            stats,
            "mem.cache.message"
        ),

        "iterator": stat(
            stats,
            "mem.mod.iterator"
        ),

        "validator": stat(
            stats,
            "mem.mod.validator"
        ),

        "subnet": stat(
            stats,
            "mem.mod.subnet"
        )
    }


    memory_total = sum(
        memory_stats.values()
    )


    # ==========================
    # Request List
    # ==========================

    requestlist = {

        "avg": stat(
            stats,
            "total.requestlist.avg"
        ),

        "max": stat(
            stats,
            "total.requestlist.max"
        ),

        "current_all": stat(
            stats,
            "total.requestlist.current.all"
        ),

        "current_user": stat(
            stats,
            "total.requestlist.current.user"
        ),

        "current_replies": stat(
            stats,
            "total.requestlist.current.replies"
        ),

        "overwritten": stat(
            stats,
            "total.requestlist.overwritten"
        ),

        "exceeded": stat(
            stats,
            "total.requestlist.exceeded"
        )
    }


    # ==========================
    # Cache Count
    # ==========================

    cache_count = {

        "message": stat(
            stats,
            "msg.cache.count"
        ),

        "rrset": stat(
            stats,
            "rrset.cache.count"
        ),

        "infra": stat(
            stats,
            "infra.cache.count"
        ),

        "key": stat(
            stats,
            "key.cache.count"
        )
    }


    # ==========================
    # CacheDB
    # ==========================

    cachedb_queries = stat(
        stats,
        "num.query.cachedb"
    )


    # ==========================
    # DNSSEC
    # ==========================

    dnssec = {

        "secure": stat(
            stats,
            "num.answer.secure"
        ),

        "bogus": stat(
            stats,
            "num.answer.bogus"
        ),

        "rrset_bogus": stat(
            stats,
            "num.rrset.bogus"
        ),

        "valops": stat(
            stats,
            "num.valops"
        )
    }


    # ==========================
    # Histogram
    # ==========================

    histogram = build_histogram(
        stats
    )


    response = {

        "timestamp": int(
            now * 1000
        ),


        "uptime": stat(
            stats,
            "time.up"
        ),


        "qps": round(
            qps,
            2
        ),


        "queries": {

            "total": total_queries,

            "cache_hits":
                cache_hits,

            "cache_misses":
                cache_misses,

            "recursive":
                stat(
                    stats,
                    "total.num.recursivereplies"
                ),

            "prefetch":
                stat(
                    stats,
                    "total.num.prefetch"
                ),

            "expired":
                stat(
                    stats,
                    "total.num.expired"
                ),

            "discard_timeout":
                stat(
                    stats,
                    "total.num.queries_discard_timeout"
                ),

            "timed_out":
                stat(
                    stats,
                    "total.num.queries_timed_out"
                )
        },


        "cache": {

            "hits":
                cache_hits,

            "misses":
                cache_misses,

            "hit_rate": round(
                cache_hit_rate,
                2
            )
        },


        "recursion": {

            "avg_seconds":
                recursion_avg,

            "avg_ms": round(
                recursion_avg_ms,
                3
            ),

            "median_seconds":
                recursion_median,

            "median_ms": round(
                recursion_median_ms,
                6
            )
        },


        "requestlist":
            requestlist,


        "cachedb": {

            "queries":
                cachedb_queries
        },


        "cache_count":
            cache_count,


        "dnssec":
            dnssec,


        "memory": {

            "total_bytes":
                memory_total,

            "total_mb":
                memory_mb(
                    memory_total
                ),

            "details":
                memory_stats
        },


        "histogram":
            histogram,


        "raw":
            stats
    }


    return response


class DashboardHandler(
    SimpleHTTPRequestHandler
):


    def do_GET(self):

        if (
            self.path
            == "/api/stats"
        ):

            try:

                stats = (
                    parse_unbound_stats()
                )


                response = (
                    build_response(
                        stats
                    )
                )


                data = (
                    json.dumps(
                        response,
                        ensure_ascii=False
                    )
                    .encode(
                        "utf-8"
                    )
                )


                self.send_response(
                    200
                )


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
                    str(
                        len(data)
                    )
                )


                self.end_headers()


                self.wfile.write(
                    data
                )


            except Exception as error:

                message = (
                    json.dumps(
                        {
                            "error":
                            str(error)
                        }
                    )
                    .encode(
                        "utf-8"
                    )
                )


                self.send_response(
                    500
                )


                self.send_header(
                    "Content-Type",
                    "application/json"
                )


                self.end_headers()


                self.wfile.write(
                    message
                )


            return


        if self.path == "/":

            self.path = (
                "/index.html"
            )


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

    os.chdir(
        STATIC_DIR
    )


    server = (
        ThreadingHTTPServer(
            (
                HOST,
                PORT
            ),
            DashboardHandler
        )
    )


    print(
        f"Unbound Dashboard "
        f"listening on "
        f"{HOST}:{PORT}"
    )


    server.serve_forever()


if __name__ == "__main__":
    main()