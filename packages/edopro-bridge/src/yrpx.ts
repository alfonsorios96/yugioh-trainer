export const LOC = {
  DECK: 0x01,
  HAND: 0x02,
  MZONE: 0x04,
  SZONE: 0x08,
  GRAVE: 0x10,
  REMOVED: 0x20,
  EXTRA: 0x40,
  OVERLAY: 0x80,
} as const;

export const MSG = {
  START: 4,
  WIN: 5,
  NEW_TURN: 40,
  NEW_PHASE: 41,
  MOVE: 50,
  SUMMONING: 60,
  SPSUMMONING: 62,
  CHAINING: 70,
  DRAW: 90,
  ATTACK: 110,
  POS_CHANGE: 53,
} as const;

const PHASE_LABEL: Record<number, string> = {
  0x01: "Draw Phase",
  0x02: "Standby Phase",
  0x04: "Main Phase 1",
  0x08: "Battle Step",
  0x10: "Battle Step",
  0x20: "Damage Step",
  0x40: "Damage Calculation",
  0x80: "Battle Phase",
  0x100: "Main Phase 2",
  0x200: "End Phase",
};

export type Actor = "you" | "opp";
export type StepKind =
  | "draw"
  | "summon"
  | "spsummon"
  | "set"
  | "activate"
  | "attack"
  | "phase"
  | "win";

export interface CardRef {
  code: number;
  pos?: number;
}

export interface BoardSnapshot {
  turn: number;
  phase: string;
  lpYou: number;
  lpOpp: number;
  youHand: CardRef[];
  oppHand: CardRef[];
  youMonsters: CardRef[];
  oppMonsters: CardRef[];
  youSpells: CardRef[];
  oppSpells: CardRef[];
  youGrave: CardRef[];
  oppGrave: CardRef[];
  youBanished: CardRef[];
  oppBanished: CardRef[];
}

export interface ReplayStep {
  id: number;
  turn: number;
  phase: string;
  actor: Actor;
  kind: StepKind;
  decision: boolean;
  chosen: string;
  cardCodes: number[];
  board: BoardSnapshot;
  loc?: number;
  seq?: number;
  pos?: number;
}

export type Going = "first" | "second";

export interface ReplayWalkthrough {
  fileName: string;
  youName: string;
  oppName: string;
  /** Duel controller that maps to "you". 0 is the first listed replay name. */
  youCtrl?: 0 | 1;
  going?: Going;
  winner: Actor | "unknown";
  steps: ReplayStep[];
  cardCodes: number[];
}

export interface WalkthroughSeatOptions {
  /** Force which duel controller is the human (0 = first listed name). */
  youCtrl?: 0 | 1;
  /** Skip name-based seat detection (keep controller 0 as you). */
  orient?: boolean;
  botNames?: string[];
  playerNames?: string[];
}

