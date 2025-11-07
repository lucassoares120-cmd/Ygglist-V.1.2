
import React, {useEffect, useState} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Home from './Home.jsx'; import Lists from './Lists.jsx'; import Reports from './Reports.jsx';
import { USER_KEY, load, save } from '../lib.js';
export default function App(){
  const [tab, setTab] = useState('home');
  const [drawer, setDrawer] = useState(false);
  const [user, setUser] = useState(null);
  useEffect(()=>{ setUser(load(USER_KEY,null)); },[]);
  useEffect(()=>{ save(USER_KEY,user); },[user]);
  const fakeLogin = ()=> setUser({name:'Lucas'});
  const logout = ()=> setUser(null);
  return (
    <div className="min-h-screen bg-ygg-50">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
  <div className="relative max-w-6xl mx-auto px-3 py-3 flex items-center justify-between">

    {/* FAIXA por trás */}
    <div className="brand-band absolute left-16 right-44 sm:left-24 sm:right-40 top-1.5 h-14 sm:h-16 rounded-2xl z-0" />

    {/* Menu (fica por cima da faixa) */}
    <button
      onClick={()=>setDrawer(true)}
      aria-label="Abrir menu"
      className="z-10 group p-2 rounded-lg border bg-white hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    {/* Brand central (logo + textos) */}
    <div className="z-10 flex-1 flex justify-center">
  <div className="flex items-center gap-5 sm:gap-6">
    <img
      src="/YggSymbol.png"
      alt="Símbolo Yggdrasil"
      className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-xl drop-shadow-md ring-1 ring-emerald-200/70"
    />
    <div className="font-brand leading-none">
      <div className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-emerald-950">
        YggList
      </div>
      <div className="text-lg sm:text-xl md:text-2xl text-emerald-800/90 mt-1 tracking-tight">
        Raiz que conecta
      </div>
    </div>
  </div>
</div>


    {/* Login (por cima da faixa) */}
    <div className="z-10">
      {user
        ? <button onClick={logout} className="px-3 py-2 rounded-lg border text-sm">Sair</button>
        : <button onClick={fakeLogin} className="px-3 py-2 rounded-lg bg-ygg-700 text-white text-sm">Entrar com Google</button>
      }
    </div>
  </div>

  <nav className="max-w-6xl mx-auto px-3 pb-2">
    <div className="grid grid-cols-3 gap-2">
      <Tab onClick={()=>setTab('home')}   active={tab==='home'}>Início</Tab>
      <Tab onClick={()=>setTab('lists')}  active={tab==='lists'}>Listas</Tab>
      <Tab onClick={()=>setTab('reports')}active={tab==='reports'}>Relatórios</Tab>
    </div>
  </nav>
</header>

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {tab==='home' && <Home onNewList={()=>setTab('lists')} />}
        {tab==='lists' && <Lists />}
        {tab==='reports' && <Reports />}
      </main>
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-30" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDrawer(false)}>
            <div className="absolute inset-0 bg-black/30"></div>
            <motion.aside initial={{x:-320}} animate={{x:0}} exit={{x:-320}} transition={{type:'spring', stiffness:260, damping:26}} className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4">
              <h3 className="font-semibold mb-3">Menu</h3>
              <ul className="space-y-2 text-sm">
                <li><button className="w-full text-left p-2 rounded hover:bg-ygg-100" onClick={()=>{setTab('home'); setDrawer(false);}}>Tela Inicial</button></li>
                <li><button className="w-full text-left p-2 rounded hover:bg-ygg-100" onClick={()=>{setTab('lists'); setDrawer(false);}}>Minhas Listas</button></li>
                <li><button className="w-full text-left p-2 rounded hover:bg-ygg-100" onClick={()=>{setTab('reports'); setDrawer(false);}}>Relatórios</button></li>
                <li className="pt-2 border-t text-slate-500">Configurações</li>
                <li className="text-xs text-slate-500">Tema: Verde (padrão)</li>
                <li className="text-xs text-slate-500">Fonte: Sistema</li>
                <li className="text-xs text-slate-500">Listas passadas: ver aba Listas</li>
              </ul>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="text-center text-xs text-slate-500 py-6">YggList — protótipo v1.2.1 Dados locais (v2: nuvem).</footer>
    </div>
  );
}
function Tab({active, children, onClick}){ return <button onClick={onClick} className={"py-2 rounded-xl text-sm border "+(active?"bg-ygg-700 text-white border-ygg-700":"bg-white")}>{children}</button> }
