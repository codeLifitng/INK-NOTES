import { useState, useRef, useCallback, useEffect } from "react";

/* ─────────────── IndexedDB Helper ─────────────── */
const DB_NAME = "InkNotes_DB";
const DB_VERSION = 1;
const STORE_NAME = "notes_store";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ─────────────── Constants ─────────────── */
const COLORS = [
  { name: "Ink", value: "#1a1a2e" },
  { name: "Charcoal", value: "#4a4a5a" },
  { name: "Ocean", value: "#0066cc" },
  { name: "Sky", value: "#4dabf7" },
  { name: "Emerald", value: "#0f9960" },
  { name: "Lime", value: "#82c91e" },
  { name: "Sunset", value: "#f76707" },
  { name: "Rose", value: "#e64980" },
  { name: "Crimson", value: "#c92a2a" },
  { name: "Violet", value: "#7950f2" },
  { name: "Gold", value: "#f59f00" },
  { name: "Brown", value: "#8B4513" },
];

const BRUSH_SIZES = [1, 2, 4, 6, 10, 16, 24];
const ERASER_SIZES = [8, 16, 24, 36, 48, 64];
const TOOLS = { PEN: "pen", HIGHLIGHTER: "highlighter", ERASER: "eraser", TEXT: "text", SELECT: "select", LINE: "line", RECT: "rect", CIRCLE: "circle" };
const FONT_SIZES = [14, 18, 24, 32, 48, 64];
const INACTIVITY_TIMEOUT = 1800000; // 30 minutes

