import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");

    console.log("GitHub webhook received:", event);

    // Verificar se tem secret configurado
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Verificar assinatura do GitHub
    if (
      !verifyGitHubSignature(
        rawBody,
        signature,
        process.env.GITHUB_WEBHOOK_SECRET
      )
    ) {
      console.error("Invalid GitHub signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Log do evento recebido
    console.log(`GitHub ${event} event:`, {
      action: payload.action,
      repository: payload.repository?.name,
      sender: payload.sender?.login,
    });

    // Aqui você integraria com seu banco/Inngest
    // Por enquanto, só confirma que recebeu

    return NextResponse.json({
      success: true,
      event,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Verificação de assinatura do GitHub
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

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Endpoint para testar se está funcionando
export async function GET() {
  return NextResponse.json({
    message: "GitHub webhook endpoint is working",
    timestamp: new Date().toISOString(),
  });
}
