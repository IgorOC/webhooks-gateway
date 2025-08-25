import { createClient } from "@supabase/supabase-js";

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

export interface WebhookEvent {
  id: string;
  source_id: string;
  event_id: string;
  event_type: string;
  signature: string;
  payload: unknown;
  headers: unknown;
  status: "received" | "verified" | "processed" | "failed";
  error_message?: string;
  retry_count: number;
  received_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export async function getWebhookSource(
  name: string
): Promise<WebhookSource | null> {
  const { data } = await db
    .from("webhook_sources")
    .select("*")
    .eq("name", name)
    .eq("is_active", true)
    .single();
  return data;
}

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
    .single();

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
      status: "received",
      retry_count: 0,
    })
    .select()
    .single();

  return { alreadyExists: false, event };
}

export async function getWebhookEvent(
  id: string
): Promise<WebhookEvent | null> {
  const { data } = await db
    .from("webhook_events")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function updateWebhookStatus(
  id: string,
  status: WebhookEvent["status"],
  errorMessage?: string
): Promise<void> {
  const updates: {
    status: WebhookEvent["status"];
    updated_at: string;
    processed_at?: string;
    error_message?: string;
  } = {
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
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
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
    .order("received_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.source) {
    query = query.eq("webhook_sources.name", filters.source);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 10) - 1
    );
  }

  const { data, error } = await query;
  return { data, error };
}
