# Safety pathway — implementation and remaining protocol decisions

Submitted patient and caregiver answers, including private answers and voice transcripts, are screened before saving them into the normal conversation or requesting another question. Skips and deferrals with no text do not require screening. Local development uses the same safety gate.

Explicit English/Chinese danger phrases immediately trigger support. Other answers require a structured AI screen. Missing credentials, invalid output, network errors, or a 15-second classifier timeout pause the flow and offer retry; they never imply clearance. The phrase fallback intentionally favors sensitivity: negated or historical mentions can trigger human review. It is not a validated clinical screening instrument and needs bilingual evaluation, including indirect expressions and real Hokkien transcripts.

A positive screen stops question playback and replaces the conversation with bilingual crisis support. No patient-facing resume control is provided. The existing session `stage` becomes `safety_review`; `updated_at` records the flag time. No schema migration is needed. Normal stage changes are blocked by the session UI. The triggering answer is not placed in shared summaries. A tab-local marker retains the interruption on reload if database persistence fails; saving can be retried. A saved database flag persists across devices. This is a session-level review flag, not an acknowledged or delivered referral.

Resources are explicitly labeled Singapore: emergency ambulance 995, SOS 1767, and SOS WhatsApp +65 9151 1767 (English text service). Outside Singapore the screen directs users to local emergency services. Sources checked 2026-09-22:

- https://www.sos.org.sg/our-services/
- https://www.sos.org.sg/faq/

## Required implementation protocol before clinical deployment

No staff notification transport, monitored recipient, response-time commitment, authenticated review queue, or clearance workflow exists in this project. The screen explicitly says no automatic notification has been sent. The implementation does not contact anyone automatically.

The service owner must define the escalation recipient/channel, monitoring hours, acknowledgement and backup procedure, handling of private disclosures, retention/audit requirements, and who may clear a flag. Connect these to an authenticated server-side workflow with durable delivery and acknowledgement before describing this as automatic escalation. The development database currently permits anonymous updates; the UI pause is not an authorization boundary. Production access controls must enforce review/clearance rights.

Detection occurs on submission, not during recording or typing. Incorrect speech transcription can hide risk. Session-stage persistence is not atomic with classification, and an offline flag cannot reach another device until saved. A tab-local fallback contains no disclosure text. No emergency response is guaranteed by the app.

## Verification

Run `node --test tests/*.test.mjs`, `npx tsc --noEmit`, and `npm run build`.

Manual acceptance: submit English and Chinese high-risk text in patient, caregiver, and sensitive/private flows; confirm playback and further questions stop; reload and verify the screen remains; simulate failed flag saving and retry; simulate screening failure and verify retry preserves the submitted answer; ensure no automatic-notification claim or disclosure appears in a shared summary. Human clinical review and live end-to-end acceptance remain required.
