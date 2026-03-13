// ====== Nastavení ======
const KEY = "msg-board-v1";
const NOTE_W = 240; // px
const PAD = 12; // px

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ====== Stav ======
let notes = [];
let placing = false;

// drag state
const drag = { id: null, pid: null, ox: 0, oy: 0 };

// ====== DOM ======
const board = document.getElementById("board");
const notesLayer = document.getElementById("notesLayer");
const empty = document.getElementById("empty");
const hint = document.getElementById("boardHint");

const draft = document.getElementById("draft");
const btnPlace = document.getElementById("btnPlace");
const btnCancel = document.getElementById("btnCancel");
const btnClear = document.getElementById("btnClear");
const status = document.getElementById("status");

if (!board || !notesLayer || !empty || !hint || !draft || !btnPlace || !btnCancel || !btnClear || !status) {
  console.error("Chybí některé elementy v HTML. Zkontroluj id: board, notesLayer, empty, boardHint, draft, btnPlace, btnCancel, btnClear, status.");
}

// ====== LocalStorage ======
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) notes = data;
    }
  } catch (e) {
    console.warn("localStorage load failed:", e);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

// ====== UI helpers ======
function pluralCZ(n) {
  if (n === 0) return "Žádné vzkazy";
  if (n === 1) return "1 vzkaz";
  if (n >= 2 && n <= 4) return `${n} vzkazy`;
  return `${n} vzkazů`;
}

function setPlacing(v) {
  placing = v;
  board.classList.toggle("placing", placing);
  hint.style.display = placing ? "block" : "none";
  btnCancel.disabled = !placing;
  renderStatus();
}

function renderStatus() {
  const n = notes.length;
  btnClear.disabled = n === 0;

  if (placing) {
    status.innerHTML = `<span class="dot"></span><span>Režim umisťování: klikni na plochu vpravo</span>`;
  } else {
    status.textContent = pluralCZ(n);
  }
}

function updateButtons() {
  btnPlace.disabled = !draft.value.trim();
  btnCancel.disabled = !placing;
  btnClear.disabled = notes.length === 0;
}

// ====== Notes logic ======
function bringFront(id) {
  const i = notes.findIndex((n) => n.id === id);
  if (i < 0) return;
  const [it] = notes.splice(i, 1);
  notes.unshift(it);
  save();
  render();
}

function removeNote(id) {
  notes = notes.filter((n) => n.id !== id);
  save();
  render();
  renderStatus();
  updateButtons();
}

function clearAll() {
  notes = [];
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
  render();
  renderStatus();
  updateButtons();
}

function addAt(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  let x = clientX - rect.left;
  let y = clientY - rect.top;

  x = clamp(x, PAD, rect.width - NOTE_W - PAD);
  y = clamp(y, PAD, rect.height - PAD);

  notes.unshift({
    id: uid(),
    text: draft.value.trim(),
    x,
    y,
    t: Date.now(),
  });

  draft.value = "";
  setPlacing(false);
  save();
  render();
  renderStatus();
  updateButtons();
}

// ====== Render ======
function render() {
  notesLayer.innerHTML = "";
  empty.style.display = !notes.length && !placing ? "grid" : "none";

  notes.forEach((n, i) => {
    const wrap = document.createElement("div");
    wrap.className = "noteWrap";
    wrap.style.transform = `translate(${n.x}px, ${n.y}px)`;
    wrap.style.zIndex = String(1000 - i);

    const note = document.createElement("div");
    note.className = "note";
    note.title = "Přetáhni pro přesun";
    note.setAttribute("data-id", n.id);

    note.addEventListener("click", (e) => e.stopPropagation());

    const header = document.createElement("div");
    header.className = "noteHeader";

    const label = document.createElement("div");
    label.className = "noteLabel";
    label.textContent = "Vzkaz";

    const del = document.createElement("button");
    del.className = "noteDel";
    del.textContent = "✕";
    del.title = "Smazat";
    del.setAttribute("aria-label", "Smazat vzkaz");
    del.setAttribute("data-del", "1");
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeNote(n.id);
    });

    header.appendChild(label);
    header.appendChild(del);

    const text = document.createElement("div");
    text.className = "noteText";
    text.textContent = n.text;

    const time = document.createElement("div");
    time.className = "noteTime";
    time.textContent = new Date(n.t).toLocaleString("cs-CZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    note.appendChild(header);
    note.appendChild(text);
    note.appendChild(time);

    // Drag
    note.addEventListener("pointerdown", (e) => {
      if (e.target?.closest?.("[data-del='1']")) return;

      bringFront(n.id);

      const rect = board.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const current = notes.find((x) => x.id === n.id);
      if (!current) return;

      drag.id = n.id;
      drag.pid = e.pointerId;
      drag.ox = px - current.x;
      drag.oy = py - current.y;

      try {
        note.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    note.addEventListener("pointermove", (e) => {
      // ✅ oprava: musí být OR
      if (!drag.id || drag.pid !== e.pointerId) return;

      const rect = board.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const x = clamp(px - drag.ox, PAD, rect.width - NOTE_W - PAD);
      const y = clamp(py - drag.oy, PAD, rect.height - PAD);

      notes = notes.map((item) => (item.id === drag.id ? { ...item, x, y } : item));
      save();

      wrap.style.transform = `translate(${x}px, ${y}px)`;
    });

    note.addEventListener("pointerup", (e) => {
      if (drag.pid !== e.pointerId) return;
      drag.id = null;
      drag.pid = null;
      drag.ox = 0;
      drag.oy = 0;
    });

    wrap.appendChild(note);
    notesLayer.appendChild(wrap);
  });
}

// ====== Events ======
draft.addEventListener("input", updateButtons);

btnPlace.addEventListener("click", () => {
  if (!draft.value.trim()) return;
  setPlacing(true);
  updateButtons();
  render();
});

btnCancel.addEventListener("click", () => {
  setPlacing(false);
  renderStatus();
  updateButtons();
  render();
});

btnClear.addEventListener("click", clearAll);

board.addEventListener("click", (e) => {
  if (!placing) return;
  if (!draft.value.trim()) return;
  addAt(e.clientX, e.clientY);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && placing) {
    setPlacing(false);
    renderStatus();
    updateButtons();
    render();
  }
});

// ====== Init ======
load();
render();
renderStatus();
updateButtons();
``
