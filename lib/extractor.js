/**
 * extractor.js — Task extraction from conversation using Gemini.
 * Returns structured lists of completed tasks, pending tasks, and next steps.
 */

import { callGemini } from "./gemini.js";
import { getApiKey } from "./storage.js";

/**
 * Extract task lists from a conversation.
 *
 * @param {object[]} messages - Array of {role, content} message objects.
 * @returns {Promise<{completed: string[], pending: string[], next_steps: string[]}>}
 */
export async function extractTasks(messages) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  // Build transcript (truncate very long conversations to last 30 messages for context)
  const recent = messages.slice(-30);
  const transcript = recent
    .map((m) => {
      const role = m.role === "user" ? "USER" : "ASSISTANT";
      return `[${role}]\n${m.content}`;
    })
    .join("\n\n---\n\n");

  const prompt = `From this developer conversation extract a task list. Return ONLY JSON:
{
  "completed": ["task"],
  "pending": ["task"],
  "next_steps": ["step"]
}
No markdown. No explanation.

Conversation:
${transcript}`;

  const rawResponse = await callGemini(prompt, apiKey, {
    temperature: 0.1,
    maxOutputTokens: 512
  });

  // Strip any markdown fences
  const cleaned = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let tasks;
  try {
    tasks = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Failed to parse task extraction response."
    );
  }

  // Normalize: ensure all arrays exist
  return {
    completed: Array.isArray(tasks.completed) ? tasks.completed : [],
    pending: Array.isArray(tasks.pending) ? tasks.pending : [],
    next_steps: Array.isArray(tasks.next_steps) ? tasks.next_steps : []
  };
}
