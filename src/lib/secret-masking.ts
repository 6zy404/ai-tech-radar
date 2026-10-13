// Masks the delivery secrets this project knows how to recognise wherever
// they turn up as text: in an endpoint URL shown in the workspace, in a
// workflow-event snapshot, in a task-runner message, in an error string.
//
// Three of the supported platforms put the secret in the URL *path*, where
// a query-parameter mask never looks: a Feishu bot webhook ends in
// `/open-apis/bot/v2/hook/<token>`, a Discord webhook in
// `/api/webhooks/<id>/<token>`, and the Telegram Bot API addresses a bot as
// `/bot<id>:<secret>/<method>`. Until 2026-10-13 `maskEndpointUrl` masked
// only the query, so a Feishu address was displayed in full.

const queryParamPattern =
  /([?&](?:token|key|secret|signature|auth|access_token)=)[^&\s#]+/gi;
const bareQueryParamPattern =
  /\b((?:token|key|secret|signature|auth|access_token)=)[^&\s#]+/gi;
const telegramPathPattern = /\bbot(\d+):[A-Za-z0-9_-]+/g;
// A bot token outside a URL, e.g. echoed in a message. Real tokens are a
// numeric bot id, a colon and a 35-character secret; 20 is a safe floor.
const telegramBareTokenPattern = /\b(\d{5,}):[A-Za-z0-9_-]{20,}\b/g;
const discordWebhookPattern = /(\/api\/webhooks\/\d+\/)[A-Za-z0-9_.-]+/gi;
const feishuHookPattern = /(\/open-apis\/bot\/v2\/hook\/)[A-Za-z0-9_-]+/gi;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function maskTelegramBotToken(token: string | undefined): string {
  const trimmed = token?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  const separator = trimmed.indexOf(":");

  return separator > 0 ? `${trimmed.slice(0, separator)}:***` : "***";
}

export function maskSecretsInText(value: string): string {
  return value
    .replace(telegramPathPattern, "bot$1:***")
    .replace(telegramBareTokenPattern, "$1:***")
    .replace(discordWebhookPattern, "$1***")
    .replace(feishuHookPattern, "$1***")
    .replace(queryParamPattern, "$1***")
    .replace(bareQueryParamPattern, "$1***")
    .replace(bearerPattern, "Bearer ***");
}

export function maskEndpointUrl(endpointUrl: string): string {
  if (endpointUrl.startsWith("mock://")) {
    return maskSecretsInText(endpointUrl);
  }

  try {
    const url = new URL(endpointUrl);

    if (url.username) {
      url.username = "***";
    }

    if (url.password) {
      url.password = "***";
    }

    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|signature|auth/i.test(key)) {
        url.searchParams.set(key, "***");
      }
    }

    return maskSecretsInText(url.toString());
  } catch {
    return maskSecretsInText(endpointUrl);
  }
}
