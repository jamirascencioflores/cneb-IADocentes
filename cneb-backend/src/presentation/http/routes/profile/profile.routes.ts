import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { KyselyInstitutionalProfileRepository } from "../../../../modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.js";
import { InstitutionalProfile } from "../../../../modules/identity/domain/institutional-profile.entity.js";
import { authenticate } from "../../../middlewares/auth-guard.js";

interface ProfileBodyRequest {
  teacher_full_name: string;
  specialty: string;
  school_name: string;
  ugel: string;
  dre?: string;
  principal_name?: string | null;
  badge_url?: string | null;
  signature_url?: string | null;
}

export const profileRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  const repository = new KyselyInstitutionalProfileRepository(db);

  // Hook global del plugin para proteger todas las rutas del perfil
  fastify.addHook("onRequest", authenticate);

  // GET /api/v1/profile/institutional
  fastify.get("/institutional", async (request, reply) => {
    const userPayload = request.user as unknown as {
      userId?: string;
      id?: string;
      sub?: string;
    };
    const userId = userPayload.userId ?? userPayload.id ?? userPayload.sub;

    if (!userId) {
      return reply.status(401).send({
        type: "https://api.tudominio.pe/errors/unauthorized",
        title: "No autorizado",
        status: 401,
        detail: "Identificador de usuario no encontrado en el token.",
      });
    }

    const profile = await repository.findByUserId(userId);

    if (!profile) {
      return reply.status(404).send({
        type: "https://api.tudominio.pe/errors/not-found",
        title: "Perfil no encontrado",
        status: 404,
        detail: "El docente aún no ha registrado los datos de su I.E.",
      });
    }

    return reply.status(200).send({
      id: profile.id,
      user_id: profile.userId,
      teacher_full_name: profile.teacherFullName,
      specialty: profile.specialty,
      school_name: profile.schoolName,
      ugel: profile.ugel,
      dre: profile.dre,
      principal_name: profile.principalName,
      badge_url: profile.badgeUrl,
      signature_url: profile.signatureUrl,
      is_default: profile.isDefault,
    });
  });

  // PUT /api/v1/profile/institutional
  fastify.put<{ Body: ProfileBodyRequest }>(
    "/institutional",
    async (request, reply) => {
      const userPayload = request.user as unknown as {
        userId?: string;
        id?: string;
        sub?: string;
      };
      const userId = userPayload.userId ?? userPayload.id ?? userPayload.sub;

      if (!userId) {
        return reply.status(401).send({
          type: "https://api.tudominio.pe/errors/unauthorized",
          title: "No autorizado",
          status: 401,
          detail: "Identificador de usuario no encontrado en el token.",
        });
      }

      const body = request.body;

      const profile = InstitutionalProfile.create({
        userId,
        teacherFullName: body.teacher_full_name,
        specialty: body.specialty,
        schoolName: body.school_name,
        ugel: body.ugel,
        dre: body.dre ?? "DRELM",
        principalName: body.principal_name ?? null,
        badgeUrl: body.badge_url ?? null,
        signatureUrl: body.signature_url ?? null,
      });

      await repository.upsert(profile);

      return reply.status(200).send({
        message: "Perfil institucional actualizado correctamente",
      });
    },
  );
};
