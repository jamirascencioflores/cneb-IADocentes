import { Kysely } from "kysely";
import { DatabaseSchema } from "../../../../infrastructure/database/types.js";
import { IInstitutionalProfileRepository } from "../../domain/user.repository.interface.js";
import { InstitutionalProfile } from "../../domain/institutional-profile.entity.js";

export class KyselyInstitutionalProfileRepository implements IInstitutionalProfileRepository {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  public async findByUserId(
    userId: string,
  ): Promise<InstitutionalProfile | null> {
    const row = await this.db
      .selectFrom("institutional_profiles")
      .selectAll()
      .where("user_id", "=", userId)
      .where("is_default", "=", true)
      .executeTakeFirst();

    if (!row) return null;

    return InstitutionalProfile.reconstitute({
      id: row.id,
      userId: row.user_id,
      teacherFullName: row.teacher_full_name,
      specialty: row.specialty,
      schoolName: row.school_name,
      ugel: row.ugel,
      dre: row.dre,
      principalName: row.principal_name,
      badgeUrl: row.badge_url,
      signatureUrl: row.signature_url,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
  }

  public async upsert(profile: InstitutionalProfile): Promise<void> {
    const existing = await this.findByUserId(profile.userId);

    if (existing) {
      // Actualizar registro existente
      await this.db
        .updateTable("institutional_profiles")
        .set({
          teacher_full_name: profile.teacherFullName,
          specialty: profile.specialty, // ✅ Corregido: toma la especialidad real
          school_name: profile.schoolName,
          ugel: profile.ugel,
          dre: profile.dre,
          principal_name: profile.principalName,
          badge_url: profile.badgeUrl,
          signature_url: profile.signatureUrl,
        })
        .where("id", "=", existing.id)
        .execute();
      return;
    }

    // Insertar nuevo registro
    await this.db
      .insertInto("institutional_profiles")
      .values({
        id: profile.id,
        user_id: profile.userId,
        teacher_full_name: profile.teacherFullName,
        specialty: profile.specialty, // ✅ Corregido
        school_name: profile.schoolName,
        ugel: profile.ugel,
        dre: profile.dre,
        principal_name: profile.principalName,
        badge_url: profile.badgeUrl,
        signature_url: profile.signatureUrl,
        is_default: true,
      })
      .execute();
  }
}
