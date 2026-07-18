/* ============================================================
   PANEL ADMINISTRADOR · TAMIA
   ============================================================ */

const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxDlC3YncCd7D_MgI6KJjTywR74IRvEVXa4wvAMslUyXBQ3A7Xn5hqD5NjPARGDP48BmA/exec";
const COMERCIALES = ["Natalia", "Angela", "Rosemary", "Nirvana"];

// Estado global
let programas = [];        // datos actuales (viene de Kommo config)
let programasOriginales = []; // copia para detectar cambios (JSON serializado)

/* ============================================================
   RELOJ
   ============================================================ */
function updateClock() {
  const d = new Date();
  document.getElementById("currentTime").textContent =
    d.toLocaleTimeString("es-PE", { hour12: false });
  document.getElementById("currentDate").textContent =
    d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "short" });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, error = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!error);
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3500);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* ============================================================
   CARGA INICIAL
   ============================================================ */
function cargarConfig() {
  document.getElementById("loadingCard").classList.remove("hidden");
  document.getElementById("errorCard").classList.add("hidden");
  document.getElementById("configWrap").classList.add("hidden");

  jsonpGet({ accion: "configAdminLeer" }, (data) => {
    document.getElementById("loadingCard").classList.add("hidden");
    if (!data || !data.ok) {
      document.getElementById("errorCard").classList.remove("hidden");
      document.getElementById("errorMsg").textContent =
        "Error: " + ((data && data.error) || "sin respuesta del servidor");
      return;
    }
    programas = data.programas || [];
    programasOriginales = JSON.stringify(programas);

    if (programas.length === 0) {
      // Config vacía: sugerir sincronizar
      document.getElementById("errorCard").classList.remove("hidden");
      document.getElementById("errorMsg").textContent =
        "No hay programas configurados. Presiona '🔄 Sincronizar con Kommo' para traerlos.";
      return;
    }

    document.getElementById("configWrap").classList.remove("hidden");
    renderTabla();
    actualizarContadores();
  });
}

/* ============================================================
   RENDER TABLA
   ============================================================ */
function renderTabla() {
  const body = document.getElementById("configBody");
  const filtro = document.getElementById("filtroPrograma").value.trim().toLowerCase();

  // Filtrar por texto
  const filtrados = programas.filter(p =>
    !filtro || p.nombre.toLowerCase().includes(filtro)
  );

  document.getElementById("emptyFilter").classList.toggle("hidden", filtrados.length > 0);

  body.innerHTML = filtrados.map((p, idxFiltro) => {
    // Buscar el índice real en programas
    const idx = programas.indexOf(p);
    const disabled = !p.enCampana ? "disabled-row" : "";
    return `
      <tr class="${disabled}" data-idx="${idx}">
        <td class="programa-cell">${escapeHtml(p.nombre)}</td>
        <td>
          <input type="checkbox" class="tamia-check campana-check"
                 data-idx="${idx}" data-field="enCampana"
                 ${p.enCampana ? "checked" : ""} />
        </td>
        ${COMERCIALES.map(c => `
          <td>
            <input type="checkbox" class="tamia-check"
                   data-idx="${idx}" data-field="c-${c}"
                   ${p.comerciales[c] ? "checked" : ""}
                   ${!p.enCampana ? "disabled" : ""} />
          </td>
        `).join("")}
      </tr>
    `;
  }).join("");

  // Vincular eventos de checkboxes
  body.querySelectorAll(".tamia-check").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.field;
      const checked = e.target.checked;

      if (field === "enCampana") {
        programas[idx].enCampana = checked;
        // Si se desmarca, también se limpia acceso de comerciales
        if (!checked) {
          COMERCIALES.forEach(c => programas[idx].comerciales[c] = false);
        }
        // Re-render para actualizar estados deshabilitados
        renderTabla();
      } else if (field.startsWith("c-")) {
        const comercial = field.slice(2);
        programas[idx].comerciales[comercial] = checked;
      }
      actualizarContadores();
      marcarDirty();
    });
  });
}

function actualizarContadores() {
  document.getElementById("programasCount").textContent =
    programas.length + " programa" + (programas.length !== 1 ? "s" : "");
  const enCampana = programas.filter(p => p.enCampana).length;
  document.getElementById("enCampanaCount").textContent =
    enCampana + " en campaña";
}

function marcarDirty() {
  const dirty = JSON.stringify(programas) !== programasOriginales;
  document.getElementById("btnGuardar").disabled = !dirty;
  document.getElementById("saveBar").classList.toggle("hidden", !dirty);
}

/* ============================================================
   FILTRO DE BÚSQUEDA
   ============================================================ */
document.getElementById("filtroPrograma").addEventListener("input", () => {
  renderTabla();
});

