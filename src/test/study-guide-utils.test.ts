import { describe, expect, it } from "vitest";
import {
  ANSWER_END,
  ANSWER_START,
  classifySelfAssessment,
  parseStudyGuide,
} from "@/lib/study-guide-utils";

describe("parseStudyGuide", () => {
  it("separa conteúdo de perguntas, gabarito e referências", () => {
    const parsed = parseStudyGuide(`PERGUNTAS\n${ANSWER_START}\nRESPOSTAS\n${ANSWER_END}\nFONTES`);

    expect(parsed).toEqual({ antes: "PERGUNTAS", gabarito: "RESPOSTAS", depois: "FONTES" });
  });

  it("não expõe um guia se os marcadores estiverem ausentes ou fora de ordem", () => {
    expect(parseStudyGuide("GUIA sem marcadores")).toBeNull();
    expect(parseStudyGuide(`${ANSWER_END}\n${ANSWER_START}\nRESPOSTAS`)).toBeNull();
    expect(parseStudyGuide(`${ANSWER_START}\n  \n${ANSWER_END}`)).toBeNull();
  });
});

describe("classifySelfAssessment", () => {
  it("distingue as combinações de alta/baixa confiança e autoavaliação", () => {
    expect(classifySelfAssessment("certeza", "dificuldade")).toBe("Certeza não confirmada");
    expect(classifySelfAssessment("acho", "dificuldade")).toBe("Dúvida confirmada");
    expect(classifySelfAssessment("chutei", "maioria")).toBe("Acerto sem certeza");
    expect(classifySelfAssessment("certeza", "maioria")).toBe("Acerto com confiança");
  });

  it("mantém resultados mistos sem tratá-los como uma taxa objetiva", () => {
    expect(classifySelfAssessment("acho", "misto")).toBe(
      "Resultado misto — revise os pontos em que hesitou.",
    );
  });
});
