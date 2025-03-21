"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import React from "react";

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
  // -A+B的差价计算方式：(A Bid 1 - B Ask 1) / (A Bid 1 + B Ask 1) * 2。再乘100，显示为百分比。
  // (A Bid 1 - B Ask 1) / (A Bid 1 + B Ask 1) * 2 * 100
  if (!bnBookData || !okxBookData) return "N/A";
  if (!bnBookData.bestBid?.price || !okxBookData.bestAsk?.price) return "N/A";
  const aBid = parseFloat(bnBookData.bestBid.price);
  const bAsk = parseFloat(okxBookData.bestAsk.price);
  if (aBid <= 0 || bAsk <= 0) return "N/A";
  const spread = ((aBid - bAsk) / (aBid + bAsk)) * 2 * 100;
  return `${spread.toFixed(2)}%`;
};

const calcBminusA = (bnBookData, okxBookData) => {
  //+A-B的差价计算方式：(B Bid 1 - A Ask 1) / (B Bid 1 + A Ask 1) * 2。再乘100，显示为百分比。
  // (B Bid 1 - A Ask 1) / (B Bid 1 + A Ask 1) * 2 * 100
  if (!bnBookData || !okxBookData) return "N/A";
  if (!okxBookData.bestBid?.price || !bnBookData.bestAsk?.price) return "N/A";
  const bBid = parseFloat(okxBookData.bestBid.price);
  const aAsk = parseFloat(bnBookData.bestAsk.price);
  if (bBid <= 0 || aAsk <= 0) return "N/A";
  const spread = ((bBid - aAsk) / (bBid + aAsk)) * 2 * 100;
  return `${spread.toFixed(2)}%`;
};

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
      <div
        className={`${exchangeName} pl-32 flex flex-row gap-10 text-slate-500`}
      >
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

