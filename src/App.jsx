import { useState, useRef, useCallback, useEffect } from "react";
import { idbSet, idbGet, DB_NAME, DB_VERSION, STORE } from "./lib/db";
import { themes } from "./lib/themes";
import { COLORS, BRUSH_SIZES, ERASER_SIZES, FONT_SIZES, invertHex, T, INACTIVITY_TIMEOUT, PW, PH, PAGE_PAD, PAGE_GAP, AUTO_ZONE } from "./lib/constants";
import { I } from "./lib/icons";
import { drawSeg, drawPath, drawArrow, drawDiamond } from "./lib/drawing";
import Peer from "peerjs";

/* ══════════════ App ══════════════ */
export default function NoteApp({onHome}) {
  const cMap=useRef(new Map()),oMap=useRef(new Map());
  const canvasRef=useRef(null),overlayRef=useRef(null);
  const scrollRef=useRef(null),eraserCursorRef=useRef(null);

  /* ═══ State — only things that MUST trigger re-render ═══ */
  const [dark,setDark]=useState(false);
  const [tool,setTool]=useState(T.PEN);
  const [color,setColor]=useState(COLORS[0]),[brushSize,setBrushSize]=useState(4),[eraserSize,setEraserSize]=useState(24),[fontSize,setFontSize]=useState(24),[fillColor,setFillColor]=useState("transparent");
  const [history,setHistory]=useState([]),[historyIndex,setHistoryIndex]=useState(-1);
  const [folders,setFolders]=useState([{id:1,name:"My Notes",expanded:true}]);
  const [pages,setPages]=useState([{id:1,name:"Page 1",folderId:1}]),[currentPage,setCurrentPage]=useState(0);
  const [renamingFolder,setRenamingFolder]=useState(null),[renameFolderValue,setRenameFolderValue]=useState("");
  const [showGrid,setShowGrid]=useState(false),[showRuled,setShowRuled]=useState(false);
  const [textInputs,setTextInputs]=useState([]),[editingText,setEditingText]=useState(null),[selectedText,setSelectedText]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle"),[showUploadModal,setShowUploadModal]=useState(false);
  const [showEmailModal,setShowEmailModal]=useState(false),[emailTo,setEmailTo]=useState(""),[emailSubject,setEmailSubject]=useState("");
  const [emailSending,setEmailSending]=useState(false),[emailPreview,setEmailPreview]=useState(""),[appReady,setAppReady]=useState(false);
  const [renamingPage,setRenamingPage]=useState(null),[renameValue,setRenameValue]=useState("");
  const [selection,setSelection]=useState(null),[isDraggingSel,setIsDraggingSel]=useState(false);
  const selSnap=useRef(null);
  const [zoom,setZoom]=useState(1),[baseW,setBaseW]=useState(800),[hoveredTool,setHoveredTool]=useState(null);
  const [winW,setWinW]=useState(typeof window!=="undefined"?window.innerWidth:1200);
  const [penActive,setPenActive]=useState(false);
  const [collabOpen,setCollabOpen]=useState(false),[peerStatus,setPeerStatus]=useState('idle'),[roomCode,setRoomCode]=useState(''),[joinCode,setJoinCode]=useState('');
  const [shapeInputs,setShapeInputs]=useState([]),[selectedShape,setSelectedShape]=useState(null),[resizingHandle,setResizingHandle]=useState(null);

  /* ═══ Refs — perf-critical, must NOT trigger re-render ═══ */
  const isDrawing=useRef(false);      /* FIX: was useState → re-rendered every stroke */
  const shapeStart=useRef(null);       /* FIX: was useState → re-rendered on shape draw */
  const pressureRef=useRef(1);
  const isPanning=useRef(false),panStart=useRef({x:0,y:0}),spaceHeld=useRef(false);
  const lastPoint=useRef(null),pathPts=useRef([]),inactTimer=useRef(null),lastBackup=useRef(null);
  const fileRef=useRef(null),renameRef=useRef(null),renameFolderRef=useRef(null),penDet=useRef(false),penTO=useRef(null);
  const autoPageFlag=useRef(false),dirtyPages=useRef(new Set()),pinchRef=useRef(null);
  const rectCache=useRef(null),rectFrame=useRef(0),lassoRef=useRef([]);
  const zoomRef=useRef(1);
  const peerRef=useRef(null),connRef=useRef(null);
  const siRef=useRef([]),dragShapeStart=useRef(null),resizeShapeStart=useRef(null);
  const clipboardRef=useRef(null); /* {type:'shape'|'text', data:{...}} */
  /* FIX: pageData keyed by PAGE ID, not index */
  const pdRef=useRef({});
  const fldRef=useRef(folders);
  const pgRef=useRef(pages),cpRef=useRef(currentPage),tiRef=useRef(textInputs);
  const sgRef=useRef(showGrid),srRef=useRef(showRuled),darkRef=useRef(dark);
  const toolRef=useRef(tool),colorRef=useRef(color),brushRef=useRef(brushSize),eraserRef=useRef(eraserSize),fillRef=useRef("transparent");

  useEffect(()=>{fldRef.current=folders},[folders]);
  useEffect(()=>{pgRef.current=pages},[pages]);
  useEffect(()=>{cpRef.current=currentPage},[currentPage]);
  useEffect(()=>{tiRef.current=textInputs},[textInputs]);
  useEffect(()=>{sgRef.current=showGrid},[showGrid]);
  useEffect(()=>{srRef.current=showRuled},[showRuled]);
  useEffect(()=>{zoomRef.current=zoom},[zoom]);
  useEffect(()=>{darkRef.current=dark},[dark]);
  useEffect(()=>{toolRef.current=tool},[tool]);
  useEffect(()=>{colorRef.current=color},[color]);
  useEffect(()=>{brushRef.current=brushSize},[brushSize]);
  useEffect(()=>{eraserRef.current=eraserSize},[eraserSize]);
  useEffect(()=>{fillRef.current=fillColor},[fillColor]);
  useEffect(()=>{siRef.current=shapeInputs},[shapeInputs]);

  /* Responsive width */
  useEffect(()=>{
    const up=()=>{setWinW(window.innerWidth);const el=scrollRef.current;if(el)setBaseW(Math.min(el.clientWidth-PAGE_PAD*2,1400));};
    up();window.addEventListener("resize",up);return()=>window.removeEventListener("resize",up);
  },[]);
  useEffect(()=>{const el=scrollRef.current;if(el)setBaseW(Math.min(el.clientWidth-PAGE_PAD*2,1400));},[sidebarOpen]);
  const compact=winW<768,tiny=winW<500;
  const th=dark?themes.dark:themes.light;
  const blur="none",blurLg="none";
  const dW=baseW*zoom,dH=baseW*PH/PW*zoom;
  /* Only show pages from the current page's folder in the canvas */
  const curFolderId=pages[currentPage]?.folderId;
  const visiblePages=pages.map((pg,i)=>({...pg,_idx:i})).filter(pg=>pg.folderId===curFolderId);

  /* Sync active canvas refs */
  useEffect(()=>{const pid=pages[currentPage]?.id;if(pid){canvasRef.current=cMap.current.get(pid);overlayRef.current=oMap.current.get(pid);}},[currentPage,pages]);

  /* Eraser cursor */
  useEffect(()=>{const hm=(e)=>{const el=eraserCursorRef.current;if(el){el.style.left=e.clientX+"px";el.style.top=e.clientY+"px";}};if(tool===T.ERASER){window.addEventListener("pointermove",hm);return()=>window.removeEventListener("pointermove",hm);}},[tool]);

  /* iPad: block obvious palm touches (large contact area) when pen is active */
  useEffect(()=>{
    if(!penActive)return;
    const block=(e)=>{if(e.touches&&e.touches.length===1){const t=e.touches[0];if((t.radiusX||0)>15||(t.radiusY||0)>15){e.preventDefault();e.stopPropagation();}}};
    document.addEventListener("touchstart",block,{passive:false,capture:true});
    document.addEventListener("touchmove",block,{passive:false,capture:true});
    return()=>{document.removeEventListener("touchstart",block,{capture:true});document.removeEventListener("touchmove",block,{capture:true});};
  },[penActive]);

  /* ═══ Canvas init — FIX: looks up saved data by page ID directly ═══ */
  const initC=useCallback((el,pid)=>{
    if(!el||cMap.current.get(pid)===el)return;cMap.current.set(pid,el);
    el.width=PW;el.height=PH;
    const ctx=el.getContext("2d",{desynchronized:true});ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);
    /* FIX: lookup by page ID — no pgRef dependency, no race condition */
    const saved=pdRef.current[pid];
    if(saved?.image){const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,PW,PH);};img.src=saved.image;}
  },[]);
  const initO=useCallback((el,pid)=>{
    if(!el||oMap.current.get(pid)===el)return;oMap.current.set(pid,el);
    el.width=PW;el.height=PH;
  },[]);

  /* ═══ Coordinates ═══ */
  const getPageAtPt=(e)=>{for(let i=0;i<pages.length;i++){const c=cMap.current.get(pages[i].id);if(!c)continue;const r=c.getBoundingClientRect();if(e.clientY>=r.top&&e.clientY<=r.bottom&&e.clientX>=r.left&&e.clientX<=r.right)return i;}return-1;};
  const getPos=(e)=>{const c=canvasRef.current;if(!c)return{x:0,y:0,pressure:.5};const now=performance.now();if(!rectCache.current||now-rectFrame.current>100){rectCache.current=c.getBoundingClientRect();rectFrame.current=now;}const r=rectCache.current;const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH,pressure:e.pressure??.5};};
  const detectPen=(e)=>{if(e.pointerType!=="pen")return;if(!penDet.current){penDet.current=true;setPenActive(true);}if(penTO.current)clearTimeout(penTO.current);penTO.current=null;};
  const releasePen=()=>{if(!penDet.current)return;if(penTO.current)clearTimeout(penTO.current);penTO.current=setTimeout(()=>{penDet.current=false;setPenActive(false);},5000);};
  const isPalm=(e)=>{if(e.pointerType==="pen")return false;return penDet.current&&e.pointerType==="touch";};
  const shouldPan=()=>tool===T.HAND||spaceHeld.current;

  /* ═══ P2P Collaboration ═══ */
  const ICE={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302','stun:stun3.l.google.com:19302','stun:stun4.l.google.com:19302']},{urls:'stun:global.stun.twilio.com:3478'},{urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},{urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},{urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]};
  const broadcast=(msg)=>{const c=connRef.current;if(c&&c.open)try{c.send(msg);}catch{}};
  const handleRemoteData=useCallback((msg)=>{
    const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");
    if(msg.t==='pen'){ctx.strokeStyle=msg.c;ctx.lineWidth=msg.s*Math.max(.3,msg.p||.5);ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(msg.x1,msg.y1);ctx.lineTo(msg.x2,msg.y2);ctx.stroke();}
    else if(msg.t==='er'){ctx.fillStyle="#ffffff";const dx=msg.x2-msg.x1,dy=msg.y2-msg.y1,d=Math.sqrt(dx*dx+dy*dy),st=Math.max(1,Math.floor(d/2));for(let i=0;i<=st;i++){const t=i/st;ctx.beginPath();ctx.arc(msg.x1+dx*t,msg.y1+dy*t,msg.s,0,Math.PI*2);ctx.fill();}}
    else if(msg.t==='hl'){ctx.save();ctx.globalAlpha=.3;drawPath(ctx,msg.pts,msg.c,msg.s);ctx.restore();}
    else if(msg.t==='shp_add')setShapeInputs(p=>[...p,msg.obj]);
    else if(msg.t==='shp_upd')setShapeInputs(p=>p.map(s=>s.id===msg.id?{...msg.obj,id:msg.id}:s));
    else if(msg.t==='shp_del')setShapeInputs(p=>p.filter(s=>s.id!==msg.id));
    else if(msg.t==='sync'){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);};img.src=msg.image;if(msg.texts)setTextInputs(msg.texts);if(msg.shapes)setShapeInputs(msg.shapes);}
    else if(msg.t==='txt_add')setTextInputs(p=>[...p,msg.obj]);
    else if(msg.t==='txt_upd')setTextInputs(p=>p.map(t=>t.id===msg.id?{...t,text:msg.text}:t));
    else if(msg.t==='txt_del')setTextInputs(p=>p.filter(t=>t.id!==msg.id));
    else if(msg.t==='undo'){const img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);};img.src=msg.image;}
    else if(msg.t==='clear'){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);setTextInputs([]);setShapeInputs([]);}
  },[]);
  const createRoom=()=>{const code=Math.random().toString(36).substring(2,8).toUpperCase();setRoomCode(code);setPeerStatus('hosting');const p=new Peer('inknotes-'+code,{config:ICE});peerRef.current=p;p.on('connection',(conn)=>{connRef.current=conn;conn.on('open',()=>{setPeerStatus('connected');const cv=canvasRef.current;if(cv)conn.send({t:'sync',image:cv.toDataURL(),texts:tiRef.current,shapes:siRef.current});});conn.on('data',handleRemoteData);conn.on('close',()=>{connRef.current=null;setPeerStatus('hosting');});});p.on('error',(e)=>console.error('Peer:',e));};
  const joinRoom=()=>{if(!joinCode.trim())return;setPeerStatus('joining');const p=new Peer(undefined,{config:ICE});peerRef.current=p;p.on('open',()=>{const conn=p.connect('inknotes-'+joinCode.trim().toUpperCase(),{reliable:true});connRef.current=conn;conn.on('open',()=>setPeerStatus('connected'));conn.on('data',handleRemoteData);conn.on('close',()=>{connRef.current=null;setPeerStatus('idle');});});p.on('error',(e)=>{console.error('Peer:',e);setPeerStatus('idle');});};
  const disconnectPeer=()=>{connRef.current?.close();peerRef.current?.destroy();connRef.current=null;peerRef.current=null;setPeerStatus('idle');setRoomCode('');setJoinCode('');};
  useEffect(()=>()=>{connRef.current?.close();peerRef.current?.destroy();},[]);

  /* ═══ History ═══ */
  const saveHist=useCallback(()=>{const c=canvasRef.current;if(!c)return;const pid=pgRef.current[cpRef.current]?.id;if(pid)dirtyPages.current.add(pid);requestAnimationFrame(()=>{const d=c.toDataURL();setHistory(p=>{const h=p.slice(0,historyIndex+1);h.push(d);return h.length>20?h.slice(-20):h;});setHistoryIndex(p=>Math.min(p+1,19));});},[historyIndex]);
  const restoreImg=(src)=>{const img=new Image();img.onload=()=>{const c=canvasRef.current,ctx=c.getContext("2d");ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);};img.src=src;};
  const undo=useCallback(()=>{if(historyIndex<=0)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex-1]);broadcast({t:'undo',image:history[historyIndex-1]});setHistoryIndex(i=>i-1);},[history,historyIndex]);
  const redo=useCallback(()=>{if(historyIndex>=history.length-1)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex+1]);setHistoryIndex(i=>i+1);},[history,historyIndex]);

  /* Selection */
  const commitSel=useCallback(()=>{if(!selection?.imageData)return;const c=canvasRef.current,ctx=c.getContext("2d");if(selSnap.current){ctx.clearRect(0,0,PW,PH);ctx.drawImage(selSnap.current,0,0);}const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x,selection.y,selection.w,selection.h);setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);saveHist();},[selection,saveHist]);
  const inSel=(p)=>selection&&p.x>=selection.x&&p.x<=selection.x+selection.w&&p.y>=selection.y&&p.y<=selection.y+selection.h;

  /* ═══ Text — Excalidraw-style persistent overlays ═══ */
  const dragTextStart=useRef(null),isDraggingText=useRef(false);
  const bakeTexts=(canvas,texts)=>{if(!canvas||!texts?.length)return;const ctx=canvas.getContext("2d");ctx.save();texts.forEach(inp=>{if(!inp.text.trim())return;ctx.font=`${inp.fontSize}px "Literata",Georgia,serif`;ctx.fillStyle=inp.color;ctx.textBaseline="top";inp.text.split("\n").forEach((l,i)=>ctx.fillText(l,inp.x,inp.y+i*inp.fontSize*1.3));});ctx.restore();};
  const hitTestText=(pos)=>textInputs.find(t=>{if(!t.text.trim()&&editingText!==t.id)return false;const m=document.createElement("canvas").getContext("2d");m.font=`${t.fontSize}px "Literata",Georgia,serif`;const lines=t.text.split("\n");const maxW=Math.max(t.fontSize*2,...lines.map(l=>m.measureText(l).width));const h=Math.max(t.fontSize*1.4,lines.length*t.fontSize*1.4);return pos.x>=t.x-4&&pos.x<=t.x+maxW+12&&pos.y>=t.y-4&&pos.y<=t.y+h+8;});
  const commitEditing=()=>{if(editingText!==null){const inp=textInputs.find(t=>t.id===editingText);if(inp&&!inp.text.trim())setTextInputs(p=>p.filter(t=>t.id!==editingText));setEditingText(null);}};
  const deleteText=(id)=>{broadcast({t:'txt_del',id});setTextInputs(p=>p.filter(t=>t.id!==id));if(editingText===id)setEditingText(null);if(selectedText===id)setSelectedText(null);};

  /* ═══ Shapes — persistent vector overlays ═══ */
  const hitTestShape=(pos)=>{for(let i=shapeInputs.length-1;i>=0;i--){const s=shapeInputs[i];const pad=25;const mnX=Math.min(s.x1,s.x2)-pad,mnY=Math.min(s.y1,s.y2)-pad,mxX=Math.max(s.x1,s.x2)+pad,mxY=Math.max(s.y1,s.y2)+pad;if(s.type===T.LINE||s.type===T.ARROW){const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.sqrt(dx*dx+dy*dy);if(len<1)continue;const t=Math.max(0,Math.min(1,((pos.x-s.x1)*dx+(pos.y-s.y1)*dy)/(len*len)));const px=s.x1+t*dx,py=s.y1+t*dy,dist=Math.sqrt((pos.x-px)**2+(pos.y-py)**2);if(dist<20)return s;}else{if(pos.x>=mnX&&pos.x<=mxX&&pos.y>=mnY&&pos.y<=mxY)return s;}}return null;};
  const bakeShapes=(canvas,shapes)=>{if(!canvas||!shapes?.length)return;const ctx=canvas.getContext("2d");ctx.save();shapes.forEach(s=>{if(s.type===T.LINE){ctx.strokeStyle=s.color;ctx.lineWidth=s.strokeWidth;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();}else if(s.type===T.ARROW)drawArrow(ctx,s.x1,s.y1,s.x2,s.y2,s.color,s.strokeWidth);else if(s.type===T.RECT){ctx.lineWidth=s.strokeWidth;ctx.lineCap="round";if(s.fill&&s.fill!=='transparent'){ctx.fillStyle=s.fill;ctx.fillRect(s.x1,s.y1,s.x2-s.x1,s.y2-s.y1);}ctx.strokeStyle=s.color;ctx.strokeRect(s.x1,s.y1,s.x2-s.x1,s.y2-s.y1);}else if(s.type===T.DIAMOND)drawDiamond(ctx,s.x1,s.y1,s.x2-s.x1,s.y2-s.y1,s.color,s.strokeWidth,s.fill);else if(s.type===T.CIRCLE){const rx=Math.abs(s.x2-s.x1)/2,ry=Math.abs(s.y2-s.y1)/2;ctx.lineWidth=s.strokeWidth;ctx.lineCap="round";ctx.beginPath();ctx.ellipse(s.x1+(s.x2-s.x1)/2,s.y1+(s.y2-s.y1)/2,rx,ry,0,0,Math.PI*2);if(s.fill&&s.fill!=='transparent'){ctx.fillStyle=s.fill;ctx.fill();}ctx.strokeStyle=s.color;ctx.stroke();}});ctx.restore();};
  const deleteShape=(id)=>{broadcast({t:'shp_del',id});setShapeInputs(p=>p.filter(s=>s.id!==id));if(selectedShape===id)setSelectedShape(null);};

  /* ═══ Switch active page — FIX: save by page ID ═══ */
  const activatePage=useCallback((idx)=>{
    if(idx===currentPage||idx<0||idx>=pages.length)return;
    const curPid=pages[currentPage]?.id;
    const c=canvasRef.current;
    if(c&&curPid){pdRef.current[curPid]={image:c.toDataURL(),texts:textInputs,shapes:shapeInputs};dirtyPages.current.delete(curPid);}
    setCurrentPage(idx);
    const pid=pages[idx].id;canvasRef.current=cMap.current.get(pid);overlayRef.current=oMap.current.get(pid);
    setTextInputs(pdRef.current[pid]?.texts||[]);setShapeInputs(pdRef.current[pid]?.shapes||[]);setEditingText(null);setSelectedText(null);setSelectedShape(null);setHistory([]);setHistoryIndex(-1);setSelection(null);selSnap.current=null;
  },[currentPage,pages,textInputs,shapeInputs]);

  /* ═══ POINTER HANDLERS ═══ */
  const handleDown=(e)=>{e.preventDefault();if(pinchRef.current)return;
    detectPen(e);
    /* Pen detected: finger touch = scroll, reject palms & overlapping finger during draw */
    if(e.pointerType==="touch"&&penDet.current){if(e.width>20||e.height>20)return;if(e.pressure>0&&e.pressure<0.05)return;if(isDrawing.current)return;isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY};return;}
    if(isPalm(e))return;rectCache.current=null;
    if(shouldPan()){isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY};return;}
    const pi=getPageAtPt(e);
    /* Touch outside canvas (padding/gaps) = scroll */
    if(pi===-1){if(e.pointerType==="touch"){isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY};}return;}
    if(pi!==currentPage)activatePage(pi);
    const c=cMap.current.get(pages[pi].id);const o=oMap.current.get(pages[pi].id);
    canvasRef.current=c;overlayRef.current=o;
    const pos=getPos(e);pressureRef.current=pos.pressure||.5;
    /* ── Text hit-test for SELECT & TEXT tools ── */
    if(tool===T.SELECT||tool===T.TEXT){const hit=hitTestText(pos);
      if(hit){
        if(selection)commitSel();
        if(hit.id===editingText)return;/* already editing this one */
        if(hit.id===selectedText){/* already selected → enter edit on second click */setEditingText(hit.id);setSelectedText(null);return;}
        /* select it + prepare drag */
        commitEditing();setSelectedText(hit.id);setEditingText(null);
        dragTextStart.current={x:e.clientX,y:e.clientY,ox:hit.x,oy:hit.y,id:hit.id,moved:false};
        return;
      }
      /* clicked empty area */
      commitEditing();setSelectedText(null);
    }
    /* ── Shape hit-test for SELECT tool ── */
    if(tool===T.SELECT){const hitS=hitTestShape(pos);if(hitS){if(selection)commitSel();setSelectedShape(hitS.id);setColor(hitS.color);setFillColor(hitS.fill||'transparent');setBrushSize(hitS.strokeWidth);dragShapeStart.current={x:e.clientX,y:e.clientY,ox1:hitS.x1,oy1:hitS.y1,ox2:hitS.x2,oy2:hitS.y2,id:hitS.id};try{e.target.setPointerCapture(e.pointerId);}catch{}return;}setSelectedShape(null);}
    if(tool===T.SELECT){if(selection&&inSel(pos)){setIsDraggingSel(true);lastPoint.current=pos;return;}if(selection)commitSel();lassoRef.current=[pos];isDrawing.current=true;return;}
    if(selection)commitSel();
    if(tool===T.TEXT){const nid=Date.now();const nobj={id:nid,x:pos.x,y:pos.y,text:"",color,fontSize};setTextInputs(p=>[...p,nobj]);broadcast({t:'txt_add',obj:nobj});setEditingText(nid);return;}
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)){/* Click on existing shape → switch to select (like Excalidraw) */const hitS2=hitTestShape(pos);if(hitS2){setTool(T.SELECT);setSelectedShape(hitS2.id);setColor(hitS2.color);setFillColor(hitS2.fill||'transparent');setBrushSize(hitS2.strokeWidth);dragShapeStart.current={x:e.clientX,y:e.clientY,ox1:hitS2.x1,oy1:hitS2.y1,ox2:hitS2.x2,oy2:hitS2.y2,id:hitS2.id};try{e.target.setPointerCapture(e.pointerId);}catch{}return;}shapeStart.current=pos;isDrawing.current=true;return;}
    isDrawing.current=true;lastPoint.current=pos;pathPts.current=[pos];
    if(tool===T.ERASER){const ctx=c.getContext("2d");ctx.save();ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(pos.x,pos.y,eraserSize,0,Math.PI*2);ctx.fill();ctx.restore();broadcast({t:'er',x1:pos.x,y1:pos.y,x2:pos.x,y2:pos.y,s:eraserRef.current});}
  };

  const handleMove=(e)=>{e.preventDefault();if(pinchRef.current)return;
    /* Text drag — works with both SELECT and TEXT tools (must be before palm check) */
    if(dragTextStart.current&&(tool===T.TEXT||tool===T.SELECT)){const ds=dragTextStart.current;const dx=(e.clientX-ds.x)/dW*PW;const dy=(e.clientY-ds.y)/dH*PH;if(Math.abs(dx)>2||Math.abs(dy)>2)ds.moved=true;if(ds.moved){isDraggingText.current=true;setTextInputs(p=>p.map(t=>t.id===ds.id?{...t,x:ds.ox+dx,y:ds.oy+dy}:t));}return;}
    /* Shape drag */
    if(dragShapeStart.current&&tool===T.SELECT){const ds=dragShapeStart.current;const dx=(e.clientX-ds.x)/dW*PW;const dy=(e.clientY-ds.y)/dH*PH;setShapeInputs(p=>p.map(s=>s.id===ds.id?{...s,x1:ds.ox1+dx,y1:ds.oy1+dy,x2:ds.ox2+dx,y2:ds.oy2+dy}:s));return;}
    /* Shape resize */
    if(resizeShapeStart.current&&tool===T.SELECT){const rs=resizeShapeStart.current;const dx=(e.clientX-rs.mx)/dW*PW;const dy=(e.clientY-rs.my)/dH*PH;const os=rs.shape;setShapeInputs(p=>p.map(s=>{if(s.id!==os.id)return s;if(rs.handle==='p1')return{...s,x1:os.x1+dx,y1:os.y1+dy};if(rs.handle==='p2')return{...s,x2:os.x2+dx,y2:os.y2+dy};if(rs.handle==='tl')return{...s,x1:os.x1+dx,y1:os.y1+dy};if(rs.handle==='tr')return{...s,x2:os.x2+dx,y1:os.y1+dy};if(rs.handle==='bl')return{...s,x1:os.x1+dx,y2:os.y2+dy};if(rs.handle==='br')return{...s,x2:os.x2+dx,y2:os.y2+dy};return s;}));return;}
    if(!isDrawing.current&&!isPanning.current&&isPalm(e))return;
    if(isPanning.current){const el=scrollRef.current;el.scrollLeft-=(e.clientX-panStart.current.x);el.scrollTop-=(e.clientY-panStart.current.y);panStart.current={x:e.clientX,y:e.clientY};return;}
    const pos=getPos(e);
    /* Auto-create page near bottom of last page — debounced */
    const isLastInFolder=visiblePages.length>0&&visiblePages[visiblePages.length-1]._idx===currentPage;
    if(isDrawing.current&&isLastInFolder&&pos.y>PH-AUTO_ZONE&&![T.SELECT,T.HAND].includes(tool)&&!autoPageFlag.current){
      autoPageFlag.current=true;
      const curFid=pgRef.current[cpRef.current]?.folderId||1;
      setPages(p=>{const n=p.filter(pg=>pg.folderId===curFid).length;return[...p,{id:Date.now(),name:`Page ${n+1}`,folderId:curFid}];});
      setTimeout(()=>scrollRef.current?.scrollBy({top:200,behavior:"smooth"}),150);
    }
    if(tool===T.SELECT&&isDraggingSel&&selection){const dx=pos.x-lastPoint.current.x,dy=pos.y-lastPoint.current.y;setSelection(p=>({...p,x:p.x+dx,y:p.y+dy}));if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d");ctx.clearRect(0,0,PW,PH);ctx.drawImage(selSnap.current,0,0);const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x+dx,selection.y+dy,selection.w,selection.h);}lastPoint.current=pos;const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;if(selection.lasso){octx.beginPath();const lp=selection.lasso;octx.moveTo(selection.x+dx+lp[0].x,selection.y+dy+lp[0].y);for(let i=1;i<lp.length;i++)octx.lineTo(selection.x+dx+lp[i].x,selection.y+dy+lp[i].y);octx.closePath();octx.fillStyle="rgba(74,144,217,0.18)";octx.fill();octx.strokeStyle="#4a90d9";octx.stroke();}else{octx.strokeRect(selection.x+dx,selection.y+dy,selection.w,selection.h);}octx.restore();return;}
    if(tool===T.SELECT&&isDrawing.current&&lassoRef.current.length){const lp=lassoRef.current;const last=lp[lp.length-1];if(Math.abs(pos.x-last.x)>2||Math.abs(pos.y-last.y)>2)lp.push(pos);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);if(lp.length>1){octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=1.5;octx.fillStyle="rgba(192,104,48,0.06)";octx.beginPath();octx.moveTo(lp[0].x,lp[0].y);for(let i=1;i<lp.length;i++)octx.lineTo(lp[i].x,lp[i].y);octx.closePath();octx.fill();octx.stroke();octx.restore();}return;}
    if(!isDrawing.current)return;const pv=pos.pressure||pressureRef.current;pressureRef.current=pv;
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart.current){const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();const ss=shapeStart.current;if(tool===T.LINE){octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.moveTo(ss.x,ss.y);octx.lineTo(pos.x,pos.y);octx.stroke();}else if(tool===T.ARROW)drawArrow(octx,ss.x,ss.y,pos.x,pos.y,color,brushSize);else if(tool===T.RECT){octx.lineWidth=brushSize;octx.lineCap="round";if(fillColor!=='transparent'){octx.fillStyle=fillColor;octx.fillRect(ss.x,ss.y,pos.x-ss.x,pos.y-ss.y);}octx.strokeStyle=color;octx.strokeRect(ss.x,ss.y,pos.x-ss.x,pos.y-ss.y);}else if(tool===T.DIAMOND)drawDiamond(octx,ss.x,ss.y,pos.x-ss.x,pos.y-ss.y,color,brushSize,fillColor);else if(tool===T.CIRCLE){const rx=Math.abs(pos.x-ss.x)/2,ry=Math.abs(pos.y-ss.y)/2;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.ellipse(ss.x+(pos.x-ss.x)/2,ss.y+(pos.y-ss.y)/2,rx,ry,0,0,Math.PI*2);if(fillColor!=='transparent'){octx.fillStyle=fillColor;octx.fill();}octx.strokeStyle=color;octx.stroke();}octx.restore();return;}
    if(tool===T.ERASER){const ctx=canvasRef.current.getContext("2d");ctx.fillStyle="#ffffff";
      const evts=e.getCoalescedEvents?e.getCoalescedEvents():[];const pts=evts.length>1?evts.map(ce=>{const t=ce.touches?ce.touches[0]:ce;const r=rectCache.current;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH};}):[pos];
      let lp=lastPoint.current;for(const p of pts){const dx=p.x-lp.x,dy=p.y-lp.y,d=Math.sqrt(dx*dx+dy*dy),st=Math.max(1,Math.floor(d/2));for(let i=0;i<=st;i++){const t=i/st;ctx.beginPath();ctx.arc(lp.x+dx*t,lp.y+dy*t,eraserSize,0,Math.PI*2);ctx.fill();}broadcast({t:'er',x1:lp.x,y1:lp.y,x2:p.x,y2:p.y,s:eraserRef.current});lp=p;}}
    else if(tool===T.PEN){const ctx=canvasRef.current.getContext("2d");
      ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";
      const evts=e.getCoalescedEvents?e.getCoalescedEvents():[];const pts=evts.length>1?evts.map(ce=>{const t=ce.touches?ce.touches[0]:ce;const r=rectCache.current;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH,pressure:ce.pressure||pv};}):[pos];
      let lp=lastPoint.current;for(const p of pts){ctx.lineWidth=brushSize*Math.max(.3,p.pressure||pv);ctx.beginPath();ctx.moveTo(lp.x,lp.y);ctx.lineTo(p.x,p.y);ctx.stroke();broadcast({t:'pen',x1:lp.x,y1:lp.y,x2:p.x,y2:p.y,p:p.pressure||pv,c:colorRef.current,s:brushRef.current});pathPts.current.push(p);lp=p;}}
    else if(tool===T.HIGHLIGHTER){pathPts.current.push(pos);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.globalAlpha=.3;drawPath(octx,pathPts.current,color,brushSize*3);octx.restore();}
    lastPoint.current=pos;
  };

  const handleUp=(e)=>{
    if(isPanning.current){isPanning.current=false;return;}
    if(dragTextStart.current&&(tool===T.TEXT||tool===T.SELECT)){const ds=dragTextStart.current;dragTextStart.current=null;if(ds.moved){isDraggingText.current=false;}return;}
    if(dragShapeStart.current){const ds=dragShapeStart.current;dragShapeStart.current=null;try{e.target.releasePointerCapture(e.pointerId);}catch{}const sh=siRef.current.find(s=>s.id===ds.id);if(sh)broadcast({t:'shp_upd',id:sh.id,obj:sh});return;}
    if(resizeShapeStart.current){resizeShapeStart.current=null;setResizingHandle(null);const sh=siRef.current.find(s=>s.id===selectedShape);if(sh)broadcast({t:'shp_upd',id:sh.id,obj:sh});return;}
    if(tool===T.SELECT&&isDraggingSel){setIsDraggingSel(false);lastPoint.current=null;return;}
    if(tool===T.SELECT&&isDrawing.current&&lassoRef.current.length>2){const lp=lassoRef.current;let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;lp.forEach(p=>{if(p.x<mnX)mnX=p.x;if(p.y<mnY)mnY=p.y;if(p.x>mxX)mxX=p.x;if(p.y>mxY)mxY=p.y;});const x=Math.max(0,Math.floor(mnX)),y=Math.max(0,Math.floor(mnY)),w=Math.min(PW-x,Math.ceil(mxX)-x),h=Math.min(PH-y,Math.ceil(mxY)-y);if(w>5&&h>5){const c=canvasRef.current,ctx=c.getContext("2d");const id=ctx.getImageData(x,y,w,h);const mask=document.createElement("canvas");mask.width=w;mask.height=h;const mctx=mask.getContext("2d");mctx.beginPath();mctx.moveTo(lp[0].x-x,lp[0].y-y);for(let i=1;i<lp.length;i++)mctx.lineTo(lp[i].x-x,lp[i].y-y);mctx.closePath();mctx.fill();const md=mctx.getImageData(0,0,w,h).data;for(let i=0;i<md.length;i+=4){if(md[i+3]===0){id.data[i]=0;id.data[i+1]=0;id.data[i+2]=0;id.data[i+3]=0;}}ctx.save();ctx.beginPath();ctx.moveTo(lp[0].x,lp[0].y);for(let i=1;i<lp.length;i++)ctx.lineTo(lp[i].x,lp[i].y);ctx.closePath();ctx.fillStyle="#ffffff";ctx.fill();ctx.restore();const snap=document.createElement("canvas");snap.width=PW;snap.height=PH;snap.getContext("2d").drawImage(c,0,0);selSnap.current=snap;const tc=document.createElement("canvas");tc.width=w;tc.height=h;tc.getContext("2d").putImageData(id,0,0);ctx.drawImage(tc,x,y,w,h);const normL=lp.map(p=>({x:p.x-x,y:p.y-y}));setSelection({x,y,w,h,imageData:id,lasso:normL});const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.beginPath();octx.moveTo(lp[0].x,lp[0].y);for(let i=1;i<lp.length;i++)octx.lineTo(lp[i].x,lp[i].y);octx.closePath();octx.fillStyle="rgba(74,144,217,0.18)";octx.fill();octx.setLineDash([6,4]);octx.strokeStyle="#4a90d9";octx.lineWidth=2;octx.stroke();octx.restore();}else overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);lassoRef.current=[];isDrawing.current=false;return;}
    if(!isDrawing.current)return;
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart.current){const pos=getPos(e);overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);const ss=shapeStart.current;if(Math.abs(pos.x-ss.x)>3||Math.abs(pos.y-ss.y)>3){const ns={id:Date.now(),type:tool,x1:ss.x,y1:ss.y,x2:pos.x,y2:pos.y,color,fill:fillColor,strokeWidth:brushSize};setShapeInputs(p=>[...p,ns]);broadcast({t:'shp_add',obj:ns});/* Auto-switch to select & select the new shape (like Excalidraw) */setTool(T.SELECT);setSelectedShape(ns.id);}shapeStart.current=null;}
    if(tool===T.HIGHLIGHTER&&pathPts.current.length>1){const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.globalAlpha=.3;drawPath(ctx,pathPts.current,color,brushSize*3);ctx.restore();overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);broadcast({t:'hl',pts:pathPts.current.map(p=>({x:p.x,y:p.y})),c:colorRef.current,s:brushRef.current*3});}
    isDrawing.current=false;lastPoint.current=null;pathPts.current=[];autoPageFlag.current=false;saveHist();
    if(e.pointerType==="pen")releasePen();
  };

  /* Zoom: Ctrl+Wheel */
  useEffect(()=>{const el=scrollRef.current;if(!el)return;const h=(e)=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=el.getBoundingClientRect();const mx=e.clientX-r.left+el.scrollLeft,my=e.clientY-r.top+el.scrollTop;const oz=zoomRef.current,nz=Math.max(.3,Math.min(5,oz*(e.deltaY>0?.94:1/.94)));setZoom(nz);zoomRef.current=nz;requestAnimationFrame(()=>{el.scrollLeft=mx*(nz/oz)-(e.clientX-r.left);el.scrollTop=my*(nz/oz)-(e.clientY-r.top);});}};el.addEventListener("wheel",h,{passive:false});return()=>el.removeEventListener("wheel",h);},[]);

  /* Pinch zoom + two-finger scroll (iPad) */
  useEffect(()=>{const el=scrollRef.current;if(!el)return;
    const onTS=(e)=>{if(e.touches.length<2)return;e.preventDefault();
      if(isDrawing.current){isDrawing.current=false;lastPoint.current=null;pathPts.current=[];shapeStart.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);if(historyIndex>=0&&history[historyIndex])restoreImg(history[historyIndex]);}
      isPanning.current=false;
      const t1=e.touches[0],t2=e.touches[1];const dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
      const cx=(t1.clientX+t2.clientX)/2,cy=(t1.clientY+t2.clientY)/2;const r=el.getBoundingClientRect();
      pinchRef.current={dist,zoom:zoomRef.current,cx,cy,anchorX:cx-r.left+el.scrollLeft,anchorY:cy-r.top+el.scrollTop};
    };
    const onTM=(e)=>{if(e.touches.length<2||!pinchRef.current)return;e.preventDefault();
      const t1=e.touches[0],t2=e.touches[1];const dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
      const cx=(t1.clientX+t2.clientX)/2,cy=(t1.clientY+t2.clientY)/2;
      const scale=dist/pinchRef.current.dist;const nz=Math.max(.3,Math.min(5,pinchRef.current.zoom*scale));
      zoomRef.current=nz;setZoom(nz);
      const r=el.getBoundingClientRect();
      el.scrollLeft=pinchRef.current.anchorX*(nz/pinchRef.current.zoom)-(cx-r.left);
      el.scrollTop=pinchRef.current.anchorY*(nz/pinchRef.current.zoom)-(cy-r.top);
    };
    const onTE=(e)=>{if(e.touches.length<2)pinchRef.current=null;};
    el.addEventListener("touchstart",onTS,{passive:false});el.addEventListener("touchmove",onTM,{passive:false});
    el.addEventListener("touchend",onTE);el.addEventListener("touchcancel",onTE);
    return()=>{el.removeEventListener("touchstart",onTS);el.removeEventListener("touchmove",onTM);el.removeEventListener("touchend",onTE);el.removeEventListener("touchcancel",onTE);};
  },[]);

  useEffect(()=>{if(tool!==T.SELECT&&selection)commitSel();if(tool!==T.SELECT)setSelectedShape(null);if(tool!==T.TEXT&&tool!==T.SELECT){commitEditing();setSelectedText(null);}},[tool]);

  /* Update selected shape properties when color/fill/size changes */
  useEffect(()=>{if(selectedShape===null)return;setShapeInputs(p=>{const old=p.find(s=>s.id===selectedShape);if(!old||old.color===color&&old.fill===fillColor&&old.strokeWidth===brushSize)return p;const up=p.map(s=>s.id===selectedShape?{...s,color,fill:fillColor,strokeWidth:brushSize}:s);const sh=up.find(s=>s.id===selectedShape);if(sh)broadcast({t:'shp_upd',id:sh.id,obj:sh});return up;});},[color,fillColor,brushSize]);

  /* ═══ Persistence — FIX: ALL keyed by page ID, no stale closure ═══ */
  const collectState=useCallback(()=>{
    const pd={};
    pgRef.current.forEach((pg,i)=>{
      const c=cMap.current.get(pg.id);
      if(!c)return;
      const isCurrent=i===cpRef.current;
      const isDirty=dirtyPages.current.has(pg.id)||isCurrent;
      if(isDirty){pd[pg.id]={image:c.toDataURL(),texts:isCurrent?tiRef.current:(pdRef.current[pg.id]?.texts||[]),shapes:isCurrent?siRef.current:(pdRef.current[pg.id]?.shapes||[])};}
      else{pd[pg.id]=pdRef.current[pg.id]||{image:c.toDataURL(),texts:[],shapes:[]};}
    });
    dirtyPages.current.clear();
    pdRef.current=pd;
    return{version:9,folders:fldRef.current,pages:pgRef.current,currentPage:cpRef.current,pageData:pd,settings:{showGrid:sgRef.current,showRuled:srRef.current,dark:darkRef.current}};
  },[]); /* FIX: no deps — uses refs only, never stale */

  const saveIDB=useCallback(async()=>{try{const s=collectState();await idbSet("app_state",s);setSaveStatus("saved");setTimeout(()=>setSaveStatus("idle"),1500);}catch(e){console.error("Save failed:",e);}},[collectState]);

  const dlBackup=useCallback(()=>{try{const s=collectState();if(lastBackup.current&&Date.now()-lastBackup.current<10000)return;lastBackup.current=Date.now();const b=new Blob([JSON.stringify(s)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`ink-notes-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}catch(e){console.error(e);}},[collectState]);
  const manualSave=useCallback(()=>{lastBackup.current=null;dlBackup();},[dlBackup]);

  /* FIX: restoreState sets refs SYNCHRONOUSLY before React re-renders canvases */
  const restoreState=useCallback((s)=>{
    if(!s?.pages)return;
    /* Migrate v5 (index-keyed) to v6 (id-keyed) */
    let pd=s.pageData||{};
    const firstKey=Object.keys(pd)[0];
    if(firstKey!==undefined&&s.pages.length>0&&String(s.pages[0].id)!==String(firstKey)){
      const migrated={};
      s.pages.forEach((pg,i)=>{if(pd[i])migrated[pg.id]=pd[i];});
      pd=migrated;
    }
    /* Migrate to v7: add folders if missing */
    let flds=s.folders;
    let pgs=[...s.pages];
    if(!flds||!flds.length){
      flds=[{id:1,name:"My Notes",expanded:true}];
      pgs=pgs.map(pg=>pg.folderId?pg:{...pg,folderId:1});
    }else{
      pgs=pgs.map(pg=>pg.folderId?pg:{...pg,folderId:flds[0].id});
    }
    /* Set refs BEFORE state updates → canvases will find data in initC */
    pdRef.current=pd;
    fldRef.current=flds;
    pgRef.current=pgs;
    cpRef.current=s.currentPage||0;
    /* Now trigger re-render */
    setFolders([...flds]);
    setPages([...pgs]); /* spread to force new array identity */
    setCurrentPage(s.currentPage||0);
    /* Restore shapes for current page */
    const cpid=pgs[s.currentPage||0]?.id;
    setShapeInputs(cpid&&pd[cpid]?.shapes||[]);
    /* v8: grid/ruled moved from canvas-baked to CSS overlay — wipe old baked-in lines */
    if((s.version||0)<8){Object.keys(pd).forEach(k=>{pd[k]={texts:pd[k]?.texts||[]};});setShowGrid(false);setShowRuled(false);}
    else if(s.settings){setShowGrid(s.settings.showGrid||false);setShowRuled(s.settings.showRuled||false);}
    if(s.settings?.dark!==undefined)setDark(s.settings.dark);
  },[]);

  const handleUpload=useCallback((e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{const s=JSON.parse(ev.target.result);cMap.current.clear();oMap.current.clear();restoreState(s);idbSet("app_state",s);setShowUploadModal(false);}catch{alert("Invalid backup.");}};r.readAsText(f);},[restoreState]);

  /* Lifecycle */
  useEffect(()=>{(async()=>{try{const s=await idbGet("app_state");if(s?.pages){cMap.current.clear();oMap.current.clear();restoreState(s);}}catch(e){console.error("Restore failed:",e);}setAppReady(true);})();},[]);
  useEffect(()=>{if(!appReady)return;const i=setInterval(()=>{if(!isDrawing.current&&!isPanning.current)saveIDB();},10000);return()=>clearInterval(i);},[appReady,saveIDB]);
  const resetInact=useCallback(()=>{if(inactTimer.current)clearTimeout(inactTimer.current);inactTimer.current=setTimeout(()=>{if(!isDrawing.current)saveIDB();dlBackup();},INACTIVITY_TIMEOUT);},[saveIDB,dlBackup]);
  useEffect(()=>{const ev=["pointerdown","keydown"];ev.forEach(e=>window.addEventListener(e,resetInact));resetInact();return()=>{ev.forEach(e=>window.removeEventListener(e,resetInact));};},[resetInact]);
  useEffect(()=>{const bu=()=>{try{const s=collectState();const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>r.result.transaction(STORE,"readwrite").objectStore(STORE).put(s,"app_state");}catch{}};const vis=()=>{if(document.visibilityState==="hidden")saveIDB();};window.addEventListener("beforeunload",bu);document.addEventListener("visibilitychange",vis);return()=>{window.removeEventListener("beforeunload",bu);document.removeEventListener("visibilitychange",vis);};},[collectState,saveIDB]);

  const clearCanvas=()=>{const ctx=canvasRef.current?.getContext("2d");if(!ctx)return;ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);broadcast({t:'clear'});setTextInputs([]);setShapeInputs([]);setEditingText(null);setSelectedText(null);setSelectedShape(null);setSelection(null);selSnap.current=null;saveHist();};
  const savePD=useCallback(()=>{const pid=pages[currentPage]?.id;const c=canvasRef.current;if(!c||!pid)return;pdRef.current[pid]={image:c.toDataURL(),texts:textInputs,shapes:shapeInputs};},[currentPage,textInputs,shapeInputs,pages]);
  const switchPg=(i)=>{if(selection)commitSel();activatePage(i);const c=cMap.current.get(pages[i]?.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});};
  const addPg=(folderId)=>{savePD();const fid=folderId||pages[currentPage]?.folderId||folders[0]?.id||1;const folderPgCount=pages.filter(p=>p.folderId===fid).length;const np={id:Date.now(),name:`Page ${folderPgCount+1}`,folderId:fid};setPages(p=>[...p,np]);setFolders(f=>f.map(fl=>fl.id===fid?{...fl,expanded:true}:fl));setTimeout(()=>{const c=cMap.current.get(np.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});},200);};
  const deletePage=(pageIdx)=>{if(pages.length<=1){alert("Cannot delete the only page.");return;}savePD();const pg=pages[pageIdx];const newPages=pages.filter((_,i)=>i!==pageIdx);const newIdx=pageIdx>=newPages.length?newPages.length-1:pageIdx;cMap.current.delete(pg.id);oMap.current.delete(pg.id);delete pdRef.current[pg.id];setPages(newPages);setCurrentPage(newIdx);pgRef.current=newPages;cpRef.current=newIdx;const nPid=newPages[newIdx]?.id;canvasRef.current=cMap.current.get(nPid);overlayRef.current=oMap.current.get(nPid);setTextInputs(pdRef.current[nPid]?.texts||[]);setHistory([]);setHistoryIndex(-1);};
  const addFolder=()=>{const nf={id:Date.now(),name:`Folder ${folders.length+1}`,expanded:true};setFolders(f=>[...f,nf]);setRenamingFolder(nf.id);setRenameFolderValue(nf.name);setTimeout(()=>renameFolderRef.current?.focus(),50);};
  const deleteFolder=(folderId)=>{const folderPages=pages.filter(p=>p.folderId===folderId);const remaining=pages.filter(p=>p.folderId!==folderId);if(remaining.length===0){alert("Cannot delete the only folder with all pages.");return;}if(folderPages.length>0&&!confirm(`Delete folder and ${folderPages.length} page(s)?`))return;folderPages.forEach(pg=>{cMap.current.delete(pg.id);oMap.current.delete(pg.id);delete pdRef.current[pg.id];});const curPg=pages[currentPage];const newPages=remaining;let newIdx=newPages.findIndex(p=>p.id===curPg?.id);if(newIdx<0)newIdx=0;setFolders(f=>f.filter(fl=>fl.id!==folderId));setPages(newPages);setCurrentPage(newIdx);pgRef.current=newPages;cpRef.current=newIdx;const nPid=newPages[newIdx]?.id;canvasRef.current=cMap.current.get(nPid);overlayRef.current=oMap.current.get(nPid);setTextInputs(pdRef.current[nPid]?.texts||[]);setHistory([]);setHistoryIndex(-1);};
  const toggleFolder=(folderId)=>{setFolders(f=>f.map(fl=>fl.id===folderId?{...fl,expanded:!fl.expanded}:fl));};
  const startRename=(i)=>{setRenamingPage(i);setRenameValue(pages[i].name);setTimeout(()=>renameRef.current?.focus(),50);};
  const finishRename=()=>{if(renamingPage!==null&&renameValue.trim())setPages(p=>p.map((pg,i)=>i===renamingPage?{...pg,name:renameValue.trim()}:pg));setRenamingPage(null);};
  const startFolderRename=(fid)=>{const fl=folders.find(f=>f.id===fid);if(!fl)return;setRenamingFolder(fid);setRenameFolderValue(fl.name);setTimeout(()=>renameFolderRef.current?.focus(),50);};
  const finishFolderRename=()=>{if(renamingFolder!==null&&renameFolderValue.trim())setFolders(f=>f.map(fl=>fl.id===renamingFolder?{...fl,name:renameFolderValue.trim()}:fl));setRenamingFolder(null);};

  /* Export — bake text overlays into exported image */
  const getExportDataUrl=()=>{const c=canvasRef.current;if(!c)return"";const tc=document.createElement("canvas");tc.width=c.width;tc.height=c.height;const tctx=tc.getContext("2d");if(dark){tctx.filter="invert(1) hue-rotate(180deg)";tctx.drawImage(c,0,0);tctx.filter="none";}else{tctx.drawImage(c,0,0);}bakeShapes(tc,shapeInputs);bakeTexts(tc,textInputs);return tc.toDataURL();};
  const exportPng=()=>{const a=document.createElement("a");a.download=`note-page-${currentPage+1}.png`;a.href=getExportDataUrl();a.click();};
  const openEmailModal=()=>{setEmailSubject(`Ink Notes — ${pages[currentPage]?.name||"Page "+(currentPage+1)}`);setEmailTo("");setEmailPreview(getExportDataUrl());setShowEmailModal(true);};
  const sendEmail=async()=>{if(!emailTo.includes("@"))return;setEmailSending(true);try{const d=getExportDataUrl();if(navigator.share&&navigator.canShare){const bl=await(await fetch(d)).blob();const f=new File([bl],"note.png",{type:"image/png"});if(navigator.canShare({files:[f]})){try{await navigator.share({title:emailSubject,files:[f]});setShowEmailModal(false);setEmailSending(false);return;}catch{}}}const bl=await(await fetch(d)).blob();const u=URL.createObjectURL(bl);const a=document.createElement("a");a.href=u;a.download="note.png";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);window.open(`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}`,"_self");setShowEmailModal(false);}catch{}setEmailSending(false);};

  /* Grid/ruled — rendered as CSS overlays, NOT baked into canvas */

  /* Shortcuts */
  useEffect(()=>{const hd=(e)=>{const inInput=document.activeElement.tagName==="INPUT"||document.activeElement.tagName==="TEXTAREA";if(e.key===" "&&!inInput){e.preventDefault();spaceHeld.current=true;}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&e.shiftKey){e.preventDefault();redo();}if((e.metaKey||e.ctrlKey)&&e.key==="s"){e.preventDefault();manualSave();}if((e.metaKey||e.ctrlKey)&&e.key==="c"&&!inInput){if(selectedShape!==null){const sh=shapeInputs.find(s=>s.id===selectedShape);if(sh){clipboardRef.current={type:'shape',data:{...sh}};try{navigator.clipboard?.writeText(JSON.stringify({inkNotes:true,shapes:[sh]}));}catch{}}return;}if(selectedText!==null){const tx=textInputs.find(t=>t.id===selectedText);if(tx){clipboardRef.current={type:'text',data:{...tx}};try{navigator.clipboard?.writeText(tx.text);}catch{}}return;}}if((e.metaKey||e.ctrlKey)&&e.key==="v"&&!inInput){e.preventDefault();const cb=clipboardRef.current;if(cb?.type==='shape'){const off=30;const ns={...cb.data,id:Date.now(),x1:cb.data.x1+off,y1:cb.data.y1+off,x2:cb.data.x2+off,y2:cb.data.y2+off};setShapeInputs(p=>[...p,ns]);broadcast({t:'shp_add',obj:ns});setTool(T.SELECT);setSelectedShape(ns.id);clipboardRef.current={type:'shape',data:{...ns}};return;}if(cb?.type==='text'){const off=30;const nt={...cb.data,id:Date.now(),x:cb.data.x+off,y:cb.data.y+off};setTextInputs(p=>[...p,nt]);broadcast({t:'txt_add',obj:nt});setTool(T.SELECT);setSelectedText(nt.id);clipboardRef.current={type:'text',data:{...nt}};return;}}if((e.metaKey||e.ctrlKey)&&e.key==="d"&&!inInput){e.preventDefault();if(selectedShape!==null){const sh=shapeInputs.find(s=>s.id===selectedShape);if(sh){const off=30;const ns={...sh,id:Date.now(),x1:sh.x1+off,y1:sh.y1+off,x2:sh.x2+off,y2:sh.y2+off};setShapeInputs(p=>[...p,ns]);broadcast({t:'shp_add',obj:ns});setSelectedShape(ns.id);}return;}if(selectedText!==null){const tx=textInputs.find(t=>t.id===selectedText);if(tx){const off=30;const nt={...tx,id:Date.now(),x:tx.x+off,y:tx.y+off};setTextInputs(p=>[...p,nt]);broadcast({t:'txt_add',obj:nt});setSelectedText(nt.id);}return;}}if(e.key==="Escape"){if(editingText!==null){commitEditing();return;}if(selectedText!==null){setSelectedText(null);return;}if(selectedShape!==null){setSelectedShape(null);return;}if(selection)commitSel();}if((e.key==="Delete"||e.key==="Backspace")&&!inInput){if(selectedShape!==null){e.preventDefault();deleteShape(selectedShape);return;}if(selectedText!==null){e.preventDefault();deleteText(selectedText);return;}if(selection&&tool===T.SELECT){if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d");ctx.clearRect(0,0,PW,PH);ctx.drawImage(selSnap.current,0,0);saveHist();}setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);}}if(e.key==="Enter"&&selectedText!==null&&!inInput){e.preventDefault();setEditingText(selectedText);setSelectedText(null);}if(!e.metaKey&&!e.ctrlKey&&!inInput){const km={h:T.HAND,v:T.SELECT,p:T.PEN,e:T.ERASER,t:T.TEXT,r:T.RECT,o:T.CIRCLE,l:T.LINE,a:T.ARROW,d:T.DIAMOND};if(km[e.key.toLowerCase()]&&e.key!==" ")setTool(km[e.key.toLowerCase()]);}};const hu=(e)=>{if(e.key===" "){spaceHeld.current=false;isPanning.current=false;}};window.addEventListener("keydown",hd);window.addEventListener("keyup",hu);return()=>{window.removeEventListener("keydown",hd);window.removeEventListener("keyup",hu);};},[undo,redo,manualSave,selection,tool,commitSel,saveHist,editingText,selectedText,selectedShape,commitEditing,deleteText,deleteShape,shapeInputs,textInputs]);

  const getCursor=()=>{if(shouldPan())return isPanning.current?"grabbing":"grab";if(tool===T.TEXT)return"text";if(tool===T.ERASER)return"none";if(tool===T.SELECT)return selection?(isDraggingSel?"grabbing":"default"):"crosshair";return"crosshair";};
  const stMap={idle:{c:th.textMuted,t:"Saved"},saved:{c:th.success,t:"✓ Saved"},loaded:{c:th.accent,t:"Restored"}};const stI=stMap[saveStatus]||stMap.idle;
  const toolDock=[{id:T.HAND,icon:I.hand,tip:"Hand (H)"},{id:T.SELECT,icon:I.select,tip:"Lasso (V)"},"sep",{id:T.PEN,icon:I.pen,tip:"Pen (P)"},{id:T.HIGHLIGHTER,icon:I.highlighter,tip:"Highlight"},{id:T.ERASER,icon:I.eraser,tip:"Eraser (E)"},{id:T.TEXT,icon:I.text,tip:"Text (T)"},"sep",{id:T.LINE,icon:I.line,tip:"Line (L)"},{id:T.ARROW,icon:I.arrow,tip:"Arrow (A)"},{id:T.RECT,icon:I.rect,tip:"Rect (R)"},{id:T.DIAMOND,icon:I.diamond,tip:"Diamond (D)"},{id:T.CIRCLE,icon:I.circle,tip:"Ellipse (O)"}];

  /* ═══════ RENDER ═══════ */
  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:th.bg,fontFamily:'"DM Sans",system-ui,sans-serif',overflow:"hidden",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",WebkitTextSizeAdjust:"100%"}}>
      <style>{`
        *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important}
        textarea,input{-webkit-user-select:text!important;user-select:text!important}
        textarea::placeholder{color:${th.textMuted};opacity:.4}
        canvas{touch-action:none}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      {/* Upload Modal */}
      {showUploadModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"none"}} onClick={()=>setShowUploadModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"40px",maxWidth:"380px",width:"90%",boxShadow:th.shadowLg,textAlign:"center",border:`1px solid ${th.border}`}}><div style={{width:"52px",height:"52px",borderRadius:"16px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",color:"#fff"}}>{I.upload}</div><h2 style={{margin:"0 0 6px",fontSize:"18px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Restore Notes</h2><p style={{margin:"0 0 24px",fontSize:"13px",color:th.textSecondary}}>Upload a .json backup</p><input ref={fileRef} type="file" accept=".json" onChange={handleUpload} style={{display:"none"}}/><button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"14px",borderRadius:"14px",border:`2px dashed ${th.border}`,background:th.surfaceHover,cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.text,marginBottom:"10px",fontFamily:"inherit"}}>Choose File</button><button onClick={()=>setShowUploadModal(false)} style={{width:"100%",padding:"10px",borderRadius:"14px",border:"none",background:"transparent",cursor:"pointer",fontSize:"13px",color:th.textMuted}}>Cancel</button></div></div>}
      {/* Email Modal */}
      {showEmailModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"none"}} onClick={()=>setShowEmailModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"36px",maxWidth:"400px",width:"90%",boxShadow:th.shadowLg,border:`1px solid ${th.border}`}}><div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}><div style={{width:"44px",height:"44px",borderRadius:"14px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}>{I.mail}</div><div><h2 style={{margin:0,fontSize:"17px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Share Note</h2><p style={{margin:"2px 0 0",fontSize:"11px",color:th.textMuted}}>Send current page as image</p></div></div><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>To</label><input type="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="name@example.com" autoFocus onKeyDown={e=>{if(e.key==="Enter")sendEmail();if(e.key==="Escape")setShowEmailModal(false);}} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"14px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>Subject</label><input type="text" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"18px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/>{emailPreview&&<div style={{marginBottom:"18px",borderRadius:"12px",overflow:"hidden",border:`1px solid ${th.border}`,background:th.bg,padding:"8px",display:"flex",justifyContent:"center"}}><img src={emailPreview} alt="" style={{maxWidth:"100%",maxHeight:"100px",borderRadius:"8px",objectFit:"contain"}}/></div>}<div style={{display:"flex",gap:"10px"}}><button onClick={()=>setShowEmailModal(false)} style={{flex:1,padding:"12px",borderRadius:"12px",border:`1px solid ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.textSecondary,fontFamily:"inherit"}}>Cancel</button><button onClick={sendEmail} disabled={emailSending||!emailTo.includes("@")} style={{flex:2,padding:"12px",borderRadius:"12px",border:"none",cursor:emailTo.includes("@")?"pointer":"not-allowed",background:emailTo.includes("@")?th.accentGrad:th.surfaceActive,color:emailTo.includes("@")?"#fff":th.textMuted,fontSize:"13px",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>{emailSending?"Sending...":<>{I.send} Send</>}</button></div></div></div>}

      {/* Collab Panel */}
      {collabOpen&&<div onPointerDown={e=>e.stopPropagation()} style={{position:"fixed",top:compact?"auto":"56px",bottom:compact?"80px":"auto",right:compact?"10px":"20px",left:compact?"10px":"auto",width:compact?"auto":"280px",zIndex:9998,background:th.surface,borderRadius:"20px",padding:"24px",boxShadow:th.shadowLg,border:`1px solid ${th.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"12px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}>{I.collab}</div>
            <div><div style={{fontSize:"14px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif'}}>Collaborate</div>
            <div style={{fontSize:"10px",color:peerStatus==='connected'?"#34d399":th.textMuted,fontWeight:600}}>{peerStatus==='idle'?'Not connected':peerStatus==='hosting'?'Waiting for peer...':peerStatus==='joining'?'Connecting...':'Connected'}</div></div>
          </div>
          <button onClick={()=>setCollabOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:th.textMuted,fontSize:"18px",padding:"4px",lineHeight:1}}>&#x2715;</button>
        </div>
        {peerStatus==='idle'&&<>
          <button onClick={createRoom} style={{width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:th.accentGrad,color:"#fff",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:"12px",boxShadow:th.glow}}>Create Room</button>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}><div style={{flex:1,height:"1px",background:th.border}}/><span style={{fontSize:"10px",color:th.textMuted,fontWeight:600}}>OR</span><div style={{flex:1,height:"1px",background:th.border}}/></div>
          <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Code" maxLength={6} onKeyDown={e=>{if(e.key==='Enter')joinRoom();}} style={{flex:1,padding:"10px 12px",borderRadius:"10px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"13px",fontWeight:600,letterSpacing:"2px",textAlign:"center",outline:"none",fontFamily:"inherit",textTransform:"uppercase"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/>
            <button onClick={joinRoom} disabled={!joinCode.trim()} style={{padding:"10px 16px",borderRadius:"10px",border:"none",background:joinCode.trim()?th.accentGrad:th.surfaceActive,color:joinCode.trim()?"#fff":th.textMuted,fontSize:"12px",fontWeight:700,cursor:joinCode.trim()?"pointer":"not-allowed",fontFamily:"inherit"}}>Join</button>
          </div>
        </>}
        {peerStatus==='hosting'&&<div style={{textAlign:"center"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:"1px",marginBottom:"8px",textTransform:"uppercase"}}>Room Code</div>
          <div style={{fontSize:"28px",fontWeight:800,color:th.accent,letterSpacing:"6px",fontFamily:'"Space Mono",monospace',marginBottom:"12px"}}>{roomCode}</div>
          <button onClick={()=>{navigator.clipboard?.writeText(roomCode);}} style={{padding:"8px 20px",borderRadius:"10px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:"12px"}}>Copy Code</button>
          <div style={{fontSize:"11px",color:th.textMuted}}>Share this code with your collaborator</div>
          <button onClick={disconnectPeer} style={{marginTop:"12px",padding:"8px 16px",borderRadius:"10px",border:"none",background:th.danger+"20",color:th.danger,fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
        </div>}
        {peerStatus==='joining'&&<div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{width:"24px",height:"24px",border:`2.5px solid ${th.border}`,borderTopColor:th.accent,borderRadius:"50%",margin:"0 auto 12px",animation:"spin 1s linear infinite"}}/>
          <div style={{fontSize:"12px",color:th.textMuted}}>Connecting...</div>
        </div>}
        {peerStatus==='connected'&&<div style={{textAlign:"center"}}>
          <div style={{width:"40px",height:"40px",borderRadius:"50%",background:"rgba(52,211,153,.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><div style={{width:"12px",height:"12px",borderRadius:"50%",background:"#34d399"}}/></div>
          <div style={{fontSize:"13px",fontWeight:700,color:th.text,marginBottom:"4px"}}>Connected</div>
          <div style={{fontSize:"11px",color:th.textMuted,marginBottom:"16px"}}>Drawing syncs in real-time</div>
          <button onClick={disconnectPeer} style={{padding:"10px 24px",borderRadius:"10px",border:"none",background:th.danger+"20",color:th.danger,fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Disconnect</button>
        </div>}
      </div>}

      {/* ═══ TOP BAR ═══ */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:compact?"8px 12px":"10px 20px",pointerEvents:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{display:"flex",alignItems:"center",gap:"8px",background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"14px",padding:compact?"8px 12px":"8px 16px",cursor:"pointer",boxShadow:th.shadow}}><span style={{color:th.text}}>{I.menu}</span>{!tiny&&<span style={{fontFamily:'"Literata",Georgia,serif',fontSize:"14px",fontWeight:700,color:th.text,letterSpacing:"-.3px"}}>Ink Notes</span>}</button></div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><div style={{background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"10px",padding:"5px 12px",boxShadow:th.shadow,fontSize:"11px",fontWeight:600,color:stI.c,display:"flex",alignItems:"center",gap:"6px"}}><span>{stI.t}</span><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>Pg {(visiblePages.findIndex(p=>p._idx===currentPage)+1)||1}/{visiblePages.length}</span>{!compact&&<><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>🛡️ Palm</span></>}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"4px",pointerEvents:"auto"}}>{[{fn:undo,icon:I.undo,en:historyIndex>0},{fn:redo,icon:I.redo,en:historyIndex<history.length-1}].map((a,i)=>(<button key={i} onClick={a.fn} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:a.en?th.text:th.textMuted,opacity:a.en?1:.5}}>{a.icon}</button>))}<div style={{width:"4px"}}/><button onClick={()=>setCollabOpen(!collabOpen)} title="Collaborate" style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:peerStatus==='connected'?th.accentGrad:th.toolbar,backdropFilter:blur,boxShadow:peerStatus==='connected'?th.glow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:peerStatus==='connected'?"#fff":th.accent,position:"relative"}}>{I.collab}{peerStatus==='connected'&&<div style={{position:"absolute",top:"2px",right:"2px",width:"7px",height:"7px",borderRadius:"50%",background:"#34d399",border:`1.5px solid ${th.toolbar}`}}/>}</button><div style={{width:"4px"}}/><button onClick={()=>setDark(!dark)} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{dark?I.sun:I.moon}</button>{onHome&&<><div style={{width:"4px"}}/><button onClick={onHome} title="Back to home" style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{I.home}</button></>}</div>
      </div>

      {/* ═══ VERTICAL TOOL DOCK ═══ */}
      {!compact&&<div style={{position:"absolute",left:sidebarOpen?"256px":"16px",top:"50%",transform:"translateY(-50%)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:blurLg,border:`1px solid ${th.toolbarBorder}`,borderRadius:"20px",padding:"8px 6px",boxShadow:th.shadow,transition:"left .2s ease"}}>
        {toolDock.map((item,i)=>item==="sep"?<div key={i} style={{width:"22px",height:"1px",background:th.border,margin:"4px 0"}}/>:(<div key={item.id} style={{position:"relative"}} onMouseEnter={()=>setHoveredTool(item.id)} onMouseLeave={()=>setHoveredTool(null)}><button onClick={()=>setTool(item.id)} style={{width:"38px",height:"38px",borderRadius:"12px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:tool===item.id?th.glow:"none"}}>{item.icon}</button>{hoveredTool===item.id&&tool!==item.id&&<div style={{position:"absolute",left:"48px",top:"50%",transform:"translateY(-50%)",background:th.surface,border:`1px solid ${th.border}`,borderRadius:"8px",padding:"4px 10px",fontSize:"11px",fontWeight:600,color:th.text,whiteSpace:"nowrap",boxShadow:th.shadow,pointerEvents:"none",zIndex:200}}>{item.tip}</div>}</div>))}
      </div>}
      {compact&&<div style={{position:"absolute",top:"52px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:"2px",background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"16px",padding:"4px",boxShadow:th.shadow,overflowX:"auto",maxWidth:"calc(100vw - 24px)"}}>{toolDock.filter(t=>t!=="sep"&&![T.LINE,T.DIAMOND].includes(t?.id)).map(item=>(<button key={item.id} onClick={()=>setTool(item.id)} style={{width:"34px",height:"34px",borderRadius:"10px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:tool===item.id?th.glow:"none"}}>{item.icon}</button>))}</div>}

      {/* ═══ BOTTOM CONTEXT BAR ═══ */}
      <div style={{position:"absolute",bottom:compact?"10px":"16px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:compact?"6px":"10px",alignItems:"center",flexWrap:"wrap",justifyContent:"center",maxWidth:"calc(100vw - 32px)"}}>
        {(()=>{const selSh=selectedShape!==null?shapeInputs.find(s=>s.id===selectedShape):null;const showColor=!([T.ERASER,T.SELECT,T.HAND].includes(tool))||selSh;const showBrush=[T.PEN,T.HIGHLIGHTER,T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)||selSh;const showFill=[T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)||selSh&&[T.RECT,T.DIAMOND,T.CIRCLE].includes(selSh.type);return<>
        {showColor&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 12px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{COLORS.map((c,i)=>(<button key={i} onClick={()=>setColor(c)} style={{width:color===c?"22px":"16px",height:color===c?"22px":"16px",borderRadius:"50%",border:color===c?`2.5px solid ${th.accent}`:"2px solid transparent",background:c,cursor:"pointer",boxShadow:color===c?`0 0 8px ${c}40`:"none",flexShrink:0}}/>))}</div>}
        {showBrush&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{BRUSH_SIZES.map(sz=>(<button key={sz} onClick={()=>setBrushSize(sz)} style={{width:"28px",height:"28px",borderRadius:"9px",border:brushSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:brushSize===sz?th.accentSoft:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:Math.min(sz*1.5,14)+"px",height:Math.min(sz*1.5,14)+"px",borderRadius:"50%",background:color}}/></button>))}</div>}
        {showFill&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}><span style={{fontSize:"9px",fontWeight:700,color:th.textMuted,letterSpacing:".5px",marginRight:"2px"}}>FILL</span><button onClick={()=>setFillColor('transparent')} style={{width:fillColor==='transparent'?"22px":"16px",height:fillColor==='transparent'?"22px":"16px",borderRadius:"50%",border:fillColor==='transparent'?`2.5px solid ${th.accent}`:`1.5px solid ${th.border}`,background:"transparent",cursor:"pointer",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{position:"absolute",width:"70%",height:"1.5px",background:th.danger,transform:"rotate(-45deg)",borderRadius:"1px"}}/></button>{COLORS.map((c,i)=>(<button key={i} onClick={()=>setFillColor(c)} style={{width:fillColor===c?"22px":"16px",height:fillColor===c?"22px":"16px",borderRadius:"50%",border:fillColor===c?`2.5px solid ${th.accent}`:"2px solid transparent",background:c,cursor:"pointer",boxShadow:fillColor===c?`0 0 8px ${c}40`:"none",flexShrink:0}}/>))}</div>}
        </>;})()}
        {tool===T.ERASER&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{ERASER_SIZES.map(sz=>(<button key={sz} onClick={()=>setEraserSize(sz)} style={{width:"30px",height:"30px",borderRadius:"9px",border:eraserSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:eraserSize===sz?th.accentSoft:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:Math.min(sz*.5,18)+"px",height:Math.min(sz*.5,18)+"px",borderRadius:"4px",background:th.textMuted,opacity:.35}}/></button>))}<span style={{fontSize:"10px",color:th.textMuted,marginLeft:"2px"}}>{eraserSize}</span></div>}
        {tool===T.TEXT&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{FONT_SIZES.map(sz=>(<button key={sz} onClick={()=>setFontSize(sz)} style={{padding:"4px 7px",borderRadius:"8px",border:fontSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:fontSize===sz?th.accentSoft:"transparent",cursor:"pointer",fontSize:"10px",fontWeight:700,color:fontSize===sz?th.accent:th.textMuted,flexShrink:0}}>{sz}</button>))}</div>}
        <div style={{display:"flex",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:"4px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{[{fn:()=>{setShowGrid(!showGrid);setShowRuled(false);},icon:I.grid,active:showGrid,c:th.text},{fn:()=>{setShowRuled(!showRuled);setShowGrid(false);},icon:I.ruled,active:showRuled,c:th.text},"sep",{fn:manualSave,icon:I.save,c:th.success},{fn:()=>setShowUploadModal(true),icon:I.upload,c:th.accent},{fn:exportPng,icon:I.image,c:th.text},{fn:openEmailModal,icon:I.mail,c:th.accent},{fn:clearCanvas,icon:I.trash,c:th.danger}].map((a,i)=>a==="sep"?<div key={i} style={{width:"1px",height:"18px",background:th.border,margin:"0 2px"}}/>:(<button key={i} onClick={a.fn} style={{width:"30px",height:"30px",borderRadius:"9px",border:"none",background:a.active?th.accentGrad:"transparent",color:a.active?"#fff":a.c||th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:a.active?th.glow:"none"}}>{a.icon}</button>))}</div>
      </div>

      {/* ═══ ZOOM ═══ */}
      <div style={{position:"absolute",bottom:compact?"10px":"16px",right:compact?"10px":"20px",zIndex:100,display:"flex",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:blur,borderRadius:"12px",padding:"3px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>
        <button onClick={()=>setZoom(z=>Math.max(.3,z-.1))} style={{width:"28px",height:"28px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:th.text}}>{I.zoomOut}</button>
        <button onClick={()=>setZoom(1)} style={{padding:"2px 4px",background:"transparent",border:"none",fontSize:"10px",fontWeight:700,color:th.textSecondary,cursor:"pointer",minWidth:"38px",textAlign:"center"}}>{Math.round(zoom*100)}%</button>
        <button onClick={()=>setZoom(z=>Math.min(5,z+.1))} style={{width:"28px",height:"28px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:th.text}}>{I.zoomIn}</button>
      </div>
      <div style={{position:"absolute",bottom:compact?"52px":"18px",left:compact?"50%":"20px",transform:compact?"translateX(-50%)":"none",zIndex:100,fontSize:"10px",color:th.textMuted,fontWeight:600,opacity:.5,fontFamily:'"Literata",Georgia,serif',fontStyle:"italic"}}>Ink Notes</div>

      {/* ═══ MAIN AREA ═══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        {sidebarOpen&&<div style={{width:compact?"200px":"240px",background:th.surface,borderRight:`1px solid ${th.border}`,padding:`${compact?52:56}px 14px 14px`,overflowY:"auto",zIndex:90}}>
          <button onClick={addFolder} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",width:"100%",padding:"8px",marginBottom:"12px",borderRadius:"10px",border:`1.5px dashed ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:600,color:th.textMuted,fontFamily:"inherit"}}>{I.plus} New Folder</button>
          {folders.map(fl=>{const folderPages=pages.map((pg,i)=>({...pg,_idx:i})).filter(pg=>pg.folderId===fl.id);return(
            <div key={fl.id} style={{marginBottom:"6px"}}>
              {/* Folder header */}
              <div style={{display:"flex",alignItems:"center",borderRadius:"8px",padding:"2px 0",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.querySelectorAll('.fld-del,.fld-edit').forEach(b=>b.style.opacity='0.6');}} onMouseLeave={e=>{e.currentTarget.querySelectorAll('.fld-del,.fld-edit').forEach(b=>b.style.opacity='0');}}>
                <button onClick={()=>toggleFolder(fl.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 2px",color:th.textMuted,display:"flex",alignItems:"center",flexShrink:0}}>{fl.expanded?I.chevronDown:I.chevronRight}</button>
                {renamingFolder===fl.id?<input ref={renameFolderRef} value={renameFolderValue} onChange={e=>setRenameFolderValue(e.target.value)} onBlur={finishFolderRename} onKeyDown={e=>{if(e.key==="Enter")finishFolderRename();if(e.key==="Escape")setRenamingFolder(null);}} style={{flex:1,padding:"5px 8px",borderRadius:"6px",border:`2px solid ${th.accent}`,outline:"none",fontSize:"11px",fontWeight:700,color:th.text,background:th.accentSoft,fontFamily:"inherit"}}/>:<button onClick={()=>toggleFolder(fl.id)} onDoubleClick={()=>startFolderRename(fl.id)} style={{flex:1,textAlign:"left",padding:"5px 4px",borderRadius:"6px",border:"none",background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif',display:"flex",alignItems:"center",gap:"5px"}}><span style={{color:th.textMuted}}>{fl.expanded?I.folderOpen:I.folder}</span>{fl.name}</button>}
                <button className="fld-edit" onClick={(e)=>{e.stopPropagation();startFolderRename(fl.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:"3px",color:th.textMuted,opacity:0,flexShrink:0,transition:"opacity .15s"}}>{I.edit}</button>
                <button className="fld-del" onClick={(e)=>{e.stopPropagation();deleteFolder(fl.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:"3px",color:th.danger,opacity:0,flexShrink:0,transition:"opacity .15s"}}>{I.trash}</button>
              </div>
              {/* Pages in folder */}
              {fl.expanded&&<div style={{paddingLeft:"12px"}}>
                {folderPages.map(pg=>{const i=pg._idx;return(
                  <div key={pg.id} style={{display:"flex",alignItems:"center",marginBottom:"1px",borderRadius:"8px",background:currentPage===i?th.surfaceHover:"transparent"}} onMouseEnter={e=>e.currentTarget.querySelector('.pg-del')&&(e.currentTarget.querySelector('.pg-del').style.opacity='0.6')} onMouseLeave={e=>e.currentTarget.querySelector('.pg-del')&&(e.currentTarget.querySelector('.pg-del').style.opacity='0')}>
                    {renamingPage===i?<input ref={renameRef} value={renameValue} onChange={e=>setRenameValue(e.target.value)} onBlur={finishRename} onKeyDown={e=>{if(e.key==="Enter")finishRename();if(e.key==="Escape")setRenamingPage(null);}} style={{flex:1,padding:"6px 8px",borderRadius:"6px",border:`2px solid ${th.accent}`,outline:"none",fontSize:"11px",fontWeight:600,color:th.text,background:th.accentSoft,fontFamily:"inherit"}}/>:<button onClick={()=>switchPg(i)} onDoubleClick={()=>startRename(i)} style={{flex:1,textAlign:"left",padding:"7px 10px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:currentPage===i?700:500,color:currentPage===i?th.text:th.textSecondary,fontFamily:'"Literata",Georgia,serif'}}>{pg.name}</button>}
                    {renamingPage!==i&&<button onClick={()=>startRename(i)} style={{background:"none",border:"none",cursor:"pointer",padding:"3px 4px",color:th.textMuted,opacity:currentPage===i?.7:.2,flexShrink:0}}>{I.edit}</button>}
                    <button className="pg-del" onClick={(e)=>{e.stopPropagation();deletePage(i);}} style={{background:"none",border:"none",cursor:"pointer",padding:"3px 4px",color:th.danger,opacity:0,flexShrink:0,transition:"opacity .15s"}}>{I.trash}</button>
                  </div>);})}
                <button onClick={()=>addPg(fl.id)} style={{display:"flex",alignItems:"center",gap:"4px",width:"100%",padding:"6px 10px",marginTop:"2px",borderRadius:"8px",border:"none",background:"transparent",cursor:"pointer",fontSize:"10px",fontWeight:600,color:th.textMuted,fontFamily:"inherit",opacity:.6}}>{I.plus} New Page</button>
              </div>}
            </div>);})}
          <div style={{marginTop:"24px",paddingTop:"16px",borderTop:`1px solid ${th.border}`,textAlign:"center"}}><div style={{fontSize:"13px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif'}}>Ink Notes</div></div>
        </div>}

        {/* ═══ SCROLLABLE PAGE STACK ═══ */}
        <div ref={scrollRef} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp} style={{flex:1,overflow:"auto",cursor:getCursor(),background:dark?"#0e0c0a":th.bg,position:"relative",touchAction:"none"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:`${PAGE_PAD}px`,minWidth:dW>baseW?`${dW+PAGE_PAD*2}px`:undefined,paddingTop:`${compact?100:60}px`,paddingBottom:"200px"}}>
            {visiblePages.map((pg,vIdx)=>{const idx=pg._idx;return(
              <div key={pg.id}>
                {vIdx>0&&<div style={{display:"flex",alignItems:"center",gap:"12px",padding:`${PAGE_GAP/2}px 0`,width:dW+"px",maxWidth:"100%",userSelect:"none"}}><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/><span style={{fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:"1.5px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{pg.name}</span><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/></div>}
                <div style={{width:dW+"px",height:dH+"px",position:"relative",borderRadius:Math.max(4,8*zoom)+"px",overflow:"hidden",boxShadow:compact?"0 0 0 1px rgba(0,0,0,0.06)":th.pageShadow,background:"#fff",touchAction:"none"}}>
                  <div style={{width:"100%",height:"100%",filter:dark?"invert(1) hue-rotate(180deg)":"none"}}>
                    <canvas ref={el=>initC(el,pg.id)} style={{width:"100%",height:"100%",display:"block"}}/>
                    {showGrid&&<div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`linear-gradient(to right,#e0ddd6 0.5px,transparent 0.5px),linear-gradient(to bottom,#e0ddd6 0.5px,transparent 0.5px)`,backgroundSize:`${24*dW/PW}px ${24*dW/PW}px`}}/>}
                    {showRuled&&<div style={{position:"absolute",inset:0,pointerEvents:"none"}}><div style={{position:"absolute",inset:0,backgroundImage:`repeating-linear-gradient(180deg,transparent 0px,transparent ${32*dW/PW-.7}px,#c8d0d8 ${32*dW/PW-.7}px,#c8d0d8 ${32*dW/PW}px)`,backgroundPosition:`0 ${80*dW/PW}px`}}/><div style={{position:"absolute",left:60*dW/PW+"px",top:40*dW/PW+"px",bottom:20*dW/PW+"px",width:"1px",background:"#d8a0a0"}}/></div>}
                    {currentPage===idx&&<canvas ref={el=>initO(el,pg.id)} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none"}}/>}
                  </div>
                  {currentPage===idx&&<div style={{position:"absolute",top:0,left:0,right:0,height:Math.max(2,3*zoom)+"px",background:th.accentGrad,transition:"opacity .2s"}}/>}
                  {/* ═══ SVG Shape Layer ═══ */}
                  {currentPage===idx&&shapeInputs.length>0&&<svg viewBox={`0 0 ${PW} ${PH}`} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:15}} xmlns="http://www.w3.org/2000/svg">
                    {shapeInputs.map(s=>{const isSel=selectedShape===s.id;const sc=dark?invertHex(s.color):s.color;const sf=s.fill&&s.fill!=='transparent'?(dark?invertHex(s.fill):s.fill):'none';return(<g key={s.id}>
                      {s.type===T.RECT&&<rect x={Math.min(s.x1,s.x2)} y={Math.min(s.y1,s.y2)} width={Math.abs(s.x2-s.x1)} height={Math.abs(s.y2-s.y1)} stroke={sc} strokeWidth={s.strokeWidth} fill={sf} strokeLinecap="round" strokeLinejoin="round"/>}
                      {s.type===T.CIRCLE&&<ellipse cx={(s.x1+s.x2)/2} cy={(s.y1+s.y2)/2} rx={Math.abs(s.x2-s.x1)/2} ry={Math.abs(s.y2-s.y1)/2} stroke={sc} strokeWidth={s.strokeWidth} fill={sf} strokeLinecap="round"/>}
                      {s.type===T.DIAMOND&&<polygon points={`${(s.x1+s.x2)/2},${Math.min(s.y1,s.y2)} ${Math.max(s.x1,s.x2)},${(s.y1+s.y2)/2} ${(s.x1+s.x2)/2},${Math.max(s.y1,s.y2)} ${Math.min(s.x1,s.x2)},${(s.y1+s.y2)/2}`} stroke={sc} strokeWidth={s.strokeWidth} fill={sf} strokeLinecap="round" strokeLinejoin="round"/>}
                      {s.type===T.LINE&&<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={sc} strokeWidth={s.strokeWidth} strokeLinecap="round"/>}
                      {s.type===T.ARROW&&<>{(() => {const a=Math.atan2(s.y2-s.y1,s.x2-s.x1),hl=14+s.strokeWidth*2;return<><line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={sc} strokeWidth={s.strokeWidth} strokeLinecap="round"/><polygon points={`${s.x2},${s.y2} ${s.x2-hl*Math.cos(a-.4)},${s.y2-hl*Math.sin(a-.4)} ${s.x2-hl*Math.cos(a+.4)},${s.y2-hl*Math.sin(a+.4)}`} fill={sc}/></>;})()}</>}
                      {isSel&&<>{s.type===T.LINE||s.type===T.ARROW?<><line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#4a90d9" strokeWidth={2} strokeDasharray="8 4" fill="none"/>
                        {[{h:'p1',cx:s.x1,cy:s.y1},{h:'p2',cx:s.x2,cy:s.y2}].map(hp=><rect key={hp.h} x={hp.cx-8} y={hp.cy-8} width={16} height={16} rx={3} fill="#fff" stroke="#4a90d9" strokeWidth={2} style={{pointerEvents:'auto',cursor:'pointer'}} onPointerDown={ev=>{ev.stopPropagation();setResizingHandle(hp.h);resizeShapeStart.current={mx:ev.clientX,my:ev.clientY,shape:{...s},handle:hp.h};}}/>)}</>
                      :<><rect x={Math.min(s.x1,s.x2)} y={Math.min(s.y1,s.y2)} width={Math.abs(s.x2-s.x1)} height={Math.abs(s.y2-s.y1)} stroke="#4a90d9" strokeWidth={2} strokeDasharray="8 4" fill="none"/>
                        {[{h:'tl',cx:Math.min(s.x1,s.x2),cy:Math.min(s.y1,s.y2)},{h:'tr',cx:Math.max(s.x1,s.x2),cy:Math.min(s.y1,s.y2)},{h:'bl',cx:Math.min(s.x1,s.x2),cy:Math.max(s.y1,s.y2)},{h:'br',cx:Math.max(s.x1,s.x2),cy:Math.max(s.y1,s.y2)}].map(hp=><rect key={hp.h} x={hp.cx-8} y={hp.cy-8} width={16} height={16} rx={3} fill="#fff" stroke="#4a90d9" strokeWidth={2} style={{pointerEvents:'auto',cursor:'nwse-resize'}} onPointerDown={ev=>{ev.stopPropagation();setResizingHandle(hp.h);resizeShapeStart.current={mx:ev.clientX,my:ev.clientY,shape:{...s},handle:hp.h};}}/>)}</>}</>}
                    </g>);})}
                  </svg>}
                  {currentPage===idx&&textInputs.map(inp=>{const sx=inp.x/PW*dW,sy=inp.y/PH*dH,fs=inp.fontSize/PW*dW;const isEditing=editingText===inp.id;const isSelected=selectedText===inp.id;return(
                    <div key={inp.id} style={{position:"absolute",left:sx+"px",top:sy+"px",zIndex:isEditing?22:20,pointerEvents:isEditing?"auto":"none"}}>
                      {/* Selection outline — blue box */}
                      {isSelected&&!isEditing&&<div style={{position:"absolute",inset:"-5px",border:"1.5px solid #4a90d9",borderRadius:"2px",pointerEvents:"none"}}/>}
                      {isEditing?
                        /* ═══ WYSIWYG Editor — transparent, borderless, auto-sizing ═══ */
                        <textarea autoFocus dir="auto" value={inp.text} placeholder="Type..."
                          onChange={e=>{setTextInputs(p=>p.map(t=>t.id===inp.id?{...t,text:e.target.value}:t));broadcast({t:'txt_upd',id:inp.id,text:e.target.value});const ta=e.target;ta.style.height="auto";ta.style.height=ta.scrollHeight+"px";const m=document.createElement("canvas").getContext("2d");m.font=`${fs}px "Literata",Georgia,serif`;const maxW=Math.max(fs*4,...e.target.value.split("\n").map(l=>m.measureText(l||" ").width));ta.style.width=(maxW+8)+"px";}}
                          onFocus={e=>{const ta=e.target;ta.style.height="auto";ta.style.height=ta.scrollHeight+"px";if(inp.text){const m=document.createElement("canvas").getContext("2d");m.font=`${fs}px "Literata",Georgia,serif`;const maxW=Math.max(fs*4,...inp.text.split("\n").map(l=>m.measureText(l||" ").width));ta.style.width=(maxW+8)+"px";}}}
                          onBlur={()=>{const t=textInputs.find(t=>t.id===inp.id);if(t&&!t.text.trim()){setTextInputs(p=>p.filter(x=>x.id!==inp.id));}setEditingText(null);}}
                          onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();e.target.blur();}if(e.key==="Tab"){e.preventDefault();const ta=e.target,s=ta.selectionStart,v=ta.value;setTextInputs(p=>p.map(t=>t.id===inp.id?{...t,text:v.substring(0,s)+"    "+v.substring(ta.selectionEnd)}:t));setTimeout(()=>{ta.selectionStart=ta.selectionEnd=s+4;},0);}}}
                          onPointerDown={e=>e.stopPropagation()}
                          style={{fontSize:fs+"px",color:dark?invertHex(inp.color):inp.color,fontFamily:'"Literata",Georgia,serif',background:"transparent",border:"none",outline:"none",padding:"1px 2px",margin:0,minWidth:(fs*4)+"px",minHeight:(fs*1.4)+"px",resize:"none",lineHeight:"1.4",display:"block",whiteSpace:"pre",wordBreak:"normal",overflow:"hidden",boxSizing:"content-box",caretColor:dark?invertHex(inp.color):inp.color,letterSpacing:"inherit"}}/>
                      :
                        /* ═══ Rendered text — clean, no border ═══ */
                        <div style={{fontSize:fs+"px",color:dark?invertHex(inp.color):inp.color,fontFamily:'"Literata",Georgia,serif',padding:"1px 2px",lineHeight:"1.4",whiteSpace:"pre-wrap",wordBreak:"break-word",userSelect:"none",WebkitUserSelect:"none",cursor:(tool===T.TEXT||tool===T.SELECT)?(isSelected?"move":"default"):"default",minHeight:(fs*1.4)+"px"}}>{inp.text||""}</div>
                      }
                    </div>);})}
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

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