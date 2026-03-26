import { describe, it, expect } from 'vitest';
import { getLiturgicalColor } from '@engine/color';

describe('getLiturgicalColor', () => {
  // ---------------------------------------------------------------------------
  // Rule 1: All Souls → black
  // ---------------------------------------------------------------------------
  it('returns black for All Souls (Commemoratio Omnium Fidelium Defunctorum)', () => {
    expect(
      getLiturgicalColor('pentecost', 'Commemoratio Omnium Fidelium Defunctorum', 'Duplex', 3),
    ).toBe('black');
  });

  it('returns black for any Defunctorum office', () => {
    expect(getLiturgicalColor('pentecost', 'Officium Defunctorum', 'Feria', 1)).toBe('black');
  });

  // ---------------------------------------------------------------------------
  // Rule 2: Pentecost Sunday → red
  // ---------------------------------------------------------------------------
  it('returns red for Dominica Pentecostes', () => {
    expect(
      getLiturgicalColor('easter', 'Dominica Pentecostes', 'Duplex I classis', 7),
    ).toBe('red');
  });

  it('returns red for In Die Pentecostes', () => {
    expect(getLiturgicalColor('easter', 'In Die Pentecostes', 'Duplex I classis', 7)).toBe('red');
  });

  // ---------------------------------------------------------------------------
  // Rule 3: Gaudete Sunday → rose
  // ---------------------------------------------------------------------------
  it('returns rose for Gaudete Sunday (Dominica III Adventus)', () => {
    expect(
      getLiturgicalColor('advent', 'Dominica III Adventus', 'Semiduplex', 5),
    ).toBe('rose');
  });

  // ---------------------------------------------------------------------------
  // Rule 4: Laetare Sunday → rose
  // ---------------------------------------------------------------------------
  it('returns rose for Laetare Sunday (Dominica IV in Quadragesima)', () => {
    expect(
      getLiturgicalColor('lent', 'Dominica IV in Quadragesima', 'Semiduplex', 5),
    ).toBe('rose');
  });

  // ---------------------------------------------------------------------------
  // Rule 5: Feasts of the Cross → red
  // ---------------------------------------------------------------------------
  it('returns red for Inventio Crucis', () => {
    expect(getLiturgicalColor('easter', 'In Inventione Sanctae Crucis', 'Duplex majus', 4)).toBe(
      'red',
    );
  });

  it('returns red for Exaltatio Crucis', () => {
    expect(
      getLiturgicalColor('pentecost', 'In Exaltatione Sanctae Crucis', 'Duplex majus', 4),
    ).toBe('red');
  });

  // ---------------------------------------------------------------------------
  // Rule 7: Good Friday / Parasceve → black
  // ---------------------------------------------------------------------------
  it('returns black for Good Friday (Parasceve)', () => {
    expect(
      getLiturgicalColor('lent', 'Feria VI in Parasceve', 'Feria privilegiata', 6),
    ).toBe('black');
  });

  // ---------------------------------------------------------------------------
  // Rule 8: Martyrs → red
  // ---------------------------------------------------------------------------
  it('returns red for a martyr feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'Ss. Ioannis et Pauli Martyrum', 'Duplex majus', 4),
    ).toBe('red');
  });

  it('returns red for a single martyr', () => {
    expect(
      getLiturgicalColor('lent', 'S. Thomae Apostoli et Martyris', 'Duplex', 3),
    ).toBe('red');
  });

  // ---------------------------------------------------------------------------
  // Rule 9: Apostles / Evangelists → red
  // ---------------------------------------------------------------------------
  it('returns red for an Apostle feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'In Festo Ss. Petri et Pauli Apostolorum', 'Duplex I classis', 6),
    ).toBe('red');
  });

  it('returns red for an Evangelist feast', () => {
    expect(
      getLiturgicalColor('easter', 'S. Marci Evangelistae', 'Duplex majus', 4),
    ).toBe('red');
  });

  // ---------------------------------------------------------------------------
  // Rule 10: BVM feasts → white
  // ---------------------------------------------------------------------------
  it('returns white for a BVM feast (B.M.V.)', () => {
    expect(
      getLiturgicalColor('pentecost', 'B.M.V. de Monte Carmelo', 'Duplex majus', 4),
    ).toBe('white');
  });

  it('returns white for Assumptio B.M.V.', () => {
    expect(
      getLiturgicalColor('pentecost', 'In Assumptione B.M.V.', 'Duplex I classis', 6),
    ).toBe('white');
  });

  it('returns white for Immaculata Conceptio', () => {
    expect(
      getLiturgicalColor('advent', 'In Conceptione Immaculata B.M.V.', 'Duplex I classis', 6),
    ).toBe('white');
  });

  // ---------------------------------------------------------------------------
  // Rule 11: Confessors → white
  // ---------------------------------------------------------------------------
  it('returns white for a Confessor feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'S. Ioannis Vianney Confessoris', 'Duplex', 3),
    ).toBe('white');
  });

  it('returns white for a Virgin feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'S. Theresiae a Iesu Virginis', 'Duplex majus', 4),
    ).toBe('white');
  });

  it('returns white for an Archangel feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'In Festo S. Michaelis Archangeli', 'Duplex majus', 4),
    ).toBe('white');
  });

  it('returns white for a Doctor feast', () => {
    expect(
      getLiturgicalColor('pentecost', 'S. Thomae Aquinatis Doctoris', 'Duplex', 3),
    ).toBe('white');
  });

  // ---------------------------------------------------------------------------
  // Rule 12: Feasts of the Lord (rank ≥ 5) → white
  // ---------------------------------------------------------------------------
  it('returns white for the Nativity (Nativitate Domini, rank 7)', () => {
    expect(
      getLiturgicalColor('christmas', 'In Nativitate Domini', 'Duplex I Classis', 7),
    ).toBe('white');
  });

  it('returns white for Transfiguratio Domini', () => {
    expect(
      getLiturgicalColor('pentecost', 'In Transfiguratione D.N. Iesu Christi', 'Duplex II classis', 5),
    ).toBe('white');
  });

  // ---------------------------------------------------------------------------
  // Rule 14: Season defaults
  // ---------------------------------------------------------------------------
  it('returns violet for a Lenten feria', () => {
    expect(getLiturgicalColor('lent', 'Feria II in Hebdomada III', 'Feria', 3.9)).toBe('violet');
  });

  it('returns violet for a Septuagesima day', () => {
    expect(getLiturgicalColor('septuagesima', 'Dominica in Septuagesima', 'Semiduplex', 5)).toBe(
      'violet',
    );
  });

  it('returns violet for an Advent feria', () => {
    expect(getLiturgicalColor('advent', 'Feria II Adventus', 'Feria', 1)).toBe('violet');
  });

  it('returns white for Easter season default', () => {
    expect(getLiturgicalColor('easter', 'Feria II infra Octavam Paschae', 'Feria', 3)).toBe(
      'white',
    );
  });

  it('returns white for Christmas season default', () => {
    expect(getLiturgicalColor('christmas', 'In Octava Nativitatis', 'Semiduplex', 5)).toBe('white');
  });

  it('returns green for post-Pentecost feria', () => {
    expect(getLiturgicalColor('pentecost', 'Feria II', 'Feria', 1)).toBe('green');
  });

  it('returns green for ordinary post-Pentecost Sunday', () => {
    expect(getLiturgicalColor('pentecost', 'Dominica III post Pentecosten', 'Semiduplex', 5)).toBe(
      'green',
    );
  });

  it('returns green for low-rank Epiphany time', () => {
    expect(getLiturgicalColor('epiphany', 'Feria III post Epiph.', 'Feria', 1)).toBe('green');
  });

  it('returns white for high-rank Epiphany feast', () => {
    expect(
      getLiturgicalColor('epiphany', 'In Epiphania Domini', 'Duplex I classis', 6),
    ).toBe('white');
  });
});
