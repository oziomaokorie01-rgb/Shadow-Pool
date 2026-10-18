(() => {
  "use strict";

  const STARTING_BALANCE = 10000;
  const STORAGE_KEY = "shadowpool-session-v1";
  const LEADERBOARD_KEY = "shadowpool-leaderboard-v1";
  const $ = (id) => document.getElementById(id);

  let tradeType = "Buy";
  let walletPublicKey = null;
  let session = loadSession();
  let leaderboard = loadLeaderboard();
  let marketPrice = 148.25;
  let chartValues = createChartValues();
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
      return Array.isArray(saved) ? saved.filter((entry) => entry && typeof entry.username === "string" && Number.isFinite(entry.points)).slice(0, 5) : [];
    } catch (_) { return []; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) { showToast("Browser storage is unavailable. Your session may not persist."); }
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  function signedMoney(value) {
    return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
  }

  function createChartValues() {
    let value = 148.25;
    return Array.from({ length: 42 }, () => {
      value += (Math.random() - 0.47) * 0.48;
      value = Math.max(146.1, Math.min(149.8, value));
      return value;
    });
  }

  function drawChart() {
    const width = 680, height = 188, pad = 5;
    const min = Math.min(...chartValues) - 0.35;
    const max = Math.max(...chartValues) + 0.35;
    const points = chartValues.map((v, i) => {
      const x = (i / (chartValues.length - 1)) * width;
      const y = height - ((v - min) / (max - min)) * (height - pad * 2) - pad;
      return [x, y];
    });
    const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    $("chart-line").setAttribute("d", line);
    $("chart-area").setAttribute("d", `${line} L${width} ${height} L0 ${height} Z`);
  }

  function updateMarket() {
    marketPrice = Math.max(140, Math.min(155, marketPrice + (Math.random() - 0.49) * 0.22));
    chartValues.push(marketPrice);
    chartValues = chartValues.slice(-42);
    $("market-price").textContent = money(marketPrice);
    const change = ((marketPrice - 148.25) / 148.25) * 100;
    $("market-change").textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    $("market-change").style.color = change >= 0 ? "var(--green)" : "var(--red)";
    $("market-change").style.background = change >= 0 ? "#153429" : "#3a2028";
    drawChart();
    updateOrderPreview();
  }

  function getOrderInputs() {
    return {
      quantity: Number.parseFloat($("trade-amount").value),
      referencePrice: Number.parseFloat($("trade-price").value)
    };
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
    const feedback = $("trade-result");
    feedback.hidden = false;
    feedback.className = `trade-feedback ${kind}`;
    feedback.textContent = message;
  }

  function executeTrade(event) {
    event.preventDefault();
    const { quantity, referencePrice } = getOrderInputs();
    if (!Number.isFinite(quantity) || quantity < 0.01 || quantity > 100000) {
      showFeedback("Enter a quantity between 0.01 and 100,000 SOL.", "error"); return;
    }
    if (!Number.isFinite(referencePrice) || referencePrice <= 0 || referencePrice > 1000000) {
      showFeedback("Enter a valid reference price greater than $0.", "error"); return;
    }

    // Simulate a small execution slippage. This is a learning model, not a market quote.
    const slippageRate = (Math.random() * 0.003) * (Math.random() < 0.5 ? -1 : 1);
    const fillPrice = referencePrice * (1 + slippageRate);
    const notional = quantity * fillPrice;
    const cashChange = tradeType === "Buy" ? -notional : notional;
    if (tradeType === "Buy" && notional > session.balance) {
      showFeedback(`Insufficient virtual balance. This order needs ${money(notional)}, but you have ${money(session.balance)}.`, "error");
      return;
    }

    session.balance += cashChange;
    // P/L is the execution difference versus the entered reference, not investment profit.
    const executionDifference = tradeType === "Buy"
      ? (referencePrice - fillPrice) * quantity
      : (fillPrice - referencePrice) * quantity;
    session.realizedPnl += executionDifference;

    const trade = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      type: tradeType,
      quantity,
      referencePrice,
      fillPrice,
      slippageRate,
      executionDifference,
      notional,
      timestamp: new Date().toISOString()
    };
    session.trades.unshift(trade);
    session.trades = session.trades.slice(0, 50);
    saveState();
    renderStats();
    renderTrades();
    recordLeaderboardResult(trade);
    showFeedback(`${tradeType} simulated successfully: ${quantity} SOL filled at ${money(fillPrice)}. Execution impact: ${signedMoney(executionDifference)}. No real order was submitted.`, "success");
    showToast("Simulated trade recorded.");
  }

  function renderStats() {
    $("balance-value").textContent = money(session.balance);
    $("pnl-value").textContent = signedMoney(session.realizedPnl);
    $("pnl-value").style.color = session.realizedPnl >= 0 ? "var(--green)" : "var(--red)";
    $("pnl-caption").textContent = `${session.trades.length} completed ${session.trades.length === 1 ? "trade" : "trades"}`;
    if (!session.trades.length) {
      $("quality-value").textContent = "—";
    } else {
      const averageSlippage = session.trades.reduce((sum, t) => sum + Math.abs(t.slippageRate), 0) / session.trades.length * 100;
      $("quality-value").textContent = `${averageSlippage.toFixed(3)}%`;
    }
  }

  function renderTrades() {
    const tbody = $("trade-history");
    if (!session.trades.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5"><span class="empty-icon">◷</span><strong>No trades yet</strong><small>Your simulated executions will appear here.</small></td></tr>';
      return;
    }
    tbody.replaceChildren();
    session.trades.slice(0, 8).forEach((trade) => {
      const row = document.createElement("tr");
      const typeCell = document.createElement("td");
      typeCell.innerHTML = `<span class="trade-type-cell"><i class="type-dot ${trade.type === "Sell" ? "sell" : ""}"></i>${trade.type}</span>`;
      const quantityCell = cell(`${trade.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`, "mono");
      const priceCell = cell(money(trade.fillPrice), "mono");
      const slipHurts = trade.type === "Buy" ? trade.slippageRate > 0 : trade.slippageRate < 0;
      const slippageCell = cell(`${trade.slippageRate > 0 ? "+" : ""}${(trade.slippageRate * 100).toFixed(3)}%`, `mono ${slipHurts ? "negative" : "positive"}`);
      const resultCell = cell(signedMoney(trade.executionDifference), `mono ${trade.executionDifference >= 0 ? "positive" : "negative"}`);
      row.append(typeCell, quantityCell, priceCell, slippageCell, resultCell);
      tbody.appendChild(row);
    });
  }

  function cell(text, className) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function recordLeaderboardResult(trade) {
    // This board compares each browser's best execution result; it is not a global leaderboard.
    const username = walletPublicKey ? `${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}` : "Guest trader";
    leaderboard.push({ username, points: Number(trade.executionDifference.toFixed(4)), timestamp: Date.now() });
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard = leaderboard.slice(0, 5);
    try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard)); } catch (_) {}
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const list = $("leaderboard");
    list.replaceChildren();
    if (!leaderboard.length) {
      const li = document.createElement("li");
      li.className = "leaderboard-empty";
      li.textContent = "Make a trade to enter the board.";
      list.appendChild(li);
      return;
    }
    leaderboard.forEach((entry, index) => {
      const li = document.createElement("li");
      const rank = document.createElement("span");
      rank.className = `rank ${index === 0 ? "first" : ""}`;
      rank.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.className = "leader-name";
      name.textContent = entry.username;
      const score = document.createElement("span");
      score.className = `leader-score ${entry.points < 0 ? "negative" : ""}`;
      score.textContent = signedMoney(entry.points);
      li.append(rank, name, score);
      list.appendChild(li);
    });
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  async function connectWallet() {
    if (walletPublicKey) {
      showToast(`Wallet connected: ${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}`);
      return;
    }
    if (!window.solana || !window.solana.isPhantom) {
      showToast("Phantom wallet not detected. You can still use the simulator as a guest.");
      $("wallet-button-label").textContent = "Wallet unavailable";
      return;
    }
    const button = $("connect-wallet");
    button.disabled = true;
    $("wallet-button-label").textContent = "Connecting…";
    try {
      const response = await window.solana.connect();
      walletPublicKey = response.publicKey.toString();
      $("wallet-button-label").textContent = `${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}`;
      showToast("Wallet connected. Trading remains simulated; no transaction was sent.");
    } catch (error) {
      $("wallet-button-label").textContent = "Connect wallet";
      showToast(error && error.code === 4001 ? "Wallet connection was rejected." : "Could not connect wallet. Try again or continue as guest.");
    } finally {
      button.disabled = false;
    }
  }

  function resetSession() {
    if (!window.confirm("Reset your virtual balance and clear this session's trade history? This cannot be undone.")) return;
    session = { balance: STARTING_BALANCE, realizedPnl: 0, trades: [] };
    saveState();
    renderStats();
    renderTrades();
    $("trade-result").hidden = true;
    showToast("Simulation session reset.");
  }

  $("trade-form").addEventListener("submit", executeTrade);
  $("trade-amount").addEventListener("input", updateOrderPreview);
  $("trade-price").addEventListener("input", updateOrderPreview);
  $("connect-wallet").addEventListener("click", connectWallet);
  $("clear-history").addEventListener("click", resetSession);
  $("dismiss-notice").addEventListener("click", () => document.querySelector(".notice").remove());

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      tradeType = button.dataset.type;
      document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("selected", item === button));
      updateOrderPreview();
      $("trade-result").hidden = true;
    });
  });

  document.querySelectorAll("[data-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      $("trade-amount").value = button.dataset.amount;
      updateOrderPreview();
    });
  });

  renderStats();
  renderTrades();
  renderLeaderboard();
  drawChart();
  updateOrderPreview();
  window.setInterval(updateMarket, 5000);
})();
