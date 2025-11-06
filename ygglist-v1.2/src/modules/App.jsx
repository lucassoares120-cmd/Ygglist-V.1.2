
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
        <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
          <button onClick={()=>setDrawer(true)} className="p-2 rounded-lg border bg-white">🌿</button>
          <div className="flex items-center gap-2"><span className="text-lg font-bold">YggList</span><span className="text-xs text-ygg-700">Raiz que conecta</span></div>
          <div>{user? <button onClick={logout} className="px-3 py-2 rounded-lg border text-sm">Sair</button> : <button onClick={fakeLogin} className="px-3 py-2 rounded-lg bg-ygg-700 text-white text-sm">Entrar com Google</button>}</div>
        </div>
        <nav className="max-w-6xl mx-auto px-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <Tab onClick={()=>setTab('home')} active={tab==='home'}>Início</Tab>
            <Tab onClick={()=>setTab('lists')} active={tab==='lists'}>Listas</Tab>
            <Tab onClick={()=>setTab('reports')} active={tab==='reports'}>Relatórios</Tab>
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
      <footer className="text-center text-xs text-slate-500 py-6">YggList — protótipo v1.2. Dados locais (v2: nuvem).</footer>
    </div>
  );
}
function Tab({active, children, onClick}){ return <button onClick={onClick} className={"py-2 rounded-xl text-sm border "+(active?"bg-ygg-700 text-white border-ygg-700":"bg-white")}>{children}</button> }
