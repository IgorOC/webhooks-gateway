import crypto from "crypto";

/** Sanitização de inputs */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove caracteres perigosos
    .trim()
    .slice(0, 1000); // Limita tamanho
}

/** Validação de UUID (v1–v5) */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/** Validação de URL de webhook (https, não-localhost) */
export function isValidWebhookURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === "https:" && parsedUrl.hostname !== "localhost"
    );
  } catch {
    return false;
  }
}

/** Geração de secrets seguros (hex) */
export function generateSecureSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/** Hash seguro para senhas/secrets (PBKDF2 + salt) */
export function hashSecret(secret: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(secret, actualSalt, 10_000, 32, "sha256");
  return `${actualSalt}:${hash.toString("hex")}`;
}

/** Verificação de hash com comparação constante */
export function verifyHash(secret: string, hash: string): boolean {
  try {
    const [salt, originalHashHex] = hash.split(":");
    if (!salt || !originalHashHex) return false;

    const originalHash = Buffer.from(originalHashHex, "hex");
    const newHash = crypto.pbkdf2Sync(secret, salt, 10_000, 32, "sha256");
    if (originalHash.length !== newHash.length) return false;

    return crypto.timingSafeEqual(originalHash, newHash);
  } catch {
    return false;
  }
}

/** Validação de tamanho de payload (em KB) */
export function validatePayloadSize(
  payload: string,
  maxSizeKB: number = 1024
): boolean {
  const sizeInKB = Buffer.byteLength(payload, "utf8") / 1024;
  return sizeInKB <= maxSizeKB;
}

/** Tipo seguro para detalhes de log */
export type LogPrimitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | unknown[];

/** Log de segurança estruturado (redige campos sensíveis) */
export function securityLog(
  event: string,
  details: Record<string, LogPrimitive>
): void {
  const sanitizedDetails = Object.keys(details).reduce<
    Record<string, LogPrimitive>
  >((acc, key) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("api_key") ||
      lowerKey.includes("apikey")
    ) {
      acc[key] = "[REDACTED]";
    } else {
      acc[key] = details[key];
    }
    return acc;
  }, {});

  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: sanitizedDetails,
  };

  // Evita exceções de circularidade
  try {
    console.log(JSON.stringify(logEntry));
  } catch {
    console.log(
      JSON.stringify({
        ...logEntry,
        details: "[Unserializable details]",
      })
    );
  }
}

/** Máscara para dados sensíveis em logs */
export function maskSensitiveData(data: string): string {
  if (data.length <= 8) return "***";
  return `${data.slice(0, 4)}***${data.slice(-4)}`;
}

/** Validação de origem de request (CORS-like) */
export function validateRequestOrigin(
  request: Request,
  allowedOrigins: string[]
): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Permite requests sem origem (e.g., chamadas de servidor para servidor)
  if (!origin && !referer) return true;

  const sourceUrl = origin || referer;
  if (!sourceUrl) return false;

  try {
    const url = new URL(sourceUrl);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

/** Rate limiting simples (fallback em memória) */
class SimpleRateLimit {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number = 60_000, // 1 minuto
    private maxRequests: number = 100
  ) {}

  isLimited(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let userRequests = this.requests.get(identifier) ?? [];

    // Remove requests fora da janela
    userRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    // Verifica limite
    if (userRequests.length >= this.maxRequests) {
      this.requests.set(identifier, userRequests);
      return true;
    }

    // Adiciona request atual
    userRequests.push(now);
    this.requests.set(identifier, userRequests);
    return false;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const userRequests = this.requests.get(identifier) ?? [];
    const validRequests = userRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

/** Instância global de rate limit (em memória) */
export const globalRateLimit = new SimpleRateLimit();

/** Configurações de segurança por ambiente */
type LogLevel = "debug" | "info" | "warn" | "error";

export const SECURITY_CONFIG = {
  development: {
    allowHttpOrigins: true,
    logLevel: "debug" as LogLevel,
    rateLimitEnabled: false,
  },
  production: {
    allowHttpOrigins: false,
    logLevel: "warn" as LogLevel,
    rateLimitEnabled: true,
  },
} as const;

type SecurityConfig = (typeof SECURITY_CONFIG)[keyof typeof SECURITY_CONFIG];

/** Retorna config de segurança conforme NODE_ENV */
export function getSecurityConfig(): SecurityConfig {
  const env = (process.env.NODE_ENV ||
    "development") as keyof typeof SECURITY_CONFIG;
  return SECURITY_CONFIG[env] ?? SECURITY_CONFIG.development;
}
