import { useState, useRef, useCallback, useEffect } from "react";

/* ══════════════ IndexedDB ══════════════ */
const DB_NAME = "InkNotes_DB", DB_VERSION = 1, STORE = "notes_store";
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains(STORE)) e.target.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbSet(k, v) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbGet(k) { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readonly"); const r = tx.objectStore(STORE).get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

/* ══════════════ Themes ══════════════ */
const themes = {
  light: {
    bg: "#faf9f7", surface: "#ffffff", surfaceHover: "#f5f3f0", surfaceActive: "#eceae6",
    border: "#e8e5e0", text: "#1c1917", textSecondary: "#78716c", textMuted: "#a8a29e",
    accent: "#2563eb", accentLight: "#dbeafe", accentSoft: "#eff6ff",
    danger: "#dc2626", success: "#16a34a",
    canvas: "#ffffff", canvasGrid: "#e7e5e4",
    toolbar: "rgba(255,255,255,0.92)", toolbarBorder: "rgba(0,0,0,0.06)",
    shadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.08)",
  },
  dark: {
    bg: "#0c0a09", surface: "#1c1917", surfaceHover: "#292524", surfaceActive: "#3f3f46",
    border: "#2e2a27", text: "#fafaf9", textSecondary: "#a8a29e", textMuted: "#78716c",
    accent: "#3b82f6", accentLight: "#1e3a5f", accentSoft: "#172554",
    danger: "#ef4444", success: "#22c55e",
    canvas: "#ffffff", canvasGrid: "#e7e5e4",
    toolbar: "rgba(28,25,23,0.94)", toolbarBorder: "rgba(255,255,255,0.06)",
    shadow: "0 4px 24px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.4)",
  },
};

/* ══════════════ Constants ══════════════ */
const COLORS = ["#1c1917","#78716c","#2563eb","#0ea5e9","#16a34a","#84cc16","#f97316","#ec4899","#dc2626","#8b5cf6","#eab308","#92400e"];
const BRUSH_SIZES = [1, 2, 4, 6, 10, 16, 24];
const ERASER_SIZES = [8, 16, 24, 36, 48, 64];
const FONT_SIZES = [14, 18, 24, 32, 48, 64];
const T = { PEN:"pen", HIGHLIGHTER:"highlighter", ERASER:"eraser", TEXT:"text", SELECT:"select", LINE:"line", ARROW:"arrow", RECT:"rect", DIAMOND:"diamond", CIRCLE:"circle", HAND:"hand" };
const INACTIVITY_TIMEOUT = 1800000;

