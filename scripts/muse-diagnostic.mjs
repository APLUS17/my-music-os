#!/usr/bin/env node
/**
 * MuseDrawer API diagnostic - run with: node scripts/muse-diagnostic.mjs
 * Checks Google Gemini API setup and reports the actual error.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI } from '@google/genai';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

console.log('=== Muse API Diagnostic ===\n');

if (!apiKey) {
  console.log('❌ NEXT_PUBLIC_GOOGLE_API_KEY is NOT set in .env.local');
  console.log('\nFix: Add to .env.local:');
  console.log('  NEXT_PUBLIC_GOOGLE_API_KEY=your_key_here');
  console.log('\nGet a key: https://aistudio.google.com/apikey');
  process.exit(1);
}

console.log('✓ API key is set (length:', apiKey.length, 'chars)\n');
console.log('Testing Gemini API call...\n');

try {
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'Return a JSON array with exactly one string: ["Hello from Muse"]',
    config: { responseMimeType: 'application/json' }
  });

  const text = response?.text;
  if (text) {
    JSON.parse(text);
    console.log('✓ API call succeeded!');
    console.log('✓ Response parsed as JSON');
  } else {
    console.log('⚠ API responded but response.text was empty:', response);
  }
} catch (err) {
  console.log('❌ Error details:');
  console.log('  Message:', err.message);
  if (err.status) console.log('  Status:', err.status);
  if (err.statusText) console.log('  StatusText:', err.statusText);
  if (err.cause) console.log('  Cause:', err.cause);
  console.log('\nFull error:', err);
  process.exit(1);
}
