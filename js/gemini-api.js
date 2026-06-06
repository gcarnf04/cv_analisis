/**
 * gemini-api.js — Google Gemini API communication for CV Brutal Auditor
 */

const GeminiAPI = (() => {

  const MODEL   = 'gemini-2.5-flash-lite';
  const MAX_TOKENS = 1500;

  const SYSTEM_PROMPT = `You are a savage, brutally honest, and experienced senior technical recruiter who does not sugarcoat anything. You audit resumes/CVs ruthlessly.
You will receive the plain text extracted from a user's resume/CV. 

Critique it sincerely, directly, and without corporate fluff. Be critical about formatting issues, buzzword inflation, lack of metrics, weak impact descriptions, and employment gaps or generic skill lists.

RESPOND ENTIRELY IN ENGLISH.

## OUTPUT FORMAT (strict Markdown — no deviations)

## 🎯 Quality Score: [0–100]
[One highly critical and direct sentence explaining why it got this exact score.]

## 💀 Brutal Audit
[Write a 2-paragraph sincere, direct, and slightly roasting critique of their CV. Call out useless details, bad structures, formatting traps, cliches, or lack of quantitative achievements. Do not be polite; be real.]

## 🔧 5 Key Improvements
[Provide a numbered list of EXACTLY 5 concrete, actionable suggestions. Be highly specific. If the CV is perfect and there are no improvements, state that clearly, but normally there are always 5 key improvements. Do not provide more or less than 5 points.]

## 🌟 Strengths
[A brief list of 2-3 genuine strengths of the resume (if any) so they know what to keep.]

## SCORING RULES (apply mathematically, show no working):
- Start at 100.
- Missing quantitative achievements (metrics, %, $, numbers): -15
- Useless details (e.g., high school education for senior roles, marital status, references available on request): -10
- Too many generic buzzwords (e.g., "detail-oriented", "team player", "problem solver"): -10
- Poor structure or layout issues implied by content formatting: -10
- Weak action verbs (e.g., "responsible for", "assisted with" instead of "engineered", "championed"): -10
- Useless "objective" or generic executive summary: -5
- Length/volume mismatches (e.g., 5 pages for junior, or 1 paragraph for senior): -10
- Minimum: 0. Maximum: 100. Round to integer.

## TONE & FORMAT RULES:
- Do not hedge. Do not apologize. Do not mention that you are an AI.
- Speak directly to the applicant ("Your resume...", "You need to...").
- Keep total response length between 300 and 500 words.`;

  let abortController = null;

  async function callWithStreaming(resumeText, apiKey, { onToken, onStatus, onDone, onError }) {
    abortController = new AbortController();

    const userContent = `Here is the extracted text of the CV to audit:\n\n${resumeText}`;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    try {
      onStatus('Connecting to Gemini API…', 20);
      const resp = await fetch(API_URL, {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: MAX_TOKENS }
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${resp.status}`;
        onError(categorizeError(resp.status, msg));
        return;
      }

      onStatus('Streaming brutal audit…', 60);
      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) onToken(text);
          } catch {}
        }
      }

      onStatus('Done', 100);
      onDone();

    } catch (err) {
      if (err.name === 'AbortError') {
        onDone(true); // cancelled
      } else {
        onError(`Network error: ${err.message}`);
      }
    }
  }

  function cancel() { abortController?.abort(); }

  /* ── Extract score from markdown text ────────────────── */
  function extractScore(text) {
    const m = text.match(/Quality Score:\s*(\d{1,3})/i);
    return m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : null;
  }

  /* ── Error categorization ────────────────────────────── */
  function categorizeError(status, msg) {
    if (status === 400 && msg.includes('API key')) return 'Invalid API key. Please check your Gemini API key.';
    if (status === 429) return 'Rate limit reached for Gemini. Wait a moment and try again.';
    if (status === 500) return 'Gemini API server error. Try again in a few seconds.';
    return `API error: ${msg}`;
  }

  /* ── Validate key format ─────────────────────────────── */
  function validateKeyFormat(key) {
    return typeof key === 'string' && key.startsWith('AIzaSy') && key.length > 30;
  }

  return { callWithStreaming, cancel, extractScore, validateKeyFormat };
})();
