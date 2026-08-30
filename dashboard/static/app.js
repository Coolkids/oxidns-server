const history = [];

const HISTORY_LIMIT = 150;

let latestRaw = "";

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function updateMetrics(data) {
  setText("qps", data.qps.toFixed(2));

  setText("cache-hit-rate", data.cache.hit_rate.toFixed(2) + "%");

  setText("recursion-time", data.recursion.avg_ms.toFixed(2) + " ms");

  setText("memory", data.memory.total_mb.toFixed(2) + " MB");

  setText("total-queries", formatNumber(data.queries.total));

  setText("cachedb", formatNumber(data.cachedb.queries));

  setText("bogus", formatNumber(data.dnssec.bogus));

  setText("request-current", formatNumber(data.requestlist.current_all));

  // Requestlist

  setText("request-avg", data.requestlist.avg.toFixed(2));

  setText("request-max", data.requestlist.max);

  setText("request-all", data.requestlist.current_all);

  setText("request-user", data.requestlist.current_user);

  setText("request-replies", data.requestlist.current_replies);

  setText("request-overwritten", data.requestlist.overwritten);

  setText("request-exceeded", data.requestlist.exceeded);

  // Cache

  setText("cache-message", formatNumber(data.cache_count.message));

  setText("cache-rrset", formatNumber(data.cache_count.rrset));

  setText("cache-infra", formatNumber(data.cache_count.infra));

  setText("cache-key", formatNumber(data.cache_count.key));

  // DNSSEC

  setText("dnssec-secure", formatNumber(data.dnssec.secure));

  setText("dnssec-bogus", formatNumber(data.dnssec.bogus));

  setText("rrset-bogus", formatNumber(data.dnssec.rrset_bogus));

  setText("valops", formatNumber(data.dnssec.valops));

  // Recursion

  setText("recursion-avg", data.recursion.avg_ms.toFixed(3) + " ms");

  setText("recursion-median", data.recursion.median_ms.toFixed(6) + " ms");

  setText("recursive-replies", formatNumber(data.queries.recursive));

  // Cache Performance

  setText("cache-hits", formatNumber(data.cache.hits));

  setText("cache-misses", formatNumber(data.cache.misses));

  setText("prefetch", formatNumber(data.queries.prefetch));

  setText("expired", formatNumber(data.queries.expired));

  // System

  setText("uptime", formatUptime(data.uptime));

  setText("last-update", new Date(data.timestamp).toLocaleTimeString());

  updateRaw(data.raw);
}

function formatUptime(seconds) {
  seconds = Math.floor(seconds);

  const days = Math.floor(seconds / 86400);

  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);

  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  return `${days}d ` + `${hours}h ` + `${minutes}m`;
}

function updateRaw(raw) {
  latestRaw = Object.entries(raw)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  document.getElementById("raw-stats").textContent = latestRaw;
}

function drawQpsChart() {
  const canvas = document.getElementById("qps-chart");

  drawLineChart(canvas, history);
}

function drawLineChart(canvas, data) {
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;

  canvas.height = rect.height * dpr;

  ctx.scale(dpr, dpr);

  const width = rect.width;

  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) {
    return;
  }

  const padding = 50;

  const values = data.map((item) => item.qps);

  const max = Math.max(...values, 1) * 1.1;

  ctx.beginPath();

  data.forEach((item, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);

    const y = height - padding - (item.qps / max) * (height - padding * 2);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.strokeStyle = "#2563eb";

  ctx.lineWidth = 2;

  ctx.stroke();
}

let histogramData = [];

let histogramLayout = null;

function formatDuration(valueSeconds) {
  const value = Number(valueSeconds) || 0;

  if (value === 0) {
    return "0ns";
  }

  if (value < 0.000001) {
    const ns = value * 1000000000;

    return (ns < 10 ? ns.toFixed(1) : ns.toFixed(0)) + "ns";
  }

  if (value < 0.001) {
    const us = value * 1000000;

    return (us < 10 ? us.toFixed(1) : us.toFixed(0)) + "µs";
  }

  if (value < 1) {
    const ms = value * 1000;

    return (ms < 10 ? ms.toFixed(1) : ms.toFixed(0)) + "ms";
  }

  return (value < 10 ? value.toFixed(2) : value.toFixed(1)) + "s";
}

function formatHistogramLabel(start, end) {
  const startValue = Number(start) || 0;

  const endValue = Number(end) || 0;

  if (startValue === 0) {
    return "<" + formatDuration(endValue);
  }

  return formatDuration(startValue) + "–" + formatDuration(endValue);
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
  if (value === 0) {
    return "0%";
  }

  if (value < 0.01) {
    return value.toFixed(4) + "%";
  }

  if (value < 1) {
    return value.toFixed(2) + "%";
  }

  return value.toFixed(2) + "%";
}

