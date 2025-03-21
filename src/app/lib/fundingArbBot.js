import axios from "axios";
// import ccxt from "ccxt";

// Function to get Binance funding rate (for a symbol like BTCUSDT on Futures)

const tokens = [
  "BTC",
  "ETH",
  "SOL",
  "IP",
  "JUP",
  "AEVO",
  "KAITO",
  "NEIROETH",
  "SWARMS",
  "AIXBT",
  "PIPPIN",
];
const ARB_THRESHOLD = 0.0001; // Define the minimum funding rate difference to consider an arbitrage opportunity

// Fetch funding rate for a given token from Binance
async function fetchBinanceFundingRate(token) {
  // Assuming Binance’s funding rate endpoint uses a symbol format like BTCUSDT
  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${token}USDT&limit=1`;
  try {
    const response = await fetch(url);
    const result = await response.json();
    return {
      token,
      fundingRate: parseFloat(result.lastFundingRate) * 100 + "%",
    };
  } catch (error) {
    console.error(`Error fetching Binance funding rate for ${token}:`, error);
    // Retry after a delay
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchBinanceFundingRate(token);
  }
}

// Fetch funding rate for a given token from OKX
async function fetchOKXFundingRate(token) {
  // Assuming OKX uses an instId like BTC-USD-SWAP for funding rates
  const instId = `${token}-USDT-SWAP`;

  const url = `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`;
  try {
    const response = await fetch(url);
    const result = await response.json();
    if (!result.data || result.data.length === 0) {
      throw new Error(`No funding rate data returned for ${instId}`);
    }
    const rawFundingRate = result.data[0].fundingRate;
    // Convert to a percentage (if desired) by multiplying by 100
    const percentageFundingRate = parseFloat(rawFundingRate) * 100 + "%";
    return {
      token,
      fundingRate: percentageFundingRate,
    };
  } catch (error) {
    console.error(`Error fetching OKX funding rate for ${token}:`, error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchOKXFundingRate(token);
  }
}

// Fetch funding rates for all specified tokens from both exchanges
async function fetchAllFundingRates() {
  // For Binance
  const binancePromises = tokens.map(fetchBinanceFundingRate);
  // For OKX
  const okxPromises = tokens.map(fetchOKXFundingRate);

  const binanceRates = await Promise.all(binancePromises);
  const okxRates = await Promise.all(okxPromises);

  return { binanceRates, okxRates };
}

// Run the function and log the funding rates
// fetchAllFundingRates().then((rates) => {
//   console.log("Binance Funding Rates:", rates.binanceRates);
//   console.log("OKX Funding Rates:", rates.okxRates);
// });

function findArbitrageOpportunities(binanceRates, okxRates) {
  const opportunities = [];
  tokens.forEach((token) => {
    // Find the funding data for the given token from both exchanges
    const binanceData = binanceRates.find((item) => item.token === token);
    const okxData = okxRates.find((item) => item.token === token);

    if (!binanceData || !okxData) return;

    // Parse the funding rates into floats
    const binanceRate = parseFloat(binanceData.fundingRate).toFixed(6);
    const okxRate = parseFloat(okxData.fundingRate).toFixed(6);
    const diff = binanceRate - okxRate;

    // Check if the absolute difference exceeds the arbitrage threshold
    if (Math.abs(diff) > ARB_THRESHOLD) {
      // If Binance's rate is higher, consider shorting on Binance and longing on OKX
      // Otherwise, do the opposite.
      const strategy =
        diff > 0
          ? `Short on Binance, Long on OKX (diff: ${diff.toFixed(8)})`
          : `Long on Binance, Short on OKX (diff: ${diff.toFixed(8)})`;

      opportunities.push({
        token,
        binanceRate,
        okxRate,
        diff: diff.toFixed(8) + "%",
        strategy,
      });
    }
  });

  return opportunities;
}

// Main function to run the fetch and compare routines
async function main() {
  const { binanceRates, okxRates } = await fetchAllFundingRates();

  console.log("Binance Funding Rates:", binanceRates);
  console.log("OKX Funding Rates:", okxRates);

  const opportunities = findArbitrageOpportunities(binanceRates, okxRates);

  if (opportunities.length > 0) {
    console.log("Arbitrage opportunities detected:");
    console.table(opportunities);
  } else {
    console.log("No arbitrage opportunities at the moment.");
  }
}

main();
// (async () => {
//   // Initialize exchanges with your API credentials
//   const binance = new ccxt.binance({
//     apiKey: 'YOUR_BINANCE_API_KEY',
//     secret: 'YOUR_BINANCE_API_SECRET',
//     options: { defaultType: 'future' }  // Use the futures market for funding rates
//   });

//   const okx = new ccxt.okx({
//     apiKey: 'YOUR_OKX_API_KEY',
//     secret: 'YOUR_OKX_API_SECRET',
//     password: 'YOUR_OKX_API_PASSWORD'
//   });

// Insert logic to fetch and compare funding rates, then create orders:
// e.g., await binance.createOrder(...);
// e.g., await okx.createOrder(...);

// })();
