const HISTORY_LIMIT = 150;

const history = [];


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString();

}


function formatTime(timestamp) {

    const date = new Date(timestamp);

    return date.toLocaleTimeString();

}


function updateStatus(
    online,
    message
) {

    const dot =
        document.getElementById(
            "status-dot"
        );

    const text =
        document.getElementById(
            "status-text"
        );

    dot.className =
        "status-dot";

    if (online) {

        dot.classList.add(
            "online"
        );

    } else {

        dot.classList.add(
            "error"
        );

    }

    text.textContent =
        message;

}


function updateMetrics(data) {

    document.getElementById(
        "qps"
    ).textContent =
        data.qps.toFixed(2);


    document.getElementById(
        "cache-hit-rate"
    ).textContent =
        data.cache.hit_rate
        .toFixed(2)
        + "%";


    document.getElementById(
        "cache-hits"
    ).textContent =
        formatNumber(
            data.cache.hits
        );


    document.getElementById(
        "cache-hits-detail"
    ).textContent =
        formatNumber(
            data.cache.hits
        );


    document.getElementById(
        "cache-misses"
    ).textContent =
        formatNumber(
            data.cache.misses
        );


    document.getElementById(
        "latency"
    ).textContent =
        data.performance.avg_latency_ms
        .toFixed(2)
        + " ms";


    document.getElementById(
        "memory"
    ).textContent =
        data.memory.mb
        .toFixed(1)
        + " MB";


    document.getElementById(
        "total-queries"
    ).textContent =
        formatNumber(
            data.queries.total
        );


    document.getElementById(
        "recursive-queries"
    ).textContent =
        formatNumber(
            data.queries.recursive
        );


    document.getElementById(
        "udp-queries"
    ).textContent =
        formatNumber(
            data.queries.udp
        );


    document.getElementById(
        "tcp-queries"
    ).textContent =
        formatNumber(
            data.queries.tcp
        );


    document.getElementById(
        "prefetch"
    ).textContent =
        formatNumber(
            data.prefetch
        );


    document.getElementById(
        "update-time"
    ).textContent =
        formatTime(
            data.timestamp
        );

}


function drawChart() {

    const canvas =
        document.getElementById(
            "qps-chart"
        );

    const context =
        canvas.getContext(
            "2d"
        );

    const rect =
        canvas.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        rect.width * dpr;

    canvas.height =
        rect.height * dpr;


    context.scale(
        dpr,
        dpr
    );


    const width =
        rect.width;

    const height =
        rect.height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    const padding = {
        top: 20,
        right: 20,
        bottom: 35,
        left: 55
    };


    const chartWidth =
        width
        - padding.left
        - padding.right;


    const chartHeight =
        height
        - padding.top
        - padding.bottom;


    context.strokeStyle =
        "#e5e7eb";

    context.lineWidth =
        1;


    for (
        let i = 0;
        i <= 5;
        i++
    ) {

        const y =
            padding.top
            + (
                chartHeight
                / 5
            )
            * i;


        context.beginPath();

        context.moveTo(
            padding.left,
            y
        );

        context.lineTo(
            width
            - padding.right,
            y
        );

        context.stroke();

    }


    if (
        history.length === 0
    ) {

        return;

    }


    const values =
        history.map(
            item => item.qps
        );


    let maxValue =
        Math.max(
            ...values,
            1
        );


    maxValue =
        Math.ceil(
            maxValue * 1.1
        );


    context.fillStyle =
        "#6b7280";

    context.font =
        "12px sans-serif";


    for (
        let i = 0;
        i <= 5;
        i++
    ) {

        const value =
            maxValue
            - (
                maxValue
                / 5
            )
            * i;


        const y =
            padding.top
            + (
                chartHeight
                / 5
            )
            * i;


        context.fillText(
            value.toFixed(0),
            5,
            y + 4
        );

    }


    context.beginPath();


    history.forEach(
        (
            item,
            index
        ) => {

            const x =
                padding.left
                + (
                    chartWidth
                    * index
                )
                / Math.max(
                    history.length - 1,
                    1
                );


            const y =
                padding.top
                + chartHeight
                - (
                    item.qps
                    / maxValue
                )
                * chartHeight;


            if (
                index === 0
            ) {

                context.moveTo(
                    x,
                    y
                );

            } else {

                context.lineTo(
                    x,
                    y
                );

            }

        }
    );


    context.strokeStyle =
        "#2563eb";

    context.lineWidth =
        2;

    context.stroke();


    context.fillStyle =
        "#6b7280";

    const first =
        history[0];

    const last =
        history[
            history.length - 1
        ];


    context.fillText(
        formatTime(
            first.timestamp
        ),
        padding.left,
        height - 10
    );


    context.fillText(
        formatTime(
            last.timestamp
        ),
        width - 90,
        height - 10
    );

}


async function loadStats() {

    try {

        const response =
            await fetch(
                "/api/stats",
                {
                    cache:
                        "no-store"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "HTTP "
                + response.status
            );

        }


        const data =
            await response.json();


        updateMetrics(
            data
        );


        history.push(
            {
                timestamp:
                    data.timestamp,

                qps:
                    data.qps
            }
        );


        if (
            history.length
            > HISTORY_LIMIT
        ) {

            history.shift();

        }


        drawChart();


        updateStatus(
            true,
            "Online"
        );

    } catch (
        error
    ) {

        console.error(
            error
        );


        updateStatus(
            false,
            "Disconnected"
        );

    }

}


window.addEventListener(
    "resize",
    drawChart
);


loadStats();


setInterval(
    loadStats,
    2000
);