function formatLogAxisValue(value) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1) + "M";
  }

  if (value >= 1000) {
    return (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + "K";
  }

  return String(Math.round(value));
}

function getLogTicks(maxValue) {
  const ticks = [];

  let value = 1;

  while (value <= maxValue) {
    ticks.push(value);

    value *= 10;
  }

  if (ticks[ticks.length - 1] < maxValue) {
    ticks.push(value);
  }

  return ticks;
}

function drawHistogram(histogram) {
  const canvas = document.getElementById("histogram-chart");

  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  const width = rect.width;

  const height = 560;

  canvas.width = width * dpr;

  canvas.height = height * dpr;

  canvas.style.height = height + "px";

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  if (!histogram || histogram.length === 0) {
    histogramLayout = null;

    return;
  }

  histogramData = histogram.map((item) => ({
    start: Number(item.start) || 0,

    end: Number(item.end) || 0,

    count: Number(item.count) || 0,
  }));

  const totalCount = histogramData.reduce(
    (total, item) => total + item.count,
    0,
  );

  const maxCount = Math.max(...histogramData.map((item) => item.count), 1);

  /*
   * 对数轴最大值
   */

  const maxLog = Math.ceil(Math.log10(maxCount));

  const minLog = 0;

  const padding = {
    top: 30,

    right: 30,

    bottom: 180,

    left: 80,
  };

  const chartWidth = width - padding.left - padding.right;

  const chartHeight = height - padding.top - padding.bottom;

  /*
   * 对数坐标转换
   */

  function logToY(value) {
    if (value <= 0) {
      return padding.top + chartHeight;
    }

    const logValue = Math.log10(value);

    const ratio = (logValue - minLog) / (maxLog - minLog || 1);

    return padding.top + chartHeight - ratio * chartHeight;
  }

  /*
   * Y 轴网格和刻度
   */

  const ticks = getLogTicks(Math.pow(10, maxLog));

  ctx.font = "11px sans-serif";

  ctx.textAlign = "right";

  ctx.textBaseline = "middle";

  ticks.forEach((value) => {
    const y = logToY(value);

    if (y < padding.top - 1 || y > padding.top + chartHeight + 1) {
      return;
    }

    ctx.beginPath();

    ctx.moveTo(padding.left, y);

    ctx.lineTo(width - padding.right, y);

    ctx.strokeStyle = "#e5e7eb";

    ctx.lineWidth = 1;

    ctx.stroke();

    ctx.fillStyle = "#6b7280";

    ctx.fillText(formatLogAxisValue(value), padding.left - 10, y);
  });

  /*
   * X 轴
   */

  const baselineY = padding.top + chartHeight;

  ctx.beginPath();

  ctx.moveTo(padding.left, baselineY);

  ctx.lineTo(width - padding.right, baselineY);

  ctx.strokeStyle = "#d1d5db";

  ctx.lineWidth = 1;

  ctx.stroke();

  /*
   * 柱子
   */

  const slotWidth = chartWidth / histogramData.length;

  const barWidth = Math.max(1, slotWidth * 0.75);

  const bars = [];

  histogramData.forEach((item, index) => {
    const centerX = padding.left + index * slotWidth + slotWidth / 2;

    const x = centerX - barWidth / 2;

    let y = baselineY;

    let barHeight = 0;

    if (item.count > 0) {
      y = logToY(item.count);

      barHeight = baselineY - y;
    }

    /*
     * 鼠标命中区域
     * 即使 count=0 也保留
     */

    bars.push({
      x: centerX - slotWidth / 2,

      width: slotWidth,

      y: y,

      height: barHeight,

      data: item,
    });

    /*
     * 柱状图
     */

    if (item.count > 0) {
      ctx.fillStyle = "#2563eb";

      ctx.fillRect(x, y, barWidth, Math.max(barHeight, 1));
    }

    /*
     * X 轴标签
     */

    const label = formatHistogramLabel(item.start, item.end);

    ctx.save();

    ctx.translate(centerX, baselineY + 12);

    ctx.rotate(Math.PI / 2);

    ctx.fillStyle = "#6b7280";

    ctx.font = "11px sans-serif";

    ctx.textAlign = "left";

    ctx.textBaseline = "middle";

    ctx.fillText(label, 0, 0);

    ctx.restore();
  });

  /*
   * Y 轴标题
   */

  ctx.save();

  ctx.translate(18, padding.top + chartHeight / 2);

  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = "#6b7280";

  ctx.font = "12px sans-serif";

  ctx.textAlign = "center";

  ctx.fillText("Queries (log scale)", 0, 0);

  ctx.restore();

  /*
   * X 轴标题
   */

  ctx.fillStyle = "#6b7280";

  ctx.font = "12px sans-serif";

  ctx.textAlign = "center";

  ctx.textBaseline = "middle";

  ctx.fillText("Response Time", width / 2, height - 20);

  /*
   * 保存 Layout
   * 用于鼠标 Tooltip
   */

  histogramLayout = {
    canvas,
    width,
    height,
    padding,
    baselineY,
    bars,
    totalCount,
  };
}

