const { isAbstinence } = require('./abstinence.cjs')

class ViewState {
    isDebugMode = false;
    selectedDate = '';
    abstinence = '';
    reason = '';

    constructor(isDebugMode, selectedDate, abstinence, reason) {
        this.isDebugMode = isDebugMode;
        this.selectedDate = selectedDate;
        this.abstinence = abstinence;
        this.reason = reason;
    }
}

function loadPageWithDate(date) {
  const day = isAbstinence(date);
  return new ViewState(
    isDebugMode(),
    formatDate(date),
    day.isAbstinence ? 'Sim' : 'Não',
    day.reason
    );
}

function formatDate(date) {
    if (date.getDate() === new Date().getDate()) {
        return 'Hoje';
    } else {
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

function isDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const debugValue = urlParams.get('isDebug');
    return debugValue === 'true';
}

module.exports = {
  loadPageWithDate,
  ViewState
}
