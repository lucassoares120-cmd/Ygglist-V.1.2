
export const STORAGE_KEY='ygglist:data:v1';
export const PURCHASES_KEY='ygglist:purchases:v1';
export const USER_KEY='ygglist:user';
export const fmtBRL = v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const uid = ()=> Math.random().toString(36).slice(2)+Date.now().toString(36);
export const todayISO = ()=>{ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; };
export function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
export function load(k,def){ try{ const r=localStorage.getItem(k); return r? JSON.parse(r): def; }catch{ return def; } }
export const catIcon = { Hortifruti:'🥬', 'Laticínios':'🧀', Carnes:'🥩', Padaria:'🍞', Mercearia:'🧺', Bebidas:'🥤', Higiene:'🧼', Limpeza:'🧽', Pet:'🐾', Congelados:'🧊', Enlatados:'🥫', Temperos:'🌿', Bazar:'🧰' };
export const toNumber = (v)=> v===''? undefined : Number(String(v).replace(',','.'));
