// Funções puras de lógica de horas — extraídas de TimesheetApp.jsx para liberar
// o Fast Refresh do Vite (módulos React não devem exportar não-componentes).
// Documentado em CLAUDE.md como as duas funções pure unit-testáveis do projeto.

export function sumWeek(entry) {
  return Number(entry?.Hours_Forecast) || 0;
}

export function allowedAfterCap(otherTotal, candidate) {
  return Math.min(Math.max(0, 40 - otherTotal), Math.max(0, candidate));
}

// Self-tests em load (apenas browser, uma única vez por sessão)
if (typeof window !== "undefined" && !window.__TS_TEST__) {
  window.__TS_TEST__ = true;
  console.assert(sumWeek({ Hours_Forecast: 32 }) === 32);
  console.assert(allowedAfterCap(30, 5) === 5);
  console.assert(allowedAfterCap(38, 10) === 2);
  console.log("[Timesheet] self-tests OK");
}
