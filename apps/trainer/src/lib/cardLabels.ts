const ATTRIBUTES: Record<string, string> = {
  dark: "OSCURIDAD",
  light: "LUZ",
  earth: "TIERRA",
  water: "AGUA",
  fire: "FUEGO",
  wind: "VIENTO",
  divine: "DIVINIDAD",
};

const RACES: Record<string, string> = {
  aqua: "Aqua",
  beast: "Bestia",
  "beast-warrior": "Guerrero-Bestia",
  "creator-god": "Dios Creador",
  cyberse: "Ciberso",
  dinosaur: "Dinosaurio",
  "divine-beast": "Bestia Divina",
  dragon: "Dragón",
  fairy: "Hada",
  fiend: "Demonio",
  fish: "Pez",
  illusion: "Ilusión",
  insect: "Insecto",
  machine: "Máquina",
  plant: "Planta",
  psychic: "Psíquico",
  pyro: "Piro",
  reptile: "Reptil",
  rock: "Roca",
  "sea serpent": "Serpiente Marina",
  spellcaster: "Lanzador de Conjuros",
  thunder: "Trueno",
  warrior: "Guerrero",
  "winged beast": "Bestia Alada",
  wyrm: "Wyrm",
  zombie: "Zombi",
};

const TYPE_PHRASES: [string, string][] = [
  ["Skill Card", "Carta de Habilidad"],
  ["Trap Monster", "Monstruo-Trampa"],
  ["Fusion Monster", "Monstruo de Fusión"],
  ["Synchro Monster", "Monstruo de Sincronía"],
  ["XYZ Monster", "Monstruo Xyz"],
  ["Xyz Monster", "Monstruo Xyz"],
  ["Link Monster", "Monstruo de Enlace"],
  ["Pendulum Monster", "Monstruo de Péndulo"],
  ["Ritual Monster", "Monstruo de Ritual"],
  ["Toon Monster", "Monstruo Toon"],
  ["Spirit Monster", "Monstruo Espíritu"],
  ["Union Monster", "Monstruo de Unión"],
  ["Gemini Monster", "Monstruo Géminis"],
  ["Tuner Monster", "Monstruo Cantante"],
  ["Flip Monster", "Monstruo de Volteo"],
  ["Normal Monster", "Monstruo Normal"],
  ["Effect Monster", "Monstruo de Efecto"],
  ["Token Monster", "Ficha"],
  ["Spell Card", "Carta Mágica"],
  ["Trap Card", "Carta de Trampa"],
  ["Normal Spell", "Mágica Normal"],
  ["Quick-Play Spell", "Mágica de Juego Rápido"],
  ["Continuous Spell", "Mágica Continua"],
  ["Equip Spell", "Mágica de Equipo"],
  ["Field Spell", "Mágica de Campo"],
  ["Ritual Spell", "Mágica de Ritual"],
  ["Normal Trap", "Trampa Normal"],
  ["Continuous Trap", "Trampa Continua"],
  ["Counter Trap", "Trampa de Contraefecto"],
];

const TYPE_TOKENS: [RegExp, string][] = [
  [/\bQuick-Play\b/gi, "de Juego Rápido"],
  [/\bContinuous\b/gi, "Continua"],
  [/\bCounter\b/gi, "de Contraefecto"],
  [/\bPendulum\b/gi, "Péndulo"],
  [/\bSynchro\b/gi, "Sincronía"],
  [/\bRitual\b/gi, "Ritual"],
  [/\bFusion\b/gi, "Fusión"],
  [/\bTuner\b/gi, "Cantante"],
  [/\bSpirit\b/gi, "Espíritu"],
  [/\bUnion\b/gi, "Unión"],
  [/\bGemini\b/gi, "Géminis"],
  [/\bToon\b/gi, "Toon"],
  [/\bFlip\b/gi, "Volteo"],
  [/\bLink\b/gi, "Enlace"],
  [/\bXYZ\b/gi, "Xyz"],
  [/\bXyz\b/gi, "Xyz"],
  [/\bEffect\b/gi, "de Efecto"],
  [/\bNormal\b/gi, "Normal"],
  [/\bToken\b/gi, "Ficha"],
  [/\bSpell\b/gi, "Mágica"],
  [/\bTrap\b/gi, "Trampa"],
  [/\bMonster\b/gi, "Monstruo"],
  [/\bCard\b/gi, "Carta"],
];

function lookup(map: Record<string, string>, value?: string): string | undefined {
  if (!value) return undefined;
  return map[value.trim().toLowerCase()] ?? value;
}

export function translateAttribute(value?: string): string | undefined {
  return lookup(ATTRIBUTES, value);
}

export function translateRace(value?: string): string | undefined {
  return lookup(RACES, value);
}

export function translateType(value?: string): string | undefined {
  if (!value) return undefined;
  const exact = TYPE_PHRASES.find(
    ([en]) => en.toLowerCase() === value.trim().toLowerCase(),
  );
  if (exact) return exact[1];
  let out = value;
  for (const [en, es] of TYPE_PHRASES) {
    out = out.replace(new RegExp(en, "ig"), es);
  }
  for (const [pattern, es] of TYPE_TOKENS) {
    out = out.replace(pattern, es);
  }
  return out.replace(/\s+/g, " ").trim();
}

export function isXyzType(type?: string): boolean {
  return Boolean(type && /xyz/i.test(type));
}

export function isLinkType(type?: string): boolean {
  return Boolean(type && /\blink\b/i.test(type));
}

export function isPendulumType(type?: string): boolean {
  return Boolean(type && /pendulum/i.test(type));
}

export function isSpellOrTrap(type?: string): boolean {
  return Boolean(type && /(spell|trap|mágica|trampa)/i.test(type));
}

export function formatCombatStat(value?: number): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value < 0 ? "?" : String(value);
}
