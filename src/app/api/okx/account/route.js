import { RestClient } from "okx-api";


const API_KEY = process.env.OKX_API_KEY;
const API_SECRET = process.env.OKX_API_SECRET;
const API_PASS = process.env.OKX_API_PASS;

export async function GET(request) {

if (!API_KEY || !API_SECRET || !API_PASS) {
    return new Response(
        JSON.stringify({ error: "Missing Binance API credentials" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
  }
  
  console.log(new Date(), 'Using credentials: ', {
    API_KEY,
    API_SECRET,
    API_PASS,
  });

  const client = new RestClient({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    apiPass: API_PASS,
  });
  
  // const wsClient = new WebsocketClient({
  //   apiKey: API_KEY,
  //   apiSecret: API_SECRET,
  //   apiPass: API_PASS,
  // });

  try {

    //取得目前帳戶可交易產品的資訊清單。
    // const accountInstruments = await client.getAccountInstruments({
    //     instType:'SWAP'
    // })


    // 取得該帳戶下擁有實際持倉的資訊。
    // 帳戶為買賣模式會顯示淨持倉（net），帳戶為開平倉模式下會分別回傳開多（long）或開空（short）的部位。依照倉位創建時間倒序排列。
    // const accountPosition = await client.getPosition();

    // 查看歷史持倉資訊
    // 取得最近3個月有更新的倉位信息，按照倉位更新時間倒序排列。於2024年11月11日中午12:00（UTC+8）開始支援組合保證金帳戶模式下的歷史持股。
    // const accountPosition = await client.getPositionsHistory();
    

    // 取得交易帳戶中資金餘額資訊。
    const accountBalance = await client.getBalance();

  return new Response(JSON.stringify({ accountBalance }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
    } catch (error) {
    console.error("OKX API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

}