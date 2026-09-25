/**
 * Server-only helpers for the AI-backed summary features.
 * Every call goes to a Responses API with streaming, and the stream is
 * consumed here so callers get plain data back.
 *
 * Two providers are supported, chosen by which key is present in the
 * environment:
 * - OPENAI_API_KEY: calls OpenAI directly. Meant for local testing only —
 *   set it in .env.local, which is gitignored and never reaches Lovable.
 * - LOVABLE_API_KEY: calls Lovable's AI gateway. This is what the deployed
 *   (Lovable-hosted) app uses.
 * When both are absent, the caller falls back to its own non-AI behaviour
 * (see e.g. buildSynthesis's localBackend branch in ckd.functions.ts).
 */

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const LOVABLE_MODEL = "openai/gpt-6-astra";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env["OPENAI_MODEL"] || "gpt-5";

type JsonSchema = Record<string, unknown>;

type ResponsesProvider = {
  gateway: string;
  model: string;
  headers: Record<string, string>;
};

function responsesProvider(): ResponsesProvider {
  const openAiKey = process.env["OPENAI_API_KEY"];
  if (openAiKey) {
    return {
      gateway: OPENAI_ENDPOINT,
      model: process.env["OPENAI_RESPONSES_MODEL"] ?? OPENAI_MODEL,
      headers: { Authorization: `Bearer ${openAiKey}` },
    };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      gateway: LOVABLE_GATEWAY,
      model: LOVABLE_MODEL,
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
    };
  }

  throw new Error("AI is not configured for this project.");
}

async function callResponses(body: Record<string, unknown>): Promise<string> {
  const openaiKey = process.env["OPENAI_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!openaiKey && !lovableKey) throw new Error("AI is not configured for this project.");

  const { url, headers, model } = openaiKey
    ? {
        url: OPENAI_ENDPOINT,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        model: OPENAI_MODEL,
      }
    : {
        url: LOVABLE_GATEWAY,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey!,
          "X-Lovable-AIG-SDK": "fetch",
        },
        model: LOVABLE_MODEL,
      };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      store: false,
      ...body,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && event.delta) {
          text += event.delta;
        } else if (event.type === "response.completed" && !text) {
          text = event.response?.output_text ?? "";
        }
      } catch {
        // ignore keep-alive / non-JSON lines
      }
    }
  }

  return text.trim();
}

export async function aiText(instructions: string, input: string): Promise<string> {
  return callResponses({ instructions, input });
}

export async function aiJson<T>(
  instructions: string,
  input: string,
  name: string,
  schema: JsonSchema,
): Promise<T | null> {
  const text = await callResponses({
    instructions,
    input,
    text: { format: { type: "json_schema", name, schema, strict: true } },
  });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Shared guardrails for every prompt in this product. */
export const GUARDRAILS = `You support a values-clarification conversation for a person with chronic kidney disease, before their next consultation with a renal coordinator.
Hard rules:
- Never recommend, rank, compare or score treatment options (dialysis, transplant, conservative care).
- Never diagnose, stage disease, or interpret clinical results.
- Never give medical advice. You organise and reflect what the person says; nothing more.
- Never replace the consultation. If something needs clinical input, say it can be raised with the renal coordinator.
- Keep language extremely simple, warm and calm. Most users are in their 60s or 70s.
- Use Simplified Chinese characters for all Chinese text, including reflections, summaries, and quoted phrases. Do not use Traditional Chinese characters.
- Write Chinese first (Simplified), then the same thing in short plain English on a new line prefixed with "EN: ".`;
