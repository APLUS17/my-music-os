#!/usr/bin/env node
// Posts a release announcement to a Discord channel via webhook.
//
// Setup (one-time): in your Discord server go to
//   Server Settings -> Integrations -> Webhooks -> New Webhook
// pick the channel, copy the webhook URL, and set it as DISCORD_WEBHOOK_URL
// in your environment (e.g. in .env.local or your shell).
//
// Usage:
//   node scripts/notify-discord.mjs "v0.2.0" "Fixed recording sync, added export."
//   npm run notify:discord -- "v0.2.0" "Fixed recording sync, added export."

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const [version, ...messageParts] = process.argv.slice(2);
const message = messageParts.join(" ");

if (!webhookUrl) {
  console.error(
    "Missing DISCORD_WEBHOOK_URL env var.\n" +
    "Create one in Discord: Server Settings -> Integrations -> Webhooks -> New Webhook,\n" +
    "then set DISCORD_WEBHOOK_URL to its URL."
  );
  process.exit(1);
}

if (!version) {
  console.error('Usage: node scripts/notify-discord.mjs "<version>" "<changelog message>"');
  process.exit(1);
}

const content = [
  `**Lyriq Lab ${version} is live**`,
  message || "No changelog provided.",
].join("\n");

const res = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content }),
});

if (!res.ok) {
  console.error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log("Posted release announcement to Discord.");
