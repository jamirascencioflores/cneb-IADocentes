import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../../infrastructure/database/types.js";
import { IUserRepository } from "../../domain/user.repository.interface.js";
import { User } from "../../domain/user.entity.js";

export class KyselyUserRepository implements IUserRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  public async findById(id: string): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return null;

    return User.reconstitute({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      tokenVersion: row.token_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email.toLowerCase().trim())
      .executeTakeFirst();

    if (!row) return null;

    return User.reconstitute({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      tokenVersion: row.token_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  public async create(user: User): Promise<void> {
    await this.db
      .insertInto("users")
      .values({
        id: user.id,
        email: user.email.toLowerCase().trim(),
        password_hash: user.passwordHash,
        role: user.role,
        is_active: user.isActive,
        must_change_password: user.mustChangePassword,
        token_version: user.tokenVersion,
      })
      .execute();
  }

  public async update(user: User): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        email: user.email.toLowerCase().trim(),
        password_hash: user.passwordHash,
        role: user.role,
        is_active: user.isActive,
        must_change_password: user.mustChangePassword,
        token_version: user.tokenVersion,
        updated_at: new Date(),
      })
      .where("id", "=", user.id)
      .execute();
  }
}
