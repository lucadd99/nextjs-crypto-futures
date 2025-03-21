"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import React from "react";

// Helpers
const formatCountdown = (ms) => {
  if (!ms || ms <= 0) return "00m 00s";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
};

const mapBinanceToOkx = (bnPair) => {
  const base = bnPair.slice(0, bnPair.length - 4);
  const quote = bnPair.slice(-4);
  return `${base}-${quote}-SWAP`;
};

const calcAminusB = (bnBookData, okxBookData) => {
  if (!bnBookData || !okxBookData) return "N/A";
  if (!bnBookData.bestBid?.price || !okxBookData.bestAsk?.price) return "N/A";
  const aBid = parseFloat(bnBookData.bestBid.price);
  const bAsk = parseFloat(okxBookData.bestAsk.price);
  if (aBid <= 0 || bAsk <= 0) return "N/A";
  const spread = ((aBid - bAsk) / (aBid + bAsk)) * 2 * 100;
  return `${spread.toFixed(2)}%`;
};

const calcBminusA = (bnBookData, okxBookData) => {
  if (!bnBookData || !okxBookData) return "N/A";
  if (!okxBookData.bestBid?.price || !bnBookData.bestAsk?.price) return "N/A";
  const bBid = parseFloat(okxBookData.bestBid.price);
  const aAsk = parseFloat(bnBookData.bestAsk.price);
  if (bBid <= 0 || aAsk <= 0) return "N/A";
  const spread = ((bBid - aAsk) / (bBid + aAsk)) * 2 * 100;
  return `${spread.toFixed(2)}%`;
};

// Reusable display component for each exchange's order book data
const ExchangeOrderBook = React.memo(function ExchangeOrderBook({
  exchangeName,
  pair,
  bookData,
  funding,
  now,
}) {
  const timeLeft = funding.fundingExpiry ? funding.fundingExpiry - now : 0;
  return (
    <div>
      <div className="font-bold">
        {exchangeName}: {pair}
      </div>
      <div className={`${exchangeName} pl-32 flex flex-row gap-10 text-slate-500`}>
        <span className="flex gap-2">
          <span>
            {funding.fundingRate !== undefined
              ? `${(funding.fundingRate * 100).toFixed(4)}%`
              : "N/A"}
          </span>
          <span>{formatCountdown(timeLeft)}</span>
        </span>
        <span>${bookData?.bestBid?.price || "N/A"}</span>
        <span>${bookData?.bestAsk?.price || "N/A"}</span>
      </div>
    </div>
  );
});

