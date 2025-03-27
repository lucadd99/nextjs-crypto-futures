"use client";
import { useEffect, useState } from "react";

export default function OKXAccountInfo() {
  const [accountBalance, setAccountBalance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/okx/account")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        // console.log("getAccountInstruments():", data.accountBalance[0]);
        setAccountBalance(data.accountBalance[0]);
      })
      .catch((err) => {
        console.error("getBalance error:", err);
        setError(err.message);
      });
  }, []);

  return (
    <div className="p-1">
      {error && <p className="text-red-500">Error: {error}</p>}

      {!accountBalance && !error && <p>Loading...</p>}

      {accountBalance && (
        <>
          {/* <h2>美金層面權益: {accountBalance.totalEq}</h2> */}
          <div className="border border-1 rounded-md p-2">
            <div className="flex flex-row gap-3 justify-center items-center p-2">
              <span className="inline-block bg-black text-white px-2 py-1 font-bold uppercase tracking-wider border  rounded-md">
                OKX
              </span>
              <p>帳戶</p>
            </div>
            {accountBalance.details &&
              accountBalance.details.map((detail, index) => (
                <div key={index}>
                  <p>
                    <strong>幣種:</strong> {detail.ccy}
                  </p>
                  <p>
                    <strong>幣種餘額 :</strong> {detail.cashBal}
                  </p>
                  <p>
                    <strong>可用餘額:</strong> {detail.availBal}
                  </p>
                  <p>
                    <strong>幣種權益美金價值:</strong> {detail.eqUsd}
                  </p>
                  <p>
                    <strong>更新時間:</strong>{" "}
                    {new Date(Number(detail.uTime)).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
