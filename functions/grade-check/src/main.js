/**
 * Appwrite Function: grade-check
 * Grades a learner's free-text practice check with an open-source model via Groq.
 *
 * Groq decommissioned llama-3.1-8b-instant on 2026-08-16; default is GPT-OSS 20B.
 *
 * Env:
 *   GROQ_API_KEY  (required)
 *   GROQ_MODEL    (optional, default openai/gpt-oss-20b)
 *
 * Body JSON: { question, rubric, exemplar, userAnswer, focus?, taskWork? }
 * Response JSON: { grade: "correct"|"mostly_correct"|"incorrect", feedback: string }
 */
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";

const GRADE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "practice_grade",
    strict: true,
    schema: {
      type: "object",
      properties: {
        grade: {
          type: "string",
          enum: ["correct", "mostly_correct", "incorrect"],
        },
        feedback: { type: "string" },
      },
      required: ["grade", "feedback"],
      additionalProperties: false,
    },
  },
};

function normalizeKey(raw) {
  let k = String(raw || "").trim().replace(/^["']|["']$/g, "");
  return k.replace(/^Bearer\s+/i, "").trim();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Appwrite-Project, X-Appwrite-Key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function publicError(groqMessage) {
  const msg = String(groqMessage || "");
  if (/invalid api key|invalid_api_key|unauthorized/i.test(msg)) {
    return "AI grading is temporarily unavailable (invalid Groq API key).";
  }
  if (/decommission|does not exist|model_not_found|model.*not.*found/i.test(msg)) {
    return "AI grading is temporarily unavailable (the model was retired).";
  }
  if (/rate limit|too many requests/i.test(msg)) {
    return "The grader is busy. Wait a moment and try again.";
  }
  return msg || "Grading service failed.";
}

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

async function groqComplete(apiKey, model, messages) {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + apiKey,
      "user-agent": "yt2site-grade-check/1.0",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 1024,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: GRADE_SCHEMA,
      messages,
    }),
  });
  const groqData = await groqRes.json();
  return { groqRes, groqData };
}

function isRetiredModelError(groqData) {
  const msg = ((groqData && groqData.error && groqData.error.message) || "").toLowerCase();
  const code = ((groqData && groqData.error && groqData.error.code) || "").toLowerCase();
  return (
    /decommission|model_not_found|does not exist|no longer (available|served)/.test(msg) ||
    code === "model_not_found" ||
    code === "model_decommissioned"
  );
}

export { extractJson, publicError, normalizeKey };

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") {
    return res.send("", 204, corsHeaders());
  }

  const apiKey = normalizeKey(process.env.GROQ_API_KEY);
  if (!apiKey) {
    error("GROQ_API_KEY is not set");
    return res.json({ error: "Grading is not configured (missing API key)." }, 500);
  }

  let body;
  try {
    body =
      typeof req.bodyJson === "object" && req.bodyJson
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

  const prompt = `You are grading a short written answer from a student practicing study skills.

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

Respond with ONLY valid JSON:
{"grade":"correct"|"mostly_correct"|"incorrect","feedback":"2-4 sentences. Be encouraging and specific. Say what worked and what to improve. Do not reveal a full model answer word-for-word."}`;

  const messages = [
    {
      role: "system",
      content: "You grade short study-skill answers. Reply with JSON only.",
    },
    { role: "user", content: prompt },
  ];

  const requested = (process.env.GROQ_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  try {
    let model = requested;
    let { groqRes, groqData } = await groqComplete(apiKey, model, messages);

    if (!groqRes.ok && isRetiredModelError(groqData) && model !== FALLBACK_MODEL) {
      log("Model " + model + " unavailable; retrying " + FALLBACK_MODEL);
      model = FALLBACK_MODEL;
      ({ groqRes, groqData } = await groqComplete(apiKey, model, messages));
    }

    if (!groqRes.ok) {
      error("Groq error: " + JSON.stringify(groqData));
      const msg = (groqData.error && groqData.error.message) || "Grading service failed.";
      return res.json({ error: publicError(msg) }, 502);
    }

    const message = ((groqData.choices || [])[0] || {}).message || {};
    const text = String(message.content || message.reasoning || "").trim();
    const parsed = extractJson(text);

    if (!parsed) {
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