// Component to manage a single trading pair subscription
function PairSubscription({ pair, now }) {
  // Local state for Binance and OKX order book and funding data.
  const [bnBookData, setBnBookData] = useState({});
  const [okxBookData, setOkxBookData] = useState({});
  const [bnFunding, setBnFunding] = useState({});
  const [okxFunding, setOkxFunding] = useState({});

  // Refs for websocket instances
  const binanceWsRef = useRef(null);
  const okxWsRef = useRef(null);

  // For calculating spreads and profits (using a fake balance)
  const fakeBalance = 1000;
  const spreadAminusB = calcAminusB(bnBookData, okxBookData);
  const spreadBminusA = calcBminusA(bnBookData, okxBookData);
  const tradingFees = 0.02 / 100;
  const feeAdjustment = 2 * tradingFees * 100;
  const netAtoB = parseFloat(spreadAminusB) - feeAdjustment;
  const netBtoA = parseFloat(spreadBminusA) - feeAdjustment;
  const profitAtoBUSDT = (netAtoB / 100) * fakeBalance;
  const profitBtoAUSDT = (netBtoA / 100) * fakeBalance;

  //================== Binance WebSocket ==================
  const connectBinanceWs = useCallback(() => {
    const BINANCE_WS_URL = "wss://fstream.binance.com/ws";
    const ws = new WebSocket(BINANCE_WS_URL);
    ws.onopen = () => {
      console.log("Connected to Binance WebSocket for", pair.binance);
      const contract = pair.binance.toLowerCase();
      const payload = {
        method: "SUBSCRIBE",
        params: [`${contract}@bookTicker`, `${contract}@markPrice`],
        id: 1,
      };
      ws.send(JSON.stringify(payload));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.e === "bookTicker") {
        setBnBookData({
          bestBid: { price: data.b, quantity: data.B },
          bestAsk: { price: data.a, quantity: data.A },
        });
      } else if (data.e === "markPriceUpdate") {
        const expiryTime = data.T;
        setBnFunding({
          markPrice: data.p,
          fundingRate: data.r,
          fundingExpiry: expiryTime,
        });
      }
    };
    ws.onclose = () => {
      console.log("Binance WebSocket disconnected for", pair.binance, ". Reconnecting...");
      setTimeout(connectBinanceWs, 2000);
    };
    ws.onerror = (err) => {
      console.error("Binance WebSocket error for", pair.binance, ":", err);
      ws.close();
    };
    binanceWsRef.current = ws;
  }, [pair.binance]);

  //================== OKX WebSocket ==================
  const connectOkxWs = useCallback(() => {
    const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
    const ws = new WebSocket(OKX_WS_URL);
    ws.onopen = () => {
      console.log("Connected to OKX WebSocket for", pair.okx);
      const subscribeMsg = {
        op: "subscribe",
        args: [
          { channel: "books", instId: pair.okx },
          { channel: "funding-rate", instId: pair.okx },
        ],
      };
      ws.send(JSON.stringify(subscribeMsg));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.arg?.channel === "books") {
        if (data.data && data.data.length > 0) {
          const book = data.data[0];
          setOkxBookData((prev) => {
            const prevData = prev || {
              bestBid: { price: "N/A", quantity: "N/A" },
              bestAsk: { price: "N/A", quantity: "N/A" },
            };
            return {
              bestBid:
                book.bids && book.bids.length > 0
                  ? { price: book.bids[0][0], quantity: book.bids[0][1] }
                  : prevData.bestBid,
              bestAsk:
                book.asks && book.asks.length > 0
                  ? { price: book.asks[0][0], quantity: book.asks[0][1] }
                  : prevData.bestAsk,
            };
          });
        }
      } else if (data.arg?.channel === "funding-rate") {
        if (data.data && data.data.length > 0) {
          const fundingData = data.data[0];
          const expiryTime = Number(fundingData.fundingTime);
          setOkxFunding({
            fundingRate: fundingData.fundingRate !== undefined ? fundingData.fundingRate : "N/A",
            fundingExpiry: expiryTime,
          });
        }
      }
    };
    ws.onclose = () => {
      console.log("OKX WebSocket disconnected for", pair.okx, ". Reconnecting...");
      setTimeout(connectOkxWs, 2000);
    };
    ws.onerror = (err) => {
      console.error("OKX WebSocket error for", pair.okx, ":", err);
      ws.close();
    };
    okxWsRef.current = ws;
  }, [pair.okx]);

  useEffect(() => {
    connectBinanceWs();
    connectOkxWs();
    // Cleanup on unmount:
    return () => {
      binanceWsRef.current?.close();
      okxWsRef.current?.close();
    };
  }, [connectBinanceWs, connectOkxWs]);

  return (
    <div className="single box flex flex-row justify-between gap-1 w-full p-4 border border-dashed rounded-lg shadow-md my-4">
      <div className="flex flex-col justify-center items-center w-full max-w-[550px]">
        <ExchangeOrderBook
          exchangeName="A: Binance"
          pair={pair.binance}
          bookData={bnBookData}
          funding={bnFunding}
          now={now}
        />
        <ExchangeOrderBook
          exchangeName="B: OKX"
          pair={pair.okx}
          bookData={okxBookData}
          funding={okxFunding}
          now={now}
        />
      </div>
      <div className="w-full flex flex-col justify-center items-center gap-3">
        <div className="flex flex-row gap-5">
          <div>-A + B:</div>
          <div>{spreadAminusB}</div>
          <div>Profit: {netAtoB.toFixed(3)}%</div>
          <div>Profit USDT: {profitAtoBUSDT.toFixed(3)}$</div>
        </div>
        <div className="flex flex-row gap-5">
          <div>+A - B:</div>
          <div>{spreadBminusA}</div>
          <div>Profit: {netBtoA.toFixed(3)}%</div>
          <div>Profit USDT: {profitBtoAUSDT.toFixed(3)}$</div>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function ABcompareByChoice() {
  // States for REST API data
  const [bnSymbols, setBnSymbols] = useState([]);
  const [okxSymbols, setOkxSymbols] = useState([]);
  // State for the list of subscriptions
  const [subscribedPairs, setSubscribedPairs] = useState([]);
  // For the subscription input form.
  const [coinInput, setCoinInput] = useState("");
  const [quoteInput, setQuoteInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Current time state (updated every second for countdown refresh)
  const [now, setNow] = useState(Date.now());

  // Update current time every second.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const BINANCE_REST_URL = "https://fapi.binance.com/fapi/v1/ticker/bookTicker";
  const OKX_REST_URL = "https://www.okx.com/api/v5/public/instruments?instType=SWAP";

  // Fetch Binance symbols
  const fetchBinance = useCallback(async () => {
    try {
      const response = await fetch(BINANCE_REST_URL);
      const result = await response.json();
      const binanceFutures = result
        .map((item) => item.symbol)
        .filter((symbol) => !symbol.includes("USDC"));
      setBnSymbols(binanceFutures);
    } catch (error) {
      console.error("Error fetching Binance data:", error);
      setTimeout(fetchBinance, 5000);
    }
  }, []);

  // Fetch OKX symbols
  const fetchOKX = useCallback(async () => {
    try {
      const response = await fetch(OKX_REST_URL);
      const result = await response.json();
      if (!result.data) throw new Error("Failed to fetch OKX instruments");
      const swapContracts = result.data
        .map((item) => item.instId)
        .filter((instId) => !instId.includes("USDC"));
      setOkxSymbols(swapContracts);
    } catch (error) {
      console.error("Error fetching OKX data:", error);
      setTimeout(fetchOKX, 5000);
    }
  }, []);

  useEffect(() => {
    fetchBinance();
    fetchOKX();
  }, [fetchBinance, fetchOKX]);

  // For matching contracts based on REST API data.
  const matchingContracts = useMemo(() => {
    if (!bnSymbols.length || !okxSymbols.length) return [];
    const matches = [];
    bnSymbols.forEach((bnSymbol) => {
      if (bnSymbol.includes("_") || bnSymbol.includes("USDC")) return;
      const okxSymbol = mapBinanceToOkx(bnSymbol);
      if (okxSymbols.includes(okxSymbol)) {
        matches.push({
          binance: bnSymbol,
          okx: okxSymbol,
        });
      }
    });
    return matches;
  }, [bnSymbols, okxSymbols]);

  // Handler for the subscription form.
  const handleSubscribe = (e) => {
    e.preventDefault();
    setErrorMessage("");
    const coin = coinInput.trim().toUpperCase();
    const quote = quoteInput.trim().toUpperCase();
    if (!coin || !quote) {
      setErrorMessage("Both coin and quote are required.");
      return;
    }
    const bnPair = `${coin}${quote}`;
    const okxPair = `${coin}-${quote}-SWAP`;
    const found = matchingContracts.find(
      (match) => match.binance === bnPair && match.okx === okxPair
    );
    if (found) {
      // Add to the list if not already subscribed.
      const exists = subscribedPairs.find(
        (sub) => sub.binance === bnPair && sub.okx === okxPair
      );
      if (!exists) {
        setSubscribedPairs((prev) => [...prev, found]);
        setCoinInput("");
        setQuoteInput("");
      } else {
        setErrorMessage("Already subscribed to this pair.");
      }
    } else {
      setErrorMessage(
        `The trading pair ${coin}-${quote} is not available on both exchanges.`
      );
    }
  };

  return (
    <div className="flex flex-col justify-center items-center w-full">
      <form onSubmit={handleSubscribe} className="flex flex-col gap-2 mb-4">
        <div>
          <label>
            <p className="w-10">From:</p>
            <input
              type="text"
              value={coinInput}
              onChange={(e) => setCoinInput(e.target.value)}
              placeholder="e.g. BTC"
              className="border rounded px-2 py-1 text-black"
            />
          </label>
        </div>
        <div>
          <label>
            <p className="w-10">To:</p>
            <input
              type="text"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
              placeholder="e.g. USDT"
              className="border rounded px-2 py-1 text-black"
            />
          </label>
        </div>
        <button type="submit" className="bg-blue-500 text-white rounded px-3 py-1">
          訂閱
        </button>
      </form>
      {errorMessage && <div className="text-red-500 mb-4">{errorMessage}</div>}
      {/* Render a subscription block for each subscribed pair */}
      {subscribedPairs.length > 0 ? (
        subscribedPairs.map((pair) => (
          <PairSubscription key={pair.binance} pair={pair} now={now} />
        ))
      ) : (
        <div>Please subscribe to a trading pair.</div>
      )}
    </div>
  );
}
