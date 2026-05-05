import { FastifyInstance, FastifyRequest } from "fastify";

const clients = new Map<string, Set<(data: string) => void>>();

export function broadcastUser(userId: string, event: string, data: unknown) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const send of userClients) {
    try { send(payload); } catch { /* client disconnected */ }
  }
}

export async function sseRoutes(app: FastifyInstance) {
  app.get("/sse", async (request: FastifyRequest, reply) => {
    // Accept token from query param (EventSource doesn't support custom headers)
    const token = (request.query as { token?: string }).token;
    let userId: string;

    if (token) {
      try {
        const decoded = app.jwt.verify(token) as { id: string };
        userId = decoded.id;
      } catch {
        return reply.unauthorized("Invalid token");
      }
    } else {
      const user = request.user as { id: string } | undefined;
      if (!user) return reply.unauthorized("Not authenticated");
      userId = user.id;
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (data: string) => {
      reply.raw.write(data);
    };

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(send);

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      try { reply.raw.write(": heartbeat\n\n"); } catch { /* ignore */ }
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      clients.get(userId)?.delete(send);
    });

    reply.raw.write(`event: connected\ndata: {}\n\n`);
  });
}
