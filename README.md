# Gateway de Webhook

Um sistema de manipulação de webhooks pronto para produção construído com Next.js, Supabase e Inngest. Gerencia webhooks do Stripe, GitHub, Resend e outros provedores com verificação de assinatura, idempotência e processamento assíncrono.

## Funcionalidades

- **Verificação de Assinatura**: Validação HMAC para todos os provedores suportados
- **Idempotência**: Previne processamento duplicado de eventos
- **Processamento Assíncrono**: Processamento baseado em filas com tentativas automáticas
- **Trilha de Auditoria Completa**: Histórico completo de eventos e rastreamento de status
- **Dashboard Administrativo**: Interface web para monitoramento e reprocessamento de eventos falhados
- **Suporte Multi-Provedor**: Adaptadores prontos para uso para serviços populares

## Provedores Suportados

- **Stripe**: Webhooks de pagamento com validação Stripe-Signature
- **GitHub**: Webhooks de repositório com verificação HMAC SHA-256
- **Resend**: Webhooks de entrega de email
- Facilmente extensível para outros provedores

## Início Rápido

1. **Clone e instale dependências**

```bash
git clone <repo-url>
cd webhook-gateway
npm install
```

2. **Configure variáveis de ambiente**

```bash
cp .env.example .env.local
```

Preencha suas credenciais:

- URL do projeto Supabase e chaves
- Chaves do Inngest
- Segredos de webhook para cada provedor

3. **Configure o banco de dados**

```bash
# Execute a migração para criar tabelas
npx supabase db push
```

4. **Atualize as fontes de webhook**

Atualize a tabela `webhook_sources` no Supabase com seus segredos reais:

```sql
UPDATE webhook_sources SET secret = 'seu-segredo-stripe-real' WHERE name = 'stripe';
UPDATE webhook_sources SET secret = 'seu-segredo-github-real' WHERE name = 'github';
UPDATE webhook_sources SET secret = 'seu-segredo-resend-real' WHERE name = 'resend';
```

5. **Inicie o servidor de desenvolvimento**

```bash
npm run dev
```

## Uso

### Configure Webhooks dos Provedores

Aponte seus provedores de webhook para estes endpoints:

- **Stripe**: `https://seudominio.com/api/webhooks/stripe`
- **GitHub**: `https://seudominio.com/api/webhooks/github`
- **Resend**: `https://seudominio.com/api/webhooks/resend`

### Monitore Eventos

Visite `/webhooks` para ver o dashboard administrativo onde você pode:

- Ver todos os eventos de webhook
- Filtrar por status e provedor
- Reprocessar eventos falhados
- Monitorar status de processamento

## Endpoints da API

- `GET /api/webhooks` - Listar eventos de webhook
- `POST /api/webhooks/{provider}` - Receber webhooks
- `POST /api/webhooks/replay/{id}` - Reprocessar evento específico

## Arquitetura

```
Provedor de Webhook → Rota da API → Verificação de Assinatura → Banco de Dados → Fila Inngest → Processamento
```

1. **Webhook recebido** no endpoint específico do provedor
2. **Assinatura validada** usando método do provedor
3. **Evento armazenado** no banco de dados com verificação de idempotência
4. **Job enfileirado** para processamento assíncrono
5. **Processamento gerenciado** pelo Inngest com tentativas

## Schema do Banco de Dados

### webhook_sources

- Armazena configurações de provedores e segredos

### webhook_events

- Armazena todos os eventos de webhook recebidos
- Rastreia status de processamento e tentativas
- Mantém trilha de auditoria completa

## Extensão

Adicione novos provedores:

1. Criando nova rota: `src/app/api/webhooks/[provider]/route.ts`
2. Adicionando lógica de verificação de assinatura
3. Adicionando provedor ao banco: `INSERT INTO webhook_sources...`
4. Atualizando lógica de processamento em `lib/inngest/functions.ts`

## Testes

```bash
npm run test
```

## Deploy

Faça deploy para Vercel, Railway ou qualquer plataforma de hospedagem Node.js. Certifique-se de:

1. Definir todas as variáveis de ambiente
2. Executar migrações do banco de dados
3. Configurar endpoint webhook do Inngest
4. Atualizar URLs de webhook nos dashboards dos provedores


