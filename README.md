# What matters to me

A bilingual, voice-led values conversation before a kidney consultation. Built with [Lovable](https://lovable.dev).

## Development

### Prerequisites

- Node.js >= 20.19
  - Recommended: Node.js 22 LTS
- npm

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Run against a local database

The existing tracked `.env` contains Supabase project identifiers, URLs, and publishable keys, including the public `VITE_*` build values that Lovable needs for previews and builds. **Never put `OPENAI_API_KEY`, a Supabase service-role key, or other private credentials in `.env` or any `VITE_*` variable.** Local private values belong in `.env.local`, which Git ignores. See [Lovable's Secrets guidance](https://docs.lovable.dev/features/secrets).

For local development, use a separate database so test answers do not enter the cloud project:

```sh
supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f drizzle/migrations/0000_create_ckd_sessions.sql
supabase status -o env
```

Apply the SQL only once to a new local database. Put the reported `API_URL` and `ANON_KEY` in the ignored `.env.local` file as `VITE_SUPABASE_URL`, `SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_PUBLISHABLE_KEY`. Question audio, typed answers, and a direct answer summary work locally.

For the full conversation flow, put `OPENAI_API_KEY` in `.env.local` and run `npm run dev:local` with Node.js 22.9 or newer. The server uses it for the answer safety check, question planning, summaries, live speech generation, and voice transcription. The patient can edit a transcript before saving it; the API key stays on the server. If neither an OpenAI key nor Lovable's managed AI key is available, fixed questions remain usable, but free-text answers cannot pass the required safety check.

Local development blocks a remote Supabase URL by default. Set `VITE_ALLOW_REMOTE_DEV=true` only when you intentionally want the local browser to access the cloud database. The checked-in migration grants anonymous read and write access to all three CKD tables. Do not enter real patient data until authentication and restrictive row-level policies are implemented and verified.

### Question audio

The app generates each displayed question's speech when it is opened or replayed. `/api/speak` sends the English or Mandarin question text to `gpt-4o-mini-tts`; no MP3s are stored in the repository. A generated follow-up question may refer to something the patient said earlier, so its text may include patient information. Review this data flow and both languages' live voices before clinical use. If the speech service or browser autoplay is unavailable, the patient can use **Hear question**; the app also tries the device voice.

### Treatment options step

After the living-donation question, the patient can see how the four kidney treatment options differ on up to three things they said matter to them. The options are PD, haemodialysis at a centre, transplant and conservative kidney management.

- **Facts:** every fact comes from the approved knowledge base in `docs/treatment-options-kb.md`.
- **AI:** it may only pick statements from that file and write a short opening sentence. Its reply is checked, and the app falls back to a fixed template if the reply fails any check or AI is unavailable.
- **Saved:** one `options-shown` entry per conversation, recording the knowledge base version, the priorities and whether the AI or template version was used. It feeds the "Options information shown" section of the clinician summary.
- **More detail:** see [docs/options-step.md](docs/options-step.md), including known gaps.

The step is always on. The patient can skip it.

**Updating the knowledge base:** clinicians edit the markdown. The app reads a generated copy, so every change needs these steps:

1. Edit `docs/treatment-options-kb.md`.
2. Run `npm run kb:build`. It regenerates `src/lib/treatment-options.data.ts` and stops with a line number if a statement is malformed.
3. Run `node --test tests/*.test.mjs` and `npx tsc --noEmit`. The tests fail if the generated file is out of date, if an option is missing a statement for a topic, or if the living-donation statements change.
4. Commit **both** files together: the markdown and `src/lib/treatment-options.data.ts`.

**Reviewing what patients see:** to check the content without running the app, run `npm run review:options`. It rewrites [docs/review/options-review.md](docs/review/options-review.md) with what five synthetic patients would see, in English and Chinese. Run it after changing the knowledge base, and commit the updated report with the rest.
### Patient-facing supportive messages

While Clara prepares the next question, the app shows one of 20 brief, practical kidney-care prompts. They cover symptoms, treatment burden, daily life, independence, family, work, transport and questions for the care team. Each completed answer advances to a new message, and the set does not repeat until all 20 have been used. The content draws on [NIDDK's kidney communication guidance](https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/talking-patients), [NSW Agency for Clinical Innovation's renal shared decision-making guidance](https://aci.health.nsw.gov.au/networks/renal/resources/choices/options/shared-decision-making), and its [treatment discussion guidance](https://aci.health.nsw.gov.au/networks/renal/resources/choices/options/treatment). Review the English and Simplified Chinese wording with the clinical team before deployment.

### Working with the Lovable project

The connected [Lovable project](https://lovable.dev/projects/80a7908c-95f0-4200-bb74-f27375075d74) already has Cloud database enabled and the `ckd_sessions`, `ckd_entries`, and `ckd_summaries` tables. Do not rerun the creation SQL against that database.

Before merging or publishing:

1. In **Project settings → Git**, check the active synced branch. Work on a separate GitHub branch and review the pull request. Merging into the active branch syncs the code back to Lovable; a PR branch does not change the Lovable editor unless that branch is selected there. See [Lovable Git sync](https://docs.lovable.dev/integrations/github).
2. Keep the existing tracked `.env` limited to Supabase project identifiers, URLs, and publishable keys. Do not copy `.env.local` into Lovable or commit it. Lovable manages its Cloud project's backend `SUPABASE_*` and `LOVABLE_*` values. Do not put `VITE_*` values in Secrets.
3. Server AI routes use `OPENAI_API_KEY` when it is present and otherwise use Lovable's managed AI key. If direct OpenAI is required, add `OPENAI_API_KEY` in **More → Cloud → Secrets**, never as `VITE_OPENAI_API_KEY`. Verify in a Lovable preview that these TanStack server routes receive the secret before relying on that path; local `.env.local` does not configure Lovable.
4. **Do not use real patient data or publish for clinical use yet.** The current Cloud policies allow anonymous users to read, insert, and update every row in all three CKD tables. Add authentication and per-session authorization, replace the open RLS policies, and test access from an unrelated session. Review **More → Cloud → Database → RLS policies** and the [Lovable security guidance](https://docs.lovable.dev/tips-tricks/security-best-practices).
5. Test English and Mandarin conversation, voice playback, voice transcription, summary review, and Home on the Lovable preview using synthetic answers. The local build and browser checks do not verify Lovable's hosted server environment.

The Lovable project was not changed while preparing this repository update. Merge and publishing are separate review steps.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
