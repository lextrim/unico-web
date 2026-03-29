# ✅ UNICO — COMPARTIR (Permisos APK→PC)

Este ZIP incluye:

- **Frontend** (cambio quirúrgico, sin tocar CSS existente):
  - `app/src/main/assets/web/unico-realtime-bridge.js`
- **SQL completo** (tablas + índices + RLS):
  - `supabase/COMPARTIR_RLS.sql`
- **Edge Function opcional (recomendada)** para que la APK gestione leases sin exponer `service_role` en cliente:
  - `supabase/functions/unico-admin/index.ts`

---

## 1) Diseño del sistema

### 🧾 Datos confirmados
- La **APK** es la **única autoridad** (administra permisos).
- La **Web PC** por defecto es **solo lectura**.
- Un permiso de edición es un **lease** con:
  - `granted_to_device_id` (PC)
  - `granted_by_apk_device_id` (APK)
  - `resource_scope` (`orders`, `materials`, `all`)
  - `expires_at`, `revoked_at`
- La seguridad “de verdad” se impone con **RLS en Supabase**.

### 🧠 Inferencias (decisiones técnicas para robustez)
- La identidad estable se maneja con:
  - PC: `localStorage["unico_pc_device_id"]`
  - APK: `localStorage["unico_apk_device_id"]`
- Para que la **APK** pueda crear/actualizar leases sin exponer secretos, la opción más limpia es:
  - **Supabase Edge Function** con `service_role` como secret **del servidor**, y un `APK_ADMIN_TOKEN` como secreto compartido con la APK.

### 🎯 Recomendación (robusta y mantenible)
1. **Aplicar SQL** (`supabase/COMPARTIR_RLS.sql`).
2. **Desplegar Edge Function** (`unico-admin`) con secretos:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APK_ADMIN_TOKEN`
3. En la APK, configurar `localStorage["unico_apk_admin_token"] = "<APK_ADMIN_TOKEN>"` (1 sola vez) para habilitar el modo admin seguro.

---

## 2) Frontend incluido en este ZIP

### ✅ Qué hace
El archivo `unico-realtime-bridge.js` ahora también:
- Genera y persiste `pc_device_id` / `apk_device_id`.
- Mantiene un estado en `localStorage["unico_permission_state"]`.
- Lanza el evento `unico-permission-sync` para que cualquier UI (si se quiere) lo muestre.
- Inyecta un widget mínimo:
  - PC: indicador + botón **SOLICITAR**
  - APK: botón **PERMISOS** y panel de administración.
- En PC, aplica **modo solo lectura real** (bloquea interacción) mientras no haya lease:
  - Añade clase `body.unico-readonly` y un `<style>` inyectado que deshabilita `button/input/textarea/...` (sin tocar tus CSS).

### 📌 Flujo PC
- PC pulsa **SOLICITAR** → inserta fila en `unico_edit_requests`.
- Cuando la APK aprueba → se crea un lease en `unico_edit_leases`.
- La Web PC detecta el lease por Realtime y pasa a **EDICIÓN HABILITADA** hasta expiración/revocación.

### 📌 Flujo APK
- APK abre panel **PERMISOS** (inyección DOM, no cambia tu UI base).
- Ve solicitudes pendientes, puede:
  - **APROBAR** (crea lease 30 min + marca request approved)
  - **RECHAZAR**
- Ve leases activos, puede:
  - **RENOVAR** (extiende 30 min)
  - **REVOCAR** (revoked_at)

> Nota: si activas RLS estricta, la APK debe aprobar/revocar vía Edge Function (recomendado) o con un usuario admin real.

---

## 3) SQL (tablas + RLS)

- Archivo: `supabase/COMPARTIR_RLS.sql`
- Incluye:
  - DDL de `unico_edit_requests` y `unico_edit_leases`
  - Índices
  - RLS para:
    - `unico_orders` y `unico_materials` (write solo con lease válido)
    - `unico_edit_requests` (PC puede insertar, no puede auto-aprobar)
    - `unico_edit_leases` (solo server/admin)

---

## 4) Edge Function (recomendada)

- Archivo: `supabase/functions/unico-admin/index.ts`
- Permite a la APK:
  - aprobar request + crear lease
  - revocar lease
  - renovar lease
- Autenticación:
  - Header `x-apk-admin-token: <APK_ADMIN_TOKEN>`

---

## 5) Estrategia de pruebas (casos clave)

### 🧪 Casos funcionales
- PC sin lease:
  - UI navegable, pero **no interactuable** (modo solo lectura).
  - `SOLICITAR` crea request.
- APK aprueba:
  - Lease creado con exp 30 min.
  - PC pasa a edición inmediatamente (realtime).
- Expiración:
  - al pasar `expires_at`, PC vuelve a solo lectura.
- Revocación:
  - APK revoca → PC vuelve a solo lectura al instante.
- Renovación:
  - APK renueva → contador se extiende.

### ⚠️ Edge cases
- PC recarga página: debe recuperar estado (device_id y lease) y quedar correcto.
- Red intermitente: Realtime puede perderse; la Web PC aún debe seguir bloqueada si no hay lease válido (RLS).
- Borrado de storage:
  - device_id se regenera → se considera **nuevo PC** y debe volver a solicitar.

