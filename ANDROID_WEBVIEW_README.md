# APK WebView (Vite/React) — Instrucciones rápidas

## 1) Build web
En la raíz del proyecto (donde está package.json):

```bash
npm install
npm run build
```

Esto genera `dist/`.

## 2) Abrir en Android Studio
- Abre la **raíz** del proyecto (donde está `settings.gradle.kts`).
- Sync Gradle.

## 3) Generar APK
- Build > Build APK(s)

## Cómo se incluye la web
El módulo Android copia automáticamente `dist/` a:

`app/src/main/assets/web/`

y carga:

`file:///android_asset/web/index.html`

## Nota sobre rutas
En `vite.config.ts` ya está configurado:
- `base: './'` en producción

Esto es necesario para que JS/CSS resuelvan bien en `android_asset`.
