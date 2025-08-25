export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSource, insertWebhookEvent } from "@/app/lib/db";
import { enqueueWebhookProcessing } from "@/app/lib/inngest";

/**
 * GitHub envia o ID do evento no header `x-github-delivery`.
 * A assinatura vem no header `x-hub-signature-256` no formato "sha256=<hex>".
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const eventType = req.headers.get("x-github-event");
    const deliveryHeader = req.headers.get("x-github-delivery");

    if (!signature) {
      return NextResponse.json(
        { error: "Assinatura do GitHub ausente" },
        { status: 400 }
      );
    }
    if (!eventType) {
      return NextResponse.json(
        { error: "Tipo de evento do GitHub ausente" },
        { status: 400 }
      );
    }

    const source = await getWebhookSource("github");
    if (!source) {
      return NextResponse.json(
        { error: "Fonte de webhook do GitHub não configurada" },
        { status: 500 }
      );
    }

    if (!verifyGitHubSignature(rawBody, signature, source.secret)) {
      return NextResponse.json(
        { error: "Assinatura inválida" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventId =
      deliveryHeader || payload.id || `${eventType}_${Date.now()}`;
    const requestHeaders = Object.fromEntries(req.headers.entries());

    const { alreadyExists, event: webhookEvent } = await insertWebhookEvent({
      sourceId: source.id,
      eventId,
      eventType,
      payload,
      headers: requestHeaders,
      signature,
    });

    if (alreadyExists) {
      return NextResponse.json({
        success: true,
        message: "Evento já processado",
        deduped: true,
      });
    }

    if (webhookEvent) {
      await enqueueWebhookProcessing(webhookEvent.id);
    }

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      message: "Webhook enfileirado para processamento",
    });
  } catch (error) {
    console.error("Erro no webhook do GitHub:", error);
    return NextResponse.json(
      {
        error: "Falha no processamento do webhook",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do GitHub está funcionando",
    timestamp: new Date().toISOString(),
  });
}