/* ============================================================
   BULK ACTIONS
   ============================================================ */
document.querySelectorAll("[data-bulk]").forEach(btn => {
  btn.addEventListener("click", () => {
    const accion = btn.dataset.bulk;

    if (accion === "allCampana") {
      programas.forEach(p => p.enCampana = true);
    } else if (accion === "noneCampana") {
      programas.forEach(p => {
        p.enCampana = false;
        COMERCIALES.forEach(c => p.comerciales[c] = false);
      });
    } else if (accion.startsWith("all")) {
      const comercial = accion.slice(3);  // "Natalia", "Angela", etc.
      // Solo asigna a los programas que están en campaña
      programas.forEach(p => {
        if (p.enCampana) p.comerciales[comercial] = true;
      });
    } else if (accion.startsWith("none")) {
      const comercial = accion.slice(4);
      programas.forEach(p => p.comerciales[comercial] = false);
    }

    renderTabla();
    actualizarContadores();
    marcarDirty();
  });
});

/* ============================================================
   GUARDAR
   ============================================================ */
function guardar() {
  const btnG = document.getElementById("btnGuardar");
  const btnGB = document.getElementById("btnGuardarBottom");
  btnG.disabled = true;
  btnGB.disabled = true;
  btnG.textContent = "Guardando…";
  btnGB.textContent = "Guardando…";

  jsonpGet({
    accion: "configAdminGuardar",
    data: JSON.stringify(programas)
  }, (resp) => {
    btnG.textContent = "💾 Guardar cambios";
    btnGB.textContent = "💾 Guardar cambios";

    if (!resp || !resp.ok) {
      showToast("❌ Error al guardar: " + ((resp && resp.error) || "sin respuesta"), true);
      btnG.disabled = false;
      btnGB.disabled = false;
      return;
    }

    programasOriginales = JSON.stringify(programas);
    marcarDirty();
    showToast("✅ Guardado. Los cambios aparecerán en las comerciales en hasta 1 minuto.");
  });
}

document.getElementById("btnGuardar").addEventListener("click", guardar);
document.getElementById("btnGuardarBottom").addEventListener("click", guardar);

document.getElementById("btnDescartar").addEventListener("click", () => {
  if (!confirm("¿Descartar los cambios?")) return;
  programas = JSON.parse(programasOriginales);
  renderTabla();
  actualizarContadores();
  marcarDirty();
});

/* ============================================================
   SINCRONIZAR CON KOMMO
   ============================================================ */
document.getElementById("btnSincronizar").addEventListener("click", () => {
  const dirty = JSON.stringify(programas) !== programasOriginales;
  if (dirty) {
    if (!confirm("Tienes cambios sin guardar. ¿Descartar y sincronizar?")) return;
  }

  const btn = document.getElementById("btnSincronizar");
  btn.disabled = true;
  btn.textContent = "🔄 Sincronizando…";

  jsonpGet({ accion: "configAdminSincronizar" }, (resp) => {
    btn.disabled = false;
    btn.textContent = "🔄 Sincronizar con Kommo";

    if (!resp || !resp.ok) {
      showToast("❌ Error al sincronizar: " + ((resp && resp.error) || "sin respuesta"), true);
      return;
    }

    if (resp.programasNuevos > 0) {
      showToast(`✅ ${resp.programasNuevos} programas nuevos añadidos.`);
    } else {
      showToast("✅ Ya estaba sincronizado (sin novedades).");
    }
    cargarConfig();  // recargar
  });
});

/* ============================================================
   REINTENTAR
   ============================================================ */
document.getElementById("btnReintentar").addEventListener("click", cargarConfig);

/* ============================================================
   JSONP
   ============================================================ */
function jsonpGet(params, cb) {
  const cbName = "jsonp_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  let timeoutId = null;
  let s = null;

  function cleanup() {
    if (timeoutId) clearTimeout(timeoutId);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
  }

  window[cbName] = function(data) { cleanup(); cb(data); };

  const qs = Object.entries(params).map(([k, v]) =>
    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  ).join("&");

  s = document.createElement("script");
  s.src = `${SHEETS_WEBAPP_URL}?${qs}&callback=${cbName}&t=${Date.now()}`;
  s.onerror = () => { cleanup(); cb({ ok: false, error: "Error de conexión" }); };

  // Timeout más largo para guardar (JSON grande)
  const timeoutMs = params.accion === "configAdminGuardar" ? 60000 : 30000;
  timeoutId = setTimeout(() => {
    cleanup();
    cb({ ok: false, error: "Tiempo agotado" });
  }, timeoutMs);

  document.body.appendChild(s);
}

/* ============================================================
   INICIO
   ============================================================ */
cargarConfig();
