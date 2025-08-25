import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSource, insertWebhookEvent } from "../../../lib/db";
import { enqueueWebhookProcessing } from "../../../lib/inngest";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("resend-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Assinatura do Resend ausente" },
        { status: 400 }
      );
    }

    const source = await getWebhookSource("resend");
    if (!source) {
      return NextResponse.json(
        { error: "Fonte de webhook do Resend não configurada" },
        { status: 500 }
      );
    }

    if (!verifyResendSignature(rawBody, signature, source.secret)) {
      return NextResponse.json(
        { error: "Assinatura inválida" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.data?.email_id || `${payload.type}_${Date.now()}`;
    const eventType = payload.type;

    const requestHeaders = Object.fromEntries(req.headers.entries());

    const { alreadyExists, event } = await insertWebhookEvent({
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

    if (event) {
      await enqueueWebhookProcessing(event.id);
    }

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      message: "Webhook enfileirado para processamento",
    });
  } catch (error) {
    console.error("Erro no webhook do Resend:", error);
    return NextResponse.json(
      {
        error: "Falha no processamento do webhook",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

function verifyResendSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("hex");

    const receivedSignature = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do Resend está funcionando",
    timestamp: new Date().toISOString(),
  });
}
