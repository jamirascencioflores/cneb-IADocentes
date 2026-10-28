import jwt from "jsonwebtoken";
import { env } from "../../../../config/env.js";
import { UserRole } from "../../domain/user.entity.js";

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface ITokenService {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
}

export class JwtTokenService implements ITokenService {
  public generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: `${env.JWT_ACCESS_EXPIRATION_IN_MINUTES}m`,
    });
  }

  public generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: `${env.JWT_REFRESH_EXPIRATION_IN_DAYS}d`,
    });
  }

  public verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  }

  public verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  }
}
