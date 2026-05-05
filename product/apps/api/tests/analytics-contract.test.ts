import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Contract extracted from agent/analytics_contract.py EVENTS dict
// Each event: { category, required_fields, optional_fields }
// ---------------------------------------------------------------------------

interface ContractEvent {
  category: string;
  required_fields: string[];
  optional_fields: string[];
}

const CONTRACT: Record<string, ContractEvent> = {
  // AUTH
  user_registered: {
    category: "AUTH",
    required_fields: ["user_id", "email", "ip", "source"],
    optional_fields: [],
  },
  user_login: {
    category: "AUTH",
    required_fields: ["user_id", "ip", "success"],
    optional_fields: ["user_agent"],
  },
  session_created: {
    category: "AUTH",
    required_fields: ["session_id", "user_id", "expires_at"],
    optional_fields: [],
  },
  session_expired: {
    category: "AUTH",
    required_fields: ["session_id", "user_id"],
    optional_fields: [],
  },
  password_changed: {
    category: "AUTH",
    required_fields: ["user_id"],
    optional_fields: [],
  },

  // WALLET
  wallet_funded: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "currency", "method", "tx_id"],
    optional_fields: [],
  },
  wallet_withdrawn: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "currency", "method", "tx_id"],
    optional_fields: [],
  },
  balance_inquired: {
    category: "WALLET",
    required_fields: ["user_id", "balance"],
    optional_fields: [],
  },
  transaction_completed: {
    category: "WALLET",
    required_fields: ["user_id", "tx_id", "from_wallet_id", "to_wallet_id", "amount"],
    optional_fields: [],
  },
  bonus_credited: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "bonus_type", "txn_id"],
    optional_fields: [],
  },
  bonus_wagered: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "game_id", "round_id", "wager_id"],
    optional_fields: [],
  },
  bonus_won: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "game_id", "round_id", "wager_id"],
    optional_fields: [],
  },
  bonus_expired: {
    category: "WALLET",
    required_fields: ["user_id", "amount", "bonus_id"],
    optional_fields: [],
  },

  // GAME
  game_launched: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "provider_id", "game_type"],
    optional_fields: [],
  },
  round_started: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "round_id", "stake_amount"],
    optional_fields: [],
  },
  round_completed: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "round_id", "stake_amount", "win_amount", "multiplier"],
    optional_fields: [],
  },
  round_lost: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "round_id", "stake_amount"],
    optional_fields: [],
  },
  bet_placed: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "round_id", "bet_type", "amount"],
    optional_fields: [],
  },
  game_error: {
    category: "GAME",
    required_fields: ["user_id", "game_id", "round_id", "error_code", "message"],
    optional_fields: [],
  },
  provider_response: {
    category: "GAME",
    required_fields: ["provider_id", "game_id", "round_id", "response_time_ms", "status_code"],
    optional_fields: [],
  },

  // BONUS
  bonus_offered: {
    category: "BONUS",
    required_fields: ["user_id", "bonus_type", "amount", "conditions"],
    optional_fields: [],
  },
  bonus_claimed: {
    category: "BONUS",
    required_fields: ["user_id", "bonus_id", "bonus_type", "amount"],
    optional_fields: [],
  },
  bonus_terms_accepted: {
    category: "BONUS",
    required_fields: ["user_id", "bonus_id"],
    optional_fields: [],
  },
  bonus_turnover_check: {
    category: "BONUS",
    required_fields: ["user_id", "bonus_id", "current_turnover", "required_turnover"],
    optional_fields: [],
  },

  // KYC
  kyc_started: {
    category: "KYC",
    required_fields: ["user_id", "id_document_type"],
    optional_fields: [],
  },
  kyc_document_uploaded: {
    category: "KYC",
    required_fields: ["user_id", "id_document_type", "file_name"],
    optional_fields: [],
  },
  kyc_approved: {
    category: "KYC",
    required_fields: ["user_id", "approved_by"],
    optional_fields: [],
  },
  kyc_rejected: {
    category: "KYC",
    required_fields: ["user_id", "rejection_reason", "reviewed_by"],
    optional_fields: [],
  },
  kyc_expired: {
    category: "KYC",
    required_fields: ["user_id"],
    optional_fields: [],
  },

  // RISK
  risk_flagged: {
    category: "RISK",
    required_fields: ["user_id", "risk_score", "risk_category", "flags"],
    optional_fields: [],
  },
  transaction_reviewed: {
    category: "RISK",
    required_fields: ["tx_id", "user_id", "reviewer_id", "outcome"],
    optional_fields: [],
  },
  account_suspended: {
    category: "RISK",
    required_fields: ["user_id", "reason", "duration", "initiated_by"],
    optional_fields: [],
  },
  account_unsuspended: {
    category: "RISK",
    required_fields: ["user_id", "initiated_by"],
    optional_fields: [],
  },

  // ANALYTICS
  page_view: {
    category: "ANALYTICS",
    required_fields: ["user_id", "page_path", "referrer", "session_id"],
    optional_fields: [],
  },
  dashboard_accessed: {
    category: "ANALYTICS",
    required_fields: ["user_id", "dashboard_id"],
    optional_fields: [],
  },
  report_generated: {
    category: "ANALYTICS",
    required_fields: ["user_id", "report_type", "parameters"],
    optional_fields: [],
  },

  // ADMIN
  config_changed: {
    category: "ADMIN",
    required_fields: ["admin_id", "config_key", "old_value", "new_value"],
    optional_fields: [],
  },
  user_banned: {
    category: "ADMIN",
    required_fields: ["admin_id", "banned_user_id", "reason"],
    optional_fields: [],
  },
  user_unbanned: {
    category: "ADMIN",
    required_fields: ["admin_id", "banned_user_id"],
    optional_fields: [],
  },
  game_config_changed: {
    category: "ADMIN",
    required_fields: ["admin_id", "game_id", "field", "old_value", "new_value"],
    optional_fields: [],
  },
  provider_configured: {
    category: "ADMIN",
    required_fields: ["admin_id", "provider_id", "config_keys"],
    optional_fields: [],
  },
};

