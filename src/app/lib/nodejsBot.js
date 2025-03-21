import dotenv from "dotenv";
import WebSocket from "ws";
import crypto from "crypto";
import { ed25519 } from "@noble/curves/ed25519";
// import BinancePkg from "binance-api-node";
dotenv.config();

const bnWs = new WebSocket("wss://fstream.binance.com/ws/usdcusdt@markPrice"); //接收 Binance ws 即時資料

function createSignature(secret, data) {
  //for sha256
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// Convert PEM key to Uint8Array
function loadEd25519PrivateKey(pemKey) {
  const keyBase64 = pemKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, ""); // Remove newlines & spaces
  const keyBytes = Buffer.from(keyBase64, "base64");

  // Ed25519 keys in PKCS8 format have a 16-byte header
  if (keyBytes.length !== 48) {
    throw new Error("Invalid Ed25519 private key length. Expected 48 bytes.");
  }

  return keyBytes.slice(-32); // Extract 32-byte secret seed
}

// ✅ Function to sign query string using Ed25519
async function createEd25519Signature(privateKey, data) {
  const messageBytes = new TextEncoder().encode(data);
  const signature = await ed25519.signAsync(messageBytes, privateKey);
  return Buffer.from(signature).toString("base64"); // Encode as Base64
}

function connectBinanceWebSocket() {
  // Binance
  bnWs.on("open", () => {
    console.log("🔗 Connected to Binance WebSocket...");
  });

  let lastBinanceFundingRate = null;
  bnWs.on("message", async (data) => {
    const json = JSON.parse(data);
    const fundingRate = parseFloat(json.r) * 100; // Convert to percentage
    const nextFundingTime = new Date(json.T).toLocaleTimeString();

    console.log(
      `⏳ Binance: USDC/USDT 資金費率: ${fundingRate.toFixed(
        4
      )}% | 下一次計算時間:${nextFundingTime}`
    );

    if (fundingRate !== lastBinanceFundingRate) {
      lastBinanceFundingRate = fundingRate;
      console.log(
        `⏳ Binance: USDC/USDT 資金費率: ${fundingRate.toFixed(
          4
        )}% | 下一次計算時間:${nextFundingTime}`
      );
    }
    // 資金費率 > 0.05%
    if (fundingRate >= 0.0088) {
      console.log("🔥套利機會! 下訂單...");

      const apiKey = process.env.BINANCE_API_KEY;
      const apiSecret = process.env.BINANCE_API_SECRET;

      const orderPayload = {
        apiKey: apiKey,
        symbol: "USDCUSDT",
        price: "1.00",
        side: "BUY", // or "SELL" depending on your strategy
        type: "LIMIT", //or MARKET
        quantity: "1", // Adjust the quantity as needed
        timestamp: Date.now(),
      };

      const queryString = Object.keys(orderPayload)
        .map((key) => `${key}=${orderPayload[key]}`)
        .join("&");

      const privateKey = loadEd25519PrivateKey(apiSecret);
      const signature = await createEd25519Signature(privateKey, queryString);

      const signedOrderPayload = {
        ...orderPayload,
        signature,
      };

      const orderWs = new WebSocket("wss://ws-fapi.binance.com/ws-fapi/v1"); //wss://ws-dapi.binance.com/ws-dapi/v1

      orderWs.on("open", () => {
        console.log("🔗 已連線至 Binance WebSocket 以進行下訂單...");
        orderWs.send(
          JSON.stringify({
            method: "order.place",
            params: signedOrderPayload,
            id: Date.now(),
          })
        );
      });
      orderWs.on("message", (data) => {
        const response = JSON.parse(data);
        if (response.result) {
          console.log("✅ 下訂單成功:", response.result);
        } else if (response.error) {
          console.error("❌ 下訂單失敗:", response.error);
        }
        orderWs.close();
      });

      orderWs.on("error", (error) => {
        console.error("❌ WebSocket Error:", error);
      });

      orderWs.on("close", () => {
        console.log("🔌 WebSocket Disconnected.");
      });
    }
  });

  bnWs.on("error", (error) => {
    console.error("❌ WebSocket Error:", error);
  });

  bnWs.on("close", () => {
    console.log("🔌 WebSocket Disconnected. Reconnecting...");
    setTimeout(() => startBot(), 5000);
  });
}

// OKX
const okxWsUrl = "wss://ws.okx.com:8443/ws/v5/public";
let okxWs;

function connectOKXWebSocket() {
  okxWs = new WebSocket(okxWsUrl); //接收 OKX ws 即時資料
  okxWs.on("open", () => {
    console.log("🔗 Connected to OKX WebSocket...");
    const subscriptionMsg = {
      op: "subscribe",
      args: [{ channel: "funding-rate", instId: "USDC-USDT-SWAP" }],
    };
    okxWs.send(JSON.stringify(subscriptionMsg));

    //每30秒ping
    setInterval(() => {
      okxWs.send("ping");
    }, 30000);
  });

  okxWs.on("message", (data) => {
    if (data === "pong") {
      console.log("🔄 OKX WebSocket Pong Received");
      return; // Ignore pong
    }

    try {
      const json = JSON.parse(data);
      if (json.arg?.channel === "funding-rate" && json.data?.length > 0) {
        const fundingRate = parseFloat(json.data[0].fundingRate) * 100;
        const nextFundingTime = new Date(
          parseInt(json.data[0].fundingTime)
        ).toLocaleTimeString();
        console.log(
          `⏳ OKX: USDC/USDT 資金費率: ${fundingRate.toFixed(
            4
          )}% | 下一次計算時間: ${nextFundingTime}`
        );
      }
    } catch (error) {
      console.error("❌ Error parsing OKX message:", error.message);
    }
  });

  okxWs.on("error", (error) => {
    console.error("❌ OKX WebSocket Error:", error);
  });

  okxWs.on("close", () => {
    console.log("🔌 OKX WebSocket Disconnected. Reconnecting in 5 seconds...");
    setTimeout(connectOKXWebSocket, 5000);
  });
}

connectBinanceWebSocket();
connectOKXWebSocket();

// const Binance = BinancePkg.default || BinancePkg;
// const client = Binance({
//   apiKey: process.env.BINANCE_API_KEY,
//   apiSecret: process.env.BINANCE_API_SECRET,
// });

// >0餘額
// client.accountInfo().then((account) => {
//   const nonZeroBalances = account.balances.filter(
//     (balance) => parseFloat(balance.free) > 0
//   );
//   console.log("Non-zero Balances:", nonZeroBalances);
// });

// 帳戶餘額
// client.futuresAccountBalance().then((futuresAccountbalances) => {
//   console.log("Futures Account Info:", futuresAccountbalances);
// });

// 訂單
// client.futuresAllOrders().then((allOrders) => {
//   console.log("Futures Account Info:", allOrders);
// });
// try {
//   // 現貨買入BTC
//   const spotOrder = await client.order({
//     symbol: "BTCUSDT",
//     side: "BUY",
//     type: "MARKET",
//     quantity: 0.00000001,
//   });

//   // 永續做空BTC
//   const futuresOrder = await client.futuresOrder({
//     symbol: "BTCUSDT",
//     side: "SELL",
//     type: "MARKET",
//     quantity: 0.00000001,
//   });

//   console.log(
//     "✅ Trade Executed! Spot:",
//     spotOrder,
//     "Futures:",
//     futuresOrder
//   );
// } catch (error) {
//   console.error("❌ Order Execution Error:", error.message);
// }
