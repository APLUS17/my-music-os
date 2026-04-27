import { performance } from 'perf_hooks';

// Mock data
const numLines = 10000;
const numSessions = 1000;

interface Line {
  id: string;
  text: string;
  sessionId?: string;
}

interface Session {
  id: string;
}

const sessions: Session[] = Array.from({ length: numSessions }, (_, i) => ({
  id: `session-${i}`
}));

const lines: Line[] = Array.from({ length: numLines }, (_, i) => ({
  id: `line-${i}`,
  text: `This is line ${i}`,
  // 50% chance to have a session
  sessionId: i % 2 === 0 ? `session-${Math.floor(Math.random() * numSessions)}` : undefined
}));

function testOldLogic() {
  const start = performance.now();
  lines.forEach(line => {
    const session = line.sessionId ? sessions.find(t => t.id === line.sessionId) : null;
  });
  const end = performance.now();
  return end - start;
}

function testNewLogic() {
  const start = performance.now();

  // The optimization: create map once
  const sessionMap = new Map<string, Session>();
  for (const session of sessions) {
    sessionMap.set(session.id, session);
  }

  lines.forEach(line => {
    const session = line.sessionId ? sessionMap.get(line.sessionId) : null;
  });
  const end = performance.now();
  return end - start;
}

// Warmup
testOldLogic();
testNewLogic();

const oldTime = testOldLogic();
const newTime = testNewLogic();

console.log(`Baseline (O(N*M)) Time: ${oldTime.toFixed(4)} ms`);
console.log(`Optimized (O(N+M)) Time: ${newTime.toFixed(4)} ms`);
console.log(`Improvement: ${((oldTime - newTime) / oldTime * 100).toFixed(2)}% faster`);
