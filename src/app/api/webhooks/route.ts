import { NextRequest, NextResponse } from "next/server";
import { getWebhookEvents } from "@/app/lib/db";

// Inferir os tipos a partir da função, removendo `undefined` do union:
type Params = NonNullable<Parameters<typeof getWebhookEvents>[0]>;
type WebhookStatus = Params["status"];
type WebhookSource = Params["source"]; // pode ser string | undefined dependendo da sua definição

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Normaliza null -> undefined
    const rawStatus = searchParams.get("status") ?? undefined;
    const rawSource = searchParams.get("source") ?? undefined;

    // Se quiser validação de domínio, valide aqui antes do cast.
    // Para destravar agora, apenas normalize e faça o cast para os tipos esperados:
    const status = rawStatus as WebhookStatus; // mantém `undefined` se não houver query
    const source = rawSource as WebhookSource;

    // Paginação com limites razoáveis
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
    );
    const offset = (page - 1) * limit;

    const { data, error } = await getWebhookEvents({
      status,
      source,
      limit,
      offset,
    });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao buscar eventos" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: data ?? [],
      pagination: {
        page,
        limit,
        total: data?.length ?? 0, // use o total real do DB se disponível
      },
    });
  } catch (err) {
    console.error("Erro ao buscar webhooks:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
