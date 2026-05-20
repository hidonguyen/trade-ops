// Smoke tests for Contact validation + prefill hook key invariants.
import { describe, it, expect } from "vitest";
import { createContactSchema, createPartySchema } from "@/lib/validation-schemas";
import { PREFILL_KEYS } from "@/lib/use-prefill";

describe("createContactSchema", () => {
  it("accepts a minimum payload (name only)", () => {
    const r = createContactSchema.safeParse({ name: "Nguyễn A" });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = createContactSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });

  it("accepts a full Vietnamese-style payload", () => {
    const r = createContactSchema.safeParse({
      name: "Trần B",
      phone: "0912345678",
      email: "b@example.com",
      taxId: "8123456789-001",
      address: "123 Đường ABC",
      notes: "Khách quen",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed phone", () => {
    const r = createContactSchema.safeParse({ name: "X", phone: "abc-xyz" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = createContactSchema.safeParse({ name: "X", email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("allows empty strings on optional fields (UI sends '' for blank inputs)", () => {
    const r = createContactSchema.safeParse({ name: "X", phone: "", email: "", taxId: "" });
    expect(r.success).toBe(true);
  });
});

describe("createPartySchema multi-BU", () => {
  const baseParty = {
    name: "Công ty X",
    type: "CUSTOMER" as const,
    businessUnitId: "00000000-0000-0000-0000-000000000001",
  };

  it("accepts party without businessUnitIds (will be backfilled by server)", () => {
    const r = createPartySchema.safeParse(baseParty);
    expect(r.success).toBe(true);
  });

  it("accepts party with explicit businessUnitIds", () => {
    const r = createPartySchema.safeParse({
      ...baseParty,
      businessUnitIds: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-uuid in businessUnitIds", () => {
    const r = createPartySchema.safeParse({ ...baseParty, businessUnitIds: ["not-a-uuid"] });
    expect(r.success).toBe(false);
  });
});

describe("PREFILL_KEYS", () => {
  it("namespaces keys to avoid collisions with other sessionStorage users", () => {
    expect(PREFILL_KEYS.order).toMatch(/trade-ops:prefill:order/);
    expect(PREFILL_KEYS.transaction).toMatch(/trade-ops:prefill:transaction/);
    expect(PREFILL_KEYS.order).not.toBe(PREFILL_KEYS.transaction);
  });
});
