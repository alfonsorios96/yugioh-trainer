import type {
  AcademyItem,
  CoachResponse,
  MatchupLesson,
  PreDuelContext,
} from "./types.js";

export function formatPreDuelStatic(ctx: PreDuelContext): CoachResponse {
  const { lesson, rivalName, playerDeckName } = ctx;
  const lines = [
    `## Matchup: vs ${rivalName}`,
    playerDeckName ? `Your deck: ${playerDeckName}` : null,
    "",
    lesson.summary,
    "",
    "### Win conditions",
    ...lesson.winConditions.map((w) => `- ${w}`),
    "",
    "### Respect these cards",
    ...lesson.keyCardsRespect.map((c) => `- ${c}`),
    "",
    "### Priority interact / negate",
    ...lesson.keyCardsNegate.map((c) => `- ${c}`),
    "",
    "### Tips",
    ...lesson.tips.map((t) => `- **${t.title}**: ${t.body}`),
    "",
    "### Handtrap guidance",
    ...lesson.handtrapGuidance.map((h) => `- ${h}`),
    "",
    "### Common mistakes",
    ...lesson.commonMistakes.map((m) => `- ${m}`),
  ].filter((line): line is string => line !== null);

  return { source: "static", content: lines.join("\n") };
}

export function formatStaticChatReply(
  lesson: MatchupLesson,
  userMessage: string,
): CoachResponse {
  const lower = userMessage.toLowerCase();
  const chunks: string[] = [];

  if (lower.includes("handtrap") || lower.includes("ash") || lower.includes("imperm")) {
    chunks.push("Handtrap guidance for this matchup:");
    chunks.push(...lesson.handtrapGuidance.map((h) => `- ${h}`));
  }

  if (lower.includes("negate") || lower.includes("omni") || lower.includes("interrupt")) {
    chunks.push("Priority interruptions:");
    chunks.push(...lesson.keyCardsNegate.map((c) => `- ${c}`));
  }

  if (lower.includes("mistake") || lower.includes("error") || lower.includes("wrong")) {
    chunks.push("Common mistakes to avoid:");
    chunks.push(...lesson.commonMistakes.map((m) => `- ${m}`));
  }

  if (chunks.length === 0) {
    chunks.push(`Static coach (no API key). Matchup notes for ${lesson.title}:`);
    chunks.push(lesson.summary);
    chunks.push("");
    chunks.push("Ask about: handtraps, what to negate, or common mistakes.");
    chunks.push("Set OPENAI_API_KEY in Settings for full LLM coaching.");
  }

  return { source: "static", content: chunks.join("\n") };
}

export function formatPostDuelStatic(
  lesson: MatchupLesson,
  replayText: string,
): CoachResponse {
  const hasReplayDetail = replayText.length > 80 && !replayText.includes("Limited text");
  const lines = [
    `## Post-duel review vs ${lesson.rivalId}`,
    "",
    hasReplayDetail
      ? "Replay detected. Without an API key, use these review checkpoints:"
      : "Limited replay data. Review checkpoints for this matchup:",
    ...lesson.commonMistakes.map((m) => `- Did you avoid: ${m}?`),
    "",
    "Key cards to reflect on:",
    ...lesson.keyCardsRespect.slice(0, 4).map((c) => `- ${c}`),
    "",
    "Add an API key for a personalized LLM review of the replay fragments.",
  ];
  return { source: "static", content: lines.join("\n") };
}

export const DEFAULT_ACADEMY: AcademyItem[] = [
  {
    id: "normal-summon",
    title: "Value your Normal Summon",
    category: "fundamentals",
    body: "You get one Normal Summon/Set per turn. Plan combos so the Normal Summon is a starter or extender, not a dead body.",
  },
  {
    id: "chain-priority",
    title: "Chain link priority",
    category: "chains",
    body: "Fast effects (Quick Effects, Traps) can respond. The turn player often gets priority after successful actions—know when you can respond before they continue.",
  },
  {
    id: "resources",
    title: "Track resources, not just boards",
    category: "resources",
    body: "A flashy board that empties hand/GY advantage can lose to a single break. Count follow-up: what do you have next turn if they interact?",
  },
  {
    id: "tempo",
    title: "Play to the win condition",
    category: "tempo",
    body: "Decide if you are racing (OTK / high damage), grinding (resource loop), or controlling (denial). Wrong plan for the matchup loses even with 'correct' plays.",
  },
  {
    id: "ash-timing",
    title: "Ash Blossom timing",
    category: "fundamentals",
    body: "Ash stops add-from-deck / special-from-deck / send-from-deck effects. Hold it for the search that completes their engine, not the first optional dig.",
  },
];
