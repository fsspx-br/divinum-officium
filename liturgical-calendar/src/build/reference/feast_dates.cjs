const Day = require('./day.cjs');

function feastDates() {
    const thisYear = new Date().getFullYear();
    return [
        new Day(new Date(thisYear, 0, 1), false, 'Santa Maria Mãe de Deus'),   // 01.01 Santa Maria Mãe de Deus
        new Day(new Date(thisYear, 0, 6), false, 'Epifania'),   // 06.01 Epifania
        new Day(new Date(thisYear, 11, 8), false, 'Imaculada Conceição'),  // 08.12 Imaculada Conceição
        new Day(new Date(thisYear,  7, 15), false, 'Assunção'), // 15.08 Assunção
        new Day(new Date(thisYear,  2, 19), false, 'São José'), // 19.03 São José
        new Day(new Date(thisYear,  5, 29), false, 'Apóstolos S. Pedro e S. Paulo'), // 29.06 Apóstolos S. Pedro e S. Paulo
        new Day(new Date(thisYear,  9, 12), false, 'Nossa Senhora Aparecida'), // 12.10 Nossa Senhora Aparecida
        new Day(new Date(thisYear, 10, 1), false, 'Todos os Santos'),  // 01.11 Todos os Santos
        new Day(new Date(thisYear,  11, 25), false, 'Natal de Nosso Senhor Jesus Cristo') // 25.12 Natal de Nosso Senhor Jesus Cristo
    ];
}

module.exports = {
    feastDates
}