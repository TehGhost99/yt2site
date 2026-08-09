/**
 * Appwrite Function: grade-check
 * Grades a learner's free-text practice check with an open-source model via Groq
 * (Llama — free tier, no credit card required for light personal use).
 *
 * Env: GROQ_API_KEY
 * Body JSON: { question, rubric, exemplar, userAnswer, focus?, taskWork? }
 * Response JSON: { grade: "correct"|"mostly_correct"|"incorrect", feedback: string }
 */
const MODEL = "llama-3.1-8b-instant";

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") {
    return res.send("", 204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Appwrite-Project, X-Appwrite-Key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    error("GROQ_API_KEY is not set");
    return res.json({ error: "Grading is not configured (missing API key)." }, 500);
  }

  let body;
  try {
    body = typeof req.bodyJson === "object" && req.bodyJson
      ? req.bodyJson
      : JSON.parse(req.body || "{}");
  } catch (e) {
    return res.json({ error: "Invalid JSON body." }, 400);
  }

  const question = (body.question || "").trim();
  const rubric = (body.rubric || "").trim();
  const exemplar = (body.exemplar || "").trim();
  const userAnswer = (body.userAnswer || "").trim();
  const focus = (body.focus || "").trim();
  const taskWork = (body.taskWork || "").trim();

  if (!question || !rubric || !userAnswer) {
    return res.json({ error: "question, rubric, and userAnswer are required." }, 400);
  }

  const prompt = `You are grading a short written answer from a student learning Latin American Spanish as an absolute beginner. Accept minor spelling issues if meaning is clear. Prefer tú/usted forms used in Latin America; do not require vosotros.

Focus of today's practice: ${focus || "(not specified)"}
Question: ${question}

Grading rubric (what a good answer must show):
${rubric}

Exemplar of a strong answer (for your calibration only — do NOT quote it back verbatim as if the student wrote it):
${exemplar || "(none provided)"}

${taskWork ? `Student's earlier practice attempt (context only):\n${taskWork.slice(0, 1500)}\n` : ""}
Student's written answer to grade:
${userAnswer.slice(0, 2500)}

Grade the answer as exactly one of:
- correct — captures the core idea(s) in the rubric; wording can differ
- mostly_correct — partially right or missing an important piece, but shows real understanding
- incorrect — misses the point, contradicts the rubric, or is too vague/empty to judge

Respond with ONLY valid JSON (no markdown fences):
{"grade":"correct"|"mostly_correct"|"incorrect","feedback":"2-4 sentences. Be encouraging and specific. Say what worked and what to improve. Do not reveal a full model answer word-for-word."}`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You grade short study-skill answers. Reply with JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      error("Groq error: " + JSON.stringify(groqData));
      const msg = (groqData.error && groqData.error.message) || "Grading service failed.";
      return res.json({ error: msg }, 502);
    }

    const text = (
      (((groqData.choices || [])[0] || {}).message || {}).content || ""
    ).trim();

    let parsed;
    try {
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      log("Raw model text: " + text);
      return res.json({
        grade: "mostly_correct",
        feedback: text.slice(0, 600) || "Could not parse a structured grade. Please retry.",
      });
    }

    const allowed = { correct: 1, mostly_correct: 1, incorrect: 1 };
    const grade = allowed[parsed.grade] ? parsed.grade : "mostly_correct";
    const feedback = String(parsed.feedback || "No feedback returned.").slice(0, 1200);

    return res.json({ grade, feedback });
  } catch (e) {
    error(String(e && e.message ? e.message : e));
    return res.json({ error: "Unexpected grading error." }, 500);
  }
};
