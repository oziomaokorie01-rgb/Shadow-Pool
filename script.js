(() => {
  "use strict";

  const STARTING_BALANCE = 10000;
  const STORAGE_KEY = "shadowpool-session-v1";
  const LEADERBOARD_KEY = "shadowpool-leaderboard-v2";
  const CANDLE_COUNT = 26;
  const $ = (id) => document.getElementById(id);

  let tradeType = "Buy";
  let chartMode = "candles";        // "candles" | "line" | "area"
  let walletPublicKey = null;
  let session = loadSession();
  let leaderboard = loadLeaderboard();
  let marketPrice = 148.25;
  let basePrice = 148.25;
  let candles = createCandles();
  let toastTimer;

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Number.isFinite(saved.balance) && Array.isArray(saved.trades)) return saved;
    } catch (_) {}
    return { balance: STARTING_BALANCE, realizedPnl: 0, trades: [] };
  }
  function loadLeaderboard() {
    try {
      const saved = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((e) => e && typeof e.username === "string" && Number.isFinite(e.points)).slice(0, 5) : [];
    } catch (_) { return []; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) { showToast("Browser storage is unavailable. Your session may not persist."); }
  }
  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  function signedMoney(value) { return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`; }

  function createCandles() {
    let value = basePrice; const out = [];
    for (let i = 0; i < CANDLE_COUNT; i++) {
      const o = value; const move = (Math.random() - 0.48) * 0.9;
      const c = Math.max(140, Math.min(158, o + move));
      const h = Math.max(o, c) + Math.random() * 0.4;
      const l = Math.min(o, c) - Math.random() * 0.4;
      out.push({ o, h, l, c }); value = c;
    }
    marketPrice = value; return out;
  }
  function tickCandles() {
    const last = candles[candles.length - 1];
    const move = (Math.random() - 0.49) * 0.5;
    const c = Math.max(140, Math.min(158, last.c + move));
    last.c = c; last.h = Math.max(last.h, c); last.l = Math.min(last.l, c); marketPrice = c;
    if (Math.random() < 0.34) { candles.push({ o: c, h: c, l: c, c }); if (candles.length > CANDLE_COUNT) candles.shift(); }
  }

  // single render dispatcher for all three chart types (data array is shared; only the view changes)
  function renderChart() {
    const g = $("candles"), lineEl = $("close-line"), areaEl = $("chart-area");
    if (!g) return;
    const width = 680, height = 188, pad = 6;
    const lows = candles.map((k) => k.l), highs = candles.map((k) => k.h), closes = candles.map((k) => k.c);
    const min = Math.min(...lows) - 0.3, max = Math.max(...highs) + 0.3;
    const y = (v) => height - ((v - min) / (max - min)) * (height - pad * 2) - pad;
    const slot = width / candles.length;
    renderYLabels(min, max);

    if (chartMode === "candles") {
      let svg = "";
      candles.forEach((k, i) => {
        const cx = i * slot + slot / 2, up = k.c >= k.o;
        const yO = y(k.o), yC = y(k.c), yH = y(k.h), yL = y(k.l);
        const top = Math.min(yO, yC), bh = Math.max(1.5, Math.abs(yC - yO)), bw = Math.max(2, slot * 0.55);
        svg += `<line class="wick ${up ? "up" : "down"}" x1="${cx.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yL.toFixed(1)}"/>`;
        svg += `<rect class="body ${up ? "up" : "down"}" x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="0.6"/>`;
      });
      g.innerHTML = svg;
      lineEl.style.display = "none"; lineEl.setAttribute("d", "");
      if (areaEl) areaEl.setAttribute("d", "");
    } else {
      g.innerHTML = "";
      const pts = closes.map((v, i) => `${i ? "L" : "M"}${(i * slot + slot / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
      lineEl.style.display = ""; lineEl.setAttribute("d", pts);
      if (areaEl) {
        if (chartMode === "area") {
          const first = (slot / 2).toFixed(1), lastX = (((candles.length - 1) * slot) + slot / 2).toFixed(1);
          areaEl.setAttribute("d", `${pts} L${lastX} ${height} L${first} ${height} Z`);
        } else areaEl.setAttribute("d", "");
      }
    }
  }
  function renderYLabels(min, max) {
    const box = $("chart-y-labels"); if (!box) return;
    const steps = 5; let html = "";
    for (let i = 0; i < steps; i++) { const v = max - (i / (steps - 1)) * (max - min); html += `<span>${v.toFixed(1)}</span>`; }
    box.innerHTML = html;
  }
  function updateMarket() {
    tickCandles();
    $("market-price").textContent = money(marketPrice);
    const change = ((marketPrice - basePrice) / basePrice) * 100;
    $("market-change").textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    $("market-change").style.color = change >= 0 ? "var(--green)" : "var(--red)";
    $("market-change").style.background = change >= 0 ? "#153429" : "#3a2028";
    renderChart();
    updateOrderPreview();
  }

  async function seedRealPrice() {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const live = Number(data && data.solana && data.solana.usd);
      if (!Number.isFinite(live) || live <= 0) return;
      basePrice = live; marketPrice = live; candles = createCandles();
      const src = $("market-source"); if (src) src.textContent = "Live spot · SOL";
      const note = $("feed-note"); if (note) note.textContent = "Seeded from live spot price · switch chart type above";
      renderChart(); $("market-price").textContent = money(marketPrice);
      showToast("Live SOL spot price loaded.");
    } catch (_) {}
  }

  function getOrderInputs() {
    return { quantity: Number.parseFloat($("trade-amount").value), referencePrice: Number.parseFloat($("trade-price").value) };
  }
  function updateOrderPreview() {
    const { quantity, referencePrice } = getOrderInputs();
    const valid = Number.isFinite(quantity) && quantity > 0 && Number.isFinite(referencePrice) && referencePrice > 0;
    $("order-value").textContent = valid ? money(quantity * referencePrice) : "—";
    $("execution-estimate").textContent = valid ? `${money(referencePrice)} ± 0.15%` : "Enter valid values";
    $("trade-btn").innerHTML = `Execute simulated ${tradeType.toLowerCase()} <span>→</span>`;
    $("trade-btn").disabled = !valid || quantity > 100000 || referencePrice > 1000000;
    $("trade-btn").style.opacity = $("trade-btn").disabled ? ".55" : "1";
  }
  function showFeedback(message, kind) {
    const feedback = $("trade-result"); feedback.hidden = false; feedback.className = `trade-feedback ${kind}`; feedback.textContent = message;
  }
  function executeTrade(event) {
    event.preventDefault();
    const { quantity, referencePrice } = getOrderInputs();
    if (!Number.isFinite(quantity) || quantity < 0.01 || quantity > 100000) { showFeedback("Enter a quantity between 0.01 and 100,000 SOL.", "error"); return; }
    if (!Number.isFinite(referencePrice) || referencePrice <= 0 || referencePrice > 1000000) { showFeedback("Enter a valid reference price greater than $0.", "error"); return; }
    const slippageRate = (Math.random() * 0.003) * (Math.random() < 0.5 ? -1 : 1);
    const fillPrice = referencePrice * (1 + slippageRate);
    const notional = quantity * fillPrice;
    const cashChange = tradeType === "Buy" ? -notional : notional;
    if (tradeType === "Buy" && notional > session.balance) { showFeedback(`Insufficient virtual balance. This order needs ${money(notional)}, but you have ${money(session.balance)}.`, "error"); return; }
    session.balance += cashChange;
    const executionDifference = tradeType === "Buy" ? (referencePrice - fillPrice) * quantity : (fillPrice - referencePrice) * quantity;
    session.realizedPnl += executionDifference;
    const trade = { id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, type: tradeType, quantity, referencePrice, fillPrice, slippageRate, executionDifference, notional, timestamp: new Date().toISOString() };
    session.trades.unshift(trade); session.trades = session.trades.slice(0, 50);
    saveState(); renderStats(); renderTrades(); recordLeaderboardResult(trade);
    showFeedback(`${tradeType} simulated successfully: ${quantity} SOL filled at ${money(fillPrice)}. Execution impact: ${signedMoney(executionDifference)}. No real order was submitted.`, "success");
    showToast("Simulated trade recorded.");
  }
  function renderStats() {
    $("balance-value").textContent = money(session.balance);
    $("pnl-value").textContent = signedMoney(session.realizedPnl);
    $("pnl-value").style.color = session.realizedPnl >= 0 ? "var(--green)" : "var(--red)";
    $("pnl-caption").textContent = `${session.trades.length} completed ${session.trades.length === 1 ? "trade" : "trades"}`;
    if (!session.trades.length) { $("quality-value").textContent = "—"; }
    else { const avg = session.trades.reduce((s, t) => s + Math.abs(t.slippageRate), 0) / session.trades.length * 100; $("quality-value").textContent = `${avg.toFixed(3)}%`; }
  }
  function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); } catch (_) { return "—"; } }
  function renderTrades() {
    const tbody = $("trade-history");
    if (!session.trades.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><span class="empty-icon">◷</span><strong>No trades yet</strong><small>Your simulated executions will appear here.</small></td></tr>'; return; }
    tbody.replaceChildren();
    session.trades.slice(0, 12).forEach((trade) => {
      const row = document.createElement("tr");
      const typeCell = document.createElement("td");
      typeCell.innerHTML = `<span class="trade-type-cell"><i class="type-dot ${trade.type === "Sell" ? "sell" : ""}"></i>${trade.type}</span>`;
      const quantityCell = cell(`${trade.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`, "mono");
      const priceCell = cell(money(trade.fillPrice), "mono");
      const slipHurts = trade.type === "Buy" ? trade.slippageRate > 0 : trade.slippageRate < 0;
      const slippageCell = cell(`${trade.slippageRate > 0 ? "+" : ""}${(trade.slippageRate * 100).toFixed(3)}%`, `mono ${slipHurts ? "negative" : "positive"}`);
      const resultCell = cell(signedMoney(trade.executionDifference), `mono ${trade.executionDifference >= 0 ? "positive" : "negative"}`);
      const timeCell = cell(fmtTime(trade.timestamp), "mono");
      row.append(typeCell, quantityCell, priceCell, slippageCell, resultCell, timeCell);
      tbody.appendChild(row);
    });
  }
  function cell(text, className) { const td = document.createElement("td"); td.textContent = text; if (className) td.className = className; return td; }

  // ---- leaderboard: ONE code path for self + simulated peers; peers never touch session ----
  const PEERS = [
    { n: "0xNova", bias: 1.4, vol: 5 }, { n: "slippage_sam", bias: -0.6, vol: 6 },
    { n: "darkpool_dana", bias: 0.8, vol: 4 }, { n: "gamma_gwen", bias: 2.1, vol: 7 },
    { n: "maker_max", bias: -0.2, vol: 3 }, { n: "twap_tom", bias: 0.5, vol: 4 },
    { n: "iceberg_ivy", bias: 1.1, vol: 5 }, { n: "spread_spike", bias: -1.0, vol: 6 }
  ];
  function userLabel() { return walletPublicKey ? `${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}` : "Guest trader"; }
  function pushLeaderboardEntry(username, points, isSelf) {
    pushActivity({ username, points });                 // TICKER (3/3): every live event flashes, even ones that miss top-5
    leaderboard.push({ username, points, isSelf, timestamp: Date.now() });
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard = leaderboard.slice(0, 5);
    try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard)); } catch (_) {}
    renderLeaderboard();
  }
  function recordLeaderboardResult(trade) { pushLeaderboardEntry(userLabel(), Number(trade.executionDifference.toFixed(4)), true); }
  function peerPoints(p) { return +(p.bias + (Math.random() + Math.random() - 1) * p.vol).toFixed(4); }
  function simulatePeers() {
    if (document.hidden) return;                       // don't churn in a background tab
    const count = Math.random() < 0.55 ? 1 : (Math.random() < 0.3 ? 2 : 0);
    for (let i = 0; i < count; i++) {
      const p = PEERS[Math.floor(Math.random() * PEERS.length)];
      pushLeaderboardEntry(p.n, peerPoints(p), false);
    }
  }
  function seedPeers() {                                // backfill board on a fresh visit; intentionally does NOT touch the ticker
    for (let i = 0; i < 4; i++) {
      const p = PEERS[Math.floor(Math.random() * PEERS.length)];
      leaderboard.push({ username: p.n, points: peerPoints(p), isSelf: false, timestamp: Date.now() - i * 60000 });
    }
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard = leaderboard.slice(0, 5);
  }
  function pushActivity(entry) {                       // TICKER fn: live firehose, capped, reduced-motion-safe via global rule
    const box = $("activity"); if (!box) return;
    const chip = document.createElement("span"); chip.className = "chip";
    const sign = entry.points >= 0 ? "up" : "down";
    chip.innerHTML = `<b>${entry.username}</b> <span class="${sign}">${signedMoney(entry.points)}</span>`;
    box.prepend(chip);
    while (box.children.length > 12) box.lastChild.remove();
  }
  function renderLeaderboard() {
    const list = $("leaderboard"); list.replaceChildren();
    if (!leaderboard.length) { const li = document.createElement("li"); li.className = "leaderboard-empty"; li.textContent = "Make a trade to enter the board."; list.appendChild(li); return; }
    leaderboard.forEach((entry, index) => {
      const li = document.createElement("li");
      const rank = document.createElement("span"); rank.className = `rank ${index === 0 ? "first" : ""}`; rank.textContent = index === 0 ? "★" : String(index + 1).padStart(2, "0");
      const name = document.createElement("span"); name.className = "leader-name"; name.textContent = entry.username;
      if (entry.isSelf) { const tag = document.createElement("i"); tag.className = "you-tag"; tag.textContent = "YOU"; name.appendChild(tag); }
      const score = document.createElement("span"); score.className = `leader-score ${entry.points < 0 ? "negative" : ""}`; score.textContent = signedMoney(entry.points);
      li.append(rank, name, score); list.appendChild(li);
    });
  }

  function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800); }
  async function connectWallet() {
    if (walletPublicKey) { showToast(`Wallet connected: ${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}`); return; }
    if (!window.solana || !window.solana.isPhantom) { showToast("Phantom wallet not detected. You can still use the simulator as a guest."); $("wallet-button-label").textContent = "Wallet unavailable"; return; }
    const button = $("connect-wallet"); button.disabled = true; $("wallet-button-label").textContent = "Connecting…";
    try {
      const response = await window.solana.connect(); walletPublicKey = response.publicKey.toString();
      $("wallet-button-label").textContent = `${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}`;
      showToast("Wallet connected. Trading remains simulated; no transaction was sent.");
    } catch (error) {
      $("wallet-button-label").textContent = "Connect wallet";
      showToast(error && error.code === 4001 ? "Wallet connection was rejected." : "Could not connect wallet. Try again or continue as guest.");
    } finally { button.disabled = false; }
  }
  function resetSession() {
    if (!window.confirm("Reset your virtual balance and clear this session's trade history? This cannot be undone.")) return;
    session = { balance: STARTING_BALANCE, realizedPnl: 0, trades: [] };
    saveState(); renderStats(); renderTrades(); $("trade-result").hidden = true; showToast("Simulation session reset.");
  }

  const VIEWS = ["dashboard", "history", "board"];
  function showView(id, pushHash = true) {
    const viewId = VIEWS.includes(id) ? id : "dashboard";
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-visible", v.id === "view-" + viewId));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === viewId));
    if (pushHash) history.replaceState(null, "", "#" + viewId);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); showView(el.dataset.view); }));
  window.addEventListener("hashchange", () => showView((location.hash || "#dashboard").slice(1), false));

  $("trade-form").addEventListener("submit", executeTrade);
  $("trade-amount").addEventListener("input", updateOrderPreview);
  $("trade-price").addEventListener("input", updateOrderPreview);
  $("connect-wallet").addEventListener("click", connectWallet);
  $("clear-history").addEventListener("click", resetSession);
  $("dismiss-notice").addEventListener("click", () => document.querySelector(".notice").remove());
  document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => {
    tradeType = button.dataset.type;
    document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("selected", item === button));
    updateOrderPreview(); $("trade-result").hidden = true;
  }));
  document.querySelectorAll("[data-amount]").forEach((button) => button.addEventListener("click", () => { $("trade-amount").value = button.dataset.amount; updateOrderPreview(); }));
  document.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => {
    chartMode = b.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach((x) => { const on = x === b; x.classList.toggle("selected", on); x.setAttribute("aria-pressed", on); });
    renderChart();
  }));

  if (!leaderboard.length) seedPeers();
  showView((location.hash || "#dashboard").slice(1), false);
  renderStats(); renderTrades(); renderLeaderboard(); renderChart(); updateOrderPreview();
  seedRealPrice();
  window.setInterval(updateMarket, 5000);
  window.setInterval(simulatePeers, 4200);
})();
