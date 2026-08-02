import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * `window.print()` opens the OS print dialog in a real browser but is a
 * silent no-op in Capacitor's Android WebView (no print handler wired up).
 * On native, open the current page in the system browser instead — Chrome's
 * print-to-PDF pipeline works there, and it's the same page/content, so
 * there's no risk of showing the user a differently-formatted document.
 */
export function printOrOpenInBrowser() {
  if (Capacitor.isNativePlatform()) {
    Browser.open({ url: window.location.href });
    return;
  }
  window.print();
}