function updateStatus(online) {
  const dot = document.getElementById("status-dot");

  const text = document.getElementById("status-text");

  dot.className = "status-dot";

  if (online) {
    dot.classList.add("online");

    text.textContent = "Online";
  } else {
    dot.classList.add("error");

    text.textContent = "Disconnected";
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();

    updateMetrics(data);

    history.push({
      timestamp: data.timestamp,

      qps: data.qps,
    });

    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }

    drawQpsChart();

    drawHistogram(data.histogram);

    updateStatus(true);
  } catch (error) {
    console.error(error);

    updateStatus(false);
  }
}

function formatDuration(valueSeconds) {
  if (valueSeconds === 0) {
    return "0ns";
  }

  if (valueSeconds < 0.000001) {
    return (valueSeconds * 1000000000).toFixed(0) + "ns";
  }

  if (valueSeconds < 0.001) {
    const value = valueSeconds * 1000000;

    if (value < 10) {
      return value.toFixed(1) + "µs";
    }

    return value.toFixed(0) + "µs";
  }

  if (valueSeconds < 1) {
    const value = valueSeconds * 1000;

    if (value < 10) {
      return value.toFixed(1) + "ms";
    }

    return value.toFixed(0) + "ms";
  }

  if (valueSeconds < 10) {
    return valueSeconds.toFixed(2) + "s";
  }

  return valueSeconds.toFixed(0) + "s";
}

function formatHistogramLabel(start, end) {
  const startText = formatDuration(start);

  const endText = formatDuration(end);

  if (start === 0) {
    return "<" + endText;
  }

  return startText + "-" + endText;
}

function getHistogramMousePosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,

    y: event.clientY - rect.top,
  };
}

function showHistogramTooltip(event) {
  if (!histogramLayout) {
    return;
  }

  const { canvas, bars, totalCount } = histogramLayout;

  const tooltip = document.getElementById("histogram-tooltip");

  const position = getHistogramMousePosition(event, canvas);

  const bar = bars.find(
    (item) => position.x >= item.x && position.x <= item.x + item.width,
  );

  if (!bar) {
    tooltip.style.display = "none";

    canvas.style.cursor = "default";

    return;
  }

  const item = bar.data;

  const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;

  const range = formatHistogramLabel(item.start, item.end);

  tooltip.innerHTML = `
        <div class="tooltip-title">
            ${range}
        </div>

        <div class="tooltip-row">

            <span>
                Bucket Count
            </span>

            <strong>
                ${formatCount(item.count)}
            </strong>

        </div>

        <div class="tooltip-row">

            <span>
                Percentage
            </span>

            <strong>
                ${formatPercent(percentage)}
            </strong>

        </div>
        `;

  const container = canvas.parentElement;

  const containerRect = container.getBoundingClientRect();

  let left = event.clientX - containerRect.left + 15;

  let top = event.clientY - containerRect.top + 15;

  /*
   * 防止 Tooltip 超出右边界
   */

  const tooltipWidth = 180;

  if (left + tooltipWidth > container.clientWidth) {
    left = event.clientX - containerRect.left - tooltipWidth - 15;
  }

  tooltip.style.left = left + "px";

  tooltip.style.top = top + "px";

  tooltip.style.display = "block";

  canvas.style.cursor = "pointer";
}

function hideHistogramTooltip() {
  const tooltip = document.getElementById("histogram-tooltip");

  tooltip.style.display = "none";

  if (histogramLayout) {
    histogramLayout.canvas.style.cursor = "default";
  }
}

const histogramCanvas = document.getElementById("histogram-chart");

histogramCanvas.addEventListener("mousemove", showHistogramTooltip);

histogramCanvas.addEventListener("mouseleave", hideHistogramTooltip);

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((tab) => tab.classList.remove("active"));

    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));

    button.classList.add("active");

    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

document.getElementById("copy-raw").addEventListener("click", async () => {
  await navigator.clipboard.writeText(latestRaw);
});

window.addEventListener("resize", () => {
  drawQpsChart();
});

loadStats();

setInterval(loadStats, 2000);
