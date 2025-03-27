// /app/api/binance/route.js
import { PortfolioClient } from "binance";
import axios from "axios";
// 統一帳戶使用 PortfolioClient
export async function GET(request) {
  // Check if the environment variables are set
  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return new Response(
      JSON.stringify({ error: "Missing Binance API credentials" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new PortfolioClient({
    api_key: process.env.BINANCE_API_KEY,
    api_secret: process.env.BINANCE_API_SECRET,
  });

  try {
    const accountInfo = await client.getAccountInfo({
      //帳戶資訊

    });
    const accountBalance = await client.getBalance({
      //所有資產
    
    });

    // const result = await client.getAllCMOpenOrders(); //所有CM艙單
    // const result = await client.getAllMarginOCO(); //所有OCO
    // const result = await client.getAllUMOrders(); //所有艙單
    // const result = await client.getPMUserDataListenKey(); // start listenKey for WebSocket
    // const result = await client.closePMUserDataListenKey(); //close listenKey for WebSocket

    // ------------下訂單----------------
    //const result = await client.submitNewUMOrder( {
    //         symbol: 'BTCUSDT',
    //         side: 'LONG',
    //         type : 'LIMIT',
    //         timeInForce: 'GTC',
    //         quantity: '0.002',
    //         price: '10000',
    //         reduceOnly: false,
    //     }
    //  );

    // ------------下條件訂單----------------
    // const result = await client.submitNewUMConditionalOrder(
    //     {
    //         symbol: 'BTCUSDT',
    //         side: 'LONG',
    //         strategyType: 'TAKE_PROFIT',
    //         timeInForce: 'GTC',
    //         quantity: '0.002',
    //         price: '10000',
    //         stopPrice: '14000',
    //         triggerPrice: '10000',
    //         reduceOnly: true,
    //     }
    //  );

    //const result = await client.cancelUMConditionalOrder(); // 取消條件訂單
    // const result = await client.getUMCommissionRate(); //獲取UM帳戶佣金率
    //   const umAccountInfo  = await client.getUMAccount(); //獲取UM帳戶資訊
    //   console.log('accountBalance:', accountBalance     );
    return new Response(JSON.stringify({ accountInfo, accountBalance }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Binance API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
