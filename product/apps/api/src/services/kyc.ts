import { Pool } from "pg";

export interface KycVerification {
  id: string;
  userId: string;
  status: "pending" | "in_review" | "approved" | "rejected";
  documentType: string;
  documentReference?: string;
  adminNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

export class KycService {
  constructor(private pool: Pool) {}

  async submit(
    userId: string,
    documentType: string,
    documentReference?: string
  ): Promise<KycVerification> {
    const result = await this.pool.query(
      `INSERT INTO kyc_verifications (user_id, document_type, document_reference, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [userId, documentType, documentReference || null]
    );
    return this._mapRow(result.rows[0]);
  }

  async getStatus(userId: string): Promise<KycVerification | null> {
    const result = await this.pool.query(
      "SELECT * FROM kyc_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    if (result.rows.length === 0) return null;
    return this._mapRow(result.rows[0]);
  }

  async listPending(limit: number = 20): Promise<KycVerification[]> {
    const result = await this.pool.query(
      `SELECT k.*, u.email as user_email
       FROM kyc_verifications k
       JOIN users u ON u.id = k.user_id
       WHERE k.status IN ('pending', 'in_review')
       ORDER BY k.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => this._mapRow(r));
  }

  async review(
    verificationId: string,
    status: "approved" | "rejected",
    reviewerId: string,
    notes?: string
  ): Promise<KycVerification> {
    const result = await this.pool.query(
      `UPDATE kyc_verifications
       SET status = $1, reviewed_by = $2, admin_notes = $3,
           reviewed_at = NOW()
       WHERE id = $4 AND status IN ('pending', 'in_review')
       RETURNING *`,
      [status, reviewerId, notes || null, verificationId]
    );
    if (result.rows.length === 0) {
      throw new Error("Verification not found or already reviewed");
    }
    return this._mapRow(result.rows[0]);
  }

  async isVerified(userId: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM kyc_verifications WHERE user_id = $1 AND status = 'approved'",
      [userId]
    );
    return result.rows.length > 0;
  }

  private _mapRow(row: Record<string, unknown>): KycVerification {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      status: row.status as KycVerification["status"],
      documentType: row.document_type as string,
      documentReference: row.document_reference as string | undefined,
      adminNotes: row.admin_notes as string | undefined,
      submittedAt: row.submitted_at as Date,
      reviewedAt: row.reviewed_at as Date | undefined,
    };
  }
}
