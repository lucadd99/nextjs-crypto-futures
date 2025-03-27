// import FuturesLivePrice from "./components/FuturesLivePrice";
// import FuturesOrderBook from "./components/FuturesOrderBook";
// import BnMultiFutures from "./components/BnMultiFututres";
// import OkxMultiFutures from "./components/OkxMultiFutures";
// import ABcompare from "./components/ABcompare";
import ABcompareByChoice from "./components/ABcompareByChoice";
import BinanceAccountInfo from "./components/binanceAccount/BnAccountInfo"; 
import OKXAccountInfo from "./components/okxAccoount/OkxAccountInfo";
export default function Home() {
  return (
    <div className="w-full flex items-start min-h-screen p-8 pb-20 gap-16 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full flex flex-col justify-center items-center">
        {/* <div className="text-3xl font-bold mb-5 pt-10">Binance Futures</div> */}
        <div className="flex flex-col items-center justify-center w-full min-w-[650px]">
          {/* <FuturesLivePrice /> */}
          {/* <FuturesOrderBook /> */}
          {/* <BnMultiFutures /> */}
          {/* <OkxMultiFutures /> */}
          {/* <ABcompare /> */}
          <div className="mb-10">
           <OKXAccountInfo />
          <BinanceAccountInfo />
          </div>
          <ABcompareByChoice />
        </div>
      </div>
    </div>
  );
}
