'use client';
import { useEffect, useState } from 'react';
export default function AccountInfo() {
  const [accountInfo, setAccountInfo] = useState(null);
  const [accountBalance, setAccountBalance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/binance/account')
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        // console.log('getBalance result:', data.result);
        setAccountInfo(data.accountInfo);
        setAccountBalance(data.accountBalance);
       
      })
      .catch((err) => {
        console.error('getBalance error:', err);
        setError(err.message);
      });
  }, []);

  return (
    <div className='flex flex-col gap-4 border border-gray-400 p-4 rounded-lg'>
      {error && <p>Error: {error}</p>}
      <h2 className='text-lg font-bold text-yellow-400'>BINANCE</h2>
      <div className='flex flex-row gap-10'>
      {/* Regular Account Info */}
      {accountInfo ? (
        <div className='flex flex-col gap-2'>
          <h2 className='text-lg font-bold'>帳戶資訊 Account Information </h2>
          <ul>
            <li><strong>淨資產:</strong> {accountInfo.accountEquity}</li>
            <li><strong>實際資產:</strong> {accountInfo.actualEquity}</li>
            <li><strong>初始保證金:</strong> {accountInfo.accountInitialMargin}</li>
            <li><strong>帳戶狀態:</strong> {accountInfo.accountStatus}</li>
            <li><strong>可用總額:</strong> {accountInfo.totalAvailableBalance}</li>
            <li className=''><strong>更新時間:</strong> {new Date(accountInfo.updateTime).toLocaleString()}</li>
          </ul>
        </div>
      ) : (
        <p>Loading regular account balance...</p>
      )}

            {accountBalance ? (
            <div className='flex flex-col gap-2'>
                <h2 className='text-lg font-bold'>帳戶資產 Account Balance </h2>
                <ul className="flex flex-row gap-8">
                {accountBalance.map((balance) => (
                    <li key={balance.asset}>
                    <strong>資產:</strong> {balance.asset} <br />
                    <strong>總錢包餘額:</strong> {balance.totalWalletBalance} <br />
                    <strong>跨保證金資產:</strong> {balance.crossMarginAsset} <br />
                    <strong>跨保證金借款:</strong> {balance.crossMarginBorrowed} <br />
                    <strong>跨保證金可用:</strong> {balance.crossMarginFree} <br />
                    <strong>跨保證金利息:</strong> {balance.crossMarginInterest} <br />
                    <strong>跨保證金鎖定:</strong> {balance.crossMarginLocked} <br />
                    <strong>UM 錢包餘額:</strong> {balance.umWalletBalance} <br />
                    <strong>UM 未實現盈虧:</strong> {balance.umUnrealizedPNL} <br />
                    <strong>CM 錢包餘額:</strong> {balance.cmWalletBalance} <br />
                    <strong>CM 未實現盈虧:</strong> {balance.cmUnrealizedPNL} <br />
                    <strong>負餘額:</strong> {balance.negativeBalance}
                    </li>
                ))}
                </ul>
            </div>
            ) : (
            <p>Loading account balance...</p>
            )}
      </div>
    </div>
  );
}

