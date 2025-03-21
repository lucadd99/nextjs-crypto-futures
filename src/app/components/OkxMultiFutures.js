"use client";
import { useState, useEffect } from "react";
export default function OkxMultiFutures() {
  const [orderBook, setOrderBook] = useState({});
  const [fundingRates, setFundingRates] = useState({});
  const [markPrices, setMarkPrices] = useState({});
  const [liquidations, setLiquidations] = useState([]);
  const pairOrder = [
    "BTC-USDT-SWAP",
    "ETH-USDT-SWAP",
    "BNB-USDT-SWAP",
    "SOL-USDT-SWAP",
  ];
  useEffect(() => {
    const OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
    const tradingPairs = [
      "BTC-USDT-SWAP",
      "ETH-USDT-SWAP",
      "BNB-USDT-SWAP",
      "SOL-USDT-SWAP",
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

    const ws = new WebSocket(OKX_WS_URL);
    ws.onopen = () => {
      console.log("Connected to OKX WebSocket");

      const subscribeMsg = {
        op: "subscribe",
        args: [
          ...tradingPairs.map((pair) => ({ channel: "books", instId: pair })), // Order book
          ...tradingPairs.map((pair) => ({
            channel: "mark-price",
            instId: pair,
          })), // Mark price & funding rates
          ...tradingPairs.map((pair) => ({
            channel: "funding-rate",
            instId: pair,
          })),
          { channel: "liquidation-orders", instType: "SWAP" }, // Liquidation events
        ],
      };

      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //   console.log("Received data:", data);

      if (data.arg?.channel === "books") {
        // Order Book Updates
        if (data.data && data.data.length > 0) {
          const book = data.data[0];
          setOrderBook((prev) => ({
            ...prev,
            [data.arg.instId]: {
              bestBid:
                book.bids.length > 0
                  ? { price: book.bids[0][0], quantity: book.bids[0][1] }
                  : { price: "N/A", quantity: "N/A" },
              bestAsk:
                book.asks.length > 0
                  ? { price: book.asks[0][0], quantity: book.asks[0][1] }
                  : { price: "N/A", quantity: "N/A" },
            },
          }));
        }
      } else if (data.arg?.channel === "mark-price") {
        // Mark Price Updates
        if (data.data && data.data.length > 0) {
          const markData = data.data[0];
          setMarkPrices((prev) => ({
            ...prev,
            [data.arg.instId]: markData.markPx || "N/A",
          }));
        }
      } else if (data.arg?.channel === "funding-rate") {
       
        // Funding Rate Updates
        if (data.data && data.data.length > 0) {
          const fundingData = data.data[0];
          console.log(fundingData);
          
          setFundingRates((prev) => ({
            ...prev,
            [data.arg.instId]: {
              fundingRate:
                fundingData.fundingRate !== undefined
                  ? fundingData.fundingRate
                  : "N/A",
            },
          }));
        }
      } else if (data.arg?.channel === "liquidation-orders") {
        // Liquidation Events
        if (data.data && data.data.length > 0) {
          setLiquidations((prev) => [data.data[0], ...prev].slice(0, 10)); // Keep last 10 liquidations
        }
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
      <h1 className="text-2xl font-bold bg-white text-black w-14 mb-2">OKX</h1>
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
              <tr key={pair}>
                <td>{pair}</td>
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
                <td>
                  {markPrices[pair] !== "N/A"
                    ? parseFloat(markPrices[pair]).toFixed(2)
                    : "N/A"}
                </td>
                <td
                  style={{
                    color:
                      data.fundingRate > 0
                        ? "green"
                        : data.fundingRate < 0
                        ? "red"
                        : "white",
                  }}
                >
                  {data.fundingRate !== "N/A"
                    ? `${(parseFloat(data.fundingRate) * 100).toFixed(4)}%`
                    : "N/A"}
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
