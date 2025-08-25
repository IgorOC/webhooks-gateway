import crypto from "crypto";

async function sendStripeWebhook() {
  const payload = {
    id: "evt_test_stripe_123",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_123",
        amount: 2000,
        currency: "usd",
        status: "succeeded",
      },
    },
    created: Math.floor(Date.now() / 1000),
  };

  const body = JSON.stringify(payload);
  const secret = ""; // deve bater com sua fonte "stripe"
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadToSign = `${timestamp}.${body}`;
  const v1 = crypto
    .createHmac("sha256", secret)
    .update(payloadToSign, "utf8")
    .digest("hex");

  const res = await fetch("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${v1}`,
    },
    body,
  });

  const ct = res.headers.get("content-type") || "";
  const out = ct.includes("application/json")
    ? await res.json()
    : await res.text();
  console.log("Status:", res.status);
  console.log("Body:", out);
}

if (require.main === module) {
  console.log("🧪 Testando Stripe...");
  sendStripeWebhook();
}
