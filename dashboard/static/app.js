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

function drawHistogram(histogram) {
  const canvas = document.getElementById("histogram-chart");

  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;

  canvas.height = 450 * dpr;

  canvas.style.height = "450px";

  ctx.scale(dpr, dpr);

  const width = rect.width;

  const height = 450;

  ctx.clearRect(0, 0, width, height);

  if (histogram.length === 0) {
    return;
  }

  const padding = 60;

  const max = Math.max(...histogram.map((item) => item.count), 1);

  const chartWidth = width - padding * 2;

  const chartHeight = height - padding * 2;

  const barWidth = chartWidth / histogram.length;

  histogram.forEach((item, index) => {
    const barHeight = (item.count / max) * chartHeight;

    const x = padding + index * barWidth;

    const y = height - padding - barHeight;

    ctx.fillStyle = "#2563eb";

    ctx.fillRect(x, y, Math.max(barWidth - 2, 1), barHeight);
  });

  ctx.fillStyle = "#6b7280";

  ctx.font = "11px sans-serif";

  histogram.forEach((item, index) => {
    // 只显示部分标签
    if (index % 4 !== 0) {
      return;
    }

    const x = padding + index * barWidth;

    ctx.save();

    ctx.translate(x, height - 15);

    ctx.rotate(-Math.PI / 4);

    ctx.fillText(item.label, 0, 0);

    ctx.restore();
  });
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
