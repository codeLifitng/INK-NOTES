import { useState, useRef, useCallback, useEffect } from "react";
import { idbSet, idbGet, DB_NAME, DB_VERSION, STORE } from "./lib/db";
import { themes } from "./lib/themes";
import { COLORS, BRUSH_SIZES, ERASER_SIZES, FONT_SIZES, invertHex, T, INACTIVITY_TIMEOUT, PW, PH, PAGE_PAD, PAGE_GAP, AUTO_ZONE } from "./lib/constants";
import { I } from "./lib/icons";
import { drawSeg, drawPath, drawArrow, drawDiamond } from "./lib/drawing";

/* ══════════════ App ══════════════ */
export default function NoteApp({onHome}) {
  const cMap=useRef(new Map()),oMap=useRef(new Map());
  const canvasRef=useRef(null),overlayRef=useRef(null);
  const scrollRef=useRef(null),eraserCursorRef=useRef(null);

  /* ═══ State — only things that MUST trigger re-render ═══ */
  const [dark,setDark]=useState(false);
  const [tool,setTool]=useState(T.PEN);
  const [color,setColor]=useState(COLORS[0]),[brushSize,setBrushSize]=useState(4),[eraserSize,setEraserSize]=useState(24),[fontSize,setFontSize]=useState(24);
  const [history,setHistory]=useState([]),[historyIndex,setHistoryIndex]=useState(-1);
  const [folders,setFolders]=useState([{id:1,name:"My Notes",expanded:true}]);
  const [pages,setPages]=useState([{id:1,name:"Page 1",folderId:1}]),[currentPage,setCurrentPage]=useState(0);
  const [renamingFolder,setRenamingFolder]=useState(null),[renameFolderValue,setRenameFolderValue]=useState("");
  const [showGrid,setShowGrid]=useState(false),[showRuled,setShowRuled]=useState(false);
  const [textInputs,setTextInputs]=useState([]),[editingText,setEditingText]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle"),[showUploadModal,setShowUploadModal]=useState(false);
  const [showEmailModal,setShowEmailModal]=useState(false),[emailTo,setEmailTo]=useState(""),[emailSubject,setEmailSubject]=useState("");
  const [emailSending,setEmailSending]=useState(false),[emailPreview,setEmailPreview]=useState(""),[appReady,setAppReady]=useState(false);
  const [renamingPage,setRenamingPage]=useState(null),[renameValue,setRenameValue]=useState("");
  const [selection,setSelection]=useState(null),[isDraggingSel,setIsDraggingSel]=useState(false),[selStart,setSelStart]=useState(null);
  const selSnap=useRef(null);
  const [zoom,setZoom]=useState(1),[baseW,setBaseW]=useState(800),[hoveredTool,setHoveredTool]=useState(null);
  const [winW,setWinW]=useState(typeof window!=="undefined"?window.innerWidth:1200);
  const [penActive,setPenActive]=useState(false);

  /* ═══ Refs — perf-critical, must NOT trigger re-render ═══ */
  const isDrawing=useRef(false);      /* FIX: was useState → re-rendered every stroke */
  const shapeStart=useRef(null);       /* FIX: was useState → re-rendered on shape draw */
  const pressureRef=useRef(1);
  const isPanning=useRef(false),panStart=useRef({x:0,y:0}),spaceHeld=useRef(false);
  const lastPoint=useRef(null),pathPts=useRef([]),inactTimer=useRef(null),lastBackup=useRef(null);
  const fileRef=useRef(null),renameRef=useRef(null),renameFolderRef=useRef(null),penDet=useRef(false),penTO=useRef(null);
  const autoPageFlag=useRef(false),dirtyPages=useRef(new Set()),pinchRef=useRef(null);
  const rectCache=useRef(null),rectFrame=useRef(0);
  const zoomRef=useRef(1);
  /* FIX: pageData keyed by PAGE ID, not index */
  const pdRef=useRef({});
  const fldRef=useRef(folders);
  const pgRef=useRef(pages),cpRef=useRef(currentPage),tiRef=useRef(textInputs);
  const sgRef=useRef(showGrid),srRef=useRef(showRuled),darkRef=useRef(dark);
  const toolRef=useRef(tool),colorRef=useRef(color),brushRef=useRef(brushSize),eraserRef=useRef(eraserSize);

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
    const ctx=el.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);
    /* FIX: lookup by page ID — no pgRef dependency, no race condition */
    const saved=pdRef.current[pid];
    if(saved?.image){const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,PW,PH);};img.src=saved.image;}
  },[]);
  const initO=useCallback((el,pid)=>{
    if(!el){oMap.current.delete(pid);return;}if(oMap.current.get(pid)===el)return;oMap.current.set(pid,el);
    el.width=PW;el.height=PH;
  },[]);

  /* ═══ Coordinates ═══ */
  const getPageAtPt=(e)=>{for(let i=0;i<pages.length;i++){const c=cMap.current.get(pages[i].id);if(!c)continue;const r=c.getBoundingClientRect();if(e.clientY>=r.top&&e.clientY<=r.bottom&&e.clientX>=r.left&&e.clientX<=r.right)return i;}return-1;};
  const getPos=(e)=>{const c=canvasRef.current;if(!c)return{x:0,y:0,pressure:.5};const now=performance.now();if(!rectCache.current||now-rectFrame.current>100){rectCache.current=c.getBoundingClientRect();rectFrame.current=now;}const r=rectCache.current;const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH,pressure:e.pressure??.5};};
  const detectPen=(e)=>{if(e.pointerType!=="pen")return;if(!penDet.current){penDet.current=true;setPenActive(true);}if(penTO.current)clearTimeout(penTO.current);penTO.current=null;};
  const releasePen=()=>{if(!penDet.current)return;if(penTO.current)clearTimeout(penTO.current);penTO.current=setTimeout(()=>{penDet.current=false;setPenActive(false);},5000);};
  const isPalm=(e)=>{if(e.pointerType==="pen")return false;return penDet.current&&e.pointerType==="touch";};
  const shouldPan=()=>tool===T.HAND||spaceHeld.current;

  /* ═══ History ═══ */
  const saveHist=useCallback(()=>{const c=canvasRef.current;if(!c)return;const pid=pgRef.current[cpRef.current]?.id;if(pid)dirtyPages.current.add(pid);requestAnimationFrame(()=>{const d=c.toDataURL();setHistory(p=>{const h=p.slice(0,historyIndex+1);h.push(d);return h.length>20?h.slice(-20):h;});setHistoryIndex(p=>Math.min(p+1,19));});},[historyIndex]);
  const restoreImg=(src)=>{const img=new Image();img.onload=()=>{const c=canvasRef.current,ctx=c.getContext("2d");ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);};img.src=src;};
  const undo=useCallback(()=>{if(historyIndex<=0)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex-1]);setHistoryIndex(i=>i-1);},[history,historyIndex]);
  const redo=useCallback(()=>{if(historyIndex>=history.length-1)return;setSelection(null);selSnap.current=null;restoreImg(history[historyIndex+1]);setHistoryIndex(i=>i+1);},[history,historyIndex]);

  /* Selection */
  const commitSel=useCallback(()=>{if(!selection?.imageData)return;const c=canvasRef.current,ctx=c.getContext("2d");const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x,selection.y,selection.w,selection.h);setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);saveHist();},[selection,saveHist]);
  const inSel=(p)=>selection&&p.x>=selection.x&&p.x<=selection.x+selection.w&&p.y>=selection.y&&p.y<=selection.y+selection.h;

  /* Text */
  const commitText=(inp)=>{if(!inp.text.trim())return;const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.font=`${inp.fontSize}px "Literata",Georgia,serif`;ctx.fillStyle=inp.color;ctx.textBaseline="top";inp.text.split("\n").forEach((l,i)=>ctx.fillText(l,inp.x,inp.y+i*inp.fontSize*1.3));ctx.restore();saveHist();};
  const textBlur=(id)=>{const inp=textInputs.find(t=>t.id===id);if(inp){commitText(inp);setTextInputs(p=>p.filter(t=>t.id!==id));}setEditingText(null);};

  /* ═══ Switch active page — FIX: save by page ID ═══ */
  const activatePage=useCallback((idx)=>{
    if(idx===currentPage||idx<0||idx>=pages.length)return;
    const curPid=pages[currentPage]?.id;
    const c=canvasRef.current;
    if(c&&curPid){pdRef.current[curPid]={image:c.toDataURL(),texts:textInputs};dirtyPages.current.delete(curPid);}
    setCurrentPage(idx);
    const pid=pages[idx].id;canvasRef.current=cMap.current.get(pid);overlayRef.current=oMap.current.get(pid);
    setTextInputs(pdRef.current[pid]?.texts||[]);setHistory([]);setHistoryIndex(-1);setSelection(null);selSnap.current=null;
  },[currentPage,pages,textInputs]);

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
    if(tool===T.SELECT){if(selection&&inSel(pos)){setIsDraggingSel(true);lastPoint.current=pos;return;}if(selection)commitSel();setSelStart(pos);isDrawing.current=true;return;}
    if(selection)commitSel();
    if(tool===T.TEXT){setTextInputs(p=>[...p,{id:Date.now(),x:pos.x,y:pos.y,text:"",color,fontSize}]);setEditingText(Date.now());return;}
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)){shapeStart.current=pos;isDrawing.current=true;return;}
    isDrawing.current=true;lastPoint.current=pos;pathPts.current=[pos];
    if(tool===T.ERASER){const ctx=c.getContext("2d");ctx.save();ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(pos.x,pos.y,eraserSize,0,Math.PI*2);ctx.fill();ctx.restore();}
  };

  const handleMove=(e)=>{e.preventDefault();if(pinchRef.current)return;
    if(!isDrawing.current&&!isPanning.current&&isPalm(e))return;
    if(isPanning.current){const el=scrollRef.current;el.scrollLeft-=(e.clientX-panStart.current.x);el.scrollTop-=(e.clientY-panStart.current.y);panStart.current={x:e.clientX,y:e.clientY};return;}
    const pos=getPos(e);
    /* Auto-create page near bottom of last page — debounced */
    if(isDrawing.current&&currentPage===pages.length-1&&pos.y>PH-AUTO_ZONE&&![T.SELECT,T.HAND].includes(tool)&&!autoPageFlag.current){
      autoPageFlag.current=true;
      const curFid=pgRef.current[cpRef.current]?.folderId||1;
      setPages(p=>[...p,{id:Date.now(),name:`Page ${p.length+1}`,folderId:curFid}]);
      setTimeout(()=>scrollRef.current?.scrollBy({top:200,behavior:"smooth"}),150);
    }
    if(tool===T.SELECT&&isDraggingSel&&selection){const dx=pos.x-lastPoint.current.x,dy=pos.y-lastPoint.current.y;setSelection(p=>({...p,x:p.x+dx,y:p.y+dy}));if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d");const img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);const tc=document.createElement("canvas");tc.width=selection.imageData.width;tc.height=selection.imageData.height;tc.getContext("2d").putImageData(selection.imageData,0,0);ctx.drawImage(tc,selection.x+dx,selection.y+dy,selection.w,selection.h);};img.src=selSnap.current;}lastPoint.current=pos;const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.strokeRect(selection.x+dx,selection.y+dy,selection.w,selection.h);octx.restore();return;}
    if(tool===T.SELECT&&isDrawing.current&&selStart){const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.fillStyle="rgba(192,104,48,0.06)";const x=Math.min(selStart.x,pos.x),y=Math.min(selStart.y,pos.y),w=Math.abs(pos.x-selStart.x),h=Math.abs(pos.y-selStart.y);octx.fillRect(x,y,w,h);octx.strokeRect(x,y,w,h);octx.restore();return;}
    if(!isDrawing.current)return;const pv=pos.pressure||pressureRef.current;pressureRef.current=pv;
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart.current){const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();const ss=shapeStart.current;if(tool===T.LINE){octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.moveTo(ss.x,ss.y);octx.lineTo(pos.x,pos.y);octx.stroke();}else if(tool===T.ARROW)drawArrow(octx,ss.x,ss.y,pos.x,pos.y,color,brushSize);else if(tool===T.RECT){octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.strokeRect(ss.x,ss.y,pos.x-ss.x,pos.y-ss.y);}else if(tool===T.DIAMOND)drawDiamond(octx,ss.x,ss.y,pos.x-ss.x,pos.y-ss.y,color,brushSize);else if(tool===T.CIRCLE){const rx=Math.abs(pos.x-ss.x)/2,ry=Math.abs(pos.y-ss.y)/2;octx.strokeStyle=color;octx.lineWidth=brushSize;octx.lineCap="round";octx.beginPath();octx.ellipse(ss.x+(pos.x-ss.x)/2,ss.y+(pos.y-ss.y)/2,rx,ry,0,0,Math.PI*2);octx.stroke();}octx.restore();return;}
    if(tool===T.ERASER){const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.fillStyle="#ffffff";
      const evts=e.getCoalescedEvents?e.getCoalescedEvents():[];const pts=evts.length>1?evts.map(ce=>{const t=ce.touches?ce.touches[0]:ce;const r=rectCache.current;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH};}):[pos];
      let lp=lastPoint.current;for(const p of pts){const dx=p.x-lp.x,dy=p.y-lp.y,d=Math.sqrt(dx*dx+dy*dy),st=Math.max(1,Math.floor(d/2));for(let i=0;i<=st;i++){const t=i/st;ctx.beginPath();ctx.arc(lp.x+dx*t,lp.y+dy*t,eraserSize,0,Math.PI*2);ctx.fill();}lp=p;}ctx.restore();}
    else if(tool===T.PEN){const ctx=canvasRef.current.getContext("2d");ctx.save();
      const evts=e.getCoalescedEvents?e.getCoalescedEvents():[];const pts=evts.length>1?evts.map(ce=>{const t=ce.touches?ce.touches[0]:ce;const r=rectCache.current;return{x:(t.clientX-r.left)/r.width*PW,y:(t.clientY-r.top)/r.height*PH,pressure:ce.pressure||pv};}):[pos];
      let lp=lastPoint.current;for(const p of pts){drawSeg(ctx,lp,p,color,brushSize,p.pressure||pv);pathPts.current.push(p);lp=p;}ctx.restore();}
    else if(tool===T.HIGHLIGHTER){pathPts.current.push(pos);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.globalAlpha=.3;drawPath(octx,pathPts.current,color,brushSize*3);octx.restore();}
    lastPoint.current=pos;
  };

  const handleUp=(e)=>{
    if(isPanning.current){isPanning.current=false;return;}
    if(tool===T.SELECT&&isDraggingSel){setIsDraggingSel(false);lastPoint.current=null;return;}
    if(tool===T.SELECT&&isDrawing.current&&selStart){const pos=getPos(e),x=Math.min(selStart.x,pos.x),y=Math.min(selStart.y,pos.y),w=Math.abs(pos.x-selStart.x),h=Math.abs(pos.y-selStart.y);if(w>5&&h>5){const c=canvasRef.current,ctx=c.getContext("2d");const id=ctx.getImageData(x,y,w,h);selSnap.current=c.toDataURL();ctx.fillStyle="#ffffff";ctx.fillRect(x,y,w,h);selSnap.current=c.toDataURL();setSelection({x,y,w,h,imageData:id});const tc=document.createElement("canvas");tc.width=id.width;tc.height=id.height;tc.getContext("2d").putImageData(id,0,0);ctx.drawImage(tc,x,y,w,h);const o=overlayRef.current,octx=o.getContext("2d");octx.clearRect(0,0,PW,PH);octx.save();octx.setLineDash([6,4]);octx.strokeStyle=th.accent;octx.lineWidth=2;octx.strokeRect(x,y,w,h);octx.restore();}else overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);setSelStart(null);isDrawing.current=false;return;}
    if(!isDrawing.current)return;
    if([T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&shapeStart.current){const pos=getPos(e),ctx=canvasRef.current.getContext("2d");overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);ctx.save();const ss=shapeStart.current;if(tool===T.LINE){ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(ss.x,ss.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();}else if(tool===T.ARROW)drawArrow(ctx,ss.x,ss.y,pos.x,pos.y,color,brushSize);else if(tool===T.RECT){ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.strokeRect(ss.x,ss.y,pos.x-ss.x,pos.y-ss.y);}else if(tool===T.DIAMOND)drawDiamond(ctx,ss.x,ss.y,pos.x-ss.x,pos.y-ss.y,color,brushSize);else if(tool===T.CIRCLE){const rx=Math.abs(pos.x-ss.x)/2,ry=Math.abs(pos.y-ss.y)/2;ctx.strokeStyle=color;ctx.lineWidth=brushSize;ctx.lineCap="round";ctx.beginPath();ctx.ellipse(ss.x+(pos.x-ss.x)/2,ss.y+(pos.y-ss.y)/2,rx,ry,0,0,Math.PI*2);ctx.stroke();}ctx.restore();shapeStart.current=null;}
    if(tool===T.HIGHLIGHTER&&pathPts.current.length>1){const ctx=canvasRef.current.getContext("2d");ctx.save();ctx.globalAlpha=.3;drawPath(ctx,pathPts.current,color,brushSize*3);ctx.restore();overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);}
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

  useEffect(()=>{if(tool!==T.SELECT&&selection)commitSel();},[tool]);

  /* ═══ Persistence — FIX: ALL keyed by page ID, no stale closure ═══ */
  const collectState=useCallback(()=>{
    const pd={};
    pgRef.current.forEach((pg,i)=>{
      const c=cMap.current.get(pg.id);
      if(!c)return;
      const isCurrent=i===cpRef.current;
      const isDirty=dirtyPages.current.has(pg.id)||isCurrent;
      if(isDirty){pd[pg.id]={image:c.toDataURL(),texts:isCurrent?tiRef.current:(pdRef.current[pg.id]?.texts||[])};}
      else{pd[pg.id]=pdRef.current[pg.id]||{image:c.toDataURL(),texts:[]};}
    });
    dirtyPages.current.clear();
    pdRef.current=pd;
    return{version:7,folders:fldRef.current,pages:pgRef.current,currentPage:cpRef.current,pageData:pd,settings:{showGrid:sgRef.current,showRuled:srRef.current,dark:darkRef.current}};
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
    if(s.settings){setShowGrid(s.settings.showGrid||false);setShowRuled(s.settings.showRuled||false);if(s.settings.dark!==undefined)setDark(s.settings.dark);}
  },[]);

  const handleUpload=useCallback((e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{const s=JSON.parse(ev.target.result);cMap.current.clear();oMap.current.clear();restoreState(s);idbSet("app_state",s);setShowUploadModal(false);}catch{alert("Invalid backup.");}};r.readAsText(f);},[restoreState]);

  /* Lifecycle */
  useEffect(()=>{(async()=>{try{const s=await idbGet("app_state");if(s?.pages){cMap.current.clear();oMap.current.clear();restoreState(s);}}catch(e){console.error("Restore failed:",e);}setAppReady(true);})();},[]);
  useEffect(()=>{if(!appReady)return;const i=setInterval(()=>{if(!isDrawing.current&&!isPanning.current)saveIDB();},10000);return()=>clearInterval(i);},[appReady,saveIDB]);
  const resetInact=useCallback(()=>{if(inactTimer.current)clearTimeout(inactTimer.current);inactTimer.current=setTimeout(()=>{if(!isDrawing.current)saveIDB();dlBackup();},INACTIVITY_TIMEOUT);},[saveIDB,dlBackup]);
  useEffect(()=>{const ev=["pointerdown","keydown"];ev.forEach(e=>window.addEventListener(e,resetInact));resetInact();return()=>{ev.forEach(e=>window.removeEventListener(e,resetInact));};},[resetInact]);
  useEffect(()=>{const bu=()=>{try{const s=collectState();const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>r.result.transaction(STORE,"readwrite").objectStore(STORE).put(s,"app_state");}catch{}};const vis=()=>{if(document.visibilityState==="hidden")saveIDB();};window.addEventListener("beforeunload",bu);document.addEventListener("visibilitychange",vis);return()=>{window.removeEventListener("beforeunload",bu);document.removeEventListener("visibilitychange",vis);};},[collectState,saveIDB]);

  const clearCanvas=()=>{const ctx=canvasRef.current?.getContext("2d");if(!ctx)return;ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);setTextInputs([]);setSelection(null);selSnap.current=null;saveHist();};
  const savePD=useCallback(()=>{const pid=pages[currentPage]?.id;const c=canvasRef.current;if(!c||!pid)return;pdRef.current[pid]={image:c.toDataURL(),texts:textInputs};},[currentPage,textInputs,pages]);
  const switchPg=(i)=>{if(selection)commitSel();activatePage(i);const c=cMap.current.get(pages[i]?.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});};
  const addPg=(folderId)=>{savePD();const fid=folderId||pages[currentPage]?.folderId||folders[0]?.id||1;const np={id:Date.now(),name:`Page ${pages.length+1}`,folderId:fid};setPages(p=>[...p,np]);setFolders(f=>f.map(fl=>fl.id===fid?{...fl,expanded:true}:fl));setTimeout(()=>{const c=cMap.current.get(np.id);if(c)c.scrollIntoView({behavior:"smooth",block:"center"});},200);};
  const deletePage=(pageIdx)=>{if(pages.length<=1){alert("Cannot delete the only page.");return;}savePD();const pg=pages[pageIdx];const newPages=pages.filter((_,i)=>i!==pageIdx);const newIdx=pageIdx>=newPages.length?newPages.length-1:pageIdx;cMap.current.delete(pg.id);oMap.current.delete(pg.id);delete pdRef.current[pg.id];setPages(newPages);setCurrentPage(newIdx);pgRef.current=newPages;cpRef.current=newIdx;const nPid=newPages[newIdx]?.id;canvasRef.current=cMap.current.get(nPid);overlayRef.current=oMap.current.get(nPid);setTextInputs(pdRef.current[nPid]?.texts||[]);setHistory([]);setHistoryIndex(-1);};
  const addFolder=()=>{const nf={id:Date.now(),name:`Folder ${folders.length+1}`,expanded:true};setFolders(f=>[...f,nf]);setRenamingFolder(nf.id);setRenameFolderValue(nf.name);setTimeout(()=>renameFolderRef.current?.focus(),50);};
  const deleteFolder=(folderId)=>{const folderPages=pages.filter(p=>p.folderId===folderId);const remaining=pages.filter(p=>p.folderId!==folderId);if(remaining.length===0){alert("Cannot delete the only folder with all pages.");return;}if(folderPages.length>0&&!confirm(`Delete folder and ${folderPages.length} page(s)?`))return;folderPages.forEach(pg=>{cMap.current.delete(pg.id);oMap.current.delete(pg.id);delete pdRef.current[pg.id];});const curPg=pages[currentPage];const newPages=remaining;let newIdx=newPages.findIndex(p=>p.id===curPg?.id);if(newIdx<0)newIdx=0;setFolders(f=>f.filter(fl=>fl.id!==folderId));setPages(newPages);setCurrentPage(newIdx);pgRef.current=newPages;cpRef.current=newIdx;const nPid=newPages[newIdx]?.id;canvasRef.current=cMap.current.get(nPid);overlayRef.current=oMap.current.get(nPid);setTextInputs(pdRef.current[nPid]?.texts||[]);setHistory([]);setHistoryIndex(-1);};
  const toggleFolder=(folderId)=>{setFolders(f=>f.map(fl=>fl.id===folderId?{...fl,expanded:!fl.expanded}:fl));};
  const startRename=(i)=>{setRenamingPage(i);setRenameValue(pages[i].name);setTimeout(()=>renameRef.current?.focus(),50);};
  const finishRename=()=>{if(renamingPage!==null&&renameValue.trim())setPages(p=>p.map((pg,i)=>i===renamingPage?{...pg,name:renameValue.trim()}:pg));setRenamingPage(null);};
  const startFolderRename=(fid)=>{const fl=folders.find(f=>f.id===fid);if(!fl)return;setRenamingFolder(fid);setRenameFolderValue(fl.name);setTimeout(()=>renameFolderRef.current?.focus(),50);};
  const finishFolderRename=()=>{if(renamingFolder!==null&&renameFolderValue.trim())setFolders(f=>f.map(fl=>fl.id===renamingFolder?{...fl,name:renameFolderValue.trim()}:fl));setRenamingFolder(null);};

  /* Export */
  const getExportDataUrl=()=>{const c=canvasRef.current;if(!c)return"";if(!dark)return c.toDataURL();const tc=document.createElement("canvas");tc.width=c.width;tc.height=c.height;const tctx=tc.getContext("2d");tctx.filter="invert(1) hue-rotate(180deg)";tctx.drawImage(c,0,0);return tc.toDataURL();};
  const exportPng=()=>{const a=document.createElement("a");a.download=`note-page-${currentPage+1}.png`;a.href=getExportDataUrl();a.click();};
  const openEmailModal=()=>{setEmailSubject(`Ink Notes — ${pages[currentPage]?.name||"Page "+(currentPage+1)}`);setEmailTo("");setEmailPreview(getExportDataUrl());setShowEmailModal(true);};
  const sendEmail=async()=>{if(!emailTo.includes("@"))return;setEmailSending(true);try{const d=getExportDataUrl();if(navigator.share&&navigator.canShare){const bl=await(await fetch(d)).blob();const f=new File([bl],"note.png",{type:"image/png"});if(navigator.canShare({files:[f]})){try{await navigator.share({title:emailSubject,files:[f]});setShowEmailModal(false);setEmailSending(false);return;}catch{}}}const bl=await(await fetch(d)).blob();const u=URL.createObjectURL(bl);const a=document.createElement("a");a.href=u;a.download="note.png";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);window.open(`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}`,"_self");setShowEmailModal(false);}catch{}setEmailSending(false);};

  /* Grid/ruled */
  useEffect(()=>{if(!appReady)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");if(showGrid||showRuled){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,PW,PH);if(showGrid){ctx.save();ctx.strokeStyle="#e0ddd6";ctx.lineWidth=.5;for(let x=0;x<PW;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,PH);ctx.stroke();}for(let y=0;y<PH;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(PW,y);ctx.stroke();}ctx.restore();}if(showRuled){ctx.save();ctx.strokeStyle="#c8d0d8";ctx.lineWidth=.7;for(let y=80;y<PH;y+=32){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(PW-20,y);ctx.stroke();}ctx.strokeStyle="#d8a0a0";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,40);ctx.lineTo(60,PH-20);ctx.stroke();ctx.restore();}saveHist();}},[showGrid,showRuled,appReady]);

  /* Shortcuts */
  useEffect(()=>{const hd=(e)=>{const inInput=document.activeElement.tagName==="INPUT"||document.activeElement.tagName==="TEXTAREA";if(e.key===" "&&!inInput){e.preventDefault();spaceHeld.current=true;}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}if((e.metaKey||e.ctrlKey)&&e.key==="z"&&e.shiftKey){e.preventDefault();redo();}if((e.metaKey||e.ctrlKey)&&e.key==="s"){e.preventDefault();manualSave();}if(e.key==="Escape"&&selection)commitSel();if((e.key==="Delete"||e.key==="Backspace")&&selection&&tool===T.SELECT){if(selSnap.current){const c=canvasRef.current,ctx=c.getContext("2d"),img=new Image();img.onload=()=>{ctx.clearRect(0,0,PW,PH);ctx.drawImage(img,0,0,PW,PH);saveHist();};img.src=selSnap.current;}setSelection(null);selSnap.current=null;overlayRef.current?.getContext("2d").clearRect(0,0,PW,PH);}if(!e.metaKey&&!e.ctrlKey&&!inInput){const km={h:T.HAND,v:T.SELECT,p:T.PEN,e:T.ERASER,t:T.TEXT,r:T.RECT,o:T.CIRCLE,l:T.LINE,a:T.ARROW,d:T.DIAMOND};if(km[e.key.toLowerCase()]&&e.key!==" ")setTool(km[e.key.toLowerCase()]);}};const hu=(e)=>{if(e.key===" "){spaceHeld.current=false;isPanning.current=false;}};window.addEventListener("keydown",hd);window.addEventListener("keyup",hu);return()=>{window.removeEventListener("keydown",hd);window.removeEventListener("keyup",hu);};},[undo,redo,manualSave,selection,tool,commitSel,saveHist]);

  const getCursor=()=>{if(shouldPan())return isPanning.current?"grabbing":"grab";if(tool===T.TEXT)return"text";if(tool===T.ERASER)return"none";if(tool===T.SELECT)return selection?(isDraggingSel?"grabbing":"default"):"crosshair";return"crosshair";};
  const stMap={idle:{c:th.textMuted,t:"Saved"},saved:{c:th.success,t:"✓ Saved"},loaded:{c:th.accent,t:"Restored"}};const stI=stMap[saveStatus]||stMap.idle;
  const toolDock=[{id:T.HAND,icon:I.hand,tip:"Hand (H)"},{id:T.SELECT,icon:I.select,tip:"Select (V)"},"sep",{id:T.PEN,icon:I.pen,tip:"Pen (P)"},{id:T.HIGHLIGHTER,icon:I.highlighter,tip:"Highlight"},{id:T.ERASER,icon:I.eraser,tip:"Eraser (E)"},{id:T.TEXT,icon:I.text,tip:"Text (T)"},"sep",{id:T.LINE,icon:I.line,tip:"Line (L)"},{id:T.ARROW,icon:I.arrow,tip:"Arrow (A)"},{id:T.RECT,icon:I.rect,tip:"Rect (R)"},{id:T.DIAMOND,icon:I.diamond,tip:"Diamond (D)"},{id:T.CIRCLE,icon:I.circle,tip:"Ellipse (O)"}];

  /* ═══════ RENDER ═══════ */
  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:th.bg,fontFamily:'"DM Sans",system-ui,sans-serif',overflow:"hidden",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none",WebkitTextSizeAdjust:"100%"}}>
      <style>{`
        *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important}
        textarea,input{-webkit-user-select:text!important;user-select:text!important}
        canvas{touch-action:none}
      `}</style>
      {/* Upload Modal */}
      {showUploadModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"none"}} onClick={()=>setShowUploadModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"40px",maxWidth:"380px",width:"90%",boxShadow:th.shadowLg,textAlign:"center",border:`1px solid ${th.border}`}}><div style={{width:"52px",height:"52px",borderRadius:"16px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",color:"#fff"}}>{I.upload}</div><h2 style={{margin:"0 0 6px",fontSize:"18px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Restore Notes</h2><p style={{margin:"0 0 24px",fontSize:"13px",color:th.textSecondary}}>Upload a .json backup</p><input ref={fileRef} type="file" accept=".json" onChange={handleUpload} style={{display:"none"}}/><button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"14px",borderRadius:"14px",border:`2px dashed ${th.border}`,background:th.surfaceHover,cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.text,marginBottom:"10px",fontFamily:"inherit"}}>Choose File</button><button onClick={()=>setShowUploadModal(false)} style={{width:"100%",padding:"10px",borderRadius:"14px",border:"none",background:"transparent",cursor:"pointer",fontSize:"13px",color:th.textMuted}}>Cancel</button></div></div>}
      {/* Email Modal */}
      {showEmailModal&&<div style={{position:"fixed",inset:0,background:dark?"rgba(0,0,0,.6)":"rgba(44,36,24,.3)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"none"}} onClick={()=>setShowEmailModal(false)}><div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:"24px",padding:"36px",maxWidth:"400px",width:"90%",boxShadow:th.shadowLg,border:`1px solid ${th.border}`}}><div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}><div style={{width:"44px",height:"44px",borderRadius:"14px",background:th.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}>{I.mail}</div><div><h2 style={{margin:0,fontSize:"17px",color:th.text,fontWeight:700,fontFamily:'"Literata",Georgia,serif'}}>Share Note</h2><p style={{margin:"2px 0 0",fontSize:"11px",color:th.textMuted}}>Send current page as image</p></div></div><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>To</label><input type="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="name@example.com" autoFocus onKeyDown={e=>{if(e.key==="Enter")sendEmail();if(e.key==="Escape")setShowEmailModal(false);}} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"14px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/><label style={{display:"block",fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:".8px",marginBottom:"6px",textTransform:"uppercase"}}>Subject</label><input type="text" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:"12px",border:`1.5px solid ${th.border}`,background:th.surfaceHover,color:th.text,fontSize:"14px",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:"18px"}} onFocus={e=>e.target.style.borderColor=th.accent} onBlur={e=>e.target.style.borderColor=th.border}/>{emailPreview&&<div style={{marginBottom:"18px",borderRadius:"12px",overflow:"hidden",border:`1px solid ${th.border}`,background:th.bg,padding:"8px",display:"flex",justifyContent:"center"}}><img src={emailPreview} alt="" style={{maxWidth:"100%",maxHeight:"100px",borderRadius:"8px",objectFit:"contain"}}/></div>}<div style={{display:"flex",gap:"10px"}}><button onClick={()=>setShowEmailModal(false)} style={{flex:1,padding:"12px",borderRadius:"12px",border:`1px solid ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"13px",fontWeight:600,color:th.textSecondary,fontFamily:"inherit"}}>Cancel</button><button onClick={sendEmail} disabled={emailSending||!emailTo.includes("@")} style={{flex:2,padding:"12px",borderRadius:"12px",border:"none",cursor:emailTo.includes("@")?"pointer":"not-allowed",background:emailTo.includes("@")?th.accentGrad:th.surfaceActive,color:emailTo.includes("@")?"#fff":th.textMuted,fontSize:"13px",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>{emailSending?"Sending...":<>{I.send} Send</>}</button></div></div></div>}

      {/* ═══ TOP BAR ═══ */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:compact?"8px 12px":"10px 20px",pointerEvents:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{display:"flex",alignItems:"center",gap:"8px",background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"14px",padding:compact?"8px 12px":"8px 16px",cursor:"pointer",boxShadow:th.shadow}}><span style={{color:th.text}}>{I.menu}</span>{!tiny&&<span style={{fontFamily:'"Literata",Georgia,serif',fontSize:"14px",fontWeight:700,color:th.text,letterSpacing:"-.3px"}}>Ink Notes</span>}</button></div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",pointerEvents:"auto"}}><div style={{background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"10px",padding:"5px 12px",boxShadow:th.shadow,fontSize:"11px",fontWeight:600,color:stI.c,display:"flex",alignItems:"center",gap:"6px"}}><span>{stI.t}</span><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>Pg {currentPage+1}/{pages.length}</span>{!compact&&<><span style={{width:"1px",height:"10px",background:th.border}}/><span style={{color:th.textMuted}}>🛡️ Palm</span></>}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:"4px",pointerEvents:"auto"}}>{[{fn:undo,icon:I.undo,en:historyIndex>0},{fn:redo,icon:I.redo,en:historyIndex<history.length-1}].map((a,i)=>(<button key={i} onClick={a.fn} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:a.en?th.text:th.textMuted,opacity:a.en?1:.5}}>{a.icon}</button>))}<div style={{width:"4px"}}/><button onClick={()=>setDark(!dark)} style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{dark?I.sun:I.moon}</button>{onHome&&<><div style={{width:"4px"}}/><button onClick={onHome} title="Back to home" style={{width:"34px",height:"34px",borderRadius:"10px",border:`1px solid ${th.toolbarBorder}`,background:th.toolbar,backdropFilter:blur,boxShadow:th.shadow,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:th.accent}}>{I.home}</button></>}</div>
      </div>

      {/* ═══ VERTICAL TOOL DOCK ═══ */}
      {!compact&&<div style={{position:"absolute",left:"16px",top:"50%",transform:"translateY(-50%)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",background:th.toolbar,backdropFilter:blurLg,border:`1px solid ${th.toolbarBorder}`,borderRadius:"20px",padding:"8px 6px",boxShadow:th.shadow}}>
        {toolDock.map((item,i)=>item==="sep"?<div key={i} style={{width:"22px",height:"1px",background:th.border,margin:"4px 0"}}/>:(<div key={item.id} style={{position:"relative"}} onMouseEnter={()=>setHoveredTool(item.id)} onMouseLeave={()=>setHoveredTool(null)}><button onClick={()=>setTool(item.id)} style={{width:"38px",height:"38px",borderRadius:"12px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:tool===item.id?th.glow:"none"}}>{item.icon}</button>{hoveredTool===item.id&&tool!==item.id&&<div style={{position:"absolute",left:"48px",top:"50%",transform:"translateY(-50%)",background:th.surface,border:`1px solid ${th.border}`,borderRadius:"8px",padding:"4px 10px",fontSize:"11px",fontWeight:600,color:th.text,whiteSpace:"nowrap",boxShadow:th.shadow,pointerEvents:"none",zIndex:200}}>{item.tip}</div>}</div>))}
      </div>}
      {compact&&<div style={{position:"absolute",top:"52px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:"2px",background:th.toolbar,backdropFilter:blur,border:`1px solid ${th.toolbarBorder}`,borderRadius:"16px",padding:"4px",boxShadow:th.shadow,overflowX:"auto",maxWidth:"calc(100vw - 24px)"}}>{toolDock.filter(t=>t!=="sep"&&![T.LINE,T.DIAMOND].includes(t?.id)).map(item=>(<button key={item.id} onClick={()=>setTool(item.id)} style={{width:"34px",height:"34px",borderRadius:"10px",border:"none",background:tool===item.id?th.accentGrad:"transparent",color:tool===item.id?"#fff":th.textSecondary,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:tool===item.id?th.glow:"none"}}>{item.icon}</button>))}</div>}

      {/* ═══ BOTTOM CONTEXT BAR ═══ */}
      <div style={{position:"absolute",bottom:compact?"10px":"16px",left:"50%",transform:"translateX(-50%)",zIndex:100,display:"flex",gap:compact?"6px":"10px",alignItems:"center",flexWrap:"wrap",justifyContent:"center",maxWidth:"calc(100vw - 32px)"}}>
        {![T.ERASER,T.SELECT,T.HAND].includes(tool)&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 12px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{COLORS.map((c,i)=>(<button key={i} onClick={()=>setColor(c)} style={{width:color===c?"22px":"16px",height:color===c?"22px":"16px",borderRadius:"50%",border:color===c?`2.5px solid ${th.accent}`:"2px solid transparent",background:c,cursor:"pointer",boxShadow:color===c?`0 0 8px ${c}40`:"none",flexShrink:0}}/>))}</div>}
        {[T.PEN,T.HIGHLIGHTER,T.LINE,T.ARROW,T.RECT,T.DIAMOND,T.CIRCLE].includes(tool)&&<div style={{display:"flex",alignItems:"center",gap:"3px",background:th.toolbar,backdropFilter:blur,borderRadius:"16px",padding:compact?"5px 8px":"6px 10px",border:`1px solid ${th.toolbarBorder}`,boxShadow:th.shadow}}>{BRUSH_SIZES.map(sz=>(<button key={sz} onClick={()=>setBrushSize(sz)} style={{width:"28px",height:"28px",borderRadius:"9px",border:brushSize===sz?`2px solid ${th.accent}`:"1px solid transparent",background:brushSize===sz?th.accentSoft:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{width:Math.min(sz*1.5,14)+"px",height:Math.min(sz*1.5,14)+"px",borderRadius:"50%",background:color}}/></button>))}</div>}
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
      <div style={{position:"absolute",bottom:compact?"52px":"18px",left:compact?"50%":"20px",transform:compact?"translateX(-50%)":"none",zIndex:100,fontSize:"10px",color:th.textMuted,fontWeight:500,opacity:.5,fontFamily:'"Literata",Georgia,serif',fontStyle:"italic"}}>crafted by <span style={{fontWeight:700,color:th.textSecondary,fontStyle:"normal"}}>Nilay</span></div>

      {/* ═══ MAIN AREA ═══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        {sidebarOpen&&<div style={{width:compact?"200px":"240px",background:th.surface,borderRight:`1px solid ${th.border}`,padding:`${compact?52:56}px 14px 14px`,overflowY:"auto",zIndex:90}}>
          <button onClick={addFolder} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",width:"100%",padding:"8px",marginBottom:"12px",borderRadius:"10px",border:`1.5px dashed ${th.border}`,background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:600,color:th.textMuted,fontFamily:"inherit"}}>{I.plus} New Folder</button>
          {folders.map(fl=>{const folderPages=pages.map((pg,i)=>({...pg,_idx:i})).filter(pg=>pg.folderId===fl.id);return(
            <div key={fl.id} style={{marginBottom:"6px"}}>
              {/* Folder header */}
              <div style={{display:"flex",alignItems:"center",borderRadius:"8px",padding:"2px 0",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.querySelector('.fld-del')&&(e.currentTarget.querySelector('.fld-del').style.opacity='0.6')} onMouseLeave={e=>e.currentTarget.querySelector('.fld-del')&&(e.currentTarget.querySelector('.fld-del').style.opacity='0')}>
                <button onClick={()=>toggleFolder(fl.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 2px",color:th.textMuted,display:"flex",alignItems:"center",flexShrink:0}}>{fl.expanded?I.chevronDown:I.chevronRight}</button>
                {renamingFolder===fl.id?<input ref={renameFolderRef} value={renameFolderValue} onChange={e=>setRenameFolderValue(e.target.value)} onBlur={finishFolderRename} onKeyDown={e=>{if(e.key==="Enter")finishFolderRename();if(e.key==="Escape")setRenamingFolder(null);}} style={{flex:1,padding:"5px 8px",borderRadius:"6px",border:`2px solid ${th.accent}`,outline:"none",fontSize:"11px",fontWeight:700,color:th.text,background:th.accentSoft,fontFamily:"inherit"}}/>:<button onClick={()=>toggleFolder(fl.id)} onDoubleClick={()=>startFolderRename(fl.id)} style={{flex:1,textAlign:"left",padding:"5px 4px",borderRadius:"6px",border:"none",background:"transparent",cursor:"pointer",fontSize:"11px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif',display:"flex",alignItems:"center",gap:"5px"}}><span style={{color:th.textMuted}}>{fl.expanded?I.folderOpen:I.folder}</span>{fl.name}</button>}
                <button className="fld-del" onClick={(e)=>{e.stopPropagation();deleteFolder(fl.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:th.danger,opacity:0,flexShrink:0,transition:"opacity .15s"}}>{I.trash}</button>
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
          <div style={{marginTop:"24px",paddingTop:"16px",borderTop:`1px solid ${th.border}`,textAlign:"center"}}><div style={{fontSize:"13px",fontWeight:700,color:th.text,fontFamily:'"Literata",Georgia,serif'}}>Ink Notes</div><div style={{fontSize:"9px",color:th.textMuted,marginTop:"2px",fontStyle:"italic"}}>by <span style={{fontWeight:600,color:th.accent}}>Nilay</span></div></div>
        </div>}

        {/* ═══ SCROLLABLE PAGE STACK ═══ */}
        <div ref={scrollRef} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerLeave={handleUp} onPointerCancel={handleUp} style={{flex:1,overflow:"auto",cursor:getCursor(),background:dark?"#0e0c0a":th.bg,position:"relative",touchAction:"none"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:`${PAGE_PAD}px`,minWidth:dW>baseW?`${dW+PAGE_PAD*2}px`:undefined,paddingTop:`${compact?100:60}px`,paddingBottom:"200px"}}>
            {pages.map((pg,idx)=>(
              <div key={pg.id}>
                {idx>0&&<div style={{display:"flex",alignItems:"center",gap:"12px",padding:`${PAGE_GAP/2}px 0`,width:dW+"px",maxWidth:"100%",userSelect:"none"}}><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/><span style={{fontSize:"10px",fontWeight:700,color:th.textMuted,letterSpacing:"1.5px",textTransform:"uppercase",whiteSpace:"nowrap"}}>Page {idx+1}</span><div style={{flex:1,height:"1px",background:th.border,opacity:.5}}/></div>}
                <div style={{width:dW+"px",height:dH+"px",position:"relative",borderRadius:Math.max(4,8*zoom)+"px",overflow:"hidden",boxShadow:compact?"0 0 0 1px rgba(0,0,0,0.06)":th.pageShadow,background:"#fff",touchAction:"none"}}>
                  <div style={{width:"100%",height:"100%",filter:dark?"invert(1) hue-rotate(180deg)":"none"}}>
                    <canvas ref={el=>initC(el,pg.id)} style={{width:"100%",height:"100%",display:"block"}}/>
                    {currentPage===idx&&<canvas ref={el=>initO(el,pg.id)} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none"}}/>}
                  </div>
                  {currentPage===idx&&<div style={{position:"absolute",top:0,left:0,right:0,height:Math.max(2,3*zoom)+"px",background:th.accentGrad,transition:"opacity .2s"}}/>}
                  {currentPage===idx&&textInputs.map(inp=>{const sx=inp.x/PW*dW,sy=inp.y/PH*dH,fs=inp.fontSize/PW*dW;return(<textarea key={inp.id} autoFocus={editingText===inp.id} value={inp.text} onChange={e=>setTextInputs(p=>p.map(t=>t.id===inp.id?{...t,text:e.target.value}:t))} onBlur={()=>textBlur(inp.id)} onKeyDown={e=>{if(e.key==="Escape")e.target.blur();}} style={{position:"absolute",left:sx+"px",top:sy+"px",fontSize:fs+"px",color:dark?invertHex(inp.color):inp.color,fontFamily:'"Literata",Georgia,serif',background:dark?"rgba(21,18,16,.95)":"rgba(255,252,247,.95)",border:`2px solid ${th.accent}`,borderRadius:"8px",outline:"none",padding:"6px 10px",minWidth:"60px",minHeight:fs*1.5+"px",resize:"both",lineHeight:1.4,zIndex:20,boxShadow:th.shadow}}/>);})}
                </div>
              </div>
            ))}
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