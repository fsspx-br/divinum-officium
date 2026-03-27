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
 *  2. Pentecost Sunday (temporal Pasc7) → red
 *  3. Gaudete Sunday (Dominica III Adventus) → rose
 *  4. Laetare Sunday (Dominica IV in Quadragesima) → rose
 *  5. Feasts of Cross / Crucis → red
 *  6. Precious Blood / Sanguinis → red
 *  7. Good Friday / Parasceve → black
 *  8. Martyrs → red
 *  9. Apostles / Evangelists → red
 * 10. BVM feasts → white
 * 11. Confessors, Virgins, Angels, Bishops, Abbots, Widows, Doctors → white
 * 12. Feasts of the Lord with rank ≥ 5 → white
 * 13. Named feasts (rank ≥ 2, not feria/dominica) in Lent/Advent → white
 * 14. Season defaults
 */
export function getLiturgicalColor(
  season: Season,
  celebrationName: string,
  rankType: string,
  numericRank: number,
): LiturgicalColor {
  const name = celebrationName;
  const nameLower = name.toLowerCase();
  const rankLower = rankType.toLowerCase();

  // 1. All Souls / Office of the Dead
  if (/defunctorum|omnium fidelium|all souls/i.test(name)) {
    return 'black';
  }

  // 2. Pentecost Sunday
  // weekRef Pasc7 maps to the Pentecost Sunday mass; the celebration name
  // typically contains "Dominica Pentecostes" or "In Die Pentecostes"
  if (/pentecostes|pentecosten|whitsunday/i.test(name) && !/post pentecosten|post pentecost/i.test(name)) {
    return 'red';
  }

  // 3. Gaudete Sunday (3rd Sunday of Advent)
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
  if (/martyr/i.test(name)) {
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
