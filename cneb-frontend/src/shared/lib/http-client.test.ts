import { it, expect, vi, afterEach } from "vitest";
import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
const originalAdapter = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
  localStorage.clear();
  vi.restoreAllMocks();
});

it("refreshes once for concurrent 401 responses and retries with the new token", async () => {
  const calls: string[] = [];
  axios.defaults.adapter = async (config) => {
    calls.push(config.url ?? "");
    if (config.url === "/auth/refresh") {
      return {
        data: { accessToken: "renewed-token" },
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders(),
        config,
      };
    }
    if (config.headers.get("Authorization") !== "Bearer renewed-token")
      throw unauthorized(config);
    return {
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
  localStorage.setItem("cneb_access_token", "expired-token");
  const { httpClient } = await import("./http-client");
  const results = await Promise.all([
    httpClient.get("/one"),
    httpClient.get("/two"),
  ]);
  expect(results.every((r) => r.data.ok)).toBe(true);
  expect(calls.filter((url) => url === "/auth/refresh")).toHaveLength(1);
  expect(localStorage.getItem("cneb_access_token")).toBe("renewed-token");
});

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
    data: {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Expired",
    },
    status: 401,
    statusText: "Unauthorized",
    headers: new AxiosHeaders(),
    config,
  });
}
