import { httpClient } from "@/shared/lib/http-client";
import { LoginCredentials, LoginResponseDto } from "../domain/auth.types";

export interface IAuthRepository {
  login(credentials: LoginCredentials): Promise<LoginResponseDto>;
  logout(): void;
  isAuthenticated(): boolean;
}

export class HttpAuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<LoginResponseDto> {
    const response = await httpClient.post<LoginResponseDto>(
      "/auth/login",
      credentials,
    );
    const data = response.data;

    const token = data.accessToken ?? data.access_token ?? data.token;

    if (!token) {
      throw new Error("No se recibió un token de acceso válido del servidor.");
    }

    localStorage.setItem("cneb_access_token", token);
    return data;
  }

  logout(): void {
    localStorage.removeItem("cneb_access_token");
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem("cneb_access_token");
    return Boolean(token && token !== "undefined" && token !== "null");
  }
}

export const authRepository = new HttpAuthRepository();
