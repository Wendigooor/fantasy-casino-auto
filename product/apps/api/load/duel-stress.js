import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE = __ENV.API_URL || "http://localhost:3001";

export default function () {
  // Register a unique user
  const id = `${__VU}-${__ITER}-${Date.now()}`;
  const email = `duel-${id}@t.io`;
  const registerRes = http.post(`${BASE}/api/v1/auth/register`, JSON.stringify({
    email, password: "Test1234!", name: `Player-${id}`
  }), { headers: { "Content-Type": "application/json" } });

  if (registerRes.status !== 201) {
    // Try login if already registered
    const loginRes = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({
      email, password: "Test1234!"
    }), { headers: { "Content-Type": "application/json" } });
    check(loginRes, { "login ok": (r) => r.status === 200 });
    const token = loginRes.json("token");
    if (!token) return;
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Create duel
    const createRes = http.post(`${BASE}/api/v1/duels`, JSON.stringify({
      gameId: "slot-basic", betAmount: 100
    }), { headers: { ...auth["headers"], "Content-Type": "application/json" } });

    check(createRes, { "duel created": (r) => r.status === 201 });

    // Get leaderboard
    const lbRes = http.get(`${BASE}/api/v1/leaderboard/duels`, auth);
    check(lbRes, { "leaderboard ok": (r) => r.status === 200 });

    // Get own stats
    const statsRes = http.get(`${BASE}/api/v1/players/me/duel-stats`, auth);
    check(statsRes, { "stats ok": (r) => r.status === 200 });
  }

  sleep(1);
}
