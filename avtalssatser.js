/**
 * Satser ur kollektivavtalet. Inget personligt här — beloppen står i avtalet
 * och gäller alla på arbetsplatsen. Uppdateras vid avtalsrevision, senast 1/4 2026.
 *
 * Personliga uppgifter som månadslön och skattepunkter matas in i appen och
 * sparas bara i enheten.
 */
export const AVTAL = {
  // OB-tillägg, kronor per timme
  obVardag: 51.46,
  obHelg: 80.15,
  obStorhelg: 160.10,

  // Övertid: månadslönen delas med dessa tal
  otBasDiv: 175,
  otTillaggDiv: 420,

  // Inställelseersättning per tillfälle
  installVardag: 208,
  installHelg: 266,

  // Fackavgift: procent av bruttolönen inom ett spann
  fackProcent: 1.62,
  fackMin: 255,
  fackMax: 701,
};
