import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { db } from "../../../../infrastructure/database/database.js";
import { KyselyInstitutionalProfileRepository } from "../../../../modules/identity/infrastructure/repositories/kysely-institutional-profile.repository.js";
import { authenticate } from "../../../middlewares/auth-guard.js";

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
        detail: "La cuenta debe ser configurada por el administrador con los datos institucionales del docente.",
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
};
