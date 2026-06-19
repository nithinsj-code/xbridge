/**
 * compressor.js — Smart context compression using Gemini.
 * Summarizes a conversation into a structured JSON object to reduce token usage
 * when continuing conversations in another LLM.
 */

import { callGemini } from "./gemini.js";
import { getApiKey } from "./storage.js";

/**
 * Compress a conversation into a structured summary.
 *
 * @param {object[]} messages - Array of {role, content} message objects.
 * @returns {Promise<{compressed: object, tokenSavings: {original: number, estimated: number, percent: number}}>}
 */
export async function compressConversation(messages) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  // Build a plain-text transcript for the prompt
  const transcript = messages
    .map((m) => {
      const role = m.role === "user" ? "USER" : "ASSISTANT";
      return `[${role}]\n${m.content}`;
    })
    .join("\n\n---\n\n");

  const prompt = `You are a conversation summarizer. Given this conversation, return ONLY a valid JSON object:

{
  "project_title": "short project name (max 5 words)",
  "goals": ["goal 1", "goal 2"],
  "tech_stack": ["tech1", "tech2"],
  "completed_tasks": ["task 1", "task 2"],
  "pending_tasks": ["task 1", "task 2"],
  "key_decisions": ["decision 1"],
  "important_links": ["url1"],
  "recent_messages": ["summary of last 3 turns"],
  "summary": "2-3 sentence plain English summary"
}

Conversation:
${transcript}

Return ONLY valid JSON. No markdown fences. No explanation.`;

  const rawResponse = await callGemini(prompt, apiKey, {
    temperature: 0.1,
    maxOutputTokens: 1024
  });

  // Strip any accidental markdown fences if model misbehaves
  const cleaned = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let compressed;
  try {
    compressed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Failed to parse compression response. The model returned unexpected output."
    );
  }

  // Estimate token savings: rough approximation of chars/4
  const originalChars = transcript.length;
  const compressedChars = JSON.stringify(compressed).length;
  const originalTokens = Math.ceil(originalChars / 4);
  const compressedTokens = Math.ceil(compressedChars / 4);
  const savedTokens = Math.max(0, originalTokens - compressedTokens);
  const percent =
    originalTokens > 0
      ? Math.round((savedTokens / originalTokens) * 100)
      : 0;

  return {
    compressed,
    tokenSavings: {
      original: originalTokens,
      estimated: compressedTokens,
      saved: savedTokens,
      percent
    }
  };
}

/**
 * Build the "Continue in another LLM" context string from compressed data.
 *
 * @param {object} compressed - The structured summary from compressConversation.
 * @param {string} sourcePlatform - e.g. "ChatGPT", "Claude"
 * @returns {string}
 */
export function buildContinueContext(compressed, sourcePlatform) {
  const c = compressed;

  const goals =
    Array.isArray(c.goals) && c.goals.length
      ? c.goals.map((g) => `• ${g}`).join("\n")
      : "• (none listed)";

  const techStack =
    Array.isArray(c.tech_stack) && c.tech_stack.length
      ? c.tech_stack.join(", ")
      : "(none listed)";

  const completed =
    Array.isArray(c.completed_tasks) && c.completed_tasks.length
      ? c.completed_tasks.map((t) => `✓ ${t}`).join("\n")
      : "  (none)";

  const pending =
    Array.isArray(c.pending_tasks) && c.pending_tasks.length
      ? c.pending_tasks.map((t) => `◻ ${t}`).join("\n")
      : "  (none)";

  const recentMessages =
    Array.isArray(c.recent_messages) && c.recent_messages.length
      ? c.recent_messages.join("\n")
      : "(no recent messages)";

  const links =
    Array.isArray(c.important_links) && c.important_links.length
      ? "\n\nImportant Links:\n" + c.important_links.join("\n")
      : "";

  const decisions =
    Array.isArray(c.key_decisions) && c.key_decisions.length
      ? "\n\nKey Decisions:\n" +
        c.key_decisions.map((d) => `• ${d}`).join("\n")
      : "";

  return `[BRIDGE CONTEXT — Continuing from ${sourcePlatform}]

Project: ${c.project_title || "Untitled"}
Summary: ${c.summary || "(no summary)"}

Goals:
${goals}

Tech Stack: ${techStack}${decisions}

Completed:
${completed}

Pending:
${pending}

Recent context:
${recentMessages}${links}

Please continue helping with this project.`;
}

/**
 * Fallback: build a plain context string directly from messages
 * (used when compression hasn't been run yet).
 *
 * @param {object[]} messages
 * @param {string} title
 * @param {string} sourcePlatform
 * @returns {string}
 */
export function buildRawContext(messages, title, sourcePlatform) {
  const MAX_MESSAGES = 20; // Limit context size
  const recent = messages.slice(-MAX_MESSAGES);

  const transcript = recent
    .map((m) => {
      const label = m.role === "user" ? "User" : "Assistant";
      return `[${label}]\n${m.content}`;
    })
    .join("\n\n");

  return `[BRIDGE CONTEXT — Continuing from ${sourcePlatform}]

Project: ${title}

Recent Conversation:
${transcript}

Please continue helping with this project.`;
}
