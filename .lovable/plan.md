# Clara conversational companion

Turn the existing guided interview into a visibly conversational experience led by Clara, using the uploaded mascot artwork and the existing live AI model.

## What will change

- Prepare the uploaded Clara artwork for the interface, preserving the hand-drawn character while removing the plain background for clean placement.
- Add Clara beside each question as the consistent speaking presence, with gentle listening and speaking motion that respects reduced-motion settings.
- Extend each live model-generated turn with a brief, compassionate acknowledgement of the person’s previous answer before Clara asks one relevant follow-up question.
- Keep acknowledgements specific and useful rather than merely repeating the answer. Clara may validate feelings, clarify what matters, or connect the answer to the next question.
- Read Clara’s acknowledgement and question aloud together in the selected language.
- Show a clear retry message if the live model cannot prepare the next turn; do not substitute pretend or scripted AI responses.

## Safety and accessibility

- Keep all existing CKD guardrails: no diagnosis, medical advice, treatment comparison, or recommendation.
- Maintain strict separation of patient and caregiver voices and hide private answers from Clara’s later context.
- Use short sentences, large readable text, strong contrast, generous spacing, and calm language suitable for older adults.
- Introduce Clara by name without implying she is a clinician or replacing the care team.

## Technical details

- Extend the existing structured turn response with bilingual acknowledgement fields and validate them server-side.
- Continue using the project’s existing `openai/gpt-6-astra` server-side conversation call and full saved conversation context.
- Add a focused Clara presentation component around the current voice interaction rather than replacing the recording workflow.
- Verify the real conversation path, speech text, mobile layout, error state, tests, and final build.
