import { z, ZodError, ZodIssue } from "zod";

/**
 * Schema de validação para variáveis de ambiente
 * Observações:
 * - Usei z.coerce.* para converter strings do process.env em boolean/number.
 * - Defaults precisam ser do mesmo tipo final do schema (ex.: boolean/number, não "string").
 */
const envSchema = z.object({
  // Next.js
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Supabase (obrigatórias)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Supabase anon key is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "Supabase service role key is required"),

  // Inngest (opcionais no desenvolvimento)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Webhook Secrets (opcionais, mas recomendados)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Segurança adicional
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NextAuth secret must be at least 32 characters")
    .optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Rate limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),

  // Opcional (exemplo no generateEnvExample)
  ALLOWED_ORIGINS: z.string().optional(), // ex: "http://localhost:3000,https://your-domain.com"
});

export type Env = z.infer<typeof envSchema>;

/**
 * Função para validar e obter variáveis de ambiente
 */
export function getEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    console.error("❌ Invalid environment variables:");

    if (error instanceof ZodError) {
      error.issues.forEach((issue: ZodIssue) => {
        const path = issue.path.join(".");
        console.error(`  - ${path || "(root)"}: ${issue.message}`);
      });
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

/**
 * Função para verificar se todas as variáveis críticas estão definidas
 */
export function validateCriticalEnvVars(): void {
  const critical = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;

  const missing = critical.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing critical environment variables:");
    missing.forEach((key) => console.error(`  - ${key}`));
    console.error("\n💡 Check your .env.local file or deployment settings");
    process.exit(1);
  }
}

/**
 * Função para verificar configuração de webhooks
 */
export function validateWebhookSecrets(): {
  stripe: boolean;
  resend: boolean;
  github: boolean;
} {
  return {
    stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
    resend: !!process.env.RESEND_WEBHOOK_SECRET,
    github: !!process.env.GITHUB_WEBHOOK_SECRET,
  };
}

/**
 * Função para gerar .env.example automaticamente
 */
export function generateEnvExample(): string {
  return `# Environment Configuration
# Copy this file to .env.local and fill in your values

# Application
NODE_ENV=development

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Inngest (Required for production)
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# Webhook Secrets (Provider-specific)
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret
RESEND_WEBHOOK_SECRET=your_resend_secret
GITHUB_WEBHOOK_SECRET=your_github_secret

# Authentication (Optional)
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Rate Limiting (Optional)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Security (Optional)
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
`;
}

/**
 * Singleton para acesso às env vars validadas
 */
let validatedEnv: Env | null = null;

export function env(): Env {
  if (!validatedEnv) {
    validatedEnv = getEnv();
  }
  return validatedEnv;
}

/** Helper para modo de desenvolvimento */
export function isDevelopment(): boolean {
  return env().NODE_ENV === "development";
}

/** Helper para modo de produção */
export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

/** Helper para verificar se Inngest está configurado */
export function isInngestConfigured(): boolean {
  const ev = env();
  return !!(ev.INNGEST_EVENT_KEY && ev.INNGEST_SIGNING_KEY);
}

/** Helper opcional: parse de ALLOWED_ORIGINS em array */
export function getAllowedOrigins(): string[] {
  const ev = env();
  if (!ev.ALLOWED_ORIGINS) return [];
  return ev.ALLOWED_ORIGINS.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
