import { LyricSection } from '@/types';

// Let's implement the benchmark directly simulating the operations
// from SandboxView's old and new logic.

const generateSections = (numSections: number, linesPerSection: number): LyricSection[] => {
  const sections: LyricSection[] = [];
  for (let i = 0; i < numSections; i++) {
    const linesArr = [];
    for (let j = 0; j < linesPerSection; j++) {
      linesArr.push(`Line ${j} of section ${i}`);
    }
    sections.push({
      id: `section-${i}`,
      type: 'verse',
      repeats: 1,
      text: linesArr.join('\n')
    });
  }
  return sections;
};

// SIMULATE THE OLD LOGIC
const runOldLogic = (sections: LyricSection[], targetLineId: string, newText: string) => {
  // 1. Flatten sections to lines (simulating the flatMap from render)
  type FlowLine = { id: string; text: string; sectionId: string; sessionId?: string };
  const lines: FlowLine[] = sections.flatMap(section =>
    section.text.split('\n').map((lineText: string, idx: number) => ({
      id: `${section.id}-line-${idx}`,
      text: lineText,
      sectionId: section.id,
      sessionId: section.pinnedSessionId
    }))
  );

  const lineIndex = lines.findIndex(l => l.id === targetLineId);
  if (lineIndex === -1) return sections;

  const updatedLines = [...lines];
  updatedLines[lineIndex] = { ...updatedLines[lineIndex], text: newText };

  // Convert lines back to sections
  const sectionMap = new Map<string, string>();
  updatedLines.forEach(line => {
    const existing = sectionMap.get(line.sectionId) || '';
    sectionMap.set(line.sectionId, existing ? `${existing}\n${line.text}` : line.text);
  });

  const updatedSections = sections.map(section => ({
    ...section,
    text: sectionMap.get(section.id) || ''
  }));

  return updatedSections;
};

// SIMULATE THE NEW OPTIMIZED LOGIC
const runNewLogic = (sections: LyricSection[], cachedLines: any[], targetLineId: string, newText: string) => {
  const line = cachedLines.find(l => l.id === targetLineId);
  if (!line) return sections;

  // Get all lines belonging to the updated section
  const sectionLines = cachedLines.filter(l => l.sectionId === line.sectionId);

  // Construct the new text for this specific section by updating only the changed line
  const updatedSectionText = sectionLines.map(l =>
    l.id === targetLineId ? newText : l.text
  ).join('\n');

  // Update only the targeted section, preserving references of all other sections
  const updatedSections = sections.map(section => {
    if (section.id === line.sectionId) {
      return { ...section, text: updatedSectionText };
    }
    return section;
  });

  return updatedSections;
};

// RUN BENCHMARK FUNCTION
const runBenchmark = () => {
  console.log('--- SandboxView Update Section Performance Benchmark ---');

  const numSections = 100;
  const linesPerSection = 10;
  const iterations = 5000;

  const sections = generateSections(numSections, linesPerSection);

  // Cached lines representing the memoized version for the new logic
  type FlowLine = { id: string; text: string; sectionId: string; sectionLineIdx: number; sessionId?: string };
  const cachedLines: FlowLine[] = sections.flatMap(section =>
    section.text.split('\n').map((lineText: string, idx: number) => ({
      id: `${section.id}-line-${idx}`,
      text: lineText,
      sectionId: section.id,
      sectionLineIdx: idx,
      sessionId: section.pinnedSessionId
    }))
  );

  const targetLineId = `section-50-line-5`;
  const newText = 'Updated typing text in middle section line';

  // Warmup
  for (let i = 0; i < 100; i++) {
    runOldLogic(sections, targetLineId, newText);
    runNewLogic(sections, cachedLines, targetLineId, newText);
  }

  // Measure Old Logic
  const startOld = performance.now();
  for (let i = 0; i < iterations; i++) {
    runOldLogic(sections, targetLineId, newText);
  }
  const endOld = performance.now();
  const durationOld = endOld - startOld;

  // Measure New Logic
  const startNew = performance.now();
  for (let i = 0; i < iterations; i++) {
    runNewLogic(sections, cachedLines, targetLineId, newText);
  }
  const endNew = performance.now();
  const durationNew = endNew - startNew;

  // Measure referential stability (identity preserving)
  const oldResult = runOldLogic(sections, targetLineId, newText);
  const newResult = runNewLogic(sections, cachedLines, targetLineId, newText);

  let unchangedCountOld = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === oldResult[i]) {
      unchangedCountOld++;
    }
  }

  let unchangedCountNew = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === newResult[i]) {
      unchangedCountNew++;
    }
  }

  console.log(`\nConfiguration:`);
  console.log(`- Sections: ${numSections}`);
  console.log(`- Total Lines: ${numSections * linesPerSection}`);
  console.log(`- Iterations: ${iterations}`);
  console.log(`\nPerformance Results:`);
  console.log(`- Baseline (Old Map-and-Rebuild): ${durationOld.toFixed(2)} ms (${(iterations / (durationOld / 1000)).toFixed(0)} ops/sec)`);
  console.log(`- Optimized (New Single Section): ${durationNew.toFixed(2)} ms (${(iterations / (durationNew / 1000)).toFixed(0)} ops/sec)`);

  const rawSpeedup = durationOld / durationNew;
  console.log(`- Raw Execution Speedup: ${rawSpeedup.toFixed(2)}x faster`);

  console.log(`\nReferential Stability Results (Object Identity Preserving):`);
  console.log(`- Unchanged Section Object References (Old): ${unchangedCountOld} / ${numSections}`);
  console.log(`- Unchanged Section Object References (New): ${unchangedCountNew} / ${numSections} (${((unchangedCountNew / numSections) * 100).toFixed(1)}%)`);

  console.log(`\n--- End of Benchmark ---`);
};

runBenchmark();
