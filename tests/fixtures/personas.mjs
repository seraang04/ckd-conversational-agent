// Synthetic patients shared by tests/patient-profile.test.mjs and
// scripts/review-options.mjs. Answers use the text format the app saves
// (see formatChoices in src/lib/guided-answer.ts). No real patient data.

export const ranked = (...labels) =>
  `Priorities (most important first):\n${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
export const rankedZh = (...labels) =>
  `优先事项（最重要的排在前面）：\n${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
export const picked = (...labels) =>
  `Selected concerns:\n${labels.map((l) => `• ${l}`).join("\n")}`;
export const pickedZh = (...labels) => `选择的担忧：\n${labels.map((l) => `• ${l}`).join("\n")}`;
export const said = (topic, answer, visibility = "shared", speaker = "patient") => ({
  speaker,
  topic,
  answer,
  visibility,
});

export const PERSONAS = [
  {
    id: "independent-traveller",
    title: "Independent, works, and travels often",
    entries: [
      said(
        "values-1",
        ranked("Staying independent", "Continuing work or activities I enjoy", "Time with family"),
      ),
      // A free-text follow-up on the same topic adds nothing.
      said("values-1", "I still go to my grandson's football games."),
      said(
        "treatment-mobility",
        picked("I can usually move around and manage everyday tasks independently"),
      ),
      said(
        "treatment-travel",
        picked(
          "I can usually arrange reliable transport myself",
          "Being able to travel or stay away overnight is important to me",
        ),
      ),
      said(
        "treatment-independence",
        "I would like to learn and manage as much day-to-day care as I can\n\nI like to be in control.",
      ),
      said(
        "treatment-priorities",
        ranked(
          "Being able to travel or stay away overnight",
          "Keeping my daily schedule flexible",
          "Fitting care around work, studies or other responsibilities",
        ),
      ),
    ],
  },
  {
    id: "walker-with-daughter",
    title: "Uses a walker and relies on their daughter (answered in Chinese)",
    entries: [
      said("treatment-mobility", pickedZh("会使用拐杖、助行器或轮椅", "有些时候需要别人协助")),
      said("values-1", rankedZh("和家人相处", "感觉舒适")),
      said("life-3", "我女儿会帮忙。"),
      said("treatment-travel", pickedZh("家人或朋友可以接送或陪同")),
      said("worries-1", pickedZh("治疗对身体的影响", "对家人的影响", "费用")),
      // Talked about donation with the caregiver present, so gated statements may show.
      said("sensitive-1", "我不想让女儿为我冒险。"),
    ],
  },
  {
    id: "routine-and-centre",
    title: "Wants a fixed routine and prefers the centre",
    entries: [
      said(
        "treatment-priorities",
        ranked(
          "Having a predictable routine that is easy to plan around",
          "Reducing the number of appointments or trips",
          "Having my care team explain how different choices may affect how long I live",
          "Reducing the amount of time spent on care each day",
        ),
      ),
      said(
        "treatment-location",
        picked(
          "I would feel safer at a clinic or care centre with staff nearby",
          "Space or storage at home is limited",
          "Household or family responsibilities could make care at home difficult",
        ),
      ),
      said("treatment-independence", "I would prefer care staff to manage most care tasks"),
    ],
  },
  {
    id: "not-sure",
    title: "Answers 'Not sure yet' everywhere",
    entries: [
      said("values-1", ranked("Something else")),
      said("worries-1", picked("No worries at the moment")),
      said("treatment-mobility", picked("Not sure yet")),
      said("treatment-travel", picked("No transport or travel concerns at the moment")),
      said("treatment-location", picked("I have no strong preference about location")),
      said("treatment-independence", "Not sure yet"),
      said("treatment-priorities", ranked("Not sure yet; I would like my care team to explain")),
    ],
  },
  {
    id: "private-and-caregiver",
    title: "Private donation answer, plus caregiver answers that must be ignored",
    entries: [
      said("values-1", ranked("Feeling comfortable")),
      said("sensitive-1", "I could never ask my son for a kidney.", "private"),
      said("worries-1", picked("Costs", "Impact on family"), "skipped"),
      said(
        "treatment-priorities",
        ranked("Being able to travel or stay away overnight"),
        "deferred",
      ),
      said(
        "treatment-location",
        picked("I would prefer to receive most care at home if possible"),
        "private",
      ),
      said("caregiver-3", picked("Costs", "My own wellbeing"), "shared", "caregiver"),
      said("values-1", ranked("Staying independent"), "shared", "caregiver"),
      said("caregiver-4", "I'm worried I can't keep this up.", "private", "caregiver"),
    ],
  },
];

export const persona = (id) => {
  const found = PERSONAS.find((p) => p.id === id);
  if (!found) throw new Error(`No persona "${id}"`);
  return found;
};

/** Same rule as the session page: gated statements need a shared, non-empty donation answer. */
export const allowsGated = (entries) =>
  entries.some(
    (e) =>
      e.speaker === "patient" &&
      e.topic === "sensitive-1" &&
      e.visibility === "shared" &&
      e.answer.trim() !== "",
  );
