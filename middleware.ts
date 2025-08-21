import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting usando Map (em produção, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Configurações de rate limit por rota
const RATE_LIMITS = {
  "/api/webhooks": { maxRequests: 100, windowMs: 60000 }, // 100 req/min
  "/api": { maxRequests: 50, windowMs: 60000 }, // 50 req/min (outras APIs)
  default: { maxRequests: 20, windowMs: 60000 }, // 20 req/min (geral)
};

function getRateLimit(pathname: string) {
  if (pathname.startsWith("/api/webhooks")) return RATE_LIMITS["/api/webhooks"];
  if (pathname.startsWith("/api")) return RATE_LIMITS["/api"];
  return RATE_LIMITS.default;
}

function isRateLimited(
  ip: string,
  limit: { maxRequests: number; windowMs: number }
): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset ou primeira request
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + limit.windowMs,
    });
    return false;
  }

  if (userLimit.count >= limit.maxRequests) {
    return true; // Rate limited
  }

  // Incrementa contador
  userLimit.count++;
  return false;
}

function getClientIP(request: NextRequest): string {
  // Tenta vários headers para pegar o IP real
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

function validateWebhookRequest(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  const contentType = request.headers.get("content-type");
  const userAgent = request.headers.get("user-agent");

  // Validações básicas para webhooks
  if (!contentType?.includes("application/json")) {
    return { isValid: false, error: "Invalid content type" };
  }

  // Bloqueia user agents suspeitos
  const suspiciousAgents = ["curl", "wget", "python-requests"];
  if (
    userAgent &&
    suspiciousAgents.some((agent) =>
      userAgent.toLowerCase().includes(agent.toLowerCase())
    )
  ) {
    // Log para análise (em produção, pode querer permitir alguns)
    console.warn(`Suspicious user agent: ${userAgent}`);
  }

  return { isValid: true };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // 1. Rate Limiting
  const rateLimit = getRateLimit(pathname);
  if (isRateLimited(ip, rateLimit)) {
    console.warn(`Rate limit exceeded for IP: ${ip} on ${pathname}`);
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: Math.ceil(rateLimit.windowMs / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimit.windowMs / 1000).toString(),
          "X-Rate-Limit-Limit": rateLimit.maxRequests.toString(),
          "X-Rate-Limit-Remaining": "0",
        },
      }
    );
  }

  // 2. Validações específicas para webhooks
  if (pathname.startsWith("/api/webhooks/")) {
    const validation = validateWebhookRequest(request);
    if (!validation.isValid) {
      console.warn(
        `Invalid webhook request: ${validation.error} from IP: ${ip}`
      );
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  // 3. Logs de segurança
  if (pathname.startsWith("/api/")) {
    console.log(`API Request: ${request.method} ${pathname} from IP: ${ip}`);
  }

  // 4. Adiciona headers de segurança extras para APIs
  const response = NextResponse.next();

  if (pathname.startsWith("/api/")) {
    response.headers.set("X-Request-ID", crypto.randomUUID());
    response.headers.set(
      "X-Rate-Limit-Limit",
      rateLimit.maxRequests.toString()
    );

    const userLimit = rateLimitMap.get(ip);
    if (userLimit) {
      const remaining = Math.max(0, rateLimit.maxRequests - userLimit.count);
      response.headers.set("X-Rate-Limit-Remaining", remaining.toString());
    }
  }

  return response;
}

// Configuração de rotas que passam pelo middleware
export const config = {
  matcher: [
    // Aplica para todas as rotas da API
    "/api/:path*",
    // E para rotas específicas se necessário
    "/webhooks/:path*",
  ],
};
