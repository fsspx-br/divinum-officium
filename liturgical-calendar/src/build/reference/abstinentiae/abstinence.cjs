const easterCalendar = require('./easter.cjs');
const { feastDates } = require('./feast_dates.cjs');
const Day = require('./day.cjs');

function isAbstinence(date) {
    const year = date.getFullYear();
    const goodFridayDay = easterCalendar.goodFriday(year);
    const ashesDay = easterCalendar.ashesDay(year);

    if (isDateEqual(date, ashesDay.date)) {
        return ashesDay;
    }

    if (isDateEqual(date, goodFridayDay.date)) {
        return goodFridayDay;
    }

    if (isFeast(date) && isFriday(date)) {
        return feastDates().find(fixedDate => isDateEqual(fixedDate.date, date));
    }

    return isFriday(date)
        ? new Day(date, true, 'Sexta-feira')
        : new Day(date, false, '');
}

function isDateEqual(x, y) {
    return x.getMonth() === y.getMonth() &&
        x.getDate() == y.getDate();
}

function isFriday(date) {
    return date.getDay() === 5;
}

function isFeast(date) {
    return feastDates().some(fixedDate => {
        return isDateEqual(fixedDate.date, date);
    });
}

module.exports = {
    isAbstinence
}
