import WebSocket from "ws";

const BINANCE_REST_URL = "https://fapi.binance.com/fapi/v1/ticker/bookTicker"; // Example endpoint
const OKX_REST_URL =
  "https://www.okx.com/api/v5/public/instruments?instType=SWAP";

// Helper: Maps a Binance symbol (e.g. "BTCUSDT") to its OKX instrument ID (e.g. "BTC-USDT-SWAP")
function mapBinanceToOkx(bnSymbol) {
  const base = bnSymbol.replace("USDT", "");
  return `${base}-USDT-SWAP`;
}

// Fetch Binance symbols from REST API and filter out unwanted ones
async function fetchBinance() {
  try {
    const response = await fetch(BINANCE_REST_URL);
    const result = await response.json();
    const binanceSymbols = result
      .map((item) => item.symbol)
      .filter((symbol) => !symbol.includes("USDC"));
    return binanceSymbols;
  } catch (error) {
    console.error("Error fetching Binance data:", error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchBinance();
  }
}

// Fetch OKX instruments from REST API and filter out unwanted ones
async function fetchOKX() {
  try {
    const response = await fetch(OKX_REST_URL);
    const result = await response.json();
    if (!result.data) throw new Error("Failed to fetch OKX instruments");
    const okxSymbols = result.data
      .map((item) => item.instId)
      .filter((instId) => !instId.includes("USDC"));
    return okxSymbols;
  } catch (error) {
    console.error("Error fetching OKX data:", error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchOKX();
  }
}

// Build matching contracts between Binance and OKX based on common pairs
async function getMatchingContracts() {
  const bnSymbols = await fetchBinance();
  const okxSymbols = await fetchOKX();
  const matches = [];

  // Iterate over Binance symbols and create the mapping
  bnSymbols.forEach((bnSymbol) => {
    // Skip if the symbol contains undesired characters (e.g., underscore) or USDC
    if (bnSymbol.includes("_") || bnSymbol.includes("USDC")) return;

    const okxContract = mapBinanceToOkx(bnSymbol);
    if (okxSymbols.includes(okxContract)) {
      matches.push({
        symbol: bnSymbol.replace("USDT", ""), // Base asset
        binance: bnSymbol,
        okx: okxContract,
      });
    }
  });

  return matches;
}
const binanceData = {};
const binanceSockets = {};
const okxData = {};

// Fake balance for testing
const fakeBalance = 1000; // USDT-

(async () => {
  const matchesPair = await getMatchingContracts();
  //   console.log("matchesPair", matchesPair);
  const lastSignal = {};
  matchesPair.forEach((match) => {
    const bnSymbol = match.binance;
    const url = `wss://fstream.binance.com/ws/${bnSymbol.toLowerCase()}@bookTicker`;
    binanceSockets[bnSymbol] = new WebSocket(url);

    binanceSockets[bnSymbol].on("open", () => {
      // Connection opened
    });

    binanceSockets[bnSymbol].on("message", (message) => {
      const data = JSON.parse(message);
      binanceData[bnSymbol] = {
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
      };

      const contract = matchesPair.find((m) => m.binance === bnSymbol);
      if (contract && okxData[contract.okx]) {
        const okxBid = okxData[contract.okx].bid;
        const okxAsk = okxData[contract.okx].ask;
        const binanceBid = binanceData[bnSymbol].bid;
        const binanceAsk = binanceData[bnSymbol].ask;

        // Calculate spreads (percentage differences)
        const spreadAtoB =
          ((binanceBid - okxAsk) / (binanceBid + okxAsk)) * 2 * 100;
        const spreadBtoA =
          ((okxBid - binanceAsk) / (okxBid + binanceAsk)) * 2 * 100;

        // Trading fees and net profit calculation
        const tradingFees = 0.02 / 100; // 0.02% per trade
        const feeAdjustment = 2 * tradingFees * 100; // equals 0.04%
        const netAtoB = spreadAtoB - feeAdjustment; //  OKX 做多, Binance 做空
        const netBtoA = spreadBtoA - feeAdjustment; //  Binance 做多, OKX 做空

        const minProfitThreshold = 0.3;
        const profitAtoBUSDT = (netAtoB / 100) * fakeBalance;
        const profitBtoAUSDT = (netBtoA / 100) * fakeBalance;

        // Determine current signal direction
        let currentSignal = null;
        let messageText = "";
        if (netAtoB > minProfitThreshold && netAtoB >= netBtoA) {
          currentSignal = "OKX_long";
          messageText = `🚀 [${bnSymbol}] OKX 做多 ($${okxAsk}) → Binance 做空 ($${binanceBid}) | 收益: ${netAtoB.toFixed(
            3
          )}% | USDT 收益: ${profitAtoBUSDT.toFixed(3)} $`;
        } else if (netBtoA > minProfitThreshold) {
          currentSignal = "Binance_long";
          messageText = `🚀 [${bnSymbol}] Binance 做多 ($${binanceAsk}) → OKX 做空 ($${okxBid}) | 收益: ${netBtoA.toFixed(
            3
          )}% | USDT 收益: ${profitBtoAUSDT.toFixed(3)} $`;
        }

        // Check for reversal: if a new signal exists and it's different from the last one
        if (
          currentSignal &&
          lastSignal[bnSymbol] &&
          lastSignal[bnSymbol] !== currentSignal
        ) {
          console.log(
            `🔄 [${bnSymbol}] Signal reversed! New opportunity: ${messageText}`
          );
        } else if (currentSignal) {
          console.log(messageText);
        }

        // Update last signal if a valid one exists
        if (currentSignal) {
          lastSignal[bnSymbol] = currentSignal;
        }
      }
    });

    binanceSockets[bnSymbol].on("error", (error) => {
      console.error(`Binance WebSocket Error for ${bnSymbol}:`, error.message);
    });
  });

  // Set up OKX WebSocket subscription for the matching contracts
  const subscriptionArgs = matchesPair.map((match) => ({
    channel: "tickers",
    instId: match.okx,
  }));

  const okxWS = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  okxWS.on("open", () => {
    console.log("Connected to OKX WebSocket");
    okxWS.send(
      JSON.stringify({
        op: "subscribe",
        args: subscriptionArgs,
      })
    );
  });

  okxWS.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.data) {
      // OKX may return data for multiple instruments
      data.data.forEach((ticker) => {
        const instId = ticker.instId;
        okxData[instId] = {
          bid: parseFloat(ticker.bidPx),
          ask: parseFloat(ticker.askPx),
        };
        // Log updated data for debugging if needed:
        // console.log(`Updated OKX data for ${instId}:`, okxData[instId]);
      });
    }
  });

  okxWS.on("error", (error) => {
    console.error("OKX WebSocket Error:", error.message);
  });
})();