/* ══════════════ SVG Icons ══════════════ */
const I = {
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
  mail: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  send: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

/* ══════════════ App ══════════════ */
export default function NoteApp() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const eraserCursorRef = useRef(null);
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState("");
  const [appReady, setAppReady] = useState(false);
  const [renamingPage, setRenamingPage] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selection, setSelection] = useState(null);
  const [isDraggingSel, setIsDraggingSel] = useState(false);
  const [selStart, setSelStart] = useState(null);
  const selSnap = useRef(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [winW, setWinW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

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

  // Responsive
  useEffect(() => {
    const h = () => setWinW(window.innerWidth);
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  const compact = winW < 768;
  const tiny = winW < 500;

  const th = dark ? themes.dark : themes.light;

  /* ═══════ Eraser cursor tracking ═══════ */
  useEffect(() => {
    const handleMove = (e) => {
      const el = eraserCursorRef.current;
      if (el) { el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; }
    };
    if (tool === T.ERASER) {
      window.addEventListener("pointermove", handleMove);
      return () => window.removeEventListener("pointermove", handleMove);
    }
  }, [tool]);

  /* ═══════ Canvas Init ═══════ */
  const initCanvas = useCallback(() => {
    const c = canvasRef.current, o = overlayRef.current;
    if (!c || !o) return;
    const r = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    [c, o].forEach((cv) => { cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px"; cv.getContext("2d").scale(dpr, dpr); });
    const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height);
  }, []);

  /* ═══════ State Persistence ═══════ */
  const collectState = useCallback(() => {
    const c = canvasRef.current;
    const img = c ? c.toDataURL() : null;
    const pd = { ...pdRef.current };
    if (img) pd[cpRef.current] = { image: img, texts: tiRef.current };
    return { version: 2, timestamp: new Date().toISOString(), pages: pgRef.current, currentPage: cpRef.current, pageData: pd, settings: { showGrid: sgRef.current, showRuled: srRef.current, dark } };
  }, [dark]);

  const saveIDB = useCallback(async () => { try { await idbSet("app_state", collectState()); setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1500); } catch (e) { console.error(e); } }, [collectState]);

  const dlBackup = useCallback(() => {
    try {
      const s = collectState(); if (lastBackup.current && Date.now() - lastBackup.current < 10000) return; lastBackup.current = Date.now();
      const b = new Blob([JSON.stringify(s)], { type: "application/json" }); const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = `ink-notes-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); setSaveStatus("saved");
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

  const handleUpload = useCallback((e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { const s = JSON.parse(ev.target.result); restoreState(s); idbSet("app_state", s); setShowUploadModal(false); } catch { alert("Invalid backup file."); } }; r.readAsText(f); }, [restoreState]);

  /* ═══════ Lifecycle ═══════ */
  useEffect(() => { initCanvas(); (async () => { try { const s = await idbGet("app_state"); if (s?.pages) restoreState(s); } catch {} setAppReady(true); })(); }, []);
  useEffect(() => { if (!appReady) return; const i = setInterval(() => saveIDB(), 5000); return () => clearInterval(i); }, [appReady, saveIDB]);

  const resetInact = useCallback(() => { if (inactTimer.current) clearTimeout(inactTimer.current); inactTimer.current = setTimeout(() => { saveIDB(); dlBackup(); }, INACTIVITY_TIMEOUT); }, [saveIDB, dlBackup]);
  useEffect(() => { const ev = ["pointerdown", "pointermove", "keydown"]; ev.forEach((e) => window.addEventListener(e, resetInact)); resetInact(); return () => { ev.forEach((e) => window.removeEventListener(e, resetInact)); }; }, [resetInact]);

  useEffect(() => {
    const bu = (e) => { try { const s = collectState(); const r = indexedDB.open(DB_NAME, DB_VERSION); r.onsuccess = () => r.result.transaction(STORE, "readwrite").objectStore(STORE).put(s, "app_state"); } catch {} e.preventDefault(); e.returnValue = ""; };
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

  /* ═══════ History ═══════ */
  const saveHist = useCallback(() => { const c = canvasRef.current; if (!c) return; const d = c.toDataURL(); setHistory((p) => { const h = p.slice(0, historyIndex + 1); h.push(d); return h.length > 50 ? h.slice(-50) : h; }); setHistoryIndex((p) => Math.min(p + 1, 49)); }, [historyIndex]);
  const undo = useCallback(() => { if (historyIndex <= 0) return; setSelection(null); selSnap.current = null; const i = historyIndex - 1; const img = new Image(); img.onload = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = history[i]; setHistoryIndex(i); }, [history, historyIndex]);
  const redo = useCallback(() => { if (historyIndex >= history.length - 1) return; setSelection(null); selSnap.current = null; const i = historyIndex + 1; const img = new Image(); img.onload = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = history[i]; setHistoryIndex(i); }, [history, historyIndex]);

  /* ═══════ Drawing helpers ═══════ */
  const getPos = (e) => { const r = canvasRef.current.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left - panOffset.x) / zoom, y: (t.clientY - r.top - panOffset.y) / zoom, pressure: e.pressure ?? 0.5 }; };
  const isPalm = (e) => { if (e.pointerType === "pen") { penDet.current = true; if (penTO.current) clearTimeout(penTO.current); penTO.current = setTimeout(() => { penDet.current = false; }, 500); return false; } if (e.pointerType === "touch" && penDet.current) return true; if (e.pointerType === "touch" && (e.width > 30 || e.height > 30)) return true; return false; };
  const drawSeg = (ctx, a, b, col, sz, pv = 1) => { ctx.strokeStyle = col; ctx.lineWidth = sz * Math.max(0.3, pv); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const drawPath = (ctx, pts, col, sz) => { if (pts.length < 2) return; ctx.strokeStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length - 1; i++) { ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2); } ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); };
  const drawArrow = (ctx, fx, fy, tx, ty, col, sz) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke(); const a = Math.atan2(ty - fy, tx - fx), hl = 14 + sz * 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - hl * Math.cos(a - 0.4), ty - hl * Math.sin(a - 0.4)); ctx.lineTo(tx - hl * Math.cos(a + 0.4), ty - hl * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill(); };
  const drawDiamond = (ctx, x, y, w, h, col, sz) => { const cx = x + w / 2, cy = y + h / 2, hw = Math.abs(w) / 2, hh = Math.abs(h) / 2; ctx.strokeStyle = col; ctx.lineWidth = sz; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath(); ctx.stroke(); };

  /* ═══════ Selection ═══════ */
  const commitSel = useCallback(() => { if (!selection?.imageData) return; const c = canvasRef.current, ctx = c.getContext("2d"); const tc = document.createElement("canvas"); tc.width = selection.imageData.width; tc.height = selection.imageData.height; tc.getContext("2d").putImageData(selection.imageData, 0, 0); ctx.drawImage(tc, selection.x, selection.y, selection.w, selection.h); setSelection(null); selSnap.current = null; const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); saveHist(); }, [selection, saveHist]);
  const inSel = (p) => selection && p.x >= selection.x && p.x <= selection.x + selection.w && p.y >= selection.y && p.y <= selection.y + selection.h;

  /* ═══════ Pointer handlers ═══════ */
  const handleDown = (e) => {
    e.preventDefault(); if (isPalm(e)) return;
    const pos = getPos(e); setPressure(pos.pressure || 0.5);
    if (tool === T.HAND) { isPanning.current = true; panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }; return; }
    if (tool === T.SELECT) { if (selection && inSel(pos)) { setIsDraggingSel(true); lastPoint.current = pos; return; } if (selection) commitSel(); setSelStart(pos); setIsDrawing(true); return; }
    if (selection) commitSel();
    if (tool === T.TEXT) { setTextInputs((p) => [...p, { id: Date.now(), x: pos.x, y: pos.y, text: "", color, fontSize }]); setEditingText(Date.now()); return; }
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool)) { setShapeStart(pos); setIsDrawing(true); return; }
    setIsDrawing(true); lastPoint.current = pos; pathPts.current = [pos];
    if (tool === T.ERASER) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(pos.x, pos.y, eraserSize, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  };

  const handleMove = (e) => {
    e.preventDefault(); if (isPalm(e)) return;
    if (tool === T.HAND && isPanning.current) { setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); return; }
    const pos = getPos(e);
    if (tool === T.SELECT && isDraggingSel && selection) {
      const dx = pos.x - lastPoint.current.x, dy = pos.y - lastPoint.current.y;
      setSelection((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      if (selSnap.current) { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); const tc = document.createElement("canvas"); tc.width = selection.imageData.width; tc.height = selection.imageData.height; tc.getContext("2d").putImageData(selection.imageData, 0, 0); ctx.drawImage(tc, selection.x + dx, selection.y + dy, selection.w, selection.h); }; img.src = selSnap.current; }
      lastPoint.current = pos;
      const o = overlayRef.current, octx = o.getContext("2d"), rr = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, rr.width, rr.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2 / zoom; octx.strokeRect(selection.x + dx, selection.y + dy, selection.w, selection.h); octx.restore(); return;
    }
    if (tool === T.SELECT && isDrawing && selStart) {
      const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2 / zoom; octx.fillStyle = "rgba(37,99,235,0.06)";
      const x = Math.min(selStart.x, pos.x), y = Math.min(selStart.y, pos.y), w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y); octx.fillRect(x, y, w, h); octx.strokeRect(x, y, w, h); octx.restore(); return;
    }
    if (!isDrawing) return;
    const pv = pos.pressure || pressure; setPressure(pv);
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && shapeStart) {
      const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save();
      if (tool === T.LINE) { octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.beginPath(); octx.moveTo(shapeStart.x, shapeStart.y); octx.lineTo(pos.x, pos.y); octx.stroke(); }
      else if (tool === T.ARROW) drawArrow(octx, shapeStart.x, shapeStart.y, pos.x, pos.y, color, brushSize);
      else if (tool === T.RECT) { octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y); }
      else if (tool === T.DIAMOND) drawDiamond(octx, shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y, color, brushSize);
      else if (tool === T.CIRCLE) { const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2; octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round"; octx.beginPath(); octx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); octx.stroke(); }
      octx.restore(); return;
    }
    if (tool === T.ERASER) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.fillStyle = "#ffffff"; const dx = pos.x - lastPoint.current.x, dy = pos.y - lastPoint.current.y, d = Math.sqrt(dx * dx + dy * dy), st = Math.max(1, Math.floor(d / 2)); for (let i = 0; i <= st; i++) { const t = i / st; ctx.beginPath(); ctx.arc(lastPoint.current.x + dx * t, lastPoint.current.y + dy * t, eraserSize, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    else if (tool === T.PEN) { const ctx = canvasRef.current.getContext("2d"); ctx.save(); drawSeg(ctx, lastPoint.current, pos, color, brushSize, pv); ctx.restore(); pathPts.current.push(pos); }
    else if (tool === T.HIGHLIGHTER) { pathPts.current.push(pos); const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.globalAlpha = 0.3; drawPath(octx, pathPts.current, color, brushSize * 3); octx.restore(); }
    lastPoint.current = pos;
  };

  const handleUp = (e) => {
    if (tool === T.HAND) { isPanning.current = false; return; }
    if (tool === T.SELECT && isDraggingSel) { setIsDraggingSel(false); lastPoint.current = null; return; }
    if (tool === T.SELECT && isDrawing && selStart) {
      const pos = getPos(e), x = Math.min(selStart.x, pos.x), y = Math.min(selStart.y, pos.y), w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y);
      if (w > 5 && h > 5) { const c = canvasRef.current, ctx = c.getContext("2d"), dpr = window.devicePixelRatio || 1; const id = ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr); selSnap.current = c.toDataURL(); ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h); selSnap.current = c.toDataURL(); setSelection({ x, y, w, h, imageData: id }); const tc = document.createElement("canvas"); tc.width = id.width; tc.height = id.height; tc.getContext("2d").putImageData(id, 0, 0); ctx.drawImage(tc, x, y, w, h); const o = overlayRef.current, octx = o.getContext("2d"), r = o.parentElement.getBoundingClientRect(); octx.clearRect(0, 0, r.width, r.height); octx.save(); octx.setLineDash([6, 4]); octx.strokeStyle = th.accent; octx.lineWidth = 2; octx.strokeRect(x, y, w, h); octx.restore(); }
      else { const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
      setSelStart(null); setIsDrawing(false); return;
    }
    if (!isDrawing) return;
    if ([T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && shapeStart) {
      const pos = getPos(e), ctx = canvasRef.current.getContext("2d"), o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); ctx.save();
      if (tool === T.LINE) { ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(shapeStart.x, shapeStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
      else if (tool === T.ARROW) drawArrow(ctx, shapeStart.x, shapeStart.y, pos.x, pos.y, color, brushSize);
      else if (tool === T.RECT) { ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y); }
      else if (tool === T.DIAMOND) drawDiamond(ctx, shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y, color, brushSize);
      else if (tool === T.CIRCLE) { const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2; ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore(); setShapeStart(null);
    }
    if (tool === T.HIGHLIGHTER && pathPts.current.length > 1) { const ctx = canvasRef.current.getContext("2d"), o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); ctx.save(); ctx.globalAlpha = 0.3; drawPath(ctx, pathPts.current, color, brushSize * 3); ctx.restore(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
    setIsDrawing(false); lastPoint.current = null; pathPts.current = []; saveHist();
  };

  useEffect(() => { const el = containerRef.current; if (!el) return; const h = (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.max(0.25, Math.min(5, z + (e.deltaY > 0 ? -0.05 : 0.05)))); } }; el.addEventListener("wheel", h, { passive: false }); return () => el.removeEventListener("wheel", h); }, []);
  useEffect(() => { if (tool !== T.SELECT && selection) commitSel(); }, [tool]);

  const commitText = (inp) => { if (!inp.text.trim()) return; const ctx = canvasRef.current.getContext("2d"); ctx.save(); ctx.font = `${inp.fontSize}px "DM Sans", system-ui, sans-serif`; ctx.fillStyle = inp.color; ctx.textBaseline = "top"; inp.text.split("\n").forEach((l, i) => ctx.fillText(l, inp.x, inp.y + i * inp.fontSize * 1.3)); ctx.restore(); saveHist(); };
  const textBlur = (id) => { const inp = textInputs.find((t) => t.id === id); if (inp) { commitText(inp); setTextInputs((p) => p.filter((t) => t.id !== id)); } setEditingText(null); };
  const clearCanvas = () => { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); setSelection(null); selSnap.current = null; saveHist(); };

  /* ═══════ Pages ═══════ */
  const savePD = useCallback(() => { const c = canvasRef.current; if (!c) return; setPageData((p) => ({ ...p, [currentPage]: { image: c.toDataURL(), texts: textInputs } })); }, [currentPage, textInputs]);
  const loadPD = useCallback((i) => { const d = pageData[i]; const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); if (d?.image) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = d.image; setTextInputs(d.texts || []); } else { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); } }, [pageData]);
  const switchPg = (i) => { if (selection) commitSel(); savePD(); setCurrentPage(i); setTimeout(() => loadPD(i), 50); };
  const addPg = () => { if (selection) commitSel(); savePD(); setPages((p) => [...p, { id: Date.now(), name: `Page ${p.length + 1}` }]); setCurrentPage(pages.length); const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]); saveHist(); };
  const startRename = (i) => { setRenamingPage(i); setRenameValue(pages[i].name); setTimeout(() => renameRef.current?.focus(), 50); };
  const finishRename = () => { if (renamingPage !== null && renameValue.trim()) setPages((p) => p.map((pg, i) => i === renamingPage ? { ...pg, name: renameValue.trim() } : pg)); setRenamingPage(null); };

  /* ═══════ Export with dark mode support ═══════ */
  const getExportDataUrl = () => {
    const c = canvasRef.current;
    if (!dark) return c.toDataURL();
    // Apply inversion for dark mode export
    const r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const tc = document.createElement("canvas"); tc.width = c.width; tc.height = c.height;
    const tctx = tc.getContext("2d"); tctx.filter = "invert(1) hue-rotate(180deg)"; tctx.drawImage(c, 0, 0);
    return tc.toDataURL();
  };
  const exportPng = () => { const a = document.createElement("a"); a.download = `note-page-${currentPage + 1}.png`; a.href = getExportDataUrl(); a.click(); };

  /* ═══════ Email ═══════ */
  const openEmailModal = () => { setEmailSubject(`Ink Notes — ${pages[currentPage]?.name || "Page " + (currentPage + 1)}`); setEmailTo(""); setEmailPreview(getExportDataUrl()); setShowEmailModal(true); };
  const sendEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes("@")) return; setEmailSending(true);
    try {
      const dataUrl = getExportDataUrl();
      if (navigator.share && navigator.canShare) { const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], `${emailSubject.replace(/[^a-zA-Z0-9 ]/g, "")}.png`, { type: "image/png" }); if (navigator.canShare({ files: [file] })) { try { await navigator.share({ title: emailSubject, text: `Here's my note: ${pages[currentPage]?.name || "Page"}`, files: [file] }); setShowEmailModal(false); setEmailSending(false); return; } catch {} } }
      const blob = await (await fetch(dataUrl)).blob(); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `${emailSubject.replace(/[^a-zA-Z0-9 ]/g, "")}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
      window.open(`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent("Hi,\n\nPlease find my note attached.\n\n— Sent from Ink Notes by Nilay")}`, "_self");
      setShowEmailModal(false);
    } catch { alert("Could not send. Image downloaded — please attach manually."); }
    setEmailSending(false);
  };

  /* ═══════ Background ═══════ */
  useEffect(() => { if (!appReady) return; const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); if (showGrid || showRuled) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height); if (showGrid) { ctx.save(); ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 0.5; for (let x = 0; x < r.width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, r.height); ctx.stroke(); } for (let y = 0; y < r.height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(r.width, y); ctx.stroke(); } ctx.restore(); } if (showRuled) { ctx.save(); ctx.strokeStyle = "#c8d8e8"; ctx.lineWidth = 0.7; for (let y = 80; y < r.height; y += 32) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(r.width - 20, y); ctx.stroke(); } ctx.strokeStyle = "#f0a0a0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, 40); ctx.lineTo(60, r.height - 20); ctx.stroke(); ctx.restore(); } saveHist(); } }, [showGrid, showRuled, appReady]);

  /* ═══════ Shortcuts ═══════ */
  useEffect(() => { const h = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); manualSave(); }
    if (e.key === "Escape" && selection) commitSel();
    if ((e.key === "Delete" || e.key === "Backspace") && selection && tool === T.SELECT) { if (selSnap.current) { const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect(); const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); saveHist(); }; img.src = selSnap.current; } setSelection(null); selSnap.current = null; const o = overlayRef.current, r = o.parentElement.getBoundingClientRect(); o.getContext("2d").clearRect(0, 0, r.width, r.height); }
    if (!e.metaKey && !e.ctrlKey && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      const km = { h:T.HAND, v:T.SELECT, p:T.PEN, e:T.ERASER, t:T.TEXT, r:T.RECT, o:T.CIRCLE, l:T.LINE, a:T.ARROW, d:T.DIAMOND };
      if (km[e.key.toLowerCase()]) setTool(km[e.key.toLowerCase()]);
    }
  }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [undo, redo, manualSave, selection, tool, commitSel, saveHist]);

  /* ═══════ Styles ═══════ */
  const btnSz = compact ? 32 : 36;
  const s = {
    btn: (active) => ({ display: "flex", alignItems: "center", justifyContent: "center", width: btnSz + "px", height: btnSz + "px", borderRadius: "10px", border: "none", background: active ? th.accent : "transparent", color: active ? "#fff" : th.textSecondary, cursor: "pointer", transition: "all 0.15s", position: "relative", flexShrink: 0 }),
    pill: { fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "3px", background: th.surfaceActive, color: th.textMuted, position: "absolute", bottom: "-1px", right: "-1px", lineHeight: 1 },
    sep: { width: "1px", height: "20px", background: th.border, margin: "0 2px", flexShrink: 0 },
    label: { fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "0.6px", marginRight: "4px", textTransform: "uppercase", whiteSpace: "nowrap" },
    bar: { display: "flex", alignItems: "center", gap: compact ? "3px" : "4px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: compact ? "3px 6px" : "6px 10px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow, flexShrink: 0 },
  };
  const getCursor = () => { if (tool === T.HAND) return isPanning.current ? "grabbing" : "grab"; if (tool === T.TEXT) return "text"; if (tool === T.ERASER) return "none"; if (tool === T.SELECT) return selection ? (isDraggingSel ? "grabbing" : "default") : "crosshair"; return "crosshair"; };
  const stMap = { idle: { c: th.textMuted, t: "Auto-saved" }, saved: { c: th.success, t: "✓ Saved" }, loaded: { c: th.accent, t: "✓ Restored" } };
  const stI = stMap[saveStatus] || stMap.idle;

  /* ═══════ Tool items ═══════ */
  const toolItems = compact
    ? [[T.HAND,I.hand],[T.SELECT,I.select],null,[T.PEN,I.pen],[T.HIGHLIGHTER,I.highlighter],[T.ERASER,I.eraser],[T.TEXT,I.text],null,[T.RECT,I.rect],[T.CIRCLE,I.circle],[T.ARROW,I.arrow]]
    : [[T.HAND,I.hand,"H"],[T.SELECT,I.select,"V"],null,[T.PEN,I.pen,"P"],[T.HIGHLIGHTER,I.highlighter,""],[T.ERASER,I.eraser,"E"],[T.TEXT,I.text,"T"],null,[T.LINE,I.line,"L"],[T.ARROW,I.arrow,"A"],[T.RECT,I.rect,"R"],[T.DIAMOND,I.diamond,"D"],[T.CIRCLE,I.circle,"O"]];

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: th.bg, fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif', overflow: "hidden", userSelect: "none", transition: "background 0.3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ═══ Modals ═══ */}
      {showUploadModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div style={{ background: th.surface, borderRadius: "20px", padding: compact ? "24px" : "36px", maxWidth: "400px", width: "90%", boxShadow: th.shadowLg, textAlign: "center", border: `1px solid ${th.border}` }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: th.accent }}>{I.upload}</div>
            <h2 style={{ margin: "0 0 6px", fontSize: "17px", color: th.text, fontWeight: 700 }}>Restore Notes</h2>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: th.textSecondary }}>Upload a backup file (.json)</p>
            <input ref={fileRef} type="file" accept=".json" onChange={handleUpload} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: `2px dashed ${th.border}`, background: th.surfaceHover, cursor: "pointer", fontSize: "13px", fontWeight: 600, color: th.text, marginBottom: "8px" }}>Choose Backup File</button>
            <button onClick={() => setShowUploadModal(false)} style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", color: th.textMuted }}>Cancel</button>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div style={{ background: th.surface, borderRadius: "20px", padding: compact ? "24px" : "36px", maxWidth: "420px", width: "90%", boxShadow: th.shadowLg, border: `1px solid ${th.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", color: th.accent, flexShrink: 0 }}>{I.mail}</div>
              <div><h2 style={{ margin: 0, fontSize: "16px", color: th.text, fontWeight: 700 }}>Share via Email</h2><p style={{ margin: 0, fontSize: "11px", color: th.textMuted }}>Send current page as image</p></div>
            </div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "0.5px", marginBottom: "5px", textTransform: "uppercase" }}>Recipient</label>
            <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="name@example.com" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") sendEmail(); if (e.key === "Escape") setShowEmailModal(false); }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: `2px solid ${th.border}`, background: th.surfaceHover, color: th.text, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: "12px" }}
              onFocus={(e) => e.target.style.borderColor = th.accent} onBlur={(e) => e.target.style.borderColor = th.border} />
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "0.5px", marginBottom: "5px", textTransform: "uppercase" }}>Subject</label>
            <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: `2px solid ${th.border}`, background: th.surfaceHover, color: th.text, fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: "16px" }}
              onFocus={(e) => e.target.style.borderColor = th.accent} onBlur={(e) => e.target.style.borderColor = th.border} />
            {emailPreview && <div style={{ marginBottom: "16px", borderRadius: "10px", overflow: "hidden", border: `1px solid ${th.border}`, background: th.bg, padding: "6px", display: "flex", justifyContent: "center" }}><img src={emailPreview} alt="preview" style={{ maxWidth: "100%", maxHeight: "120px", borderRadius: "6px", objectFit: "contain" }} /></div>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowEmailModal(false)} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: `1px solid ${th.border}`, background: "transparent", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: th.textSecondary, fontFamily: "inherit" }}>Cancel</button>
              <button onClick={sendEmail} disabled={emailSending || !emailTo.includes("@")} style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", cursor: emailTo.includes("@") ? "pointer" : "not-allowed", background: emailTo.includes("@") ? th.accent : th.surfaceActive, color: emailTo.includes("@") ? "#fff" : th.textMuted, fontSize: "13px", fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: emailSending ? 0.7 : 1 }}>
                {emailSending ? "Preparing..." : <>{I.send} Send Note</>}
              </button>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: "10px", color: th.textMuted, textAlign: "center" }}>Mobile: opens share sheet · Desktop: downloads image + opens email client</p>
          </div>
        </div>
      )}

      {/* ═══ Top Toolbar ═══ */}
      <div style={{ position: "absolute", top: compact ? "8px" : "12px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", gap: compact ? "4px" : "8px", alignItems: "center", maxWidth: "calc(100vw - 24px)" }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ ...s.btn(sidebarOpen), background: sidebarOpen ? th.accent : th.toolbar, backdropFilter: "blur(12px)", boxShadow: th.shadow, border: `1px solid ${th.toolbarBorder}`, color: sidebarOpen ? "#fff" : th.text }}>
          {I.menu}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "2px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: compact ? "2px" : "4px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow, overflowX: "auto", maxWidth: compact ? "calc(100vw - 160px)" : "none" }}>
          {toolItems.map((item, i) => item === null ? <div key={i} style={s.sep} /> : (
            <button key={item[0]} onClick={() => setTool(item[0])} title={item[0]} style={s.btn(tool === item[0])}>
              {item[1]}
              {!compact && item[2] && <span style={{ ...s.pill, display: tool === item[0] ? "none" : "block" }}>{item[2]}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "14px", padding: compact ? "2px" : "4px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
          <button onClick={undo} style={{ ...s.btn(false), color: historyIndex > 0 ? th.text : th.textMuted }}>{I.undo}</button>
          <button onClick={redo} style={{ ...s.btn(false), color: historyIndex < history.length - 1 ? th.text : th.textMuted }}>{I.redo}</button>
          {!tiny && <div style={s.sep} />}
          {!tiny && <button onClick={() => setDark(!dark)} style={{ ...s.btn(false), color: th.text }}>{dark ? I.sun : I.moon}</button>}
        </div>
      </div>

      {/* ═══ Bottom Bar ═══ */}
      <div style={{ position: "absolute", bottom: compact ? "8px" : "12px", left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", gap: compact ? "4px" : "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "calc(100vw - 24px)" }}>
        {![T.ERASER, T.SELECT, T.HAND].includes(tool) && (
          <div style={s.bar}>
            {COLORS.map((c, i) => (
              <button key={i} onClick={() => setColor(c)} style={{
                width: color === c ? (compact ? "20px" : "24px") : (compact ? "16px" : "20px"), height: color === c ? (compact ? "20px" : "24px") : (compact ? "16px" : "20px"), borderRadius: "50%",
                border: color === c ? `2.5px solid ${th.accent}` : `2px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                background: c, cursor: "pointer", transition: "all 0.15s", boxShadow: color === c ? `0 0 0 2px ${th.surface}` : "none", flexShrink: 0,
              }} />
            ))}
          </div>
        )}

        {[T.PEN, T.HIGHLIGHTER, T.LINE, T.ARROW, T.RECT, T.DIAMOND, T.CIRCLE].includes(tool) && (
          <div style={s.bar}>
            {!tiny && <span style={s.label}>Size</span>}
            {BRUSH_SIZES.map((sz) => (
              <button key={sz} onClick={() => setBrushSize(sz)} style={{
                width: compact ? "24px" : "28px", height: compact ? "24px" : "28px", borderRadius: "8px", border: brushSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: brushSize === sz ? th.accentSoft : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><div style={{ width: Math.min(sz * 1.4, 16) + "px", height: Math.min(sz * 1.4, 16) + "px", borderRadius: "50%", background: color }} /></button>
            ))}
          </div>
        )}

        {tool === T.ERASER && (
          <div style={s.bar}>
            {!tiny && <span style={s.label}>Eraser</span>}
            {ERASER_SIZES.map((sz) => (
              <button key={sz} onClick={() => setEraserSize(sz)} style={{
                width: compact ? "28px" : "32px", height: compact ? "28px" : "32px", borderRadius: "8px", border: eraserSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: eraserSize === sz ? th.accentSoft : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><div style={{ width: Math.min(sz * 0.45, 20) + "px", height: Math.min(sz * 0.45, 20) + "px", borderRadius: "3px", background: th.textMuted, opacity: 0.4 }} /></button>
            ))}
            {!compact && <span style={{ fontSize: "10px", color: th.textMuted }}>{eraserSize}px</span>}
          </div>
        )}

        {tool === T.TEXT && (
          <div style={s.bar}>
            {!tiny && <span style={s.label}>Font</span>}
            {FONT_SIZES.map((sz) => (
              <button key={sz} onClick={() => setFontSize(sz)} style={{
                padding: "3px 6px", borderRadius: "6px", border: fontSize === sz ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                background: fontSize === sz ? th.accentSoft : "transparent", cursor: "pointer", fontSize: "10px", fontWeight: 600, color: th.text, flexShrink: 0,
              }}>{sz}</button>
            ))}
          </div>
        )}

        <div style={{ ...s.bar, gap: "2px", padding: compact ? "3px 4px" : "6px 6px" }}>
          <button onClick={() => { setShowGrid(!showGrid); setShowRuled(false); }} style={{ ...s.btn(showGrid), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", fontSize: "10px", fontWeight: 700, color: showGrid ? "#fff" : th.textMuted }}>▦</button>
          <button onClick={() => { setShowRuled(!showRuled); setShowGrid(false); }} style={{ ...s.btn(showRuled), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", fontSize: "10px", fontWeight: 700, color: showRuled ? "#fff" : th.textMuted }}>☰</button>
          <div style={s.sep} />
          <button onClick={manualSave} title="Save" style={{ ...s.btn(false), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", color: th.success }}>{I.save}</button>
          <button onClick={() => setShowUploadModal(true)} title="Restore" style={{ ...s.btn(false), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", color: th.accent }}>{I.upload}</button>
          <button onClick={exportPng} title="Export PNG" style={{ ...s.btn(false), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", color: th.text }}>{I.image}</button>
          <button onClick={openEmailModal} title="Email" style={{ ...s.btn(false), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", color: th.accent }}>{I.mail}</button>
          <button onClick={clearCanvas} title="Clear" style={{ ...s.btn(false), width: compact ? "26px" : "28px", height: compact ? "26px" : "28px", borderRadius: "8px", color: th.danger }}>{I.trash}</button>
          {tiny && <><div style={s.sep} /><button onClick={() => setDark(!dark)} style={{ ...s.btn(false), width: "26px", height: "26px", borderRadius: "8px", color: th.text }}>{dark ? I.sun : I.moon}</button></>}
        </div>
      </div>

      {/* ═══ Signature ═══ */}
      <div style={{ position: "absolute", bottom: compact ? "52px" : "14px", left: compact ? "50%" : "16px", transform: compact ? "translateX(-50%)" : "none", zIndex: 100, display: "flex", alignItems: "center", gap: "6px", fontSize: compact ? "10px" : "11px", color: th.textMuted, fontWeight: 500, opacity: 0.6 }}>
        <span style={{ fontSize: "13px" }}>✦</span> crafted by <span style={{ fontWeight: 700, color: th.textSecondary }}>Nilay</span>
      </div>

      {/* ═══ Zoom ═══ */}
      <div style={{ position: "absolute", bottom: compact ? "8px" : "12px", right: compact ? "8px" : "16px", zIndex: 100, display: "flex", alignItems: "center", gap: "2px", background: th.toolbar, backdropFilter: "blur(12px)", borderRadius: "10px", padding: "3px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
        <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} style={{ ...s.btn(false), width: "26px", height: "26px", borderRadius: "8px", color: th.text }}>{I.zoomOut}</button>
        <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} style={{ padding: "2px 6px", background: "transparent", border: "none", fontSize: "10px", fontWeight: 700, color: th.textSecondary, cursor: "pointer", minWidth: "40px", textAlign: "center" }}>{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom((z) => Math.min(5, z + 0.1))} style={{ ...s.btn(false), width: "26px", height: "26px", borderRadius: "8px", color: th.text }}>{I.zoomIn}</button>
      </div>

      {/* ═══ Status ═══ */}
      <div style={{ position: "absolute", top: compact ? "8px" : "12px", right: compact ? "8px" : "16px", zIndex: 100, fontSize: "10px", fontWeight: 600, color: stI.c, background: th.toolbar, backdropFilter: "blur(12px)", padding: "5px 10px", borderRadius: "8px", border: `1px solid ${th.toolbarBorder}`, boxShadow: th.shadow }}>
        {stI.t} · Pg {currentPage + 1}/{pages.length}{!compact && " · 🛡️ Palm rejection ON"}
      </div>

      {/* ═══ Main Area ═══ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {sidebarOpen && (
          <div style={{ width: compact ? "200px" : "240px", background: th.surface, borderRight: `1px solid ${th.border}`, padding: `${compact ? 52 : 64}px 12px 12px`, overflowY: "auto", zIndex: 90 }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: th.textMuted, letterSpacing: "1px", marginBottom: "8px" }}>PAGES</div>
            {pages.map((pg, i) => (
              <div key={pg.id} style={{ display: "flex", alignItems: "center", marginBottom: "2px", borderRadius: "8px", background: currentPage === i ? th.surfaceHover : "transparent" }}>
                {renamingPage === i ? (
                  <input ref={renameRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={finishRename}
                    onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setRenamingPage(null); }}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: "8px", border: `2px solid ${th.accent}`, outline: "none", fontSize: "12px", fontWeight: 600, color: th.text, background: th.accentSoft, fontFamily: "inherit" }} />
                ) : (
                  <button onClick={() => switchPg(i)} onDoubleClick={() => startRename(i)} style={{
                    flex: 1, textAlign: "left", padding: "8px 10px", borderRadius: "8px", border: "none", background: "transparent", cursor: "pointer",
                    fontSize: "12px", fontWeight: currentPage === i ? 700 : 500, color: currentPage === i ? th.text : th.textSecondary, fontFamily: "inherit",
                  }}>{pg.name}</button>
                )}
                {renamingPage !== i && <button onClick={() => startRename(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: th.textMuted, opacity: currentPage === i ? 0.8 : 0.3, flexShrink: 0 }}>{I.edit}</button>}
              </div>
            ))}
            <button onClick={addPg} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", width: "100%", padding: "8px", marginTop: "6px", borderRadius: "8px", border: `1.5px dashed ${th.border}`, background: "transparent", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: th.textMuted, fontFamily: "inherit" }}>{I.plus} New Page</button>
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${th.border}`, textAlign: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: th.text, marginBottom: "2px" }}>Ink Notes</div>
              <div style={{ fontSize: "9px", color: th.textMuted }}>✦ handcrafted by <span style={{ fontWeight: 700, color: th.accent }}>Nilay</span> ✦</div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", cursor: getCursor(), background: dark ? "#0c0a09" : th.bg }}>
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: "center center",
            filter: dark ? "invert(1) hue-rotate(180deg)" : "none", transition: "filter 0.3s ease",
          }}>
            <canvas ref={canvasRef}
              onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp}
              onTouchStart={(e) => e.preventDefault()} onTouchMove={(e) => e.preventDefault()}
              style={{ position: "absolute", top: 0, left: 0, touchAction: "none" }} />
            <canvas ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", touchAction: "none" }} />
          </div>
          {textInputs.map((inp) => (
            <textarea key={inp.id} autoFocus={editingText === inp.id} value={inp.text}
              onChange={(e) => setTextInputs((p) => p.map((t) => t.id === inp.id ? { ...t, text: e.target.value } : t))}
              onBlur={() => textBlur(inp.id)} onKeyDown={(e) => { if (e.key === "Escape") e.target.blur(); }}
              style={{
                position: "absolute", left: (inp.x * zoom + panOffset.x) + "px", top: (inp.y * zoom + panOffset.y) + "px",
                fontSize: (inp.fontSize * zoom) + "px", color: inp.color,
                fontFamily: '"DM Sans", system-ui', background: dark ? "rgba(28,25,23,0.9)" : "rgba(255,255,255,0.9)",
                border: `2px solid ${th.accent}`, borderRadius: "8px", outline: "none", padding: "6px 8px",
                minWidth: "80px", minHeight: (inp.fontSize * 1.5) + "px", resize: "both", lineHeight: 1.3, zIndex: 20,
              }} />
          ))}
        </div>
      </div>

      {/* ═══ Eraser cursor ═══ */}
      {tool === T.ERASER && (
        <>
          <div ref={eraserCursorRef} style={{
            position: "fixed", width: (eraserSize * 2 * zoom) + "px", height: (eraserSize * 2 * zoom) + "px",
            borderRadius: "50%", border: `2px solid ${th.accent}`, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
            pointerEvents: "none", zIndex: 9000, transform: "translate(-50%, -50%)", left: "-100px", top: "-100px",
          }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "4px", height: "4px", borderRadius: "50%", background: th.accent, opacity: 0.6 }} />
          </div>
          <style>{`* { cursor: none !important; }`}</style>
        </>
      )}
    </div>
  );
}