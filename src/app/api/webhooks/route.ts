import { NextRequest, NextResponse } from "next/server";
import { getWebhookEvents } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const source = searchParams.get("source") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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
      events: data,
      pagination: {
        page,
        limit,
        total: data?.length || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar webhooks:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
