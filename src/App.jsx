import { useState, useEffect, useRef } from "react";

const T = {
  bg:"#050608", bg3:"#0f1117",
  border:"rgba(255,255,255,0.06)", border2:"rgba(255,255,255,0.1)",
  cyan:"#00d4ff", green:"#00e5a0", red:"#ff4d6a", gold:"#f0c040",
  text:"#e8eaf0", textDim:"#5a6070", textMid:"#9098a8",
  ema20:"#f0c040", ema200:"#a855f7",
};


// ─── FINNHUB REAL DATA ────────────────────────────────────────────────────────
const FINNHUB_KEY = "d8fr529r01qn443bbkn0d8fr529r01qn443bbkng";

async function getQuote(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    // d.c = current, d.o = open, d.h = high, d.l = low, d.pc = prev close, d.dp = % change
    if (!d.c || d.c === 0) return null;
    return {
      price: d.c,
      open: d.o,
      high: d.h,
      low: d.l,
      prevClose: d.pc,
      change: d.dp ? `${d.dp > 0 ? "+" : ""}${d.dp.toFixed(2)}%` : null,
    };
  } catch { return null; }
}

async function getCompanyProfile(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return d.name ? d : null;
  } catch { return null; }
}

async function getNewsForSymbol(symbol) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now()-7*24*3600*1000).toISOString().split("T")[0];
    const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${weekAgo}&to=${today}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return Array.isArray(d) ? d.slice(0,4) : [];
  } catch { return []; }
}

async function getInsiders(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return d.data ? d.data.slice(0,3) : [];
  } catch { return []; }
}

async function getEarnings(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return Array.isArray(d) ? d.slice(0,2) : [];
  } catch { return []; }
}

async function getRecommendations(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    return Array.isArray(d) && d.length > 0 ? d[0] : null;
  } catch { return null; }
}

async function enrichWithFinnhub(symbol) {
  const [quote, profile, news, insiders, earnings, recs] = await Promise.all([
    getQuote(symbol),
    getCompanyProfile(symbol),
    getNewsForSymbol(symbol),
    getInsiders(symbol),
    getEarnings(symbol),
    getRecommendations(symbol),
  ]);
  return { quote, profile, news, insiders, earnings, recs };
}

function isMarketOpen() {
  const et = new Date(Date.now() + new Date().getTimezoneOffset()*60000 - 4*3600000);
  const m = et.getHours()*60 + et.getMinutes(), d = et.getDay();
  return d>0 && d<6 && m>=570 && m<960;
}

function calcEMA(prices, period) {
  const k=2/(period+1); const ema=[prices[0]];
  for(let i=1;i<prices.length;i++) ema.push(prices[i]*k+ema[i-1]*(1-k));
  return ema;
}

async function fetchCandles(symbol) {
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;
  const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  const j=await r.json(); const d=JSON.parse(j.contents);
  const q=d.chart.result[0]; const ts=q.timestamp;
  const {open:o,high:h,low:l,close:cc,volume:v}=q.indicators.quote[0];
  return ts.map((_,i)=>({t:ts[i]*1000,o:o[i],h:h[i],l:l[i],c:cc[i],v:v[i]||0})).filter(x=>x.o&&x.h&&x.l&&x.c);
}

function Logo({ size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="9" fill="url(#lg)"/>
      <polyline points="5,25 11,16 18,20 25,9 31,14" stroke="#00d4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="31" cy="14" r="2.8" fill="#00e5a0"/>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="36" y2="36">
          <stop offset="0%" stopColor="#0d1a28"/>
          <stop offset="100%" stopColor="#050608"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function Spark({ up, w=100, h=32 }) {
  const pts = useRef(null);
  if(!pts.current) {
    pts.current = [];
    let y = up ? h*0.72 : h*0.28;
    for(let i=0;i<=20;i++) {
      y = Math.max(3, Math.min(h-3, y+(up?-0.6:0.6)+(Math.random()-0.5)*5));
      pts.current.push(`${(i/20)*w},${y}`);
    }
  }
  const c = up ? T.green : T.red;
  const d = `M ${pts.current.join(" L ")}`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={`sg${up?1:0}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${d} L ${w},${h} L 0,${h} Z`} fill={`url(#sg${up?1:0})`}/>
      <path d={d} stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function CandleChart({ symbol, direction, entryZone }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  useEffect(()=>{
    let dead=false;
    setStatus("loading");
    fetchCandles(symbol).then(c=>{if(!dead){setData(c);setStatus("ok");}}).catch(()=>{if(!dead)setStatus("err");});
    return()=>{dead=true;};
  },[symbol]);
  useEffect(()=>{
    if(status!=="ok"||!data||!canvasRef.current) return;
    draw(canvasRef.current, data, direction, entryZone);
  },[status,data]);
  if(status==="loading") return <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.3)",borderRadius:10}}><span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace",letterSpacing:2}}>CARGANDO CHART...</span></div>;
  if(status==="err") return <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.3)",borderRadius:10}}><span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace"}}>Chart no disponible</span></div>;
  return (
    <div style={{position:"relative",borderRadius:10,overflow:"hidden",background:"#06070c"}}>
      <canvas ref={canvasRef} style={{display:"block",width:"100%",height:"180px"}}/>
      <div style={{position:"absolute",top:7,left:10,display:"flex",gap:10}}>
        <span style={{fontSize:8,color:T.ema20,fontFamily:"'DM Mono',monospace"}}>━ EMA 20</span>
        <span style={{fontSize:8,color:T.ema200,fontFamily:"'DM Mono',monospace"}}>━ EMA 200</span>
        <span style={{fontSize:8,color:"rgba(255,255,255,0.2)",fontFamily:"'DM Mono',monospace"}}>DIARIO</span>
      </div>
    </div>
  );
}