class Reader {
  pos = 0;
  constructor(readonly buf: Uint8Array) {}
  remaining() {
    return this.buf.length - this.pos;
  }
  u8() {
    return this.buf[this.pos++];
  }
  u16() {
    const v = this.buf[this.pos] | (this.buf[this.pos + 1] << 8);
    this.pos += 2;
    return v;
  }
  u32() {
    const v =
      this.buf[this.pos] |
      (this.buf[this.pos + 1] << 8) |
      (this.buf[this.pos + 2] << 16) |
      (this.buf[this.pos + 3] << 24);
    this.pos += 4;
    return v >>> 0;
  }
  u64() {
    const lo = this.u32();
    this.u32();
    return lo;
  }
  bytes(n: number) {
    const slice = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }
  utf16(chars = 20) {
    const raw = this.bytes(chars * 2);
    let s = "";
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const c = raw[i] | (raw[i + 1] << 8);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
}

function locInfo(data: Uint8Array, offset: number) {
  return {
    ctrl: data[offset] ?? 0,
    loc: data[offset + 1] ?? 0,
    seq:
      (data[offset + 2] |
        (data[offset + 3] << 8) |
        (data[offset + 4] << 16) |
        (data[offset + 5] << 24)) >>>
      0,
    pos:
      (data[offset + 6] |
        (data[offset + 7] << 8) |
        (data[offset + 8] << 16) |
        (data[offset + 9] << 24)) >>>
      0,
  };
}

function facedown(pos: number) {
  return (pos & 0x0a) !== 0 && (pos & 0x05) === 0;
}

type Pile = number[];

interface SideState {
  lp: number;
  hand: Pile;
  mzone: Pile;
  szone: Pile;
  grave: Pile;
  extra: Pile;
  deck: Pile;
  banished: Pile;
  mpos: Pile;
  spos: Pile;
}

function emptySide(lp: number): SideState {
  return {
    lp,
    hand: [],
    mzone: [],
    szone: [],
    grave: [],
    extra: [],
    deck: [],
    banished: [],
    mpos: [],
    spos: [],
  };
}

function pileFor(side: SideState, loc: number): Pile | null {
  if (loc & LOC.HAND) return side.hand;
  if (loc & LOC.MZONE) return side.mzone;
  if (loc & LOC.SZONE) return side.szone;
  if (loc & LOC.GRAVE) return side.grave;
  if (loc & LOC.EXTRA) return side.extra;
  if (loc & LOC.DECK) return side.deck;
  if (loc & LOC.REMOVED) return side.banished;
  return null;
}

function takeCode(pile: Pile, code: number) {
  const i = pile.indexOf(code);
  if (i >= 0) pile.splice(i, 1);
  else if (pile.length) pile.shift();
}

function cloneBoard(
  turn: number,
  phase: string,
  you: SideState,
  opp: SideState,
): BoardSnapshot {
  const refs = (codes: Pile): CardRef[] =>
    codes.map((code) => ({ code: code > 0 ? code : 0 }));
  const zoneRefs = (codes: Pile, poss: Pile): CardRef[] =>
    codes.map((code, i) => ({
      code: code > 0 ? code : 0,
      pos: poss[i] ?? 0,
    }));
  return {
    turn,
    phase,
    lpYou: you.lp,
    lpOpp: opp.lp,
    youHand: refs(you.hand),
    oppHand: refs(opp.hand),
    youMonsters: zoneRefs(you.mzone, you.mpos),
    oppMonsters: zoneRefs(opp.mzone, opp.mpos),
    youSpells: zoneRefs(you.szone, you.spos),
    oppSpells: zoneRefs(opp.szone, opp.spos),
    youGrave: refs(you.grave),
    oppGrave: refs(opp.grave),
    youBanished: refs(you.banished),
    oppBanished: refs(opp.banished),
  };
}

function actorOf(ctrl: number, youCtrl: 0 | 1): Actor {
  return ctrl === youCtrl ? "you" : "opp";
}

function who(ctrl: number, youCtrl: 0 | 1) {
  return ctrl === youCtrl ? "Invocaste" : "El rival invocó";
}

function normalizeSeatName(name: string): string {
  return name.trim().toLowerCase();
}

function stripAiPrefix(name: string): string {
  return name.replace(/^\[ai\]\s*/i, "").trim();
}

function namesMatch(name: string, hint: string): boolean {
  const n = stripAiPrefix(normalizeSeatName(name));
  const h = stripAiPrefix(normalizeSeatName(hint));
  if (n.length < 3 || h.length < 3) return false;
  return n === h || n.includes(h) || h.includes(n);
}

/** WindBot / EDOPro AI nicknames: `[AI] Toon 2026`, `WindBot`, etc. */
export function isLikelyBotName(name: string, extraHints: string[] = []): boolean {
  const n = normalizeSeatName(name);
  if (!n) return false;
  if (n.includes("[ai]") || n.startsWith("ai ") || /\bwindbot\b/.test(n)) {
    return true;
  }
  return extraHints.some((hint) => namesMatch(n, hint));
}

/**
 * Replay controller 0 is whoever the file lists first — often the player
 * who went first, not the human host. Pick the human's controller from names.
 */
export function guessYouCtrl(
  homeName: string,
  oppName: string,
  options: WalkthroughSeatOptions = {},
): 0 | 1 {
  if (options.youCtrl === 0 || options.youCtrl === 1) return options.youCtrl;
  if (options.orient === false) return 0;

  const homeIsBot = isLikelyBotName(homeName, options.botNames);
  const oppIsBot = isLikelyBotName(oppName, options.botNames);
  if (homeIsBot !== oppIsBot) return homeIsBot ? 1 : 0;

  const playerHints = options.playerNames ?? [];
  const homeIsPlayer = playerHints.some((hint) => namesMatch(homeName, hint));
  const oppIsPlayer = playerHints.some((hint) => namesMatch(oppName, hint));
  if (homeIsPlayer !== oppIsPlayer) return homeIsPlayer ? 0 : 1;

  return 0;
}

function goingOfSteps(steps: ReplayStep[]): Going {
  const firstTurn = steps.find((s) => s.kind === "phase" && s.turn === 1);
  return firstTurn?.actor === "opp" ? "second" : "first";
}

function flipActor(actor: Actor): Actor {
  return actor === "you" ? "opp" : "you";
}

function swapBoard(board: BoardSnapshot): BoardSnapshot {
  return {
    ...board,
    lpYou: board.lpOpp,
    lpOpp: board.lpYou,
    youHand: board.oppHand,
    oppHand: board.youHand,
    youMonsters: board.oppMonsters,
    oppMonsters: board.youMonsters,
    youSpells: board.oppSpells,
    oppSpells: board.youSpells,
    youGrave: board.oppGrave,
    oppGrave: board.youGrave,
    youBanished: board.oppBanished,
    oppBanished: board.youBanished,
  };
}

const CHOSEN_FLIPS: [string, string][] = [
  ["Mano inicial del rival", "Mano inicial"],
  ["El rival invocó", "Invocaste"],
  ["El rival colocó", "Colocaste"],
  ["El rival activó", "Activaste"],
  ["El rival atacó", "Atacaste"],
  ["El rival robó", "Robaste"],
  ["Perdiste el duelo", "Ganaste el duelo"],
  ["(rival)", "(tú)"],
];

function flipChosenText(text: string): string {
  for (const [opp, you] of CHOSEN_FLIPS) {
    if (text.includes(opp)) return text.replace(opp, you);
    if (text.includes(you)) return text.replace(you, opp);
  }
  return text;
}

function flipWinner(winner: ReplayWalkthrough["winner"]): ReplayWalkthrough["winner"] {
  if (winner === "you") return "opp";
  if (winner === "opp") return "you";
  return winner;
}

const DECISION_KINDS = new Set<StepKind>([
  "summon",
  "spsummon",
  "set",
  "activate",
  "attack",
]);

/** Swap you/opp on an already parsed walkthrough (saved reviews, UI override). */
export function flipWalkthroughSeat(walk: ReplayWalkthrough): ReplayWalkthrough {
  const youCtrl: 0 | 1 = walk.youCtrl === 1 ? 0 : 1;
  const steps = walk.steps.map((step) => ({
    ...step,
    actor: flipActor(step.actor),
    decision: DECISION_KINDS.has(step.kind) ? !step.decision : false,
    chosen: flipChosenText(step.chosen),
    board: swapBoard(step.board),
  }));
  return {
    ...walk,
    youName: walk.oppName,
    oppName: walk.youName,
    youCtrl,
    going: goingOfSteps(steps),
    winner: flipWinner(walk.winner),
    steps,
  };
}

/** If the first listed name is the WindBot, flip so "you" is the human. */
export function orientWalkthroughToHuman(
  walk: ReplayWalkthrough,
  options: WalkthroughSeatOptions = {},
): ReplayWalkthrough {
  const youCtrl = guessYouCtrl(walk.youName, walk.oppName, options);
  if (youCtrl === 0) {
    return {
      ...walk,
      youCtrl: walk.youCtrl ?? 0,
      going: walk.going ?? goingOfSteps(walk.steps),
    };
  }
  return flipWalkthroughSeat({
    ...walk,
    youCtrl: walk.youCtrl ?? 0,
    going: walk.going ?? goingOfSteps(walk.steps),
  });
}

function readU32At(buf: Uint8Array, pos: number) {
  return (
    (buf[pos] |
      (buf[pos + 1] << 8) |
      (buf[pos + 2] << 16) |
      (buf[pos + 3] << 24)) >>>
    0
  );
}

function utf16At(buf: Uint8Array, pos: number, chars = 20) {
  let s = "";
  for (let i = 0; i < chars; i++) {
    const off = pos + i * 2;
    if (off + 1 >= buf.length) break;
    const c = buf[off] | (buf[off + 1] << 8);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function scorePacketStream(buf: Uint8Array, pos: number) {
  let score = 0;
  let i = pos;
  for (let n = 0; n < 12 && i + 5 <= buf.length; n++) {
    const msg = buf[i];
    const len = readU32At(buf, i + 1);
    if (msg === 0 || msg > 200 || len > 2_000_000 || i + 5 + len > buf.length) {
      return -1;
    }
    if (
      msg === MSG.START ||
      msg === MSG.NEW_TURN ||
      msg === MSG.NEW_PHASE ||
      msg === MSG.MOVE ||
      msg === MSG.SUMMONING ||
      msg === MSG.SPSUMMONING ||
      msg === MSG.CHAINING ||
      msg === MSG.DRAW ||
      msg === 6
    ) {
      score += 3;
    } else {
      score += 1;
    }
    i += 5 + len;
  }
  return score;
}

function readCountedNames(buf: Uint8Array, pos: number) {
  if (pos + 4 > buf.length) return null;
  const homeCount = readU32At(buf, pos);
  if (homeCount < 1 || homeCount > 4) return null;
  let next = pos + 4;
  const homes: string[] = [];
  for (let i = 0; i < homeCount; i++) {
    if (next + 40 > buf.length) return null;
    homes.push(utf16At(buf, next));
    next += 40;
  }
  if (next + 4 > buf.length) return null;
  const oppCount = readU32At(buf, next);
  if (oppCount < 1 || oppCount > 4) return null;
  next += 4;
  const opps: string[] = [];
  for (let i = 0; i < oppCount; i++) {
    if (next + 40 > buf.length) return null;
    opps.push(utf16At(buf, next));
    next += 40;
  }
  return { homes, opps, next };
}

function readFixedNames(buf: Uint8Array, eachSide: number) {
  const bytes = eachSide * 2 * 40;
  if (buf.length < bytes) return null;
  const homes: string[] = [];
  const opps: string[] = [];
  let next = 0;
  for (let i = 0; i < eachSide; i++) {
    homes.push(utf16At(buf, next));
    next += 40;
  }
  for (let i = 0; i < eachSide; i++) {
    opps.push(utf16At(buf, next));
    next += 40;
  }
  return { homes, opps, next };
}

/**
 * EDOPro `ParseNames` only prefixes a player count when REPLAY_NEWREPLAY is set
 * and the file is not SINGLE_MODE. SINGLE_MODE / old 1v1 dumps two 40-byte
 * UTF-16 names with no counts — reading a u32 count there desyncs the packet
 * stream and yields zero summon/activate steps.
 */
function skipReplayPreamble(r: Reader): { youName: string; oppName: string } {
  const buf = r.buf;
  const layouts = [
    readCountedNames(buf, 0),
    readFixedNames(buf, 1),
    readFixedNames(buf, 2),
  ].filter((layout): layout is NonNullable<typeof layout> => layout !== null);

  let best: { homes: string[]; opps: string[]; pos: number } | null = null;
  let bestScore = -1;
  for (const layout of layouts) {
    for (const flagSize of [8, 4]) {
      const pos = layout.next + flagSize;
      const score = scorePacketStream(buf, pos);
      if (score > bestScore) {
        bestScore = score;
        best = { homes: layout.homes, opps: layout.opps, pos };
      }
    }
  }

  if (!best) {
    const homes = [r.utf16(), r.utf16()];
    r.u64();
    return { youName: homes[0] || "Tú", oppName: "Rival" };
  }

  r.pos = best.pos;
  return {
    youName: best.homes[0] || "Tú",
    oppName: best.opps[0] || "Rival",
  };
}

function isZoneLoc(loc: number) {
  return (
    ((loc & LOC.MZONE) !== 0 || (loc & LOC.SZONE) !== 0) &&
    (loc & LOC.OVERLAY) === 0
  );
}

function takeFrom(side: SideState, loc: number, seq: number, code: number) {
  const pile = pileFor(side, loc);
  if (!pile) return;
  if (isZoneLoc(loc) && seq < 16) {
    while (pile.length <= seq) pile.push(0);
    pile[seq] = 0;
    const poss = loc & LOC.MZONE ? side.mpos : side.spos;
    while (poss.length <= seq) poss.push(0);
    poss[seq] = 0;
    return;
  }
  takeCode(pile, code);
}

function putTo(side: SideState, loc: number, seq: number, code: number, pos = 0) {
  const pile = pileFor(side, loc);
  if (!pile) return;
  if (isZoneLoc(loc) && seq < 16) {
    while (pile.length <= seq) pile.push(0);
    pile[seq] = code;
    const poss = loc & LOC.MZONE ? side.mpos : side.spos;
    while (poss.length <= seq) poss.push(0);
    poss[seq] = pos;
    return;
  }
  if (code > 0) pile.push(code);
}

export function parseYrpxWalkthrough(
  decompressed: Uint8Array,
  fileName = "",
  options: WalkthroughSeatOptions = {},
): ReplayWalkthrough {
  const r = new Reader(decompressed);
  const names = skipReplayPreamble(r);
  const youCtrl = guessYouCtrl(names.youName, names.oppName, options);
  const youName = youCtrl === 0 ? names.youName : names.oppName;
  const oppName = youCtrl === 0 ? names.oppName : names.youName;

  const sides = [emptySide(8000), emptySide(8000)];
  const you = () => sides[youCtrl];
  const opp = () => sides[1 - youCtrl];

  let turn = 0;
  let phase = "Inicio";
  let winner: Actor | "unknown" = "unknown";
  const steps: ReplayStep[] = [];
  const allCodes = new Set<number>();
  const remember = (code: number) => {
    if (code > 0) allCodes.add(code);
  };

  const push = (step: Omit<ReplayStep, "id" | "board" | "turn" | "phase">) => {
    steps.push({
      id: steps.length,
      turn,
      phase,
      board: cloneBoard(turn, phase, you(), opp()),
      ...step,
    });
  };

  while (r.remaining() >= 5) {
    const msg = r.u8();
    const len = r.u32();
    if (len > r.remaining()) break;
    const payload = r.bytes(len);

    if (msg === MSG.START && payload.length >= 17) {
      sides[0].lp =
        payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
      sides[1].lp =
        payload[5] | (payload[6] << 8) | (payload[7] << 16) | (payload[8] << 24);
    } else if (msg === MSG.NEW_TURN && payload.length >= 1) {
      turn += 1;
      phase = "Draw Phase";
      push({
        actor: actorOf(payload[0], youCtrl),
        kind: "phase",
        decision: false,
        chosen: `Turno ${turn} (${payload[0] === youCtrl ? "tú" : "rival"})`,
        cardCodes: [],
      });
    } else if (msg === MSG.NEW_PHASE && payload.length >= 2) {
      const ph = payload[0] | (payload[1] << 8);
      phase = PHASE_LABEL[ph] ?? `Fase ${ph}`;
    } else if (msg === MSG.DRAW && payload.length >= 5) {
      const ctrl = payload[0];
      const count =
        payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
      const codes: number[] = [];
      for (let i = 0; i < count; i++) {
        const off = 5 + i * 8;
        if (off + 4 > payload.length) break;
        const code =
          payload[off] |
          (payload[off + 1] << 8) |
          (payload[off + 2] << 16) |
          (payload[off + 3] << 24);
        codes.push(code >>> 0);
        remember(code >>> 0);
        sides[ctrl]?.hand.push(code >>> 0);
      }
      const opening = turn === 0;
      const mine = ctrl === youCtrl;
      push({
        actor: actorOf(ctrl, youCtrl),
        kind: "draw",
        decision: false,
        chosen: opening
          ? mine
            ? "Mano inicial"
            : "Mano inicial del rival"
          : mine
            ? `Robaste ${codes.length} carta(s)`
            : `El rival robó ${codes.length} carta(s)`,
        cardCodes: codes,
      });
    } else if (msg === MSG.MOVE && payload.length >= 28) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const prev = locInfo(payload, 4);
      const next = locInfo(payload, 14);
      remember(code);
      takeFrom(sides[prev.ctrl] ?? sides[youCtrl], prev.loc, prev.seq, code);
      putTo(sides[next.ctrl] ?? sides[youCtrl], next.loc, next.seq, code, next.pos);
      const isSet =
        (prev.loc & LOC.HAND) !== 0 &&
        ((next.loc & LOC.SZONE) !== 0 || (next.loc & LOC.MZONE) !== 0) &&
        facedown(next.pos);
      if (isSet) {
        const mineSet = prev.ctrl === youCtrl;
        push({
          actor: actorOf(prev.ctrl, youCtrl),
          kind: "set",
          decision: mineSet,
          chosen: mineSet
            ? "Colocaste una carta boca abajo"
            : "El rival colocó una carta boca abajo",
          cardCodes: mineSet ? [code] : [],
          loc: next.loc,
          seq: next.seq,
          pos: next.pos,
        });
      }
    } else if (msg === MSG.SUMMONING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      putTo(sides[loc.ctrl] ?? sides[youCtrl], loc.loc, loc.seq, code, loc.pos);
      push({
        actor: actorOf(loc.ctrl, youCtrl),
        kind: "summon",
        decision: loc.ctrl === youCtrl,
        chosen: `${who(loc.ctrl, youCtrl)} de normal CARD`,
        cardCodes: [code],
        loc: loc.loc,
        seq: loc.seq,
        pos: loc.pos,
      });
    } else if (msg === MSG.SPSUMMONING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      putTo(sides[loc.ctrl] ?? sides[youCtrl], loc.loc, loc.seq, code, loc.pos);
      push({
        actor: actorOf(loc.ctrl, youCtrl),
        kind: "spsummon",
        decision: loc.ctrl === youCtrl,
        chosen: `${who(loc.ctrl, youCtrl)} de especial CARD`,
        cardCodes: [code],
        loc: loc.loc,
        seq: loc.seq,
        pos: loc.pos,
      });
    } else if (msg === MSG.CHAINING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      push({
        actor: actorOf(loc.ctrl, youCtrl),
        kind: "activate",
        decision: loc.ctrl === youCtrl,
        chosen:
          loc.ctrl === youCtrl ? "Activaste CARD" : "El rival activó CARD",
        cardCodes: [code],
        loc: loc.loc,
        seq: loc.seq,
        pos: loc.pos,
      });
    } else if (msg === MSG.POS_CHANGE && payload.length >= 9) {
      const ctrl = payload[4];
      const loc = payload[5];
      const seq = payload[6];
      const nextPos = payload[8];
      const side = sides[ctrl];
      if (side && seq < 16) {
        const poss = loc & LOC.MZONE ? side.mpos : loc & LOC.SZONE ? side.spos : null;
        if (poss) {
          while (poss.length <= seq) poss.push(0);
          poss[seq] = nextPos;
        }
      }
    } else if (msg === MSG.ATTACK && payload.length >= 2) {
      const ctrl = payload[0];
      const loc = payload[1];
      const seq =
        payload.length >= 6
          ? (payload[2] | (payload[3] << 8) | (payload[4] << 16) | (payload[5] << 24)) >>> 0
          : 0;
      const pile = loc === LOC.MZONE ? sides[ctrl]?.mzone : [];
      const code = pile?.[seq] ?? pile?.[0] ?? 0;
      if (code) remember(code);
      push({
        actor: actorOf(ctrl, youCtrl),
        kind: "attack",
        decision: ctrl === youCtrl,
        chosen:
          ctrl === youCtrl ? "Atacaste con CARD" : "El rival atacó con CARD",
        cardCodes: code ? [code] : [],
      });
    } else if (msg === MSG.WIN && payload.length >= 1) {
      winner = actorOf(payload[0], youCtrl);
      push({
        actor: winner,
        kind: "win",
        decision: false,
        chosen: winner === "you" ? "Ganaste el duelo" : "Perdiste el duelo",
        cardCodes: [],
      });
    }
  }

  return {
    fileName,
    youName,
    oppName,
    youCtrl,
    going: goingOfSteps(steps),
    winner,
    steps,
    cardCodes: [...allCodes],
  };
}

export function applyCardNames(
  text: string,
  codes: number[],
  names: Record<string, string>,
): string {
  if (!text.includes("CARD")) {
    if (codes.length === 0) return text;
    const labeled = codes.map((c) => names[String(c)] ?? `#${c}`).join(", ");
    return labeled ? `${text}: ${labeled}` : text;
  }
  const labeled = codes.map((c) => names[String(c)] ?? `#${c}`);
  if (labeled.length === 0) return text.replace("CARD", "una carta");
  if (labeled.length === 1) return text.replace("CARD", labeled[0]);
  return text.replace("CARD", labeled.join(", "));
}

export function decodeBase64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
