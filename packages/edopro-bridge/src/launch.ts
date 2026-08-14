import type { LaunchDuelOptions, LaunchPlan } from "./types.js";

/**
 * Build a launch plan for a local training duel.
 * EDOPro must host a room; WindBot joins with the selected rival deck.
 */
export function buildLaunchPlan(options: LaunchDuelOptions): LaunchPlan {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 7911;
  const rivalName = options.botName ?? options.rival.windbotName;
  const rivalDeck = options.rival.windbotDeck;
  const root = options.edoProRoot.replace(/[/\\]+$/, "");

  const windBotCwd = `${root}/WindBot`;
  const windBotExecutableCandidates = [
    `${windBotCwd}/WindBot.exe`,
    `${windBotCwd}/WindBot`,
    `${windBotCwd}/windbot.exe`,
    `${windBotCwd}/WindBot.dll`,
  ];

  const edoProExecutableCandidates = [
    `${root}/EDOPro`,
    `${root}/edopro`,
    `${root}/EDOPro.exe`,
    `${root}/bin/EDOPro`,
    `${root}/EDOPro.app/Contents/MacOS/EDOPro`,
    `${root}/Project Ignis - EDOPro.app/Contents/MacOS/EDOPro`,
  ];

  const windBotArgs = [
    `Host=${host}`,
    `Port=${port}`,
    `Deck=${rivalDeck}`,
    `Name=${rivalName}`,
    "Chat=false",
  ];

  const steps = [
    "Confirm EDOPro install path and WindBot/bots.json entries for the rival.",
    "Launch EDOPro (or focus it if already running).",
    "In EDOPro: Host a local duel room (default port 7911) and select your deck.",
    `Start WindBot with Deck=${rivalDeck} so it joins as "${rivalName}".`,
    "Duel. After the match, return here for post-duel coaching (replay folder).",
  ];

  if (options.playerDeckPath) {
    steps.splice(
      2,
      0,
      `Your selected deck file: ${options.playerDeckPath} (copy into EDOPro/deck if needed).`,
    );
  }

  return {
    steps,
    windBotArgs,
    windBotCwd,
    windBotExecutableCandidates,
    edoProExecutableCandidates,
    host,
    port,
    rivalDeck,
    rivalName,
  };
}

export function windBotCommandLine(plan: LaunchPlan): string {
  const exe =
    plan.windBotExecutableCandidates.find((p) => p.endsWith(".exe")) ??
    plan.windBotExecutableCandidates[0];
  return `"${exe}" ${plan.windBotArgs.join(" ")}`;
}
