import { expect, it } from "vitest";
import { CreditWallet, walletConfigurationErrors } from "./credit-wallet.entity.js";
function wallet(balance = 3) {
  return CreditWallet.reconstitute({ id: "w", userId: "u", balance, isUnlimited: false, planType: "MONTHLY",
    startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), updatedAt: new Date() });
}
it("rejects a withdrawal above the actual balance without clamping or changing it", () => {
  const account = wallet();
  expect(() => account.applyManualAdjustment(-10)).toThrow(/negativo/);
  expect(account.balance).toBe(3);
});
it("debits only successful generation orchestration and never allows a negative balance", () => {
  const account = wallet(1);
  account.debitForSessionGeneration();
  expect(account.balance).toBe(0);
  expect(() => account.debitForSessionGeneration()).toThrow();
  expect(account.balance).toBe(0);
});
it("requires a coherent unlimited plan and leaves its stored balance intact", () => {
  const account = wallet(0);
  expect(() => account.applyManualAdjustment(0, "LIFETIME_FREE", null, false)).toThrow();
  account.applyManualAdjustment(0, "LIFETIME_FREE", null, true);
  account.debitForSessionGeneration();
  expect(account.balance).toBe(0);
  expect(account.canGenerateSession()).toBe(true);
});
it("requires explicit expiry for administrable temporary plans and preserves historical BIMONTHLY reads", () => {
  for (const planType of ["TRIAL", "MONTHLY", "QUARTERLY", "ANNUAL"] as const) {
    expect(walletConfigurationErrors({ balance: 0, planType, isUnlimited: false, expiresAt: null })).not.toHaveLength(0);
    expect(walletConfigurationErrors({ balance: 0, planType, isUnlimited: false, expiresAt: new Date(0) })).toHaveLength(0);
  }
  expect(walletConfigurationErrors({ balance: 0, planType: "BIMONTHLY", isUnlimited: false, expiresAt: null })).toHaveLength(0);
});
