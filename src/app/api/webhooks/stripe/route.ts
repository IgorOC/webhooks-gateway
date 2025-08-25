import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getWebhookSource, insertWebhookEvent } from "../../../lib/db";
import { enqueueWebhookProcessing } from "../../../lib/inngest";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Assinatura do Stripe ausente" },
        { status: 400 }
      );
    }

    const source = await getWebhookSource("stripe");
    if (!source) {
      return NextResponse.json(
        { error: "Fonte de webhook do Stripe não configurada" },
        { status: 500 }
      );
    }

    if (!verifyStripeSignature(rawBody, signature, source.secret)) {
      return NextResponse.json(
        { error: "Assinatura inválida" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id;
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
    console.error("Erro no webhook do Stripe:", error);
    return NextResponse.json(
      {
        error: "Falha no processamento do webhook",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const elements = signature.split(",");
    const signatureElements: Record<string, string> = {};

    elements.forEach((element) => {
      const [key, value] = element.split("=");
      signatureElements[key] = value;
    });

    const timestamp = signatureElements.t;
    const sig = signatureElements.v1;

    if (!timestamp || !sig) {
      return false;
    }

    const payload = `${timestamp}.${body}`;
    const computedSig = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computedSig));
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do Stripe está funcionando",
    timestamp: new Date().toISOString(),
  });
}
