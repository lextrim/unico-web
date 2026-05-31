/**
 * Detecta si la app está corriendo dentro del WebView Android (APK).
 * Fuente única de verdad — usar este helper en toda la app.
 */
export const getIsAPK = (): boolean =>
  /wv/i.test(navigator.userAgent) ||
  (/android|iphone/i.test(navigator.userAgent) && !/chrome|safari/i.test(navigator.userAgent));
