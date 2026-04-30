const GROQ_BASE = '/api/groq/openai/v1';

export const CASE_ARCHETYPES = {
  alibi: {
    id: 'alibi',
    title: 'THE ALIBI',
    subtitle: 'where were you the night of the 14th?',
    description: 'A man was found dead in his apartment. You were the last person seen with him.',
    caseNumber: 'CASE #4471-B',
    victim: 'Marcus Hale',
    context: 'Found dead in apartment, blunt force trauma, victim called suspect 3 times the night of Oct 14th',
  },
  missing: {
    id: 'missing',
    title: 'THE MISSING',
    subtitle: 'when did you last see her?',
    description: 'She has been gone for six days. You were the last person to see her.',
    caseNumber: 'CASE #2209-A',
    victim: 'Sarah Chen',
    context: 'Missing person, last seen leaving suspects residence, neighbor spotted suspects car near her building morning she vanished',
  },
  accident: {
    id: 'accident',
    title: 'THE ACCIDENT',
    subtitle: 'tell me exactly what happened on those stairs.',
    description: 'He fell. You were the only other person in the house.',
    caseNumber: 'CASE #0088-C',
    victim: 'Daniel Reeves',
    context: 'Fell down stairs, forensics found grab marks on wrists, suspect was only witness, called it in 40 minutes after estimated time of fall',
  },
};

function buildDetectiveSystemPrompt(archetype, playerName, conversationHistory) {
  const historyText = conversationHistory.length > 0
    ? conversationHistory.map((h, i) =>
        `Q${i+1} [Detective]: ${h.question}\nA${i+1} [${playerName}]: ${h.answer}${h.retryCount > 0 ? ` [RETRIED ${h.retryCount}x — suspect was evasive]` : ''}`
      ).join('\n\n')
    : 'No prior exchanges yet.';

  return `You are Detective Harlow — cold, precise, methodical. Twenty-two years on the force. You do not raise your voice. You do not need to.

CASE: ${archetype.caseNumber} — ${archetype.title}
VICTIM: ${archetype.victim}
FACTS: ${archetype.context}
SUSPECT NAME: ${playerName}

CONVERSATION SO FAR:
${historyText}

YOUR ROLE:
- You are conducting a live interrogation. You ask ONE question at a time.
- You NEVER use label prefixes like "Detective:" or "Harlow:" in your output — just speak directly.
- Your questions are shaped entirely by what the suspect just said. You catch inconsistencies, press on vague answers, circle back to earlier contradictions.
- You escalate pressure gradually across the interrogation (6 questions total). Early: calm and curious. Middle: pointed. Late: cold and relentless.
- You reference the suspect's actual words back at them when catching inconsistencies. Be specific — quote what they actually said.
- You never accept easy answers. If they're vague, you push. If they contradict themselves, you name it.
- Your responses feel like a real human detective — not a chatbot. Short sentences. Silence implied between lines. Economy of words.
- Do NOT moralize. Do NOT explain your reasoning. Just interrogate.
- If retryCount > 0 on the latest answer, the suspect has been evasive — be MORE aggressive this time.

RESPONSE STANCES (you will provide 3 short stance labels the suspect can choose from, to guide HOW they'll answer):
- These are not scripted answers, just conversational angles. E.g. "Deny it", "Partial truth", "Deflect"
- Make them relevant to the current question. Keep each under 4 words.

OUTPUT FORMAT:
Return a JSON object with exactly these fields:
{
  "detractiveResponse": "The detective's reaction to the last answer (1-3 sentences, if this is not the first question). Empty string for the very first question.",
  "nextQuestion": "The next question to ask (1-2 sentences max). Sharp. Direct.",
  "pressureLevel": 1-5,
  "isCatchingContradiction": true/false,
  "isFinal": true/false,
  "caseFileNote": "10 words max, third person past tense",
  "responseStances": ["Stance A", "Stance B", "Stance C"],
  "isWeakAnswer": false
}

Return ONLY valid JSON. No markdown, no explanation, no preamble.`;
}

