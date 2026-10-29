import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ProblemDetails } from "../types/problem-details.types";

const options = {
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
};
export const httpClient = axios.create(options);
const refreshClient = axios.create(options);
let refreshing: Promise<string> | null = null;

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("cneb_access_token");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

function expireSession() {
  localStorage.removeItem("cneb_access_token");
  window.dispatchEvent(new Event("cneb:session-expired"));
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ProblemDetails>) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { retried?: boolean })
      | undefined;
    const isAuthRequest = /\/auth\/(login|register|refresh|logout)/.test(
      config?.url ?? "",
    );
    if (
      error.response?.status === 401 &&
      config &&
      !config.retried &&
      !isAuthRequest
    ) {
      config.retried = true;
      try {
        refreshing ??= refreshClient
          .post<{ accessToken: string }>("/auth/refresh")
          .then(({ data }) => {
            if (!data.accessToken)
              throw new Error("No se recibió un token de acceso.");
            localStorage.setItem("cneb_access_token", data.accessToken);
            return data.accessToken;
          })
          .finally(() => {
            refreshing = null;
          });
        const token = await refreshing;
        config.headers.set("Authorization", `Bearer ${token}`);
        return httpClient(config);
      } catch (refreshError) {
        if (
          axios.isAxiosError(refreshError) &&
          refreshError.response?.status === 401
        )
          expireSession();
        // Network/provider errors do not silently destroy a valid refresh session.
      }
    } else if (error.response?.status === 401 && config?.retried) {
      expireSession();
    }
    let body: unknown = error.response?.data;
    if (body instanceof Blob) {
      try {
        body = JSON.parse(await body.text());
      } catch {
        body = undefined;
      }
    }
    const status = error.response?.status ?? 503;
    const problem: ProblemDetails =
      body && typeof body === "object" && "detail" in body
        ? (body as ProblemDetails)
        : {
            type: "about:blank",
            title: "No se pudo completar la solicitud",
            status,
            detail: error.message,
          };
    return Promise.reject({
      problem,
      status,
      message: problem.detail || problem.title,
    });
  },
);