function draw(canvas, candles, direction, entryZone) {
  const dpr=window.devicePixelRatio||1, W=canvas.offsetWidth, H=180;
  canvas.width=W*dpr; canvas.height=H*dpr;
  const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
  const pad={top:24,right:12,bottom:24,left:50};
  const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
  const data=candles.slice(-80);
  const closes=data.map(c=>c.c);
  const ema20=calcEMA(closes,20);
  const ema200=calcEMA(candles.length>=200?candles.map(c=>c.c):closes,200).slice(-data.length);
  const allP=data.flatMap(c=>[c.h,c.l]);
  const minP=Math.min(...allP)*0.996, maxP=Math.max(...allP)*1.004, rng=maxP-minP;
  const xOf=i=>pad.left+(i/(data.length-1))*cw;
  const yOf=p=>pad.top+ch-((p-minP)/rng)*ch;
  ctx.fillStyle="#06070c"; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.top+(ch/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.font=`8px 'DM Mono',monospace`;
    ctx.textAlign="right"; ctx.fillText("$"+(maxP-(rng/4)*i).toFixed(2),pad.left-3,y+3);
  }
  if(entryZone){
    const pts=entryZone.replace(/\$/g,"").split(/[-–]/);
    if(pts.length===2){
      const lo=parseFloat(pts[0]),hi=parseFloat(pts[1]);
      if(!isNaN(lo)&&!isNaN(hi)){
        ctx.fillStyle=direction==="up"?"rgba(0,229,160,0.08)":"rgba(255,77,106,0.08)";
        ctx.fillRect(pad.left,yOf(hi),cw,yOf(lo)-yOf(hi));
        ctx.strokeStyle=direction==="up"?"rgba(0,229,160,0.4)":"rgba(255,77,106,0.4)";
        ctx.lineWidth=1; ctx.setLineDash([4,4]);
        [lo,hi].forEach(p=>{ctx.beginPath();ctx.moveTo(pad.left,yOf(p));ctx.lineTo(W-pad.right,yOf(p));ctx.stroke();});
        ctx.setLineDash([]);
        ctx.fillStyle=direction==="up"?"rgba(0,229,160,0.9)":"rgba(255,77,106,0.9)";
        ctx.font="bold 8px 'DM Mono',monospace"; ctx.textAlign="left";
        ctx.fillText(direction==="up"?"▲ ZONA ENTRADA":"▼ ZONA ENTRADA",pad.left+4,yOf(hi)-4);
      }
    }
  }
  const cw2=Math.max(1.5,(cw/data.length)*0.6);
  data.forEach((c,i)=>{
    const x=xOf(i), isUp=c.c>=c.o, col=isUp?"#00e5a0":"#ff4d6a";
    ctx.strokeStyle=col; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,yOf(c.h)); ctx.lineTo(x,yOf(c.l)); ctx.stroke();
    const bt=yOf(Math.max(c.o,c.c)), bb=yOf(Math.min(c.o,c.c)), bh=Math.max(1.5,bb-bt);
    ctx.fillStyle=isUp?"rgba(0,229,160,0.2)":"rgba(255,77,106,0.2)";
    ctx.fillRect(x-cw2/2,bt,cw2,bh); ctx.strokeRect(x-cw2/2,bt,cw2,bh);
  });
  [[ema20,T.ema20],[ema200,T.ema200]].forEach(([arr,col])=>{
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.lineJoin="round"; ctx.beginPath();
    arr.forEach((v,i)=>{if(!v)return;const x=xOf(i),y=yOf(v);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
  });
  ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.font="8px 'DM Mono',monospace"; ctx.textAlign="center";
  [0,Math.floor(data.length/3),Math.floor(data.length*2/3),data.length-1].forEach(i=>{
    const d=new Date(data[i].t);
    ctx.fillText(`${d.getMonth()+1}/${d.getDate()}`,xOf(i),H-6);
  });
}

// ── REAL MARKET INTELLIGENCE ─────────────────────────────────────────────────

async function getMarketNews() {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (!Array.isArray(d)||d.length===0) return "";
    const cutoff = Date.now() - 3*24*3600*1000;
    return d.filter(n=>n.datetime*1000>cutoff).slice(0,8)
      .map(n=>`- ${n.headline} [${new Date(n.datetime*1000).toLocaleDateString()}]`).join("\n");
  } catch { return ""; }
}

async function getEarningsCalendar() {
  try {
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime()+7*24*3600*1000).toISOString().split("T")[0];
    const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (!d.earningsCalendar) return "";
    // Filter for stocks with estimates — these are most likely to move
    return d.earningsCalendar.slice(0,15)
      .map(e=>`${e.symbol} reports ${e.date} — EPS est: ${e.epsEstimate||"N/A"}, Rev est: ${e.revenueEstimate||"N/A"}`)
      .join("\n");
  } catch { return ""; }
}

async function getIPOCalendar() {
  try {
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime()+14*24*3600*1000).toISOString().split("T")[0];
    const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    const d = await r.json();
    if (!d.ipoCalendar||d.ipoCalendar.length===0) return "";
    return d.ipoCalendar.slice(0,5)
      .map(i=>`IPO: ${i.symbol||i.name} on ${i.date}, price range ${i.price||"TBD"}`)
      .join("\n");
  } catch { return ""; }
}

async function getRecentInsiderActivity() {
  // Watch list of high-activity small caps
  const watchlist = ["NVAX","SOUN","IONQ","RGTI","BBAI","CVNA","MARA","RIOT","CLSK","HIMS","CELH","SMCI"];
  try {
    const results = await Promise.all(
      watchlist.slice(0,6).map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${sym}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (!d.data||d.data.length===0) return null;
        const recent = d.data.filter(t => {
          const days = (Date.now() - new Date(t.transactionDate).getTime()) / (1000*3600*24);
          return days <= 14;
        });
        if (recent.length===0) return null;
        const buys = recent.filter(t=>t.change>0);
        const sells = recent.filter(t=>t.change<0);
        if (buys.length>0) return `${sym}: ${buys.length} insider BUY(s) last 14 days`;
        if (sells.length>2) return `${sym}: ${sells.length} insider SELL(s) last 14 days`;
        return null;
      })
    );
    return results.filter(Boolean).join("\n");
  } catch { return ""; }
}

async function getStockSentiment(symbols) {
  try {
    const results = await Promise.all(
      symbols.map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/news-sentiment?symbol=${sym}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (!d.sentiment) return null;
        const score = d.sentiment.bearishPercent !== undefined
          ? `bullish:${(d.sentiment.bullishPercent*100).toFixed(0)}% bearish:${(d.sentiment.bearishPercent*100).toFixed(0)}%`
          : null;
        if (!score) return null;
        return `${sym} sentiment: ${score}, buzz score: ${d.buzz?.weeklyAverage?.toFixed(1)||"N/A"}`;
      })
    );
    return results.filter(Boolean).join("\n");
  } catch { return ""; }
}

