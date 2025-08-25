import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "webhook-gateway",
  name: "Webhook Gateway",
});

export async function enqueueWebhookProcessing(eventId: string) {
  await inngest.send({
    name: "webhook/process",
    data: { eventId },
  });
}
