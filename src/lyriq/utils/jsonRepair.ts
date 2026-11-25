/**
 * Utilities for repairing and parsing imperfect JSON responses from LLM generation.
 * Handles missing commas between array elements/objects, trailing commas, comments,
 * and truncated JSON structures.
 */

export interface SalvagedSection {
  type?: string;
  title?: string;
  startTimeSec?: number;
  endTimeSec?: number;
  energy?: string;
  suggestedLyricsPrompt?: string;
}

/** Robustly extracts and parses JSON from Gemini responses, repairing common syntax defects. */
export function parseJsonResponse<T = Record<string, unknown>>(raw: string | undefined): T {
  if (!raw || !raw.trim()) throw new Error('Empty response from AI model');
  let text = raw.trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
    else if (firstBrace !== -1) start = firstBrace;
    else if (firstBracket !== -1) start = firstBracket;

    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);

    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }

  // 1. Direct standard parse attempt
  try {
    return JSON.parse(text) as T;
  } catch (err1) {
    // 2. Syntax repairs for common LLM generation defects
    let repaired = text;

    // Strip single-line and multi-line comments
    repaired = repaired.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

    // Convert single-quoted keys/values to double-quotes if exclusively single-quoted
    if (repaired.includes("'") && !repaired.includes('"')) {
      repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    }

    // Missing comma between closing and opening braces/brackets (e.g. }\n { in arrays)
    repaired = repaired.replace(/([\}\]])\s*(?=[{\[])/g, '$1, ');

    // Missing comma between string / number / bool / null / array / object values and next key
    repaired = repaired.replace(/("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|true|false|null|\]|\})\s*[\r\n]+\s*(?="(?=[^"\\]*"\s*:))/g, '$1,\n');

    // Missing comma between primitive array items separated by newlines
    repaired = repaired.replace(/("(?:\\[\s\S]|[^"\\])*"|\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[\}\]])\s*[\r\n]+\s*(?=("(?:\\[\s\S]|[^"\\])*"|\b\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[\{\[]))/g, '$1,\n');

    // Remove trailing commas before closing } or ]
    repaired = repaired.replace(/,\s*([\}\]])/g, '$1');

    try {
      return JSON.parse(repaired) as T;
    } catch {
      // 3. Try balancing unclosed brackets / quotes for truncated JSON
      const stack: string[] = [];
      let inString = false;
      let escaped = false;
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{' || char === '[') stack.push(char === '{' ? '}' : ']');
        else if (char === '}' || char === ']') {
          if (stack.length && stack[stack.length - 1] === char) stack.pop();
        }
      }
      let balanced = repaired;
      if (inString) balanced += '"';
      balanced = balanced.replace(/,\s*$/, '');
      while (stack.length) balanced += stack.pop();

      try {
        return JSON.parse(balanced) as T;
      } catch {
        throw err1; // Propagate original syntax error if repair attempts fail
      }
    }
  }
}

/** Salvages valid section objects from raw text if the overall JSON container fails to parse. */
export function salvageSectionsFromText(raw: string): SalvagedSection[] {
  if (!raw || typeof raw !== 'string') return [];
  const sections: SalvagedSection[] = [];
  const regex = /\{[^{}]*"(?:type|startTimeSec)"[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    try {
      const cleaned = match[0].replace(/,\s*([\}\]])/g, '$1');
      const obj = JSON.parse(cleaned) as SalvagedSection | null;
      if (obj && (typeof obj.type === 'string' || typeof obj.title === 'string' || typeof obj.startTimeSec === 'number')) {
        sections.push(obj);
      }
    } catch {
      // Ignore unparseable fragments
    }
  }
  return sections;
}

/** Extracts tempo estimation from raw response text if container parsing dropped or omitted it. */
export function extractBpmFromText(raw: string): number | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const match = raw.match(/"estimatedBpm"\s*:\s*(\d+(?:\.\d+)?)/i) || raw.match(/(\d{2,3})\s*bpm/i);
  if (!match) return undefined;
  const val = Number(match[1]);
  return Number.isFinite(val) && val >= 40 && val <= 240 ? Math.round(val) : undefined;
}
