(() => {
  "use strict";

  const STARTING_BALANCE = 10000;
  const STORAGE_KEY = "shadowpool-session-v1";
  const LEADERBOARD_KEY = "shadowpool-leaderboard-v2";
  const CANDLE_COUNT = 26;
  const $ = (id) => document.getElementById(id);

  let tradeType = "Buy";
  let chartMode = "candles";
  let walletPublicKey = null;
  let session = loadSession();
  let leaderboard = loadLeaderboard();
  let marketPrice = 148.25;
  let basePrice = 148.25;
  let candles = createCandles();
  let toastTimer;
  let activeView = "dark";                 /* ===== DARK ===== */

  function loadSession() {
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); if (s && Number.isFinite(s.balance) && Array.isArray(s.trades)) return s; } catch (_) {}
    return { balance: STARTING_BALANCE, realizedPnl: 0, trades: [] };
  }
  function loadLeaderboard() {
    try { const s = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]"); return Array.isArray(s) ? s.filter((e)=>e&&typeof e.username==="string"&&Number.isFinite(e.points)).slice(0,5) : []; } catch (_) { return []; }
  }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (_) { showToast("Browser storage is unavailable. Your session may not persist."); } }
  function money(v) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(v); }
  function signedMoney(v) { return `${v>=0?"+":"−"}${money(Math.abs(v))}`; }

  function createCandles() { let v=basePrice; const o=[]; for(let i=0;i<CANDLE_COUNT;i++){ const op=v; const m=(Math.random()-0.48)*0.9; const c=Math.max(140,Math.min(158,op+m)); const h=Math.max(op,c)+Math.random()*0.4; const l=Math.min(op,c)-Math.random()*0.4; o.push({o:op,h,l,c}); v=c; } marketPrice=v; return o; }
  function tickCandles() { const last=candles[candles.length-1]; const m=(Math.random()-0.49)*0.5; const c=Math.max(140,Math.min(158,last.c+m)); last.c=c; last.h=Math.max(last.h,c); last.l=Math.min(last.l,c); marketPrice=c; if(Math.random()<0.34){ candles.push({o:c,h:c,l:c,c}); if(candles.length>CANDLE_COUNT) candles.shift(); } }

  function renderChart() {
    const g=$("candles"), lineEl=$("close-line"), areaEl=$("chart-area"); if(!g) return;
    const width=680,height=188,pad=6; const lows=candles.map(k=>k.l), highs=candles.map(k=>k.h), closes=candles.map(k=>k.c);
    const min=Math.min(...lows)-0.3, max=Math.max(...highs)+0.3; const y=v=>height-((v-min)/(max-min))*(height-pad*2)-pad; const slot=width/candles.length;
    renderYLabels(min,max);
    if(chartMode==="candles"){ let svg=""; candles.forEach((k,i)=>{ const cx=i*slot+slot/2, up=k.c>=k.o; const yO=y(k.o),yC=y(k.c),yH=y(k.h),yL=y(k.l); const top=Math.min(yO,yC), bh=Math.max(1.5,Math.abs(yC-yO)), bw=Math.max(2,slot*0.55); svg+=`<line class="wick ${up?"up":"down"}" x1="${cx.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yL.toFixed(1)}"/>`; svg+=`<rect class="body ${up?"up":"down"}" x="${(cx-bw/2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="0.6"/>`; }); g.innerHTML=svg; lineEl.style.display="none"; lineEl.setAttribute("d",""); if(areaEl) areaEl.setAttribute("d",""); }
    else { g.innerHTML=""; const pts=closes.map((v,i)=>`${i?"L":"M"}${(i*slot+slot/2).toFixed(1)} ${y(v).toFixed(1)}`).join(" "); lineEl.style.display=""; lineEl.setAttribute("d",pts); if(areaEl){ if(chartMode==="area"){ const first=(slot/2).toFixed(1), lastX=(((candles.length-1)*slot)+slot/2).toFixed(1); areaEl.setAttribute("d",`${pts} L${lastX} ${height} L${first} ${height} Z`); } else areaEl.setAttribute("d",""); } }
  }
  function renderYLabels(min,max){ const box=$("chart-y-labels"); if(!box) return; const steps=5; let html=""; for(let i=0;i<steps;i++){ const v=max-(i/(steps-1))*(max-min); html+=`<span>${v.toFixed(1)}</span>`; } box.innerHTML=html; }

  function updateMarket() {
    tickCandles();
    $("market-price").textContent = money(marketPrice);
    const change = ((marketPrice - basePrice)/basePrice)*100;
    $("market-change").textContent = `${change>=0?"+":""}${change.toFixed(2)}%`;
    $("market-change").style.color = change>=0?"var(--green)":"var(--red)";
    $("market-change").style.background = change>=0?"#153429":"#3a2028";
    renderChart(); updateOrderPreview();
    /* ===== DARK: keep the lit-reference widget + aggregate sparkline live in both venues ===== */
    const rp=$("dark-ref-price"); if(rp) rp.textContent=money(marketPrice);
    const rc=$("dark-ref-change"); if(rc){ rc.textContent=`${change>=0?"+":""}${change.toFixed(2)}%`; rc.style.color=change>=0?"var(--green)":"var(--red)"; rc.style.background=change>=0?"#153429":"#3a2028"; }
    darkSparkPush(); if(activeView==="dark") renderDarkStats();
  }

  async function seedRealPrice() {
    try { const res=await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",{cache:"no-store"}); if(!res.ok) return; const d=await res.json(); const live=Number(d&&d.solana&&d.solana.usd); if(!Number.isFinite(live)||live<=0) return; basePrice=live; marketPrice=live; candles=createCandles(); const src=$("market-source"); if(src) src.textContent="Live spot · SOL"; const note=$("feed-note"); if(note) note.textContent="Seeded from live spot price · switch chart type above"; renderChart(); $("market-price").textContent=money(marketPrice); showToast("Live SOL spot price loaded."); } catch(_){}
  }

  function getOrderInputs(){ return { quantity:Number.parseFloat($("trade-amount").value), referencePrice:Number.parseFloat($("trade-price").value) }; }
  function updateOrderPreview(){ const {quantity,referencePrice}=getOrderInputs(); const valid=Number.isFinite(quantity)&&quantity>0&&Number.isFinite(referencePrice)&&referencePrice>0; $("order-value").textContent=valid?money(quantity*referencePrice):"—"; $("execution-estimate").textContent=valid?`${money(referencePrice)} ± 0.15%`:"Enter valid values"; $("trade-btn").innerHTML=`Execute simulated ${tradeType.toLowerCase()} <span>→</span>`; $("trade-btn").disabled=!valid||quantity>100000||referencePrice>1000000; $("trade-btn").style.opacity=$("trade-btn").disabled?".55":"1"; }
  function showFeedback(message,kind){ const f=$("trade-result"); f.hidden=false; f.className=`trade-feedback ${kind}`; f.textContent=message; }
  function executeTrade(event){ event.preventDefault(); const {quantity,referencePrice}=getOrderInputs(); if(!Number.isFinite(quantity)||quantity<0.01||quantity>100000){ showFeedback("Enter a quantity between 0.01 and 100,000 SOL.","error"); return; } if(!Number.isFinite(referencePrice)||referencePrice<=0||referencePrice>1000000){ showFeedback("Enter a valid reference price greater than $0.","error"); return; } const slippageRate=(Math.random()*0.003)*(Math.random()<0.5?-1:1); const fillPrice=referencePrice*(1+slippageRate); const notional=quantity*fillPrice; const cashChange=tradeType==="Buy"?-notional:notional; if(tradeType==="Buy"&&notional>session.balance){ showFeedback(`Insufficient virtual balance. This order needs ${money(notional)}, but you have ${money(session.balance)}.`,"error"); return; } session.balance+=cashChange; const executionDifference=tradeType==="Buy"?(referencePrice-fillPrice)*quantity:(fillPrice-referencePrice)*quantity; session.realizedPnl+=executionDifference; const trade={ id:`${Date.now()}-${Math.random().toString(16).slice(2,7)}`, type:tradeType, quantity, referencePrice, fillPrice, slippageRate, executionDifference, notional, timestamp:new Date().toISOString() }; session.trades.unshift(trade); session.trades=session.trades.slice(0,50); saveState(); renderStats(); renderTrades(); recordLeaderboardResult(trade); showFeedback(`${tradeType} simulated successfully: ${quantity} SOL filled at ${money(fillPrice)}. Execution impact: ${signedMoney(executionDifference)}. No real order was submitted.`,"success"); showToast("Simulated trade recorded."); }
  function renderStats(){ $("balance-value").textContent=money(session.balance); $("pnl-value").textContent=signedMoney(session.realizedPnl); $("pnl-value").style.color=session.realizedPnl>=0?"var(--green)":"var(--red)"; $("pnl-caption").textContent=`${session.trades.length} completed ${session.trades.length===1?"trade":"trades"}`; if(!session.trades.length){ $("quality-value").textContent="—"; } else { const avg=session.trades.reduce((s,t)=>s+Math.abs(t.slippageRate),0)/session.trades.length*100; $("quality-value").textContent=`${avg.toFixed(3)}%`; } }
  function fmtTime(iso){ try { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); } catch(_){ return "—"; } }
  function renderTrades(){ const tbody=$("trade-history"); if(!session.trades.length){ tbody.innerHTML='<tr class="empty-row"><td colspan="6"><span class="empty-icon">◷</span><strong>No trades yet</strong><small>Your simulated executions will appear here.</small></td></tr>'; return; } tbody.replaceChildren(); session.trades.slice(0,12).forEach((trade)=>{ const row=document.createElement("tr"); const typeCell=document.createElement("td"); typeCell.innerHTML=`<span class="trade-type-cell"><i class="type-dot ${trade.type==="Sell"?"sell":""}"></i>${trade.type}</span>`; const quantityCell=cell(`${trade.quantity.toLocaleString("en-US",{maximumFractionDigits:4})} SOL`,"mono"); const priceCell=cell(money(trade.fillPrice),"mono"); const slipHurts=trade.type==="Buy"?trade.slippageRate>0:trade.slippageRate<0; const slippageCell=cell(`${trade.slippageRate>0?"+":""}${(trade.slippageRate*100).toFixed(3)}%`,`mono ${slipHurts?"negative":"positive"}`); const resultCell=cell(signedMoney(trade.executionDifference),`mono ${trade.executionDifference>=0?"positive":"negative"}`); const timeCell=cell(fmtTime(trade.timestamp),"mono"); row.append(typeCell,quantityCell,priceCell,slippageCell,resultCell,timeCell); tbody.appendChild(row); }); }
  function cell(text,className){ const td=document.createElement("td"); td.textContent=text; if(className) td.className=className; return td; }

  const PEERS=[{n:"0xNova",bias:1.4,vol:5},{n:"slippage_sam",bias:-0.6,vol:6},{n:"darkpool_dana",bias:0.8,vol:4},{n:"gamma_gwen",bias:2.1,vol:7},{n:"maker_max",bias:-0.2,vol:3},{n:"twap_tom",bias:0.5,vol:4},{n:"iceberg_ivy",bias:1.1,vol:5},{n:"spread_spike",bias:-1.0,vol:6}];
  function userLabel(){ return walletPublicKey?`${walletPublicKey.slice(0,4)}…${walletPublicKey.slice(-4)}`:"Guest trader"; }
  function pushLeaderboardEntry(username,points,isSelf){ pushActivity({username,points}); leaderboard.push({username,points,isSelf,timestamp:Date.now()}); leaderboard.sort((a,b)=>b.points-a.points); leaderboard=leaderboard.slice(0,5); try{ localStorage.setItem(LEADERBOARD_KEY,JSON.stringify(leaderboard)); }catch(_){} renderLeaderboard(); }
  function recordLeaderboardResult(trade){ pushLeaderboardEntry(userLabel(),Number(trade.executionDifference.toFixed(4)),true); }
  function peerPoints(p){ return +(p.bias+(Math.random()+Math.random()-1)*p.vol).toFixed(4); }
  function simulatePeers(){ if(activeView!=="lit"||document.hidden) return; /* ===== DARK: peers only churn in the lit comparison ===== */ const count=Math.random()<0.55?1:(Math.random()<0.3?2:0); for(let i=0;i<count;i++){ const p=PEERS[Math.floor(Math.random()*PEERS.length)]; pushLeaderboardEntry(p.n,peerPoints(p),false); } }
  function seedPeers(){ for(let i=0;i<4;i++){ const p=PEERS[Math.floor(Math.random()*PEERS.length)]; leaderboard.push({username:p.n,points:peerPoints(p),isSelf:false,timestamp:Date.now()-i*60000}); } leaderboard.sort((a,b)=>b.points-a.points); leaderboard=leaderboard.slice(0,5); }
  function pushActivity(entry){ const box=$("activity"); if(!box) return; const chip=document.createElement("span"); chip.className="chip"; const sign=entry.points>=0?"up":"down"; chip.innerHTML=`<b>${entry.username}</b> <span class="${sign}">${signedMoney(entry.points)}</span>`; box.prepend(chip); while(box.children.length>12) box.lastChild.remove(); }
  function renderLeaderboard(){ const list=$("leaderboard"); list.replaceChildren(); if(!leaderboard.length){ const li=document.createElement("li"); li.className="leaderboard-empty"; li.textContent="Make a trade to enter the board."; list.appendChild(li); return; } leaderboard.forEach((entry,index)=>{ const li=document.createElement("li"); const rank=document.createElement("span"); rank.className=`rank ${index===0?"first":""}`; rank.textContent=index===0?"★":String(index+1).padStart(2,"0"); const name=document.createElement("span"); name.className="leader-name"; name.textContent=entry.username; if(entry.isSelf){ const tag=document.createElement("i"); tag.className="you-tag"; tag.textContent="YOU"; name.appendChild(tag); } const score=document.createElement("span"); score.className=`leader-score ${entry.points<0?"negative":""}`; score.textContent=signedMoney(entry.points); li.append(rank,name,score); list.appendChild(li); }); }

  function showToast(message){ const toast=$("toast"); toast.textContent=message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2800); }
  async function connectWallet(){ if(walletPublicKey){ showToast(`Wallet connected: ${walletPublicKey.slice(0,4)}…${walletPublicKey.slice(-4)}`); return; } if(!window.solana||!window.solana.isPhantom){ showToast("Phantom wallet not detected. You can still use the simulator as a guest."); $("wallet-button-label").textContent="Wallet unavailable"; return; } const button=$("connect-wallet"); button.disabled=true; $("wallet-button-label").textContent="Connecting…"; try{ const r=await window.solana.connect(); walletPublicKey=r.publicKey.toString(); $("wallet-button-label").textContent=`${walletPublicKey.slice(0,4)}…${walletPublicKey.slice(-4)}`; showToast("Wallet connected. Trading remains simulated; no transaction was sent."); }catch(error){ $("wallet-button-label").textContent="Connect wallet"; showToast(error&&error.code===4001?"Wallet connection was rejected.":"Could not connect wallet. Try again or continue as guest."); }finally{ button.disabled=false; } }
  function resetSession(){ if(!window.confirm("Reset your virtual balance and clear this session's trade history? This cannot be undone.")) return; session={balance:STARTING_BALANCE,realizedPnl:0,trades:[]}; saveState(); renderStats(); renderTrades(); $("trade-result").hidden=true; showToast("Simulation session reset."); }

  /* ============================================================
     ===== DARK POOL (ATS) — faithful hidden-liquidity engine =====
     Independent of the lit balance. Teaches: no book, hidden
     resting orders, pegs (not price-picking), minimum-fill
     rejection, IOI vs firm, time-in-force, matching latency,
     and aggregate-only post-trade disclosure.
     ============================================================ */
  const PEG_LABEL = { midpoint:"Midpoint", vwap:"VWAP", moc:"Market-on-Close" };
  let darkOrders = [];
  const darkTimers = new Map();
  let darkStats = { fills:0, qty:0, bps:[], share:46.2 };
  let darkSpark = Array.from({length:24},()=>46.2+(Math.random()-0.5)*3);

  function darkMid(){ return marketPrice; }
  function matchProb(o){ let p=0.55; if(o.peg==="moc") p-=0.18; if(o.peg==="vwap") p-=0.05; if(o.size>300) p-=0.08; if(o.minFill>50) p-=0.05; return Math.max(0.07,Math.min(0.9,p)); }
  function fillPriceFor(peg,mid){ if(peg==="midpoint") return mid*(1+(Math.random()-0.5)*0.0004); if(peg==="vwap") return mid*(1+(Math.random()-0.5)*0.0012); return mid*(1+(Math.random()-0.5)*0.0025); }
  function scheduleMatch(o,attempt){ const d=2200+Math.random()*3800; const t=setTimeout(()=>{ darkTimers.delete(o.id); attemptMatch(o,attempt); }, d); darkTimers.set(o.id,t); }
  function finishOrder(o){ const t=darkTimers.get(o.id); if(t){ clearTimeout(t); darkTimers.delete(o.id); } renderDarkBook(); renderDarkStats(); }
  function attemptMatch(o,attempt){
    if(o.type==="IOI"){ o.status="ioi"; renderDarkBook(); return; }            // non-binding: never fills
    if(o.size < o.minFill){ o.status="expired"; o.reason="Below minimum fill size"; finishOrder(o); return; }
    const mid=o.midAtPlace;
    if(Math.random() < matchProb(o)){
      const remain=o.size-o.filled;
      const full = Math.random()<0.6 || attempt>=2;
      const fillQty = full ? remain : Math.max(0.01, +(remain*(0.3+Math.random()*0.5)).toFixed(2));
      const fp = fillPriceFor(o.peg, mid);
      o.filled = +(o.filled+fillQty).toFixed(4); o.fillPrice = fp;
      const quality = (o.side==="Buy" ? mid-fp : fp-mid) * fillQty;
      darkStats.fills++; darkStats.qty += fillQty; darkStats.bps.push((quality/(mid*fillQty))*10000);
      if(darkStats.bps.length>60) darkStats.bps.shift();
      if(o.filled >= o.size - 1e-9){ o.status="filled"; finishOrder(o); }
      else { o.status="partial"; renderDarkBook(); if(o.tif==="IOC"){ o.status="expired"; o.reason="IOC: remainder cancelled"; finishOrder(o); } else scheduleMatch(o, attempt+1); }
    } else {
      if(o.tif==="IOC"){ o.status="cancelled"; o.reason="IOC: no immediate liquidity"; finishOrder(o); }
      else if(attempt>=3){ o.status="expired"; o.reason="No counterparty matched in time"; finishOrder(o); }
      else scheduleMatch(o, attempt+1);
    }
  }
  function restOrder(){
    const size=Number.parseFloat($("dark-size").value);
    const minFill=Number.parseFloat($("dark-minfill").value)||0;
    const peg=$("dark-peg").value, tif=$("dark-tif").value;
    const type=document.querySelector("#dark-type .selected")?.dataset.dtype||"Firm";
    const side=document.querySelector("#dark-side .selected")?.dataset.dside||"Buy";
    const res=$("dark-result");
    if(!Number.isFinite(size)||size<0.01){ res.hidden=false; res.className="trade-feedback error"; res.textContent="Enter a size of at least 0.01 SOL."; return; }
    const o={ id:`d-${Date.now()}-${Math.random().toString(16).slice(2,6)}`, side, size, filled:0, peg, tif, type, minFill, midAtPlace:darkMid(), status:"resting", placedAt:Date.now() };
    darkOrders.unshift(o); if(darkOrders.length>30) darkOrders.pop();
    res.hidden=true; renderDarkBook();
    if(type==="IOI"){ attemptMatch(o,1); showToast("IOI logged — a non-binding indication, it will not fill."); return; }
    if(tif==="IOC"){ attemptMatch(o,1); return; }
    scheduleMatch(o,1); showToast("Order resting · hidden. Waiting for a counterparty…");
  }
  function statusClass(s){ return {resting:"st-resting",partial:"st-partial",filled:"st-filled",expired:"st-expired",cancelled:"st-cancelled",ioi:"st-ioi"}[s]||"st-resting"; }
  function renderDarkBook(){
    const box=$("dark-book"); if(!box) return;
    if(!darkOrders.length){ box.innerHTML='<div class="dark-empty"><strong>No resting orders</strong>Rest a hidden order to see how matching works — and what stays invisible.</div>'; return; }
    box.replaceChildren();
    darkOrders.forEach(o=>{
      const row=document.createElement("div"); row.className="dark-order";
      const side=document.createElement("span"); side.className=`do-side ${o.side.toLowerCase()}`; side.textContent=o.side;
      const main=document.createElement("div"); main.className="do-main";
      const l1=document.createElement("div"); l1.className="do-line1"; l1.textContent=`${o.size.toLocaleString("en-US",{maximumFractionDigits:2})} SOL · ${PEG_LABEL[o.peg]} · ${o.tif}`;
      const l2=document.createElement("div"); l2.className="do-line2";
      const tl = o.type==="IOI" ? "IOI (non-binding)" : (o.fillPrice?`filled @ ${money(o.fillPrice)} · ${o.filled}/${o.size}`:`${o.filled}/${o.size} filled`);
      l2.textContent = `${tl}${o.reason?" · "+o.reason:""}`;
      main.append(l1,l2);
      const st=document.createElement("span"); st.className=`do-status ${statusClass(o.status)}`; st.textContent=o.status.toUpperCase();
      row.append(side,main,st); box.appendChild(row);
    });
  }
  function darkSparkPush(){ const drift=(Math.random()-0.5)*0.6; darkStats.share=Math.max(38,Math.min(54,darkStats.share+drift)); darkSpark.push(darkStats.share); if(darkSpark.length>24) darkSpark.shift(); }
  function renderDarkStats(){
    const box=$("dark-stats"); if(!box) return;
    const avgBps = darkStats.bps.length ? darkStats.bps.reduce((a,b)=>a+b,0)/darkStats.bps.length : null;
    const bpsTxt = avgBps===null ? "—" : `${avgBps>=0?"+":""}${avgBps.toFixed(1)} bps`;
    const bpsCls = avgBps===null ? "" : (avgBps>=0?"pos":"neg");
    box.innerHTML =
      `<div class="dark-stat"><div class="ds-k">YOUR DARK FILLS</div><div class="ds-v">${darkStats.fills}</div></div>`+
      `<div class="dark-stat"><div class="ds-k">VOLUME EXECUTED</div><div class="ds-v">${darkStats.qty.toLocaleString("en-US",{maximumFractionDigits:2})} SOL</div></div>`+
      `<div class="dark-stat"><div class="ds-k">AVG QUALITY vs LIT MID</div><div class="ds-v ${bpsCls}">${bpsTxt}</div></div>`+
      `<div class="dark-stat"><div class="ds-k">OFF-EXCHANGE SHARE</div><div class="ds-v pur">${darkStats.share.toFixed(1)}%</div></div>`;
    const line=$("dark-spark-line"); if(line){ const w=200,h=40,pad=3; const mn=Math.min(...darkSpark), mx=Math.max(...darkSpark), rng=(mx-mn)||1; const d=darkSpark.map((v,i)=>`${i?"L":"M"}${((i/(darkSpark.length-1))*w).toFixed(1)} ${(h-pad-((v-mn)/rng)*(h-pad*2)).toFixed(1)}`).join(" "); line.setAttribute("d",d); }
  }
  function clearDark(){ darkTimers.forEach(t=>clearTimeout(t)); darkTimers.clear(); darkOrders=[]; darkStats={fills:0,qty:0,bps:[],share:46.2}; renderDarkBook(); renderDarkStats(); showToast("Dark book cleared."); }

  const VIEWS = ["dark","lit"];
  const LEGACY = { dashboard:"lit", history:"lit", board:"lit" };
  function showView(id, pushHash = true) {
    let v = VIEWS.includes(id) ? id : (LEGACY[id] || "dark");
    activeView = v;
    document.querySelectorAll(".view").forEach((el)=> el.classList.toggle("is-visible", el.id === "view-"+v));
    document.querySelectorAll(".nav-item").forEach((n)=> n.classList.toggle("active", n.dataset.view === v));
    if (pushHash) history.replaceState(null,"","#"+v);
    window.scrollTo({top:0,behavior:"auto"});
    if (v==="dark") { renderDarkBook(); renderDarkStats(); }
  }
  document.querySelectorAll("[data-view]").forEach((el)=> el.addEventListener("click",(e)=>{ e.preventDefault(); showView(el.dataset.view); }));
  window.addEventListener("hashchange", ()=> showView((location.hash||"#dark").slice(1), false));

  $("trade-form").addEventListener("submit", executeTrade);
  $("trade-amount").addEventListener("input", updateOrderPreview);
  $("trade-price").addEventListener("input", updateOrderPreview);
  $("connect-wallet").addEventListener("click", connectWallet);
  $("clear-history").addEventListener("click", resetSession);
  $("dismiss-notice").addEventListener("click", ()=> document.querySelector(".notice").remove());
  document.querySelectorAll("[data-type]").forEach((b)=> b.addEventListener("click", ()=>{ tradeType=b.dataset.type; document.querySelectorAll("[data-type]").forEach((x)=> x.classList.toggle("selected", x===b)); updateOrderPreview(); $("trade-result").hidden=true; }));
  document.querySelectorAll("[data-amount]").forEach((b)=> b.addEventListener("click", ()=>{ $("trade-amount").value=b.dataset.amount; updateOrderPreview(); }));
  document.querySelectorAll(".mode-btn").forEach((b)=> b.addEventListener("click", ()=>{ chartMode=b.dataset.mode; document.querySelectorAll(".mode-btn").forEach((x)=>{ const on=x===b; x.classList.toggle("selected",on); x.setAttribute("aria-pressed",on); }); renderChart(); }));
  /* ===== DARK wiring ===== */
  $("dark-rest").addEventListener("click", restOrder);
  $("dark-clear").addEventListener("click", clearDark);
  document.querySelectorAll("#dark-side [data-dside]").forEach((b)=> b.addEventListener("click", ()=> document.querySelectorAll("#dark-side [data-dside]").forEach((x)=> x.classList.toggle("selected", x===b))));
  document.querySelectorAll("#dark-type [data-dtype]").forEach((b)=> b.addEventListener("click", ()=> document.querySelectorAll("#dark-type [data-dtype]").forEach((x)=> x.classList.toggle("selected", x===b))));

  if (!leaderboard.length) seedPeers();
  showView((location.hash||"#dark").slice(1), false);
  renderStats(); renderTrades(); renderLeaderboard(); renderChart(); updateOrderPreview();
  renderDarkBook(); renderDarkStats();                 /* ===== DARK boot ===== */
  seedRealPrice();
  window.setInterval(updateMarket, 5000);
  window.setInterval(simulatePeers, 4200);
})();
