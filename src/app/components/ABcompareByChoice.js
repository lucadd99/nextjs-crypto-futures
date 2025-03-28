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
  return spread.toFixed(2);
};

const calcBminusA = (bnBookData, okxBookData) => {
  if (!bnBookData || !okxBookData) return "N/A";
  if (!okxBookData.bestBid?.price || !bnBookData.bestAsk?.price) return "N/A";
  const bBid = parseFloat(okxBookData.bestBid.price);
  const aAsk = parseFloat(bnBookData.bestAsk.price);
  if (bBid <= 0 || aAsk <= 0) return "N/A";
  const spread = ((bBid - aAsk) / (bBid + aAsk)) * 2 * 100;
  return spread.toFixed(2);
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

  // 使用者輸入
  const [listenForMatchAminusB, setListenForMatchAminusB] = useState(false);
  const [listenForMatchBminusA, setListenForMatchBminusA] = useState(false);

  const [executeRateAminusB, setExecuteRateAminusB] = useState(0);
  const [executeRateBminusA, setExecuteRateBminusA] = useState(0);
  const [size, setSize] = useState(0);
  const [minSizeBinance, setMinSizeBinance] = useState(null);
  const [minSizeOkx, setMinSizeOkx] = useState(null);
  const [ctValOkx, setCtValOkx] = useState(0);
  const [sizeError, setSizeError] = useState("");
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
      console.log(
        "Binance WebSocket disconnected for",
        pair.binance,
        ". Reconnecting..."
      );
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
            fundingRate:
              fundingData.fundingRate !== undefined
                ? fundingData.fundingRate
                : "N/A",
            fundingExpiry: expiryTime,
          });
        }
      }
    };
    ws.onclose = () => {
      console.log(
        "OKX WebSocket disconnected for",
        pair.okx,
        ". Reconnecting..."
      );
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

  // 下單
  const placeOrder = async ({ orderBinance, orderOkx }) => {
    // should be divided in 2 , for binance and okx
    console.log("====================================");
    console.log("from placeorder:", orderBinance, orderOkx);
    console.log("====================================");
    try {
      const response = await fetch("/api/binance/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderBinance),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      console.log("from order bInance API response:", data);
    } catch (err) {
      console.error("Order Binance API error:", err);
    }
    try {
      const response = await fetch("/api/okx/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderOkx),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      console.log("from order OKX API response:", data);
    } catch (err) {
      console.error("Order OKX API error:", err);
    }
  };


  // 空A多B
  useEffect(() => {
    if (
      listenForMatchAminusB &&
      Number(spreadAminusB) > Number(executeRateAminusB)
    ) {
      const orderBinance = {
        symbol: pair.binance,
        side: "SELL", // SHORT or BOTH
        type: "MARKET", // MARKET
        // timeInForce: 'GTC',
        quantity: size,
        reduceOnly: false,
      };
      const orderOkx = {
        instId: pair.okx,
        tdMode: "cross",
        clOrdId: "lucaTestOrder",
        side: "buy",
        ordType: "market",
        sz: size / ctValOkx, // 需為10的整數倍
        //posSide:"long",
      };
      console.log("-A + B 訂單成立");
      console.log(pair, spreadAminusB);
      console.log("訂單 -A:", orderBinance);
      console.log("訂單 +B:", orderOkx);
      placeOrder({ orderBinance: orderBinance, orderOkx: orderOkx });
      setListenForMatchAminusB(false);
    }
  }, [spreadAminusB, executeRateAminusB, listenForMatchAminusB]);

  // 多A空B
  useEffect(() => {
    if (
      listenForMatchBminusA &&
      Number(spreadBminusA) > Number(executeRateBminusA)
    ) {
      const orderBinance = {
        symbol: pair.binance,
        side: "BUY", // SHORT or BOTH
        type: "MARKET", // MARKET
        // timeInForce: 'GTC',
        quantity: size,
        reduceOnly: false,
      };
      const orderOkx = {
        instId: pair.okx,
        tdMode: "cross",
        clOrdId: "lucaTestOrder",
        side: "sell",
        ordType: "market",
        sz: size /ctValOkx,//not working well
        //posSide:"long",
      };
      console.log(" +A - B 訂單成立");
      console.log(pair, spreadBminusA);
      console.log("訂單 +A:", orderBinance);
      console.log("訂單 -B:", orderOkx);

      placeOrder({ orderBinance: orderBinance, orderOkx: orderOkx });
      setListenForMatchBminusA(false);
    }
  }, [spreadBminusA, executeRateBminusA, listenForMatchBminusA]);

  const handleTestButtonClick = (v) => {
    if (v === 1) {
      setListenForMatchAminusB(true);
      console.log(`開始監聽 -A + B ------- ${executeRateAminusB}%`);
    } else {
      setListenForMatchBminusA(true);
      console.log(`開始監聽 +A - B ------- ${executeRateBminusA}%`);
    }
  };

  // Fetch minSize when component mounts or when `pair.binance` changes
  useEffect(() => {
    let isMounted = true;
    const fetchMinSize = async () => {
      try {
        const fetchedMinSizeBinance = await getFuturesMinOrderBinance(pair.binance);
        if (isMounted) {
          setMinSizeBinance(fetchedMinSizeBinance);
        }
        const OKXminSize = await getFuturesMinOrderOkx(pair.okx);
         if (isMounted) {
          setMinSizeOkx(OKXminSize);
        }
        // console.log("OKX", OKXminSize);
      } catch (error) {
        console.error("Error fetching minSize:", error);
      }
    };
    fetchMinSize();
    return () => {
      isMounted = false;
    };
  }, [pair.binance]);

  // 最小下單數量 Binance
  const getFuturesMinOrderBinance = async (symbol) => {
    // ------ONLY FOR BINANCE-----
    const response = await fetch(
      "https://fapi.binance.com/fapi/v1/exchangeInfo"
    );
    const data = await response.json();
    // Find the symbol object
    const targetSymbol = data.symbols.find((s) => s.symbol === symbol);
    if (!targetSymbol) {
      throw new Error(`Symbol ${symbol} not found on Binance Futures.`);
    }
    let minQty = null;
    let stepSize = null;
    let minNotional = null;
    // Parse filters
    for (const filter of targetSymbol.filters) {
      if (filter.filterType === "LOT_SIZE") {
        minQty = parseFloat(filter.minQty);
        stepSize = parseFloat(filter.stepSize);
      }
      if (filter.filterType === "MIN_NOTIONAL") {
        minNotional = parseFloat(filter.notional);
      }
    }
    const tickerResponse = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`
    );
    const tickerData = await tickerResponse.json();
    const currentPrice = parseFloat(tickerData.price);
    // Calculate the quantity needed to meet minNotional
    // quantity * currentPrice >= minNotional
    const qtyForMinNotional = minNotional / currentPrice;
    // The actual minimum quantity is the max of (minQty, qtyForMinNotional),
    // but also must align with stepSize increments if you place an order.
    let requiredQty = Math.max(minQty, qtyForMinNotional);

    // Round to the nearest stepSize multiple if needed
    // e.g. if stepSize = 0.001, ensure requiredQty is a multiple of 0.001
    requiredQty = Math.ceil(requiredQty / stepSize) * stepSize;

    return requiredQty;
  };
   // 最小下單數量 OKX
  const getFuturesMinOrderOkx = async (instId) => {
    // Fetch instrument info from OKX
    const url = `https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${instId}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code !== "0" || !data.data || data.data.length === 0) {
      throw new Error(`Instrument ${instId} not found on OKX.`);
    }
    const instrument = data.data[0];
    // console.log(instrument);
    // Parse the values from the instrument info.
    // minSz and lotSz are in contract units,
    // ctVal is the underlying amount per contract.
    const minSz = parseFloat(instrument.minSz);   // e.g. 0.01 contracts
    const lotSz = parseFloat(instrument.lotSz);     // e.g. 0.01 contracts
    const ctVal = parseFloat(instrument.ctVal);     // e.g. 0.1 ETH per contract
    setCtValOkx(ctVal)
    // Round the minimum contract size up to a multiple of lotSz.
    const requiredContractSize = Math.ceil(minSz / lotSz) * lotSz;
    // Then, calculate the corresponding underlying amount.
    const requiredUnderlying = requiredContractSize * ctVal; 
    return requiredUnderlying;
  };

  const handleSizeChange = (e) => {
    const value = Number(e.target.value);
    setSize(value);
    if (value % ctValOkx  !== 0) {
      setSizeError(`請輸入${ctValOkx}的整數倍`);
      return;
    }
    // If minSize is not yet loaded, skip further validation
    if (minSizeBinance === null) {
      setSizeError("正在載入最小下單數量…");
      return;
    }
    // Now check if the value meets the minimum order size requirement
    if (value < minSizeBinance) {
      setSizeError(`此交易對Binance的最小下單數量為: ${minSizeBinance}`);
      return;
    }else if(value < minSizeOkx) {
      setSizeError(`此交易對OKX的最小下單數量為: ${minSizeOkx}`);
      return;
    }
   
    setSizeError("");
  };

  // const TestOrder = async () => {
  //   let testOrder = {
  //     instId: "PIPPIN-USDT-SWAP",
  //     tdMode: "cross", //保證金模式：isolated：逐倉；cross：全倉非保證金模式：cash
  //     clOrdId: "lucaTestOrder01", //客戶自訂訂單ID
  //     side: "buy",
  //     ordType: "market", //訂單類型
  //     sz: size / ctValOkx, //委託數量
  //     //posSide:"long", //持倉方向在開平倉模式下必填，且僅可選擇long或short
  //     //px: "2.15", //委託價格，僅適用於limit、post_only、fok、ioc、mmp、mmp_and_post_only
  //   };
  //   try {
  //     const response = await fetch("/api/okx/trade", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(testOrder),
  //     });
  //     if (!response.ok) {
  //       throw new Error("Network response was not ok");
  //     }
  //     const data = await response.json();
  //     console.log("from order OKX API:", data);
  //   } catch (err) {
  //     console.error("Order OKX API error:", err);
  //   }
  // };

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
        <div className="flex flex-row gap-3">
          <span className="text-slate-600">數量:</span>
          <input
            className="w-20 text-slate-600"
            type="number"
            value={size}
            onChange={handleSizeChange}
          />
          {sizeError && <span className="text-red-500">{sizeError}</span>}
        </div>
        <div className="flex flex-row gap-5">
          <div>-A + B:</div>
          <div>{spreadAminusB}%</div>
          <div className="flex flex-row gap-3">
            <label className="text-slate-600">{executeRateAminusB}%</label>
            <input
              className="w-20 text-slate-600"
              type="number"
              value={executeRateAminusB}
              onChange={(e) => setExecuteRateAminusB(e.target.value)}
            />
            <button
              onClick={() => handleTestButtonClick(1)}
              className="bg-green-500 text-white px-3 font-medium rounded"
            >
              test
            </button>

            {/* <button
              onClick={() => TestOrder()}
              className="bg-green-500 text-white px-3 font-medium rounded"
            >
              TEST
            </button> */}
          </div>
        </div>

        <div className="flex flex-row gap-5">
          <div>+A - B:</div>
          <div>{spreadBminusA}%</div>
          <div className="flex flex-row gap-3">
            <label className="text-slate-600">{executeRateBminusA}%</label>
            <input
              className="w-20 text-slate-600"
              type="number"
              value={executeRateBminusA}
              onChange={(e) => setExecuteRateBminusA(e.target.value)}
            />
            <button
              onClick={() => handleTestButtonClick(2)}
              className="bg-green-500 text-white px-3 font-medium rounded"
            >
              test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
{
  /* <div className="flex flex-col ">
<input 
  type="number" 
  className="w-20 text-slate-600" 
  value={quantity} onChange={(e) =>  setQuantity(e.target.value)} />
  {quantity}%
  <button
    onClick={() => {
      let orderBinance = {
        symbol: pair.binance,
        side: 'LONG',// SHORT or BOTH
        type : 'MARKET', // MARKET
        timeInForce: 'GTC',
        quantity: '',
        // price: bnBookData?.bestBid?.price,
        reduceOnly: false,
      }

      placeOrder(orderBinance)
    }}
    className=" bg-green-500 text-white px-3 font-medium rounded"
  >
   確認
  </button>
</div>
*/
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
  const OKX_REST_URL =
    "https://www.okx.com/api/v5/public/instruments?instType=SWAP";

  // Fetch Binance symbols
  const fetchBinance = useCallback(async () => {
    try {
      const response = await fetch(BINANCE_REST_URL);
      const result = await response.json();
      const binanceFutures = result.map((item) => item.symbol);
      // .filter((symbol) => !symbol.includes("USDC"));
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
      const swapContracts = result.data.map((item) => item.instId);
      // .filter((instId) => !instId.includes("USDC"));
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
      // if (bnSymbol.includes("_") || bnSymbol.includes("USDC")) return;
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
      setErrorMessage("請輸入幣種和幣種");
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
        setErrorMessage("此交易對已訂閱");
      }
    } else {
      setErrorMessage(`此交易對${coin}-${quote}在兩個交易所都不可用`);
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
        <button
          type="submit"
          className="bg-blue-500 text-white rounded px-3 py-1"
        >
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
        <div>請訂閱交易對</div>
      )}
    </div>
  );
}
