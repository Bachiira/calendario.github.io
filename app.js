(() => {
  // ===== Config =====
  const YEAR = 2026;
  const STORAGE_KEY = "calendar_2026_notes_colors_v1";

  const MONTHS = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];
  // Lunes primero (más típico en Chile)
  const DOW = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  // ===== Helpers =====
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

  // Convierte Date.getDay() (0=Dom..6=Sáb) a índice Lunes=0..Dom=6
  const dowMonFirst = (jsDay) => (jsDay + 6) % 7;

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  const tryParseJSON = async (file) => {
    const text = await file.text();
    return JSON.parse(text);
  };

  // ===== State =====
  const state = {
    year: YEAR,
    month: 0,
    selectedKey: null,
    dataByDate: loadStore()
  };

  // ===== DOM =====
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const todayBtn = document.getElementById("todayBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const resetAllBtn = document.getElementById("resetAllBtn");

  const monthSelect = document.getElementById("monthSelect");
  const dowRow = document.getElementById("dowRow");
  const grid = document.getElementById("calendarGrid");

  const modalBack = document.getElementById("modalBack");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const clearDayBtn = document.getElementById("clearDayBtn");

  const modalDate = document.getElementById("modalDate");
  const noteInput = document.getElementById("noteInput");
  const colorInput = document.getElementById("colorInput");

  // ===== Init =====
  init();

  function init(){
    // DOW header
    dowRow.innerHTML = "";
    DOW.forEach(d => {
      const el = document.createElement("div");
      el.textContent = d;
      dowRow.appendChild(el);
    });

    // Month select
    monthSelect.innerHTML = "";
    MONTHS.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = `${name} ${YEAR}`;
      monthSelect.appendChild(opt);
    });

    // Default month: hoy si es 2026, si no Enero
    const now = new Date();
    if (now.getFullYear() === YEAR) state.month = now.getMonth();
    monthSelect.value = String(state.month);

    // Events
    prevBtn.addEventListener("click", () => setMonth(state.month - 1));
    nextBtn.addEventListener("click", () => setMonth(state.month + 1));
    monthSelect.addEventListener("change", (e) => setMonth(Number(e.target.value)));

    todayBtn.addEventListener("click", () => {
      const now = new Date();
      if (now.getFullYear() !== YEAR) {
        // si no estamos en 2026, vamos a Enero 2026
        setMonth(0);
        return;
      }
      setMonth(now.getMonth());
      // Abre el día de hoy si es 2026
      openDay(isoKey(YEAR, now.getMonth(), now.getDate()));
    });

    exportBtn.addEventListener("click", exportJSON);
    importFile.addEventListener("change", onImportFile);

    resetAllBtn.addEventListener("click", () => {
      const ok = confirm("¿Seguro? Esto borra TODAS las notas y colores guardados del calendario 2026.");
      if (!ok) return;
      state.dataByDate = {};
      saveStore(state.dataByDate);
      renderMonth();
    });

    // Modal events
    closeModalBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    modalBack.addEventListener("click", (e) => {
      if (e.target === modalBack) closeModal();
    });

    saveBtn.addEventListener("click", saveDay);
    clearDayBtn.addEventListener("click", clearSelectedDay);

    // ESC to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalBack.classList.contains("open")) closeModal();
    });

    renderMonth();
  }

  function setMonth(newMonth){
    if (newMonth < 0) newMonth = 0;
    if (newMonth > 11) newMonth = 11;
    state.month = newMonth;
    monthSelect.value = String(state.month);
    renderMonth();
  }

  // ===== Rendering =====
  function renderMonth(){
    grid.innerHTML = "";

    const y = state.year;
    const m = state.month;

    const first = new Date(y, m, 1);
    const offset = dowMonFirst(first.getDay()); // 0..6
    const totalDays = daysInMonth(y, m);

    const now = new Date();
    const isTodayYear = now.getFullYear() === y;
    const todayKey = isTodayYear ? isoKey(y, now.getMonth(), now.getDate()) : null;

    // 42 celdas (6 semanas) para diseño fijo
    const CELLS = 42;

    for (let i = 0; i < CELLS; i++){
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day";

      const dayNum = i - offset + 1;

      if (dayNum < 1 || dayNum > totalDays){
        cell.classList.add("empty");
        cell.disabled = true;
        cell.innerHTML = `<div class="dayTop"><span class="dayNum"></span></div>`;
        grid.appendChild(cell);
        continue;
      }

      const key = isoKey(y, m, dayNum);
      const saved = state.dataByDate[key] || {};
      const note = String(saved.notes || "").trim();
      const color = saved.color || "";

      const top = document.createElement("div");
      top.className = "dayTop";

      const num = document.createElement("span");
      num.className = "dayNum";
      num.textContent = String(dayNum);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = MONTHS[m].slice(0,3);

      top.appendChild(num);
      top.appendChild(badge);

      const dot = document.createElement("span");
      dot.className = "dot";

      cell.appendChild(top);
      cell.appendChild(dot);

      if (note.length > 0) cell.classList.add("hasNote");
      if (todayKey && key === todayKey) cell.classList.add("today");

      if (color){
        cell.style.background = color;
        cell.style.borderColor = "rgba(255,255,255,.22)";
      }

      cell.addEventListener("click", () => openDay(key));
      grid.appendChild(cell);
    }
  }

  // ===== Modal =====
  function openDay(key){
    state.selectedKey = key;
    const saved = state.dataByDate[key] || { notes: "", color: "#ffffff" };

    modalDate.textContent = prettyDate(key);
    noteInput.value = saved.notes || "";
    colorInput.value = normalizeColor(saved.color) || "#ffffff";

    modalBack.classList.add("open");
    modalBack.setAttribute("aria-hidden", "false");
    setTimeout(() => noteInput.focus(), 0);
  }

  function closeModal(){
    modalBack.classList.remove("open");
    modalBack.setAttribute("aria-hidden", "true");
    state.selectedKey = null;
  }

  function saveDay(){
    if (!state.selectedKey) return;

    const notes = noteInput.value ?? "";
    const color = colorInput.value ?? "";

    // Si está vacío, lo tratamos como "sin color" para dejar el default
    const cleanNotes = String(notes).trim();
    const cleanColor = String(color).trim();

    const hasAnything = cleanNotes.length > 0 || (cleanColor && cleanColor !== "#ffffff");

    if (!hasAnything){
      delete state.dataByDate[state.selectedKey];
    } else {
      state.dataByDate[state.selectedKey] = {
        notes: notes,
        // guardamos color solo si no es blanco, para que no te pinte por default
        color: (cleanColor && cleanColor !== "#ffffff") ? cleanColor : ""
      };
    }

    saveStore(state.dataByDate);
    renderMonth();
    closeModal();
  }

  function clearSelectedDay(){
    if (!state.selectedKey) return;
    const ok = confirm("¿Limpiar nota y color de este día?");
    if (!ok) return;

    delete state.dataByDate[state.selectedKey];
    saveStore(state.dataByDate);
    renderMonth();
    closeModal();
  }

  function prettyDate(key){
    // key: YYYY-MM-DD
    const [y, mm, dd] = key.split("-").map(Number);
    const mIndex = mm - 1;
    return `${dd} de ${MONTHS[mIndex]} de ${y}`;
  }

  function normalizeColor(c){
    if (!c) return "";
    // Si por alguna razón guardas cosas raras, cae a vacío
    if (typeof c !== "string") return "";
    const s = c.trim();
    // Acepta hex corto/largo
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
    return "";
  }

  // ===== Storage =====
  function loadStore(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return {};
      return obj;
    }catch{
      return {};
    }
  }

  function saveStore(data){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ===== Export / Import =====
  function exportJSON(){
    const payload = {
      version: 1,
      year: YEAR,
      exportedAt: new Date().toISOString(),
      dataByDate: state.dataByDate
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `calendario_${YEAR}_backup.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  async function onImportFile(e){
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input
    if (!file) return;

    try{
      const json = await tryParseJSON(file);
      const imported = json?.dataByDate;

      if (!imported || typeof imported !== "object"){
        alert("Archivo inválido: no encontré dataByDate.");
        return;
      }

      // Fusionar (merge) con lo actual
      state.dataByDate = { ...state.dataByDate, ...imported };
      saveStore(state.dataByDate);
      renderMonth();
      alert("Importación lista ✅");
    }catch(err){
      console.error(err);
      alert("No pude importar ese archivo. ¿Seguro que es un JSON válido?");
    }
  }
})();