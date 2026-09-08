const history = [];
const HISTORY_LIMIT = 150;
let latestRaw = "";
let latestHistogram = [];
let histogramLayout = null;

const numberFormatter = new Intl.NumberFormat("zh-CN");

function number(value) {
  return Number(value || 0);
}

function formatNumber(value) {
  return numberFormatter.format(number(value));
}

function formatPercent(value) {
  return `${number(value).toFixed(2)}%`;
}

function formatBytes(value) {
  const bytes = number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatUptime(value) {
  let seconds = Math.max(0, Math.floor(number(value)));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function updateEcsHealth(ecs) {
  const config = ecs.config || {};
  const lookups = number(ecs.cache_lookups);
  const rate = number(ecs.cache_hit_rate);
  const configured = Boolean(config.enabled && config.send_client_subnet);
  const badge = document.getElementById("ecs-health-badge");
  const mode = document.getElementById("ecs-mode");

  badge.className = "health-badge";
  mode.className = "";

  if (!configured) {
    setText("ecs-mode", "配置未启用");
    setText("ecs-mode-detail", "未检测到 subnetcache + send-client-subnet");
    setText("ecs-health-badge", "检查配置");
    setText("ecs-health-title", "ECS 处理链未完整启用");
    setText("ecs-health-copy", "请确认 subnetcache 模块和 send-client-subnet 配置。");
    badge.classList.add("warning");
    document.getElementById("ecs-progress").style.width = "0%";
    return;
  }

  setText("ecs-mode", "ECS 已启用");
  setText("ecs-mode-detail", "subnetcache 正在工作");

  if (lookups === 0) {
    setText("ecs-health-badge", "等待流量");
    setText("ecs-health-title", "暂时没有可判断的 ECS cache 流量");
    setText("ecs-health-copy", "产生 ECS 应答后，这里会使用 subnet cache 命中率评估。");
    badge.classList.add("neutral");
    document.getElementById("ecs-progress").style.width = "0%";
    return;
  }

  const healthy = rate >= 80;
  const needsAttention = rate >= 50;
  setText("ecs-health-badge", healthy ? "运行良好" : needsAttention ? "需要关注" : "建议检查");
  setText("ecs-health-title", healthy ? "ECS cache 命中稳定" : "ECS cache 命中偏低");
  setText(
    "ecs-health-copy",
    healthy
      ? "客户端网段复用良好，ECS cache 正在有效减少递归。"
      : "优先检查网段数量、tree size 与热门域名的 cache churn。",
  );
  badge.classList.add(healthy ? "good" : "warning");
  document.getElementById("ecs-progress").style.width = `${Math.min(rate, 100)}%`;
}

function updateConfig(config) {
  const value = (field, suffix = "") => config[field] == null ? "未读取" : `${config[field]}${suffix}`;
  setText("ecs-ipv4-prefix", value("ipv4_prefix", " bits"));
  setText("ecs-ipv6-prefix", value("ipv6_prefix", " bits"));
  setText("ecs-tree-ipv4", value("tree_size_ipv4"));
  setText("ecs-tree-ipv6", value("tree_size_ipv6"));
  setText("config-status", config.enabled && config.send_client_subnet ? "ACTIVE" : "CHECK");
  document.getElementById("config-status").className =
    `config-status ${config.enabled && config.send_client_subnet ? "active" : "warning"}`;
}

function updateMetrics(data) {
  const ecs = data.ecs || {};
  const requestlist = data.requestlist || {};
  const recursion = data.recursion || {};
  const queries = data.queries || {};
  const dnssec = data.dnssec || {};

  setText("ecs-cache-hit-rate", formatPercent(ecs.cache_hit_rate));
  setText("ecs-answers", formatNumber(ecs.answers));
  setText("ecs-share", formatPercent(ecs.share));
  setText("ecs-memory", `${number(ecs.subnet_memory_mb).toFixed(2)} MB`);
  setText("ecs-memory-bytes", formatBytes(ecs.subnet_memory_bytes));
  setText("ecs-cache-hits", formatNumber(ecs.cache_hits));
  setText("ecs-cache-misses", formatNumber(ecs.cache_misses));
  updateEcsHealth(ecs);
  updateConfig(ecs.config || {});

  setText("qps", number(data.qps).toFixed(2));
  setText("total-queries", formatNumber(queries.total));
  setText("recursive-replies", formatNumber(queries.recursive));
  setText("cachedb", formatNumber(data.cachedb && data.cachedb.queries));
  setText("recursion-avg", `${number(recursion.avg_ms).toFixed(2)} ms`);
  setText("recursion-median", `${number(recursion.median_ms).toFixed(2)} ms`);
  setText("request-all", formatNumber(requestlist.current_all));
  setText("request-max", formatNumber(requestlist.max));
  setText("memory", `${number(data.memory && data.memory.total_mb).toFixed(2)} MB`);
  setText("dnssec-secure", formatNumber(dnssec.secure));
  setText("dnssec-bogus", formatNumber(dnssec.bogus));
  setText("uptime", formatUptime(data.uptime));
  setText("last-update", new Date(data.timestamp).toLocaleTimeString());
  updateRaw(data.raw || {});
}

function updateRaw(raw) {
  latestRaw = Object.entries(raw)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  document.getElementById("raw-stats").textContent = latestRaw;
}

function setupCanvas(canvas, height) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(rect.width, 320);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function drawQpsChart() {
  const { ctx, width, height } = setupCanvas(document.getElementById("qps-chart"), 260);
  const padding = { top: 18, right: 18, bottom: 32, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  // QPS 使用线性坐标；不要使用 log10，避免低流量波动被放大。
  const max = Math.max(...history.map((item) => item.qps), 1) * 1.15;

  ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index <= 3; index += 1) {
    const value = (max / 3) * index;
    const y = padding.top + chartHeight - (chartHeight / 3) * index;
    ctx.strokeStyle = "#dce5ee";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#7b8b9b";
    ctx.fillText(value.toFixed(1), padding.left - 9, y);
  }

  ctx.save();
  ctx.translate(15, padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#7b8b9b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("QPS", 0, 0);
  ctx.restore();

  if (history.length < 2) return;
  const points = history.map((item, index) => ({
    x: padding.left + (index / (history.length - 1)) * chartWidth,
    y: padding.top + chartHeight - (item.qps / max) * chartHeight,
  }));
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(38, 198, 167, .28)");
  gradient.addColorStop(1, "rgba(38, 198, 167, 0)");
  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding.bottom);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = "#26c6a7";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function duration(value) {
  const seconds = number(value);
  if (seconds < 0.000001) return `${(seconds * 1e9).toFixed(0)}ns`;
  if (seconds < 0.001) return `${(seconds * 1e6).toFixed(1)}µs`;
  if (seconds < 1) return `${(seconds * 1e3).toFixed(1)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function histogramLabel(start, end) {
  return number(start) === 0 ? `<${duration(end)}` : `${duration(start)}–${duration(end)}`;
}

function drawHistogram(histogram) {
  const canvas = document.getElementById("histogram-chart");
  const { ctx, width, height } = setupCanvas(canvas, 360);
  const data = (histogram || []).map((item) => ({
    start: number(item.start), end: number(item.end), count: number(item.count),
  }));
  if (!data.length) {
    histogramLayout = null;
    return;
  }

  const padding = { top: 20, right: 20, bottom: 80, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((item) => item.count), 1);
  const baseline = padding.top + chartHeight;
  const slot = chartWidth / data.length;
  const bars = [];
  ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index <= 3; index += 1) {
    const value = (max / 3) * index;
    const y = baseline - (chartHeight / 3) * index;
    ctx.strokeStyle = "#dce5ee";
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    ctx.fillStyle = "#7b8b9b"; ctx.fillText(formatNumber(Math.round(value)), padding.left - 8, y);
  }
  data.forEach((item, index) => {
    const x = padding.left + index * slot + slot * 0.14;
    const barWidth = Math.max(2, slot * 0.72);
    const barHeight = item.count ? (item.count / max) * chartHeight : 0;
    ctx.fillStyle = "#6578f6";
    if (barHeight) ctx.fillRect(x, baseline - barHeight, barWidth, barHeight);
    ctx.save();
    ctx.translate(x + barWidth / 2, baseline + 12);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#7b8b9b"; ctx.textAlign = "left"; ctx.fillText(histogramLabel(item.start, item.end), 0, 0);
    ctx.restore();
    bars.push({ x: padding.left + index * slot, width: slot, data: item });
  });
  histogramLayout = { canvas, bars, total: data.reduce((sum, item) => sum + item.count, 0) };
}

function showHistogramTooltip(event) {
  if (!histogramLayout) return;
  const rect = histogramLayout.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const bar = histogramLayout.bars.find((item) => x >= item.x && x <= item.x + item.width);
  const tooltip = document.getElementById("histogram-tooltip");
  if (!bar) { tooltip.style.display = "none"; return; }
  const item = bar.data;
  const percentage = histogramLayout.total ? item.count / histogramLayout.total * 100 : 0;
  tooltip.innerHTML = `<strong>${histogramLabel(item.start, item.end)}</strong><span>${formatNumber(item.count)} queries · ${formatPercent(percentage)}</span>`;
  const parentRect = tooltip.parentElement.getBoundingClientRect();
  tooltip.style.left = `${Math.min(x + 16, parentRect.width - 190)}px`;
  tooltip.style.top = `${event.clientY - parentRect.top + 12}px`;
  tooltip.style.display = "grid";
}

function updateStatus(online) {
  const dot = document.getElementById("status-dot");
  dot.className = `status-dot ${online ? "online" : "error"}`;
  setText("status-text", online ? "在线" : "连接断开");
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    updateMetrics(data);
    history.push({ timestamp: data.timestamp, qps: number(data.qps) });
    if (history.length > HISTORY_LIMIT) history.shift();
    drawQpsChart();
    latestHistogram = data.histogram || [];
    drawHistogram(latestHistogram);
    updateStatus(true);
  } catch (error) {
    console.error(error);
    updateStatus(false);
  }
}

document.getElementById("histogram-chart").addEventListener("mousemove", showHistogramTooltip);
document.getElementById("histogram-chart").addEventListener("mouseleave", () => {
  document.getElementById("histogram-tooltip").style.display = "none";
});
document.getElementById("copy-raw").addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText(latestRaw);
    event.currentTarget.textContent = "已复制";
    setTimeout(() => { event.currentTarget.textContent = "复制原始统计"; }, 1400);
  } catch (error) {
    console.error(error);
  }
});
window.addEventListener("resize", () => {
  drawQpsChart();
  drawHistogram(latestHistogram);
});

loadStats();
setInterval(loadStats, 2000);
