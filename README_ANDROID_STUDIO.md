# APK (Android Studio) - WebView Wrapper

Este repo incluye un proyecto Android real (`/app`) que carga tu build de Vite/React desde `android_asset`.

## 1) Generar el build web
En la raíz (donde está `package.json`):

```bash
npm install
npm run build
```

Esto crea la carpeta `dist/`.

## 2) Abrir en Android Studio
- **Open** la carpeta raíz (la que contiene `settings.gradle.kts`).
- Sync Gradle.

## 3) Build APK
- **Build > Build APK(s)**

### Copia automática de `dist/` a assets
El módulo `app` tiene un task `syncWebAssets` que, si existe `dist/`, lo copia a:

`app/src/main/assets/web/`

y después la app carga:

`file:///android_asset/web/index.html`

## Notas
- Asegúrate de que `vite.config.ts` tiene `base: './'` en producción (ya está aplicado en este zip).
- Si usas React Router con history (no hash), la navegación interna en `file://` puede requerir ajustes (hash routing suele ser más simple en WebView).
