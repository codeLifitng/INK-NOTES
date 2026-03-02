export const COLORS=["#2c2418","#8a7e70","#c06830","#2878a8","#2e7d50","#6d9b30","#d97820","#c04080","#b83030","#7040c0","#c89028","#6e3810"];
export const BRUSH_SIZES=[1,2,4,6,10,16,24],ERASER_SIZES=[8,16,24,36,48,64],FONT_SIZES=[14,18,24,32,48,64];
export const invertHex=(hex)=>{if(!hex||hex[0]!=="#")return hex;const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`#${(255-r).toString(16).padStart(2,"0")}${(255-g).toString(16).padStart(2,"0")}${(255-b).toString(16).padStart(2,"0")}`;};
export const T={PEN:"pen",HIGHLIGHTER:"highlighter",ERASER:"eraser",TEXT:"text",SELECT:"select",LINE:"line",ARROW:"arrow",RECT:"rect",DIAMOND:"diamond",CIRCLE:"circle",HAND:"hand",STAMP:"stamp"};
export const INACTIVITY_TIMEOUT=1800000;
export const PW=2000,PH=2600,PAGE_PAD=32,PAGE_GAP=40,AUTO_ZONE=300;
