import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Android's hardware back button exits the app by default in a Capacitor
 * WebView. Route it through the browser history instead — react-router's
 * BrowserRouter listens on `popstate`, so `history.back()` navigates the app
 * the same way tapping a device's back gesture does in a normal mobile
 * browser tab. Only exit when there's no history left to go back to.
 */
export function useCapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);
}