const UnifiedOrderBooks = React.memo(function UnifiedOrderBooks({
  bnOrderBook,
  okxOrderBook,
  bnFundingRates,
  okxFundingRates,
  now,
}) {
  return (
    <div className="w-full flex flex-col gap-3">
      {Object.keys(bnOrderBook).map((bnPair) => {
        const okxPair = mapBinanceToOkx(bnPair);
        const bnBookData = bnOrderBook[bnPair];
        const okxBookData = okxOrderBook[okxPair];
        const bnFunding = bnFundingRates[bnPair] || {};
        const okxFunding = okxFundingRates[okxPair] || {};
        // Fake balance for testing
        const fakeBalance = 1000;
        // calculus
        const spreadAminusB = calcAminusB(bnBookData, okxBookData);
        const spreadBminusA = calcBminusA(bnBookData, okxBookData);
        // Trading fees and net profit calculation
        const tradingFees = 0.02 / 100;
        const feeAdjustment = 2 * tradingFees * 100;
        const netAtoB = parseFloat(spreadAminusB) - feeAdjustment;
        const netBtoA = parseFloat(spreadBminusA) - feeAdjustment;

        // Calculate profit in USDT based on a 1000 USDT balance
        const profitAtoBUSDT = (netAtoB / 100) * fakeBalance;
        const profitBtoAUSDT = (netBtoA / 100) * fakeBalance;
        return (
          <div
            key={bnPair}
            className="single box flex flex-row justify-between gap-1 w-full p-4 border border-dashed rounded-lg shadow-md"
          >
            <div className="flex flex-col justify-center items-center w-full max-w-[550px]">
              <ExchangeOrderBook
                exchangeName="A: Binance"
                pair={bnPair}
                bookData={bnBookData}
                funding={bnFunding}
                now={now}
              />
              <ExchangeOrderBook
                exchangeName="B: OKX"
                pair={okxPair}
                bookData={okxBookData}
                funding={okxFunding}
                now={now}
              />
            </div>

            <div className="w-full flex flex-col justify-center items-center gap-3">
              <div className="flex flex-row gap-5">
                <div> -A + B:</div>
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
      })}
    </div>
  );
});
export default function ABcompare() {
  const [bnSymbols, setBnSymbols] = useState([]);
  const [okxSymbols, setOkxSymbols] = useState([]);
  // State for WebSocket data
  const [bnFinalOrderBook, setBnFinalOrderBook] = useState({});
  const [okxFinalOrderBook, setOkxFinalOrderBook] = useState({});
  const [bnFundingRates, setBnFundingRates] = useState({});
  const [okxFundingRates, setOkxFundingRates] = useState({});

  // Matched contracts (derived from REST API data)
  const [matchesNum, setMatchesNum] = useState(0);
  const [matchesOrder, setMatchesOrder] = useState([]);
  // Current time state (updated every second for countdown refresh)
  const [now, setNow] = useState(Date.now());

  const BINANCE_REST_URL = "https://fapi.binance.com/fapi/v1/ticker/bookTicker";
  const OKX_REST_URL =
    "https://www.okx.com/api/v5/public/instruments?instType=SWAP";

  // Refs to hold WebSocket instances for proper cleanup.
  const binanceWsRef = useRef(null);
  const okxWsRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  //抓 Bn REST API
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
  //抓 OKX REST API
  const fetchOKX = useCallback(async () => {
    try {
      const response = await fetch(OKX_REST_URL);
      const result = await response.json();
      if (!result.data) throw new Error("Failed to fetch OKX instruments");
      const swapContracts = result.data
        .map((item) => item.instId)
        .filter((instId) => !instId.includes("USDC")); // Ignore USDC
      setOkxSymbols(swapContracts);
    } catch (error) {
      console.error("Error fetching OKX data:", error);
      setTimeout(fetchOKX, 5000);
    }
  }, []);

  // Initial REST API calls.
  useEffect(() => {
    fetchBinance();
    fetchOKX();
  }, [fetchBinance, fetchOKX]);

  //useMemo從REST API資料尋找Bn & OKX共同交易對
  const matchingContracts = useMemo(() => {
    if (!bnSymbols.length || !okxSymbols.length) return [];
    const matches = [];

    bnSymbols.forEach((bnSymbol) => {
      if (bnSymbol.includes("_") || bnSymbol.includes("USDC")) return;
      const bnPrefix = bnSymbol.slice(0, 3);
      //   const okxContract = `${bnPrefix}-USDT-SWAP`;
      const okxContract = mapBinanceToOkx(bnSymbol);

      if (okxSymbols.includes(okxContract)) {
        matches.push({
          symbol: bnPrefix,
          binance: bnSymbol,
          okx: okxContract,
        });
      }
    });
    return matches;
  }, [bnSymbols, okxSymbols]);

  useEffect(() => {
    if (matchingContracts.length) {
      setMatchesOrder(matchingContracts);
      setMatchesNum(matchingContracts.length);
    }
  }, [matchingContracts]);

  //==================Binance Websocket==================
  const connectBinanceWs = useCallback(() => {
    const BINANCE_WS_URL = "wss://fstream.binance.com/ws";
    const ws = new WebSocket(BINANCE_WS_URL);
    ws.onopen = () => {
      console.log("Connected to Binance WebSocket");
      const contracts = matchesOrder.map((match) =>
        match.binance.toLowerCase()
      );
      if (!contracts.length) {
        console.warn("No Binance contracts found. Aborting subscription.");
        return;
      }
      const payload = {
        method: "SUBSCRIBE",
        params: [
          ...contracts.map((symbol) => `${symbol}@bookTicker`),
          ...contracts.map((symbol) => `${symbol}@markPrice`),
        ],
        id: 1,
      };
      ws.send(JSON.stringify(payload));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.e === "bookTicker") {
        setBnFinalOrderBook((prev) => ({
          ...prev,
          [data.s]: {
            bestBid: { price: data.b, quantity: data.B },
            bestAsk: { price: data.a, quantity: data.A },
          },
        }));
      } else if (data.e === "markPriceUpdate") {
        const expiryTime = data.T;
        setBnFundingRates((prev) => ({
          ...prev,
          [data.s]: {
            markPrice: data.p,
            fundingRate: data.r,
            fundingExpiry: expiryTime,
          },
        }));
      }
    };
    ws.onclose = () => {
      console.log("Binance WebSocket disconnected. Reconnecting...");
      setTimeout(connectBinanceWs, 2000);
    };
    ws.onerror = (err) => {
      console.error("Binance WebSocket error:", err);
      ws.close();
    };
    binanceWsRef.current = ws;
  }, [matchesOrder]);

  // ==============OKX Websocket===================
  const connectOkxWs = useCallback(() => {
    const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
    const ws = new WebSocket(OKX_WS_URL);
    ws.onopen = () => {
      console.log("Connected to OKX WebSocket");
      const contracts = matchesOrder.map((match) => match.okx);
      if (!contracts.length) {
        console.warn("No OKX contracts found. Aborting subscription.");
        return;
      }
      const subscribeMsg = {
        op: "subscribe",
        args: [
          ...contracts.map((instId) => ({ channel: "books", instId })),
          ...contracts.map((instId) => ({ channel: "funding-rate", instId })),
        ],
      };
      ws.send(JSON.stringify(subscribeMsg));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Check if the message is for DOGE-USDT-SWAP
      //   if (data.arg?.instId === "DOGE-USDT-SWAP") {
      //     console.log("DOGE-USDT-SWAP data received:", data);
      //   }

      if (data.arg?.channel === "books") {
        if (data.data && data.data.length > 0) {
          const book = data.data[0];
          setOkxFinalOrderBook((prev) => {
            const prevData = prev[data.arg.instId] || {
              bestBid: { price: "N/A", quantity: "N/A" },
              bestAsk: { price: "N/A", quantity: "N/A" },
            };
            return {
              ...prev,
              [data.arg.instId]: {
                bestBid:
                  book.bids && book.bids.length > 0
                    ? { price: book.bids[0][0], quantity: book.bids[0][1] }
                    : prevData.bestBid,
                bestAsk:
                  book.asks && book.asks.length > 0
                    ? { price: book.asks[0][0], quantity: book.asks[0][1] }
                    : prevData.bestAsk,
              },
            };
          });
        }
      } else if (data.arg?.channel === "funding-rate") {
        if (data.data && data.data.length > 0) {
          const fundingData = data.data[0];
          const expiryTime = Number(fundingData.fundingTime);
          setOkxFundingRates((prev) => ({
            ...prev,
            [data.arg.instId]: {
              fundingRate:
                fundingData.fundingRate !== undefined
                  ? fundingData.fundingRate
                  : "N/A",
              fundingExpiry: expiryTime,
            },
          }));
        }
      }
    };
    ws.onclose = () => {
      console.log("OKX WebSocket disconnected. Reconnecting...");
      setTimeout(connectOkxWs, 2000);
    };
    ws.onerror = (err) => {
      console.error("OKX WebSocket error:", err);
      ws.close();
    };
    okxWsRef.current = ws;
  }, [matchesOrder]);

  // Establish WebSocket connections when matching contracts are available.
  useEffect(() => {
    if (matchesOrder.length) {
      connectOkxWs();
      connectBinanceWs();
      console.log(matchesOrder);
    }
    return () => {
      binanceWsRef.current?.close();
      okxWsRef.current?.close();
    };
  }, [matchesOrder, connectBinanceWs, connectOkxWs]);

  return (
    <div className="flex flex-col justify-center items-center w-full">
      <div>
        Binance x OKX 已找到:{" "}
        <span className="font-bold text-green-700">{matchesNum}</span>{" "}
        比共同交易對
      </div>
      <div className="flex flex-col justify-center items-center w-full gap-3">
        <UnifiedOrderBooks
          bnOrderBook={bnFinalOrderBook}
          okxOrderBook={okxFinalOrderBook}
          bnFundingRates={bnFundingRates}
          okxFundingRates={okxFundingRates}
          now={now}
        />
      </div>
    </div>
  );
}

// Binance:
// 先請求REST API:https://fapi.binance.com/fapi/v1/premiumIndex
// 回傳所有幣種永續合約symbol(instId) 有Best Bids/asks & quantity (不包含資金費率 ,要另外訂閱)

// OKX:
// 先請求OKX REST API:https://www.okx.com/api/v5/public/instruments?instType=SWAP
// 回傳所有幣種永續合約 instId(symbol)
// 再用所有instId 請求OKX Websocket API:wss://ws.okx.com:8443/ws/v5/public
// 回傳所有幣種永續合約 (不包含資金費率 ,要另外訂閱)
