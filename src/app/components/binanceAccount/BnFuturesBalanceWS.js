"use client";
import { useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';



// --------------THIS CODE DOES NOT WORK--------------
export default function BnPortfolioMarginWS() {
  const [balance, setBalance] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [error, setError] = useState(null);
  const [listenKey, setListenKey] = useState(null);

  useEffect(() => {
    let socket;
    let refreshInterval;

    // Generate the query string with timestamp and recvWindow.
    const timestamp = Date.now();
    const recvWindow = 5000;
    const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    // Create the signature using your secret key.
    // Warning: Exposing your secret key on the client is not safe.
    const signature = CryptoJS.HmacSHA256(
      queryString,
      process.env.NEXT_PUBLIC_BINANCE_API_SECRET
    ).toString(CryptoJS.enc.Hex);

    // Fetch the listenKey from the Portfolio Margin API with signature.
    fetch(
      `https://papi.binance.com/papi/v1/listenKey?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': process.env.NEXT_PUBLIC_BINANCE_API_KEY,
        },
      }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data.listenKey) {
          throw new Error('No listenKey returned');
        }
        setListenKey(data.listenKey);
        console.log('Listen key fetched:', data.listenKey);

        // Connect to the Portfolio Margin WebSocket endpoint using the listenKey.
        socket = new WebSocket(`wss://fstream.binance.com/pm/ws/${data.listenKey}`);

        socket.onopen = (event) => {
          console.log("Portfolio Margin WebSocket connected", event);
          const subscribeRequest = {
            method: "SUBSCRIBE",
            params: ["TRADE_LITE"],
            id: Date.now(),
          };
          socket.send(JSON.stringify(subscribeRequest));
        };

        socket.onmessage = (event) => {
          console.log("WebSocket message received:", event.data);
          try {
            const message = JSON.parse(event.data);
            console.log("Parsed message:", message);
            if (message.e === "ACCOUNT_UPDATE") {
              setBalance(message.a?.b || null);
            } else if (message.e === "ORDER_TRADE_UPDATE") {
                console.log("Order Update:", message.o);
            } else if (message.e === "TRADE_LITE") {
                console.log("Trade Lite Update:", message);
            }
            setUpdates((prev) => [...prev, message]);
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket encountered an error:", err);
          setError("WebSocket encountered an error");
        };

        socket.onclose = () => {
          console.log("WebSocket closed");
        };

        // Refresh the listenKey every 55 minutes to keep it alive.
        refreshInterval = setInterval(() => {
          // PUT request to refresh the listenKey.
          fetch(
            `https://papi.binance.com/papi/v1/listenKey?${queryString}&signature=${signature}`,
            {
              method: 'PUT',
              headers: {
                'X-MBX-APIKEY': process.env.NEXT_PUBLIC_BINANCE_API_KEY,
              },
            }
          )
            .then((res) => {
              if (res.ok) {
                console.log("Listen key refreshed");
              } else {
                console.error("Failed to refresh listen key", res.status);
              }
            })
            .catch((err) => {
              console.error("Error refreshing listen key:", err);
            });
        }, 55 * 60 * 1000);
      })
      .catch((err) => {
        console.error("Error fetching listen key:", err);
        setError("Failed to fetch listen key");
      });

    // Cleanup on unmount.
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      if (socket) socket.close();
    };
  }, []);

  return (
    <div className="p-4 border rounded-xl shadow-lg bg-white max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4 text-black">
        Portfolio Margin Account WebSocket
      </h1>
      {error && <p className="text-red-500">Error: {error}</p>}
      <div>
        <h2 className="text-lg font-semibold">Balance</h2>
        {balance ? (
          <pre className="bg-gray-100 p-2 rounded-md overflow-auto">
            {JSON.stringify(balance, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">Waiting for balance update...</p>
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold mt-4">All Updates</h2>
        {updates.length > 0 ? (
          <pre className="bg-gray-100 p-2 rounded-md overflow-auto text-black">
            {JSON.stringify(updates, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">Waiting for any updates...</p>
        )}
      </div>
    </div>
  );
}
