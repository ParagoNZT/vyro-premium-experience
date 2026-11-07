import { supabase } from "@/integrations/supabase/client";

export class PortalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function portalApi<T>(
  path: `/api/${string}`,
  options: { method?: "GET" | "POST"; body?: unknown; token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const token = options.token ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new PortalApiError("Reconnectez-vous pour continuer.", 401);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    cache: "no-store",
    redirect: "error",
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    const message =
      result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "Le service est momentanément indisponible.";
    throw new PortalApiError(message, response.ok ? 502 : response.status);
  }
  return result as T;
}
