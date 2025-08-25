import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSource, insertWebhookEvent } from "../../../lib/db";
import { enqueueWebhookProcessing } from "../../../lib/inngest";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");

    if (!signature) {
      return NextResponse.json(
        { error: "Assinatura do GitHub ausente" },
        { status: 400 }
      );
    }

    if (!event) {
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
    const eventId = payload.delivery || payload.id || `${event}_${Date.now()}`;
    const eventType = event;

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
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(body, "utf8").digest("hex")}`;

  // DEBUG: Adicione estes logs temporariamente
  console.log("Signature recebida:", signature);
  console.log("Signature calculada:", digest);
  console.log("Secret usado:", secret);

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do GitHub está funcionando",
    timestamp: new Date().toISOString(),
  });
}
