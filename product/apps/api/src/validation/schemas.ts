import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const depositSchema = z.object({
  amount: z.number().positive().min(1).max(100000000, "Maximum deposit: 1,000,000.00"),
  currency: z.string().default("USD"),
  idempotencyKey: z.string().min(1),
});

export const withdrawalSchema = z.object({
  amount: z.number().positive().min(100).max(100000000, "Maximum withdrawal: 1,000,000.00"),
  currency: z.string().default("USD"),
  idempotencyKey: z.string().min(1),
  destination: z.string().min(1).max(255),
});

export const spinSchema = z.object({
  betAmount: z.number().positive().min(10).max(1000000, "Maximum bet: 10,000.00"),
  currency: z.string().default("USD"),
  idempotencyKey: z.string().min(1),
  gameId: z.string().default("slot-basic"),
});

export const bonusClaimSchema = z.object({
  ruleId: z.string().min(1),
  depositAmount: z.number().positive().min(1),
  idempotencyKey: z.string().min(1),
});

export const kycSubmitSchema = z.object({
  documentType: z.enum(["passport", "drivers_license", "id_card"]),
  documentReference: z.string().min(1).max(255),
});

export const kycReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});

export const paginationSchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export function validate<T>(schema: z.ZodType<T>, data: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }
  return { data: result.data };
}
