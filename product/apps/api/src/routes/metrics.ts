import { FastifyInstance } from "fastify";

const counters: Record<string, number> = {
  http_requests_total: 0,
  deposits_total: 0,
  withdrawals_total: 0,
  spins_total: 0,
  registrations_total: 0,
  logins_total: 0,
  errors_total: 0,
};

const latencies: Record<string, number[]> = {
  http_request_duration_ms: [],
};

export function incMetric(name: string) {
  if (counters[name] !== undefined) {
    counters[name]++;
  }
}

export function recordLatency(ms: number) {
  latencies.http_request_duration_ms.push(ms);
  if (latencies.http_request_duration_ms.length > 1000) {
    latencies.http_request_duration_ms.shift();
  }
}

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async () => {
    let latencyAvg = 0;
    const lats = latencies.http_request_duration_ms;
    if (lats.length > 0) {
      latencyAvg = lats.reduce((a, b) => a + b, 0) / lats.length;
    }

    return {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      counts: counters,
      latencyAvgMs: Math.round(latencyAvg),
      nodeVersion: process.version,
    };
  });
}
