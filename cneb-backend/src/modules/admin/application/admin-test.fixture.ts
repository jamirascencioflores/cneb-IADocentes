import type { AdminAuditEvent, AdminContext, AdminTransaction, CreateTeacherDTO, IAdminUnitOfWork,
  InitialCreditMovement, TeacherPublicData } from "../domain/admin.contracts.js";

export const adminContext: AdminContext = {
  actor: { userId: "10000000-0000-4000-8000-000000000001", sessionId: "10000000-0000-4000-8000-000000000002", tokenVersion: 2 },
  requestId: "req-test",
};
export function teacherInput(): CreateTeacherDTO {
  return { email: "teacher@example.invalid", profile: { teacherFullName: "Docente de prueba", specialty: "Comunicación",
    schoolName: "Institución de prueba", ugel: "UGEL prueba", dre: "DRE prueba", principalName: null, badgeUrl: null, signatureUrl: null },
    subscription: { planType: "MONTHLY", isUnlimited: false, expiresAt: "2030-11-01T00:00:00-05:00" },
    initialCredits: 4, reason: "Alta de prueba" };
}
interface MemoryState {
  users: (TeacherPublicData["user"] & { passwordHash: string })[];
  profiles: TeacherPublicData["profile"][]; wallets: TeacherPublicData["wallet"][];
  movements: InitialCreditMovement[]; audit: AdminAuditEvent[];
}
// A transaction double with staged state; no SQL, environment files or connections.
export class MemoryAdminUnitOfWork implements IAdminUnitOfWork {
  state: MemoryState = { users: [], profiles: [], wallets: [], movements: [], audit: [] };
  failure: "user" | "profile" | "wallet" | "movement" | "audit" | "commit" | undefined;
  authorizationError: Error | undefined;
  actor: AdminContext["actor"] | undefined;
  commits = 0;
  rollbacks = 0;
  async execute<T>(operation: (transaction: AdminTransaction) => Promise<T>): Promise<T> {
    const staged = structuredClone(this.state);
    const fail = (step: typeof this.failure) => { if (step === this.failure) throw new Error("simulated transaction failure"); };
    try {
      const result = await operation({
        assertSuperadmin: async (actor) => { this.actor = actor; if (this.authorizationError) throw this.authorizationError; },
        teachers: {
          insertUser: async (user, passwordHash) => {
            fail("user");
            if (staged.users.some((row) => row.email === user.email))
              throw Object.assign(new Error("unsafe database detail"), { code: "23505", constraint: "uq_users_normalized_email" });
            staged.users.push({ ...user, passwordHash });
          },
          insertProfile: async (profile) => { fail("profile"); staged.profiles.push(profile); },
          insertWallet: async (wallet) => { fail("wallet"); staged.wallets.push(wallet); },
          recordInitialCredits: async (movement) => { fail("movement"); staged.movements.push(movement); },
        },
        audit: { append: async (event) => { fail("audit"); staged.audit.push(event); } },
      });
      fail("commit");
      this.state = staged; this.commits++;
      return result;
    } catch (error) { this.rollbacks++; throw error; }
  }
}
