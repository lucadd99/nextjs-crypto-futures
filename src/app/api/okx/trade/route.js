import { RestClient } from "okx-api";
import axios from "axios";

const API_KEY = process.env.OKX_API_KEY;
const API_SECRET = process.env.OKX_API_SECRET;
const API_PASS = process.env.OKX_API_PASS;

export async function POST(request) {
  if (!API_KEY || !API_SECRET || !API_PASS) {
    return new Response(
      JSON.stringify({ error: "Missing Binance API credentials" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(new Date(), "Using credentials: ", {
    API_KEY,
    API_SECRET,
    API_PASS,
  });

  const client = new RestClient({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    apiPass: API_PASS,
  });

  try {
    const order = await request.json();

    let testOrder = {
      instId: "PIPPIN-USDT-SWAP",
      tdMode: "cross", //保證金模式：isolated：逐倉；cross：全倉非保證金模式：cash
     // ccy:"PIPPIN",//保證金幣種
      clOrdId: "lucaTestOrder01", //客戶自訂訂單ID
      side: "buy",
      ordType: "market", //訂單類型
      sz: "1", //委託數量
      //posSide:"long", //持倉方向在開平倉模式下必填，且僅可選擇long或short
      //px: "2.15", //委託價格，僅適用於limit、post_only、fok、ioc、mmp、mmp_and_post_only
    };

    // ------------下訂單----------------
    const placeOrder = await client.submitOrder(order);
    console.log(order);

    return new Response(JSON.stringify({ placeOrder }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.log("OKX API:",error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