/* ─────────────── Main App ─────────────── */
export default function NoteApp() {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState(COLORS[0].value);
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
  // Selection state
  const [selection, setSelection] = useState(null); // { x, y, w, h, imageData, offsetX, offsetY }
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const selectionSnapshot = useRef(null); // canvas snapshot before selection cut

  const lastPoint = useRef(null);
  const pathPoints = useRef([]);
  const inactivityTimer = useRef(null);
  const lastSavedBackup = useRef(null);
  const fileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const penDetected = useRef(false);
  const penTimeout = useRef(null);
  const pageDataRef = useRef(pageData);
  const pagesRef = useRef(pages);
  const currentPageRef = useRef(currentPage);
  const textInputsRef = useRef(textInputs);
  const showGridRef = useRef(showGrid);
  const showRuledRef = useRef(showRuled);

  useEffect(() => { pageDataRef.current = pageData; }, [pageData]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { textInputsRef.current = textInputs; }, [textInputs]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { showRuledRef.current = showRuled; }, [showRuled]);

  /* ─────────── Canvas Init ─────────── */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    [canvas, overlay].forEach((c) => {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.style.width = rect.width + "px";
      c.style.height = rect.height + "px";
      c.getContext("2d").scale(dpr, dpr);
    });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  /* ─────────── Collect full state ─────────── */
  const collectFullState = useCallback(() => {
    const canvas = canvasRef.current;
    const currentImage = canvas ? canvas.toDataURL() : null;
    const allPageData = { ...pageDataRef.current };
    if (currentImage) {
      allPageData[currentPageRef.current] = { image: currentImage, texts: textInputsRef.current };
    }
    return {
      version: 1,
      timestamp: new Date().toISOString(),
      pages: pagesRef.current,
      currentPage: currentPageRef.current,
      pageData: allPageData,
      settings: { showGrid: showGridRef.current, showRuled: showRuledRef.current },
    };
  }, []);

  /* ─────────── Save to IndexedDB ─────────── */
  const saveToIDB = useCallback(async () => {
    try {
      const state = collectFullState();
      await idbSet("app_state", state);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      console.error("IDB save failed:", e);
    }
  }, [collectFullState]);

  /* ─────────── Download backup file ─────────── */
  const downloadBackup = useCallback(() => {
    try {
      const state = collectFullState();
      const json = JSON.stringify(state);
      if (lastSavedBackup.current && Date.now() - lastSavedBackup.current < 10000) return;
      lastSavedBackup.current = Date.now();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ink-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaveStatus("saved");
    } catch (e) {
      console.error("Backup download failed:", e);
    }
  }, [collectFullState]);

  const manualSaveBackup = useCallback(() => {
    lastSavedBackup.current = null;
    downloadBackup();
  }, [downloadBackup]);

  /* ─────────── Restore from state ─────────── */
  const restoreFromState = useCallback((state) => {
    if (!state || !state.pages) return;
    setPages(state.pages);
    setCurrentPage(state.currentPage || 0);
    setPageData(state.pageData || {});
    if (state.settings) {
      setShowGrid(state.settings.showGrid || false);
      setShowRuled(state.settings.showRuled || false);
    }
    const pd = state.pageData?.[state.currentPage || 0];
    if (pd?.image) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.parentElement.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = pd.image;
      setTextInputs(pd.texts || []);
    }
    setSaveStatus("loaded");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  /* ─────────── Upload file handler ─────────── */
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const state = JSON.parse(evt.target.result);
        restoreFromState(state);
        idbSet("app_state", state);
        setShowUploadModal(false);
      } catch (err) {
        alert("Invalid backup file. Please select a valid Ink Notes backup JSON.");
      }
    };
    reader.readAsText(file);
  }, [restoreFromState]);

  /* ─────────── App Init ─────────── */
  useEffect(() => {
    initCanvas();
    (async () => {
      try {
        const state = await idbGet("app_state");
        if (state && state.pages) {
          restoreFromState(state);
        }
      } catch (e) {
        console.log("No IDB data found");
      }
      setAppReady(true);
    })();
  }, []);

  /* ─────────── Auto-save to IDB every 5s ─────────── */
  useEffect(() => {
    if (!appReady) return;
    const interval = setInterval(() => saveToIDB(), 5000);
    return () => clearInterval(interval);
  }, [appReady, saveToIDB]);

  /* ─────────── Inactivity → auto backup download ─────────── */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      saveToIDB();
      downloadBackup();
    }, INACTIVITY_TIMEOUT);
  }, [saveToIDB, downloadBackup]);

  useEffect(() => {
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  /* ─────────── beforeunload & visibility ─────────── */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      try {
        const state = collectFullState();
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(state, "app_state");
        };
      } catch (err) {}
      e.preventDefault();
      e.returnValue = "Your notes will be saved to browser storage. Use 💾 Save Backup to download a file.";
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveToIDB();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [collectFullState, saveToIDB]);

  /* ─────────── Resize ─────────── */
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!canvas || !overlay) return;
      const imageData = canvas.toDataURL();
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      [canvas, overlay].forEach((c) => {
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
        c.style.width = rect.width + "px";
        c.style.height = rect.height + "px";
        c.getContext("2d").scale(dpr, dpr);
      });
      const img = new Image();
      img.onload = () => canvas.getContext("2d").drawImage(img, 0, 0, rect.width, rect.height);
      img.src = imageData;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ─────────── History ─────────── */
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL();
    setHistory((prev) => {
      const h = prev.slice(0, historyIndex + 1);
      h.push(data);
      return h.length > 50 ? h.slice(-50) : h;
    });
    setHistoryIndex((p) => Math.min(p + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    setSelection(null); selectionSnapshot.current = null;
    const idx = historyIndex - 1;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.drawImage(img, 0, 0, r.width, r.height);
    };
    img.src = history[idx];
    setHistoryIndex(idx);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    setSelection(null); selectionSnapshot.current = null;
    const idx = historyIndex + 1;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.drawImage(img, 0, 0, r.width, r.height);
    };
    img.src = history[idx];
    setHistoryIndex(idx);
  }, [history, historyIndex]);

  /* ─────────── Drawing ─────────── */
  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top, pressure: e.pressure ?? 0.5 };
  };

  const isPalmTouch = (e) => {
    if (e.pointerType === "pen") {
      penDetected.current = true;
      if (penTimeout.current) clearTimeout(penTimeout.current);
      penTimeout.current = setTimeout(() => { penDetected.current = false; }, 500);
      return false;
    }
    if (e.pointerType === "touch" && penDetected.current) return true;
    if (e.pointerType === "touch" && (e.width > 30 || e.height > 30)) return true;
    return false;
  };

  const drawSegment = (ctx, from, to, strokeColor, size, pVal = 1) => {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = size * Math.max(0.3, pVal);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const drawFullPath = (ctx, points, strokeColor, size) => {
    if (points.length < 2) return;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  /* ─────────── Selection helpers ─────────── */
  const commitSelection = useCallback(() => {
    if (!selection || !selection.imageData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // Draw the selected image at its current position
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = selection.imageData.width;
    tempCanvas.height = selection.imageData.height;
    tempCanvas.getContext("2d").putImageData(selection.imageData, 0, 0);
    ctx.drawImage(tempCanvas, selection.x, selection.y, selection.w, selection.h);
    setSelection(null);
    selectionSnapshot.current = null;
    // Clear overlay
    const ov = overlayCanvasRef.current;
    const r = ov.parentElement.getBoundingClientRect();
    ov.getContext("2d").clearRect(0, 0, r.width, r.height);
    saveToHistory();
  }, [selection, saveToHistory]);

  const isInsideSelection = (pos) => {
    if (!selection) return false;
    return pos.x >= selection.x && pos.x <= selection.x + selection.w &&
           pos.y >= selection.y && pos.y <= selection.y + selection.h;
  };

  /* ─────────── Pointer Handlers ─────────── */
  const handlePointerDown = (e) => {
    e.preventDefault();
    if (isPalmTouch(e)) return;
    const pos = getPointerPos(e);
    setPressure(pos.pressure || 0.5);

    // SELECT tool
    if (tool === TOOLS.SELECT) {
      // If clicking inside existing selection, start dragging
      if (selection && isInsideSelection(pos)) {
        setIsDraggingSelection(true);
        lastPoint.current = pos;
        return;
      }
      // If clicking outside existing selection, commit it first
      if (selection) {
        commitSelection();
      }
      // Start new selection rectangle
      setSelectionStart(pos);
      setIsDrawing(true);
      return;
    }

    // Commit any pending selection when switching to other tools
    if (selection) commitSelection();

    if (tool === TOOLS.TEXT) {
      const ni = { id: Date.now(), x: pos.x, y: pos.y, text: "", color, fontSize };
      setTextInputs((p) => [...p, ni]);
      setEditingText(ni.id);
      return;
    }
    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE].includes(tool)) {
      setShapeStart(pos); setIsDrawing(true); return;
    }
    setIsDrawing(true);
    lastPoint.current = pos;
    pathPoints.current = [pos];
    if (tool === TOOLS.ERASER) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(pos.x, pos.y, eraserSize, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    if (isPalmTouch(e)) return;
    const pos = getPointerPos(e);

    // SELECT: dragging selection
    if (tool === TOOLS.SELECT && isDraggingSelection && selection) {
      const dx = pos.x - lastPoint.current.x;
      const dy = pos.y - lastPoint.current.y;
      setSelection((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      // Redraw: restore snapshot + draw floating selection
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const r = canvas.parentElement.getBoundingClientRect();
      if (selectionSnapshot.current) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, r.width, r.height);
          ctx.drawImage(img, 0, 0, r.width, r.height);
          // Draw floating piece
          const tempC = document.createElement("canvas");
          tempC.width = selection.imageData.width;
          tempC.height = selection.imageData.height;
          tempC.getContext("2d").putImageData(selection.imageData, 0, 0);
          ctx.drawImage(tempC, selection.x + dx, selection.y + dy, selection.w, selection.h);
        };
        img.src = selectionSnapshot.current;
      }
      lastPoint.current = pos;
      // Draw selection border on overlay
      const ov = overlayCanvasRef.current;
      const octx = ov.getContext("2d");
      const rr = ov.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, rr.width, rr.height);
      octx.save();
      octx.setLineDash([6, 4]);
      octx.strokeStyle = "#4dabf7";
      octx.lineWidth = 2;
      octx.strokeRect(selection.x + dx, selection.y + dy, selection.w, selection.h);
      octx.restore();
      return;
    }

    // SELECT: drawing selection rectangle
    if (tool === TOOLS.SELECT && isDrawing && selectionStart) {
      const ov = overlayCanvasRef.current;
      const octx = ov.getContext("2d");
      const r = ov.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, r.width, r.height);
      octx.save();
      octx.setLineDash([6, 4]);
      octx.strokeStyle = "#4dabf7";
      octx.lineWidth = 2;
      octx.fillStyle = "rgba(77, 171, 247, 0.08)";
      const x = Math.min(selectionStart.x, pos.x);
      const y = Math.min(selectionStart.y, pos.y);
      const w = Math.abs(pos.x - selectionStart.x);
      const h = Math.abs(pos.y - selectionStart.y);
      octx.fillRect(x, y, w, h);
      octx.strokeRect(x, y, w, h);
      octx.restore();
      return;
    }

    if (!isDrawing) return;
    const pVal = pos.pressure || pressure;
    setPressure(pVal);

    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE].includes(tool) && shapeStart) {
      const ov = overlayCanvasRef.current, octx = ov.getContext("2d"), r = ov.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, r.width, r.height);
      octx.save(); octx.strokeStyle = color; octx.lineWidth = brushSize; octx.lineCap = "round";
      if (tool === TOOLS.LINE) {
        octx.beginPath(); octx.moveTo(shapeStart.x, shapeStart.y); octx.lineTo(pos.x, pos.y); octx.stroke();
      } else if (tool === TOOLS.RECT) {
        octx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y);
      } else {
        const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2;
        octx.beginPath(); octx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); octx.stroke();
      }
      octx.restore(); return;
    }

    if (tool === TOOLS.ERASER) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      ctx.fillStyle = "#ffffff";
      const dx = pos.x - lastPoint.current.x;
      const dy = pos.y - lastPoint.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = lastPoint.current.x + dx * t;
        const y = lastPoint.current.y + dy * t;
        ctx.beginPath(); ctx.arc(x, y, eraserSize, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (tool === TOOLS.PEN) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.save();
      drawSegment(ctx, lastPoint.current, pos, color, brushSize, pVal);
      ctx.restore();
      pathPoints.current.push(pos);
    } else if (tool === TOOLS.HIGHLIGHTER) {
      pathPoints.current.push(pos);
      const ov = overlayCanvasRef.current;
      const octx = ov.getContext("2d");
      const r = ov.parentElement.getBoundingClientRect();
      octx.clearRect(0, 0, r.width, r.height);
      octx.save();
      octx.globalAlpha = 0.3;
      drawFullPath(octx, pathPoints.current, color, brushSize * 3);
      octx.restore();
    }
    lastPoint.current = pos;
  };

  const handlePointerUp = (e) => {
    // SELECT: finish dragging
    if (tool === TOOLS.SELECT && isDraggingSelection) {
      setIsDraggingSelection(false);
      lastPoint.current = null;
      return;
    }

    // SELECT: finish drawing selection rect
    if (tool === TOOLS.SELECT && isDrawing && selectionStart) {
      const pos = getPointerPos(e);
      const x = Math.min(selectionStart.x, pos.x);
      const y = Math.min(selectionStart.y, pos.y);
      const w = Math.abs(pos.x - selectionStart.x);
      const h = Math.abs(pos.y - selectionStart.y);

      if (w > 5 && h > 5) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        // Capture the selected region
        const imgData = ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr);
        // Save snapshot of canvas with selection area cleared (filled white)
        selectionSnapshot.current = canvas.toDataURL();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, w, h);
        selectionSnapshot.current = canvas.toDataURL();

        setSelection({ x, y, w, h, imageData: imgData });

        // Redraw the selected piece on top
        const tempC = document.createElement("canvas");
        tempC.width = imgData.width;
        tempC.height = imgData.height;
        tempC.getContext("2d").putImageData(imgData, 0, 0);
        ctx.drawImage(tempC, x, y, w, h);

        // Draw dashed border on overlay
        const ov = overlayCanvasRef.current;
        const octx = ov.getContext("2d");
        const r = ov.parentElement.getBoundingClientRect();
        octx.clearRect(0, 0, r.width, r.height);
        octx.save();
        octx.setLineDash([6, 4]);
        octx.strokeStyle = "#4dabf7";
        octx.lineWidth = 2;
        octx.strokeRect(x, y, w, h);
        octx.restore();
      } else {
        // Too small, clear overlay
        const ov = overlayCanvasRef.current;
        const r = ov.parentElement.getBoundingClientRect();
        ov.getContext("2d").clearRect(0, 0, r.width, r.height);
      }
      setSelectionStart(null);
      setIsDrawing(false);
      return;
    }

    if (!isDrawing) return;

    if ([TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE].includes(tool) && shapeStart) {
      const pos = getPointerPos(e);
      const ctx = canvasRef.current.getContext("2d");
      const ov = overlayCanvasRef.current, r = ov.parentElement.getBoundingClientRect();
      ov.getContext("2d").clearRect(0, 0, r.width, r.height);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = "round";
      if (tool === TOOLS.LINE) {
        ctx.beginPath(); ctx.moveTo(shapeStart.x, shapeStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      } else if (tool === TOOLS.RECT) {
        ctx.strokeRect(shapeStart.x, shapeStart.y, pos.x - shapeStart.x, pos.y - shapeStart.y);
      } else {
        const rx = Math.abs(pos.x - shapeStart.x) / 2, ry = Math.abs(pos.y - shapeStart.y) / 2;
        ctx.beginPath(); ctx.ellipse(shapeStart.x + (pos.x - shapeStart.x) / 2, shapeStart.y + (pos.y - shapeStart.y) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore(); setShapeStart(null);
    }

    if (tool === TOOLS.HIGHLIGHTER && pathPoints.current.length > 1) {
      const ctx = canvasRef.current.getContext("2d");
      const ov = overlayCanvasRef.current;
      const r = ov.parentElement.getBoundingClientRect();
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawFullPath(ctx, pathPoints.current, color, brushSize * 3);
      ctx.restore();
      ov.getContext("2d").clearRect(0, 0, r.width, r.height);
    }

    setIsDrawing(false); lastPoint.current = null; pathPoints.current = []; saveToHistory();
  };

  // Commit selection when switching away from select tool
  useEffect(() => {
    if (tool !== TOOLS.SELECT && selection) {
      commitSelection();
    }
  }, [tool]);

  const commitTextToCanvas = (input) => {
    if (!input.text.trim()) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.save();
    ctx.font = `${input.fontSize}px "SF Pro Display", -apple-system, sans-serif`;
    ctx.fillStyle = input.color; ctx.textBaseline = "top";
    input.text.split("\n").forEach((line, i) => ctx.fillText(line, input.x, input.y + i * input.fontSize * 1.3));
    ctx.restore(); saveToHistory();
  };

  const handleTextBlur = (id) => {
    const input = textInputs.find((t) => t.id === id);
    if (input) { commitTextToCanvas(input); setTextInputs((p) => p.filter((t) => t.id !== id)); }
    setEditingText(null);
  };

  const clearCanvas = () => {
    const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height);
    setTextInputs([]); setSelection(null); selectionSnapshot.current = null; saveToHistory();
  };

  /* ─────────── Pages ─────────── */
  const saveCurrentPageData = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPageData((prev) => ({ ...prev, [currentPage]: { image: canvas.toDataURL(), texts: textInputs } }));
  }, [currentPage, textInputs]);

  const loadPageData = useCallback((idx) => {
    const data = pageData[idx];
    const canvas = canvasRef.current, ctx = canvas.getContext("2d"), r = canvas.parentElement.getBoundingClientRect();
    if (data?.image) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, r.width, r.height); ctx.drawImage(img, 0, 0, r.width, r.height); };
      img.src = data.image;
      setTextInputs(data.texts || []);
    } else {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height); setTextInputs([]);
    }
  }, [pageData]);

  const switchPage = (idx) => {
    if (selection) commitSelection();
    saveCurrentPageData(); setCurrentPage(idx); setTimeout(() => loadPageData(idx), 50);
  };

  const addPage = () => {
    if (selection) commitSelection();
    saveCurrentPageData();
    setPages((p) => [...p, { id: Date.now(), name: `Page ${p.length + 1}` }]);
    setCurrentPage(pages.length);
    const c = canvasRef.current, ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height);
    setTextInputs([]); saveToHistory();
  };

  /* ─────────── Page Rename ─────────── */
  const startRename = (i) => {
    setRenamingPage(i);
    setRenameValue(pages[i].name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const finishRename = () => {
    if (renamingPage !== null && renameValue.trim()) {
      setPages((prev) => prev.map((p, i) => i === renamingPage ? { ...p, name: renameValue.trim() } : p));
    }
    setRenamingPage(null);
    setRenameValue("");
  };

  const exportCanvas = () => {
    const link = document.createElement("a");
    link.download = `note-page-${currentPage + 1}.png`;
    link.href = canvasRef.current.toDataURL(); link.click();
  };

  /* ─────────── Background ─────────── */
  useEffect(() => {
    if (!appReady) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d"), r = c.parentElement.getBoundingClientRect();
    if (showGrid || showRuled) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, r.width, r.height);
      if (showGrid) {
        ctx.save(); ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 0.5;
        for (let x = 0; x < r.width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, r.height); ctx.stroke(); }
        for (let y = 0; y < r.height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(r.width, y); ctx.stroke(); }
        ctx.restore();
      }
      if (showRuled) {
        ctx.save(); ctx.strokeStyle = "#c8d8e8"; ctx.lineWidth = 0.7;
        for (let y = 80; y < r.height; y += 32) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(r.width - 20, y); ctx.stroke(); }
        ctx.strokeStyle = "#f0a0a0"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(60, 40); ctx.lineTo(60, r.height - 20); ctx.stroke();
        ctx.restore();
      }
      saveToHistory();
    }
  }, [showGrid, showRuled, appReady]);

  /* ─────────── Keyboard shortcuts ─────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); manualSaveBackup(); }
      // Escape to deselect
      if (e.key === "Escape" && selection) {
        commitSelection();
      }
      // Delete selection
      if ((e.key === "Delete" || e.key === "Backspace") && selection && tool === TOOLS.SELECT) {
        // Just remove the selection without pasting it back
        if (selectionSnapshot.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          const r = canvas.parentElement.getBoundingClientRect();
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, r.width, r.height);
            ctx.drawImage(img, 0, 0, r.width, r.height);
            saveToHistory();
          };
          img.src = selectionSnapshot.current;
        }
        setSelection(null);
        selectionSnapshot.current = null;
        const ov = overlayCanvasRef.current;
        const r = ov.parentElement.getBoundingClientRect();
        ov.getContext("2d").clearRect(0, 0, r.width, r.height);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, manualSaveBackup, selection, tool, commitSelection, saveToHistory]);

  /* ─────────── UI ─────────── */
  const ToolButton = ({ toolType, icon, label }) => (
    <button onClick={() => setTool(toolType)} title={label} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
      padding: "8px 10px", borderRadius: "12px", border: "none",
      background: tool === toolType ? "#1a1a2e" : "transparent",
      color: tool === toolType ? "#fff" : "#5a5a6a",
      cursor: "pointer", fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px",
      transition: "all 0.2s ease", minWidth: "52px",
    }}>
      <span style={{ fontSize: "20px", lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  const statusMap = {
    idle: { bg: "#e8e6e3", color: "#999", text: "● Auto-saving" },
    saving: { bg: "#fff3bf", color: "#f59f00", text: "⟳ Saving..." },
    saved: { bg: "#d3f9d8", color: "#0f9960", text: "✓ Saved" },
    loaded: { bg: "#d0ebff", color: "#0066cc", text: "✓ Restored" },
  };
  const st = statusMap[saveStatus];

  const getCursor = () => {
    if (tool === TOOLS.TEXT) return "text";
    if (tool === TOOLS.ERASER) return "cell";
    if (tool === TOOLS.SELECT) {
      if (selection && isDraggingSelection) return "grabbing";
      if (selection) return "grab";
      return "crosshair";
    }
    return "crosshair";
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#f5f3f0",
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: "hidden", userSelect: "none",
    }}>
      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px", padding: "32px", maxWidth: "440px", width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📂</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#1a1a2e", fontWeight: 700 }}>Restore Your Notes</h2>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#666", lineHeight: 1.5 }}>
              Upload a previously saved backup file (.json) to continue where you left off.
            </p>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} style={{
              width: "100%", padding: "14px", borderRadius: "12px", border: "2px dashed #c0bfba",
              background: "#f8f7f5", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "#1a1a2e",
              marginBottom: "12px", transition: "all 0.2s",
            }}>📎 Choose Backup File</button>
            <button onClick={() => setShowUploadModal(false)} style={{
              width: "100%", padding: "12px", borderRadius: "12px", border: "none",
              background: "transparent", cursor: "pointer", fontSize: "13px", color: "#999",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Top Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "#ffffff", borderBottom: "1px solid #e8e6e3",
        zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "6px", borderRadius: "8px", color: "#3a3a4a",
          }}>☰</button>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e", letterSpacing: "-0.3px" }}>
            {pages[currentPage]?.name || "Untitled"}
          </div>
          <span style={{
            fontSize: "11px", fontWeight: 600, color: st.color, background: st.bg,
            padding: "3px 10px", borderRadius: "20px", transition: "all 0.3s ease",
          }}>{st.text}</span>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "2px", background: "#f8f7f5",
          borderRadius: "16px", padding: "4px 6px", border: "1px solid #e8e6e3",
        }}>
          <ToolButton toolType={TOOLS.SELECT} icon="⬚" label="Select" />
          <ToolButton toolType={TOOLS.PEN} icon="✒️" label="Pen" />
          <ToolButton toolType={TOOLS.HIGHLIGHTER} icon="🖍️" label="Highlight" />
          <ToolButton toolType={TOOLS.ERASER} icon="◻️" label="Eraser" />
          <ToolButton toolType={TOOLS.TEXT} icon="T" label="Text" />
          <div style={{ width: "1px", height: "28px", background: "#ddd", margin: "0 4px" }} />
          <ToolButton toolType={TOOLS.LINE} icon="╱" label="Line" />
          <ToolButton toolType={TOOLS.RECT} icon="▭" label="Rect" />
          <ToolButton toolType={TOOLS.CIRCLE} icon="◯" label="Circle" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={undo} title="Undo (⌘Z)" style={{
            background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "6px 8px",
            borderRadius: "8px", color: historyIndex > 0 ? "#3a3a4a" : "#ccc",
          }}>↩</button>
          <button onClick={redo} title="Redo (⌘⇧Z)" style={{
            background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "6px 8px",
            borderRadius: "8px", color: historyIndex < history.length - 1 ? "#3a3a4a" : "#ccc",
          }}>↪</button>
          <button onClick={clearCanvas} style={{
            background: "none", border: "none", fontSize: "13px", cursor: "pointer",
            padding: "6px 12px", borderRadius: "8px", color: "#c92a2a", fontWeight: 600,
          }}>Clear</button>
          <button onClick={exportCanvas} style={{
            background: "#f8f7f5", border: "1px solid #e0e0e0", fontSize: "13px", cursor: "pointer",
            padding: "8px 14px", borderRadius: "10px", color: "#3a3a4a", fontWeight: 600,
          }}>Export PNG</button>
          <button onClick={manualSaveBackup} title="Save Backup (⌘S)" style={{
            background: "#0f9960", border: "none", fontSize: "13px", cursor: "pointer",
            padding: "8px 14px", borderRadius: "10px", color: "#fff", fontWeight: 600,
          }}>💾 Save</button>
          <button onClick={() => setShowUploadModal(true)} style={{
            background: "#1a1a2e", border: "none", fontSize: "13px", cursor: "pointer",
            padding: "8px 14px", borderRadius: "10px", color: "#fff", fontWeight: 600,
          }}>📂 Restore</button>
        </div>
      </div>

      {/* Sub Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px", padding: "8px 16px",
        background: "#ffffff", borderBottom: "1px solid #e8e6e3", flexWrap: "wrap",
      }}>
        {/* Colors — hide for eraser and select */}
        {tool !== TOOLS.ERASER && tool !== TOOLS.SELECT && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#999", marginRight: "4px", letterSpacing: "0.5px" }}>COLOR</span>
            {COLORS.map((c) => (
              <button key={c.value} onClick={() => setColor(c.value)} title={c.name} style={{
                width: color === c.value ? "26px" : "22px", height: color === c.value ? "26px" : "22px",
                borderRadius: "50%", border: color === c.value ? "3px solid #1a1a2e" : "2px solid #e0e0e0",
                background: c.value, cursor: "pointer", transition: "all 0.15s ease",
                boxShadow: color === c.value ? "0 0 0 2px #fff, 0 2px 8px rgba(0,0,0,0.15)" : "none",
              }} />
            ))}
          </div>
        )}

        {/* Brush Size — for pen, highlighter, shapes */}
        {[TOOLS.PEN, TOOLS.HIGHLIGHTER, TOOLS.LINE, TOOLS.RECT, TOOLS.CIRCLE].includes(tool) && (
          <>
            <div style={{ width: "1px", height: "24px", background: "#e0e0e0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#999", marginRight: "4px", letterSpacing: "0.5px" }}>SIZE</span>
              {BRUSH_SIZES.map((s) => (
                <button key={s} onClick={() => setBrushSize(s)} style={{
                  width: "30px", height: "30px", borderRadius: "8px",
                  border: brushSize === s ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
                  background: brushSize === s ? "#f0eee8" : "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: Math.min(s * 1.5, 18) + "px", height: Math.min(s * 1.5, 18) + "px", borderRadius: "50%", background: color }} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Eraser Size */}
        {tool === TOOLS.ERASER && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#999", marginRight: "4px", letterSpacing: "0.5px" }}>ERASER SIZE</span>
            {ERASER_SIZES.map((s) => (
              <button key={s} onClick={() => setEraserSize(s)} style={{
                width: "34px", height: "34px", borderRadius: "8px",
                border: eraserSize === s ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
                background: eraserSize === s ? "#f0eee8" : "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: Math.min(s * 0.5, 22) + "px", height: Math.min(s * 0.5, 22) + "px",
                  borderRadius: "4px", background: "#e0e0e0", border: "1px solid #ccc",
                }} />
              </button>
            ))}
            <span style={{ fontSize: "11px", color: "#bbb", marginLeft: "4px" }}>{eraserSize}px</span>
          </div>
        )}

        {/* Font Size */}
        {tool === TOOLS.TEXT && (
          <>
            <div style={{ width: "1px", height: "24px", background: "#e0e0e0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#999", marginRight: "4px", letterSpacing: "0.5px" }}>FONT</span>
              {FONT_SIZES.map((s) => (
                <button key={s} onClick={() => setFontSize(s)} style={{
                  padding: "4px 8px", borderRadius: "6px",
                  border: fontSize === s ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
                  background: fontSize === s ? "#f0eee8" : "#fff", cursor: "pointer",
                  fontSize: "12px", fontWeight: 600, color: "#3a3a4a",
                }}>{s}</button>
              ))}
            </div>
          </>
        )}

        {/* Select tool hint */}
        {tool === TOOLS.SELECT && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "#666" }}>
              Draw to select · Drag to move · <b>Delete</b> to remove · <b>Esc</b> to confirm
            </span>
          </div>
        )}

        {/* Divider + BG toggles — always show */}
        <div style={{ width: "1px", height: "24px", background: "#e0e0e0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#999", marginRight: "4px", letterSpacing: "0.5px" }}>BG</span>
          <button onClick={() => { setShowGrid(!showGrid); setShowRuled(false); }} style={{
            padding: "5px 10px", borderRadius: "8px",
            border: showGrid ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
            background: showGrid ? "#f0eee8" : "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#3a3a4a",
          }}>Grid</button>
          <button onClick={() => { setShowRuled(!showRuled); setShowGrid(false); }} style={{
            padding: "5px 10px", borderRadius: "8px",
            border: showRuled ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
            background: showRuled ? "#f0eee8" : "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#3a3a4a",
          }}>Ruled</button>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {sidebarOpen && (
          <div style={{
            width: "220px", background: "#fff", borderRight: "1px solid #e8e6e3",
            padding: "16px", overflowY: "auto", zIndex: 50,
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#999", letterSpacing: "1px", marginBottom: "12px" }}>PAGES</div>
            {pages.map((page, i) => (
              <div key={page.id} style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                {renamingPage === i ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") { setRenamingPage(null); setRenameValue(""); } }}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: "8px",
                      border: "2px solid #4dabf7", outline: "none",
                      fontSize: "14px", fontWeight: 600, color: "#1a1a2e",
                      background: "#f0f8ff",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => switchPage(i)}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(i); }}
                    style={{
                      flex: 1, textAlign: "left", padding: "10px 12px",
                      borderRadius: "10px", border: "none",
                      background: currentPage === i ? "#f0eee8" : "transparent", cursor: "pointer",
                      fontSize: "14px", fontWeight: currentPage === i ? 700 : 500,
                      color: currentPage === i ? "#1a1a2e" : "#5a5a6a",
                    }}
                  >
                    {page.name}
                  </button>
                )}
                {renamingPage !== i && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(i); }}
                    title="Rename page"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "12px", color: "#bbb", padding: "4px 6px", borderRadius: "6px",
                      opacity: currentPage === i ? 1 : 0.5,
                    }}
                  >✏️</button>
                )}
              </div>
            ))}
            <button onClick={addPage} style={{
              display: "block", width: "100%", textAlign: "center", padding: "10px", marginTop: "8px",
              borderRadius: "10px", border: "2px dashed #d0cec8", background: "transparent",
              cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#888",
            }}>+ New Page</button>

            <div style={{ marginTop: "16px", padding: "10px", background: "#f8f7f5", borderRadius: "8px", fontSize: "11px", color: "#999", lineHeight: 1.5 }}>
              💡 Double-click a page name to rename it
            </div>
          </div>
        )}

        <div ref={containerRef} style={{
          flex: 1, position: "relative", overflow: "hidden",
          cursor: getCursor(),
        }}>
          <canvas ref={canvasRef}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
            style={{ position: "absolute", top: 0, left: 0, touchAction: "none", msTouchAction: "none" }}
          />
          <canvas ref={overlayCanvasRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", touchAction: "none" }} />
          {textInputs.map((input) => (
            <textarea key={input.id} autoFocus={editingText === input.id} value={input.text}
              onChange={(e) => setTextInputs((p) => p.map((t) => t.id === input.id ? { ...t, text: e.target.value } : t))}
              onBlur={() => handleTextBlur(input.id)}
              onKeyDown={(e) => { if (e.key === "Escape") e.target.blur(); }}
              style={{
                position: "absolute", left: input.x + "px", top: input.y + "px",
                fontSize: input.fontSize + "px", color: input.color,
                fontFamily: '"SF Pro Display", -apple-system, sans-serif',
                background: "rgba(255,255,255,0.85)", border: "2px solid #4dabf7",
                borderRadius: "6px", outline: "none", padding: "4px 6px",
                minWidth: "100px", minHeight: input.fontSize * 1.5 + "px",
                resize: "both", lineHeight: 1.3, zIndex: 20,
              }}
            />
          ))}
          {isDrawing && (tool === TOOLS.PEN || tool === TOOLS.HIGHLIGHTER) && (
            <div style={{
              position: "absolute", bottom: "12px", right: "12px", background: "rgba(26,26,46,0.8)",
              color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "11px",
              fontWeight: 600, pointerEvents: "none", zIndex: 30,
            }}>Pressure: {(pressure * 100).toFixed(0)}%</div>
          )}
        </div>
      </div>

      {/* Bottom Status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 16px", background: "#fff", borderTop: "1px solid #e8e6e3",
        fontSize: "11px", color: "#999", fontWeight: 500,
      }}>
        <span>Page {currentPage + 1} of {pages.length} · Palm rejection ON</span>
        <span style={{ color: "#bbb" }}>
          {tool === TOOLS.PEN && "✒️ Pen — pressure sensitive"}
          {tool === TOOLS.HIGHLIGHTER && "🖍️ Highlighter"}
          {tool === TOOLS.ERASER && `◻️ Eraser — ${eraserSize}px`}
          {tool === TOOLS.TEXT && "T Text — click to place"}
          {tool === TOOLS.SELECT && (selection ? "⬚ Select — drag to move, Del to delete" : "⬚ Select — drag to select area")}
          {tool === TOOLS.LINE && "╱ Line — drag"}
          {tool === TOOLS.RECT && "▭ Rectangle — drag"}
          {tool === TOOLS.CIRCLE && "◯ Ellipse — drag"}
        </span>
        <span>⌘Z Undo · ⌘⇧Z Redo · ⌘S Save</span>
      </div>
    </div>
  );
}