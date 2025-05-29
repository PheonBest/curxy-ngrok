import process from "node:process";
import { getRandomPort } from "get-port-please";
import { cli, define } from "gunshi";
import terminalLink from "terminal-link";
import { bold, green, italic } from "yoctocolors";
import * as ngrok from "@ngrok/ngrok";

import json from "./deno.json" with { type: "json" };
import { validateURL } from "./util.ts";
import { createApp } from "./proxy.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const NGROK_AUTHTOKEN = Deno.env.get("NGROK_AUTHTOKEN");
const NGROK_DOMAIN = Deno.env.get("NGROK_DOMAIN");

const command = define({
  toKebab: true,
  args: {
    endpoint: {
      type: "custom",
      alias: "e",
      default: "http://localhost:11434",
      description: "The endpoint to Ollama server.",
      parse: validateURL,
    },
    openaiEndpoint: {
      type: "custom",
      alias: "o",
      default: "https://api.openai.com",
      description: "The endpoint to OpenAI server.",
      parse: validateURL,
    },
    port: {
      type: "number",
      alias: "p",
      default: await getRandomPort(),
      description: "The port to run the server on. Default is random",
    },
    hostname: {
      type: "string",
      default: "127.0.0.1",
      description: "The hostname to run the server on.",
    },
    ngrok: {
      type: "boolean",
      alias: "n",
      default: true,
      negatable: true,
      description: "Use ngrok to tunnel the server",
    },
    ngrokDomain: {
      type: "string",
      default: NGROK_DOMAIN ?? undefined,
      description: "Custom subdomain for ngrok (requires paid ngrok account)",
    },
  },
  examples: [
    "curxy",

    "",

    "curxy --endpoint http://localhost:11434 --openai-endpoint https://api.openai.com --port 8800",

    "",

    "OPENAI_API_KEY=sk-123456 NGROK_AUTHTOKEN=your_token curxy --port 8800",
  ].join("\n"),

  async run(ctx) {
    const app = createApp({
      openAIEndpoint: ctx.values.openaiEndpoint,
      ollamaEndpoint: ctx.values.endpoint,
      OPENAI_API_KEY,
    });

    const serverPromise = Deno.serve(
      { port: ctx.values.port, hostname: ctx.values.hostname },
      app.fetch,
    );

    let ngrokUrl = null;
    if (ctx.values.ngrok) {
      if (!NGROK_AUTHTOKEN) {
        throw new Error("NGROK_AUTHTOKEN env variable is required for ngrok tunnel");
      }
      // Start ngrok process
      const listener = await ngrok.forward({
        addr: ctx.values.port,
        authtoken_from_env: true,
        domain: ctx.values.ngrokDomain,
      });

      ngrokUrl = listener.url();
      if (ngrokUrl) {
        console.log(
          `Server running at: ${bold(terminalLink(ngrokUrl, ngrokUrl))}\n`,
          green(
            `enter ${bold(terminalLink(`${ngrokUrl}/v1`, `${ngrokUrl}/v1`))} into ${italic(`Override OpenAl Base URL`)} section in cursor settings`,
          ),
        );
      } else {
        console.error("Failed to get ngrok public URL");
      }
    }
    await serverPromise;
  },
});

if (import.meta.main) {
  await cli(process.argv.slice(2), command, {
    name: json.name.split("/").at(-1) as string,
    description: "A proxy worker for using ollama in cursor",
    version: json.version,
  });
}
