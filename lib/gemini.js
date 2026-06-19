/**
 * gemini.js — Gemini 1.5 Flash API wrapper for Bridge extension.
 * Uses API key as a URL query parameter (standard Gemini REST approach).
 * No OAuth required — user provides their own key from aistudio.google.com.
 */

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Cache the discovered model name so we don't fetch the list every time
let cachedModelName = null;

async function getBestModel(apiKey) {
  if (cachedModelName) return cachedModelName;
  
  try {
    const res = await fetch(`${GEMINI_BASE_URL}?key=${apiKey}`);
    if (!res.ok) return "gemini-2.0-flash"; // Fallback guess
    const data = await res.json();
    
    // Look for a model with "flash" in the name, prioritize newer versions
    const models = (data.models || [])
      .filter(m => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent"))
      .sort((a, b) => b.name.localeCompare(a.name)); // Rough sort to get newest (e.g., gemini-2.5-flash > gemini-1.5-flash)
      
    if (models.length > 0) {
      cachedModelName = models[0].name.replace("models/", "");
      return cachedModelName;
    }
  } catch (e) {
    console.warn("Failed to list models, using fallback", e);
  }
  
  return "gemini-2.0-flash"; // Ultimate fallback
}

/**
 * Call the Gemini API with a text prompt.
 *
 * @param {string} prompt - The full text prompt to send.
 * @param {string} apiKey - The user's Gemini API key.
 * @param {object} [options] - Optional generation config overrides.
 * @param {number} [options.temperature=0.2]
 * @param {number} [options.maxOutputTokens=2048]
 * @returns {Promise<string>} - The model's text response.
 * @throws {Error} - With a user-friendly message on failure.
 */
export async function callGemini(prompt, apiKey, options = {}) {
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const modelName = await getBestModel(apiKey);
  const url = `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 2048
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
  } catch (networkErr) {
    throw new Error(
      "Network error. Check your internet connection and try again."
    );
  }

  if (!response.ok) {
    let errData;
    try {
      errData = await response.json();
    } catch {
      errData = {};
    }

    const status = response.status;
    const apiMsg = errData?.error?.message || "";

    // Provide meaningful user-facing errors for common cases
    if (status === 400) {
      throw new Error(`INVALID_KEY: Invalid API key. Check and try again.`);
    }
    if (status === 403) {
      throw new Error(`INVALID_KEY: API key unauthorized. Check and try again.`);
    }
    if (status === 429) {
      throw new Error(
        "RATE_LIMIT: Free tier limit reached. Try again in a minute."
      );
    }

    throw new Error(apiMsg || `Gemini API error (${status}).`);
  }

  const data = await response.json();

  // Safely extract text from response
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    // Could be a safety block or unexpected format
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY") {
      throw new Error("Response blocked by safety filters. Try rephrasing.");
    }
    throw new Error("Empty response from Gemini. Please try again.");
  }

  return text;
}

/**
 * Validate an API key by sending a minimal test prompt.
 * Returns { valid: true } or { valid: false, reason: string }.
 *
 * @param {string} apiKey
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function validateApiKey(apiKey) {
  try {
    await callGemini("Say OK", apiKey, {
      maxOutputTokens: 10,
      temperature: 0
    });
    return { valid: true };
  } catch (err) {
    const msg = err.message || "";
    if (msg.startsWith("INVALID_KEY:")) {
      return { valid: false, reason: msg.replace("INVALID_KEY: ", "") };
    }
    if (msg.startsWith("RATE_LIMIT:")) {
      // Key is valid but rate-limited — treat as valid
      return { valid: true };
    }
    return {
      valid: false,
      reason: msg || "Could not validate key. Check your connection."
    };
  }
}
