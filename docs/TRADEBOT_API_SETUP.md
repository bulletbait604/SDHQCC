# Tradebot API setup

Tradebot v1 uses **Kraken + CoinGecko + Frankfurter (FX)** with no API keys, plus **Finnhub** for US stock/ETF quotes. **Gemini** (already configured as `GEMINI_API`) powers the optional AI summary.

Only **Finnhub** is required for the stock watchlist. Everything else is optional or already in the app.

---

## Already configured (no new keys)

| Service | Env var | Purpose |
|---------|---------|---------|
| **Gemini** | `GEMINI_API` | AI summary of scan results |
| **Frankfurter** | *(none)* | CAD/USD FX — built into the app |
| **Kraken** | *(none)* | Crypto CAD reference prices (public API) |
| **CoinGecko** | *(none)* | Crypto index benchmark (public API) |
| **MongoDB** | `MONGODB_URI` | Stores latest scan snapshot |

---

## Finnhub (required for stocks/ETFs)

Used for: IBIT, FBTC, ETHA, QQQ, SPY on TD Direct Investing.

### 1. Create a free account

1. Open [https://finnhub.io/register](https://finnhub.io/register)
2. Sign up with email (no credit card on free tier)
3. Confirm your email if prompted

### 2. Copy your API key

1. Log in at [https://finnhub.io/dashboard](https://finnhub.io/dashboard)
2. Copy the **API Key** shown on the dashboard

### 3. Add to your environment

**Local development** — add to `.env.local` in the project root:

```env
Finnhub_API=your_finnhub_key_here
```

(`FINNHUB_API_KEY` also works.)

**Production (Vercel)**

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `Finnhub_API` (or `FINNHUB_API_KEY`)
   - **Value:** your Finnhub key
   - **Environments:** Production (and Preview if you test there)
3. **Redeploy** the app so the server picks up the new variable

### 4. Verify

1. Log in as owner or admin
2. Open **R&D → Tradebot**
3. Click **Run scan**
4. The yellow “Finnhub key needed” banner should disappear
5. Stock/ETF unusual-move alerts should appear when daily moves exceed ~3%

**Free tier limits:** ~60 API calls/minute — enough for the default watchlist (5 symbols).

---

## Bitbuy (optional — later)

When Bitbuy approves Partner API access for your account:

```env
BITBUY_API_KEY=your_bitbuy_api_key
BITBUY_API_SECRET=your_bitbuy_api_secret
```

1. Email Bitbuy support and request **Partner API** access for your account
2. Generate API keys in Bitbuy (read + trade only if you want automation later; read-only is safest to start)
3. Add the keys to Vercel the same way as Finnhub
4. Redeploy

Until Bitbuy keys are wired, crypto scans compare **Kraken vs CoinGecko** only.

---

## Optional tuning

```env
# Estimated taker fees in basis points (0.01%) for net-edge math
TRADEBOT_KRAKEN_FEE_BPS=40
TRADEBOT_BITBUY_FEE_BPS=20

# Gemini model for tradebot summaries (defaults to gemini-2.5-flash)
TRADEBOT_GEMINI_MODEL=gemini-2.5-flash
```

---

## Quick checklist

- [ ] `GEMINI_API` set (you likely already have this)
- [ ] `MONGODB_URI` set (you likely already have this)
- [ ] `Finnhub_API` or `FINNHUB_API_KEY` set ← **only new required key**
- [ ] Redeployed after adding env vars
- [ ] Tested **R&D → Tradebot → Run scan**

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Finnhub key needed” banner | Add `Finnhub_API` or `FINNHUB_API_KEY` and redeploy |
| “CoinGecko rate limit” | Wait 60 seconds and scan again |
| No crypto opportunities | Normal when Kraken and CoinGecko agree within fees |
| 403 on Tradebot | Must be logged in as **owner** or **admin** |
| Stock quotes empty | Check Finnhub key; US market may be closed (quotes still return last price) |
