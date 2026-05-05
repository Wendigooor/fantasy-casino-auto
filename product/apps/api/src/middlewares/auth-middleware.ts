import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

export async function verifyAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (user?.role !== "admin") {
    return reply.forbidden("Admin access required");
  }
}

export async function authMiddleware(app: FastifyInstance) {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.unauthorized("Access token missing");
      }

      const token = authHeader.replace("Bearer ", "");
      const decoded = app.jwt.verify(token) as { id: string; email: string; role: string };
      request.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return reply.unauthorized("Invalid or expired token");
    }
  });

  app.decorate("verifyAdmin", verifyAdmin);
}
