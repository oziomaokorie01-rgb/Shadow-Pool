// ================================
// 🕶️ Dark Pool Trading Simulator
// ================================

let walletPublicKey = null;
let trades = [];
let leaderboard = JSON.parse(localStorage.getItem('leaderboard') || "[]");

document.getElementById('connect-wallet').onclick = async function() {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      walletPublicKey = resp.publicKey.toString();
      document.getElementById('wallet-status').innerText = "Wallet: " + walletPublicKey;
    } catch (err) {
      document.getElementById('wallet-status').innerText = "Wallet connection failed!";
    }
  } else {
    document.getElementById('wallet-status').innerText = "Phantom wallet not found.";
  }
};

document.getElementById('trade-btn').onclick = async function() {
  let type = document.getElementById('trade-type').value;
  let amount = parseInt(document.getElementById('trade-amount').value);
  let price = parseFloat(document.getElementById('trade-price').value);

  // Simulate dark pool fill (random price deviation)
  let fillPrice = price + (Math.random() > 0.5 ? Math.random() * 5 : -Math.random() * 5);
  let profit = type === "Buy" ? ((fillPrice - price) * amount) : ((price - fillPrice) * amount);

  let trade = {
    type,
    amount,
    price: fillPrice.toFixed(2),
    profit: profit.toFixed(2)
  };
  trades.push(trade);

  document.getElementById('trade-result').innerText =
    `${type} ${amount} @ $${fillPrice.toFixed(2)} | Profit: $${profit.toFixed(2)}${walletPublicKey ? ' | Reward logic here!' : ''}`;

  updateTradeHistory();
  updateLeaderboard(walletPublicKey || "Guest", profit);

  // 🔐 Send trade event to Arcium Privacy SDK (simulated)
  if (walletPublicKey) {
    await arciumSendPrivateAction("trade_executed", walletPublicKey, { trade });
  }
};

function updateTradeHistory() {
  let html = trades.map((t, i) =>
    `${i + 1}. ${t.type} ${t.amount} @ $${t.price} | Profit: $${t.profit}`).join('<br>');
  document.getElementById('trade-history').innerHTML = html;
}

function updateLeaderboard(username, profit) {
  leaderboard.push({ username, points: Number(profit) });
  leaderboard = leaderboard.sort((a, b) => b.points - a.points).slice(0, 5);
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
  renderLeaderboard();
}

function renderLeaderboard() {
  document.getElementById('leaderboard').innerHTML =
    leaderboard.map(e => `<li>${e.username}: ${e.points} pts</li>`).join('');
}

renderLeaderboard();


// ======================================
// 🔒 Arcium Privacy SDK Demo Integration
// ======================================

function arciumSendPrivateAction(actionType, walletAddress, data) {
  // Simulate sending a privacy-preserving action to Arcium
  // Replace this with real Arcium SDK when available
  console.log(
    `[Arcium SDK] Sending private action "${actionType}" for wallet ${walletAddress} with data:`,
    data
  );
  // Imagine this encrypts and transmits privately!
  // In real use: arciumSDK.send(actionType, walletAddress, data);
  // For demo, just show a confirmation
  return Promise.resolve("Arcium privacy action sent (simulated)");
}

// Example usage for future features (like Flap Jack Poker)
function playerWins(score) {
  if (walletPublicKey) {
    arciumSendPrivateAction("flapjack_win", walletPublicKey, { score });
  }
    }