function buildRetryPrompt(archetype, playerName, conversationHistory, lastQuestion, weakAnswer, retryCount) {
  const historyText = conversationHistory.length > 0
    ? conversationHistory.map((h, i) =>
        `Q${i+1}: ${h.question}\nA${i+1}: ${h.answer}`
      ).join('\n\n')
    : 'No prior exchanges yet.';

  return `You are Detective Harlow. The suspect just gave a WEAK, EVASIVE, or TOO SHORT answer.

CASE: ${archetype.caseNumber} — ${archetype.title}
VICTIM: ${archetype.victim}
SUSPECT: ${playerName}

PRIOR CONVERSATION:
${historyText}

QUESTION THAT WAS ASKED: "${lastQuestion}"
WEAK ANSWER GIVEN: "${weakAnswer}"
RETRY NUMBER: ${retryCount} (get more aggressive each retry)

React to their weak answer with escalating frustration (controlled, cold — not shouting). Then ask the SAME QUESTION again, rephrased differently and more aggressively.

Provide new response stances too.

Return JSON:
{
  "retryResponse": "Detective's cold reaction to the weak answer (1-2 sentences). MORE aggressive than before.",
  "retryQuestion": "Same question, rephrased sharper. More pressure.",
  "pressureLevel": ${Math.min(retryCount + 2, 5)},
  "responseStances": ["Stance A", "Stance B", "Stance C"]
}

Return ONLY valid JSON.`;
}

function buildHintPrompt(archetype, playerName, conversationHistory, currentQuestion) {
  const historyText = conversationHistory.map((h, i) =>
    `Q${i+1}: ${h.question}\nA${i+1}: ${h.answer}`
  ).join('\n\n');

  return `You are a game hint system for a detective interrogation game.

CASE: ${archetype.title} — ${archetype.context}
SUSPECT: ${playerName}
CONVERSATION SO FAR:\n${historyText}
CURRENT QUESTION: "${currentQuestion}"

Give ONE short, cryptic hint to help the player answer WITHOUT GETTING CAUGHT. Like a whisper in their ear.
The hint should be 8-12 words max. Don't be obvious. Make it feel like inside information.
Examples: "He already knows you called. Don't mention the time." or "The neighbor told him about the car."

Return JSON: { "hint": "..." }`;
}

export async function getDetectiveMove(archetype, playerName, conversationHistory, latestAnswer) {
  const systemPrompt = buildDetectiveSystemPrompt(archetype, playerName, conversationHistory);
  const userMessage = conversationHistory.length === 0
    ? `Begin the interrogation. This is your FIRST question (question 1 of 6). Do not react to a previous answer. Just ask the opening question.`
    : `The suspect just said: "${latestAnswer}"\n\nThis is question ${conversationHistory.length + 1} of 6. React to their answer, then ask your next question.${conversationHistory.length >= 5 ? ' This is the FINAL question — set isFinal: true.' : ''}`;

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.85,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) { const err = await res.text(); throw new Error(`Groq API ${res.status}: ${err}`); }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('No content from Groq');
  try { return JSON.parse(raw); }
  catch { const match = raw.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]); throw new Error('Parse failed'); }
}

export async function getRetryMove(archetype, playerName, conversationHistory, lastQuestion, weakAnswer, retryCount) {
  const systemPrompt = buildRetryPrompt(archetype, playerName, conversationHistory, lastQuestion, weakAnswer, retryCount);
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 0.9,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq retry ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  try { return JSON.parse(raw); }
  catch { const match = raw.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]); throw new Error('Parse failed'); }
}

export async function getHint(archetype, playerName, conversationHistory, currentQuestion) {
  const prompt = buildHintPrompt(archetype, playerName, conversationHistory, currentQuestion);
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 80,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq hint ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  try { return JSON.parse(raw); }
  catch { return { hint: "Stay calm. Don't volunteer anything." }; }
}

export async function generateVerdict(archetype, playerName, conversationHistory) {
  const historyText = conversationHistory.map((h, i) =>
    `Q${i+1}: ${h.question}\nA${i+1}: ${h.answer}`
  ).join('\n\n');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You analyze interrogation transcripts and determine outcome verdicts. Return only valid JSON.` },
        { role: 'user', content: `Case: ${archetype.title} — ${archetype.victim}\nSuspect: ${playerName}\n\nFull interrogation transcript:\n${historyText}\n\nAnalyze this transcript and determine:\n1. verdictType: "confess" | "deny" | "silent"\n2. detectiveClosingLine: one dramatic closing sentence from Detective Harlow\n3. suspectObservation: one sentence about how the suspect performed\n4. caseStatus: "CASE CLOSED" | "UNDER OBSERVATION" | "FILE REMAINS OPEN"\n\nReturn JSON: { "verdictType": "...", "detectiveClosingLine": "...", "suspectObservation": "...", "caseStatus": "..." }` },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq verdict ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  return JSON.parse(raw);
}
