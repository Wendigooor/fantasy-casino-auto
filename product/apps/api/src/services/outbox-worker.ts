import { Pool } from "pg";

export class OutboxWorker {
  private running = false;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private pool: Pool,
    private handler: (events: Array<Record<string, unknown>>) => Promise<void>,
    private pollIntervalMs: number = 5000,
    private batchSize: number = 50
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.interval = setInterval(() => this.process(), this.pollIntervalMs);
    console.log("Outbox worker started");
  }

  stop(): void {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    console.log("Outbox worker stopped");
  }

  private async process(): Promise<void> {
    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT event_id, event_type, player_id, metadata
           FROM casino_events
           WHERE created_at < NOW() - INTERVAL '2 seconds'
           ORDER BY created_at ASC
           LIMIT $1`,
          [this.batchSize]
        );

        if (result.rows.length === 0) return;

        // Mark as processed
        const eventIds = result.rows.map((r: Record<string, unknown>) => r.event_id as string);
        await client.query(
          `DELETE FROM casino_events WHERE event_id = ANY($1)`,
          [eventIds]
        );

        await this.handler(result.rows);

        console.log(`Outbox worker processed ${result.rows.length} events`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Outbox worker error:", err);
    }
  }
}
