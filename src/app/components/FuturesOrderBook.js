"use client";
import { useEffect, useState } from "react";

export default function FuturesOrderBook() {
  const [binanceOrders, setBinanceOrders] = useState({
    BTC: { bid: null, ask: null },
    ETH: { bid: null, ask: null },
  });

  const [bitgetOrders, setBitgetOrders] = useState({
    BTC: { bid: null, ask: null },
    ETH: { bid: null, ask: null },
  });

  const [okxOrders, setOkxOrders] = useState({
    BTC: { bid: null, ask: null },
    ETH: { bid: null, ask: null },
  });
  useEffect(() => {
    // Binance WebSockets for BTC & ETH
    const btcBinanceWs = new WebSocket(
      "wss://fstream.binance.com/ws/btcusdt@bookTicker"
    );
    const ethBinanceWs = new WebSocket(
      "wss://fstream.binance.com/ws/ethusdt@bookTicker"
    );

    btcBinanceWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setBinanceOrders((prev) => ({
        ...prev,
        BTC: { bid: data.b, ask: data.a },
      }));
    };

    ethBinanceWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setBinanceOrders((prev) => ({
        ...prev,
        ETH: { bid: data.b, ask: data.a },
      }));
    };

    // Bitget WebSocket
    const bitgetWs = new WebSocket("wss://ws.bitget.com/mix/v1/stream");

    bitgetWs.onopen = () => {
      const subscriptionMessage = {
        op: "subscribe",
        
        args: [
          { instType: "mc", channel: "ticker", instId: "BTCUSDT" },
          { instType: "mc", channel: "ticker", instId: "ETHUSDT" },
        ],
      };
      bitgetWs.send(JSON.stringify(subscriptionMessage));
    };

    bitgetWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.action === "snapshot" && data.data) {
        data.data.forEach((item) => {
          if (item.instId === "BTCUSDT") {
            setBitgetOrders((prev) => ({
              ...prev,
              BTC: { bid: item.bestBid, ask: item.bestAsk },
            }));
          } else if (item.instId === "ETHUSDT") {
            setBitgetOrders((prev) => ({
              ...prev,
              ETH: { bid: item.bestBid, ask: item.bestAsk },
            }));
          }
        });
      }
    };
    // OKX WebSocket
    const okxWs = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

    okxWs.onopen = () => {
      const subscriptionMessage = {
        op: "subscribe",
        args: [
          { channel: "books", instId: "BTC-USDT" },
          { channel: "books", instId: "ETH-USDT" },
        ],
      };
      okxWs.send(JSON.stringify(subscriptionMessage));
    };

    okxWs.onmessage = (event) => {
      const okxdata = JSON.parse(event.data);
      if (okxdata.arg && okxdata.data) {
        okxdata.data.forEach((item) => {
          const bestBid = item.bids?.length > 0 ? item.bids[0][0] : null;
          const bestAsk = item.asks?.length > 0 ? item.asks[0][0] : null;

          if (okxdata.arg.instId === "BTC-USDT") {
            setOkxOrders((prev) => ({
              ...prev,
              BTC: { bid: bestBid, ask: bestAsk },
            }));
          } else if (okxdata.arg.instId === "ETH-USDT") {
            setOkxOrders((prev) => ({
              ...prev,
              ETH: { bid: bestBid, ask: bestAsk },
            }));
          }
        });
      }
    };

    return () => {
      btcBinanceWs.close();
      ethBinanceWs.close();
      bitgetWs.close();
      okxWs.close();
    };
  }, []);

  return (
    <div className="p-4 w-full">
      <h2 className="text-lg font-bold mb-2">
        Futures Order Book (Best Bids & Asks)
      </h2>
      <table className="border-collapse border border-gray-400 w-full text-center">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-400 p-2 " colSpan="1">
              交易所
            </th>

            <th className="border border-gray-400 p-2" colSpan="2">
              Binance
            </th>
            <th className="border border-gray-400 p-2" colSpan="2">
              Bitget
            </th>
            <th className="border border-gray-400 p-2" colSpan="2">
              OKX
            </th>
          </tr>
          <tr className="bg-gray-600 text-white">
            <th className="border border-gray-400 p-2">幣別</th>
            <th className="border border-gray-400 p-2">btc</th>
            <th className="border border-gray-400 p-2">eth</th>
            <th className="border border-gray-400 p-2">btc</th>
            <th className="border border-gray-400 p-2">eth</th>
            <th className="border border-gray-400 p-2">btc</th>
            <th className="border border-gray-400 p-2">eth</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 p-2 font-bold">asks</td>
            <td className="border border-gray-400 p-2">
              {binanceOrders.BTC.ask || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {binanceOrders.ETH.ask || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {bitgetOrders.BTC.ask || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {bitgetOrders.ETH.ask || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2 ">
              {okxOrders.BTC.ask || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {okxOrders.ETH.ask || "Loading..."}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-400 p-2 font-bold">bids</td>
            <td className="border border-gray-400 p-2">
              {binanceOrders.BTC.bid || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {binanceOrders.ETH.bid || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {bitgetOrders.BTC.bid || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {bitgetOrders.ETH.bid || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {okxOrders.BTC.bid || "Loading..."}
            </td>
            <td className="border border-gray-400 p-2">
              {okxOrders.ETH.bid || "Loading..."}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
