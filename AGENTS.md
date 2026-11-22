# AGENTS.md

This file provides guidance to Codex (claude.ai/code) when working with code in this repository.

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

`App.tsx` es el único componente con estado global; no hay store (Redux/Zustand). Todo vive en `orders: any[]` en memoria, recargado desde Supabase:

- `loadData()` consulta dos tablas de Supabase — `unico_materials` y `unico_orders` — y las fusiona en un solo array `orders`, normalizando cada fila a `{ id, ...payload, category, created_at }`. El payload real de cada registro vive en una columna JSON (`payload`), no en columnas sueltas.
- Se recarga automáticamente en cada cambio de ruta (`useEffect` sobre `location.pathname`, via `useLocation` de `react-router-dom`) — es la forma en que la app evita mostrar datos obsoletos al navegar entre pantallas. **Nunca** usar `window.location.assign`/`href` para navegar: rompe el despliegue en GitHub Pages (404) y se salta este refresco — usar siempre `useNavigate()`/`<Link>`.
- **Auto-move**: dentro de `loadData()`, si un material en `unico_materials` tiene ≤4 días laborables hasta su entrega (`countWorkingDaysBeforeDelivery`, ver `utils/workingDays.ts`) y la hora actual está en horario laboral (7:00–15:00), se mueve automáticamente de `unico_materials` a `unico_orders` con categoría `ARMANDOSE`. Festivos de Sevilla (nacionales + Andalucía + Semana Santa + Lunes de Feria) están hardcodeados ahí.
- Roles: `unico_roles` (tabla Supabase) asigna `admin` o `viewer` por email. Sin fila en esa tabla → se fuerza `signOut()`. Viewer es solo lectura; las rutas de escritura (`/form/...`, `/backup`, `/activity`) están protegidas con `<Navigate>` cuando `!isAdmin`.

### Categorías / flujo de un pedido

El ciclo de vida de un registro pasa por categorías (`types.ts` → `Category`, `OrderStatus`):

`MATERIALES` (entra el material, solo se crea aquí — trazabilidad obligatoria) → `ARMANDOSE` → `TERMINADA` → `PROGRAMADA` (con fecha/hora de entrega) → `ENTREGADA`, con una rama lateral `TERMINACIONES` (remates pendientes). Las fechas por transición (`armandoseAt`, `terminadaAt`, `entregadaAt`, `programadaFirstAt`...) se guardan en el propio payload para trazabilidad e informes.

### Puente nativo (APK)

`window.AndroidBridge` (inyectado por `MainActivity.kt` vía `addJavascriptInterface`) expone a la web:
- `scheduleNotification(id, title, body, triggerAtMs)` / `cancelNotification(id)` — alarmas nativas (`AlarmManager`, sobreviven app cerrada/pantalla bloqueada). Programadas en `App.tsx` para entregas `PROGRAMADA` (al llegar la hora y 30 min antes) y para el auto-move a `ARMANDOSE`.
- `printHtml(htmlContent)` — impresión nativa de informes (usada por `InformesScreen.tsx`).

La web se sirve dentro de la APK vía `WebViewAssetLoader` bajo `https://appassets.androidplatform.net/web/...` (no `file://`) para evitar que los `<script type="module">`/CSS con `crossorigin` choquen con CORS. `navigator.onLine` no es fiable en WebView: la conectividad real se detecta nativamente (`ConnectivityManager`) y se reenvía a la web como eventos `online`/`offline` estándar — por eso `App.tsx` escucha esos eventos en vez de fiarse del valor inicial de `navigator.onLine`.

Fuera de la APK (web pura), se registra un service worker (`vite-plugin-pwa`, `registerSW` en `index.tsx`) solo para cachear el shell y permitir uso offline en visitas repetidas desde el mismo navegador — intencionalmente desactivado dentro de la APK porque ya sirve todo desde assets locales.

### Borradores

`MaterialScreen`/`FormScreen` persisten el formulario en progreso en `localStorage` bajo una `draftKey` para no perder datos si la app se cierra a medio rellenar.

### Build / despliegue

- `vite.config.ts`: `base` es `'/'` en Vercel (`process.env.VERCEL`), `'./'` en build de producción normal (necesario para que resuelva en `file://`/`android_asset` dentro de la APK), `'/'` en dev.
- `pnpm build` copia `dist/` a `app/src/main/assets/web/` (script `copy-dist`) — ese paso es el que alimenta la compilación de la APK; `pnpm build:vercel` lo omite porque Vercel no lo necesita.
- Despliegue web real: Vercel (ver `vercel.json`, rewrites SPA a `index.html`). `pnpm deploy` a GitHub Pages es un canal alternativo/legacy (ver `homepage` en `package.json`).
- `pnpm backup` hace force-push de `main` a `main` — es un atajo deliberado para respaldo rápido, no un flujo de PR/review.

### Otros directorios

- `app-cocinas/` — scaffold nuevo de Vite+React, sin relación funcional con la app principal todavía (prototipo/experimento aislado, no tocar salvo que se indique explícitamente).
- `docs/` — material de presentación (`unicoweb-presentacion.html`) y contenido para compartir, no código de la app.
- `daemon/`, `native/`, `wrapper/`, `.gradle/`, `kotlin-profile/` — caché/artefactos de Gradle, no versionar cambios ahí manualmente.
