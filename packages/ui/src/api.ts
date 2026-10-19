"use client";
import { useQuery, QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { receiptResponse } from "../../contracts/src/index";
export const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: any,
  ) {
    super(code);
  }
}
export async function api(
  path: string,
  body?: any,
  options: { key?: string; token?: string } = {},
) {
  const response = await fetch("/api/v1" + path, {
    credentials: "include",
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined
        ? {
            "Content-Type": "application/json",
            "Idempotency-Key": options.key || crypto.randomUUID(),
          }
        : {}),
      ...(options.token ? { "X-Receipt-Token": options.token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.code, response.status, result.details);
  return path === "/demo/incidents" ? receiptResponse.parse(result) : result;
}
export function useApi(path: string | null) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const result = await api(path!);
      if (path?.includes("/events")) {
        let cursor = result.nextCursor;
        while (cursor) {
          const next = await api(path.split("?")[0] + "?cursor=" + cursor);
          result.items.push(...next.items);
          cursor = next.nextCursor;
        }
      }
      return result;
    },
    enabled: !!path,
    refetchInterval: 5000,
  });
}
export function useLive(auth?: { reference: string; receiptToken: string }) {
  const [connected, setConnected] = useState(false);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      addTrailingSlash: false,
      withCredentials: true,
      auth: auth || {},
      transports: ["polling", "websocket"],
    });
    const reconcile = () => {
      void client.invalidateQueries();
    };
    socket.on("connect", () => {
      setConnected(true);
      reconcile();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("system.sync_required", reconcile);
    socket.on("event", (event) => {
      setCursor(event.sequence || 0);
      reconcile();
    });
    return () => {
      socket.disconnect();
    };
  }, [auth?.reference, auth?.receiptToken]);
  return { connected, cursor };
}
export function invalidate() {
  void client.invalidateQueries();
}
