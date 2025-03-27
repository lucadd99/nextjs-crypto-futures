function fundingRateArbitrage(positionSize, btcPrice, higherFundingRate, lowerFundingRate, tradingFee) {
    // Convert percentages to decimal
    let higherRateDecimal = higherFundingRate / 100;
    let lowerRateDecimal = lowerFundingRate / 100;
    let tradingFeeDecimal = tradingFee / 100;
    
    // Calculate funding profit
    let profit = positionSize * btcPrice * (higherRateDecimal - lowerRateDecimal);
    
    // Calculate trading fees (for both opening and closing)
    let totalTradingFee = 2 * (positionSize * btcPrice * tradingFeeDecimal);
    
    // Final profit after fees
    let netProfit = profit - totalTradingFee;
    
    return netProfit;
}

// Example usage:
let positionSize = 10; // 1 BTC
let btcPrice = 35.80; // BTC price in USD
let higherFundingRate =-0.0008; // 0.04%
let lowerFundingRate = -0.2463; // 0.01%
let tradingFee = 0.1; // 0.1% per trade

console.log(fundingRateArbitrage(positionSize, btcPrice, higherFundingRate, lowerFundingRate, tradingFee));