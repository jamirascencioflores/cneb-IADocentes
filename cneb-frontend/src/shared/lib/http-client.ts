import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ProblemDetails } from "../types/problem-details.types";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  withCredentials: true,
});

// Interceptor de Solicitud
httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("cneb_access_token");

  if (token) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Debug local en consola del navegador
  console.log(`[HTTP Request] ${config.method?.toUpperCase()} ${config.url}`, {
    hasToken: !!token,
    authHeader:
      config.headers["Authorization"] || config.headers.get?.("Authorization"),
  });

  return config;
});

// Interceptor de Respuesta
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ProblemDetails>) => {
    const requestUrl = error.config?.url || "";

    // Solo borra token si expresamente falla el login o refresh
    if (
      error.response?.status === 401 &&
      requestUrl.includes("/auth/refresh")
    ) {
      localStorage.removeItem("cneb_access_token");
    }

    if (error.response?.data) {
      const problem = error.response.data;
      return Promise.reject({
        problem,
        status: error.response.status,
        message: problem.detail || problem.title || error.message,
      });
    }

    return Promise.reject({
      problem: {
        type: "about:blank",
        title: "Error de Conexión",
        status: error.response?.status || 500,
        detail:
          error.message || "No se pudo comunicar con el servidor backend.",
      },
      status: error.response?.status || 500,
      message: error.message,
    });
  },
);
