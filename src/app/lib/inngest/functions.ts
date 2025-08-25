import { inngest } from "../inngest";
import { getWebhookEvent, updateWebhookStatus } from "../db";

export const processWebhook = inngest.createFunction(
  {
    id: "process-webhook",
    retries: 3,
  },
  { event: "webhook/process" },
  async ({ event, step }) => {
    const { eventId } = event.data;

    const webhookEvent = await step.run("get-webhook-event", async () => {
      return await getWebhookEvent(eventId);
    });

    if (!webhookEvent) {
      throw new Error(`Evento de webhook ${eventId} não encontrado`);
    }

    await step.run("update-status-processing", async () => {
      await updateWebhookStatus(eventId, "verified");
    });

    try {
      await step.run("process-event", async () => {
        const { event_type, payload } = webhookEvent;
        const eventPayload = payload as Record<string, unknown>;

        switch (event_type) {
          case "push":
          case "pull_request":
          case "issues":
            console.log(`Processando GitHub ${event_type}:`, {
              repository: (eventPayload.repository as Record<string, unknown>)
                ?.name,
              action: eventPayload.action,
            });
            break;

          case "checkout.session.completed":
          case "payment_intent.succeeded":
          case "invoice.payment_succeeded":
            console.log(`Processando Stripe ${event_type}:`, {
              id: eventPayload.id,
              amount: eventPayload.amount_total || eventPayload.amount,
            });
            break;

          case "email.delivered":
          case "email.bounced":
          case "email.complained":
            console.log(`Processando Resend ${event_type}:`, {
              email_id: eventPayload.email_id,
              to: eventPayload.to,
            });
            break;

          default:
            console.log(
              `Processando tipo de evento desconhecido: ${event_type}`
            );
        }
      });

      await step.run("update-status-success", async () => {
        await updateWebhookStatus(eventId, "processed");
      });
    } catch (error) {
      await step.run("update-status-failed", async () => {
        await updateWebhookStatus(
          eventId,
          "failed",
          error instanceof Error ? error.message : "Erro desconhecido"
        );
      });
      throw error;
    }
  }
);
