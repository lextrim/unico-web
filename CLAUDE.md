# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Normas de trabajo

- Responde siempre en español.
- Responde mis preguntas antes de tocar código.
- Cambia solo lo que pido. Si ves otro fallo, avísame antes de arreglarlo.
- Usa los menos tokens posibles: respuestas cortas.
- Sé sincero: si mi idea tiene fallos, dímelo.
- NUNCA ejecutes `pnpm backup`, `pnpm deploy` ni `git push` sin que yo lo pida.
- No añadas librerías sin preguntar.

## Project

**ÚNICO** — gestión de taller de carpintería (fabricación de cocinas). Una webapp React/Vite/Supabase que se despliega en dos destinos:

1. **Web** (Vercel / GitHub Pages) — navegador normal.
2. **APK Android** — la misma web empaquetada dentro de un WebView nativo (`app/`, Kotlin).

Ambos destinos comparten el mismo código web (`App.tsx`, `components/`, `utils/`); `utils/platform.ts` (`getIsAPK()`) es la única fuente de verdad para detectar en qué entorno corre y ramificar comportamiento (notificaciones nativas vs. Web Notifications, service worker sí/no, etc.).

## Commands

```bash
pnpm install          # instalar dependencias (el repo usa pnpm, ver pnpm-lock.yaml)
pnpm dev               # servidor de desarrollo Vite (puerto 3000)
pnpm build             # build de producción + copia dist/ a app/src/main/assets/web (para la APK)
pnpm build:vercel      # build de producción SIN copiar a assets (lo usa Vercel, ver vercel.json)
pnpm preview           # sirve el build de producción localmente
pnpm deploy            # build + publica dist/ en GitHub Pages (gh-pages)
pnpm backup            # commit + push forzado de todo el working tree a origin/main (atajo rápido, usar con cuidado)
```

No hay suite de tests configurada ni linter en el proyecto raíz. `tsc` no se ejecuta como paso de build (`noEmit: true`, sin `build` propio); usar el chequeo de tipos del editor o `npx tsc --noEmit` si se necesita validar tipos.

### Compilar la APK

```bash
pnpm build             # genera dist/ y lo copia a app/src/main/assets/web/
JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew assembleRelease
jarsigner -keystore ~/.android/debug.keystore -storepass android -keypass android \
  -signedjar app/build/outputs/apk/release/app-release-signed.apk \
  app/build/outputs/apk/release/app-release-unsigned.apk androiddebugkey
```

Detalles completos en `ANDROID_WEBVIEW_README.md` y `README_ANDROID_STUDIO.md`.

## Arquitectura

### Flujo de datos (`App.tsx`)

- El payload real de cada registro vive en una columna JSON (`payload`), no en columnas sueltas.
- `loadData()` hace **auto-move** automático (escribe en la BD): si un material en `unico_materials` tiene ≤4 días laborables hasta su entrega (`countWorkingDaysBeforeDelivery`, ver `utils/workingDays.ts`) y la hora actual está en horario laboral (7:00–15:00), se mueve a `unico_orders` con categoría `ARMANDOSE`.
- **Nunca** usar `window.location.assign`/`href` para navegar: rompe el despliegue en GitHub Pages (404) y se salta el refresco de datos en cambio de ruta — usar siempre `useNavigate()`/`<Link>`.
- Roles: `unico_roles` (tabla Supabase) asigna `admin` o `viewer` por email. Sin fila en esa tabla → se fuerza `signOut()`.

### Categorías / flujo de un pedido

Los registros solo se crean en `MATERIALES` (trazabilidad obligatoria). Las fechas de cada transición (`armandoseAt`, `terminadaAt`, `entregadaAt`, `programadaFirstAt`...) se guardan en el propio payload.

### Puente nativo (APK)

- La web se sirve dentro de la APK vía `WebViewAssetLoader` bajo `https://appassets.androidplatform.net/web/...` (**no** `file://`) para evitar que los `<script type="module">`/CSS con `crossorigin` choquen con CORS.
- `navigator.onLine` no es fiable en WebView: la conectividad real se detecta nativamente (`ConnectivityManager`) y se reenvía a la web como eventos `online`/`offline` estándar.
- El service worker (`vite-plugin-pwa`) solo se registra fuera de la APK — dentro está desactivado porque ya sirve todo desde assets locales.

### Build / despliegue

- `vite.config.ts`: `base` es `'/'` en Vercel (`process.env.VERCEL`), `'./'` en build de producción normal, `'/'` en dev. El `'./'` es necesario porque la APK sirve el contenido bajo el subpath `/web/...` (no en la raíz) — con `base: '/'` las rutas de assets apuntarían a la raíz del host y romperían.
- `pnpm build` copia `dist/` a `app/src/main/assets/web/` (script `copy-dist`); `pnpm build:vercel` lo omite porque Vercel no lo necesita.
- Despliegue web real: Vercel (ver `vercel.json`). `pnpm deploy` a GitHub Pages es un canal alternativo/legacy.
- `pnpm backup` hace force-push de `main` a `main`.

### Otros directorios

- `app-cocinas/` — prototipo aislado sin relación funcional con la app principal, no tocar salvo que se indique explícitamente.
- `docs/` — material de presentación, no código de la app.
- `daemon/`, `native/`, `wrapper/`, `.gradle/`, `kotlin-profile/` — caché/artefactos de Gradle, no versionar cambios ahí manualmente.

- Festivos de Sevilla (nacionales, Andalucía, Semana Santa, Miercoles de Feria) hardcodeados en `utils/workingDays.ts`: hay que actualizarlos cada año.
- Viewer es solo lectura: toda ruta nueva que escriba datos debe protegerse con `<Navigate>` cuando `!isAdmin`.