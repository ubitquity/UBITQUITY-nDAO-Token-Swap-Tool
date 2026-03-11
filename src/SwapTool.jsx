import { useState, useEffect, useCallback, useRef } from "react";

// ─── Token Registry ──────────────────────────────────────────
const TOKENS = [
  { symbol: "UBQT",    name: "Ubitquity Token",      contract: "ubitquityllc", alcorId: "ubqt-ubitquityllc",    precision: 4, color: "#00D4AA" },
  { symbol: "UBQTX",   name: "Ubitquity X Token",    contract: "tokencreate",  alcorId: "ubqtx-tokencreate",    precision: 4, color: "#00B894" },
  { symbol: "TITLET",  name: "Title Token",           contract: "tokencreate",  alcorId: "titlet-tokencreate",   precision: 4, color: "#6C5CE7" },
  { symbol: "NDAO",    name: "nDAO Token",            contract: "tokencreate",  alcorId: "ndao-tokencreate",     precision: 4, color: "#FDA085" },
  { symbol: "NDAOX",   name: "nDAO X Token",          contract: "tokencreate",  alcorId: "ndaox-tokencreate",    precision: 4, color: "#F97316" },
  { symbol: "DEED",    name: "Deed Token",            contract: "tokencreate",  alcorId: "deed-tokencreate",     precision: 4, color: "#E17055" },
  { symbol: "AETHERT", name: "Aether Token",          contract: "tokencreate",  alcorId: "aethert-tokencreate",  precision: 4, color: "#74B9FF" },
  { symbol: "GAMES",   name: "Games Token",           contract: "tokencreate",  alcorId: "games-tokencreate",    precision: 4, color: "#A29BFE" },
  { symbol: "BEATS",   name: "Beats Token",           contract: "tokencreate",  alcorId: "beats-tokencreate",    precision: 4, color: "#FD79A8" },
  { symbol: "CAUDIT",  name: "Crypto Audit Token",    contract: "tokencreate",  alcorId: "caudit-tokencreate",   precision: 4, color: "#55EFC4" },
];

const STATUS = { IDLE: "idle", CONNECTING: "connecting", CONNECTED: "connected", SWAPPING: "swapping", SUCCESS: "success", ERROR: "error" };

const WEBAUTH_CONFIG = {
  linkOptions: {
    chainId: "384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0",
    endpoints: [
      "https://proton.greymass.com",
      "https://xpr.eosusa.io",
      "https://api.protonnz.com",
    ],
  },
  transportOptions: {
    requestAccount: "nwosnack2",
    requestStatus: false,
  },
  selectorOptions: {
    appName: "UBITQUITY + nDAO Swap",
    appLogo: "",
  },
};

// ─── API helper — routes through PHP proxy in production ──────
const API_BASE = "/api";

async function apiFetch(endpoint, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Sub-components ──────────────────────────────────────────

const HexGrid = () => {
  const cells = [];
  for (let i = 0; i < 80; i++) {
    const x = (i % 10) * 11 + (Math.floor(i / 10) % 2 === 0 ? 0 : 5.5);
    const y = Math.floor(i / 10) * 9.5;
    cells.push(
      <g key={i} transform={`translate(${x}, ${y})`} opacity={0.03 + Math.random() * 0.06}>
        <polygon points="5,0 10,2.5 10,7.5 5,10 0,7.5 0,2.5" fill="none" stroke="#00D4AA" strokeWidth="0.3" />
      </g>
    );
  }
  return <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 110 80" preserveAspectRatio="xMidYMid slice">{cells}</svg>;
};

const TokenBadge = ({ token, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    background: `linear-gradient(135deg, ${token.color}33, ${token.color}11)`,
    border: `1.5px solid ${token.color}55`, fontSize: size * 0.28, fontWeight: 700, color: token.color,
    letterSpacing: "-0.02em", flexShrink: 0,
  }}>
    {token.symbol.slice(0, 2)}
  </div>
);

