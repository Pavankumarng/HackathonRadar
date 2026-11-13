/**
 * Minimal type bridge for puppeteer-extra-plugin-stealth, which ships without
 * TypeScript declarations. The runtime plugin is checked at registration.
 */
declare module 'puppeteer-extra-plugin-stealth' {
  function StealthPlugin(): unknown;
  export = StealthPlugin;
}
