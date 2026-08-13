/* ============================================================
   REGISTRO COMERCIAL · NATALIA
   Versión simple: solo registrar llamadas + historial local
   ============================================================ */

const COMERCIAL = "NATALIA";
const STORAGE_KEY = "reg_natalia_v5";
const PENDING_KEY = "reg_natalia_v5_pending";
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyq45K8T5C3ORJFJW0l1w_uZSPOlTwXBlHf9Jco0Axxe-MJXgH4E40nA6cMl5IjsdpR/exec";  // ← reemplazar tras deploy

/* ============================================================
   ESTADO
   ============================================================ */
let historial = [];
let pendientes = [];  // cola de registros pendientes de sincronizar
let horaInicioActual = null;

const callState = {
  celular: "",
  fuente: "",
  programa: "",
  contesto: "",
  calidad: "",
  conversacion: "",
  llamarLuego: false,
  carrera: "",
  provincia: "",
  edad: "",
  nota: "",
  horaInicio: "",
  horaFin: "",
  fecha: "",
};

/* ============================================================
   UTIL: fecha/hora
   ============================================================ */
function nowTime() { return new Date().toTimeString().slice(0, 8); }
function nowDateBonita() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
function nowDateISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ============================================================
   RELOJ
   ============================================================ */
function updateClock() {
  const d = new Date();
  document.getElementById("currentTime").textContent =
    d.toLocaleTimeString("es-PE", { hour12: false });
  document.getElementById("currentDate").textContent =
    d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function saveHistorialLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fecha: nowDateISO(),
      historial: historial
    }));
  } catch (e) { console.warn(e); }
}
function loadHistorialLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.fecha !== nowDateISO()) {
      // Nuevo día: limpiar historial de ayer
      localStorage.removeItem(STORAGE_KEY);
      historial = [];
    } else {
      historial = d.historial || [];
    }
  } catch (e) { console.warn(e); }
}

function savePendientesLocal() {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendientes));
  } catch (e) { console.warn(e); }
}
function loadPendientesLocal() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    pendientes = raw ? JSON.parse(raw) : [];
  } catch (e) { pendientes = []; }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, err = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!err);
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3000);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-panel").forEach(p =>
      p.classList.toggle("active", p.id === `panel-${t.dataset.tab}`)
    );
    if (t.dataset.tab === "history") renderHistorial();
  });
});

/* ============================================================
   CHIP GROUPS (selección única)
   ============================================================ */
function setupChipGroup(groupId, onSelect) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    // Toggle: si estaba seleccionado, deseleccionar
    if (chip.classList.contains("selected")) {
      chip.classList.remove("selected");
      onSelect("");
    } else {
      g.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      onSelect(chip.dataset.value);
    }
  });
}

setupChipGroup("fuenteGroup",       v => callState.fuente = v);
setupChipGroup("programaGroup",     v => callState.programa = v);
setupChipGroup("contestoGroup",     v => callState.contesto = v);
setupChipGroup("calidadGroup",      v => callState.calidad = v);
setupChipGroup("conversacionGroup", v => callState.conversacion = v);
setupChipGroup("carreraGroup",      v => callState.carrera = v);
setupChipGroup("provinciaGroup",    v => callState.provincia = v);
setupChipGroup("edadGroup",         v => callState.edad = v);

document.getElementById("llamarLuego").addEventListener("change", (e) => {
  callState.llamarLuego = e.target.checked;
});

/* ============================================================
   CELULAR: al empezar a escribir, tomar hora de inicio
   ============================================================ */
const celularInput = document.getElementById("celular");
celularInput.addEventListener("input", (e) => {
  // Solo dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
  callState.celular = e.target.value;

  // Marcar hora de inicio la PRIMERA vez que se escribe algo
  if (e.target.value.length >= 1 && !horaInicioActual) {
    horaInicioActual = nowTime();
    callState.horaInicio = horaInicioActual;
    callState.fecha = nowDateBonita();
    document.getElementById("fldHoraInicio").textContent = horaInicioActual;
    document.getElementById("fldFecha").textContent = callState.fecha;
  }
});

/* ============================================================
   LIMPIAR FORMULARIO
   ============================================================ */
function limpiarFormulario() {
  Object.keys(callState).forEach(k => {
    if (typeof callState[k] === "boolean") callState[k] = false;
    else callState[k] = "";
  });
  horaInicioActual = null;

  document.querySelectorAll("#panel-register .chip.selected").forEach(c => c.classList.remove("selected"));
  document.getElementById("celular").value = "";
  document.getElementById("nota").value = "";
  document.getElementById("llamarLuego").checked = false;
  document.getElementById("fldFecha").textContent = "—";
  document.getElementById("fldHoraInicio").textContent = "—";
  document.getElementById("fldHoraFin").textContent = "—";
}

document.getElementById("btnLimpiar").addEventListener("click", () => {
  if (confirm("¿Limpiar todos los campos?")) limpiarFormulario();
});

/* ============================================================
   GUARDAR
   ============================================================ */
