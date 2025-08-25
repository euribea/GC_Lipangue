import { useEffect, useMemo, useState } from "react";

/*********************************************************
 * Utilidades compartidas
 *********************************************************/
function parseMontoCLP(str) {
  if (typeof str === "number") return Math.round(str);
  const limpio = String(str).replace(/[^\d-]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
}
function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(parseMontoCLP(n));
}
function descargarCSV(nombre, filas) {
  const cabeceras = Object.keys(filas[0] || {});
  const escape = (v) =>
    '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const cuerpo = filas.map((row) => cabeceras.map((k) => escape(row[k])).join(","));
  const csv = [cabeceras.join(","), ...cuerpo].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre.endsWith(".csv") ? nombre : nombre + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

/*********************************************************
 * TABLA DE INGRESOS (histórico)
 * Lee localStorage["ingresos"]
 * - Filtra por Parcela, Año, Mes, Nombre
 * - Muestra filas EXPLOTADAS por mes (un ingreso con 3 meses = 3 filas)
 * - Totales y exportar CSV
 *********************************************************/
export function IngresosTabla() {
  const [raw, setRaw] = useState([]);
  const [filtros, setFiltros] = useState({ parcela: "", anio: "", mes: "", nombre: "" });
  const [ordenDesc, setOrdenDesc] = useState(true);

  function cargar() {
    try {
      const data = JSON.parse(localStorage.getItem("ingresos") || "[]");
      setRaw(Array.isArray(data) ? data : []);
    } catch { setRaw([]); }
  }
  useEffect(() => { cargar(); }, []);

  // Explota cada ingreso a filas por mes
  const filas = useMemo(() => {
    const out = [];
    for (const ing of raw) {
      const meses = Array.isArray(ing.meses) ? ing.meses : [];
      if (!meses.length) {
        out.push({
          id: ing.id,
          fecha: ing.fecha,
          parcela: ing.parcela,
          nombre: ing.nombre,
          anio: "",
          mes: "",
          montoMes: ing.montoTotal,
          montoTotal: ing.montoTotal,
        });
      } else {
        for (const m of meses) {
          out.push({
            id: ing.id,
            fecha: ing.fecha,
            parcela: ing.parcela,
            nombre: ing.nombre,
            anio: m.year,
            mes: m.month + 1, // 1..12
            montoMes: m.monto,
            montoTotal: ing.montoTotal,
          });
        }
      }
    }
    // ordenar por fecha de registro
    out.sort((a, b) => {
      const da = new Date(a.fecha).getTime();
      const db = new Date(b.fecha).getTime();
      return ordenDesc ? db - da : da - db;
    });
    // filtros
    return out.filter((r) =>
      (filtros.parcela ? String(r.parcela) === String(filtros.parcela) : true) &&
      (filtros.anio ? String(r.anio) === String(filtros.anio) : true) &&
      (filtros.mes ? String(r.mes) === String(filtros.mes) : true) &&
      (filtros.nombre ? String(r.nombre || "").toLowerCase().includes(filtros.nombre.toLowerCase()) : true)
    );
  }, [raw, filtros, ordenDesc]);

  const totalMostrado = useMemo(() => filas.reduce((acc, r) => acc + parseMontoCLP(r.montoMes), 0), [filas]);

  const aniosDisponibles = useMemo(() => {
    const set = new Set(raw.flatMap((i) => (i.meses || []).map((m) => m.year)));
    return Array.from(set).sort((a, b) => b - a);
  }, [raw]);

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="w-28">
          <label className="block text-xs text-gray-600">Parcela</label>
          <select value={filtros.parcela} onChange={(e)=>setFiltros(f=>({...f,parcela:e.target.value}))} className="w-full border rounded px-2 py-1">
            <option value="">Todas</option>
            {Array.from({length:26},(_,i)=>i+1).map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-600">Año</label>
          <select value={filtros.anio} onChange={(e)=>setFiltros(f=>({...f,anio:e.target.value}))} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            {aniosDisponibles.map(y=> <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-600">Mes</label>
          <select value={filtros.mes} onChange={(e)=>setFiltros(f=>({...f,mes:e.target.value}))} className="w-full border rounded px-2 py-1">
            <option value="">Todos</option>
            {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m.toString().padStart(2,"0")}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-600">Nombre contiene</label>
          <input value={filtros.nombre} onChange={(e)=>setFiltros(f=>({...f,nombre:e.target.value}))} className="w-full border rounded px-2 py-1" placeholder="Buscar por nombre"/>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={()=>setOrdenDesc(v=>!v)} className="px-3 py-2 border rounded">Orden {ordenDesc?"↓":"↑"}</button>
          <button onClick={cargar} className="px-3 py-2 border rounded">Refrescar</button>
          <button
            className="px-3 py-2 rounded bg-gray-900 text-white"
            onClick={()=>{
              const filasCSV = filas.map(r=>({
                fecha: r.fecha,
                parcela: r.parcela,
                nombre: r.nombre,
                anio: r.anio,
                mes: r.mes,
                monto_mes: parseMontoCLP(r.montoMes),
                monto_total_deposito: parseMontoCLP(r.montoTotal),
              }));
              descargarCSV("ingresos_filtrados", filasCSV);
            }}
          >Exportar CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">Fecha</th>
              <th className="border px-3 py-2 text-left">Parcela</th>
              <th className="border px-3 py-2 text-left">Nombre</th>
              <th className="border px-3 py-2 text-left">Año</th>
              <th className="border px-3 py-2 text-left">Mes</th>
              <th className="border px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r, idx)=> (
              <tr key={idx}>
                <td className="border px-3 py-2">{r.fecha}</td>
                <td className="border px-3 py-2">{r.parcela}</td>
                <td className="border px-3 py-2">{r.nombre}</td>
                <td className="border px-3 py-2">{r.anio||""}</td>
                <td className="border px-3 py-2">{r.mes||""}</td>
                <td className="border px-3 py-2 text-right">{formatCLP(r.montoMes)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="border px-3 py-2" colSpan={5}><strong>Total mostrado</strong></td>
              <td className="border px-3 py-2 text-right"><strong>{formatCLP(totalMostrado)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/*********************************************************
 * TABLA DE EGRESOS (histórico)
 * Lee localStorage["egresos"]
 * - Filtra por Categoría, Rango de fechas, Texto
 * - Totales y exportar CSV
 *********************************************************/
export function EgresosTabla() {
  const [raw, setRaw] = useState([]);
  const [filtros, setFiltros] = useState({ categoria: "", desde: "", hasta: "", q: "" });
  const [ordenDesc, setOrdenDesc] = useState(true);

  function cargar() {
    try {
      const data = JSON.parse(localStorage.getItem("egresos") || "[]");
      setRaw(Array.isArray(data) ? data : []);
    } catch { setRaw([]); }
  }
  useEffect(() => { cargar(); }, []);

  const categorias = useMemo(()=> Array.from(new Set(raw.map(r=>r.categoria).filter(Boolean))).sort(), [raw]);

  const filas = useMemo(()=>{
    const out = [...raw];
    out.sort((a,b)=> (ordenDesc? -1:1) * (new Date(a.fecha) - new Date(b.fecha)));
    return out.filter(r=>
      (filtros.categoria ? r.categoria === filtros.categoria : true) &&
      (filtros.desde ? new Date(r.fecha) >= new Date(filtros.desde) : true) &&
      (filtros.hasta ? new Date(r.fecha) <= new Date(filtros.hasta) : true) &&
      (filtros.q ? (r.descripcion||"").toLowerCase().includes(filtros.q.toLowerCase()) : true)
    );
  }, [raw, filtros, ordenDesc]);

  const totalMostrado = useMemo(()=> filas.reduce((acc, r)=> acc + parseMontoCLP(r.monto), 0), [filas]);

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-gray-600">Categoría</label>
          <select value={filtros.categoria} onChange={(e)=>setFiltros(f=>({...f,categoria:e.target.value}))} className="border rounded px-2 py-1">
            <option value="">Todas</option>
            {categorias.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Desde</label>
          <input type="date" value={filtros.desde} onChange={(e)=>setFiltros(f=>({...f,desde:e.target.value}))} className="border rounded px-2 py-1"/>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Hasta</label>
          <input type="date" value={filtros.hasta} onChange={(e)=>setFiltros(f=>({...f,hasta:e.target.value}))} className="border rounded px-2 py-1"/>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-600">Texto</label>
          <input value={filtros.q} onChange={(e)=>setFiltros(f=>({...f,q:e.target.value}))} className="w-full border rounded px-2 py-1" placeholder="Buscar descripción"/>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={()=>setOrdenDesc(v=>!v)} className="px-3 py-2 border rounded">Orden {ordenDesc?"↓":"↑"}</button>
          <button onClick={cargar} className="px-3 py-2 border rounded">Refrescar</button>
          <button
            className="px-3 py-2 rounded bg-gray-900 text-white"
            onClick={()=>{
              const filasCSV = filas.map(r=>({
                fecha: r.fecha,
                categoria: r.categoria,
                descripcion: r.descripcion,
                monto: parseMontoCLP(r.monto),
              }));
              descargarCSV("egresos_filtrados", filasCSV);
            }}
          >Exportar CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-3 py-2 text-left">Fecha</th>
              <th className="border px-3 py-2 text-left">Categoría</th>
              <th className="border px-3 py-2 text-left">Descripción</th>
              <th className="border px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id}>
                <td className="border px-3 py-2">{r.fecha}</td>
                <td className="border px-3 py-2">{r.categoria}</td>
                <td className="border px-3 py-2">{r.descripcion}</td>
                <td className="border px-3 py-2 text-right">{formatCLP(r.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="border px-3 py-2" colSpan={3}><strong>Total mostrado</strong></td>
              <td className="border px-3 py-2 text-right"><strong>{formatCLP(totalMostrado)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/*********************************************************
 * NOTA: Este archivo contiene DOS componentes exportados:
 *   - IngresosTabla
 *   - EgresosTabla
 * Si prefieres archivos separados:
 *   1) Crea src/IngresosTabla.jsx y pega sólo el componente IngresosTabla.
 *   2) Crea src/EgresosTabla.jsx y pega sólo el componente EgresosTabla.
 * Ambos comparten utilidades de arriba; copia también parseMontoCLP/formatCLP/descargarCSV.
 *********************************************************/