async function getQuotesBatch(symbols) {
  try {
    const results = await Promise.all(
      symbols.map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (!d.c||d.c===0) return null;
        const chg = ((d.c-d.pc)/d.pc*100).toFixed(2);
        return `${sym}: $${d.c.toFixed(2)} (${chg>0?"+":""}${chg}%) Vol:${d.v||0}`;
      })
    );
    return results.filter(Boolean).join("\n");
  } catch { return ""; }
}

// ── FDA PDUFA CALENDAR ───────────────────────────────────────────────────────
async function getFDAPdufa() {
  try {
    // FDA drug approvals API - public endpoint
    const today = new Date();
    const from = today.toISOString().split("T")[0].replace(/-/g,"");
    const future = new Date(today.getTime()+30*24*3600*1000).toISOString().split("T")[0].replace(/-/g,"");
    const r = await fetch(`https://api.fda.gov/drug/drugsfda.json?search=action_date:[${from}+TO+${future}]&limit=10`);
    const d = await r.json();
    if (!d.results||d.results.length===0) return "";
    return d.results.slice(0,8).map(item => {
      const app = item.submissions?.[0];
      const date = app?.action_date || "TBD";
      const drug = item.openfda?.brand_name?.[0] || item.openfda?.generic_name?.[0] || "Unknown drug";
      const company = item.sponsor_name || "Unknown";
      const type = app?.submission_type || "";
      return `FDA Decision: ${drug} by ${company} — Action date: ${date} (${type})`;
    }).join("\n");
  } catch { return ""; }
}

// ── OPENINSIDER — REAL INSIDER BUYING ────────────────────────────────────────
async function getOpenInsiderCluster() {
  try {
    // OpenInsider public RSS/JSON — cluster buys last 7 days
    // Use allorigins proxy to avoid CORS
    const url = "https://openinsider.com/screener?s=&o=&pl=&ph=&ll=&lh=&fd=7&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=100&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=20&page=1";
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy);
    const j = await r.json();
    const html = j.contents;
    // Parse ticker symbols from HTML table
    const tickers = [];
    const regex = /\/insider-trading-screener\?s=([A-Z]+)"/g;
    let match;
    const seen = new Set();
    while ((match = regex.exec(html)) !== null) {
      const sym = match[1];
      if (!seen.has(sym) && sym.length <= 5) {
        seen.add(sym);
        tickers.push(sym);
      }
      if (tickers.length >= 10) break;
    }
    if (tickers.length === 0) return "";
    return `Insider cluster buys last 7 days: ${tickers.join(", ")} — These insiders filed Form 4 purchase reports with SEC`;
  } catch { return ""; }
}

// ── UNUSUAL VOLUME SCANNER ────────────────────────────────────────────────────
async function getUnusualVolume() {
  // Check volume vs average for a watchlist using Finnhub
  const candidates = [
    "NVAX","SOUN","IONQ","RGTI","MARA","HIMS","SMCI","CVNA","CELH","BBAI",
    "PLTR","SOFI","HOOD","RKLB","ACHR","JOBY","LILM","NKLA","LCID","RIVN",
    "UPST","AFRM","OPEN","LMND","ROOT","CLOV","WISH","SPCE","MVIS","ATOS"
  ];
  try {
    const results = await Promise.all(
      candidates.slice(0,12).map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
        const d = await r.json();
        if (!d.c || d.v === undefined) return null;
        const chgPct = d.pc ? ((d.c - d.pc) / d.pc * 100) : 0;
        // Flag if volume is significant and price moving
        if (Math.abs(chgPct) > 5 && d.v > 500000) {
          return `${sym}: ${chgPct > 0 ? "+" : ""}${chgPct.toFixed(1)}% price move, volume ${(d.v/1000).toFixed(0)}K`;
        }
        return null;
      })
    );
    const movers = results.filter(Boolean);
    return movers.length > 0 ? movers.join("\n") : "";
  } catch { return ""; }
}

// ── SHORT INTEREST CANDIDATES ────────────────────────────────────────────────
async function getShortSqueezeCandidates() {
  const highShortCandidates = ["CVNA","UPST","OPEN","LMND","CLOV","MVIS","ATOS","NKLA","LCID","SPCE","BBBY","GME","AMC"];
  try {
    const results = await Promise.all(
      highShortCandidates.slice(0,8).map(async sym => {
        const [quoteR, profileR] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`),
          fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_KEY}`)
        ]);
        const quote = await quoteR.json();
        const metrics = await profileR.json();
        if (!quote.c) return null;
        const shortRatio = metrics?.metric?.shortRatio;
        const chg = quote.pc ? ((quote.c-quote.pc)/quote.pc*100).toFixed(1) : 0;
        if (shortRatio && shortRatio > 3) {
          return `${sym}: short ratio ${shortRatio.toFixed(1)} days, today ${chg > 0 ? "+" : ""}${chg}%`;
        }
        return null;
      })
    );
    return results.filter(Boolean).join("\n");
  } catch { return ""; }
}

// Master function — gathers ALL real intelligence before calling Claude
async function gatherMarketIntelligence() {
  // Run all data sources in parallel for speed
  const [news, earnings, ipos, insiders, fda, openInsider, unusualVol, shortSqueeze] = await Promise.all([
    getMarketNews(),
    getEarningsCalendar(),
    getIPOCalendar(),
    getRecentInsiderActivity(),
    getFDAPdufa(),
    getOpenInsiderCluster(),
    getUnusualVolume(),
    getShortSqueezeCandidates(),
  ]);

  // Get sentiment + quotes for movers
  const hotTickers = ["NVAX","SOUN","IONQ","RGTI","MARA","HIMS","SMCI","CVNA","CELH","BBAI"];
  const [sentiment, quotes] = await Promise.all([
    getStockSentiment(hotTickers.slice(0,5)),
    getQuotesBatch(hotTickers),
  ]);

  let context = `\n\n=== REAL-TIME MARKET INTELLIGENCE (live data fetched right now — ignore outdated training knowledge) ===\n`;

  if (fda) context += `\n🏥 FDA DECISIONS UPCOMING (binary events — highest catalyst potential):\n${fda}\n`;
  if (earnings) context += `\n📊 EARNINGS THIS WEEK (beat/miss = big move):\n${earnings}\n`;
  if (openInsider) context += `\n👤 SEC INSIDER CLUSTER BUYS (Form 4 filings):\n${openInsider}\n`;
  if (insiders) context += `\n💼 INSIDER ACTIVITY DETAIL:\n${insiders}\n`;
  if (unusualVol) context += `\n🔥 UNUSUAL PRICE MOVES TODAY (>5% with volume):\n${unusualVol}\n`;
  if (shortSqueeze) context += `\n⚡ SHORT SQUEEZE CANDIDATES (high short ratio + moving):\n${shortSqueeze}\n`;
  if (quotes) context += `\n💵 CURRENT PRICES & MOMENTUM:\n${quotes}\n`;
  if (sentiment) context += `\n📰 NEWS SENTIMENT SCORES:\n${sentiment}\n`;
  if (ipos) context += `\n🚀 UPCOMING IPOs:\n${ipos}\n`;
  if (news) context += `\n📡 LATEST MARKET NEWS:\n${news}\n`;

  context += `\n=== INSTRUCTIONS FOR ANALYSIS ===\n`;
  context += `Priority order for selecting top movers:\n`;
  context += `1. Stocks with FDA PDUFA dates this week (binary +50/-50% events)\n`;
  context += `2. Stocks on earnings calendar with high beat/miss potential\n`;
  context += `3. Stocks with SEC insider cluster buying (Form 4)\n`;
  context += `4. Stocks showing unusual volume/price moves today\n`;
  context += `5. Short squeeze candidates with high short ratio + upward pressure\n`;
  context += `Use REAL prices from the data above. Do not use outdated prices from training.\n`;

  return context;
}

