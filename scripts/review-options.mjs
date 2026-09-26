// Writes docs/review/options-review.md: what the options step would show each
// synthetic persona (template version, English and Chinese), so the team can
// review it without running the app. Run with `npm run review:options`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { PERSONAS, allowsGated } from "../tests/fixtures/personas.mjs";

const REPORT_PATH = fileURLToPath(new URL("../docs/review/options-review.md", import.meta.url));

// Load the app's TypeScript modules the same way the tests do.
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const toDataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const transpile = async (path, replacements = {}) => {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(from, JSON.stringify(to));
  }
  return toDataUrl(ts.transpileModule(source, { compilerOptions }).outputText);
};
const scriptUrl = await transpile("../src/lib/ckd-script.ts");
const sheetsUrl = await transpile("../src/lib/decision-sheets.ts", {
  '"./ckd-script.ts"': scriptUrl,
});
const dataUrl = await transpile("../src/lib/treatment-options.data.ts");
const kbUrl = await transpile("../src/lib/treatment-options.ts", {
  '"./treatment-options.data.ts"': dataUrl,
});
const validationUrl = await transpile("../src/lib/option-validation.ts", {
  '"./treatment-options.ts"': kbUrl,
});
const { KB_VERSION, EXPLAINABLE_DIMENSIONS, dimensionLabel, optionLabel, statementById } =
  await import(kbUrl);
const { validateExplanation } = await import(validationUrl);
const { buildPatientProfile } = await import(
  await transpile("../src/lib/patient-profile.ts", {
    '"./ckd-script.ts"': scriptUrl,
    '"./decision-sheets.ts"': sheetsUrl,
    '"./treatment-options.ts"': kbUrl,
  })
);
const { buildTemplateExplanation } = await import(
  await transpile("../src/lib/options-explanation.ts", {
    '"./ckd-script.ts"': scriptUrl,
    '"./option-validation.ts"': validationUrl,
    '"./treatment-options.ts"': kbUrl,
  })
);

// Same fixed lines and hand-off statements as src/components/ckd/OptionsStep.tsx.
const OPENING_NOTES = ["common.nochoice.1", "common.suitability.1"];
const HANDOFF_STATEMENTS = {
  longevity: "common.longevity.ask-team.1",
  cost: "common.cost.ask-team.1",
};
const text = (id, language) => statementById(id)?.[language] ?? `(missing ${id})`;

function evidenceLine(item) {
  const sources = item.evidence.map(
    (e) => `${e.topic}: "${e.label}"${e.rank ? ` (ranked ${e.rank})` : ""}`,
  );
  const details = item.details.length ? `; details: ${item.details.join(", ")}` : "";
  return `- **${dimensionLabel(item.dimension, "en")}** (${item.strength}), from ${sources.join("; ")}${details}`;
}

function patientView(explanation, handoffs, language) {
  const out = [`### ${language === "en" ? "English" : "中文"}`, ""];
  out.push(`> ${OPENING_NOTES.map((id) => text(id, language)).join(" ")}`, "");
  explanation.dimensions.forEach((card, index) => {
    out.push(`#### ${index + 1}. ${dimensionLabel(card.dimension, language)}`, "");
    if (card.bridge) out.push(`_${card.bridge[language]}_`, "");
    for (const option of card.options) {
      out.push(`**${optionLabel(option.option, language)}**`, "");
      for (const id of option.statementIds) out.push(`- ${text(id, language)} \`${id}\``);
      out.push("");
    }
  });
  if (handoffs.length) {
    const label = language === "en" ? "On the last card" : "最后一张卡片";
    out.push(
      `> ${label}: ${handoffs.map((d) => text(HANDOFF_STATEMENTS[d], language)).join(" ")}`,
      "",
    );
  }
  return out;
}

function personaSection(persona, number) {
  const profile = buildPatientProfile(persona.entries);
  const allowGated = allowsGated(persona.entries);
  const out = [`## ${number}. ${persona.title}`, ""];

  if (!profile.all.length) {
    out.push(
      "No priorities were found in this patient's answers. Nothing is preselected: the patient is asked to choose up to 3 of these topics, or skip the step:",
      "",
      EXPLAINABLE_DIMENSIONS.map(
        (d) => `${dimensionLabel(d, "en")} / ${dimensionLabel(d, "zh")}`,
      ).join(" · "),
      "",
    );
    return out;
  }

  out.push("**What the app found in the answers**", "");
  out.push(...profile.all.map(evidenceLine), "");
  out.push(
    `**Preselected priorities:** ${
      profile.priorities.map((d) => dimensionLabel(d, "en")).join(", ") || "none"
    } (the patient can change these)`,
    "",
  );
  out.push(
    `**Handed to the care team:** ${profile.handoffs.map((d) => dimensionLabel(d, "en")).join(", ") || "none"}`,
    "",
  );
  out.push(
    `**Living-donation statements:** ${
      allowGated
        ? "allowed (the patient shared an answer to the donation question)"
        : "hidden (no shared answer to the donation question)"
    }`,
    "",
  );

  const explanation = buildTemplateExplanation(profile.priorities, { allowGated });
  const problems = validateExplanation(explanation, { dimensions: profile.priorities, allowGated });
  out.push(`**Validation:** ${problems.length ? `FAILED: ${problems.join("; ")}` : "passed"}`, "");
  out.push(...patientView(explanation, profile.handoffs, "en"));
  out.push(...patientView(explanation, profile.handoffs, "zh"));
  return out;
}

const report = [
  "# Options step review",
  "",
  `> Generated by \`scripts/review-options.mjs\` from \`docs/treatment-options-kb.md\` (${KB_VERSION}) and the synthetic personas in \`tests/fixtures/personas.mjs\`. Do not edit by hand: run \`npm run review:options\`.`,
  ">",
  "> This is the **template** version: every allowed statement, in the fixed order PD → HD → Transplant → CKM. With AI switched on, the italic opening sentence may be personalised, a short sentence may be added under an option, and some statements may be left out. The statements themselves always come from the knowledge base, and the AI version is only used if it passes every check. Statement ids are shown in `code` for reviewers; patients do not see them.",
  "",
  ...PERSONAS.flatMap((persona, index) => personaSection(persona, index + 1)),
].join("\n");

await mkdir(fileURLToPath(new URL("../docs/review/", import.meta.url)), { recursive: true });
await writeFile(REPORT_PATH, `${report.trimEnd()}\n`);
console.log(`Wrote docs/review/options-review.md (${PERSONAS.length} personas, ${KB_VERSION})`);
