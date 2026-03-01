import { useState, useRef, useCallback, useEffect } from "react";

/* ══════════════ IndexedDB ══════════════ */
const DB_NAME = "InkNotes_DB", DB_VERSION = 1, STORE = "notes_store";
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains(STORE)) e.target.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(k) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readonly"); const r = tx.objectStore(STORE).get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

/* ══════════════ Theme ══════════════ */
const themes = {
  light: {
    bg: "#faf9f7", surface: "#ffffff", surfaceHover: "#f5f3f0", surfaceActive: "#eceae6",
    border: "#e8e5e0", borderLight: "#f0eeea",
    text: "#1c1917", textSecondary: "#78716c", textMuted: "#a8a29e",
    accent: "#2563eb", accentLight: "#dbeafe", accentSoft: "#eff6ff",
    danger: "#dc2626", success: "#16a34a",
    canvas: "#ffffff", canvasGrid: "#e7e5e4",
    toolbar: "rgba(255,255,255,0.92)", toolbarBorder: "rgba(0,0,0,0.06)",
    shadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.08)",
  },
  dark: {
    bg: "#0c0a09", surface: "#1c1917", surfaceHover: "#292524", surfaceActive: "#3f3f46",
    border: "#2e2a27", borderLight: "#292524",
    text: "#fafaf9", textSecondary: "#a8a29e", textMuted: "#78716c",
    accent: "#3b82f6", accentLight: "#1e3a5f", accentSoft: "#172554",
    danger: "#ef4444", success: "#22c55e",
    canvas: "#18181b", canvasGrid: "#27272a",
    toolbar: "rgba(28,25,23,0.94)", toolbarBorder: "rgba(255,255,255,0.06)",
    shadow: "0 4px 24px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.4)",
  },
};

/* ══════════════ Constants ══════════════ */
const COLORS = ["#1c1917","#78716c","#2563eb","#0ea5e9","#16a34a","#84cc16","#f97316","#ec4899","#dc2626","#8b5cf6","#eab308","#92400e"];
const DARK_COLORS = ["#fafaf9","#a8a29e","#60a5fa","#38bdf8","#4ade80","#a3e635","#fb923c","#f472b6","#f87171","#a78bfa","#facc15","#d97706"];
const BRUSH_SIZES = [1, 2, 4, 6, 10, 16, 24];
const ERASER_SIZES = [8, 16, 24, 36, 48, 64];
const FONT_SIZES = [14, 18, 24, 32, 48, 64];
const T = { PEN:"pen", HIGHLIGHTER:"highlighter", ERASER:"eraser", TEXT:"text", SELECT:"select", LINE:"line", ARROW:"arrow", RECT:"rect", DIAMOND:"diamond", CIRCLE:"circle", HAND:"hand" };
const INACTIVITY_TIMEOUT = 1800000;

/* ══════════════ SVG Icons ══════════════ */
const icons = {
  hand: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7.5 21h9a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"/></svg>,
  select: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 3l14 9-6 1-3 6z"/></svg>,
  pen: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  highlighter: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>,
  eraser: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
  text: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>,
  line: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20L20 4"/></svg>,
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 19L19 5M19 5v10M19 5H9"/></svg>,
  rect: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  diamond: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l10 10-10 10L2 12z"/></svg>,
  circle: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>,
  sun: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  undo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  redo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>,
  save: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  menu: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  image: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  zoomIn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
};