// ── AI PROMPTS ────────────────────────────────────────────────────────────────
const SCAN_SYSTEM=(when)=>`You are TOP MARKET AI. Return ONLY a valid JSON object. No markdown. No text outside the braces.

Find stocks for ${when} that will appear on TOP GAINERS or TOP LOSERS. Analyze ALL these catalysts:
FDA PDUFA decisions, earnings beat/miss >30%, analyst upgrades/downgrades, price target changes, CEO/CFO changes, SEC investigations, bankruptcy/delisting risk, buybacks, dividends, government contracts, partnerships, acquisitions, share dilution, insider cluster buying, dark pool blocks, pipeline kills, clinical trial Phase 2/3 results, Golden Cross/Death Cross, RSI extremes (>80 or <20), volume 10x average, pre-market gaps >5%, bull flags, double bottoms/tops, geopolitical events, new sector regulations, competitor collapse, Fed/CPI/jobs data, Reddit/WSB mentions, short seller reports (Hindenburg/Citron), influencer mentions.

JSON format (no markdown):
{"stocks":[{"symbol":"TICKER","name":"Full Name","direction":"up","expectedMove":"+40%","entryZone":"$10 - $12","target":"$15","stopLoss":"$9","catalyst":"Catalyst label","summary":"2 sentences: specific event + why price moves.","signals":["Signal 1","Signal 2","Signal 3","Signal 4"],"options":{"viable":true,"reason":"Volume and IV explanation","play":"CALL $15 exp Friday"},"urgency":"HIGH","confidence":4,"sector":"Healthcare"}],"macro":{"active":true,"note":"1-2 sentences on relevant macro events this week."}}

Find 5-7 real US-listed stocks. Small/mid caps under $500M preferred. Real tickers only.`;

const SEARCH_SYSTEM=`You are TOP MARKET AI. Return ONLY a valid JSON object. No markdown. No text outside braces.

{"symbol":"TICKER","name":"Full Company Name","direction":"up","expectedMove":"+X%","entryZone":"$X - $Y","target":"$Z","stopLoss":"$V","catalyst":"Main catalyst","summary":"3 sentences: situation, catalyst, why it moves.","overview":"2 sentences: what the company does.","signals":["Signal 1","Signal 2","Signal 3","Signal 4"],"options":{"viable":true,"reason":"Volume/IV explanation","play":"CALL/PUT $X exp date"},"urgency":"HIGH","confidence":4,"sector":"Sector"}`;

async function callAI(system, userMsg, realPrices={}) {
  // Inject real prices into the message if available
  const priceContext = Object.keys(realPrices).length > 0
    ? `\n\nREAL-TIME PRICES (use these exact prices in your analysis):\n${Object.entries(realPrices).map(([sym,q])=>`${sym}: $${q.price} (${q.change})`).join("\n")}`
    : "";
  const res = await fetch("/api/claude",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:4000,
      system: system + "\n\nCRITICAL: Your response must start with { and end with }. Pure JSON only.",
      messages:[{role:"user",content:userMsg + priceContext}]
    })
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  const raw = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
  // Strip any markdown fences
  const clean = raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
  // Find outermost JSON object
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  if(s===-1||e<s) throw new Error("No JSON in response");
  return JSON.parse(clean.slice(s,e+1));
}