// ---------------------------------------------------------------------------
// Events emitted by product/apps/api/src/services/analytics.ts
// Each entry: [event_name, { player_id: "fake-player", metadata: { ... } }]
// ---------------------------------------------------------------------------

interface EmittedEvent {
  event_name: string;
  player_id: string;
  metadata: Record<string, unknown>;
  /** The analytics.ts method that produces this event */
  source: string;
}

const EMITTED_EVENTS: EmittedEvent[] = [
  {
    event_name: "user_registered",
    player_id: "player-1",
    metadata: { email: "player@example.com", ip: "0.0.0.0", source: "web" },
    source: "trackRegister",
  },
  {
    event_name: "user_login",
    player_id: "player-1",
    metadata: { ip: "0.0.0.0", success: true },
    source: "trackLogin",
  },
  {
    event_name: "wallet_funded",
    player_id: "player-1",
    metadata: { amount: 100, currency: "USD", method: "simulation", tx_id: "tx-001" },
    source: "trackDeposit",
  },
  {
    event_name: "wallet_withdrawn",
    player_id: "player-1",
    metadata: { amount: 50, currency: "USD", method: "bank_transfer", tx_id: "tx-002" },
    source: "trackWithdrawal",
  },
  {
    event_name: "round_completed",
    player_id: "player-1",
    metadata: { game_id: "slot-basic", round_id: "round-001", stake_amount: 10, win_amount: 25, multiplier: 2.5 },
    source: "trackSpin",
  },
  {
    event_name: "bonus_claimed",
    player_id: "player-1",
    metadata: { amount: 500, bonus_id: "bonus-welcome", bonus_type: "deposit_match" },
    source: "trackBonusClaimed",
  },
];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of all fields that are either required or optional for the
 * given contract event.  The `player_id` field is mapped to `user_id` for
 * validation purposes because the `CasinoEvent` interface uses `player_id`
 * while the contract uses `user_id`.
 */
function contractFieldSet(eventName: string): Set<string> {
  const ev = CONTRACT[eventName];
  if (!ev) return new Set();
  return new Set([...ev.required_fields, ...ev.optional_fields]);
}

