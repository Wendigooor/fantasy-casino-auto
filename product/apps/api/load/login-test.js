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

export default function () {
  const email = `login-load-${__VU}-${__ITER}@test.com`;
  const password = "LoadTest123!";

  // Register
  const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    email,
    password,
  }), { headers: { "Content-Type": "application/json" } });

  check(regRes, { "register OK": (r) => r.status === 201 });

  if (regRes.status !== 201) return;

  // Login
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email,
    password,
  }), { headers: { "Content-Type": "application/json" } });

  check(loginRes, { "login OK": (r) => r.status === 200 });

  if (loginRes.status !== 200) return;

  const token = JSON.parse(loginRes.body).token;

  // Fetch profile
  const profileRes = http.get(`${BASE_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(profileRes, { "profile OK": (r) => r.status === 200 });

  sleep(1);
}