// ── STOCK CARD ────────────────────────────────────────────────────────────────
function StockCard({ s, idx }) {
  const [open, setOpen] = useState(false);
  const [realData, setRealData] = useState(null);
  const up = s.direction==="up";
  
  // Load real Finnhub data when card opens
  useEffect(()=>{
    if(!open || realData) return;
    enrichWithFinnhub(s.symbol).then(d => setRealData(d));
  },[open]);
  const ac = up ? T.green : T.red;
  const urgC = {HIGH:T.red,MEDIUM:T.gold,WATCH:T.cyan}[s.urgency]||T.cyan;
  const conf = ["","MUY BAJO","BAJO","MODERADO","ALTO","MUY ALTO"];
  return (
    <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderTop:`2px solid ${ac}`,borderRadius:14,overflow:"hidden",animation:`fadeUp 0.5s ease both`,animationDelay:`${idx*0.07}s`,opacity:0}}>
      <div onClick={()=>setOpen(!open)} style={{padding:"16px 16px 14px",cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:22,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif",letterSpacing:-0.5}}>{s.symbol}</span>
            <span style={{fontSize:16,fontWeight:700,color:ac,fontFamily:"'DM Mono',monospace"}}>{s.expectedMove}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <span style={{fontSize:8,letterSpacing:2,padding:"2px 7px",background:`${urgC}18`,border:`1px solid ${urgC}35`,borderRadius:4,color:urgC,fontFamily:"'DM Mono',monospace"}}>{s.urgency}</span>
            <span style={{fontSize:9,color:T.textDim,letterSpacing:1,fontFamily:"'DM Mono',monospace"}}>{(s.sector||"").toUpperCase()}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:11,color:T.textDim,maxWidth:"60%"}}>{s.name}</span>
          <Spark up={up} w={100} h={30}/>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",background:`${ac}12`,border:`1px solid ${ac}25`,borderRadius:20,marginBottom:10}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:ac,boxShadow:`0 0 6px ${ac}`}}/>
          <span style={{fontSize:10,color:ac,fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>{s.catalyst}</span>
        </div>
        <p style={{fontSize:12,color:T.textMid,lineHeight:1.65,margin:"0 0 12px"}}>{s.summary}</p>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",gap:3}}>
            {[1,2,3,4,5].map(n=>(
              <div key={n} style={{width:16,height:3,borderRadius:2,background:n<=(s.confidence||0)?ac:"rgba(255,255,255,0.07)"}}/>
            ))}
          </div>
          <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace"}}>{conf[s.confidence||0]}</span>
          <span style={{marginLeft:"auto",fontSize:10,color:T.textDim}}>{open?"▲ CERRAR":"▼ VER CHART + DETALLE"}</span>
        </div>
      </div>
      {open && (
        <div style={{borderTop:`1px solid ${T.border}`,animation:"fadeUp 0.2s ease both"}}>
          {/* Real-time price from Finnhub */}
          {realData?.quote && (
            <div style={{padding:"12px 16px 0",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {[
                {l:"PRICE",v:`$${realData.quote.price.toFixed(2)}`,c:T.text},
                {l:"CHANGE",v:realData.quote.change||"—",c:(realData.quote.change||"").startsWith("+")?T.green:T.red},
                {l:"HIGH",v:`$${realData.quote.high.toFixed(2)}`,c:T.green},
                {l:"LOW",v:`$${realData.quote.low.toFixed(2)}`,c:T.red},
              ].map(it=>(
                <div key={it.l} style={{background:"rgba(0,0,0,0.3)",border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 6px",textAlign:"center"}}>
                  <div style={{fontSize:7,color:T.textDim,letterSpacing:1,marginBottom:3,fontFamily:"'DM Mono',monospace"}}>{it.l}</div>
                  <div style={{fontSize:11,fontWeight:700,color:it.c,fontFamily:"'DM Mono',monospace"}}>{it.v}</div>
                </div>
              ))}
            </div>
          )}
          {realData?.recs && (
            <div style={{padding:"8px 16px 0",display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>ANALYSTS:</span>
              {[{l:"BUY",v:realData.recs.buy,c:T.green},{l:"HOLD",v:realData.recs.hold,c:T.gold},{l:"SELL",v:realData.recs.sell,c:T.red}].map(it=>(
                <span key={it.l} style={{fontSize:10,color:it.c,fontFamily:"'DM Mono',monospace"}}>{it.l} {it.v}</span>
              ))}
            </div>
          )}
          <div style={{padding:"12px 12px 0"}}>
            <CandleChart symbol={s.symbol} direction={s.direction} entryZone={s.entryZone}/>
          </div>
          <div style={{padding:"14px 16px 16px"}}>
          {realData?.news?.length>0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:8,color:T.textDim,letterSpacing:3,marginBottom:8,fontFamily:"'DM Mono',monospace"}}>RECENT NEWS</div>
              {realData.news.slice(0,3).map((n,i)=>(
                <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{display:"block",padding:"8px 10px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:6,textDecoration:"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:9,color:T.gold,fontFamily:"'DM Mono',monospace"}}>{n.source}</span>
                    <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace"}}>{new Date(n.datetime*1000).toLocaleDateString()}</span>
                  </div>
                  <p style={{fontSize:11,color:T.textMid,lineHeight:1.4,margin:0}}>{n.headline}</p>
                </a>
              ))}
            </div>
          )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[{l:"ENTRADA",v:s.entryZone,c:T.cyan},{l:"OBJETIVO",v:s.target,c:ac},{l:"STOP LOSS",v:s.stopLoss,c:T.red}].map(it=>(
                <div key={it.l} style={{background:"rgba(0,0,0,0.3)",border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 6px",textAlign:"center"}}>
                  <div style={{fontSize:7,color:T.textDim,letterSpacing:2,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>{it.l}</div>
                  <div style={{fontSize:11,fontWeight:700,color:it.c,fontFamily:"'DM Mono',monospace"}}>{it.v||"—"}</div>
                </div>
              ))}
            </div>
            {(s.signals||[]).length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:8,color:T.textDim,letterSpacing:3,marginBottom:8,fontFamily:"'DM Mono',monospace"}}>SEÑALES DETECTADAS</div>
                {s.signals.map((sig,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:5}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:ac,marginTop:5,flexShrink:0}}/>
                    <span style={{fontSize:11,color:T.textMid,lineHeight:1.5}}>{sig}</span>
                  </div>
                ))}
              </div>
            )}
            {s.options&&(
              <div style={{padding:"12px 14px",background:s.options.viable?"rgba(0,212,255,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${s.options.viable?"rgba(0,212,255,0.2)":T.border}`,borderRadius:10}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,letterSpacing:2,color:s.options.viable?T.cyan:T.textDim,fontFamily:"'DM Mono',monospace"}}>OPTIONS DESK</span>
                  <div style={{padding:"1px 6px",borderRadius:3,background:s.options.viable?"rgba(0,229,160,0.15)":"rgba(255,77,106,0.1)",fontSize:8,color:s.options.viable?T.green:T.red,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
                    {s.options.viable?"VIABLE":"NO RECOMENDADO"}
                  </div>
                </div>
                <p style={{fontSize:11,color:T.textMid,lineHeight:1.6,margin:0}}>
                  {s.options.viable&&s.options.play?<><span style={{color:T.cyan,fontWeight:600}}>{s.options.play}</span> — </>:null}
                  {s.options.reason}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MACRO PULSE ───────────────────────────────────────────────────────────────
function MacroPulse({ macro }) {
  if(!macro?.active||!macro?.note) return null;
  return (
    <div style={{margin:"0 0 16px",padding:"14px 16px",background:"rgba(240,192,64,0.04)",border:"1px solid rgba(240,192,64,0.15)",borderRadius:12,animation:"fadeUp 0.5s ease both"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.gold,boxShadow:`0 0 8px ${T.gold}`}}/>
        <span style={{fontSize:8,letterSpacing:3,color:T.gold,fontFamily:"'DM Mono',monospace"}}>MACRO PULSE</span>
      </div>
      <p style={{fontSize:11,color:"#b09850",lineHeight:1.65,margin:0}}>{macro.note}</p>
    </div>
  );
}

// ── STOCK SEARCH ──────────────────────────────────────────────────────────────
function StockSearch() {
  const [query,setQuery]=useState("");
  const [phase,setPhase]=useState("idle");
  const [result,setResult]=useState(null);
  const [err,setErr]=useState("");
  const resultRef=useRef(null);

  const search=async()=>{
    const t=query.trim().toUpperCase();
    if(!t)return;
    setPhase("loading"); setResult(null); setErr("");
    const today=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    try {
      const parsed=await callAI(SEARCH_SYSTEM,`Today: ${today}. Analyze stock: ${t}. Complete analysis. JSON only.`);
      if(!parsed.symbol)throw new Error("invalid");
      setResult(parsed); setPhase("result");
      setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),200);
    } catch(e){setErr(e.message);setPhase("error");}
  };

  const up=result?.direction==="up";
  const ac=up?T.green:T.red;
  const conf=["","MUY BAJO","BAJO","MODERADO","ALTO","MUY ALTO"];

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={query} onChange={e=>setQuery(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="AAPL, TSLA, NVDA..." maxLength={8}
          style={{flex:1,padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border2}`,borderRadius:10,color:T.text,fontSize:15,fontFamily:"'DM Mono',monospace",fontWeight:700,letterSpacing:2,outline:"none"}}
          onFocus={e=>{e.target.style.borderColor=T.cyan+"80";e.target.style.background="rgba(0,212,255,0.04)";}}
          onBlur={e=>{e.target.style.borderColor=T.border2;e.target.style.background="rgba(255,255,255,0.03)";}}
        />
        <button onClick={search} disabled={phase==="loading"||!query.trim()} style={{padding:"14px 18px",background:"rgba(0,212,255,0.1)",border:`1px solid ${T.cyan}`,borderRadius:10,color:T.cyan,fontSize:12,cursor:phase==="loading"?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",letterSpacing:1,whiteSpace:"nowrap",transition:"all 0.2s"}}>
          {phase==="loading"?"...":"ANALIZAR →"}
        </button>
      </div>

      {phase==="loading"&&(
        <div style={{padding:"18px",textAlign:"center",background:"rgba(0,212,255,0.03)",border:`1px solid ${T.border}`,borderRadius:12}}>
          <div style={{fontSize:10,color:T.cyan,letterSpacing:3,fontFamily:"'DM Mono',monospace",marginBottom:4}}>ANALIZANDO {query}...</div>
          <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Mono',monospace"}}>FDA · earnings · técnicos · opciones</div>
        </div>
      )}
      {phase==="error"&&(
        <div style={{padding:"12px 16px",borderRadius:10,background:"rgba(255,77,106,0.05)",border:"1px solid rgba(255,77,106,0.15)"}}>
          <div style={{fontSize:11,color:T.red}}>⚠ No se pudo analizar {query}. Verifica el ticker e intenta de nuevo.</div>
        </div>
      )}
      {phase==="result"&&result&&(
        <div ref={resultRef} style={{background:T.bg3,border:`1px solid ${T.border}`,borderTop:`2px solid ${ac}`,borderRadius:14,overflow:"hidden",animation:"fadeUp 0.4s ease both"}}>
          <div style={{padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:24,fontWeight:800,color:T.text,fontFamily:"'Syne',sans-serif",letterSpacing:-0.5}}>{result.symbol}</span>
                <span style={{fontSize:17,fontWeight:700,color:ac,fontFamily:"'DM Mono',monospace"}}>{result.expectedMove}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span style={{fontSize:8,letterSpacing:2,padding:"2px 7px",background:`${({HIGH:T.red,MEDIUM:T.gold,WATCH:T.cyan}[result.urgency]||T.cyan)}18`,border:`1px solid ${({HIGH:T.red,MEDIUM:T.gold,WATCH:T.cyan}[result.urgency]||T.cyan)}35`,borderRadius:4,color:{HIGH:T.red,MEDIUM:T.gold,WATCH:T.cyan}[result.urgency]||T.cyan,fontFamily:"'DM Mono',monospace"}}>{result.urgency}</span>
                <span style={{fontSize:9,color:T.textDim,letterSpacing:1,fontFamily:"'DM Mono',monospace"}}>{(result.sector||"").toUpperCase()}</span>
              </div>
            </div>
            <div style={{fontSize:12,color:T.textDim,marginBottom:10}}>{result.name}</div>
            {result.overview&&(
              <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:12}}>
                <div style={{fontSize:8,color:T.textDim,letterSpacing:3,marginBottom:5,fontFamily:"'DM Mono',monospace"}}>EMPRESA</div>
                <p style={{fontSize:11,color:T.textMid,lineHeight:1.6,margin:0}}>{result.overview}</p>
              </div>
            )}
            <div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",background:`${ac}12`,border:`1px solid ${ac}25`,borderRadius:20,marginBottom:10}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:ac,boxShadow:`0 0 6px ${ac}`}}/>
              <span style={{fontSize:10,color:ac,fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>{result.catalyst}</span>
            </div>
            <p style={{fontSize:12,color:T.textMid,lineHeight:1.65,margin:"0 0 14px"}}>{result.summary}</p>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:8,color:T.textDim,letterSpacing:3,marginBottom:8,fontFamily:"'DM Mono',monospace",display:"flex",justifyContent:"space-between"}}>
                <span>CHART DIARIO</span>
                <span style={{display:"flex",gap:10}}><span style={{color:T.ema20}}>━ EMA 20</span><span style={{color:T.ema200}}>━ EMA 200</span></span>
              </div>
              <CandleChart symbol={result.symbol} direction={result.direction} entryZone={result.entryZone}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[{l:"ENTRADA",v:result.entryZone,c:T.cyan},{l:"OBJETIVO",v:result.target,c:ac},{l:"STOP LOSS",v:result.stopLoss,c:T.red}].map(it=>(
                <div key={it.l} style={{background:"rgba(0,0,0,0.3)",border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 6px",textAlign:"center"}}>
                  <div style={{fontSize:7,color:T.textDim,letterSpacing:2,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>{it.l}</div>
                  <div style={{fontSize:11,fontWeight:700,color:it.c,fontFamily:"'DM Mono',monospace"}}>{it.v||"—"}</div>
                </div>
              ))}
            </div>
            {(result.signals||[]).length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:8,color:T.textDim,letterSpacing:3,marginBottom:8,fontFamily:"'DM Mono',monospace"}}>SEÑALES</div>
                {result.signals.map((sig,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:5}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:ac,marginTop:5,flexShrink:0}}/>
                    <span style={{fontSize:11,color:T.textMid,lineHeight:1.5}}>{sig}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{display:"flex",gap:3}}>
                {[1,2,3,4,5].map(n=>(
                  <div key={n} style={{width:16,height:3,borderRadius:2,background:n<=(result.confidence||0)?ac:"rgba(255,255,255,0.07)"}}/>
                ))}
              </div>
              <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace"}}>{conf[result.confidence||0]} CONFIDENCE</span>
            </div>
            {result.options&&(
              <div style={{padding:"12px 14px",background:result.options.viable?"rgba(0,212,255,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${result.options.viable?"rgba(0,212,255,0.2)":T.border}`,borderRadius:10}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,letterSpacing:2,color:result.options.viable?T.cyan:T.textDim,fontFamily:"'DM Mono',monospace"}}>OPTIONS DESK</span>
                  <div style={{padding:"1px 6px",borderRadius:3,background:result.options.viable?"rgba(0,229,160,0.15)":"rgba(255,77,106,0.1)",fontSize:8,color:result.options.viable?T.green:T.red,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>
                    {result.options.viable?"VIABLE":"NO RECOMENDADO"}
                  </div>
                </div>
                <p style={{fontSize:11,color:T.textMid,lineHeight:1.6,margin:0}}>
                  {result.options.viable&&result.options.play?<><span style={{color:T.cyan,fontWeight:600}}>{result.options.play}</span> — </>:null}
                  {result.options.reason}
                </p>
              </div>
            )}
          </div>
          <div style={{padding:"0 16px 16px"}}>
            <button onClick={()=>{setPhase("idle");setResult(null);setQuery("");}} style={{width:"100%",padding:"11px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.textDim,fontSize:10,letterSpacing:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.cyan+"50";e.currentTarget.style.color=T.cyan;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textDim;}}
            >← BUSCAR OTRO STOCK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCAN MESSAGES ─────────────────────────────────────────────────────────────
const MSGS=["Analizando calendarios FDA...","Revisando earnings reports...","Detectando compras institucionales...","Buscando short squeezes activos...","Cruzando opciones con alto volumen...","Verificando catalizadores técnicos...","Analizando condiciones macro...","Generando reporte final..."];

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [phase,setPhase]=useState("home");
  const [stocks,setStocks]=useState([]);
  const [macro,setMacro]=useState(null);
  const [mode,setMode]=useState(null);
  const [scanTime,setScanTime]=useState("");
  const [msgIdx,setMsgIdx]=useState(0);
  const [errMsg,setErrMsg]=useState("");
  const resultsRef=useRef(null);

  useEffect(()=>{
    if(phase!=="scanning")return;
    const t=setInterval(()=>setMsgIdx(n=>n+1),1100);
    return()=>clearInterval(t);
  },[phase]);

  const handleMode=(m)=>{
    if(m==="today"&&isMarketOpen()){setPhase("blocked");return;}
    setMode(m); runScan(m);
  };

  const runScan=async(m)=>{
    setPhase("scanning"); setStocks([]); setMacro(null); setErrMsg("");
    const modeKey=m==="today"?"tomorrow":m;
    const when=modeKey==="week"?"this week (next 5 trading days)":"tomorrow (next trading day)";
    const today=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    try {
      // Gather ALL real market intelligence before calling Claude
      const marketContext = await gatherMarketIntelligence();
      const parsed=await callAI(SCAN_SYSTEM(when),`Today: ${today}. Generate market analysis for ${when}. JSON only.${marketContext}`);
      if(!parsed.stocks?.length)throw new Error("No stocks");
      setStocks(parsed.stocks); setMacro(parsed.macro||null);
      setScanTime(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
      setPhase("results");
      setTimeout(()=>resultsRef.current?.scrollIntoView({behavior:"smooth"}),300);
    } catch(e){
      setErrMsg(e.message);
      setPhase("error");
    }
  };

  const modeLabel={tomorrow:"NEXT SESSION",week:"THIS WEEK",today:"TODAY'S MARKET"};

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif",overflowX:"hidden"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:`radial-gradient(ellipse 70% 35% at 50% 0%,rgba(0,212,255,0.07) 0%,transparent 70%)`}}/>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:0.35,backgroundImage:`linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)`,backgroundSize:"48px 48px"}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:500,margin:"0 auto"}}>

        {/* HEADER */}
        <div style={{padding:"32px 22px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Logo/>
            <div>
              <div style={{fontSize:18,fontWeight:800,letterSpacing:-0.5,color:T.text,fontFamily:"'Syne',sans-serif",lineHeight:1}}>TOP MARKET <span style={{color:T.cyan}}>AI</span></div>
              <div style={{fontSize:9,color:T.textDim,letterSpacing:2,fontFamily:"'DM Mono',monospace"}}>MARKET INTELLIGENCE ENGINE</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:T.green,boxShadow:`0 0 8px ${T.green}`}}/>
            <span style={{fontSize:9,color:T.textDim,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>LIVE</span>
          </div>
        </div>

        {/* HOME */}
        {(phase==="home"||phase==="blocked"||phase==="error")&&(
          <div style={{padding:"32px 20px 40px"}}>
            <div style={{marginBottom:32}}>
              <h1 style={{fontSize:"clamp(28px,7vw,38px)",fontWeight:800,fontFamily:"'Syne',sans-serif",color:T.text,letterSpacing:-1,lineHeight:1.15,margin:"0 0 12px"}}>
                Tu analista<br/><span style={{color:T.cyan}}>Wall Street</span><br/>personal.
              </h1>
              <p style={{fontSize:13,color:T.textDim,lineHeight:1.65,margin:0,maxWidth:320}}>Busca solo. Analiza todo. Te entrega el reporte.<br/>Stocks, opciones y macro — sin que toques nada.</p>
            </div>

            {phase==="blocked"&&(
              <div style={{padding:"14px 16px",borderRadius:12,marginBottom:20,background:"rgba(255,77,106,0.06)",border:"1px solid rgba(255,77,106,0.2)"}}>
                <div style={{fontSize:13,color:T.red,marginBottom:4}}>🏇 The race already started</div>
                <div style={{fontSize:11,color:"#9a6070",lineHeight:1.6}}>The market is already open. The best analysis is done <strong style={{color:"#c08090"}}>before the opening bell</strong>. Check Next Session or This Week instead.</div>
              </div>
            )}
            {phase==="error"&&(
              <div style={{padding:"12px 16px",borderRadius:12,marginBottom:20,background:"rgba(255,77,106,0.05)",border:"1px solid rgba(255,77,106,0.15)"}}>
                <div style={{fontSize:11,color:T.red,marginBottom:4}}>⚠ Error al escanear</div>
                <div style={{fontSize:10,color:"#7a5060"}}>El análisis no pudo completarse. Intenta de nuevo en unos momentos.</div>
              </div>
            )}

            <div style={{fontSize:9,letterSpacing:4,color:T.textDim,fontFamily:"'DM Mono',monospace",marginBottom:14}}>¿CUÁNDO ANALIZAR?</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:36}}>
              {[
                {id:"tomorrow",icon:"◎",label:"Next Session",sub:"Best time — overnight pre-market analysis",hot:true},
                {id:"week",icon:"◈",label:"This Week",sub:"Catalysts for the next 5 trading days"},
                {id:"today",icon:"◉",label:"Today's Market",sub:"Only available before market open"},
              ].map((btn,i)=>(
                <button key={btn.id} onClick={()=>handleMode(btn.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"18px 20px",background:btn.hot?"rgba(0,212,255,0.04)":T.bg3,border:`1px solid ${btn.hot?"rgba(0,212,255,0.2)":T.border}`,borderRadius:14,cursor:"pointer",textAlign:"left",animation:`fadeUp 0.45s ease both`,animationDelay:`${i*0.1}s`,opacity:0,transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.cyan+"60";e.currentTarget.style.background="rgba(0,212,255,0.07)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=btn.hot?"rgba(0,212,255,0.2)":T.border;e.currentTarget.style.background=btn.hot?"rgba(0,212,255,0.04)":T.bg3;}}
                >
                  <span style={{fontSize:24,color:T.cyan,opacity:0.6,flexShrink:0}}>{btn.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <span style={{fontSize:16,fontWeight:700,color:T.text,fontFamily:"'Syne',sans-serif"}}>{btn.label}</span>
                      {btn.hot&&<span style={{fontSize:8,padding:"1px 6px",borderRadius:10,background:"rgba(0,229,160,0.15)",color:T.green,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>RECOMMENDED</span>}
                    </div>
                    <span style={{fontSize:11,color:T.textDim}}>{btn.sub}</span>
                  </div>
                  <span style={{color:T.textDim,fontSize:16}}>→</span>
                </button>
              ))}
            </div>

            {/* STOCK SEARCH */}
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:28}}>
              <div style={{fontSize:9,letterSpacing:4,color:T.textDim,fontFamily:"'DM Mono',monospace",marginBottom:6}}>BUSCAR STOCK</div>
              <p style={{fontSize:11,color:T.textDim,lineHeight:1.6,marginBottom:16}}>¿Ya tienes un stock en mente? Escribe el ticker y recibe análisis completo con chart.</p>
              <StockSearch/>
            </div>
          </div>
        )}

        {/* SCANNING */}
        {phase==="scanning"&&(
          <div style={{padding:"64px 24px",textAlign:"center"}}>
            <div style={{position:"relative",width:130,height:130,margin:"0 auto 36px"}}>
              {[0,1,2].map(r=>(
                <div key={r} style={{position:"absolute",inset:r*18,borderRadius:"50%",border:`1px solid ${r===0?T.cyan:r===1?"rgba(0,212,255,0.3)":"rgba(0,229,160,0.15)"}`,animation:`spin ${2+r*0.8}s linear infinite ${r%2?"reverse":""}`}}>
                  <div style={{position:"absolute",top:r===0?-3:-2.5,left:"50%",transform:"translateX(-50%)",width:r===0?6:5,height:r===0?6:5,borderRadius:"50%",background:r===0?T.cyan:r===1?T.green:T.gold,boxShadow:`0 0 10px ${r===0?T.cyan:r===1?T.green:T.gold}`}}/>
                </div>
              ))}
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><Logo size={36}/></div>
            </div>
            <div style={{fontSize:11,color:T.cyan,letterSpacing:3,fontFamily:"'DM Mono',monospace",marginBottom:10}}>ESCANEANDO MERCADO</div>
            <div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Mono',monospace",letterSpacing:1,minHeight:18}}>{MSGS[msgIdx%MSGS.length]}</div>
          </div>
        )}

        {/* RESULTS */}
        {phase==="results"&&stocks.length>0&&(
          <div ref={resultsRef} style={{padding:"24px 16px 48px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",marginBottom:18,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:12}}>
              <div>
                <div style={{fontSize:10,color:T.cyan,letterSpacing:1,fontFamily:"'DM Mono',monospace",marginBottom:2}}>REPORTE · {modeLabel[mode]||""}</div>
                <div style={{fontSize:11,color:T.textDim}}>{stocks.length} stocks · {scanTime}</div>
              </div>
              <div style={{display:"flex",gap:18,textAlign:"center"}}>
                <div><div style={{fontSize:20,fontWeight:800,color:T.green,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{stocks.filter(s=>s.direction==="up").length}</div><div style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'DM Mono',monospace"}}>ALCISTAS</div></div>
                <div><div style={{fontSize:20,fontWeight:800,color:T.red,fontFamily:"'Syne',sans-serif",lineHeight:1}}>{stocks.filter(s=>s.direction==="down").length}</div><div style={{fontSize:8,color:T.textDim,letterSpacing:1,fontFamily:"'DM Mono',monospace"}}>BAJISTAS</div></div>
              </div>
            </div>
            <MacroPulse macro={macro}/>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              {stocks.map((s,i)=><StockCard key={i} s={s} idx={i}/>)}
            </div>
            <button onClick={()=>{setPhase("home");setStocks([]);setMacro(null);}} style={{width:"100%",padding:"14px",background:"transparent",border:`1px solid ${T.border2}`,borderRadius:12,color:T.textDim,fontSize:11,letterSpacing:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.cyan+"50";e.currentTarget.style.color=T.cyan;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border2;e.currentTarget.style.color=T.textDim;}}
            >← NUEVO ANÁLISIS</button>
            <div style={{marginTop:20,padding:"10px 14px",borderRadius:8,fontSize:9,color:"#2a3040",lineHeight:1.7,fontFamily:"'DM Mono',monospace",border:`1px solid rgba(255,255,255,0.03)`}}>⚠ NO ES CONSEJO FINANCIERO. Solo educativo. Siempre realiza tu propia investigación antes de operar.</div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#050608;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        button{font-family:inherit;}button:active{transform:scale(0.98);}
        input{font-family:inherit;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#1a2030;}
      `}</style>
    </div>
  );
}
