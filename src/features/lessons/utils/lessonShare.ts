import type { MathAnalysis } from '../../../shared/types';
import { richContentToPrettyText } from './notebookPresentation.ts';

/**
 * Formats a clean, readable Romanian text recap of a solved or verified math
 * problem for native sharing to WhatsApp, Notes, or study groups.
 */
export function formatLessonShareMessage(lesson: MathAnalysis): string {
  const modeHeading = lesson.mode === 'check' ? 'Verificare pas cu pas' : 'Rezolvare pas cu pas';
  const problemText = richContentToPrettyText(lesson.problem);
  const answerText = richContentToPrettyText(lesson.finalAnswer);
  const stepLines = lesson.steps.map(
    (step, index) => `${index + 1}. ${step.title}`,
  );
  const takeawayLines = lesson.takeaways.map(
    (item) => `• ${richContentToPrettyText(item.content)}`,
  );

  const sections: string[] = [
    `Profu’ de mate — ${lesson.title}`,
    `${lesson.topic} · ${modeHeading}`,
  ];

  if (problemText) {
    sections.push(`Enunț:\n${problemText}`);
  }
  if (stepLines.length > 0) {
    sections.push(`Pași:\n${stepLines.join('\n')}`);
  }
  if (answerText) {
    sections.push(`Răspuns final:\n${answerText}`);
  }
  if (takeawayLines.length > 0) {
    sections.push(`Idei de reținut:\n${takeawayLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
