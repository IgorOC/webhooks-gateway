import { createClient} from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const db = createClient(supabaseUrl, supabaseServiceKey);


export interface WebhookSource {
  id: string;
  name: string;
  secret: string;
  signature_header: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WebhookStatus = "received" | "verified" | "processed" | "failed";

export interface WebhookEvent {
  id: string;
  source_id: string;
  event_id: string;
  event_type: string;
  signature: string;
  payload: unknown;
  headers: unknown;
  status: WebhookStatus;
  error_message?: string;
  retry_count: number;
  received_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

/** Tipo auxiliar para quando o select embute a tabela relacionada */
type WebhookEventWithSourceRel = WebhookEvent & {
  webhook_sources?: { name?: string } | null;
};

/** Tipo do retorno transformado com o campo `source_name` já “achatado” */
export type WebhookEventWithSourceName = WebhookEvent & {
  source_name: string;
};

/** ---------------- Fontes ---------------- */

export async function getWebhookSource(
  name: string
): Promise<WebhookSource | null> {
  const { data, error } = await db
    .from("webhook_sources")
    .select("*")
    .eq("name", name)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data;
}

/** ---------------- Eventos ---------------- */

export async function insertWebhookEvent(params: {
  sourceId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  headers: unknown;
  signature: string;
}): Promise<{ alreadyExists: boolean; event: WebhookEvent | null }> {
  const { data: existing } = await db
    .from("webhook_events")
    .select("id")
    .eq("source_id", params.sourceId)
    .eq("event_id", params.eventId)
    .maybeSingle();

  if (existing) {
    return { alreadyExists: true, event: null };
  }

  const { data: event } = await db
    .from("webhook_events")
    .insert({
      source_id: params.sourceId,
      event_id: params.eventId,
      event_type: params.eventType,
      payload: params.payload,
      headers: params.headers,
      signature: params.signature,
      status: "received" as WebhookStatus,
      retry_count: 0,
    })
    .select()
    .single();

  return { alreadyExists: false, event };
}

export async function getWebhookEvent(
  id: string
): Promise<WebhookEvent | null> {
  const { data, error } = await db
    .from("webhook_events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function updateWebhookStatus(
  id: string,
  status: WebhookStatus,
  errorMessage?: string
): Promise<void> {
  const updates: Partial<
    Pick<
      WebhookEvent,
      "status" | "updated_at" | "processed_at" | "error_message"
    >
  > = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "processed") {
    updates.processed_at = new Date().toISOString();
  }

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  if (status === "failed") {
    await db.rpc("increment_retry_count", { event_id: id });
  }

  await db.from("webhook_events").update(updates).eq("id", id);
}


export async function getWebhookEvents(filters?: {
  status?: WebhookStatus;
  source?: string; 
  limit?: number;
  offset?: number;
}): Promise<{
  data: WebhookEventWithSourceName[] | null;
  error: unknown;
}> {

  const limit = typeof filters?.limit === "number" ? filters.limit : 20;
  const offset = typeof filters?.offset === "number" ? filters.offset : 0;

  let query = db
    .from("webhook_events")
    .select(
      `
      *,
      webhook_sources (
        name
      )
    `
    )
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.source) {
    query = query.eq("webhook_sources.name", filters.source);
  }

  const { data: relatedData, error: relatedError } = await query;

  if (!relatedError && relatedData) {
    const transformed: WebhookEventWithSourceName[] = (relatedData as WebhookEventWithSourceRel[]).map(
      (evt) => ({
        ...evt,
        source_name: evt.webhook_sources?.name ?? "Desconhecido",
      })
    );
    return { data: transformed, error: null };
  }

  const sqlParts: string[] = [
    `SELECT 
       webhook_events.*,
       webhook_sources.name AS source_name
     FROM webhook_events
     LEFT JOIN webhook_sources ON webhook_events.source_id = webhook_sources.id`,
  ];

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters?.status) {
    whereClauses.push(`webhook_events.status = $${params.length + 1}`);
    params.push(filters.status);
  }

  if (filters?.source) {
    whereClauses.push(`webhook_sources.name = $${params.length + 1}`);
    params.push(filters.source);
  }

  if (whereClauses.length > 0) {
    sqlParts.push(`WHERE ${whereClauses.join(" AND ")}`);
  }

  sqlParts.push(`ORDER BY webhook_events.received_at DESC`);
  sqlParts.push(`LIMIT $${params.length + 1}`);
  params.push(limit);
  sqlParts.push(`OFFSET $${params.length + 1}`);
  params.push(offset);

  const rawSql = sqlParts.join("\n");

  const { data: rpcData, error: rpcError } = await db.rpc("exec_sql", {
    sql: rawSql,
    params,
  });

  if (rpcError) {
    return { data: null, error: relatedError ?? rpcError };
  }

  const casted = (rpcData as WebhookEventWithSourceName[]) ?? null;
  return { data: casted, error: null };
}
