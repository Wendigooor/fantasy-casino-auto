import { describe, it, expect, beforeEach } from "vitest";
import { getEnv, getEnvInt, getEnvBool, config } from "../src/index.js";

beforeEach(() => {
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_PORT;
  delete process.env.JWT_SECRET;
  delete process.env.NODE_ENV;
  delete process.env.CUSTOM_VAR;
});

describe("Config — Env Helpers", () => {
  it("should return env value", () => {
    process.env.CUSTOM_VAR = "hello";
    expect(getEnv("CUSTOM_VAR")).toBe("hello");
  });

  it("should return fallback when env not set", () => {
    expect(getEnv("NONEXISTENT", "default")).toBe("default");
  });

  it("should parse int env", () => {
    process.env.POSTGRES_PORT = "5432";
    expect(getEnvInt("POSTGRES_PORT", 0)).toBe(5432);
  });

  it("should return fallback for invalid int", () => {
    process.env.POSTGRES_PORT = "not-a-number";
    expect(getEnvInt("POSTGRES_PORT", 7777)).toBe(7777);
  });

  it("should parse bool env", () => {
    process.env.NODE_ENV = "true";
    expect(getEnvBool("NODE_ENV", false)).toBe(true);
  });

  it("should have config object with defaults", () => {
    expect(config.db.host).toBe("localhost");
    expect(config.api.port).toBe(3001);
    expect(config.isTest).toBe(true);
  });
});
