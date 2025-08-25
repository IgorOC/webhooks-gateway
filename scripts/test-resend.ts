import crypto from "crypto";

async function sendResendWebhook() {
  const payload = {
    type: "email.delivered",
    created_at: new Date().toISOString(),
    data: {
      email_id: "test_email_123",
      to: ["user@example.com"],
      from: "noreply@example.com",
      subject: "Test Email",
      created_at: new Date().toISOString(),
    },
  };

  const body = JSON.stringify(payload);
  const secret = ""; // deve bater com sua fonte "resend"
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;

  const res = await fetch("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "resend-signature": signature,
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
  console.log("🧪 Testando Resend...");
  sendResendWebhook();
}
