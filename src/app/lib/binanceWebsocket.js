import WebSocket from "ws";

const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";
// 如果要後端連Websocket前端要資料才使用這個
// List of 100 trading pairs
const tradingPairs = [
  "btcusdt",
  "ethusdt",
  "bnbusdt",
  "adausdt",
  "solusdt",
  "xrpusdt",
  "dotusdt",
  "ltcusdt",
  "linkusdt",
  "maticusdt",
  "dogeusdt",
  "etcusdt",
  "uniusdt",
  "vetusdt",
  "xlmusdt",
  // Add more pairs up to 100
];

let ws;
export let orderBookData = {}; // Store latest best bid/ask prices

export function connectWebSocket(updateCallback) {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket(BINANCE_WS_URL);

  ws.onopen = () => {
    console.log("Connected to Binance WebSocket");

    // Subscribe to bookTicker for multiple pairs
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
      // Store the best bid and ask for the coin
      orderBookData[data.s] = {
        bestBid: { price: data.b, quantity: data.B },
        bestAsk: { price: data.a, quantity: data.A },
      };

      updateCallback(orderBookData);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting...");
    setTimeout(() => connectWebSocket(updateCallback), 5000);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    ws.close();
  };
}

// export default { connectWebSocket, orderBookData };
