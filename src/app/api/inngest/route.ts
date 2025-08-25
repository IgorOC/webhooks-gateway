import { serve } from "inngest/next";
import { inngest } from "@/app/lib/inngest";
import { processWebhook } from "@/app/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processWebhook],
});
