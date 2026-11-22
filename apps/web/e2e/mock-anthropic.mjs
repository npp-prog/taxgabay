/* global process, console */
// Minimal stand-in for POST /v1/messages used by the assistant e2e tests.
// Answers by citing the first sentence of the first document; replies NO_ANSWER when the
// question mentions "France", and answers without citations when it mentions "uncited".
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 3199);

createServer((req, res) => {
  if (req.method === "GET") return res.writeHead(200).end("ok");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body || "{}");
    const content = json.messages?.[0]?.content ?? [];
    const docs = content.filter((b) => b.type === "document");
    const question = content.find((b) => b.type === "text")?.text ?? "";
    const reply = (blocks) =>
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: json.model, content: blocks, stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }),
      );
    if (/france/i.test(question)) return reply([{ type: "text", text: "NO_ANSWER", citations: null }]);
    if (/uncited/i.test(question)) return reply([{ type: "text", text: "It is 5%.", citations: null }]);
    const text = docs[0]?.source?.data ?? "";
    const sentence = (text.match(/[^.]*\./)?.[0] ?? text.slice(0, 60)).trim();
    reply([
      { type: "text", text: "According to TaxGabay's guide, ", citations: null },
      { type: "text", text: sentence, citations: [{ type: "char_location", cited_text: sentence, document_index: 0, document_title: docs[0]?.title ?? null, start_char_index: 0, end_char_index: sentence.length, file_id: null }] },
    ]);
  });
}).listen(PORT, () => console.log(`mock anthropic on ${PORT}`));
