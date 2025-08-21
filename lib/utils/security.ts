import crypto from "crypto";

// Sanitização de inputs
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove caracteres perigosos
    .trim()
    .slice(0, 1000); // Limita tamanho
}

// Validação de UUID
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validação de URL de webhook
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

// Geração de secrets seguros
export function generateSecureSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// Hash seguro para senhas/secrets
export function hashSecret(secret: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(secret, actualSalt, 10000, 32, "sha256");
  return `${actualSalt}:${hash.toString("hex")}`;
}

// Verificação de hash
export function verifyHash(secret: string, hash: string): boolean {
  try {
    const [salt, originalHash] = hash.split(":");
    const newHash = crypto.pbkdf2Sync(secret, salt, 10000, 32, "sha256");
    return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), newHash);
  } catch {
    return false;
  }
}

// Validação de tamanho de payload
export function validatePayloadSize(
  payload: string,
  maxSizeKB: number = 1024
): boolean {
  const sizeInKB = Buffer.byteLength(payload, "utf8") / 1024;
  return sizeInKB <= maxSizeKB;
}

// Log de segurança estruturado
export function securityLog(
  event: string,
  details: Record<string, unknown>
): void {
  const sanitizedDetails = Object.keys(details).reduce<Record<string, unknown>>(
    (acc, key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("token")
      ) {
        acc[key] = "[REDACTED]";
      } else {
        acc[key] = details[key];
      }
      return acc;
    },
    {} as Record<string, unknown>
  );

  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: sanitizedDetails,
  };

  console.log(JSON.stringify(logEntry));
}

// Máscara para dados sensíveis em logs
export function maskSensitiveData(data: string): string {
  if (data.length <= 8) return "***";
  return `${data.slice(0, 4)}***${data.slice(-4)}`;
}

// Validação de origem de request
export function validateRequestOrigin(
  request: Request,
  allowedOrigins: string[]
): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return true; // Permite requests sem origem (APIs)

  const sourceUrl = origin || referer;
  if (!sourceUrl) return false;

  try {
    const url = new URL(sourceUrl);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}

// Rate limiting simples (para backup)
class SimpleRateLimit {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number = 60000, // 1 minuto
    private maxRequests: number = 100
  ) {}

  isLimited(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Pega requests do usuário
    let userRequests = this.requests.get(identifier) || [];

    // Remove requests antigas
    userRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    // Verifica limite
    if (userRequests.length >= this.maxRequests) {
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
    const userRequests = this.requests.get(identifier) || [];
    const validRequests = userRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Instância global de rate limit
export const globalRateLimit = new SimpleRateLimit();

// Configurações de segurança por ambiente
export const SECURITY_CONFIG = {
  development: {
    allowHttpOrigins: true,
    logLevel: "debug",
    rateLimitEnabled: false,
  },
  production: {
    allowHttpOrigins: false,
    logLevel: "warn",
    rateLimitEnabled: true,
  },
};

export function getSecurityConfig() {
  const env = process.env.NODE_ENV || "development";
  return (
    SECURITY_CONFIG[env as keyof typeof SECURITY_CONFIG] ||
    SECURITY_CONFIG.development
  );
}