const TokenSelect = ({ value, onChange, otherValue, label, prices }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = TOKENS.find(t => t.symbol === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <button onClick={() => setOpen(!open)} style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", width: "100%",
        color: "#E5E7EB", fontSize: 15, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s", outline: "none",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,212,170,0.3)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
      >
        {selected && <TokenBadge token={selected} size={28} />}
        <div style={{ flex: 1, textAlign: "left" }}>
          <div>{selected?.symbol || "Select"}</div>
          {selected && prices[selected.symbol]?.usd_price != null && (
            <div style={{ fontSize: 9, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>
              {prices[selected.symbol].usd_derived ? "~$" : "$"}{prices[selected.symbol].usd_price.toFixed(6)}
            </div>
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: 300, overflowY: "auto", padding: 4,
        }}>
          {TOKENS.map(t => {
            const p = prices[t.symbol];
            return (
              <button key={t.symbol} disabled={t.symbol === otherValue} onClick={() => { onChange(t.symbol); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px",
                  border: "none", borderRadius: 8, cursor: t.symbol === otherValue ? "not-allowed" : "pointer",
                  background: t.symbol === value ? "rgba(0,212,170,0.1)" : "transparent",
                  color: t.symbol === otherValue ? "#4B5563" : "#E5E7EB", fontSize: 13, fontWeight: 500,
                  fontFamily: "inherit", opacity: t.symbol === otherValue ? 0.4 : 1, transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (t.symbol !== otherValue) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = t.symbol === value ? "rgba(0,212,170,0.1)" : "transparent"; }}
              >
                <TokenBadge token={t} size={24} />
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div>{t.symbol}</div>
                  <div style={{ fontSize: 10, color: "#6B7280" }}>{t.name}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  {p?.usd_price != null ? (
                    <span style={{ color: "#9CA3AF" }}>{p.usd_derived ? "~$" : "$"}{p.usd_price.toFixed(6)}</span>
                  ) : p?.error ? (
                    <span style={{ color: "#4B5563" }}>—</span>
                  ) : (
                    <span style={{ color: "#4B5563" }}>···</span>
                  )}
                  {p?.system_price != null && (
                    <div style={{ color: "#4B5563", fontSize: 9 }}>{p.system_price.toFixed(4)} XPR</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────

export default function SwapTool() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [wallet, setWallet] = useState(null);
  const [fromToken, setFromToken] = useState("UBQT");
  const [toToken, setToToken] = useState("NDAO");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("1.0");
  const [showSettings, setShowSettings] = useState(false);
  const [txLog, setTxLog] = useState([]);
  const [swapAnim, setSwapAnim] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const webAuthLinkRef = useRef(null);
  const webAuthSessionRef = useRef(null);

  // ── Live Alcor Exchange Pricing ──
  const [prices, setPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesLastUpdated, setPricesLastUpdated] = useState(null);

  const fetchAllPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      // Fetch through PHP proxy for rate limiting & caching
      const data = await apiFetch("/prices");
      setPrices(data.prices || {});
      setPricesLastUpdated(new Date());
    } catch {
      // Fallback: direct Alcor fetch if PHP backend unavailable
      const results = {};
      const ALCOR_API = "https://proton.alcor.exchange/api/v2/tokens";
      let xprUsdRate = null;

      const xprFetch = fetch(`${ALCOR_API}/xpr-eosio.token`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.usd_price) xprUsdRate = data.usd_price; })
        .catch(() => {});

      const tokenFetches = TOKENS.map(async (token) => {
        try {
          const res = await fetch(`${ALCOR_API}/${token.alcorId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          results[token.symbol] = {
            system_price: (data.system_price > 0) ? data.system_price : null,
            usd_price: (data.usd_price > 0) ? data.usd_price : null,
            decimals: data.decimals ?? token.precision,
            loaded: true, error: false,
          };
        } catch {
          results[token.symbol] = { system_price: null, usd_price: null, loaded: true, error: true };
        }
      });

      await Promise.allSettled([xprFetch, ...tokenFetches]);

      if (xprUsdRate) {
        Object.values(results).forEach(p => {
          if (p && !p.error && p.system_price && !p.usd_price) {
            p.usd_price = p.system_price * xprUsdRate;
            p.usd_derived = true;
          }
        });
      }
      setPrices(results);
      setPricesLastUpdated(new Date());
    }
    setPricesLoading(false);
  }, []);

  useEffect(() => {
    fetchAllPrices();
    const iv = setInterval(fetchAllPrices, 30000);
    return () => clearInterval(iv);
  }, [fetchAllPrices]);

  const getRate = useCallback((from, to) => {
    if (from === to) return "1.000000";
    const fp = prices[from];
    const tp = prices[to];
    if (fp?.usd_price && tp?.usd_price) return (fp.usd_price / tp.usd_price).toFixed(6);
    if (fp?.system_price && tp?.system_price) return (fp.system_price / tp.system_price).toFixed(6);
    return null;
  }, [prices]);

  const rate = getRate(fromToken, toToken);

  useEffect(() => {
    if (fromAmount && !isNaN(fromAmount) && rate) {
      setToAmount((parseFloat(fromAmount) * parseFloat(rate)).toFixed(4));
    } else {
      setToAmount("");
    }
  }, [fromAmount, rate]);

  // ── Wallet ──
  const connectWallet = useCallback(async () => {
    let ConnectWallet = null;
    try {
      const mod = await import("@proton/web-sdk");
      ConnectWallet = mod.ConnectWallet || mod.default?.ConnectWallet;
    } catch {
      ConnectWallet = window.ProtonWebSDK?.ConnectWallet;
    }

    if (!ConnectWallet) {
      setTxLog(prev => [...prev, { time: new Date(), type: "error", msg: "WebAuth SDK not available" }]);
      return;
    }

    setStatus(STATUS.CONNECTING);
    try {
      const { link, session } = await ConnectWallet(WEBAUTH_CONFIG);
      webAuthLinkRef.current = link;
      webAuthSessionRef.current = session;
      const actor = session.auth.actor.toString();
      const permission = session.auth.permission.toString();
      setWallet({ actor, permission });
      setStatus(STATUS.CONNECTED);
      setTxLog(prev => [...prev, { time: new Date(), type: "info", msg: `Wallet connected: @${actor} via WebAuth` }]);

      // Log connection to PHP audit trail
      apiFetch("/audit", {
        method: "POST",
        body: JSON.stringify({ event: "wallet_connect", actor, detail: "WebAuth" }),
      }).catch(() => {});
    } catch (err) {
      setStatus(STATUS.IDLE);
      if (err?.message && !err.message.includes("closed") && !err.message.includes("cancel")) {
        setTxLog(prev => [...prev, { time: new Date(), type: "error", msg: `Connection failed: ${err.message}` }]);
      }
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (webAuthLinkRef.current) {
      try { await webAuthLinkRef.current.logout(); } catch { /* ignore */ }
      webAuthLinkRef.current = null;
      webAuthSessionRef.current = null;
    }
    setWallet(null);
    setStatus(STATUS.IDLE);
    setTxLog(prev => [...prev, { time: new Date(), type: "info", msg: "Wallet disconnected" }]);
  }, []);

  const flipTokens = () => {
    setSwapAnim(true);
    setTimeout(() => setSwapAnim(false), 400);
    const tf = fromToken, tt = toToken, ta = toAmount;
    setFromToken(tt); setToToken(tf); setFromAmount(ta);
  };

  // ── Atomic Swap Execution ──
  const executeSwap = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !rate) return;
    setStatus(STATUS.SWAPPING);
    const fromObj = TOKENS.find(t => t.symbol === fromToken);
    const toObj = TOKENS.find(t => t.symbol === toToken);
    const minReceive = (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(fromObj.precision);

    setTxLog(prev => [...prev, {
      time: new Date(), type: "pending",
      msg: `Atomic swap: ${fromAmount} ${fromToken} → ${toAmount} ${toToken} (min: ${minReceive})`
    }]);

    const SWAP_CONTRACT = "swap.ubq";

    const actions = [
      {
        account: fromObj.contract,
        name: "transfer",
        data: {
          from: wallet.actor,
          to: SWAP_CONTRACT,
          quantity: `${parseFloat(fromAmount).toFixed(fromObj.precision)} ${fromToken}`,
          memo: `swap:${toToken}:${minReceive}:${toObj.contract}`,
        },
        authorization: [{ actor: wallet.actor, permission: wallet.permission || "active" }],
      },
    ];

    try {
      const session = webAuthSessionRef.current;
      if (!session) throw new Error("No active WebAuth session");
      const result = await session.transact({ actions }, { broadcast: true });
      const txId = result?.processed?.id ?? "unknown";
      setTxLog(prev => [...prev, { time: new Date(), type: "success", msg: `Swap confirmed — TX: ${String(txId).slice(0, 16)}...` }]);
      setStatus(STATUS.SUCCESS);
      setTimeout(() => setStatus(STATUS.CONNECTED), 3000);

      // Log swap to PHP audit trail
      apiFetch("/audit", {
        method: "POST",
        body: JSON.stringify({
          event: "swap_success",
          actor: wallet.actor,
          detail: `${fromAmount} ${fromToken} → ${toAmount} ${toToken} TX:${String(txId).slice(0, 16)}`,
        }),
      }).catch(() => {});
    } catch (err) {
      const errMsg = err?.message ?? "Transaction rejected";
      setTxLog(prev => [...prev, { time: new Date(), type: "error", msg: `Swap failed: ${errMsg}` }]);
      setStatus(STATUS.CONNECTED);

      apiFetch("/audit", {
        method: "POST",
        body: JSON.stringify({
          event: "swap_failed",
          actor: wallet?.actor || "unknown",
          detail: `${fromAmount} ${fromToken}: ${errMsg}`,
        }),
      }).catch(() => {});
    }
  }, [fromAmount, fromToken, toAmount, toToken, slippage, wallet, rate]);

  // ── Disclaimer Gate ──
  if (showDisclaimer) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0F13", color: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: 20, position: "relative", overflow: "hidden" }}>
        <HexGrid />
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "40px 36px", maxWidth: 520, width: "100%", position: "relative", zIndex: 1, backdropFilter: "blur(20px)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#00D4AA", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Important Notice</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>Disclaimer &amp; Terms</h2>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>v0.01 Alpha Release</div>
          </div>
          <div style={{ background: "rgba(253,160,133,0.06)", border: "1px solid rgba(253,160,133,0.15)", borderRadius: 12, padding: "16px 18px", fontSize: 12.5, lineHeight: 1.7, color: "#D1D5DB", marginBottom: 24 }}>
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: "#FDA085" }}>ALPHA SOFTWARE — USE AT YOUR OWN RISK</strong></p>
            <p style={{ margin: "0 0 10px" }}>This is experimental, pre-release software (v0.01 Alpha) provided under the <strong style={{ color: "#E5E7EB" }}>MIT License</strong>. Offered &quot;AS IS&quot; without warranty of any kind.</p>
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: "#E5E7EB" }}>No Guarantee of Funds:</strong> Token swaps on blockchain are irreversible. UBITQUITY, INC. and nDAO are not liable for any loss of tokens, failed transactions, or incorrect swap amounts.</p>
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: "#E5E7EB" }}>Not Financial Advice:</strong> This tool does not provide financial, investment, or trading advice. Token values fluctuate.</p>
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: "#E5E7EB" }}>Smart Contract Risk:</strong> Atomic swaps rely on smart contracts on XPR Network. Contracts may contain undiscovered vulnerabilities.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#E5E7EB" }}>Live Pricing:</strong> Prices sourced from <span style={{ color: "#00D4AA" }}>Alcor Exchange API</span> (proton.alcor.exchange). May not reflect real-time conditions.</p>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 24, fontSize: 13, color: "#D1D5DB" }}>
            <input type="checkbox" checked={agreedDisclaimer} onChange={e => setAgreedDisclaimer(e.target.checked)} style={{ marginTop: 2, accentColor: "#00D4AA", width: 16, height: 16, cursor: "pointer" }} />
            <span>I understand this is alpha software, I accept all risks, and I agree to the MIT License terms.</span>
          </label>
          <button onClick={() => { if (agreedDisclaimer) setShowDisclaimer(false); }} disabled={!agreedDisclaimer} style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15,
            fontFamily: "inherit", cursor: agreedDisclaimer ? "pointer" : "not-allowed",
            background: agreedDisclaimer ? "linear-gradient(135deg, #00D4AA, #00B894)" : "rgba(255,255,255,0.05)",
            color: agreedDisclaimer ? "#0D0F13" : "#6B7280", transition: "all 0.3s",
          }}>Proceed to Swap Tool</button>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#4B5563", lineHeight: 1.5 }}>MIT License &copy; {new Date().getFullYear()} UBITQUITY, INC. &amp; nDAO — One Block at a Time&reg;</div>
        </div>
      </div>
    );
  }

  // ── Main Swap Interface ──
  const fromTokenObj = TOKENS.find(t => t.symbol === fromToken);
  const toTokenObj = TOKENS.find(t => t.symbol === toToken);
  const priceLoadedCount = Object.values(prices).filter(p => p.loaded).length;
  const priceErrorCount = Object.values(prices).filter(p => p.error).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0D0F13", color: "#E5E7EB", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      <HexGrid />
      <div style={{ position: "absolute", top: -200, right: -200, width: 500, height: 500, background: "radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -150, left: -150, width: 400, height: 400, background: "radial-gradient(circle, rgba(108,92,231,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="6" stroke="#00D4AA" strokeWidth="1.5" fill="rgba(0,212,170,0.08)" />
              <path d="M9 10h4v4H9zM15 14h4v4h-4z" fill="#00D4AA" opacity="0.6" />
              <path d="M14 8v12M8 14h12" stroke="#00D4AA" strokeWidth="1" opacity="0.3" />
            </svg>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              <span style={{ color: "#fff" }}>UBITQUITY</span>
              <span style={{ color: "#6B7280", fontWeight: 400, margin: "0 6px" }}>+</span>
              <span style={{ color: "#FDA085" }}>nDAO</span>
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Token Swap Tool</div>
          <div style={{ fontSize: 10, color: "#4B5563", marginTop: 4 }}>Powered by XPR Network &middot; Atomic Swaps &middot; v0.01 Alpha</div>
        </div>

        {/* Alcor Price Feed Status */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
          padding: "8px 14px", marginBottom: 10, fontSize: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: pricesLoading ? "#F59E0B" : priceErrorCount === TOKENS.length ? "#EF4444" : "#00D4AA",
              animation: pricesLoading ? "pulse 1s infinite" : "none",
            }} />
            <span style={{ color: "#9CA3AF" }}>
              Alcor Exchange — {pricesLoading ? "Fetching prices..." : `${priceLoadedCount - priceErrorCount}/${TOKENS.length} tokens priced`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {pricesLastUpdated && (
              <span style={{ color: "#4B5563", fontFamily: "'JetBrains Mono', monospace" }}>{pricesLastUpdated.toLocaleTimeString()}</span>
            )}
            <button onClick={fetchAllPrices} disabled={pricesLoading} title="Refresh prices" style={{
              background: "none", border: "none", cursor: "pointer", padding: 2, color: "#6B7280", opacity: pricesLoading ? 0.4 : 1, display: "flex",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: pricesLoading ? "spin 1s linear infinite" : "none" }}>
                <path d="M10.5 6A4.5 4.5 0 1 1 6 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M6 1.5L8 1.5L6 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Wallet Bar */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
          padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: status === STATUS.CONNECTED || status === STATUS.SWAPPING || status === STATUS.SUCCESS ? "#00D4AA" : status === STATUS.CONNECTING ? "#F59E0B" : "#4B5563",
              boxShadow: status === STATUS.CONNECTED ? "0 0 8px rgba(0,212,170,0.5)" : "none",
            }} />
            <span style={{ fontSize: 12, color: wallet ? "#E5E7EB" : "#6B7280" }}>
              {wallet ? `@${wallet.actor}` : "Not connected"}
            </span>
          </div>
          {wallet ? (
            <button onClick={disconnectWallet} style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
              padding: "6px 12px", fontSize: 11, color: "#EF4444", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>Disconnect</button>
          ) : (
            <button onClick={connectWallet} disabled={status === STATUS.CONNECTING} style={{
              background: "linear-gradient(135deg, #00D4AA, #00B894)", border: "none", borderRadius: 8,
              padding: "6px 14px", fontSize: 11, color: "#0D0F13", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
              opacity: status === STATUS.CONNECTING ? 0.6 : 1,
            }}>{status === STATUS.CONNECTING ? "Connecting..." : "Connect WebAuth"}</button>
          )}
        </div>

        {/* Swap Card */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, position: "relative", boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Swap</span>
            <button onClick={() => setShowSettings(!showSettings)} style={{
              background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex",
              color: showSettings ? "#00D4AA" : "#6B7280", transition: "color 0.2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {showSettings && (
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Slippage Tolerance</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["0.5", "1.0", "2.0", "5.0"].map(v => (
                  <button key={v} onClick={() => setSlippage(v)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                    border: slippage === v ? "1px solid #00D4AA" : "1px solid rgba(255,255,255,0.08)",
                    background: slippage === v ? "rgba(0,212,170,0.1)" : "transparent",
                    color: slippage === v ? "#00D4AA" : "#9CA3AF", cursor: "pointer",
                  }}>{v}%</button>
                ))}
              </div>
            </div>
          )}

          {/* FROM */}
          <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "16px 18px", marginBottom: 4, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 150px" }}>
                <TokenSelect value={fromToken} onChange={setFromToken} otherValue={toToken} label="From" prices={prices} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>Amount</div>
                <input type="number" value={fromAmount} onChange={e => setFromAmount(e.target.value)} placeholder="0.0000"
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', 'SF Mono', monospace", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(0,212,170,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                {fromAmount && prices[fromToken]?.usd_price != null && (
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                    &asymp; ${(parseFloat(fromAmount) * prices[fromToken].usd_price).toFixed(4)} USD
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flip */}
          <div style={{ display: "flex", justifyContent: "center", margin: "-14px 0", position: "relative", zIndex: 2 }}>
            <button onClick={flipTokens} style={{
              width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: "#1A1D23", border: "2px solid rgba(255,255,255,0.08)", cursor: "pointer",
              transition: "all 0.3s", transform: swapAnim ? "rotate(180deg)" : "rotate(0deg)",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#00D4AA"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M4 10l4 4 4-4" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* TO */}
          <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "16px 18px", marginTop: 4, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 150px" }}>
                <TokenSelect value={toToken} onChange={setToToken} otherValue={fromToken} label="To" prices={prices} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>You Receive</div>
                <div style={{
                  width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 12, padding: "10px 14px", color: toAmount ? "#00D4AA" : "#4B5563", fontSize: 18,
                  fontWeight: 700, fontFamily: "'JetBrains Mono', 'SF Mono', monospace", minHeight: 22, boxSizing: "border-box",
                }}>
                  {toAmount || "0.0000"}
                </div>
                {toAmount && prices[toToken]?.usd_price != null && (
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                    &asymp; ${(parseFloat(toAmount) * prices[toToken].usd_price).toFixed(4)} USD
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rate */}
          {fromAmount && parseFloat(fromAmount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px 4px", fontSize: 11, color: "#6B7280" }}>
              <span>Rate {rate ? "(Alcor)" : ""}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: rate ? "#9CA3AF" : "#EF4444" }}>
                {rate ? `1 ${fromToken} = ${rate} ${toToken}` : "Price data unavailable"}
              </span>
            </div>
          )}

          {/* Swap details */}
          {fromAmount && parseFloat(fromAmount) > 0 && rate && (
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 14px", marginTop: 8, border: "1px solid rgba(255,255,255,0.03)" }}>
              {[
                { label: "Minimum received", val: `${(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(4)} ${toToken}` },
                { label: "Slippage tolerance", val: `${slippage}%` },
                { label: "Swap method", val: "Atomic (on-chain)" },
                { label: "Network", val: "XPR Network (Proton)" },
                { label: "From contract", val: fromTokenObj.contract },
                { label: "To contract", val: toTokenObj.contract },
                { label: "Price source", val: "Alcor Exchange API v2" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11 }}>
                  <span style={{ color: "#6B7280" }}>{row.label}</span>
                  <span style={{ color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{row.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          <button onClick={!wallet ? connectWallet : executeSwap}
            disabled={wallet && (!fromAmount || parseFloat(fromAmount) <= 0 || !rate || status === STATUS.SWAPPING)}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 14, border: "none", fontWeight: 700, fontSize: 15,
              fontFamily: "inherit", cursor: "pointer", marginTop: 18, letterSpacing: "0.02em", transition: "all 0.3s",
              background: !wallet ? "linear-gradient(135deg, #00D4AA, #00B894)"
                : status === STATUS.SWAPPING ? "rgba(0,212,170,0.2)"
                : status === STATUS.SUCCESS ? "linear-gradient(135deg, #10B981, #059669)"
                : (!fromAmount || parseFloat(fromAmount) <= 0 || !rate) ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, #00D4AA, #00B894)",
              color: !wallet || (fromAmount && parseFloat(fromAmount) > 0 && rate) ? "#0D0F13" : "#4B5563",
              opacity: (wallet && (!fromAmount || parseFloat(fromAmount) <= 0 || !rate)) ? 0.5 : 1,
            }}>
            {!wallet ? "Connect WebAuth Wallet"
              : status === STATUS.SWAPPING ? "Signing & Broadcasting..."
              : status === STATUS.SUCCESS ? "Swap Successful!"
              : !rate ? "Price Unavailable"
              : (!fromAmount || parseFloat(fromAmount) <= 0) ? "Enter Amount"
              : `Swap ${fromToken} → ${toToken}`}
          </button>
        </div>

        {/* TX Log */}
        {txLog.length > 0 && (
          <div style={{ marginTop: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Transaction Log</div>
            <div style={{ maxHeight: 140, overflowY: "auto" }}>
              {txLog.slice().reverse().map((log, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < txLog.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", fontSize: 11 }}>
                  <span style={{ color: log.type === "success" ? "#00D4AA" : log.type === "pending" ? "#F59E0B" : log.type === "error" ? "#EF4444" : "#6B7280", flexShrink: 0 }}>
                    {log.type === "success" ? "+" : log.type === "pending" ? "o" : log.type === "error" ? "x" : "-"}
                  </span>
                  <span style={{ color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{log.time.toLocaleTimeString()}</span>
                  <span style={{ color: "#D1D5DB" }}>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Price Ticker */}
        <div style={{ marginTop: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Prices — Alcor Exchange</div>
            <div style={{ fontSize: 9, color: "#4B5563", fontFamily: "'JetBrains Mono', monospace" }}>proton.alcor.exchange/api/v2</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {TOKENS.map(t => {
              const p = prices[t.symbol];
              return (
                <div key={t.symbol} style={{
                  display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8,
                  padding: "8px 10px", border: `1px solid ${t.color}15`,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: p?.error ? "#4B5563" : t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#E5E7EB" }}>{t.symbol}</div>
                    <div style={{ fontSize: 9, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.contract}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {pricesLoading && !p ? (
                      <span style={{ fontSize: 10, color: "#4B5563" }}>...</span>
                    ) : p?.usd_price != null ? (
                      <>
                        <div style={{ fontSize: 11, color: "#00D4AA", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {p.usd_derived ? "~$" : "$"}{p.usd_price < 0.01 ? p.usd_price.toFixed(6) : p.usd_price.toFixed(4)}
                        </div>
                        {p.system_price != null && (
                          <div style={{ fontSize: 8, color: "#4B5563", fontFamily: "'JetBrains Mono', monospace" }}>{p.system_price.toFixed(4)} XPR</div>
                        )}
                      </>
                    ) : p?.system_price != null ? (
                      <>
                        <div style={{ fontSize: 10, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>{p.system_price.toFixed(4)} XPR</div>
                        <div style={{ fontSize: 8, color: "#4B5563" }}>no USD pair</div>
                      </>
                    ) : (
                      <span style={{ fontSize: 9, color: "#6B728088" }}>No pair</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#4B5563", lineHeight: 1.8 }}>
            MIT License &middot; Open Source &middot; v0.01 Alpha<br />
            &copy; {new Date().getFullYear()} UBITQUITY, INC. &amp; nDAO &middot; One Block at a Time&reg;<br />
            <span style={{ color: "#3B3F47" }}>USE AT YOUR OWN RISK — No warranty expressed or implied</span><br />
            <span style={{ color: "#3B3F47" }}>Prices via Alcor Exchange (proton.alcor.exchange/api/v2)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
