import { NextRequest, NextResponse } from "next/server";
import { getWebhookEvent, updateWebhookStatus } from "@/app/lib/db";
import { enqueueWebhookProcessing } from "@/app/lib/inngest";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const event = await getWebhookEvent(id);
    if (!event) {
      return NextResponse.json(
        { error: "Evento não encontrado" },
        { status: 404 }
      );
    }

    await updateWebhookStatus(id, "received");
    await enqueueWebhookProcessing(id);

    return NextResponse.json({
      success: true,
      message: "Evento enfileirado para reprocessamento",
      eventId: id,
    });
  } catch (error) {
    console.error("Erro ao reprocessar webhook:", error);
    return NextResponse.json(
      {
        error: "Falha ao reprocessar webhook",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
