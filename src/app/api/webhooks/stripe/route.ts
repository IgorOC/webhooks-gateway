export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getWebhookSource, insertWebhookEvent } from "@/app/lib/db";
import { enqueueWebhookProcessing } from "@/app/lib/inngest";

/**
 * Stripe: use o SDK para verificar assinatura (recomendado).
 * Precisa de raw body (req.text()) e do header `stripe-signature` no formato "t=<ts>,v1=<hmac>".
 * O secret deve ser o endpoint secret de webhook do Stripe (whsec_...).
 */
export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
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

    const rawBody = await req.text();

    // A apiVersion é opcional para verificação de webhooks; remover evita conflito de tipos
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");

    // Verifica a assinatura com o endpoint secret do Stripe
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      source.secret
    );

    const eventId = event.id;
    const eventType = event.type;
    const requestHeaders = Object.fromEntries(req.headers.entries());

    const { alreadyExists, event: saved } = await insertWebhookEvent({
      sourceId: source.id,
      eventId,
      eventType,
      payload: event,
      headers: requestHeaders,
      signature: sig,
    });

    if (alreadyExists) {
      return NextResponse.json({
        success: true,
        message: "Evento já processado",
        deduped: true,
      });
    }

    if (saved) {
      await enqueueWebhookProcessing(saved.id);
    }

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      message: "Webhook enfileirado para processamento",
    });
  } catch (error: unknown) {
    // Narrowing seguro
    const err = error as { type?: string; message?: string };
    console.error("Erro no webhook do Stripe:", err);

    // Stripe recomenda 400 para falha de verificação de assinatura
    const status = err?.type === "StripeSignatureVerificationError" ? 400 : 500;
    return NextResponse.json(
      {
        error: "Falha no processamento do webhook",
        details: err?.message || "Erro desconhecido",
      },
      { status }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook do Stripe está funcionando",
    timestamp: new Date().toISOString(),
  });
}
