import { useState, useRef, useCallback, useEffect } from "react";

/* ══════════════ IndexedDB ══════════════ */
const DB_NAME="InkNotes_DB",DB_VERSION=1,STORE="notes_store";
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=(e)=>{if(!e.target.result.objectStoreNames.contains(STORE))e.target.result.createObjectStore(STORE);};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbSet(k,v){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function idbGet(k){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readonly");const r=tx.objectStore(STORE).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}

/* ══════════════ Themes ══════════════ */
const themes={
  light:{bg:"#eae7e0",surface:"#fffcf7",surfaceHover:"#f3efe7",surfaceActive:"#e9e3d8",border:"#ddd7cc",text:"#2c2418",textSecondary:"#7a7062",textMuted:"#a89e90",accent:"#c06830",accentSoft:"#fdf3ec",accentGrad:"linear-gradient(135deg,#d88040,#c06830)",danger:"#b83030",success:"#2f855a",toolbar:"rgba(255,252,247,0.92)",toolbarBorder:"rgba(44,36,24,0.07)",shadow:"0 2px 20px rgba(44,36,24,0.07),0 0 1px rgba(44,36,24,0.1)",shadowLg:"0 12px 44px rgba(44,36,24,0.12)",glow:"0 0 16px rgba(192,104,48,0.25)",pageShadow:"0 1px 4px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.03)"},
  dark:{bg:"#0e0c0a",surface:"#1e1a16",surfaceHover:"#2a2520",surfaceActive:"#3a342e",border:"#302a24",text:"#f0ece4",textSecondary:"#a89e90",textMuted:"#6e645a",accent:"#e08a42",accentSoft:"#2a1e10",accentGrad:"linear-gradient(135deg,#e89848,#d07830)",danger:"#e55050",success:"#48bb78",toolbar:"rgba(30,26,22,0.95)",toolbarBorder:"rgba(255,255,255,0.04)",shadow:"0 2px 20px rgba(0,0,0,0.35),0 0 1px rgba(0,0,0,0.4)",shadowLg:"0 12px 44px rgba(0,0,0,0.45)",glow:"0 0 20px rgba(224,138,66,0.3)",pageShadow:"0 1px 4px rgba(0,0,0,0.5),0 4px 20px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.04)"},
};

/* ══════════════ Constants ══════════════ */
const COLORS=["#2c2418","#8a7e70","#c06830","#2878a8","#2e7d50","#6d9b30","#d97820","#c04080","#b83030","#7040c0","#c89028","#6e3810"];
const BRUSH_SIZES=[1,2,4,6,10,16,24],ERASER_SIZES=[8,16,24,36,48,64],FONT_SIZES=[14,18,24,32,48,64];
const invertHex=(hex)=>{if(!hex||hex[0]!=="#")return hex;const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`#${(255-r).toString(16).padStart(2,"0")}${(255-g).toString(16).padStart(2,"0")}${(255-b).toString(16).padStart(2,"0")}`;};
const T={PEN:"pen",HIGHLIGHTER:"highlighter",ERASER:"eraser",TEXT:"text",SELECT:"select",LINE:"line",ARROW:"arrow",RECT:"rect",DIAMOND:"diamond",CIRCLE:"circle",HAND:"hand"};
const INACTIVITY_TIMEOUT=1800000;
/* Page canvas: fixed internal resolution, displayed at responsive width */
const PW=2000,PH=2600,PAGE_PAD=32,PAGE_GAP=40,AUTO_ZONE=300;

/* ══════════════ Icons ══════════════ */
const I={
  hand:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7.5 21h9a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"/></svg>,
  select:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 3l14 9-6 1-3 6z"/></svg>,
  pen:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  highlighter:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>,
  eraser:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
  text:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>,
  line:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20L20 4"/></svg>,
  arrow:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 19L19 5M19 5v10M19 5H9"/></svg>,
  rect:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  diamond:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2l10 10-10 10L2 12z"/></svg>,
  circle:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>,
  sun:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  undo:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  redo:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>,
  save:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  menu:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="17" x2="12" y2="17"/></svg>,
  plus:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  image:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  zoomIn:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  trash:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  mail:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  send:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  grid:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  ruled:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  home:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
};

/* ══════════════ App ══════════════ */
export default function NoteApp({onHome}) {
  /* ═══ Multi-canvas refs ═══ */
  const cMap=useRef(new Map()),oMap=useRef(new Map()); /* pageId → canvas/overlay */
  const canvasRef=useRef(null),overlayRef=useRef(null); /* → active page */
  const scrollRef=useRef(null),eraserCursorRef=useRef(null);

  /* ═══ State ═══ */
  const [dark,setDark]=useState(false),[isDrawing,setIsDrawing]=useState(false),[tool,setTool]=useState(T.PEN);
  const [color,setColor]=useState(COLORS[0]),[brushSize,setBrushSize]=useState(4),[eraserSize,setEraserSize]=useState(24),[fontSize,setFontSize]=useState(24);
  const [history,setHistory]=useState([]),[historyIndex,setHistoryIndex]=useState(-1);
  const [pages,setPages]=useState([{id:1,name:"Page 1"}]),[currentPage,setCurrentPage]=useState(0),[pageData,setPageData]=useState({});
  const [showGrid,setShowGrid]=useState(false),[showRuled,setShowRuled]=useState(false);
  const [textInputs,setTextInputs]=useState([]),[editingText,setEditingText]=useState(null);
  const [shapeStart,setShapeStart]=useState(null),[sidebarOpen,setSidebarOpen]=useState(false),[pressure,setPressure]=useState(1);
  const [saveStatus,setSaveStatus]=useState("idle"),[showUploadModal,setShowUploadModal]=useState(false);
  const [showEmailModal,setShowEmailModal]=useState(false),[emailTo,setEmailTo]=useState(""),[emailSubject,setEmailSubject]=useState("");
  const [emailSending,setEmailSending]=useState(false),[emailPreview,setEmailPreview]=useState(""),[appReady,setAppReady]=useState(false);
  const [renamingPage,setRenamingPage]=useState(null),[renameValue,setRenameValue]=useState("");
  const [selection,setSelection]=useState(null),[isDraggingSel,setIsDraggingSel]=useState(false),[selStart,setSelStart]=useState(null);
  const selSnap=useRef(null);
  const [zoom,setZoom]=useState(1),[baseW,setBaseW]=useState(800),[hoveredTool,setHoveredTool]=useState(null);
  const [winW,setWinW]=useState(typeof window!=="undefined"?window.innerWidth:1200);

  const isPanning=useRef(false),panStart=useRef({x:0,y:0}),spaceHeld=useRef(false);
  const lastPoint=useRef(null),pathPts=useRef([]),inactTimer=useRef(null),lastBackup=useRef(null);
  const fileRef=useRef(null),renameRef=useRef(null),penDet=useRef(false),penTO=useRef(null);
  const pdRef=useRef(pageData),pgRef=useRef(pages),cpRef=useRef(currentPage),tiRef=useRef(textInputs);
  const sgRef=useRef(showGrid),srRef=useRef(showRuled),zoomRef=useRef(1);

  useEffect(()=>{pdRef.current=pageData},[pageData]);
  useEffect(()=>{pgRef.current=pages},[pages]);
  useEffect(()=>{cpRef.current=currentPage},[currentPage]);
  useEffect(()=>{tiRef.current=textInputs},[textInputs]);
  useEffect(()=>{sgRef.current=showGrid},[showGrid]);
  useEffect(()=>{srRef.current=showRuled},[showRuled]);
  useEffect(()=>{zoomRef.current=zoom},[zoom]);

  /* Responsive width */
  useEffect(()=>{
    const up=()=>{setWinW(window.innerWidth);const el=scrollRef.current;if(el)setBaseW(Math.min(el.clientWidth-PAGE_PAD*2,1400));};
    up();window.addEventListener("resize",up);return()=>window.removeEventListener("resize",up);
  },[]);
  useEffect(()=>{const el=scrollRef.current;if(el)setBaseW(Math.min(el.clientWidth-PAGE_PAD*2,1400));},[sidebarOpen]);
  const compact=winW<768,tiny=winW<500;
  const th=dark?themes.dark:themes.light;
  const dW=baseW*zoom,dH=baseW*PH/PW*zoom; /* display page dimensions */
  const s2c=useCallback((rect)=>({sx:PW/rect.width,sy:PH/rect.height}),[]);

  /* Sync active canvas refs */
  useEffect(()=>{const pid=pages[currentPage]?.id;if(pid){canvasRef.current=cMap.current.get(pid);overlayRef.current=oMap.current.get(pid);}},[currentPage,pages]);

  /* Eraser cursor */
  useEffect(()=>{const hm=(e)=>{const el=eraserCursorRef.current;if(el){el.style.left=e.clientX+"px";el.style.top=e.clientY+"px";}};if(tool===T.ERASER){window.addEventListener("pointermove",hm);return()=>window.removeEventListener("pointermove",hm);}},[tool]);

  /* ═══ Canvas init via callback refs ═══ */
  const initC=useCallback((el,pid)=>{
    if(!el||cMap.current.get(pid)===el)return;cMap.current.set(pid,el);
    const dpr=Math.min(window.devicePixelRatio||1,2);el.width=PW*dpr;el.height=PH*dpr;
    const ctx=el.getContext("2d");ctx.scale(dpr,dpr);ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);
    const idx=pgRef.current.findIndex(p=>p.id===pid);const saved=pdRef.current[idx];
    if(saved?.image){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,PW,PH);img.src=saved.image;}
  },[]);
  const initO=useCallback((el,pid)=>{
    if(!el||oMap.current.get(pid)===el)return;oMap.current.set(pid,el);
    const dpr=Math.min(window.devicePixelRatio||1,2);el.width=PW*dpr;el.height=PH*dpr;el.getContext("2d").scale(dpr,dpr);
  },[]);

  /* ═══ Coordinates ═══ */
  const getPageAtPt=(e)=>{for(let i=0;i<pages.length;i++){const c=cMap.current.get(pages[i].id);if(!c)continue;const r=c.getBoundingClientRect();if(e.clientY>=r.top&&e.clientY<=r.bottom&&e.clientX>=r.left&&e.clientX<=r.right)return i;}return-1;};
  const getPos=(e)=>{const c=canvasRef.current;if(!c)return{x:0,y:0,pressure:.5};const r=c.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH,pressure:e.pressure??.5};};
  const isPalm=(e)=>{if(e.pointerType==="pen"){penDet.current=true;if(penTO.current)clearTimeout(penTO.current);penTO.current=setTimeout(()=>{penDet.current=false;},500);return false;}if(e.pointerType==="touch"&&penDet.current)return true;if(e.pointerType==="touch"&&(e.width>30||e.height>30))return true;return false;};
  const shouldPan=()=>tool===T.HAND||spaceHeld.current;

  /* ═══ Drawing helpers ═══ */
  const drawSeg=(ctx,a,b,col,sz,pv=1)=>{ctx.strokeStyle=col;ctx.lineWidth=sz*Math.max(.3,pv);ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
  const drawPath=(ctx,pts,col,sz)=>{if(pts.length<2)return;ctx.strokeStyle=col;ctx.lineWidth=sz;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length-1;i++){ctx.quadraticCurveTo(pts[i].x,pts[i].y,(pts[i].x+pts[i+1].x)/2,(pts[i].y+pts[i+1].y)/2);}ctx.lineTo(pts[pts.length-1].x,pts[pts.length-1].y);ctx.stroke();};
  const drawArrow=(ctx,fx,fy,tx,ty,col,sz)=>{ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=sz;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(tx,ty);ctx.stroke();const a=Math.atan2(ty-fy,tx-fx),hl=14+sz*2;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-hl*Math.cos(a-.4),ty-hl*Math.sin(a-.4));ctx.lineTo(tx-hl*Math.cos(a+.4),ty-hl*Math.sin(a+.4));ctx.closePath();ctx.fill();};
  const drawDiamond=(ctx,x,y,w,h,col,sz)=>{const cx=x+w/2,cy=y+h/2,hw=Math.abs(w)/2,hh=Math.abs(h)/2;ctx.strokeStyle=col;ctx.lineWidth=sz;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(cx,cy-hh);ctx.lineTo(cx+hw,cy);ctx.lineTo(cx,cy+hh);ctx.lineTo(cx-hw,cy);ctx.closePath();ctx.stroke();};

  /* ═══ History ═══ */
  const saveHist=useCallback(()=>{const c=canvasRef.current;if(!c)return;const d=c.toDataURL();setHistory(p=>{const h=p.slice(0,historyIndex+1);h.push(d);return h.length>50?h.slice(-50):h;});setHistoryIndex(p=>Math.min(p+1,49));},[historyIndex]);
  const restoreImg=(src)=>{const img=new Image();img.onload=()=>{const c=canvasRef.current,ctx=c.getContext("2d");ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);};img.src=src;};
  const undo=useCallback(()=>{if(historyIndex<=0)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex-1]);setHistoryIndex(i=>i-1);},[history,historyIndex]);
  const redo=useCallback(()=>{if(historyIndex>=history.length-1)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex+1]);setHistoryIndex(i=>i+1);},[history,historyIndex]);

  /* Selection */
  const commitSel=useCallback(()=>{if(!selection?.imageData)return;const c=canvasRef.current,ctx=c.getContext("2d");const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x,selection.y,selection.w,selection.h);setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);saveHist();},[selection,saveHist]);
  const inSel=(p)=>selection&&p.x>=selection.x&&p.x<=selection.x+selection.w&&p.y>=selection.y&&p.y<=selection.y+selection.h;

  /* Text */
  const commitText=(inp)=>{if(!inp.text.trim())return;const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.font=`${inp.fontSize}px "Literata",Georgia,serif`;ctx.fillStyle=inp.color;ctx.textBaseline="top";inp.text.split("\n").forEach((l,i)=>ctx.fillText(l,inp.x,inp.y+i*inp.fontSize*1.3));ctx.restore();saveHist();};
  const textBlur=(id)=>{const inp=textInputs.find(t=>t.id===id);if(inp){commitText(inp);setTextInputs(p=>p.filter(t=>t.id!==id));}setEditingText(null);};

  /* ═══ Switch active page ═══ */
  const activatePage=useCallback((idx)=>{
    if(idx===currentPage||idx<0||idx>=pages.length)return;
    /* Save current page data */
    const c=canvasRef.current;if(c)setPageData(p=>({...p,[currentPage]:{image:c.toDataURL(),texts:textInputs}}));
    setCurrentPage(idx);
    const pid=pages[idx].id;canvasRef.current=cMap.current.get(pid);overlayRef.current=oMap.current.get(pid);
    setTextInputs(pdRef.current[idx]?.texts||[]);setHistory([]);setHistoryIndex(-1);setSelection(null);selSnap.current=null;
  },[currentPage,pages,textInputs]);

  /* ═══ POINTER HANDLERS ═══ */
  const handleDown=(e)=>{e.preventDefault();if(isPalm(e))return;
    if(shouldPan()){isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY};return;}
    const pi=getPageAtPt(e);if(pi===-1)return;
    if(pi!==currentPage)activatePage(pi);
    /* Small delay for ref update */
    const c=cMap.current.get(pages[pi].id);const o=oMap.current.get(pages[pi].id);
    canvasRef.current=c;overlayRef.current=o;
    const pos=getPos(e);setPressure(pos.pressure||.5);
    if(tool===T.SELECT){if(selection&&inSel(pos)){setIsDraggingSel(true);lastPoint.current=pos;return;}if(selection)commitSel();setSelStart(pos);setIsDrawing(true);return;}
    if(selection)commitSel();
    if(tool===T.TEXT){setTextInputs(p=>[...p,{id:Date.now(),x:pos.x,y:pos.y,text:"",color,fontSize}]);setEditingText(Date.now());return;}
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)){setShapeStart(pos);setIsDrawing(true);return;}
    setIsDrawing(true);lastPoint.current=pos;pathPts.current=[pos];
    if(tool===T.ERASER){const ctx=c.getContext("2d");ctx.save();ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(pos.x,pos.y,eraserSize,0,Math.PI*2);ctx.fill();ctx.restore();}
  };

  const handleMove=(e)=>{e.preventDefault();if(isPalm(e))return;
    if(isPanning.current&&shouldPan()){const el=scrollRef.current;el.scrollLeft-=(e.clientX-panStart.current.x);el.scrollTop-=(e.clientY-panStart.current.y);panStart.current={x:e.clientX,y:e.clientY};return;}
    const pos=getPos(e);
    /* Auto-create page when near bottom of last page */
    if(isDrawing&&currentPage===pages.length-1&&pos.y>PH-AUTO_ZONE&&![T.SELECT,T.HAND].includes(tool)){
      setPages(p=>[...p,{id:Date.now(),name:`Page ${p.length+1}`}]);
      setTimeout(()=>scrollRef.current?.scrollBy({top:200,behavior:"smooth"}),150);
    }
    if(tool===T.SELECT&&isDraggingSel&&selection){const dx=pos.x-lastPoint.current.x,dy=pos.y-lastPoint.current.y;setSelection(p=>({...p,x:p.x+dx,y:p.y+dy}));if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d");const img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x+dx,selection.y+dy,selection.w,selection.h);};img.src=selSnap.current;}lastPoint.current=pos;const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.strokeRect(selection.x+dx,selection.y+dy,selection.w,selection.h);octx.restore();return;}
    if(tool===T.SELECT&&isDrawing&&selStart){const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.fillStyle="rgba(192,104,48,0.06)";const x=Math.min(selStart.x,pos.x),y=Math.min(selStart.y,pos.y),w=Math.abs(pos.x-selStart.x),h=Math.abs(pos.y-selStart.y);octx.fillRect(x,y,w,h);octx.strokeRect(x,y,w,h);octx.restore();return;}
    if(!isDrawing)return;const pv=pos.pressure||pressure;setPressure(pv);
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart){const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();if(tool===T.LINE){octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.moveTo(shapeStart.x,shapeStart.y);octx.lineTo(pos.x,pos.y);octx.stroke();}else if(tool===T.ARROW)drawArrow(octx,shapeStart.x,shapeStart.y,pos.x,pos.y,color,brushSize);else if(tool===T.RECT){octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.strokeRect(shapeStart.x,shapeStart.y,pos.x-shapeStart.x,pos.y-shapeStart.y);}else if(tool===T.DIAMOND)drawDiamond(octx,shapeStart.x,shapeStart.y,pos.x-shapeStart.x,pos.y-shapeStart.y,color,brushSize);else if(tool===T.CIRCLE){const rx=Math.abs(pos.x-shapeStart.x)/2,ry=Math.abs(pos.y-shapeStart.y)/2;octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.ellipse(shapeStart.x+(pos.x-shapeStart.x)/2,shapeStart.y+(pos.y-shapeStart.y)/2,rx,ry,0,0,Math.PI*2);octx.stroke();}octx.restore();return;}
    if(tool===T.ERASER){const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.fillStyle="#ffffff";const dx=pos.x-lastPoint.current.x,dy=pos.y-lastPoint.current.y,d=Math.sqrt(dx*dx+dy*dy),st=Math.max(1,Math.floor(d/2));for(let i=0;i<=st;i++){const t=i/st;ctx.beginPath();ctx.arc(lastPoint.current.x+dx*t,lastPoint.current.y+dy*t,eraserSize,0,Math.PI*2);ctx.fill();}ctx.restore();}
    else if(tool===T.PEN){const ctx=canvasRef.current.getContext("2d");ctx.save();drawSeg(ctx,lastPoint.current,pos,color,brushSize,pv);ctx.restore();pathPts.current.push(pos);}
    else if(tool===T.HIGHLIGHTER){pathPts.current.push(pos);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.globalAlpha=.3;drawPath(octx,pathPts.current,color,brushSize*3);octx.restore();}
    lastPoint.current=pos;
  };

  const handleUp=(e)=>{
    if(isPanning.current){isPanning.current=false;return;}
    if(tool===T.SELECT&&isDraggingSel){setIsDraggingSel(false);lastPoint.current=null;return;}
    if(tool===T.SELECT&&isDrawing&&selStart){const pos=getPos(e),x=Math.min(selStart.x,pos.x),y=Math.min(selStart.y,pos.y),w=Math.abs(pos.x-selStart.x),h=Math.abs(pos.y-selStart.y);if(w>5&&h>5){const c=canvasRef.current,ctx=c.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2);const id=ctx.getImageData(x*dpr,y*dpr,w*dpr,h*dpr);selSnap.current=c.toDataURL();ctx.fillStyle="#ffffff";ctx.fillRect(x,y,w,h);selSnap.current=c.toDataURL();setSelection({x,y,w,h,imageData:id});const tc=document.createElement("canvas");tc.width=id.width;tc.height=id.height;tc.getContext("2d").putImageData(id,0,0);ctx.drawImage(tc,x,y,w,h);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.strokeRect(x,y,w,h);octx.restore();}else overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);setSelStart(null);setIsDrawing(false);return;}
    if(!isDrawing)return;
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart){const pos=getPos(e),ctx=canvasRef.current.getContext("2d");overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);ctx.save();if(tool===T.LINE){ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(shapeStart.x,shapeStart.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();}else if(tool===T.ARROW)drawArrow(ctx,shapeStart.x,shapeStart.y,pos.x,pos.y,color,brushSize);else if(tool===T.RECT){ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.strokeRect(shapeStart.x,shapeStart.y,pos.x-shapeStart.x,pos.y-shapeStart.y);}else if(tool===T.DIAMOND)drawDiamond(ctx,shapeStart.x,shapeStart.y,pos.x-shapeStart.x,pos.y-shapeStart.y,color,brushSize);else if(tool===T.CIRCLE){const rx=Math.abs(pos.x-shapeStart.x)/2,ry=Math.abs(pos.y-shapeStart.y)/2;ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.beginPath();ctx.ellipse(shapeStart.x+(pos.x-shapeStart.x)/2,shapeStart.y+(pos.y-shapeStart.y)/2,rx,ry,0,0,Math.PI*2);ctx.stroke();}ctx.restore();setShapeStart(null);}
    if(tool===T.HIGHLIGHTER&&pathPts.current.length>1){const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.globalAlpha=.3;drawPath(ctx,pathPts.current,color,brushSize*3);ctx.restore();overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);}
    setIsDrawing(false);lastPoint.current=null;pathPts.current=[];saveHist();
  };

  /* Zoom: Ctrl+Wheel */
  useEffect(()=>{const el=scrollRef.current;if(!el)return;const h=(e)=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=el.getBoundingClientRect();const mx=e.clientX-r.left+el.scrollLeft,my=e.clientY-r.top+el.scrollTop;const oz=zoomRef.current,nz=Math.max(.3,Math.min(5,oz*(e.deltaY>0?.94:1/.94)));setZoom(nz);zoomRef.current=nz;requestAnimationFrame(()=>{el.scrollLeft=mx*(nz/oz)-(e.clientX-r.left);el.scrollTop=my*(nz/oz)-(e.clientY-r.top);});}};el.addEventListener("wheel",h,{passive:false});return()=>el.removeEventListener("wheel",h);},[]);
  useEffect(()=>{if(tool!==T.SELECT&&selection)commitSel();},[tool]);

  /* ═══ Persistence ═══ */
  const collectState=useCallback(()=>{const pd={};pgRef.current.forEach((pg,i)=>{const c=cMap.current.get(pg.id);if(c)pd[i]={image:c.toDataURL(),texts:i===cpRef.current?tiRef.current:(pdRef.current[i]?.texts||[])};});return{version:5,pages:pgRef.current,currentPage:cpRef.current,pageData:pd,settings:{showGrid:sgRef.current,showRuled:srRef.current,dark}};},[dark]);
  const saveIDB=useCallback(async()=>{try{await idbSet("app_state",collectState());setSaveStatus("saved");setTimeout(()=>setSaveStatus("idle"),1500);}catch(e){console.error(e);}},[collectState]);
  const dlBackup=useCallback(()=>{try{const s=collectState();if(lastBackup.current&&Date.now()-lastBackup.current<10000)return;lastBackup.current=Date.now();const b=new Blob([JSON.stringify(s)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`ink-notes-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}catch(e){console.error(e);}},[collectState]);
  const manualSave=useCallback(()=>{lastBackup.current=null;dlBackup();},[dlBackup]);
  const restoreState=useCallback((s)=>{if(!s?.pages)return;setPages(s.pages);setCurrentPage(s.currentPage||0);setPageData(s.pageData||{});pdRef.current=s.pageData||{};if(s.settings){setShowGrid(s.settings.showGrid||false);setShowRuled(s.settings.showRuled||false);if(s.settings.dark!==undefined)setDark(s.settings.dark);}/* Canvases restore via initC callback refs reading pdRef */},[]);
  const handleUpload=useCallback((e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{const s=JSON.parse(ev.target.result);/* Force re-mount canvases by clearing maps */cMap.current.clear();oMap.current.clear();restoreState(s);idbSet("app_state",s);setShowUploadModal(false);}catch{alert("Invalid backup.");}};r.readAsText(f);},[restoreState]);

  /* Lifecycle */
  useEffect(()=>{(async()=>{try{const s=await idbGet("app_state");if(s?.pages){pdRef.current=s.pageData||{};restoreState(s);}}catch{}setAppReady(true);})();},[]);
  useEffect(()=>{if(!appReady)return;const i=setInterval(()=>saveIDB(),5000);return()=>clearInterval(i);},[appReady,saveIDB]);
  const resetInact=useCallback(()=>{if(inactTimer.current)clearTimeout(inactTimer.current);inactTimer.current=setTimeout(()=>{saveIDB();dlBackup();},INACTIVITY_TIMEOUT);},[saveIDB,dlBackup]);
  useEffect(()=>{const ev=["pointerdown","pointermove","keydown"];ev.forEach(e=>window.addEventListener(e,resetInact));resetInact();return()=>{ev.forEach(e=>window.removeEventListener(e,resetInact));};},[resetInact]);
  useEffect(()=>{const bu=()=>{try{const s=collectState();const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>r.result.transaction(STORE,"readwrite").objectStore(STORE).put(s,"app_state");}catch{}};const vis=()=>{if(document.visibilityState==="hidden")saveIDB();};window.addEventListener("beforeunload",bu);document.addEventListener("visibilitychange",vis);return()=>{window.removeEventListener("beforeunload",bu);document.removeEventListener("visibilitychange",vis);};},[collectState,saveIDB]);

  const clearCanvas=()=>{const ctx=canvasRef.current?.getContext("2d");if(!ctx)return;ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);setTextInputs([]);setSelection(null);selSnap.current=null;saveHist();};
  const savePD=useCallback(()=>{const c=canvasRef.current;if(!c)return;const pd={...pdRef.current,[currentPage]:{image:c.toDataURL(),texts:textInputs}};pdRef.current=pd;setPageData(pd);},[currentPage,textInputs]);
  const switchPg=(i)=>{if(selection)commitSel();activatePage(i);const c=cMap.current.get(pages[i]?.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});};
  const addPg=()=>{savePD();const np={id:Date.now(),name:`Page ${pages.length+1}`};setPages(p=>[...p,np]);setTimeout(()=>{const c=cMap.current.get(np.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});},200);};
  const startRename=(i)=>{setRenamingPage(i);setRenameValue(pages[i].name);setTimeout(()=>renameRef.current?.focus(),50);};
  const finishRename=()=>{if(renamingPage!==null&&renameValue.trim())setPages(p=>p.map((pg,i)=>i===renamingPage?{...pg,name:renameValue.trim()}:pg));setRenamingPage(null);};

  /* Export */
  const getExportDataUrl=()=>{const c=canvasRef.current;if(!c)return"";if(!dark)return c.toDataURL();const tc=document.createElement("canvas");tc.width=c.width;tc.height=c.height;const tctx=tc.getContext("2d");tctx.filter="invert(1) hue-rotate(180deg)";tctx.drawImage(c,0,0);return tc.toDataURL();};
  const exportPng=()=>{const a=document.createElement("a");a.download=`note-page-${currentPage+1}.png`;a.href=getExportDataUrl();a.click();};
  const openEmailModal=()=>{setEmailSubject(`Ink Notes — ${pages[currentPage]?.name||"Page "+(currentPage+1)}`);setEmailTo("");setEmailPreview(getExportDataUrl());setShowEmailModal(true);};
  const sendEmail=async()=>{if(!emailTo.includes("@"))return;setEmailSending(true);try{const d=getExportDataUrl();if(navigator.share&&navigator.canShare){const bl=await(await fetch(d)).blob();const f=new File([bl],"note.png",{type:"image/png"});if(navigator.canShare({files:[f]})){try{await navigator.share({title:emailSubject,files:[f]});setShowEmailModal(false);setEmailSending(false);return;}catch{}}}const bl=await(await fetch(d)).blob();const u=URL.createObjectURL(bl);const a=document.createElement("a");a.href=u;a.download="note.png";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);window.open(`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}`,"_self");setShowEmailModal(false);}catch{}setEmailSending(false);};

  /* Grid/ruled for active page */
  useEffect(()=>{if(!appReady)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(showGrid||showRuled){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);if(showGrid){ctx.save();ctx.strokeStyle="#e0ddd6";ctx.lineWidth=.5;for(let x=0;x<PW;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,PH);ctx.stroke();}for(let y=0;y<PH;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(PW,y);ctx.stroke();}ctx.restore();}if(showRuled){ctx.save();ctx.strokeStyle="#c8d0d8";ctx.lineWidth=.7;for(let y=80;y<PH;y+=32){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(PW-20,y);ctx.stroke();}ctx.strokeStyle="#d8a0a0";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,40);ctx.lineTo(60,PH-20);ctx.stroke();ctx.restore();}saveHist();}},[showGrid,showRuled,appReady]);

  /* Shortcuts */
  useEffect(()=>{const hd=(e)=>{const inInput=document.activeElement.tagName==="INPUT"||document.activeElement.tagName==="TEXTAREA";if(e.key===" "&&!inInput){e.preventDefault();spaceHeld.current=true;}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&e.shiftKey){e.preventDefault();redo();}if((e.metaKey||e.ctrlKey)&&e.key==="s"){e.preventDefault();manualSave();}if(e.key==="Escape"&&selection)commitSel();if((e.key==="Delete"||e.key==="Backspace")&&selection&&tool===T.SELECT){if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d"),img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);saveHist();};img.src=selSnap.current;}setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);}if(!e.metaKey&&!e.ctrlKey&&!inInput){const km={h:T.HAND,v:T.SELECT,p:T.PEN,e:T.ERASER,t:T.TEXT,r:T.RECT,o:T.CIRCLE,l:T.LINE,a:T.ARROW,d:T.DIAMOND};if(km[e.key.toLowerCase()]&&e.key!==" ")setTool(km[e.key.toLowerCase()]);}};const hu=(e)=>{if(e.key===" "){spaceHeld.current=false;isPanning.current=false;}};window.addEventListener("keydown",hd);window.addEventListener("keyup",hu);return()=>{window.removeEventListener("keydown",hd);window.removeEventListener("keyup",hu);};},[undo,redo,manualSave,selection,tool,commitSel,saveHist]);

  const getCursor=()=>{if(shouldPan())return isPanning.current?"grabbing":"grab";if(tool===T.TEXT)return"text";if(tool===T.ERASER)return"none";if(tool===T.SELECT)return selection?(isDraggingSel?"grabbing":"default"):"crosshair";return"crosshair";};
  const stMap={idle:{c:th.textMuted,t:"Saved"},saved:{c:th.success,t:"✓ Saved"},loaded:{c:th.accent,t:"Restored"}};const stI=stMap[saveStatus]||stMap.idle;
  const toolDock=[{id:T.HAND,icon:I.hand,tip:"Hand (H)"},{id:T.SELECT,icon:I.select,tip:"Select (V)"},"sep",{id:T.PEN,icon:I.pen,tip:"Pen (P)"},{id:T.HIGHLIGHTER,icon:I.highlighter,tip:"Highlight"},{id:T.ERASER,icon:I.eraser,tip:"Eraser (E)"},{id:T.TEXT,icon:I.text,tip:"Text (T)"},"sep",{id:T.LINE,icon:I.line,tip:"Line (L)"},{id:T.ARROW,icon:I.arrow,tip:"Arrow (A)"},{id:T.RECT,icon:I.rect,tip:"Rect (R)"},{id:T.DIAMOND,icon:I.diamond,tip:"Diamond (D)"},{id:T.CIRCLE,icon:I.circle,tip:"Ellipse (O)"}];

  /* ═══════ RENDER ═══════ */
  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:th.bg,fontFamily:'"DM Sans",system-ui,sans-serif',overflow:"hidden",userSelect:"none"}}>
      <link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {/* Upload Modal */}
      {showUploadModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)"}} onClick={()=>setShowUploadModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"40px",maxWidth:"380px",width:"90%",boxShadow:th.shadowLg,textAlign:"center",border:`1px solid ${th.border}`}}><div style={{width:"52px",height:"52px",borderRadius:"16px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",color:"#fff"}}>{I.upload}</div><h2 style={{margin:"0 0 6px",fontSize:"18px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Restore Notes</h2><p style={{margin:"0 0 24px",fontSize:"13px",color:th.textSecondary}}>Upload a .json backup</p><input ref={fileRef} type="file" accept=".json" onChange={handleUpload} style={{display:"none"}}/><button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"14px",borderRadius:"14px",border:`2px dashed ${th.border}`,background:th.surfaceHover,cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.text,marginBottom:"10px",fontFamily:"inherit"}}>Choose File</button><button onClick={()=>setShowUploadModal(false)} style={{width:"100%",padding:"10px",borderRadius:"14px",border:"none",background:"transparent",cursor:"pointer",fontSize:"13px",color:th.textMuted}}>Cancel</button></div></div>}
      {/* Email Modal */}
      {showEmailModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)"}} onClick={()=>setShowEmailModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"36px",maxWidth:"400px",width:"90%",boxShadow:th.shadowLg,border:`1px solid ${th.border}`}}><div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}><div style={{width:"44px",height:"44px",borderRadius:"14px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}>{I.mail}</div><div><h2 style={{margin:0,fontSize:"17px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Share Note</h2><p style={{margin:"2px 0 0",fontSize:"11px",color:th.textMuted}}>Send current page as image</p></div></div><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>To</label><input type="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="name@example.com" autoFocus onKeyDown={e=>{if(e.key==="Enter")sendEmail();if(e.key==="Escape")setShowEmailModal(false);}} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"14px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>Subject</label><input type="text" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"18px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/>{emailPreview&&<div style={{marginBottom:"18px",borderRadius:"12px",overflow:"hidden",border:`1px solid ${th.border}`,background:th.bg,padding:"8px",display:"flex",justifyContent:"center"}}><img src={emailPreview} alt="" style={{maxWidth:"100%",maxHeight:"100px",borderRadius:"8px",objectFit:"contain"}}/></div>}<div style={{display:"flex",gap:"10px"}}><button onClick={()=>setShowEmailModal(false)} style={{flex:1,padding:"12px",borderRadius:"12px",border:`1px solid ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.textSecondary,fontFamily:"inherit"}}>Cancel</button><button onClick={sendEmail} disabled={emailSending||!emailTo.includes("@")} style={{flex:2,padding:"12px",borderRadius:"12px",border:"none",cursor:emailTo.includes("@")?"pointer":"not-allowed",background:emailTo.includes("@")?th.accentGrad:th.surfaceActive,color:emailTo.includes("@")?"#fff":th.textMuted,fontSize:"13px",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>{emailSending?"Sending...":<>{I.send} Send</>}</button></div></div></div>}

      {/* ═══ TOP BAR ═══ */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:compact?"8px 12px":"10px 20px",pointerEvents:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{display:"flex",alignItems:"center",gap:"8px",background:th.toolbar,backdropFilter:"blur(16px)",border:`1px solid ${th.toolbarBorder}`,borderRadius:"14px",padding:compact?"8px 12px":"8px 16px",cursor:"pointer",boxShadow:th.shadow}}><span style={{color:th.text}}>{I.menu}</span>{!tiny&&<span style={{fontFamily:'"Literata",Georgia,serif',fontSize:"14px",fontWeight:700,color:th.text,letterSpacing:"-.3px"}}>Ink Notes</span>}</button></div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><div style={{background:th.toolbar,backdropFilter:"blur(16px)",border:`1px solid ${th.toolbarBorder}`,borderRadius:"10px",padding:"5px 12px",boxShadow:th.shadow,fontSize:"11px",fontWeight:600,color:stI.c,display:"flex",alignItems:"center",gap:"6px"}}><span>{stI.t}</span><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>Pg {currentPage+1}/{pages.length}</span>{!compact&&<><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>🛡️ Palm</span></>}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"4px",pointerEvents:"auto"}}>{[{fn:undo,icon:I.undo,en:historyIndex>0},{fn:redo,icon:I.redo,en:historyIndex<history.length-1}].map((a,i)=>(<button key={i} onClick={a.fn} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:"blur(16px)",boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:a.en?th.text:th.textMuted,opacity:a.en?1:.5}}>{a.icon}</button>))}<div style={{width:"4px"}}/><button onClick={()=>setDark(!dark)} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:"blur(16px)",boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{dark?I.sun:I.moon}</button>{onHome&&<><div style={{width:"4px"}}/><button onClick={onHome} title="Back to home" style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:"blur(16px)",boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{I.home}</button></>}</div>
      </div>

      {/* ═══ VERTICAL TOOL DOCK ═══ */}
      {!compact&&<div style={{position:"absolute",left:"16px",top:"50%",transform:"translateY(-50%)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:"blur(20px)",border:`1px solid ${th.toolbarBorder}`,borderRadius:"20px",padding:"8px 6px",boxShadow:th.shadow}}>
        {toolDock.map((item,i)=>item==="sep"?<div key={i} style={{width:"22px",height:"1px",background:th.border,margin:"4px 0"}}/>:(<div key={item.id} style={{position:"relative"}} onMouseEnter={()=>setHoveredTool(item.id)} onMouseLeave={()=>setHoveredTool(null)}><button onClick={()=>setTool(item.id)} style={{width:"38px",height:"38px",borderRadius:"12px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:tool===item.id?th.glow:"none",transform:tool===item.id?"scale(1.05)":"scale(1)"}}>{item.icon}</button>{hoveredTool===item.id&&tool!==item.id&&<div style={{position:"absolute",left:"48px",top:"50%",transform:"translateY(-50%)",background:th.surface,border:`1px solid ${th.border}`,borderRadius:"8px",padding:"4px 10px",fontSize:"11px",fontWeight:600,color:th.text,whiteSpace:"nowrap",boxShadow:th.shadow,pointerEvents:"none",zIndex:200}}>{item.tip}</div>}</div>))}
      </div>}
      {/* ═══ COMPACT TOOLS ═══ */}
      {compact&&<div style={{position:"absolute",top:"52px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:"2px",background:th.toolbar,backdropFilter:"blur(16px)",border:`1px solid ${th.toolbarBorder}`,borderRadius:"16px",padding:"4px",boxShadow:th.shadow,overflowX:"auto",maxWidth:"calc(100vw - 24px)"}}>{toolDock.filter(t=>t!=="sep"&&![T.LINE,T.DIAMOND].includes(t?.id)).map(item=>(<button key={item.id} onClick={()=>setTool(item.id)} style={{width:"34px",height:"34px",borderRadius:"10px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:tool===item.id?th.glow:"none"}}>{item.icon}</button>))}</div>}

      {/* ═══ BOTTOM CONTEXT BAR ═══ */}
      <div style={{position:"absolute",bottom:compact?"10px":"16px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:compact?"6px":"10px",alignItems:"center",flexWrap:"wrap",justifyContent:"center",maxWidth:"calc(100vw - 32px)"}}>
        {![T.ERASER,T.SELECT,T.HAND].includes(tool)&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"16px",padding:compact?"5px 8px":"6px 12px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{COLORS.map((c,i)=>(<button key={i} onClick={()=>setColor(c)} style={{width:color===c?"22px":"16px",height:color===c?"22px":"16px",borderRadius:"50%",border:color===c?`2.5px solid ${th.accent}`:"2px solid transparent",background:c,cursor:"pointer",transition:"all .2s",boxShadow:color===c?`0 0 8px ${c}40`:"none",flexShrink:0}}/>))}</div>}
        {[T.PEN,T.HIGHLIGHTER,T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{BRUSH_SIZES.map(sz=>(<button key={sz} onClick={()=>setBrushSize(sz)} style={{width:"28px",height:"28px",borderRadius:"9px",border:brushSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:brushSize===sz?th.accentSoft:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:Math.min(sz*1.5,14)+"px",height:Math.min(sz*1.5,14)+"px",borderRadius:"50%",background:color}}/></button>))}</div>}
        {tool===T.ERASER&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{ERASER_SIZES.map(sz=>(<button key={sz} onClick={()=>setEraserSize(sz)} style={{width:"30px",height:"30px",borderRadius:"9px",border:eraserSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:eraserSize===sz?th.accentSoft:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:Math.min(sz*.5,18)+"px",height:Math.min(sz*.5,18)+"px",borderRadius:"4px",background:th.textMuted,opacity:.35}}/></button>))}<span style={{fontSize:"10px",color:th.textMuted,marginLeft:"2px"}}>{eraserSize}</span></div>}
        {tool===T.TEXT&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{FONT_SIZES.map(sz=>(<button key={sz} onClick={()=>setFontSize(sz)} style={{padding:"4px 7px",borderRadius:"8px",border:fontSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:fontSize===sz?th.accentSoft:"transparent",cursor:"pointer",fontSize:"10px",fontWeight:700,color:fontSize===sz?th.accent:th.textMuted,flexShrink:0}}>{sz}</button>))}</div>}
        <div style={{display:"flex",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"16px",padding:"4px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{[{fn:()=>{setShowGrid(!showGrid);setShowRuled(false);},icon:I.grid,active:showGrid,c:th.text},{fn:()=>{setShowRuled(!showRuled);setShowGrid(false);},icon:I.ruled,active:showRuled,c:th.text},"sep",{fn:manualSave,icon:I.save,c:th.success},{fn:()=>setShowUploadModal(true),icon:I.upload,c:th.accent},{fn:exportPng,icon:I.image,c:th.text},{fn:openEmailModal,icon:I.mail,c:th.accent},{fn:clearCanvas,icon:I.trash,c:th.danger}].map((a,i)=>a==="sep"?<div key={i} style={{width:"1px",height:"18px",background:th.border,margin:"0 2px"}}/>:(<button key={i} onClick={a.fn} style={{width:"30px",height:"30px",borderRadius:"9px",border:"none",background:a.active?th.accentGrad:"transparent",color:a.active?"#fff":a.c||th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:a.active?th.glow:"none"}}>{a.icon}</button>))}</div>
      </div>

      {/* ═══ ZOOM ═══ */}
      <div style={{position:"absolute",bottom:compact?"10px":"16px",right:compact?"10px":"20px",zIndex:100,display:"flex",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:"blur(16px)",borderRadius:"12px",padding:"3px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>
        <button onClick={()=>setZoom(z=>Math.max(.3,z-.1))} style={{width:"28px",height:"28px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:th.text}}>{I.zoomOut}</button>
        <button onClick={()=>setZoom(1)} style={{padding:"2px 4px",background:"transparent",border:"none",fontSize:"10px",fontWeight:700,color:th.textSecondary,cursor:"pointer",minWidth:"38px",textAlign:"center"}}>{Math.round(zoom*100)}%</button>
        <button onClick={()=>setZoom(z=>Math.min(5,z+.1))} style={{width:"28px",height:"28px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:th.text}}>{I.zoomIn}</button>
      </div>
      <div style={{position:"absolute",bottom:compact?"52px":"18px",left:compact?"50%":"20px",transform:compact?"translateX(-50%)":"none",zIndex:100,fontSize:"10px",color:th.textMuted,fontWeight:500,opacity:.5,fontFamily:'"Literata",Georgia,serif',fontStyle:"italic"}}>crafted by <span style={{fontWeight:700,color:th.textSecondary,fontStyle:"normal"}}>Nilay</span></div>

      {/* ═══ MAIN AREA ═══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        {sidebarOpen&&<div style={{width:compact?"200px":"240px",background:th.surface,borderRight:`1px solid ${th.border}`,padding:`${compact?52:56}px 14px 14px`,overflowY:"auto",zIndex:90}}>
          <div style={{fontSize:"9px",fontWeight:700,color:th.textMuted,letterSpacing:"1.2px",marginBottom:"10px",textTransform:"uppercase"}}>Pages</div>
          {pages.map((pg,i)=>(<div key={pg.id} style={{display:"flex",alignItems:"center",marginBottom:"2px",borderRadius:"10px",background:currentPage===i?th.surfaceHover:"transparent"}}>{renamingPage===i?<input ref={renameRef} value={renameValue} onChange={e=>setRenameValue(e.target.value)} onBlur={finishRename} onKeyDown={e=>{if(e.key==="Enter")finishRename();if(e.key==="Escape")setRenamingPage(null);}} style={{flex:1,padding:"8px 10px",borderRadius:"8px",border:`2px solid ${th.accent}`,outline:"none",fontSize:"12px",fontWeight:600,color:th.text,background:th.accentSoft,fontFamily:"inherit"}}/>:<button onClick={()=>switchPg(i)} onDoubleClick={()=>startRename(i)} style={{flex:1,textAlign:"left",padding:"9px 12px",borderRadius:"10px",border:"none",background:"transparent",cursor:"pointer",fontSize:"12px",fontWeight:currentPage===i?700:500,color:currentPage===i?th.text:th.textSecondary,fontFamily:'"Literata",Georgia,serif'}}>{pg.name}</button>}{renamingPage!==i&&<button onClick={()=>startRename(i)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",color:th.textMuted,opacity:currentPage===i?.7:.25,flexShrink:0}}>{I.edit}</button>}</div>))}
          <button onClick={addPg} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",width:"100%",padding:"9px",marginTop:"8px",borderRadius:"10px",border:`1.5px dashed ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:600,color:th.textMuted,fontFamily:"inherit"}}>{I.plus} New Page</button>
          <div style={{marginTop:"24px",paddingTop:"16px",borderTop:`1px solid ${th.border}`,textAlign:"center"}}><div style={{fontSize:"13px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif'}}>Ink Notes</div><div style={{fontSize:"9px",color:th.textMuted,marginTop:"2px",fontStyle:"italic"}}>by <span style={{fontWeight:600,color:th.accent}}>Nilay</span></div></div>
        </div>}

        {/* ═══ SCROLLABLE PAGE STACK ═══ */}
        <div ref={scrollRef} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp} style={{flex:1,overflow:"auto",cursor:getCursor(),background:dark?"#0e0c0a":th.bg,position:"relative",touchAction:"none"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:`${PAGE_PAD}px`,minWidth:dW>baseW?`${dW+PAGE_PAD*2}px`:undefined,paddingTop:`${compact?100:60}px`,paddingBottom:"200px"}}>
            {pages.map((pg,idx)=>(
              <div key={pg.id}>
                {/* Page break divider */}
                {idx>0&&<div style={{display:"flex",alignItems:"center",gap:"12px",padding:`${PAGE_GAP/2}px 0`,width:dW+"px",maxWidth:"100%",userSelect:"none"}}><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/><span style={{fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:"1.5px",textTransform:"uppercase",whiteSpace:"nowrap"}}>Page {idx+1}</span><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/></div>}
                {/* Page */}
                <div style={{width:dW+"px",height:dH+"px",position:"relative",borderRadius:Math.max(4,8*zoom)+"px",overflow:"hidden",boxShadow:th.pageShadow,background:"#fff"}}>
                  <div style={{width:"100%",height:"100%",filter:dark?"invert(1) hue-rotate(180deg)":"none"}}>
                    <canvas ref={el=>initC(el,pg.id)} style={{width:"100%",height:"100%",display:"block"}}/>
                    <canvas ref={el=>initO(el,pg.id)} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
                  </div>
                  {/* Active indicator */}
                  {currentPage===idx&&<div style={{position:"absolute",top:0,left:0,right:0,height:Math.max(2,3*zoom)+"px",background:th.accentGrad,transition:"opacity .2s"}}/>}
                  {/* Text inputs for this page */}
                  {currentPage===idx&&textInputs.map(inp=>{const sx=inp.x/PW*dW,sy=inp.y/PH*dH,fs=inp.fontSize/PW*dW;return(<textarea key={inp.id} autoFocus={editingText===inp.id} value={inp.text} onChange={e=>setTextInputs(p=>p.map(t=>t.id===inp.id?{...t,text:e.target.value}:t))} onBlur={()=>textBlur(inp.id)} onKeyDown={e=>{if(e.key==="Escape")e.target.blur();}} style={{position:"absolute",left:sx+"px",top:sy+"px",fontSize:fs+"px",color:dark?invertHex(inp.color):inp.color,fontFamily:'"Literata",Georgia,serif',background:dark?"rgba(21,18,16,.95)":"rgba(255,252,247,.95)",border:`2px solid ${th.accent}`,borderRadius:"8px",outline:"none",padding:"6px 10px",minWidth:"60px",minHeight:fs*1.5+"px",resize:"both",lineHeight:1.4,zIndex:20,boxShadow:th.shadow}}/>);})}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Eraser cursor */}
      {tool===T.ERASER&&<><div ref={eraserCursorRef} style={{position:"fixed",width:(eraserSize/PW*dW*2)+"px",height:(eraserSize/PW*dW*2)+"px",borderRadius:"50%",border:`2px solid ${th.accent}`,background:dark?"rgba(224,138,66,.06)":"rgba(192,104,48,.04)",pointerEvents:"none",zIndex:9000,transform:"translate(-50%,-50%)",left:"-100px",top:"-100px"}}><div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"3px",height:"3px",borderRadius:"50%",background:th.accent,opacity:.5}}/></div><style>{`* { cursor: none !important; }`}</style></>}
      <style>{`
        div[style*="overflow: auto"]::-webkit-scrollbar{width:6px;height:6px}
        div[style*="overflow: auto"]::-webkit-scrollbar-track{background:transparent}
        div[style*="overflow: auto"]::-webkit-scrollbar-thumb{background:${dark?"rgba(224,138,66,.12)":"rgba(192,104,48,.1)"};border-radius:3px}
        div[style*="overflow: auto"]::-webkit-scrollbar-thumb:hover{background:${dark?"rgba(224,138,66,.25)":"rgba(192,104,48,.2)"}}
      `}</style>
    </div>
  );
}