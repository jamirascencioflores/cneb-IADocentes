import crypto from "node:crypto";
import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../infrastructure/database/types.js";
import { ConflictError } from "../../../core/errors/app-error.js";
import { IUserRepository } from "../domain/user.repository.interface.js";
import { User } from "../domain/user.entity.js";
import { IHashService } from "../infrastructure/security/hash.service.js";

export interface RegisterTeacherDTO {
  email: string;
  password: string;
}

export interface RegisterTeacherOutput {
  id: string;
  email: string;
  role: string;
}

export class RegisterTeacherUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly db: Kysely<DatabaseSchema>,
  ) {}

  public async execute(
    dto: RegisterTeacherDTO,
  ): Promise<RegisterTeacherOutput> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictError("El correo electrónico ya está registrado.");
    }

    const passwordHash = await this.hashService.hash(dto.password);
    const userId = crypto.randomUUID();

    const newUser = User.reconstitute({
      id: userId,
      email: dto.email,
      passwordHash,
      role: "TEACHER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Transacción atómica: Usuario + Wallet TRIAL
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("users")
        .values({
          id: newUser.id,
          email: newUser.email.toLowerCase().trim(),
          password_hash: newUser.passwordHash,
          role: newUser.role,
          is_active: newUser.isActive,
        })
        .execute();

      // Expira en 7 días con 5 créditos de bienvenida para TRIAL
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);

      await trx
        .insertInto("credit_wallets")
        .values({
          id: crypto.randomUUID(),
          user_id: newUser.id,
          balance: 5,
          is_unlimited: false,
          plan_type: "TRIAL",
          expires_at: trialExpiresAt,
        })
        .execute();
    });

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
  }
}
