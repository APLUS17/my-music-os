import { LyricSection } from '@/types';

/**
 * Format lyric sections as plain text with section headers.
 * Example output:
 * 
 * My Song Title
 * ─────────────────
 * 
 * [Verse]
 * Line 1
 * Line 2
 * 
 * [Chorus x2]
 * Chorus line 1
 * Chorus line 2
 */
export function formatLyricsAsText(sections: LyricSection[], projectTitle: string): string {
  const lines: string[] = [];
  
  if (projectTitle.trim()) {
    lines.push(projectTitle.trim());
    lines.push('─'.repeat(Math.min(projectTitle.trim().length + 4, 40)));
    lines.push('');
  }

  sections.forEach((section, index) => {
    // Skip empty sections
    if (!section.text.trim()) return;

    // Section header
    const typeLabel = section.type.charAt(0).toUpperCase() + section.type.slice(1);
    const repeatLabel = section.repeats > 1 ? ` x${section.repeats}` : '';
    lines.push(`[${typeLabel}${repeatLabel}]`);
    
    // Section text
    lines.push(section.text.trim());
    
    // Blank line between sections (not after last)
    if (index < sections.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Copy formatted lyrics to clipboard.
 * Returns true on success, false on failure.
 */
export async function copyLyricsToClipboard(
  sections: LyricSection[],
  projectTitle: string
): Promise<boolean> {
  const text = formatLyricsAsText(sections, projectTitle);
  
  if (!text.trim() || text === projectTitle.trim() + '\n' + '─'.repeat(Math.min(projectTitle.trim().length + 4, 40))) {
    return false; // No actual lyrics to copy
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
