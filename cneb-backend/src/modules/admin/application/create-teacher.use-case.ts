import { randomUUID } from "node:crypto";
import { ConflictError, ValidationError } from "../../../core/errors/app-error.js";
import { TemporaryCredentialService } from "../../identity/application/temporary-credential.service.js";
import { createTeacherSchema, type AdminContext, type CreateTeacherDTO, type CreateTeacherResult,
  type IAdminUnitOfWork, type TeacherPublicData } from "../domain/admin.contracts.js";

export class CreateTeacherUseCase {
  constructor(private readonly work: IAdminUnitOfWork, private readonly credentials: TemporaryCredentialService) {}

  async execute(input: CreateTeacherDTO, context: AdminContext): Promise<CreateTeacherResult> {
    const dto = createTeacherSchema.parse(input);
    const { temporaryPassword, passwordHash } = await this.credentials.create(dto.temporaryPassword);
    // Free text must not copy the known credential into public data or audit records.
    const publicInput = JSON.stringify({ email: dto.email, profile: dto.profile, reason: dto.reason });
    if ([temporaryPassword, passwordHash].some((secret) => publicInput.includes(JSON.stringify(secret).slice(1, -1))))
      throw new ValidationError("Los datos administrativos no deben contener credenciales.");
    const userId = randomUUID(), auditId = randomUUID();
    const data: TeacherPublicData = {
      user: { id: userId, email: dto.email, role: "TEACHER", isActive: true, mustChangePassword: true },
      profile: { ...dto.profile, id: randomUUID(), userId },
      wallet: { id: randomUUID(), userId, balance: dto.initialCredits, ...dto.subscription },
    };
    try {
      await this.work.execute(async (tx) => {
        await tx.assertSuperadmin(context.actor);
        await tx.teachers.insertUser(data.user, passwordHash);
        await tx.teachers.insertProfile(data.profile);
        await tx.teachers.insertWallet(data.wallet);
        await tx.audit.append({ id: auditId, actorUserId: context.actor.userId, actorRole: "SUPERADMIN",
          action: "TEACHER_CREATED", entityType: "TEACHER", entityId: userId,
          reason: dto.reason, beforeData: null, afterData: data, requestId: context.requestId });
        if (dto.initialCredits > 0) {
          await tx.teachers.recordInitialCredits({ id: randomUUID(), walletId: data.wallet.id,
            actorUserId: context.actor.userId, auditEventId: auditId, amount: dto.initialCredits,
            balanceBefore: 0, balanceAfter: dto.initialCredits, ...dto.subscription, reason: dto.reason });
        }
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505"
        && "constraint" in error && ["users_email_key", "uq_users_normalized_email"].includes(String(error.constraint)))
        throw new ConflictError("El correo ya está registrado.");
      throw error;
    }
    return { ...data, temporaryPassword };
  }
}
