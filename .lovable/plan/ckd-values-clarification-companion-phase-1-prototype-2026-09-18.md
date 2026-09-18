# CKD Values-Clarification Companion — Phase 1 prototype

A mobile-first, voice-led guided conversation that helps an elderly kidney patient and their caregiver say what matters to them before the next consultation, and hands a short summary to the renal coordinator.

Phase 1 covers the caregiver-assisted path end to end, in Chinese with a Hokkien option. No logins: the demo opens freely, and each session is reached through a short session code.

## What gets built

**1. Home**
Three large entry points: "Clinician setup", "Continue a session" (enter code), "Coordinator view".

**2. Clinician setup (a few minutes)**
Patient first name or initials, CKD stage, language (Chinese / Hokkien), key issues to explore, who will assist, and consent checkboxes for recording and sharing the summary with the care team. Produces a 6-character session code shown large on screen.

**3. Patient check-in**
Asks if the patient feels ready to talk today — both understanding and feeling ready. If not ready: a calm reassurance screen, a short plain-language explanation, pause and return later, or continue. Declining is recorded as a valid outcome.

**4. Guided patient conversation (voice-first)**
One question at a time, in very large type, spoken aloud automatically. The patient taps a big microphone button and speaks; the answer is transcribed and shown for confirmation. The caregiver can type instead. A "Who is speaking?" toggle labels every contribution patient or caregiver. Topics: what matters to me, what worries me, what my life looks like. The agent reflects answers back in the patient's own words and gently probes for specifics. Skip, pause, and "ask the coordinator instead" are always available.

**5. Sensitive topic gate**
Before transplantation or living donation, the patient chooses: discuss privately without the caregiver, discuss together, or discuss later with the coordinator. Private answers are stored separately and never shown to the caregiver; deferred topics are recorded as a flagged topic only.

**6. Caregiver input (separate)**
A distinct section, visually different: my role, support I can give, what worries me, topics I prefer to discuss privately. Never merged with patient answers.

**7. Synthesis and patient confirmation**
The agent drafts patient priorities in the patient's own words, caregiver support and constraints, shared and differing concerns, and unresolved or sensitive items with the patient's chosen handling. The patient can edit, remove, add, or withhold any point. Withheld items are excluded from the coordinator summary.

**8. Clinician summary + coordinator view**
A one-minute read that marks clearly what came from the patient versus the caregiver and what was deferred. The coordinator view lists all completed sessions with their summaries, and shows deferred or private topics as flagged headings without content.

## Guardrails built in
- Never recommends, ranks or scores a treatment; never diagnoses or interprets results.
- Distress in what the patient says surfaces a "tell your care team" prompt, not counselling.
- A visible reminder that this prepares for the consultation, it does not replace it.

## Design
Calm clinical care aesthetic: warm off-white background, deep teal accent, very large type, tall high-contrast buttons, generous spacing, minimal reading. Patient screens and caregiver screens use visibly different surfaces so nobody mixes them up. Mobile-first, works on a tablet held by a caregiver.

## Technical notes
- TanStack Start with Lovable Cloud for session, answer, and summary storage; sessions keyed by the short code (demo-grade access, no auth — noted as not suitable for real patient data yet).
- Conversation, synthesis, and summary generation run server-side on Lovable AI; prompts and keys stay on the server. Speech recognition and read-aloud use Lovable AI's speech endpoints, with Chinese and a Hokkien-leaning setting.
- Patient private entries, caregiver entries, and withheld items stored in separate fields so the summary generator can exclude them by construction.
- Full chat transcript persisted per session so a session resumes on any device via its code.

## Deferred to a later phase
Independent patient and social-worker paths, more languages, real logins and audit trail, clinical record integration, repeat conversations over time.
