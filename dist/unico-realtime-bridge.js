/**
 * UNICO Realtime Bridge (SIN PERMISOS) ✅
 *
 * Objetivo:
 *  - APK (WebView) y Web (GitHub Pages) sincronizan en tiempo real usando Supabase.
 *  - Sin sistema de permisos/solicitudes de edición.
 *
 * Tablas Supabase (public):
 *  - unico_orders     (id text, payload jsonb, archived_at timestamptz, updated_at timestamptz, created_at timestamptz)
 *  - unico_materials  (id text, payload jsonb, archived_at timestamptz, updated_at timestamptz, created_at timestamptz)
 *
 * localStorage:
 *  - cocina_orders
 *  - unico_material_records
 */
(function () {
  try {
    if (window.__unicoRealtimeBridgeInstalled) return;
    window.__unicoRealtimeBridgeInstalled = true;
  } catch (_) {}

  // ---------------- CONFIG ----------------
  const DEFAULT_SUPABASE_URL = "https://qsdxnwpgyvhttceizica.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZHhud3BneXZodHRjZWl6aWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMjgwMjAsImV4cCI6MjA4NDkwNDAyMH0.x8U-7ISr-Nbuir8pR6wtm99QNKPcU22aA9JpjBnbulc";

  function readFromWindow(keys, fallback) {
    try {
      for (const k of keys) {
        const v = typeof window !== "undefined" && window ? window[k] : undefined;
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch (_) {}
    return fallback;
  }

  // IMPORTANTE: NO leemos de localStorage para evitar que una key vieja/rota “pise” la buena.
  const SUPABASE_URL = readFromWindow(["UNICO_SUPABASE_URL", "SUPABASE_URL"], DEFAULT_SUPABASE_URL);
  const SUPABASE_ANON_KEY = readFromWindow(["UNICO_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"], DEFAULT_SUPABASE_ANON_KEY);

  const ORDERS_KEY = "cocina_orders";
  const MATERIALS_KEY = "unico_material_records";
  const T_ORDERS = "unico_orders";
  const T_MATERIALS = "unico_materials";

  const nowIso = () => new Date().toISOString();

  const safeJsonParse = (str, fallback) => {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const stableStringify = (obj) => {
    const seen = new WeakSet();
    const sorter = (v) => {
      if (v && typeof v === "object") {
        if (seen.has(v)) return null;
        seen.add(v);
        if (Array.isArray(v)) return v.map(sorter);
        const out = {};
        Object.keys(v)
          .sort()
          .forEach((k) => (out[k] = sorter(v[k])));
        return out;
      }
      return v;
    };
    return JSON.stringify(sorter(obj));
  };

  const diffById = (prevArr, nextArr) => {
    const prev = new Map();
    const next = new Map();
    (prevArr || []).forEach((o) => o && o.id && prev.set(String(o.id), o));
    (nextArr || []).forEach((o) => o && o.id && next.set(String(o.id), o));

    const upserts = [];
    const deletes = [];

    for (const [id, obj] of next.entries()) {
      const p = prev.get(id);
      if (!p) upserts.push(obj);
      else if (stableStringify(p) !== stableStringify(obj)) upserts.push(obj);
    }
    for (const [id] of prev.entries()) {
      if (!next.has(id)) deletes.push(id);
    }
    return { upserts, deletes };
  };

  // ---------------- Supabase client ----------------
  function ensureSupabase() {
    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") {
      console.warn("[UNICO] Supabase UMD no cargado (./vendor/supabase.js)");
      return null;
    }
    // No pisamos window.supabase (library). Exponemos el cliente en window.supabaseClient.
    return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }

  const client = ensureSupabase();
  if (!client) return;

  try {
    window.supabaseClient = client;
    window.UNICO_supabaseClient = client;
  } catch (_) {}

  // ---------------- Auth + Realtime token (RLS-safe) ----------------
  async function ensureAuthedAndSetRealtimeAuth() {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;

      if (!data || !data.session) {
        const res = await client.auth.signInAnonymously();
        if (res && res.error) throw res.error;
      }

      const { data: data2 } = await client.auth.getSession();
      const token = data2 && data2.session ? data2.session.access_token : null;
      if (token && client.realtime && typeof client.realtime.setAuth === "function") {
        client.realtime.setAuth(token);
      }

      client.auth.onAuthStateChange((_event, session) => {
        try {
          const t = session && session.access_token ? session.access_token : null;
          if (t && client.realtime && typeof client.realtime.setAuth === "function") {
            client.realtime.setAuth(t);
          }
        } catch (_) {}
      });
    } catch (e) {
      console.log("[UNICO] Auth error:", e);
    }
  }

  // ---------------- Storage helpers ----------------
  const rawSetItem = localStorage.setItem.bind(localStorage);
  const rawGetItem = localStorage.getItem.bind(localStorage);

  let applyingRemoteSnapshot = false;

  function applyRowsToLocalStorage(key, rows) {
    const items = (rows || []).map((r) => {
      const payload = r && r.payload && typeof r.payload === "object" ? Object.assign({}, r.payload) : {};
      if (r && r.archived_at) {
        payload.archived = true;
        if (!payload.archivedAt) payload.archivedAt = Date.parse(r.archived_at) || Date.now();
      }
      return payload;
    });
    rawSetItem(key, JSON.stringify(items));
  }

  async function fetchAll(table) {
    const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function upsertPayloads(table, payloads) {
    if (!payloads || !payloads.length) return;
    const rows = payloads
      .filter((p) => p && p.id)
      .map((p) => {
        const archived = !!p.archived;
        const archivedAtMs = typeof p.archivedAt === "number" && isFinite(p.archivedAt) && p.archivedAt > 0 ? Number(p.archivedAt) : 0;
        return {
          id: String(p.id),
          payload: p,
          archived_at: archived ? new Date(archivedAtMs || Date.now()).toISOString() : null,
          updated_at: nowIso(),
        };
      });

    const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  async function deleteRows(table, ids) {
    if (!ids || !ids.length) return;
    const { error } = await client.from(table).delete().in("id", ids);
    if (error) throw error;
  }

  // ---------------- 1) Hydration inicial ----------------
  async function hydrateOnce() {
    try {
      const [orders, materials] = await Promise.all([fetchAll(T_ORDERS), fetchAll(T_MATERIALS)]);
      applyingRemoteSnapshot = true;
      try {
        applyRowsToLocalStorage(ORDERS_KEY, orders);
        applyRowsToLocalStorage(MATERIALS_KEY, materials);
      } finally {
        applyingRemoteSnapshot = false;
      }
      try {
        window.dispatchEvent(new Event("unico-orders-sync"));
        window.dispatchEvent(new Event("unico-materials-sync"));
      } catch (_) {}
    } catch (e) {
      console.log("[UNICO] Hydration inicial omitida:", e);
    }
  }

  // ---------------- 2) Write-through localStorage -> Supabase ----------------
  const originalSetItem = rawSetItem;

  localStorage.setItem = function (k, v) {
    if (applyingRemoteSnapshot) return originalSetItem(k, v);

    const isTracked = k === ORDERS_KEY || k === MATERIALS_KEY;
    const prevStr = isTracked ? rawGetItem(k) : null;
    if (isTracked && prevStr === v) return originalSetItem(k, v);

    const res = originalSetItem(k, v);
    if (!isTracked) return res;

    const prevArr = safeJsonParse(prevStr, []);
    const nextArr = safeJsonParse(v, []);
    const { upserts, deletes } = diffById(prevArr, nextArr);

    if (!upserts.length && !deletes.length) return res;

    const table = k === ORDERS_KEY ? T_ORDERS : T_MATERIALS;
    Promise.resolve()
      .then(() => upsertPayloads(table, upserts))
      .then(() => deleteRows(table, deletes))
      .catch((e) => console.log("[UNICO] write failed:", e));

    try {
      window.dispatchEvent(new Event(k === ORDERS_KEY ? "unico-orders-sync" : "unico-materials-sync"));
    } catch (_) {}

    return res;
  };

  // ---------------- 3) Realtime: cambios Supabase -> refetch -> localStorage ----------------
  let ordersTimer = null;
  let materialsTimer = null;
  let ordersInFlight = false;
  let materialsInFlight = false;
  let ordersAgain = false;
  let materialsAgain = false;

  async function runOrdersRefresh() {
    if (ordersInFlight) {
      ordersAgain = true;
      return;
    }
    ordersInFlight = true;
    try {
      const rows = await fetchAll(T_ORDERS);
      applyingRemoteSnapshot = true;
      try {
        applyRowsToLocalStorage(ORDERS_KEY, rows);
      } finally {
        applyingRemoteSnapshot = false;
      }
      try {
        window.dispatchEvent(new Event("unico-orders-sync"));
      } catch (_) {}
    } catch (e) {
      console.log("[UNICO] refresh orders failed:", e);
    } finally {
      ordersInFlight = false;
      if (ordersAgain) {
        ordersAgain = false;
        runOrdersRefresh();
      }
    }
  }

  async function runMaterialsRefresh() {
    if (materialsInFlight) {
      materialsAgain = true;
      return;
    }
    materialsInFlight = true;
    try {
      const rows = await fetchAll(T_MATERIALS);
      applyingRemoteSnapshot = true;
      try {
        applyRowsToLocalStorage(MATERIALS_KEY, rows);
      } finally {
        applyingRemoteSnapshot = false;
      }
      try {
        window.dispatchEvent(new Event("unico-materials-sync"));
      } catch (_) {}
    } catch (e) {
      console.log("[UNICO] refresh materials failed:", e);
    } finally {
      materialsInFlight = false;
      if (materialsAgain) {
        materialsAgain = false;
        runMaterialsRefresh();
      }
    }
  }

  const scheduleOrders = () => {
    if (ordersTimer) return;
    ordersTimer = setTimeout(() => {
      ordersTimer = null;
      runOrdersRefresh();
    }, 250);
  };

  const scheduleMaterials = () => {
    if (materialsTimer) return;
    materialsTimer = setTimeout(() => {
      materialsTimer = null;
      runMaterialsRefresh();
    }, 250);
  };

  async function startRealtime() {
    try {
      client
        .channel("unico-sync-plain")
        .on("postgres_changes", { event: "*", schema: "public", table: T_ORDERS }, () => scheduleOrders())
        .on("postgres_changes", { event: "*", schema: "public", table: T_MATERIALS }, () => scheduleMaterials())
        .subscribe();
    } catch (e) {
      console.log("[UNICO] realtime subscribe failed:", e);
    }
  }

  // Arranque: primero auth+token, luego hydrate y realtime
  Promise.resolve()
    .then(() => ensureAuthedAndSetRealtimeAuth())
    .then(() => hydrateOnce())
    .then(() => startRealtime())
    .catch(() => {});
})();
