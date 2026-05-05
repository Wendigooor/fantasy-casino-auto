import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "60s", target: 100 },
    { duration: "30s", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export function setup() {
  const email = `wallet-read-${Date.now()}@test.com`;

  const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    email,
    password: "LoadTest123!",
  }), { headers: { "Content-Type": "application/json" } });

  if (regRes.status !== 201) {
    throw new Error("Setup failed: cannot register");
  }

  const token = JSON.parse(regRes.body).token;

  const depositRes = http.post(`${BASE_URL}/api/v1/wallet/deposit`, JSON.stringify({
    amount: 100000,
    currency: "USD",
    idempotencyKey: `wallet-setup-${Date.now()}`,
  }), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (depositRes.status !== 200) {
    throw new Error("Setup failed: cannot deposit");
  }

  return { token };
}

export default function (data) {
  const { token } = data;

  // Fetch wallet balance
  const walletRes = http.get(`${BASE_URL}/api/v1/wallet`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(walletRes, { "wallet OK": (r) => r.status === 200 });

  // Fetch wallet ledger
  const ledgerRes = http.get(`${BASE_URL}/api/v1/wallet/ledger`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(ledgerRes, { "ledger OK": (r) => r.status === 200 });

  sleep(1);
}
