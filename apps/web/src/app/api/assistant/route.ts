import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildRequest, chunkDocs, createRateLimiter, interpretResponse, retrieve, suggestionsFrom, validateQuestion, type AssistantResult } from "@/lib/assistant-core";
import { issuanceSourceDocs, staticSourceDocs } from "@/lib/assistant-sources";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(8, 60_000);

function configured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Answers a tax question from TaxGabay's own content, with citations, or refuses. */
export async function POST(request: Request) {
  const json = (r: AssistantResult, status = 200) => NextResponse.json(r, { status });
  let body: { question?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ status: "error", message: "Send your question as JSON." }, 400);
  }
  const invalid = validateQuestion(body.question);
  if (invalid) return json({ status: "error", message: invalid }, 400);
  const question = String(body.question).trim();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter(ip, Date.now())) return json({ status: "error", message: "Too many questions in a minute. Wait a moment and try again." }, 429);

  const allowUnverified = process.env.ASSISTANT_ALLOW_UNVERIFIED === "1";
  const chunks = chunkDocs([...staticSourceDocs(), ...(await issuanceSourceDocs())]);
  const { chunks: picked } = retrieve(chunks, question, { allowUnverified });

  if (picked.length === 0) {
    // Point to the closest pages, even unverified ones, without generating an answer.
    const near = retrieve(chunks, question, { allowUnverified: true }).chunks;
    return json({ status: "refused", reason: "no_sources", suggestions: suggestionsFrom(near) });
  }
  if (!configured()) return json({ status: "unavailable" });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      ...buildRequest(question, picked),
    });
    return json(interpretResponse(response, picked));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ status: "error", message: "The assistant is busy. Try again in a minute." }, 503);
    if (e instanceof Anthropic.AuthenticationError) return json({ status: "error", message: "The assistant is not set up correctly (API key)." }, 503);
    if (e instanceof Anthropic.APIError) return json({ status: "error", message: `The assistant could not answer right now (${e.status ?? "network"}).` }, 502);
    return json({ status: "error", message: "The assistant could not answer right now." }, 500);
  }
}
