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
}

export interface ReplayWalkthrough {
  fileName: string;
  youName: string;
  oppName: string;
  winner: Actor | "unknown";
  steps: ReplayStep[];
  cardCodes: number[];
}

class Reader {
  pos = 0;
  constructor(private buf: Uint8Array) {}
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
  const refs = (codes: Pile): CardRef[] => codes.filter((c) => c > 0).map((code) => ({ code }));
  return {
    turn,
    phase,
    lpYou: you.lp,
    lpOpp: opp.lp,
    youHand: refs(you.hand),
    oppHand: refs(opp.hand),
    youMonsters: refs(you.mzone),
    oppMonsters: refs(opp.mzone),
    youSpells: refs(you.szone),
    oppSpells: refs(opp.szone),
    youGrave: refs(you.grave),
    oppGrave: refs(opp.grave),
  };
}

function actorOf(ctrl: number): Actor {
  return ctrl === 0 ? "you" : "opp";
}

function who(ctrl: number) {
  return ctrl === 0 ? "Invocaste" : "El rival invocó";
}

export function parseYrpxWalkthrough(
  decompressed: Uint8Array,
  fileName = "",
): ReplayWalkthrough {
  const r = new Reader(decompressed);
  const homeCount = r.u32();
  const homes = Array.from({ length: homeCount }, () => r.utf16());
  const oppCount = r.u32();
  const opps = Array.from({ length: oppCount }, () => r.utf16());
  r.u64();

  const youName = homes[0] || "Tú";
  const oppName = opps[0] || "Rival";

  const you = emptySide(8000);
  const opp = emptySide(8000);
  const sides = [you, opp];

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
      board: cloneBoard(turn, phase, you, opp),
      ...step,
    });
  };

  while (r.remaining() >= 5) {
    const msg = r.u8();
    const len = r.u32();
    if (len > r.remaining()) break;
    const payload = r.bytes(len);

    if (msg === MSG.START && payload.length >= 17) {
      you.lp =
        payload[1] | (payload[2] << 8) | (payload[3] << 16) | (payload[4] << 24);
      opp.lp =
        payload[5] | (payload[6] << 8) | (payload[7] << 16) | (payload[8] << 24);
    } else if (msg === MSG.NEW_TURN && payload.length >= 1) {
      turn += 1;
      phase = "Draw Phase";
      push({
        actor: actorOf(payload[0]),
        kind: "phase",
        decision: false,
        chosen: `Turno ${turn} (${payload[0] === 0 ? "tú" : "rival"})`,
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
      push({
        actor: actorOf(ctrl),
        kind: "draw",
        decision: false,
        chosen: opening
          ? ctrl === 0
            ? "Mano inicial"
            : "Mano inicial del rival"
          : ctrl === 0
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
      const fromPile = pileFor(sides[prev.ctrl] ?? you, prev.loc);
      const toPile = pileFor(sides[next.ctrl] ?? you, next.loc);
      if (fromPile) takeCode(fromPile, code);
      if (toPile) toPile.push(code);
      const isSet =
        (prev.loc & LOC.HAND) !== 0 &&
        ((next.loc & LOC.SZONE) !== 0 || (next.loc & LOC.MZONE) !== 0) &&
        facedown(next.pos);
      if (isSet) {
        push({
          actor: actorOf(prev.ctrl),
          kind: "set",
          decision: prev.ctrl === 0,
          chosen:
            prev.ctrl === 0
              ? "Colocaste una carta boca abajo"
              : "El rival colocó una carta boca abajo",
          cardCodes: prev.ctrl === 0 ? [code] : [],
        });
      }
    } else if (msg === MSG.SUMMONING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      push({
        actor: actorOf(loc.ctrl),
        kind: "summon",
        decision: loc.ctrl === 0,
        chosen: `${who(loc.ctrl)} de normal CARD`,
        cardCodes: [code],
      });
    } else if (msg === MSG.SPSUMMONING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      push({
        actor: actorOf(loc.ctrl),
        kind: "spsummon",
        decision: loc.ctrl === 0,
        chosen: `${who(loc.ctrl)} de especial CARD`,
        cardCodes: [code],
      });
    } else if (msg === MSG.CHAINING && payload.length >= 14) {
      const code =
        payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24);
      const loc = locInfo(payload, 4);
      remember(code);
      push({
        actor: actorOf(loc.ctrl),
        kind: "activate",
        decision: loc.ctrl === 0,
        chosen:
          loc.ctrl === 0 ? "Activaste CARD" : "El rival activó CARD",
        cardCodes: [code],
      });
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
        actor: actorOf(ctrl),
        kind: "attack",
        decision: ctrl === 0,
        chosen: ctrl === 0 ? "Atacaste con CARD" : "El rival atacó con CARD",
        cardCodes: code ? [code] : [],
      });
    } else if (msg === MSG.WIN && payload.length >= 1) {
      winner = actorOf(payload[0]);
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