document.getElementById("btnGuardar").addEventListener("click", () => {
  // Validar mínimos
  if (!callState.celular || callState.celular.length !== 11) {
    showToast("Ingresa un celular de 11 dígitos", true);
    document.getElementById("celular").focus();
    return;
  }
  if (!callState.contesto) {
    showToast("Marca si contestó o no", true);
    return;
  }

  callState.horaFin = nowTime();
  document.getElementById("fldHoraFin").textContent = callState.horaFin;

  // Armar registro con timestamp local (para deduplicar en el buffer)
  const registro = {
    _id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    _fecha_iso: nowDateISO(),
    comercial: COMERCIAL,
    celular: callState.celular,
    fuente: callState.fuente,
    programa: callState.programa,
    contesto: callState.contesto,
    calidad: callState.calidad,
    conversacion: callState.conversacion,
    llamarLuego: callState.llamarLuego ? "SI" : "",
    carrera: callState.carrera,
    provincia: callState.provincia,
    edad: callState.edad,
    nota: callState.nota || document.getElementById("nota").value.trim(),
    horaInicio: callState.horaInicio || nowTime(),
    horaFin: callState.horaFin,
    fecha: callState.fecha || nowDateBonita(),
  };

  // 1) Agregar a historial local INMEDIATAMENTE
  historial.unshift(registro);
  saveHistorialLocal();
  actualizarStatHoy();

  // 2) Agregar a pendientes de sincronización
  pendientes.push(registro);
  savePendientesLocal();

  // 3) Feedback al usuario (instantáneo)
  showToast("✅ Guardado. Enviando a la hoja…");
  limpiarFormulario();

  // 4) Intentar sincronizar en segundo plano
  sincronizarPendientes();
});

/* ============================================================
   SINCRONIZACIÓN
   ============================================================ */
let sincronizando = false;
async function sincronizarPendientes() {
  if (sincronizando) return;
  if (pendientes.length === 0) {
    actualizarIndicadorSync();
    return;
  }

  sincronizando = true;
  actualizarIndicadorSync();

  while (pendientes.length > 0) {
    const reg = pendientes[0];
    const ok = await enviarRegistro(reg);
    if (ok) {
      pendientes.shift();
      savePendientesLocal();
      actualizarIndicadorSync();
    } else {
      // Falla: parar y reintentar en 15 segundos
      break;
    }
  }

  sincronizando = false;
  actualizarIndicadorSync();

  if (pendientes.length > 0) {
    // Reintentar en 15 seg
    setTimeout(sincronizarPendientes, 15000);
  }
}

async function enviarRegistro(reg) {
  try {
    // Uso no-cors → no vemos respuesta, pero como cada comercial tiene su
    // propia pestaña no hay riesgo de colisión. Asumimos éxito.
    await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(reg)
    });
    return true;
  } catch (e) {
    console.warn("Error al enviar:", e);
    return false;
  }
}

function actualizarIndicadorSync() {
  const dot = document.getElementById("syncDot");
  const text = document.getElementById("syncText");
  const box = document.getElementById("syncStatus");
  if (pendientes.length === 0) {
    box.className = "sync-indicator sync-ok";
    text.textContent = "Sincronizado";
    dot.textContent = "●";
  } else {
    box.className = "sync-indicator sync-pending";
    text.textContent = `Sincronizando (${pendientes.length})`;
    dot.textContent = "○";
  }
}

/* ============================================================
   HISTORIAL
   ============================================================ */
function actualizarStatHoy() {
  document.getElementById("statHoy").textContent = historial.length;
}

function renderHistorial() {
  const tbody = document.getElementById("historyBody");
  const empty = document.getElementById("historyEmpty");
  const tbl = document.getElementById("historyTable");

  if (historial.length === 0) {
    empty.classList.remove("hidden");
    tbl.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbl.classList.remove("hidden");

  tbody.innerHTML = historial.map((r, i) => {
    const contPill = r.contesto === "SI"
      ? '<span class="pill pill-si">SÍ</span>'
      : '<span class="pill pill-no">NO</span>';
    return `
      <tr>
        <td>${historial.length - i}</td>
        <td class="mono">${escapeHtml(r.horaInicio)}</td>
        <td class="mono">${escapeHtml(r.celular)}</td>
        <td>${escapeHtml(r.programa || "—")}</td>
        <td>${contPill}</td>
        <td>${escapeHtml(r.calidad || "—")}</td>
        <td>${escapeHtml((r.nota || "").slice(0, 40))}${(r.nota || "").length > 40 ? "…" : ""}</td>
        <td></td>
      </tr>
    `;
  }).join("");
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
loadHistorialLocal();
loadPendientesLocal();
actualizarStatHoy();
actualizarIndicadorSync();
renderHistorial();

// Si quedaron pendientes de sesiones anteriores, mandar a sincronizar
if (pendientes.length > 0) {
  sincronizarPendientes();
}

// Reintento periódico por si falla la conexión
setInterval(sincronizarPendientes, 30000);
