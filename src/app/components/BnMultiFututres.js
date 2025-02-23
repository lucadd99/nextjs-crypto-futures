"use client";
import { useState, useEffect } from "react";
export default function BnMultiFutures() {
  const [orderBook, setOrderBook] = useState({});

  useEffect(() => {
    const BINANCE_WS_URL = "wss://fstream.binance.com/ws";
    const tradingPairs = [
      "btcusdt","ethusdt","bnbusdt","adausdt",
      "solusdt","xrpusdt","dotusdt","ltcusdt",
      "linkusdt","maticusdt","dogeusdt","etcusdt","uniusdt","vetusdt","xlmusdt",
    ];
    const ws = new WebSocket(BINANCE_WS_URL);
    ws.onopen = () => {
      console.log("Connected to Binance WebSocket");
      const streamNames = tradingPairs.map((pair) => `${pair}@bookTicker`);
      const payload = {
        method: "SUBSCRIBE",
        params: streamNames,
        id: 1,
      };
      ws.send(JSON.stringify(payload));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.s && data.b && data.a) {
        setOrderBook((prevOrderBook) => ({
          ...prevOrderBook,
          [data.s]: {
            bestBid: { price: data.b },
            bestAsk: { price: data.a },
          },
        }));
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
    <div className="pt-5">
      <h1 className="text-xl font-semibold">Best Bid/Ask</h1>
      <table
        className="border-collapse border border-gray-400 w-full text-center"
        border="1"
      >
        <thead>
          <tr className="bg-gray-800 text-white">
            <th>Pair</th>
            <th>Best Bid Price</th>
            <th>Best Ask Price</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(orderBook).map(([pair, data]) => (
            <tr className="" key={pair}>
              <td>{pair.toUpperCase()}</td>
              <td>{data.bestBid.price || "loading..."}</td>
              <td>{data.bestAsk.price || "loading..."}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
