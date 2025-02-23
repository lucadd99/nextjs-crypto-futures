// import { NextResponse } from "next/server";
// import { connectWebSocket, orderBookData } from "@/app/lib/binanceWebsocket";
// export async function GET() {
//   if (!orderBookData || Object.keys(orderBookData).length === 0) {
//     return NextResponse.json(
//       { message: "Order book data not available yet" },
//       { status: 503 }
//     );
//   }

//   return NextResponse.json(orderBookData);
// }
// // Start WebSocket connection when API is first accessed
// connectWebSocket(() => {});
