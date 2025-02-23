"use client";
import { useEffect, useState } from "react";

export default function FuturesLivePrice() {
  const [btcPrice, setBtcPrice] = useState(null);
  const [ethPrice, setEthPrice] = useState(null);

  useEffect(() => {
    const btcWs = new WebSocket("wss://fstream.binance.com/ws/btcusdt@ticker");
    const ethWs = new WebSocket("wss://fstream.binance.com/ws/ethusdt@ticker");

    btcWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setBtcPrice(data.c); // 'c' = last price for BTC
    };

    ethWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEthPrice(data.c); // 'c' = last price for ETH
    };

    return () => {
      btcWs.close();
      ethWs.close();
    };
  }, []);

  return (
    <div className="font-semibold bg-black p-3">
      <div className="text-yellow-300">Binance Futures:</div>
      <div className="text-slate-100">
        BTC/USDT Price: {btcPrice ? `$${btcPrice}` : "Loading..."}
      </div>
      <div className="text-slate-100">
        ETH/USDT Price: {ethPrice ? `$${ethPrice}` : "Loading..."}
      </div>
    </div>
  );
}
