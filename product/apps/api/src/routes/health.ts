import { FastifyInstance } from "fastify";

export async function healthHandler(
  this: FastifyInstance,
  _request: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply
) {
  let dbStatus = "unknown";
  try {
    const result = await this.pg.query("SELECT 1 as ok");
    dbStatus = result.rows[0]?.ok === 1 ? "connected" : "error";
  } catch {
    dbStatus = "disconnected";
  }

  return reply.send({
    status: dbStatus === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    uptime: process.uptime(),
    database: dbStatus,
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
}
