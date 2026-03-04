# UBITQUITY + nDAO — Token Swap Tool

**Atomic token swaps on XPR Network (Proton) with live Alcor Exchange pricing.**

> v0.01 Alpha · MIT License · © UBITQUITY, INC. & nDAO — *One Block at a Time®*

---

## Overview

A self-contained React swap interface for exchanging tokens across the UBITQUITY and nDAO ecosystem on XPR Network. The tool pulls live USD and XPR prices from the Alcor Exchange API, calculates cross-token rates on the fly, and executes atomic on-chain swaps through WebAuth wallet signing — both legs of a swap succeed together or both revert.

The component ships as a single `.jsx` file with zero external CSS dependencies (all styling is inline) and can be dropped into any React project or rendered as a standalone artifact.

---

## Supported Tokens

| Symbol | Name | Contract |
|--------|------|----------|
| **UBQT** | Ubitquity Token | `ubitquityllc` |
| **UBQTX** | Ubitquity X Token | `tokencreate` |
| **TITLET** | Title Token | `tokencreate` |
| **NDAO** | nDAO Token | `tokencreate` |
| **NDAOX** | nDAO X Token | `tokencreate` |
| **DEED** | Deed Token | `tokencreate` |
| **AETHERT** | Aether Token | `tokencreate` |
| **GAMES** | Games Token | `tokencreate` |
| **BEATS** | Beats Token | `tokencreate` |
| **CAUDIT** | Crypto Audit Token | `tokencreate` |

All tokens are registered on XPR Network with 4-decimal precision.

---

## Features

- **Live Alcor Pricing** — Parallel-fetches USD and system (XPR) prices for all 10 tokens from `proton.alcor.exchange/api/v2` with 30-second auto-refresh and manual refresh control.
- **Cross-Token Rate Engine** — Derives swap rates from USD prices with an automatic XPR system-price fallback when USD data is unavailable.
- **Atomic Swaps** — Two-action transaction pattern (`transfer` + `execute`) ensures both sides of a swap settle or revert together on-chain.
- **WebAuth Wallet Integration** — Connect/disconnect flow using the Proton Web SDK. The production integration code is included as commented scaffolding, ready to uncomment.
- **Configurable Slippage** — Preset tolerance options (0.5%, 1.0%, 2.0%, 5.0%) with minimum-received calculation shown before signing.
- **Disclaimer Gate** — Mandatory alpha-software acknowledgment screen before accessing the swap interface.
- **Transaction Log** — Timestamped event log tracking wallet connections, pending swaps, confirmations, and errors.
- **Live Price Ticker** — Grid display showing real-time price, XPR equivalent, and contract address for every token in the registry.
- **Dark UI with HexGrid Background** — Procedurally generated hexagonal SVG grid, radial gradient accents, and DM Sans / JetBrains Mono typography.
- **Fully Self-Contained** — Single JSX file, inline styles, no external CSS. Drop-in ready for any React environment.

---

## Quick Start

### Prerequisites

- Node.js 18+
- React 18+
- (Production) [Proton Web SDK](https://github.com/nicedoc/protonweb-sdk) for wallet signing

### Install & Run

```bash
# Clone the repo
git clone https://github.com/nicedoc/ubitquity-swap-tool.git
cd ubitquity-swap-tool

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Drop Into an Existing Project

Copy `swap-tool.jsx` into your components directory and import it:

```jsx
import SwapTool from "./swap-tool";

function App() {
  return <SwapTool />;
}
```

No additional CSS files or configuration required.

---

## Architecture

```
swap-tool.jsx
├── Token Registry         10 tokens with symbol, contract, Alcor ID, precision, color
├── HexGrid                Procedural SVG background (80 hexagons)
├── TokenBadge             Circular badge with gradient border per token color
├── TokenSelect            Dropdown with live price display & mutual exclusion
└── SwapTool (default)     Main component
    ├── Alcor Price Engine     Parallel fetch → 30s auto-refresh → USD/XPR fallback
    ├── Rate Calculator        Derived cross-rate from live prices
    ├── Wallet Manager         Connect / disconnect via WebAuth
    ├── Swap Executor          Atomic two-action transaction builder
    ├── Disclaimer Gate        Required acknowledgment before use
    ├── Swap Card UI           From/To selectors, amount input, flip, details panel
    ├── Transaction Log        Timestamped event history
    └── Price Ticker Grid      2-column live price dashboard
```

---

## API Reference

### Alcor Exchange — Token Price Endpoint

```
GET https://proton.alcor.exchange/api/v2/tokens/{symbol}-{contract}
```

**Example:**

```
GET https://proton.alcor.exchange/api/v2/tokens/ubqt-ubitquityllc
```

**Response:**

```json
{
  "contract": "ubitquityllc",
  "decimals": 4,
  "symbol": "UBQT",
  "id": "ubqt-ubitquityllc",
  "system_price": 0.0012,
  "usd_price": 0.000034
}
```

The swap rate between any two tokens is calculated as `from.usd_price / to.usd_price`, falling back to the `system_price` ratio if USD data is missing.

---

## Production Integration

The component includes a fully commented atomic swap transaction template (lines 243–277) ready for production use with the Proton Web SDK:

```js
// 1. Replace the simulated wallet connection with:
const { link, session } = await ConnectWallet({ /* config */ });

// 2. Uncomment the actions array in executeSwap()
// 3. Call: const result = await session.transact({ actions }, { broadcast: true });
```

The two-action pattern sends a `transfer` to the token's contract followed by an `execute` on the swap contract — both succeed atomically or both revert.

---

## Configuration

### Adding a New Token

Append to the `TOKENS` array at the top of the file:

```js
{ symbol: "MYTKN", name: "My Token", contract: "tokencreate", alcorId: "mytkn-tokencreate", precision: 4, color: "#FF6B6B" }
```

The token will automatically appear in both dropdowns and the live price ticker.

### Adjusting Refresh Interval

Change the interval in the `useEffect` hook (default 30000ms / 30 seconds):

```js
const iv = setInterval(fetchAllPrices, 30000);
```

---

## Disclaimer

> **ALPHA SOFTWARE — USE AT YOUR OWN RISK.** This is experimental, pre-release software (v0.01 Alpha) provided under the MIT License, offered "AS IS" without warranty of any kind. Token swaps on blockchain are irreversible. UBITQUITY, INC. and nDAO are not liable for any loss of tokens, failed transactions, or incorrect swap amounts. This tool does not provide financial, investment, or trading advice.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

**© 2025 UBITQUITY, INC. & nDAO — One Block at a Time®**