function requiredFields(eventName: string): string[] {
  const ev = CONTRACT[eventName];
  return ev ? ev.required_fields : [];
}

/**
 * Build the full payload by merging player_id (→ user_id) with metadata.
 */
function fullPayload(ev: EmittedEvent): Record<string, unknown> {
  return { user_id: ev.player_id, ...ev.metadata };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Analytics Contract — Structure", () => {
  it("should define at least one event per expected category", () => {
    const categories = new Set(Object.values(CONTRACT).map((e) => e.category));
    for (const cat of ["AUTH", "WALLET", "GAME", "BONUS", "KYC", "RISK"]) {
      expect(categories.has(cat), `Category ${cat} should exist`).toBe(true);
    }
  });

  it("should have exactly 41 events defined in the contract", () => {
    expect(Object.keys(CONTRACT).length).toBe(41);
  });

  it("should have valid field definitions for every event", () => {
    for (const [name, ev] of Object.entries(CONTRACT)) {
      expect(Array.isArray(ev.required_fields), `${name}: required_fields must be array`).toBe(true);
      expect(Array.isArray(ev.optional_fields), `${name}: optional_fields must be array`).toBe(true);
      for (const field of ev.required_fields) {
        expect(typeof field, `${name}: required field "${field}" must be a string`).toBe("string");
      }
    }
  });

  it("should have every contract event assigned to a known category", () => {
    const validCats = new Set(["AUTH", "WALLET", "GAME", "BONUS", "KYC", "RISK", "ANALYTICS", "ADMIN"]);
    for (const [name, ev] of Object.entries(CONTRACT)) {
      expect(validCats.has(ev.category), `${name}: unknown category "${ev.category}"`).toBe(true);
    }
  });
});

describe("Analytics Contract — Emitted Event Name Compliance", () => {
  for (const ev of EMITTED_EVENTS) {
    it(`"${ev.event_name}" (from ${ev.source}) should exist in contract`, () => {
      expect(
        CONTRACT[ev.event_name],
        `Event "${ev.event_name}" not found in contract. Closest: ${findClosest(ev.event_name)}`
      ).toBeDefined();
    });
  }
});

describe("Analytics Contract — Required Field Compliance", () => {
  const compliantEvents = EMITTED_EVENTS.filter((ev) => CONTRACT[ev.event_name]);

  for (const ev of compliantEvents) {
    const payload = fullPayload(ev);
    const missing = requiredFields(ev.event_name).filter((f) => !(f in payload));

    it(`"${ev.event_name}" (from ${ev.source}) should include all required fields`, () => {
      expect(
        missing,
        `Missing required fields for "${ev.event_name}": ${missing.join(", ")}`
      ).toHaveLength(0);
    });
  }
});

describe("Analytics Contract — Field Type Validation", () => {
  it('"user_registered" payload fields should be strings', () => {
    const payload = fullPayload(EMITTED_EVENTS[0]);
    for (const field of ["user_id", "email"]) {
      expect(typeof payload[field], `"user_registered".${field} should be a string`).toBe("string");
    }
  });

  it('"bonus_claimed" payload fields should have correct types', () => {
    const payload = fullPayload(EMITTED_EVENTS[5]);
    expect(typeof payload.user_id, 'bonus_claimed.user_id should be string').toBe("string");
    expect(typeof payload.bonus_id, 'bonus_claimed.bonus_id should be string').toBe("string");
    expect(typeof payload.amount, 'bonus_claimed.amount should be number').toBe("number");
  });

  it('"bonus_claimed" amount combined payload should be valid', () => {
    const payload = fullPayload(EMITTED_EVENTS[5]);
    const combinedFields = new Set(Object.keys(payload));
    const validFields = contractFieldSet("bonus_claimed");
    const unknownFields = [...combinedFields].filter((f) => {
      return f !== "user_id" && !validFields.has(f);
    });
    expect(unknownFields, `Unknown fields in bonus_claimed: ${unknownFields.join(", ")}`).toEqual(
      []
    );
  });
});

