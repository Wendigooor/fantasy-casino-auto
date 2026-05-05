import { describe, it, expect } from "vitest";
import { CURRENCY_CODES } from "../src/money.js";

describe("domain", () => {
  it("should export currency constants", () => {
    expect(CURRENCY_CODES).toContain("USD");
    expect(CURRENCY_CODES).toContain("EUR");
  });
});
