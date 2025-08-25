import crypto from "crypto";

interface GitHubPayload {
  ref: string;
  repository: {
    name: string;
    full_name?: string;
  };
  pusher: {
    name: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

async function sendTestWebhook() {
  const payload: GitHubPayload = {
    ref: "refs/heads/main",
    repository: {
      name: "test-repo",
      full_name: "usuario/test-repo",
    },
    pusher: { name: "test-user" },
    commits: [
      {
        id: "abc123",
        message: "Commit de teste",
        author: {
          name: "Test User",
          email: "test@example.com",
        },
      },
    ],
  };

  const body = JSON.stringify(payload);

  // IMPORTANTE: Use o mesmo secret que está no seu banco de dados
  const secret = "seu-github-secret-aqui"; // Mude isso!

  // Criar assinatura válida do GitHub
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;

  console.log("Enviando webhook de teste...");
  console.log("URL:", "http://localhost:3000/api/webhooks/github");
  console.log("Event:", "push");
  console.log("Signature:", signature);

  try {
    const response = await fetch("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": signature,
        "x-github-delivery": `test-${Date.now()}`,
      },
      body,
    });

    console.log("\n--- RESPOSTA ---");
    console.log("Status:", response.status);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));

    const responseData = await response.json();
    console.log("Body:", JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log("\n✅ Webhook enviado com sucesso!");
    } else {
      console.log("\n❌ Erro no webhook");
    }
  } catch (error) {
    console.error("Erro ao enviar webhook:", error);
  }
}

// Função para testar múltiplos eventos
async function testMultipleWebhooks() {
  console.log("Testando múltiplos eventos...\n");

  // Teste 1: Push
  await sendTestWebhook();

  await new Promise((resolve) => setTimeout(resolve, 1000)); // Aguarda 1s

  // Teste 2: Pull Request
  await sendPullRequestWebhook();
}

async function sendPullRequestWebhook() {
  const payload = {
    action: "opened",
    number: 1,
    pull_request: {
      id: 123456,
      title: "Test PR",
      body: "Descrição do PR de teste",
      user: {
        login: "test-user",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "usuario/test-repo",
    },
  };

  const body = JSON.stringify(payload);
  const secret = "seu-github-secret-aqui"; // Mesmo secret
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;

  try {
    const response = await fetch("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-github-event": "pull_request",
        "x-hub-signature-256": signature,
        "x-github-delivery": `test-pr-${Date.now()}`,
      },
      body,
    });

    console.log("\n--- PULL REQUEST WEBHOOK ---");
    console.log("Status:", response.status);
    console.log("Response:", await response.json());
  } catch (error) {
    console.error("Erro no PR webhook:", error);
  }
}

// Executa o teste
if (require.main === module) {
  console.log("🧪 Iniciando testes de webhook...\n");

  // Descomente a linha que quiser usar:
  sendTestWebhook(); // Teste simples
  // testMultipleWebhooks();   // Múltiplos testes
}
