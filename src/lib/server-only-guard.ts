/**
 * src/lib/server-only-guard.ts
 *
 * Import this at the top of any module that must never run in the browser.
 * Next.js will throw a build/runtime error if a client component tries to
 * import a module that imports this file.
 *
 * Usage:
 *   import '@/lib/server-only-guard';
 *
 * This uses the 'server-only' package (built into Next.js) which throws at
 * build time if the importing file is included in a Client Component bundle.
 *
 * NOTE: The 'server-only' package is automatically available in Next.js 13+.
 *       No installation needed.
 */

// This import causes a build-time error if this module is ever bundled
// for the browser. That's the entire point.
import 'server-only';
