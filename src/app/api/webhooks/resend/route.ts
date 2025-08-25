export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSource, insertWebhookEvent } from "@/app/lib/db";
import { enqueueWebhookProcessing } from "@/app/lib/inngest";

/**
 * Resend envia header `resend-signature` no formato "sha256=<hex>" (HMAC do body).
 */
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
    const eventId =
      payload?.data?.email_id || `${payload?.type || "unknown"}_${Date.now()}`;
    const eventType = payload?.type || "unknown";
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
  // signature pode vir com prefixo "sha256="
  const receivedHex = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");

  const a = Buffer.from(receivedHex);
  const b = Buffer.from(expectedHex);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do Resend está funcionando",
    timestamp: new Date().toISOString(),
  });
}
