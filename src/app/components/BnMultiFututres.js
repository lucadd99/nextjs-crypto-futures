"use client";
import { useState, useEffect } from "react";
export default function BnMultiFutures() {
  const [orderBook, setOrderBook] = useState({});
  const [fundingRates, setFundingRates] = useState({});
  const [liquidations, setLiquidations] = useState([]);
  const pairOrder = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];
  useEffect(() => {
    const BINANCE_WS_URL = "wss://fstream.binance.com/ws";
    const tradingPairs = [
      "btcusdt",
      "ethusdt",
      "bnbusdt",
      "solusdt",
      // "adausdt",
      // "xrpusdt",
      // "dotusdt",
      // "ltcusdt",
      // "linkusdt",
      // "maticusdt",
      // "dogeusdt",
      // "etcusdt",
      // "uniusdt",
      // "vetusdt",
      // "xlmusdt",
      // "jupusdt",
    ];
    const ws = new WebSocket(BINANCE_WS_URL);
    ws.onopen = () => {
      console.log("Connected to Binance WebSocket");
      const streamNames = [
        ...tradingPairs.map((pair) => `${pair}@bookTicker`), // Best bid/ask
        ...tradingPairs.map((pair) => `${pair}@markPrice`), // Funding rates
        "!forceOrder@arr", // Liquidation events
      ];

      const payload = {
        method: "SUBSCRIBE",
        params: streamNames,
        id: 1,
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.e === "bookTicker") {
        // Best Bid/Ask Updates
        setOrderBook((prev) => ({
          ...prev,
          [data.s]: {
            bestBid: { price: data.b, quantity: data.B },
            bestAsk: { price: data.a, quantity: data.A },
          },
        }));
      } else if (data.e === "markPriceUpdate") {
        // Funding Rate Updates
        setFundingRates((prev) => ({
          ...prev,
          [data.s]: { markPrice: data.p, fundingRate: data.r },
        }));
      } else if (data.e === "forceOrder") {
        // Liquidation Events
        setLiquidations((prev) => [data.o, ...prev].slice(0, 10)); // Keep last 10 liquidations
      }
    };
    ws.onclose = () => {
      console.log("WebSocket disconnected. Reconnecting...");
      setTimeout(() => window.location.reload(), 2000);
    };
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };
    return () => ws.close();
  }, []);

  return (
    <div className="pt-5 w-full">
      <h1 className="text-2xl font-semibold text-yellow-400">Binance</h1>
      <table
        className="border-collapse border border-gray-400 w-full text-center"
        border="1"
      >
        <thead>
          <tr className="bg-gray-800 text-white w-full">
            <th>Pair</th>
            <th>Best Bid Price</th>
            <th>Best Bid Quantity</th>
            <th>Best Ask Price</th>
            <th>Best Ask Quantity</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(orderBook)
            .sort(([a], [b]) => pairOrder.indexOf(a) - pairOrder.indexOf(b))
            .map(([pair, data]) => (
              <tr className="" key={pair}>
                <td>{pair.toUpperCase()}</td>
                <td>{data.bestBid.price || "loading..."}</td>
                <td>{data.bestBid.quantity}</td>
                <td>{data.bestAsk.price || "loading..."}</td>
                <td>{data.bestAsk.quantity}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Funding Rates Table */}
      <h2 className="text-md font-semibold">Funding Rates</h2>
      <table
        className="border-collapse border border-gray-400 w-[50%] text-center"
        border="1"
      >
        <thead>
          <tr className="bg-gray-800 text-white w-full">
            <th>Pair</th>
            <th>Mark Price</th>
            <th>Funding Rate</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(fundingRates)
            .sort(([a], [b]) => pairOrder.indexOf(a) - pairOrder.indexOf(b))
            .map(([pair, data]) => (
              <tr key={pair}>
                <td>{pair.toUpperCase()}</td>
                <td>{data.markPrice}</td>
                <td style={{ color: data.fundingRate >= 0 ? "green" : "red" }}>
                  {(data.fundingRate * 100).toFixed(4)}%
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {/* Liquidations Table */}
      {/* <h2>Recent Liquidations</h2>
      <table border="1">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Side</th>
            <th>Price</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {liquidations.map((liq, index) => (
            <tr key={index}>
              <td>{liq.s.toUpperCase()}</td>
              <td style={{ color: liq.S === "BUY" ? "green" : "red" }}>
                {liq.S}
              </td>
              <td>{liq.p}</td>
              <td>{liq.q}</td>
            </tr>
          ))}
        </tbody>
      </table> */}
    </div>
  );
}

// 如果要後端連Websocket前端要資料才使用這個
//   useEffect(() => {
//     const fetchOrderBook = async () => {
//       try {
//         const response = await fetch("/api/orderbook");
//         const data = await response.json();
//         setOrderBook(data);
//       } catch (error) {
//         console.error("Error fetching order book data:", error);
//       }
//     };

//     fetchOrderBook();
//     const interval = setInterval(fetchOrderBook, 100);
//     return () => clearInterval(interval);
//   }, []);
