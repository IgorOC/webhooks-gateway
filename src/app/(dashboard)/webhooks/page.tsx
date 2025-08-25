"use client";

import { useState, useEffect } from "react";

interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  status: "received" | "verified" | "processed" | "failed";
  error_message?: string;
  retry_count: number;
  received_at: string;
  processed_at?: string;
  source_name?: string; // Campo do JOIN
  webhook_sources?: {
    name: string;
  }; // Manter para compatibilidade
}

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: "",
    source: "",
  });

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append("status", filter.status);
      if (filter.source) params.append("source", filter.source);

      const response = await fetch(`/api/webhooks?${params}`);
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Erro ao buscar eventos:", error);
    } finally {
      setLoading(false);
    }
  };

  const replayEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/webhooks/replay/${eventId}`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchEvents();
        alert("Evento enfileirado para reprocessamento");
      } else {
        alert("Falha ao reprocessar evento");
      }
    } catch (error) {
      console.error("Erro ao reprocessar evento:", error);
      alert("Erro ao reprocessar evento");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "verified":
        return "text-blue-600";
      default:
        return "text-yellow-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "received":
        return "Recebido";
      case "verified":
        return "Verificado";
      case "processed":
        return "Processado";
      case "failed":
        return "Falhou";
      default:
        return status;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Eventos de Webhook
        </h1>

        <div className="flex gap-4 mb-4">
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="received">Recebido</option>
            <option value="verified">Verificado</option>
            <option value="processed">Processado</option>
            <option value="failed">Falhou</option>
          </select>

          <select
            value={filter.source}
            onChange={(e) => setFilter({ ...filter, source: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Fontes</option>
            <option value="stripe">Stripe</option>
            <option value="github">GitHub</option>
            <option value="resend">Resend</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">Carregando...</div>
      ) : (
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
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {event.event_type}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {event.event_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                      {event.source_name || "Desconhecido"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-sm font-medium ${getStatusColor(
                        event.status
                      )}`}
                    >
                      {getStatusText(event.status)}
                    </span>
                    {event.error_message && (
                      <div className="text-xs text-red-500 mt-1">
                        {event.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(event.received_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {event.status === "failed" && (
                      <button
                        onClick={() => replayEvent(event.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Reprocessar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum evento de webhook encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
