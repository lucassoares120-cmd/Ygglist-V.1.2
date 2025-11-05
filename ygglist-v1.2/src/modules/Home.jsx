
import React, {useEffect, useState} from 'react';
import { todayISO } from '../lib.js';
export default function Home({onNewList}){
  const [greeting, setGreeting] = useState('Bem-vindo!');
  const [loc, setLoc] = useState(null);
  const [weather, setWeather] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState(todayISO());
  useEffect(()=>{
    const frases=['Que sua compra renda e economize 💚','Hoje é um ótimo dia para planejar bem 🤝','Pequenas escolhas, grande economia 🌿','Organização é liberdade ✨'];
    setGreeting(frases[Math.floor(Math.random()*frases.length)]);
  },[]);
  useEffect(()=>{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition((pos)=>{
        const {latitude, longitude} = pos.coords;
        setLoc({lat:latitude, lon:longitude});
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`)
        .then(r=>r.json()).then(j=>setWeather(j.current)).catch(()=>{});
      }, ()=>{});
    }
    const year = new Date().getFullYear();
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`).then(r=>r.json()).then(j=>setHolidays(j)).catch(()=>{});
  },[]);
  return (
    <section className="space-y-4">
      <img src="/ygglist_banner.svg" alt="YggList — raiz que conecta" className="w-full rounded-2xl border" />
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl font-semibold">Olá! 👋</h2><p className="text-slate-600">{greeting}</p></div>
          <div className="text-right text-sm text-slate-600">{weather? (<div>🌡️ {weather.temperature_2m}°C</div>): <div>🌡️ —</div>}<div className="text-xs">{loc? `lat ${loc.lat.toFixed(2)}, lon ${loc.lon.toFixed(2)}`: 'Localização não definida'}</div></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2"><span>📅</span><h3 className="font-semibold">Calendário & Feriados</h3></div>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div><label className="text-sm">Escolha a data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-lg px-3 py-2"/></div>
          <button onClick={onNewList} className="px-3 py-2 rounded-lg bg-ygg-700 text-white">Criar lista para o dia</button>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-2 max-h-48 overflow-auto pr-2">
          {holidays?.map(h=> (<div key={h.date} className="text-sm text-slate-600 flex items-center gap-2"><span>🎉</span><span>{h.date}: {h.localName}</span></div>))}
        </div>
      </div>
    </section>
  );
}
