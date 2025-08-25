"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type WebhookStatus = "received" | "verified" | "processed" | "failed";

interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  status: WebhookStatus;
  error_message?: string | null;
  retry_count: number;
  received_at: string; 
  processed_at?: string;
  source_name?: string; 
  webhook_sources?: { name: string }; 
}

const statusLabel: Record<WebhookStatus, string> = {
  received: "Recebido",
  verified: "Verificado",
  processed: "Processado",
  failed: "Falhou",
};

function statusClass(s: WebhookStatus) {
  switch (s) {
    case "processed":
      return "text-green-700 bg-green-100 ring-green-600/20";
    case "verified":
      return "text-blue-700 bg-blue-100 ring-blue-600/20";
    case "failed":
      return "text-red-700 bg-red-100 ring-red-600/20";
    default:
      return "text-amber-800 bg-amber-100 ring-amber-500/20";
  }
}

function sourceBadgeClasses(src?: string) {
  const s = (src || "").toLowerCase();
  if (s === "github") return "bg-gray-100 text-gray-800";
  if (s === "stripe") return "bg-blue-100 text-blue-800";
  if (s === "resend") return "bg-green-100 text-green-800";
  return "bg-slate-100 text-slate-700";
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

/** Skeleton row */
function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 w-28 rounded bg-slate-200 mb-2" />
        <div className="h-3 w-44 rounded bg-slate-100" />
      </td>
      <td className="px-6 py-4">
        <div className="h-5 w-16 rounded-full bg-slate-200" />
      </td>
      <td className="px-6 py-4">
        <div className="h-5 w-24 rounded-full bg-slate-200" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-36 rounded bg-slate-200" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-20 rounded bg-slate-200" />
      </td>
    </tr>
  );
}

export default function WebhooksPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [status, setStatus] = useState<string>(search.get("status") ?? "");
  const [source, setSource] = useState<string>(search.get("source") ?? "");
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    const qs = params.toString();
    router.replace(`/webhooks${qs ? `?${qs}` : ""}`);
  }, [router, status, source]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      const res = await fetch(`/api/webhooks?${params}`, { cache: "no-store" });
      const data = await res.json();
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch (e) {
      console.error("Erro ao buscar eventos:", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);

  useEffect(() => {
    if (status && status !== "received") return;
    const id = setInterval(fetchEvents, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);

  const counts = useMemo(() => {
    const c: Record<WebhookStatus, number> = {
      received: 0,
      verified: 0,
      processed: 0,
      failed: 0,
    };
    for (const ev of events) c[ev.status]++;
    return c;
  }, [events]);

  async function replayEvent(id: string) {
    setReplaying((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetch(`/api/webhooks/replay/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Falha HTTP");
      await fetchEvents();
      alert("Evento enfileirado para reprocessamento");
    } catch (e) {
      console.error("Erro ao reprocessar:", e);
      alert("Erro ao reprocessar evento");
    } finally {
      setReplaying((m) => ({ ...m, [id]: false }));
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Eventos de Webhook
        </h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="received">Recebido</option>
            <option value="verified">Verificado</option>
            <option value="processed">Processado</option>
            <option value="failed">Falhou</option>
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Fontes</option>
            <option value="github">GitHub</option>
            <option value="stripe">Stripe</option>
            <option value="resend">Resend</option>
          </select>

          <button
            onClick={fetchEvents}
            className="ml-auto inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            Atualizar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
              "received"
            )}`}
          >
            Recebido · {counts.received}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
              "verified"
            )}`}
          >
            Verificado · {counts.verified}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
              "processed"
            )}`}
          >
            Processado · {counts.processed}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
              "failed"
            )}`}
          >
            Falhou · {counts.failed}
          </span>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fonte
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recebido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <RowSkeleton key={`sk-${i}`} />
              ))}

            {!loading &&
              events.map((ev) => {
                const src =
                  ev.source_name ?? ev.webhook_sources?.name ?? "Desconhecido";
                return (
                  <tr key={ev.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {ev.event_type}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {ev.event_id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sourceBadgeClasses(
                          src
                        )}`}
                      >
                        {src}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                          ev.status
                        )}`}
                      >
                        {statusLabel[ev.status]}
                      </span>
                      {ev.error_message && (
                        <div
                          className="text-xs text-red-600 mt-1 max-w-[420px] truncate"
                          title={ev.error_message}
                        >
                          {ev.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {fmtDateTime(ev.received_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {ev.status === "failed" ? (
                        <button
                          onClick={() => replayEvent(ev.id)}
                          disabled={!!replaying[ev.id]}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {replaying[ev.id]
                            ? "Reenfileirando..."
                            : "Reprocessar"}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-gray-500">
                  Nenhum evento de webhook encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
