const Day = require("./day.cjs");

function easter(year) {
    const y = year
    const g = y % 19
    const e = 0

    const floorDiv = (a, b) => Math.floor(a / b);
    const c = floorDiv(y, 100);
    const h = (c - floorDiv(c, 4) - floorDiv(8 * c + 13, 25) + 19 * g + 15) % 30;
    const i = h - floorDiv(h, 28) * (1 - floorDiv(h, 28) * floorDiv(29, h + 1) * floorDiv(21 - g, 11));
    const j = (y + floorDiv(y, 4) + i + 2 - c + floorDiv(c, 4)) % 7;

    // p can be from -6 to 56 corresponding to dates 22 March to 23 May
    const p = i - j + e;
    const d = 1 + (p + 27 + Math.floor((p + 6) / 40)) % 31;
    const m = 3 + Math.floor((p + 26) / 30);

    return new Day(new Date(y, m - 1, d), false, 'Páscoa');
}

function goodFriday(year) {
    const easterDate = easter(year).date;
    return new Day(
        new Date(
            easterDate.getFullYear(),
            easterDate.getMonth(),
            easterDate.getDate() - 2
        ),
        true,
        'Sexta-feira Santa'
    );
}

function ashesDay(year) {
    const easterDate = easter(year).date;
    return new Day(
        new Date(
            easterDate.getFullYear(),
            easterDate.getMonth(),
            easterDate.getDate() - 46
        ),
        true,
        'Quarta-feira de Cinzas'
    );
}

module.exports = {
    easter,
    goodFriday,
    ashesDay
}
