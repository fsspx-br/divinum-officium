/**
 * color.ts — Liturgical color derivation
 *
 * Implements getLiturgicalColor(season, celebrationName, rankType, numericRank)
 * following traditional Roman Rite rubric priorities.
 */

import type { LiturgicalColor, Season } from './types';

/**
 * Derive the liturgical color for a given day.
 *
 * Priority order (first match wins):
 *  1. All Souls / Defunctorum → black
 *  2. Pentecost Sunday and Pentecost Ember Days → red
 *  3. All other Ember Days → violet
 *  4. Gaudete Sunday (Dominica III Adventus) → rose
 *  5. Laetare Sunday (Dominica IV in Quadragesima) → rose
 *  6. Feasts of Cross / Crucis → red
 *  7. Precious Blood / Sanguinis → red
 *  8. Good Friday / Parasceve → black
 *  9. Martyrs → red
 * 10. Apostles / Evangelists → red
 * 11. BVM feasts → white
 * 12. Confessors, Virgins, Angels, Bishops, Abbots, Widows, Doctors → white
 * 13. Feasts of the Lord with rank ≥ 5 → white
 * 14. Named feasts (rank ≥ 2, not feria/dominica) in Lent/Advent → white
 * 15. Season defaults
 */
export function getLiturgicalColor(
  season: Season,
  celebrationName: string,
  rankType: string,
  numericRank: number,
): LiturgicalColor {
  const name = celebrationName;
  const nameLower = name.toLowerCase();
  const normalizedName = nameLower.normalize('NFD').replace(/\p{M}/gu, '');
  const rankLower = rankType.toLowerCase();

  // 1. All Souls / Office of the Dead
  if (/defunctorum|omnium fidelium|all souls/i.test(name)) {
    return 'black';
  }

  // 2. Pentecost Sunday and explicitly named Pentecost Ember Days
  // weekRef Pasc7 maps to the Pentecost Sunday mass; the celebration name
  // typically contains "Dominica Pentecostes" or "In Die Pentecostes"
  if (
    /pentecostes|pentecosten|whitsunday/i.test(name) &&
    !/post(?:\s+octavam)?\s+pentecost/i.test(name)
  ) {
    return 'red';
  }

  // 3. Ember Days: red during Pentecost week, violet in every other season.
  // Some source files use the abbreviated title "Feria Quarta Quattuor Temporum"
  // without naming Pentecost, so Easter season is also used to identify that case.
  if (/quattuor(?:\s+temporum)?|ember|temporas/i.test(normalizedName)) {
    return season === 'easter' || /pentecost/i.test(normalizedName) ? 'red' : 'violet';
  }

  // 4. Gaudete Sunday (3rd Sunday of Advent)
  if (/dominica.*iii.*adventus|adventus.*iii/i.test(name) || /gaudete/i.test(name)) {
    return 'rose';
  }

  // 4. Laetare Sunday (4th Sunday of Lent) — only the Sunday itself, not the week's ferias
  if (/dominica.*iv.*quadragesima/i.test(name) || /laetare/i.test(name)) {
    return 'rose';
  }

  // 5. Feasts of the Cross
  if (/crucis|inventio crucis|exaltatio crucis/i.test(name)) {
    return 'red';
  }

  // 6. Precious Blood
  if (/pretiosissimi sanguinis|sanguinis d\.?n\.?/i.test(name) || /precious blood/i.test(name)) {
    return 'red';
  }

  // 7. Good Friday / Parasceve
  if (/parasceve|good friday/i.test(name)) {
    return 'black';
  }

  // 8. Martyrs
  if (/martyr|martir/i.test(normalizedName)) {
    return 'red';
  }

  // 9. Apostles and Evangelists
  if (/apostol|evangelis/i.test(name)) {
    return 'red';
  }

  // 10. BVM feasts
  if (
    /b\.?\s*m\.?\s*v\.|beatae mariae|beata maria|immaculata|assumptio|nativitas b\.|b\. mariae/i.test(name)
  ) {
    return 'white';
  }

  // 11. Confessors, Virgins, Angels, Bishops, Abbots, Widows, Doctors
  if (
    /confessor|virginis|virginum|angelorum|archangel|episcop|abbatis|abbatum|viduae|doctoris|doctorum/i.test(
      name,
    ) ||
    /confessor|virgin|angel|archangel|bishop|abbot|widow|doctor/i.test(rankLower)
  ) {
    return 'white';
  }

  // 12. Feasts of the Lord with rank ≥ 5
  // Match specific Christ/Lord mystery feasts but NOT generic "Dominica" (Sunday) names.
  // "Dominica" means Sunday; "Domini" as a genitive means "of the Lord" (feast of the Lord).
  if (
    numericRank >= 5 &&
    /\bd\.n\.\b|jesu christi|in nativitate|nativitatis domini|transfiguratio|circumcisio|praesentatio domini|sacratissimi cordis|corporis christi|ss\. trinitatis|christi regis/i.test(
      name,
    )
  ) {
    return 'white';
  }

  // 13. Named saints/feasts in Lent/Advent: rank ≥ 2, not feria/dominica/Sunday
  if (
    (season === 'lent' || season === 'passiontide' || season === 'advent') &&
    numericRank >= 2 &&
    !/feria|sabbato|dominica/i.test(rankLower) &&
    !/dominica/i.test(name) &&
    name.trim() !== ''
  ) {
    return 'white';
  }

  // 14. Season defaults
  return seasonDefaultColor(season, numericRank);
}

/**
 * Return the default liturgical color for a season.
 */
function seasonDefaultColor(season: Season, numericRank: number): LiturgicalColor {
  switch (season) {
    case 'advent':
    case 'lent':
    case 'passiontide':
    case 'septuagesima':
      return 'violet';

    case 'christmas':
    case 'easter':
      return 'white';

    case 'epiphany':
      // High-rank feasts of the Lord in Epiphany → white; ordinary time → green
      return numericRank >= 5 ? 'white' : 'green';

    case 'pentecost':
    default:
      return 'green';
  }
}
