import { FastifyInstance } from "fastify";
import { verifyAdmin } from "../middlewares/auth-middleware.js";
import { pool } from "../index.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", async (request, reply) => {
    const user = request.user as { id: string; email: string; role: string } | undefined;
    if (!user) {
      return reply.unauthorized("Not authenticated");
    }

    try {
      const result = await pool.query(
        `SELECT id, email, role, created_at, 
                (SELECT balance FROM wallets WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as balance
         FROM users u WHERE id = $1`,
        [user.id]
      );

      if (result.rows.length === 0) {
        return reply.notFound("User not found");
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        balance: row.balance,
        createdAt: row.created_at,
      };
    } catch (err) {
      app.log.error(err);
      return reply.internalServerError("Failed to fetch user");
    }
  });

  app.get(
    "/users",
    { preHandler: verifyAdmin },
    async (_request, reply) => {
      try {
        const result = await pool.query(
          "SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
        );
        return result.rows;
      } catch (err) {
        app.log.error(err);
        return reply.internalServerError("Failed to fetch users");
      }
    }
  );
}
