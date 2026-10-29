import { db } from "../../../../infrastructure/database/database.js";
import { env } from "../../../../config/env.js";
import { AuthSessionService } from "../../application/auth-session.service.js";
import { Argon2HashService } from "./hash.service.js";
import { JwtTokenService } from "./token.service.js";

export const authSessions = new AuthSessionService(
  db, new JwtTokenService(), new Argon2HashService(), env.JWT_REFRESH_EXPIRATION_IN_DAYS,
);
