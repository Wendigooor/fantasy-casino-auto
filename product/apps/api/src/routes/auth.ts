import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcrypt";
import { pool } from "../index.js";
import { Analytics } from "../services/analytics.js";
import { registerSchema, loginSchema, validate } from "../validation/schemas.js";

const SALT_ROUNDS = 12;

export async function authRoutes(app: FastifyInstance) {
  // Register new user
  app.post("/auth/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = validate(registerSchema, request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }
    const body = parsed.data;

    try {
      // Check if user already exists
      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [body.email]
      );

      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(body.password, SALT_ROUNDS);

      // Insert user
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, role) 
         VALUES ($1, $2, 'player') 
         RETURNING id, email, role, created_at`,
        [body.email, hashedPassword]
      );

      const user = result.rows[0];

      // Create wallet with starting balance (1000.00 = 100000 cents)
      const startingBalance = 100000;
      await pool.query(
        `INSERT INTO wallets (user_id, currency, balance, state) 
         VALUES ($1, 'USD', $2, 'active')`,
        [user.id, startingBalance]
      );

      // Generate JWT token
      const token = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: "7d" }
      );

      Analytics.get().trackRegister(user.id, user.email);

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          balance: startingBalance,
        },
        token,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = validate(loginSchema, request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }
    const body = parsed.data;

    try {
      // Find user by email
      const result = await pool.query(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        [body.email]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const user = result.rows[0];

      // Compare password
      const validPassword = await bcrypt.compare(body.password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      // Get wallet balance
      const walletResult = await pool.query(
        "SELECT balance FROM wallets WHERE user_id = $1 AND state = 'active' ORDER BY created_at DESC LIMIT 1",
        [user.id]
      );

      const balance = walletResult.rows.length > 0 ? walletResult.rows[0].balance : 0;

      // Generate JWT token
      const token = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: "7d" }
      );

      Analytics.get().trackLogin(user.id);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          balance,
        },
        token,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Login failed" });
    }
  });
}
