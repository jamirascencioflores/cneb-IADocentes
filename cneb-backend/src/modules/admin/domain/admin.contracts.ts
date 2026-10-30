import { z } from "zod";

export const adminPlans = ["TRIAL", "MONTHLY", "QUARTERLY", "ANNUAL", "LIFETIME_FREE"] as const;
export const reasonSchema = z.string().trim().min(3).max(255)
  .refine((value) => !/(?:Bearer\s|eyJ[\w-]*\.[\w-]+\.[\w-]+|\$argon2)/i.test(value), "El motivo no debe contener credenciales.");
export const temporaryPasswordSchema = z.string().min(12).max(256);
const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalUrl = z.string().trim().max(2048).url()
  .refine((value) => { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; })
  .nullable().default(null);
export const adminProfileSchema = z.object({
  teacherFullName: text(150), specialty: text(100), schoolName: text(200),
  ugel: text(50), dre: text(100), principalName: text(150).nullable().default(null),
  badgeUrl: optionalUrl, signatureUrl: optionalUrl,
}).strict();
export const adminSubscriptionSchema = z.object({
  planType: z.enum(adminPlans), isUnlimited: z.boolean(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, ctx) => {
  const lifetime = value.planType === "LIFETIME_FREE";
  if (value.isUnlimited !== lifetime || (lifetime ? value.expiresAt !== null : value.expiresAt === null)) {
    ctx.addIssue({ code: "custom", message: "El plan, la condición ilimitada y el vencimiento deben ser coherentes." });
  }
});
export const createTeacherSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).email(),
  temporaryPassword: temporaryPasswordSchema.optional(), profile: adminProfileSchema,
  subscription: adminSubscriptionSchema,
  initialCredits: z.number().int().min(0).max(2147483647), reason: reasonSchema,
}).strict();
export type CreateTeacherDTO = z.infer<typeof createTeacherSchema>;
export type AdminPlan = typeof adminPlans[number];
export interface AdminActor { userId: string; sessionId: string; tokenVersion: number; }
export interface AdminContext { actor: AdminActor; requestId: string; }
export interface TeacherPublicData {
  user: { id: string; email: string; role: "TEACHER"; isActive: true; mustChangePassword: true };
  profile: z.infer<typeof adminProfileSchema> & { id: string; userId: string };
  wallet: { id: string; userId: string; balance: number; planType: AdminPlan; isUnlimited: boolean; expiresAt: string | null };
}
export interface CreateTeacherResult extends TeacherPublicData { temporaryPassword: string; }
export interface AdminAuditEvent {
  id: string; actorUserId: string; actorRole: "SUPERADMIN";
  action: "TEACHER_CREATED"; entityType: "TEACHER"; entityId: string;
  reason: string; beforeData: null; afterData: TeacherPublicData; requestId: string;
}
export interface InitialCreditMovement {
  id: string; walletId: string; actorUserId: string; auditEventId: string;
  amount: number; balanceBefore: 0; balanceAfter: number;
  planType: AdminPlan; isUnlimited: boolean; expiresAt: string | null; reason: string;
}
export interface IAdminTeacherRepository {
  insertUser(user: TeacherPublicData["user"], passwordHash: string): Promise<void>;
  insertProfile(profile: TeacherPublicData["profile"]): Promise<void>;
  insertWallet(wallet: TeacherPublicData["wallet"]): Promise<void>;
  recordInitialCredits(movement: InitialCreditMovement): Promise<void>;
}
export interface IAdminAuditRepository { append(event: AdminAuditEvent): Promise<void>; }
export interface AdminTransaction {
  assertSuperadmin(actor: AdminActor): Promise<void>;
  teachers: IAdminTeacherRepository;
  audit: IAdminAuditRepository;
}
export interface IAdminUnitOfWork {
  execute<T>(operation: (transaction: AdminTransaction) => Promise<T>): Promise<T>;
}
