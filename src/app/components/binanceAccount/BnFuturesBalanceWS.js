"use client"
import { useEffect, useState } from 'react';
const crypto = require('crypto');

function getTimestamp() {
    return Date.now();
}

const apiKey = 'D2bKO8R25tniVkjGh9uPNQRPhjhtQgZWgnblUFDmJevvyiAQrmHWo9RJ7QhUbA1M';
const apiSecret = `DfdPp7URKYeOvyu9DBDEfY59Aeydc3stqP3XixN4y2Kdf2A50bdI8PVzFRdenUPt`;

function signature(query_string) {
    return crypto
        .createHmac('sha256', apiSecret)
        .update(query_string)
        .digest('hex');
}

export default function FuturesAccountBalance() {
    const [balance, setBalance] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBalance = async () => {
            const timestamp = getTimestamp();
            const signatureTest = signature(timestamp);

            const url = `https://fapi.binance.com/fapi/v3/account?timestamp=${timestamp}&signature=${signatureTest}`;

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'X-MBX-APIKEY': apiKey
                    }
                });
                console.log(response);
                const data = await response.json();
                if (data.code && data.code < 0) {
                    setError(data.msg);
                } else {
                    setBalance(data);
                }
            } catch (err) {
                console.error("API error:", err);
                setError("Failed to fetch account balance");
            }
        };

        fetchBalance();
    }, []);

    return (
        <div className="p-4 border rounded-xl shadow-lg bg-white max-w-md mx-auto">
            <h1 className="text-xl font-bold mb-4">Futures Account Balance</h1>
            {error && <p className="text-red-500">Error: {error}</p>}
            {balance ? (
                <pre className="bg-gray-100 p-2 rounded-md overflow-auto">{JSON.stringify(balance, null, 2)}</pre>
            ) : (
                <p>Loading balance data...</p>
            )}
        </div>
    );
}
