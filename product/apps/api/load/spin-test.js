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
  // Create a shared test user with balance
  const email = `load-spin-${Date.now()}@test.com`;
  const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    email,
    password: "LoadTest123!",
  }), { headers: { "Content-Type": "application/json" } });

  if (regRes.status !== 201) {
    throw new Error("Setup failed: cannot register");
  }

  const token = JSON.parse(regRes.body).token;

  // Seed balance
  http.post(`${BASE_URL}/api/v1/wallet/deposit`, JSON.stringify({
    amount: 100000,
    currency: "USD",
    idempotencyKey: `setup-${Date.now()}`,
  }), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return { token };
}

export default function (data) {
  const betAmount = Math.floor(Math.random() * 900) + 100;

  const spinRes = http.post(`${BASE_URL}/api/v1/games/slot/spin`, JSON.stringify({
    betAmount,
    currency: "USD",
    idempotencyKey: `${__VU}-${__ITER}-${Date.now()}`,
  }), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    },
  });

  check(spinRes, { "spin OK": (r) => r.status === 200 });

  sleep(0.5);
}
