import React, {useEffect, useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Home from './Home.jsx'; 
import Lists from './Lists.jsx'; 
import Reports from './Reports.jsx';
import { USER_KEY, load, save } from '../lib.js';

export default function App(){
  const [tab, setTab] = useState('home');
  const [drawer, setDrawer] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(()=>{ setUser(load(USER_KEY,null)); },[]);
  useEffect(()=>{ save(USER_KEY,user); },[user]);

  const fakeLogin = ()=> setUser({name:'Lucas'});
  const logout = ()=> setUser(null);

  const drawerItemClass = (active) =>
    "w-full text-left p-2 rounded-lg text-sm transition-colors " +
    (active
      ? "bg-ygg-100 text-emerald-900 font-semibold"
      : "hover:bg-ygg-50 text-slate-700");
  
  return (
    <div className="min-h-screen bg-ygg-50">
   <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
  <div className="relative max-w-6xl mx-auto px-3 py-2 sm:py-3 flex items-center justify-between">

    {/* MENU — reduzido no mobile */}
    <button
      onClick={()=>setDrawer(true)}
      aria-label="Abrir menu"
      className="z-10 group p-1.5 sm:p-2 rounded-lg border bg-white hover:bg-emerald-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-900"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    {/* BRAND */}
    <div className="z-10 flex-1 flex justify-center">
      <div className="flex items-center gap-3 sm:gap-5">

        {/* Logo reduzida no mobile */}
        <img
          src="/icons/ygg-192.png"
          alt="YggList logo"
          className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl ring-1 ring-emerald-200/70"
        />

        <div className="font-brand leading-none">
          <div className="text-2xl sm:text-4xl font-semibold tracking-tight text-emerald-950">
            YggList
          </div>
          <div className="text-sm sm:text-xl text-emerald-800/90 mt-0.5 sm:mt-1 tracking-tight">
            Raiz que conecta
          </div>
        </div>

      </div>
    </div>

    {/* LOGIN — compacto no mobile */}
    <div className="z-10">
      {user ? (
        <button className="px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg border">
          Sair
        </button>
      ) : (
        <button className="px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg bg-ygg-700 text-white">
          Entrar
        </button>
      )}
    </div>

  </div>
</header>
    
      {/*FIM Botões*/}
      
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {tab==='home' && <Home onNewList={()=>setTab('lists')} />}
        {tab==='lists' && <Lists />}
        {tab==='reports' && <Reports />}
      </main>

      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-30"
            initial={{opacity:0}}
            animate={{opacity:1}}
            exit={{opacity:0}}
            onClick={()=>setDrawer(false)}
          >
            <div className="absolute inset-0 bg-black/30"></div>
            <motion.aside
              initial={{x:-320}}
              animate={{x:0}}
              exit={{x:-320}}
              transition={{type:'spring', stiffness:260, damping:26}}
              className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4"
            >
              <h3 className="font-semibold mb-3">Menu</h3>
              <ul className="space-y-2 text-sm">
                <li>
  <button
    className={drawerItemClass(tab === 'home')}
    onClick={() => { setTab('home'); setDrawer(false); }}
  >
    Tela Inicial
  </button>
</li>

<li>
  <button
    className={drawerItemClass(tab === 'lists')}
    onClick={() => { setTab('lists'); setDrawer(false); }}
  >
    Minhas Listas
  </button>
</li>

<li>
  <button
    className={drawerItemClass(tab === 'reports')}
    onClick={() => { setTab('reports'); setDrawer(false); }}
  >
    Relatórios
  </button>
</li>
                <li className="pt-2 border-t text-slate-500">Configurações</li>
                <li className="text-xs text-slate-500">Tema: Verde (padrão)</li>
                <li className="text-xs text-slate-500">Fonte: Sistema</li>
                <li className="text-xs text-slate-500">Listas passadas: ver aba Listas</li>
              </ul>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="text-center text-xs text-slate-500 py-6">
        YggList — protótipo v1.2.3 Dados locais (v2: nuvem).
      </footer>
    </div>
  );
}

function Tab({active, children, onClick}){ 
  return (
    <button
      onClick={onClick}
      className={
        "hidden sm:block py-2 rounded-xl text-sm border " +
        (active ? "bg-ygg-700 text-white border-ygg-700" : "bg-white")
      }
    >
      {children}
    </button>
  );
}

