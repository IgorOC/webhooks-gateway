import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers de segurança
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Previne ataques XSS
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Previne clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Força HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Controla recursos que podem ser carregados
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.inngest.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          // Previne vazamento de informações via referrer
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Controle de permissões
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Headers específicos para API routes
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "X-API-Version",
            value: "1.0",
          },
        ],
      },
    ];
  },

  // Configurações de ambiente
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Configurações de build mais seguras
  experimental: {
    // Melhora a segurança do server-side rendering
    serverComponentsExternalPackages: ["crypto"],
  },

  // Remove informações sensíveis dos headers
  poweredByHeader: false,

  // Configurações de imagem (se usar next/image)
  images: {
    remotePatterns: [], // Domínios permitidos vazios por segurança
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Webpack config para segurança adicional
  webpack: (config, { isServer }) => {
    // Remove informações sensíveis do bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