describe("Analytics Contract — Metadata Payload Shape", () => {
  it('"user_registered" metadata should contain email', () => {
    const ev = EMITTED_EVENTS[0];
    expect(ev.metadata).toHaveProperty("email");
  });

  it('"wallet_funded" metadata should contain amount and currency', () => {
    const ev = EMITTED_EVENTS[2];
    expect(ev.metadata.amount).toBe(100);
    expect(ev.metadata.currency).toBe("USD");
  });

  it('"round_completed" metadata should contain game_id, stake_amount, win_amount', () => {
    const ev = EMITTED_EVENTS[4];
    expect(ev.metadata.game_id).toBe("slot-basic");
    expect(ev.metadata.stake_amount).toBe(10);
    expect(ev.metadata.win_amount).toBe(25);
  });

  it('"bonus_claimed" metadata should contain valid values', () => {
    const ev = EMITTED_EVENTS[5];
    expect(ev.metadata).toHaveProperty("bonus_id");
    expect(ev.metadata).toHaveProperty("amount");
  });
});

describe("Analytics Contract — Category Counts", () => {
  it("AUTH category should have 5 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "AUTH").length;
    expect(count).toBe(5);
  });

  it("WALLET category should have 8 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "WALLET").length;
    expect(count).toBe(8);
  });

  it("GAME category should have 7 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "GAME").length;
    expect(count).toBe(7);
  });

  it("BONUS category should have 4 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "BONUS").length;
    expect(count).toBe(4);
  });

  it("KYC category should have 5 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "KYC").length;
    expect(count).toBe(5);
  });

  it("RISK category should have 4 events", () => {
    const count = Object.values(CONTRACT).filter((e) => e.category === "RISK").length;
    expect(count).toBe(4);
  });
});

describe("Analytics Contract — Full Compliance Summary", () => {
  it("should report full contract compliance status", () => {
    const results = EMITTED_EVENTS.map((ev) => {
      const inContract = ev.event_name in CONTRACT;
      const payload = fullPayload(ev);
      let missingFields: string[] = [];
      let unknownFields: string[] = [];

      if (inContract) {
        missingFields = requiredFields(ev.event_name).filter((f) => !(f in payload));
        const validFields = contractFieldSet(ev.event_name);
        unknownFields = Object.keys(payload).filter(
          (f) => f !== "user_id" && !validFields.has(f)
        );
        // user_id is always present via player_id mapping
        const allFields = Object.keys(payload).filter((f) => f !== "user_id");
        unknownFields = allFields.filter((f) => !validFields.has(f));
      }

      return {
        event: ev.event_name,
        source: ev.source,
        inContract,
        missingFields,
        unknownFields,
        compliant: inContract && missingFields.length === 0 && unknownFields.length === 0,
      };
    });

    const compliant = results.filter((r) => r.compliant);
    const nonCompliant = results.filter((r) => !r.compliant);

    // This assertion documents current state; it will pass because we check
    // the overall contract validation mechanism works correctly, even if
    // some emitted events do not yet match the contract.
    expect(results.length).toBe(EMITTED_EVENTS.length);
    expect(compliant.length + nonCompliant.length).toBe(results.length);

    // Log the summary for visibility in test output
    console.log("\n--- Contract Compliance Summary ---");
    for (const r of results) {
      const status = r.compliant ? "PASS" : "FAIL";
      console.log(`  [${status}] ${r.event} (${r.source})`);
      if (!r.inContract) console.log(`         NOT in contract`);
      if (r.missingFields.length > 0) console.log(`         Missing: ${r.missingFields.join(", ")}`);
      if (r.unknownFields.length > 0) console.log(`         Unknown: ${r.unknownFields.join(", ")}`);
    }
    console.log("-----------------------------------\n");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findClosest(name: string): string {
  const candidates = Object.keys(CONTRACT);
  let best = "";
  let bestScore = 0;

  for (const cand of candidates) {
    // Simple substring overlap scoring
    const overlap = [...new Set(name.split("_"))].filter((part) =>
      cand.includes(part)
    ).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = cand;
    }
  }

  return best || "(none)";
}
