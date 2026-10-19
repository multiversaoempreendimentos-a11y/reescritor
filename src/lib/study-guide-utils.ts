export const ANSWER_START = "[[GABARITO_INICIO]]";
export const ANSWER_END = "[[GABARITO_FIM]]";

export type Confidence = "chutei" | "acho" | "certeza";
export type SelfAssessment = "maioria" | "misto" | "dificuldade";
export type StudyGuideParts = { antes: string; gabarito: string; depois: string };

export function parseStudyGuide(text: string): StudyGuideParts | null {
  const start = text.indexOf(ANSWER_START);
  if (start < 0) return null;

  const end = text.indexOf(ANSWER_END, start + ANSWER_START.length);
  if (end < start) return null;

  const answerKey = text.slice(start + ANSWER_START.length, end).trim();
  if (!answerKey) return null;

  return {
    antes: text.slice(0, start).trim(),
    gabarito: answerKey,
    depois: text.slice(end + ANSWER_END.length).trim(),
  };
}

export function classifySelfAssessment(confidence: Confidence, result: SelfAssessment) {
  if (result === "misto") return "Resultado misto — revise os pontos em que hesitou.";
  if (result === "dificuldade") {
    return confidence === "certeza" ? "Certeza não confirmada" : "Dúvida confirmada";
  }
  return confidence === "certeza" ? "Acerto com confiança" : "Acerto sem certeza";
}
