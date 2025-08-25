import crypto from "crypto";

type GitHubEventName = "push" | "pull_request";

interface GitHubPushPayload {
  ref: string;
  repository: { name: string; full_name?: string };
  pusher: { name: string };
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
  }>;
}

interface GitHubPullRequestPayload {
  action: "opened" | "closed" | "synchronize" | string;
  number: number;
  pull_request: {
    id: number;
    title: string;
    body?: string;
    user: { login: string };
  };
  repository: { name: string; full_name?: string };
}

type GitHubPayload = GitHubPushPayload | GitHubPullRequestPayload;

function buildPayload(event: GitHubEventName): GitHubPayload {
  if (event === "push") {
    const pushPayload: GitHubPushPayload = {
      ref: "refs/heads/main",
      repository: { name: "test-repo", full_name: "usuario/test-repo" },
      pusher: { name: "test-user" },
      commits: [
        {
          id: "abc123",
          message: "Commit de teste",
          author: { name: "Test User", email: "test@example.com" },
        },
      ],
    };
    return pushPayload;
  }

  const prPayload: GitHubPullRequestPayload = {
    action: "opened",
    number: 1,
    pull_request: {
      id: 123456,
      title: "Test PR",
      body: "Descrição do PR de teste",
      user: { login: "test-user" },
    },
    repository: { name: "test-repo", full_name: "usuario/test-repo" },
  };
  return prPayload;
}

async function sendGitHubWebhook(event: GitHubEventName = "push") {
  const payload = buildPayload(event);
  const body = JSON.stringify(payload);

  const secret = ""; // deve bater com o secret da fonte "github" no seu DB
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;

  const res = await fetch("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": signature,
      "x-github-delivery": `test-${Date.now()}`,
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
  console.log("🧪 Testando GitHub push...");
  sendGitHubWebhook("push").then(() => {
    setTimeout(() => {
      console.log("🧪 Testando GitHub pull_request...");
      sendGitHubWebhook("pull_request");
    }, 1000);
  });
}
