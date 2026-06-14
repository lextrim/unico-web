# UnicoWeb — APK Android (WebView Wrapper)

App de gestión de taller de carpintería. Envuelve la webapp React en un WebView nativo de Android.

---

## ¿Qué hace la app?

- **Material** — registro de entrada de cocinas al taller. Cada registro puede incluir fecha de entrega, rack/nivel de almacenaje, foto, notas y componentes (cascos, puertas, tiradores). Los registros solo se pueden crear desde aquí (trazabilidad obligatoria).
- **Armándose** — cocinas en proceso de montaje.
- **Terminada** — cocinas montadas esperando entrega.
- **Entregas (PROGRAMADA)** — cocinas con fecha/hora de entrega programada. Ordenadas por proximidad de entrega.
- **Terminaciones** — trabajos pendientes de remate.

Las tarjetas se colorean según días laborables restantes hasta la entrega (festivos de Sevilla incluidos):
- 🟢 Verde — más de 4 días laborables
- 🟠 Naranja — entre 2 y 4 días
- 🔴 Rojo — 2 días o menos
- 🔴 Rojo intenso — fecha vencida

---

## Roles

- **Admin** — puede crear, editar, mover y borrar registros.
- **Viewer** — solo lectura.

---

## Stack

- React 19 + TypeScript + Vite + TailwindCSS
- Supabase (auth + PostgreSQL + Storage)
- Android WebView (`com.valen.cocinanuevo.webwrapper`)

---

## Compilar la APK

### Requisitos
- Node.js + pnpm
- Java 17 (Eclipse Adoptium recomendado)
- Android SDK

### Pasos

```bash
# 1. Build web
npm run build
# Genera dist/ y lo copia a app/src/main/assets/web/

# 2. Compilar APK
JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.16.8-hotspot" ./gradlew assembleRelease

# 3. Firmar (debug keystore)
jarsigner -keystore ~/.android/debug.keystore -storepass android -keypass android \
  -signedjar app/build/outputs/apk/release/app-release-signed.apk \
  app/build/outputs/apk/release/app-release-unsigned.apk androiddebugkey
```

APK firmada en: `app/build/outputs/apk/release/app-release-signed.apk`

---

## Deploy web (GitHub Pages)

```bash
npm run deploy
```

URL producción: https://lextrim.github.io/unico-web/

---

## Notas

- `vite.config.ts` tiene `base: './'` para que funcione en `file://` (WebView).
- Las notificaciones de entrega se programan con `AlarmManager` nativo (clases: `NotificationScheduler`, `DeliveryAlarmReceiver`, `SnoozeReceiver`, `BootReceiver`).
- Los festivos de Sevilla (nacionales + Andalucía + Semana Santa + Lunes de Feria) están hardcodeados en `utils/workingDays.ts`.