/* ══════════════ App ══════════════ */
export default function NoteApp() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const [dark, setDark] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState(T.PEN);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);
  const [fontSize, setFontSize] = useState(24);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pages, setPages] = useState([{ id: 1, name: "Page 1" }]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageData, setPageData] = useState({});
  const [showGrid, setShowGrid] = useState(false);
  const [showRuled, setShowRuled] = useState(false);
  const [textInputs, setTextInputs] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [shapeStart, setShapeStart] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pressure, setPressure] = useState(1);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [renamingPage, setRenamingPage] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selection, setSelection] = useState(null);
  const [isDraggingSel, setIsDraggingSel] = useState(false);
  const [selStart, setSelStart] = useState(null);
  const selSnap = useRef(null);
  // Pan & zoom
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const lastPoint = useRef(null);
  const pathPts = useRef([]);
  const inactTimer = useRef(null);
  const lastBackup = useRef(null);
  const fileRef = useRef(null);
  const renameRef = useRef(null);
  const penDet = useRef(false);
  const penTO = useRef(null);
  const pdRef = useRef(pageData);
  const pgRef = useRef(pages);
  const cpRef = useRef(currentPage);
  const tiRef = useRef(textInputs);
  const sgRef = useRef(showGrid);
  const srRef = useRef(showRuled);

  useEffect(() => { pdRef.current = pageData; }, [pageData]);
  useEffect(() => { pgRef.current = pages; }, [pages]);
  useEffect(() => { cpRef.current = currentPage; }, [currentPage]);
  useEffect(() => { tiRef.current = textInputs; }, [textInputs]);
  useEffect(() => { sgRef.current = showGrid; }, [showGrid]);
  useEffect(() => { srRef.current = showRuled; }, [showRuled]);

  const th = dark ? themes.dark : themes.light;
  const palette = dark ? DARK_COLORS : COLORS;

  /* ═══════ Canvas Init ═══════ */
  const initCanvas = useCallback(() => {
    const c = canvasRef.current, o = overlayRef.current;
    if (!c || !o) return;
    const r = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    [c, o].forEach((cv) => { cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; cv.getContext("2d").scale(dpr, dpr); });
    const ctx = c.getContext("2d"); ctx.fillStyle = th.canvas; ctx.fillRect(0, 0, r.width, r.height);
  }, [th.canvas]);

  /* ═══════ State Persistence ═══════ */
  const collectState = useCallback(() => {
    const c = canvasRef.current;
    const img = c ? c.toDataURL() : null;
    const pd = { ...pdRef.current };
    if (img) pd[cpRef.current] = { image: img, texts: tiRef.current };
    return { version: 2, timestamp: new Date().toISOString(), pages: pgRef.current, currentPage: cpRef.current, pageData: pd, settings: { showGrid: sgRef.current, showRuled: srRef.current, dark } };
  }, [dark]);

  const saveIDB = useCallback(async () => {
    try { await idbSet("app_state", collectState()); setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1500); } catch (e) { console.error(e); }
  }, [collectState]);

  const dlBackup = useCallback(() => {
    try {
      const s = collectState(); if (lastBackup.current && Date.now() - lastBackup.current < 10000) return; lastBackup.current = Date.now();
      const b = new Blob([JSON.stringify(s)], { type: "application/json" }); const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = `ink-notes-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
      setSaveStatus("saved");
    } catch (e) { console.error(e); }
  }, [collectState]);

  const manualSave = useCallback(() => { lastBackup.current = null; dlBackup(); }, [dlBackup]);

  const restoreState = useCallback((s) => {
    if (!s?.pages) return;
    setPages(s.pages); setCurrentPage(s.currentPage || 0); setPageData(s.pageData || {});
    if (s.settings) { setShowGrid(s.settings.showGrid || false); setShowRuled(s.settings.showRuled || false); if (s.settings.dark !== undefined) setDark(s.settings.dark); }
    const pd = s.pageData?.[s.currentPage || 0];
    if (pd?.image) { const img = new Image(); img.onload = () => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = pd.image; setTextInputs(pd.texts || []); }
    setSaveStatus("loaded"); setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const handleUpload = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { try { const s = JSON.parse(ev.target.result); restoreState(s); idbSet("app_state", s); setShowUploadModal(false); } catch { alert("Invalid backup file."); } };
    r.readAsText(f);
  }, [restoreState]);

  /* ═══════ Lifecycle ═══════ */
  useEffect(() => { initCanvas(); (async () => { try { const s = await idbGet("app_state"); if (s?.pages) restoreState(s); } catch {} setAppReady(true); })(); }, []);
  useEffect(() => { if (!appReady) return; const i = setInterval(() => saveIDB(), 5000); return () => clearInterval(i); }, [appReady, saveIDB]);

  const resetInact = useCallback(() => { if (inactTimer.current) clearTimeout(inactTimer.current); inactTimer.current = setTimeout(() => { saveIDB(); dlBackup(); }, INACTIVITY_TIMEOUT); }, [saveIDB, dlBackup]);
  useEffect(() => { const ev = ["pointerdown", "pointermove", "keydown"]; ev.forEach((e) => window.addEventListener(e, resetInact)); resetInact(); return () => { ev.forEach((e) => window.removeEventListener(e, resetInact)); }; }, [resetInact]);

  useEffect(() => {
    const bu = (e) => { try { const s = collectState(); const r = indexedDB.open(DB_NAME, DB_VERSION); r.onsuccess = () => { const tx = r.result.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(s, "app_state"); }; } catch {} e.preventDefault(); e.returnValue = ""; };
    const vis = () => { if (document.visibilityState === "hidden") saveIDB(); };
    window.addEventListener("beforeunload", bu); document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("beforeunload", bu); document.removeEventListener("visibilitychange", vis); };
  }, [collectState, saveIDB]);

  useEffect(() => {
    const hr = () => { const c = canvasRef.current, o = overlayRef.current; if (!c || !o) return; const d = c.toDataURL(), r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      [c, o].forEach((cv) => { cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; cv.getContext("2d").scale(dpr, dpr); });
      const img = new Image(); img.onload = () => c.getContext("2d").drawImage(img, 0, 0, r.width, r.height); img.src = d; };
    window.addEventListener("resize", hr); return () => window.removeEventListener("resize", hr);
  }, []);

  // Redraw canvas bg color on theme switch
  useEffect(() => {
    if (!appReady) return;
    // We don't clear user content, just update the CSS
  }, [dark, appReady]);

  /* ═══════ History ═══════ */
  const saveHist = useCallback(() => { const c = canvasRef.current; if (!c) return; const d = c.toDataURL(); setHistory((p) => { const h = p.slice(0, historyIndex + 1); h.push(d); return h.length > 50 ? h.slice(-50) : h; }); setHistoryIndex((p) => Math.min(p + 1, 49)); }, [historyIndex]);
  const undo = useCallback(() => { if (historyIndex <= 0) return; setSelection(null); selSnap.current = null; const i = historyIndex - 1; const img = new Image(); img.onload = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = history[i]; setHistoryIndex(i); }, [history, historyIndex]);
  const redo = useCallback(() => { if (historyIndex >= history.length - 1) return; setSelection(null); selSnap.current = null; const i = historyIndex + 1; const img = new Image(); img.onload = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = history[i]; setHistoryIndex(i); }, [history, historyIndex]);

  /* ═══════ Drawing helpers ═══════ */
  const getPos = (e) => { const r = canvasRef.current.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left - panOffset.x) / zoom, y: (t.clientY - r.top - panOffset.y) / zoom, pressure: e.pressure ?? 0.5 }; };
  const isPalm = (e) => { if (e.pointerType === "pen") { penDet.current = true; if (penTO.current) clearTimeout(penTO.current); penTO.current = setTimeout(() => { penDet.current = false; }, 500); return false; } if (e.pointerType === "touch" && penDet.current) return true; if (e.pointerType === "touch" && (e.width > 30 || e.height > 30)) return true; return false; };

  const drawSeg = (ctx, a, b, col, sz, pv = 1) => { ctx.strokeStyle = col; ctx.lineWidth = sz * Math.max(0.3, pv); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const drawPath = (ctx, pts, col, sz) => { if (pts.length < 2) return; ctx.strokeStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length - 1; i++) { ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2); } ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); };

  const drawArrow = (ctx, fx, fy, tx, ty, col, sz) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
    const angle = Math.atan2(ty - fy, tx - fx); const hl = 14 + sz * 2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - hl * Math.cos(angle - 0.4), ty - hl * Math.sin(angle - 0.4)); ctx.lineTo(tx - hl * Math.cos(angle + 0.4), ty - hl * Math.sin(angle + 0.4)); ctx.closePath(); ctx.fill();
  };

  const drawDiamond = (ctx, x, y, w, h, col, sz) => {
    const cx = x + w / 2, cy = y + h / 2, hw = Math.abs(w) / 2, hh = Math.abs(h) / 2;
    ctx.strokeStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); ctx.stroke();
  };

  /* ═══════ Selection ═══════ */
  const commitSel = useCallback(() => {
    if (!selection?.imageData) return;
    const c = canvasRef.current, ctx = c.getContext("2d");
    const tc = document.createElement("canvas"); tc.width = selection.imageData.width; tc.height = selection.imageData.height; tc.getContext("2d").putImageData(selection.imageData, 0, 0);
    ctx.drawImage(tc, selection.x, selection.y, selection.w, selection.h);
    setSelection(null); selSnap.current = null;
    const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height);
    saveHist();
  }, [selection, saveHist]);

  const inSel = (p) => selection && p.x >= selection.x && p.x <= selection.x + selection.w && p.y >= selection.y && p.y <= selection.y + selection.h;

  /* ═══════ Pointer handlers ═══════ */
  const handleDown = (e) => {
    e.preventDefault(); if (isPalm(e)) return;
    const pos = getPos(e); setPressure(pos.pressure || 0.5);

    // Hand tool — pan
    if (tool === T.HAND) { isPanning.current = true; panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }; return; }

    if (tool === T.SELECT) {
      if (selection && inSel(pos)) { setIsDraggingSel(true); lastPoint.current = pos; return; }
      if (selection) commitSel();
      setSelStart(pos); setIsDrawing(true); return;
    }
    if (selection) commitSel();
    if (tool === T.TEXT) { setTextInputs((p) => [...p, { id: Date.now(), x: pos.x, y: pos.y, text: "", color, fontSize }]); setEditingText(Date.now()); return; }
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool)) { setShapeStart(pos); setIsDrawing(true); return; }
    setIsDrawing(true); lastPoint.current = pos; pathPts.current = [pos];
    if (tool === T.ERASER) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.fillStyle = th.canvas; ctx.beginPath(); ctx.arc(pos.x, pos.y, eraserSize, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  };

  const handleMove = (e) => {
    e.preventDefault(); if (isPalm(e)) return;

    // Hand pan
    if (tool === T.HAND && isPanning.current) {
      setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); return;
    }

    const pos = getPos(e);
    // Select drag
    if (tool === T.SELECT && isDraggingSel && selection) {
      const dx = pos.x - lastPoint.current.x, dy = pos.y - lastPoint.current.y;
      setSelection((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      if (selSnap.current) { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); const tc = document.createElement("canvas"); tc.width = selection.imageData.width; tc.height = selection.imageData.height; tc.getContext("2d").putImageData(selection.imageData, 0, 0); ctx.drawImage(tc, selection.x + dx, selection.y + dy, selection.w, selection.h); }; img.src = selSnap.current; }
      lastPoint.current = pos;
      const o = overlayRef.current, octx = o.getContext("2d"), rr = o.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, rr.width, rr.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2 / zoom; octx.strokeRect(selection.x + dx, selection.y + dy, selection.w, selection.h); octx.restore();
      return;
    }
    // Select rect
    if (tool === T.SELECT && isDrawing && selStart) {
      const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2 / zoom;
      octx.fillStyle = dark ? "rgba(59,130,246,0.08)" : "rgba(37,99,235,0.06)";
      const x = Math.min(selStart.x, pos.x), y = Math.min(selStart.y, pos.y), w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y);
      octx.fillRect(x, y, w, h); octx.strokeRect(x, y, w, h); octx.restore(); return;
    }

    if (!isDrawing) return;
    const pv = pos.pressure || pressure; setPressure(pv);

    // Shapes preview on overlay
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && shapeStart) {
      const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, r.width, r.height); octx.save();
      if (tool === T.LINE) { octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.beginPath(); octx.moveTo(shapeStart.x, shapeStart.y); octx.lineTo(pos.x, pos.y); octx.stroke(); }
      else if (tool === T.ARROW) { drawArrow(octx, shapeStart.x, shapeStart.y, pos.x, pos.y, color, brushSize); }
      else if (tool === T.RECT) { octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y); }
      else if (tool === T.DIAMOND) { drawDiamond(octx, shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y, color, brushSize); }
      else if (tool === T.CIRCLE) { const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2; octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.beginPath(); octx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); octx.stroke(); }
      octx.restore(); return;
    }

    if (tool === T.ERASER) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.fillStyle = th.canvas; const dx = pos.x - lastPoint.current.x, dy = pos.y - lastPoint.current.y, d = Math.sqrt(dx * dx + dy * dy), st = Math.max(1, Math.floor(d / 2)); for (let i = 0; i <= st; i++) { const t = i / st; ctx.beginPath(); ctx.arc(lastPoint.current.x + dx * t, lastPoint.current.y + dy * t, eraserSize, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    else if (tool === T.PEN) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); drawSeg(ctx, lastPoint.current, pos, color, brushSize, pv); ctx.restore(); pathPts.current.push(pos); }
    else if (tool === T.HIGHLIGHTER) { pathPts.current.push(pos); const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.globalAlpha = 0.3; drawPath(octx, pathPts.current, color, brushSize * 3); octx.restore(); }
    lastPoint.current = pos;
  };

  const handleUp = (e) => {
    if (tool === T.HAND) { isPanning.current = false; return; }
    if (tool === T.SELECT && isDraggingSel) { setIsDraggingSel(false); lastPoint.current = null; return; }
    if (tool === T.SELECT && isDrawing && selStart) {
      const pos = getPos(e); const x = Math.min(selStart.x, pos.x), y = Math.min(selStart.y, pos.y), w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y);
      if (w > 5 && h > 5) { const c = canvasRef.current, ctx = c.getContext("2d"), dpr = window.devicePixelRatio || 1; const id = ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr); selSnap.current = c.toDataURL(); ctx.fillStyle = th.canvas; ctx.fillRect(x, y, w, h); selSnap.current = c.toDataURL(); setSelection({ x, y, w, h, imageData: id }); const tc = document.createElement("canvas"); tc.width = id.width; tc.height = id.height; tc.getContext("2d").putImageData(id, 0, 0); ctx.drawImage(tc, x, y, w, h); const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2; octx.strokeRect(x, y, w, h); octx.restore(); }
      else { const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
      setSelStart(null); setIsDrawing(false); return;
    }
    if (!isDrawing) return;
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && shapeStart) {
      const pos = getPos(e), ctx = canvasRef.current.getContext("2d"), o = overlayRef.current, r = o.parentElement.getBoundingClientRect();
      o.getContext("2d").clearRect(0, 0, r.width, r.height); ctx.save();
      if (tool === T.LINE) { ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(shapeStart.x, shapeStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
      else if (tool === T.ARROW) { drawArrow(ctx, shapeStart.x, shapeStart.y, pos.x, pos.y, color, brushSize); }
      else if (tool === T.RECT) { ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y); }
      else if (tool === T.DIAMOND) { drawDiamond(ctx, shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y, color, brushSize); }
      else if (tool === T.CIRCLE) { const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2; ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore(); setShapeStart(null);
    }
    if (tool === T.HIGHLIGHTER && pathPts.current.length > 1) { const ctx = canvasRef.current.getContext("2d"), o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); ctx.save(); ctx.globalAlpha = 0.3; drawPath(ctx, pathPts.current, color, brushSize * 3); ctx.restore(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
    setIsDrawing(false); lastPoint.current = null; pathPts.current = []; saveHist();
  };

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const h = (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); const d = e.deltaY > 0 ? -0.05 : 0.05; setZoom((z) => Math.max(0.25, Math.min(5, z + d))); } };
    el.addEventListener("wheel", h, { passive: false }); return () => el.removeEventListener("wheel", h);
  }, []);

  useEffect(() => { if (tool !== T.SELECT && selection) commitSel(); }, [tool]);

  const commitText = (inp) => { if (!inp.text.trim()) return; const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.font = `${inp.fontSize}px "DM Sans", system-ui, sans-serif`; ctx.fillStyle = inp.color; ctx.textBaseline = "top"; inp.text.split("\n").forEach((l, i) => ctx.fillText(l, inp.x, inp.y + i * inp.fontSize * 1.3)); ctx.restore(); saveHist(); };
  const textBlur = (id) => { const inp = textInputs.find((t) => t.id === id); if (inp) { commitText(inp); setTextInputs((p) => p.filter((t) => t.id !== id)); } setEditingText(null); };
  const clearCanvas = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.fillStyle = th.canvas; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); setSelection(null); selSnap.current = null; saveHist(); };

  /* ═══════ Pages ═══════ */
  const savePD = useCallback(() => { const c = canvasRef.current; if (!c) return; setPageData((p) => ({ ...p, [currentPage]: { image: c.toDataURL(), texts: textInputs } })); }, [currentPage, textInputs]);
  const loadPD = useCallback((i) => { const d = pageData[i]; const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); if (d?.image) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = d.image; setTextInputs(d.texts || []); } else { ctx.fillStyle = th.canvas; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); } }, [pageData, th.canvas]);
  const switchPg = (i) => { if (selection) commitSel(); savePD(); setCurrentPage(i); setTimeout(() => loadPD(i), 50); };
  const addPg = () => { if (selection) commitSel(); savePD(); setPages((p) => [...p, { id: Date.now(), name: `Page ${p.length + 1}` }]); setCurrentPage(pages.length); const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.fillStyle = th.canvas; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); saveHist(); };
  const startRename = (i) => { setRenamingPage(i); setRenameValue(pages[i].name); setTimeout(() => renameRef.current?.focus(), 50); };
  const finishRename = () => { if (renamingPage !== null && renameValue.trim()) setPages((p) => p.map((pg, i) => i === renamingPage ? { ...pg, name: renameValue.trim() } : pg)); setRenamingPage(null); };
  const exportPng = () => { const a = document.createElement("a"); a.download = `note-page-${currentPage + 1}.png`; a.href = canvasRef.current.toDataURL(); a.click(); };

  /* ═══════ Background ═══════ */
  useEffect(() => { if (!appReady) return; const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); if (showGrid || showRuled) { ctx.fillStyle = th.canvas; ctx.fillRect(0, 0, r.width, r.height); if (showGrid) { ctx.save(); ctx.strokeStyle = th.canvasGrid; ctx.lineWidth = 0.5; for (let x = 0; x < r.width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, r.height); ctx.stroke(); } for (let y = 0; y < r.height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(r.width, y); ctx.stroke(); } ctx.restore(); } if (showRuled) { ctx.save(); ctx.strokeStyle = dark ? "#2a3a4a" : "#c8d8e8"; ctx.lineWidth = 0.7; for (let y = 80; y < r.height; y += 32) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(r.width - 20, y); ctx.stroke(); } ctx.strokeStyle = dark ? "#5a3030" : "#f0a0a0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, 40); ctx.lineTo(60, r.height - 20); ctx.stroke(); ctx.restore(); } saveHist(); } }, [showGrid, showRuled, appReady, dark]);

  /* ═══════ Shortcuts ═══════ */
  useEffect(() => { const h = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); manualSave(); }
    if (e.key === "Escape" && selection) commitSel();
    if ((e.key === "Delete" || e.key === "Backspace") && selection && tool === T.SELECT) { if (selSnap.current) { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); saveHist(); }; img.src = selSnap.current; } setSelection(null); selSnap.current = null; const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
    // Tool shortcuts
    if (!e.metaKey && !e.ctrlKey && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      if (e.key === "h" || e.key === "H") setTool(T.HAND);
      if (e.key === "v" || e.key === "V") setTool(T.SELECT);
      if (e.key === "p" || e.key === "P") setTool(T.PEN);
      if (e.key === "e" || e.key === "E") setTool(T.ERASER);
      if (e.key === "t" || e.key === "T") setTool(T.TEXT);
      if (e.key === "r" || e.key === "R") setTool(T.RECT);
      if (e.key === "o" || e.key === "O") setTool(T.CIRCLE);
      if (e.key === "l" || e.key === "L") setTool(T.LINE);
      if (e.key === "a" || e.key === "A") setTool(T.ARROW);
      if (e.key === "d" || e.key === "D") setTool(T.DIAMOND);
    }
  }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [undo, redo, manualSave, selection, tool, commitSel, saveHist]);

  /* ═══════ Styles ═══════ */
  const s = {
    btn: (active) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "10px", border: "none", background: active ? th.accent : "transparent", color: active ? "#fff" : th.textSecondary, cursor: "pointer", transition: "all 0.15s ease", position: "relative" }),
    pill: { fontSize: "10px", fontWeight: 700, padding: "2px 5px", borderRadius: "4px", background: th.surfaceActive, color: th.textMuted, position: "absolute", bottom: "-2px", right: "-2px", lineHeight: 1 },
    sep: { width: "1px", height: "24px", background: th.border, margin: "0 2px", flexShrink: 0 },
    label: { fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "0.8px", marginRight: "6px", textTransform: "uppercase" },
  };

  const getCursor = () => { if (tool === T.HAND) return isPanning.current ? "grabbing" : "grab"; if (tool === T.TEXT) return "text"; if (tool === T.ERASER) return "none"; if (tool === T.SELECT) return selection ? (isDraggingSel ? "grabbing" : "default") : "crosshair"; return "crosshair"; };
  const stMap = { idle: { c: th.textMuted, t: "Auto-saved" }, saved: { c: th.success, t: "✓ Saved" }, loaded: { c: th.accent, t: "✓ Restored" } };
  const stI = stMap[saveStatus] || stMap.idle;

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: th.bg, fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif', overflow: "hidden", userSelect: "none", transition: "background 0.3s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: "fixed", inset: 0, background: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div style={{ background: th.surface, borderRadius: "20px", padding: "36px", maxWidth: "400px", width: "90%", boxShadow: th.shadowLg, textAlign: "center", border: `1px solid ${th.border}` }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: th.accent }}>{icons.upload}</div>
            <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: th.text, fontWeight: 700 }}>Restore Notes</h2>
            <p style={{ margin: "0 0 24px", fontSize: "13px", color: th.textSecondary, lineHeight: 1.5 }}>Upload a backup file to continue where you left off.</p>
            <input ref={fileRef} type="file" accept=".json" onChange={handleUpload} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: `2px dashed ${th.border}`, background: th.surfaceHover, cursor: "pointer", fontSize: "13px", fontWeight: 600, color: th.text, marginBottom: "10px" }}>Choose Backup File</button>
            <button onClick={() => setShowUploadModal(false)} style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: th.textMuted }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ══════ Floating Top Bar ══════ */}
      <div style={{ position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", gap: "8px", alignItems: "center" }}>
        {/* Pages button */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ ...s.btn(sidebarOpen), background: sidebarOpen ? th.accent : th.toolbar, backdropFilter: "blur(12px)", boxShadow: th.shadow, border: `1px solid ${th.toolbarBorder}`, color: sidebarOpen ? "#fff" : th.text, width: "auto", padding: "0 12px", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
          {icons.menu}
        </button>

        {/* Main Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "4px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
          {[
            [T.HAND, icons.hand, "H"], [T.SELECT, icons.select, "V"], null,
            [T.PEN, icons.pen, "P"], [T.HIGHLIGHTER, icons.highlighter, ""], [T.ERASER, icons.eraser, "E"], [T.TEXT, icons.text, "T"], null,
            [T.LINE, icons.line, "L"], [T.ARROW, icons.arrow, "A"], [T.RECT, icons.rect, "R"], [T.DIAMOND, icons.diamond, "D"], [T.CIRCLE, icons.circle, "O"],
          ].map((item, i) => item === null ? <div key={i} style={s.sep} /> : (
            <button key={item[0]} onClick={() => setTool(item[0])} title={`${item[0]} (${item[2]})`} style={s.btn(tool === item[0])}>
              {item[1]}
              {item[2] && <span style={{ ...s.pill, display: tool === item[0] ? "none" : "block" }}>{item[2]}</span>}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "4px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
          <button onClick={undo} title="Undo" style={{ ...s.btn(false), color: historyIndex > 0 ? th.text : th.textMuted }}>{icons.undo}</button>
          <button onClick={redo} title="Redo" style={{ ...s.btn(false), color: historyIndex < history.length - 1 ? th.text : th.textMuted }}>{icons.redo}</button>
          <div style={s.sep} />
          <button onClick={() => setDark(!dark)} title="Toggle theme" style={{ ...s.btn(false), color: th.text }}>{dark ? icons.sun : icons.moon}</button>
        </div>
      </div>

      {/* ══════ Floating Bottom Bar — context sensitive ══════ */}
      <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", gap: "8px", alignItems: "center" }}>
        {/* Colors */}
        {![T.ERASER, T.SELECT, T.HAND].includes(tool) && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "6px 10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
            {palette.map((c, i) => (
              <button key={i} onClick={() => setColor(c)} style={{
                width: color === c ? "24px" : "20px", height: color === c ? "24px" : "20px", borderRadius: "50%",
                border: color === c ? `2.5px solid ${th.accent}` : `2px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                background: c, cursor: "pointer", transition: "all 0.15s", boxShadow: color === c ? `0 0 0 2px ${th.surface}` : "none",
              }} />
            ))}
          </div>
        )}

        {/* Brush size */}
        {[T.PEN, T.HIGHLIGHTER, T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "6px 10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
            <span style={s.label}>Size</span>
            {BRUSH_SIZES.map((sz) => (
              <button key={sz} onClick={() => setBrushSize(sz)} style={{
                width: "28px", height: "28px", borderRadius: "8px", border: brushSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: brushSize === sz ? th.accentSoft : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: Math.min(sz * 1.4, 16) + "px", height: Math.min(sz * 1.4, 16) + "px", borderRadius: "50%", background: color }} />
              </button>
            ))}
          </div>
        )}

        {/* Eraser size */}
        {tool === T.ERASER && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "6px 10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
            <span style={s.label}>Eraser</span>
            {ERASER_SIZES.map((sz) => (
              <button key={sz} onClick={() => setEraserSize(sz)} style={{
                width: "32px", height: "32px", borderRadius: "8px", border: eraserSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: eraserSize === sz ? th.accentSoft : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: Math.min(sz * 0.45, 20) + "px", height: Math.min(sz * 0.45, 20) + "px", borderRadius: "3px", background: th.textMuted, opacity: 0.4 }} />
              </button>
            ))}
            <span style={{ fontSize: "11px", color: th.textMuted, marginLeft: "4px" }}>{eraserSize}px</span>
          </div>
        )}

        {/* Font size */}
        {tool === T.TEXT && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "6px 10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
            <span style={s.label}>Font</span>
            {FONT_SIZES.map((sz) => (
              <button key={sz} onClick={() => setFontSize(sz)} style={{
                padding: "4px 8px", borderRadius: "6px", border: fontSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: fontSize === sz ? th.accentSoft : "transparent", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: th.text,
              }}>{sz}</button>
            ))}
          </div>
        )}

        {/* BG + Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: "6px 8px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
          <button onClick={() => { setShowGrid(!showGrid); setShowRuled(false); }} style={{ ...s.btn(showGrid), width: "28px", height: "28px", borderRadius: "8px", fontSize: "10px", fontWeight: 700, color: showGrid ? "#fff" : th.textMuted }}>▦</button>
          <button onClick={() => { setShowRuled(!showRuled); setShowGrid(false); }} style={{ ...s.btn(showRuled), width: "28px", height: "28px", borderRadius: "8px", fontSize: "10px", fontWeight: 700, color: showRuled ? "#fff" : th.textMuted }}>☰</button>
          <div style={s.sep} />
          <button onClick={manualSave} title="Save Backup" style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.success }}>{icons.save}</button>
          <button onClick={() => setShowUploadModal(true)} title="Restore" style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.accent }}>{icons.upload}</button>
          <button onClick={exportPng} title="Export PNG" style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.text }}>{icons.image}</button>
          <button onClick={clearCanvas} title="Clear" style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.danger }}>{icons.trash}</button>
        </div>
      </div>

      {/* ══════ Signature ══════ */}
      <div style={{ position: "absolute", bottom: "14px", left: "16px", zIndex: 100, display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: th.textMuted, fontWeight: 500, opacity: 0.6, letterSpacing: "0.2px" }}>
        <span style={{ fontSize: "13px", lineHeight: 1 }}>✦</span>
        <span>crafted by <span style={{ fontWeight: 700, color: th.textSecondary, letterSpacing: "0.5px" }}>Nilay</span></span>
      </div>

      {/* ══════ Zoom indicator ══════ */}
      <div style={{ position: "absolute", bottom: "12px", right: "16px", zIndex: 100, display: "flex", alignItems: "center", gap: "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "10px", padding: "4px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
        <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.text }}>{icons.zoomOut}</button>
        <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} style={{ padding: "2px 8px", background: "transparent", border: "none", fontSize: "11px", fontWeight: 700, color: th.textSecondary, cursor: "pointer", minWidth: "44px", textAlign: "center" }}>{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom((z) => Math.min(5, z + 0.1))} style={{ ...s.btn(false), width: "28px", height: "28px", borderRadius: "8px", color: th.text }}>{icons.zoomIn}</button>
      </div>

      {/* ══════ Status pill ══════ */}
      <div style={{ position: "absolute", top: "12px", right: "16px", zIndex: 100, fontSize: "11px", fontWeight: 600, color: stI.c, background: th.toolbar, backdropFilter: "blur(12px)", padding: "6px 12px", borderRadius: "10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
        {stI.t} · Pg {currentPage + 1}/{pages.length}
      </div>

      {/* ══════ Main ══════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{ width: "240px", background: th.surface, borderRight: `1px solid ${th.border}`, padding: "64px 16px 16px", overflowY: "auto", zIndex: 90, transition: "all 0.2s" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "1.2px", marginBottom: "10px" }}>PAGES</div>
            {pages.map((pg, i) => (
              <div key={pg.id} style={{ display: "flex", alignItems: "center", marginBottom: "3px", borderRadius: "10px", background: currentPage === i ? th.surfaceHover : "transparent", transition: "all 0.15s" }}>
                {renamingPage === i ? (
                  <input ref={renameRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={finishRename}
                    onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setRenamingPage(null); }}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: `2px solid ${th.accent}`, outline: "none", fontSize: "13px", fontWeight: 600, color: th.text, background: th.accentSoft }}
                  />
                ) : (
                  <button onClick={() => switchPg(i)} onDoubleClick={() => startRename(i)} style={{
                    flex: 1, textAlign: "left", padding: "9px 12px", borderRadius: "10px", border: "none", background: "transparent", cursor: "pointer",
                    fontSize: "13px", fontWeight: currentPage === i ? 700 : 500, color: currentPage === i ? th.text : th.textSecondary,
                  }}>{pg.name}</button>
                )}
                {renamingPage !== i && (
                  <button onClick={() => startRename(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", color: th.textMuted, opacity: currentPage === i ? 0.8 : 0.3 }}>{icons.edit}</button>
                )}
              </div>
            ))}
            <button onClick={addPg} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", padding: "10px", marginTop: "8px", borderRadius: "10px", border: `1.5px dashed ${th.border}`, background: "transparent", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: th.textMuted }}>
              {icons.plus} New Page
            </button>
            <div style={{ marginTop: "16px", padding: "10px", background: th.surfaceHover, borderRadius: "10px", fontSize: "10px", color: th.textMuted, lineHeight: 1.5 }}>
              Double-click to rename pages
            </div>
            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: `1px solid ${th.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: th.text, letterSpacing: "-0.3px", marginBottom: "2px" }}>Ink Notes</div>
              <div style={{ fontSize: "10px", color: th.textMuted, fontWeight: 500, letterSpacing: "0.5px" }}>✦ handcrafted by <span style={{ fontWeight: 700, color: th.accent }}>Nilay</span> ✦</div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: getCursor(), background: th.bg }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: "center center" }}>
            <canvas ref={canvasRef}
              onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp}
              onTouchStart={(e) => e.preventDefault()} onTouchMove={(e) => e.preventDefault()}
              style={{ position: "absolute", top: 0, left: 0, touchAction: "none" }}
            />
            <canvas ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", touchAction: "none" }} />
          </div>
          {textInputs.map((inp) => (
            <textarea key={inp.id} autoFocus={editingText === inp.id} value={inp.text}
              onChange={(e) => setTextInputs((p) => p.map((t) => t.id === inp.id ? { ...t, text: e.target.value } : t))}
              onBlur={() => textBlur(inp.id)} onKeyDown={(e) => { if (e.key === "Escape") e.target.blur(); }}
              style={{
                position: "absolute", left: (inp.x * zoom + panOffset.x) + "px", top: (inp.y * zoom + panOffset.y) + "px",
                fontSize: (inp.fontSize * zoom) + "px", color: inp.color,
                fontFamily: '"DM Sans", system-ui, sans-serif', background: dark ? "rgba(28,25,23,0.9)" : "rgba(255,255,255,0.9)",
                border: `2px solid ${th.accent}`, borderRadius: "8px", outline: "none", padding: "6px 8px",
                minWidth: "80px", minHeight: (inp.fontSize * 1.5) + "px", resize: "both", lineHeight: 1.3, zIndex: 20,
              }}
            />
          ))}
          {/* Eraser cursor */}
          {tool === T.ERASER && (
            <div id="eraser-cursor" style={{ position: "fixed", width: eraserSize * 2 * zoom + "px", height: eraserSize * 2 * zoom + "px", borderRadius: "50%", border: `2px solid ${th.accent}`, pointerEvents: "none", zIndex: 200, transform: "translate(-50%, -50%)", display: "none" }} />
          )}
        </div>
      </div>

      {/* Eraser cursor follow */}
      {tool === T.ERASER && (
        <style>{`
          #eraser-cursor { display: block !important; }
          body { cursor: none !important; }
        `}</style>
      )}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('pointermove', function(e) {
          var c = document.getElementById('eraser-cursor');
          if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
        });
      ` }} />
    </div>
  );
}