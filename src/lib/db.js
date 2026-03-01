const DB_NAME="InkNotes_DB",DB_VERSION=1,STORE="notes_store";
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=(e)=>{if(!e.target.result.objectStoreNames.contains(STORE))e.target.result.createObjectStore(STORE);};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbSet(k,v){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function idbGet(k){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readonly");const r=tx.objectStore(STORE).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}

export { DB_NAME, DB_VERSION, STORE, openDB, idbSet, idbGet };
