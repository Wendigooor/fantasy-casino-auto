import { Pool } from "pg";

export interface CasinoEvent {
  event_id: string;
  event_type: string;
  player_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export class EventEmitter {
  private queue: CasinoEvent[] = [];
  private flushing = false;

  constructor(private pool: Pool) {}

  emit(eventType: string, playerId: string, metadata: Record<string, unknown> = {}): void {
    this.queue.push({
      event_id: crypto.randomUUID(),
      event_type: eventType,
      player_id: playerId,
      metadata,
      created_at: new Date(),
    });

    if (!this.flushing) {
      this.flushQueue();
    }
  }

  private async flushQueue(): Promise<void> {
    this.flushing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 50);

      try {
        const client = await this.pool.connect();
        try {
          await client.query("BEGIN");
          for (const event of batch) {
            await client.query(
              `INSERT INTO casino_events (event_id, event_type, player_id, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                event.event_id,
                event.event_type,
                event.player_id,
                JSON.stringify(event.metadata),
                event.created_at,
              ]
            );
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          console.error("Event flush failed:", err);
          this.queue.unshift(...batch);
        } finally {
          client.release();
        }
      } catch (err) {
        console.error("Event flush connection failed:", err);
        this.queue.unshift(...batch);
        break;
      }
    }

    this.flushing = false;
  }

  async getEvents(
    playerId: string,
    options?: {
      limit?: number;
      after?: Date;
      eventTypes?: string[];
    }
  ): Promise<CasinoEvent[]> {
    let where = "player_id = $1";
    const params: unknown[] = [playerId];
    let idx = 2;

    if (options?.after) {
      where += ` AND created_at > $${idx}`;
      params.push(options.after);
      idx++;
    }

    if (options?.eventTypes && options.eventTypes.length > 0) {
      where += ` AND event_type = ANY($${idx})`;
      params.push(options.eventTypes);
      idx++;
    }

    const res = await this.pool.query(
      `SELECT event_id, event_type, player_id, metadata, created_at
       FROM casino_events WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...params, options?.limit ?? 50]
    );
    return res.rows.map((row) => ({
      event_id: row.event_id,
      event_type: row.event_type,
      player_id: row.player_id,
      metadata: row.metadata || {},
      created_at: new Date(row.created_at),
    }));
  }
}
