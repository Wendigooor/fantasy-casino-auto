import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "40s", target: 50 },
    { duration: "20s", target: 10 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export function setup() {
  const email = `history-load-${Date.now()}@test.com`;

  const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    email,
    password: "LoadTest123!",
  }), { headers: { "Content-Type": "application/json" } });

  if (regRes.status !== 201) {
    throw new Error("Setup failed: cannot register");
  }

  const token = JSON.parse(regRes.body).token;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const depositRes = http.post(`${BASE_URL}/api/v1/wallet/deposit`, JSON.stringify({
    amount: 100000,
    currency: "USD",
    idempotencyKey: `history-setup-deposit-${Date.now()}`,
  }), { headers });

  if (depositRes.status !== 200) {
    throw new Error("Setup failed: cannot deposit");
  }

  // Do 5 spins to populate history
  for (let i = 0; i < 5; i++) {
    http.post(`${BASE_URL}/api/v1/games/slot/spin`, JSON.stringify({
      betAmount: 100,
      currency: "USD",
      idempotencyKey: `history-setup-spin-${i}-${Date.now()}`,
    }), { headers });

    sleep(0.2);
  }

  return { token };
}

export default function (data) {
  const { token } = data;

  // Fetch history page 1
  const page1 = http.get(`${BASE_URL}/api/v1/games/history?limit=10&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(page1, { "history page 1 OK": (r) => r.status === 200 });

  // Fetch history page 2
  const page2 = http.get(`${BASE_URL}/api/v1/games/history?limit=10&offset=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(page2, { "history page 2 OK": (r) => r.status === 200 });

  sleep(1);
}
