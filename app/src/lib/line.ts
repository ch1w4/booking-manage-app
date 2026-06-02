import { Client, validateSignature } from "@line/bot-sdk";

let _client: Client | null = null;

export function getLineClient(): Client {
  if (!_client) {
    _client = new Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    });
  }
  return _client;
}

export function validateLineSignature(body: string, signature: string): boolean {
  return validateSignature(body, process.env.LINE_CHANNEL_SECRET ?? "", signature);
}
