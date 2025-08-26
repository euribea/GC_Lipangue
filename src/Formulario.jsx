import { useState, useEffect, useMemo } from "react";
import {
  addIngreso, watchIngresos, updateIngreso, deleteIngreso,
  addEgreso,  watchEgresos,  updateEgreso,  deleteEgreso
} from "./lib/firebase";

/*********************** Utilidades ************************/
function parseMontoCLP(str){ if(typeof str==="number") return Math.round(str); const limpio=String(str).replace(/[^\d-]/g,""); return limpio?parseInt(limpio,10):0; }
function formatCLP(n){ return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(parseMontoCLP(n)); }

/*********************** Componente principal ************************/
export default function FinanzasForm({ onAddIngreso, onAddEgreso }) {
  const [tipo, setTipo] = useState("ingreso");
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="mb-2 flex gap-6 items-center bg-white p-4 rounded-2xl shadow">
        <span className="text-sm text-gray-600">Tipo de movimiento</span>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="ingreso" checked={tipo === "ingreso"} onChange={()=>setTipo("ingreso")} /> Ingreso
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="egreso" checked={tipo === "egreso"} onChange={()=>setTipo("egreso")} /> Egreso
        </label>
      </div>

      {tipo === "ingreso" ? (
        <div className="space-y-6">
          <IngresoForm onAdd={(i)=>{ onAddIngreso?.(i); }} />
          <IngresosTabla />
        </div>
      ) : (
        <div className="space-y-6">
          <EgresoForm onAdd={(e)=>{ onAddEgreso?.(e); }} />
          <EgresosTabla />
        </div>
      )}
    </div>
  );
}

/*********************** Ingreso (con meses + montos) ************************/
function IngresoForm({ onAdd }) {
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const hoy = new Date().toISOString().slice(0, 10);
  const yNow = new Date().getFullYear();
  const AÑOS = Array.from({length:5},(_,i)=> yNow+1 - i); // yNow+1 .. yNow-3

  const [form, setForm] = useState({ fecha: hoy, parcela: "", nombre: "", monto: "", meses: [] /* [{year,month}] */ });
  const [selMes, setSelMes] = useState(new Date().getMonth());  // 0..11
  const [selAño, setSelAño] = useState(yNow);
  const [mesMontos, setMesMontos] = useState({}); // key "YYYY-MM" -> valor formateado
  const [errores, setErrores] = useState({});

  const parseMonto = (str) => {
    if (typeof str === "number") return Math.round(str);
    const limpio = String(str).replace(/[^\d-]/g, "");
    return limpio ? parseInt(limpio, 10) : 0;
  };
  const formatearCLP = (n) =>
    n===""||n==null ? "" :
    new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(parseMonto(n));

  const actualizar = (k,v)=> setForm(f=>({...f,[k]:v}));
  const keyMes = (y,m)=> `${y}-${String(m+1).padStart(2,"0")}`;
  const labelMes = (y,m)=> `${MESES[m]} ${y}`;

  const agregarMes = () => {
    const existe = form.meses.some(m=> m.year===selAño && m.month===selMes);
    if (existe) return;
    setForm(f=> ({...f, meses:[...f.meses, {year:selAño, month:selMes}]}));
  };
  const quitarMes = (y,m) => {
    setForm(f=> ({...f, meses: f.meses.filter(mm=> !(mm.year===y && mm.month===m))}));
    setMesMontos(prev => {
      const k = keyMes(y,m);
      const { [k]:_, ...rest } = prev;
      return rest;
    });
  };
  const actualizarMesMonto = (y,m,val) => setMesMontos(prev=> ({...prev, [keyMes(y,m)]: val}));

  function validar(){
    const e={};
    if(!form.fecha) e.fecha="La fecha es obligatoria";
    if(!form.parcela) e.parcela="La parcela es obligatoria";
    if(!form.nombre.trim()) e.nombre="El nombre es obligatorio";
    const total = parseMonto(form.monto);
    if(!total || total<=0) e.monto="El monto total debe ser mayor a 0";
    if(!form.meses.length) e.meses="Agrega al menos un mes";

    const asignado = form.meses.reduce((acc,m)=> acc + parseMonto(mesMontos[keyMes(m.year,m.month)]||0), 0);
    if (asignado !== total) e.descuadre = `El desglose (${formatearCLP(asignado)}) no coincide con el total (${formatearCLP(total)}).`;

    setErrores(e);
    return Object.keys(e).length===0;
  }

  async function onSubmit(ev){
    ev.preventDefault();
    if(!validar()) return;

    const detalleMeses = form.meses
      .slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month))
      .map(m=> ({ year:m.year, month:m.month, monto: parseMonto(mesMontos[keyMes(m.year,m.month)]||0) }));

    const ingreso = {
      fecha: form.fecha,
      parcela: String(form.parcela).trim(),
      nombre: form.nombre.trim(),
      monto: parseMonto(form.monto), // total del depósito
      detalleMeses,
      creadoEn: new Date().toISOString(),
    };

    await addIngreso(ingreso); // <-- Firestore
    onAdd?.();
    setForm(f=> ({...f, parcela:"", nombre:"", monto:"", meses:[]}));
    setMesMontos({});
    setErrores({});
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Registrar ingreso</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><label className="block text-sm">Fecha</label>
          <input type="date" value={form.fecha} min="2024-02-01" onChange={e=>actualizar("fecha",e.target.value)} className="w-full border rounded px-2 py-1"/>
          {errores.fecha&&<p className="text-red-600 text-sm">{errores.fecha}</p>}
        </div>

        <div><label className="block text-sm">Parcela</label>
          <select value={form.parcela} onChange={e=>actualizar("parcela",e.target.value)} className="w-full border rounded px-2 py-1">
            <option value="">Selecciona parcela</option>
            {Array.from({length:26},(_,i)=>i+1).map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          {errores.parcela&&<p className="text-red-600 text-sm">{errores.parcela}</p>}
        </div>

        <div><label className="block text-sm">Nombre</label>
          <input value={form.nombre} onChange={e=>actualizar("nombre",e.target.value)} className="w-full border rounded px-2 py-1"/>
          {errores.nombre&&<p className="text-red-600 text-sm">{errores.nombre}</p>}
        </div>

        <div><label className="block text-sm">Monto total (CLP)</label>
          <input inputMode="numeric" placeholder="$0" value={form.monto}
            onChange={e=>actualizar("monto",e.target.value)}
            onBlur={()=>actualizar("monto", formatearCLP(form.monto))}
            className="w-full border rounded px-2 py-1"/>
          {errores.monto&&<p className="text-red-600 text-sm">{errores.monto}</p>}
        </div>

        {/* Selector Mes/Año + Agregar */}
        <div>
          <label className="block text-sm">Mes(es) a pagar con monto</label>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={selMes} onChange={e=>setSelMes(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {MESES.map((m,idx)=> <option key={m} value={idx}>{m}</option>)}
            </select>
            <select value={selAño} onChange={e=>setSelAño(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {AÑOS.map(y=> <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" onClick={agregarMes} className="px-3 py-1 bg-gray-900 text-white rounded">Agregar</button>
          </div>

          {/* Lista de meses seleccionados con monto por mes */}
          <div className="mt-2 space-y-2">
            {form.meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month)).map(m=>(
              <div key={keyMes(m.year,m.month)} className="flex items-center gap-2">
                <span className="flex-1 text-xs bg-gray-100 border px-2 py-1 rounded">{labelMes(m.year,m.month)}</span>
                <input
                  placeholder="$0" inputMode="numeric"
                  value={mesMontos[keyMes(m.year,m.month)]||""}
                  onChange={e=>actualizarMesMonto(m.year,m.month,e.target.value)}
                  onBlur={e=>actualizarMesMonto(m.year,m.month, formatearCLP(e.target.value))}
                  className="w-32 border rounded px-2 py-1"
                />
                <button type="button" onClick={()=>quitarMes(m.year,m.month)} className="px-2 py-1 border rounded">Quitar</button>
              </div>
            ))}
          </div>

          {errores.meses&&<p className="text-red-600 text-sm mt-1">{errores.meses}</p>}
          {errores.descuadre&&<p className="text-red-600 text-sm mt-1">{errores.descuadre}</p>}
        </div>

        <button className="px-4 py-2 bg-gray-900 text-white rounded">Guardar ingreso</button>
      </form>
    </div>
  );
}

/*********************** Tabla Histórica de Ingresos ************************/
function IngresosTabla() {
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const [data,setData]=useState([]);
  const [editRow, setEditRow] = useState(null);

  const formatCLP = (n) =>
    new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})
      .format(typeof n==="number" ? n : parseInt(String(n).replace(/[^\d-]/g,"")||"0",10));

  useEffect(()=>{
    // Suscripción en tiempo real
    const off = watchIngresos(setData);
    return () => off && off();
  },[]);

  const filas = useMemo(()=> data
    .slice()
    .map(i=>{
      const meses = Array.isArray(i.detalleMeses) ? i.detalleMeses : [];
      const etiqueta = meses
        .slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month))
        .map(m=> `${MESES[m.month]} ${m.year}`)
        .join(", ");
      return { id:i.id, fecha:i.fecha, parcela:i.parcela, nombre:i.nombre, meses:etiqueta, monto:i.monto, raw:i };
    })
  ,[data]);

  async function eliminar(id){
    if (!window.confirm("¿Eliminar este ingreso?")) return;
    await deleteIngreso(id);
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Historial de Ingresos</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Fecha</th>
              <th className="border px-2 py-1 text-left">Parcela</th>
              <th className="border px-2 py-1 text-left">Nombre</th>
              <th className="border px-2 py-1 text-left">Meses</th>
              <th className="border px-2 py-1 text-right">Monto</th>
              <th className="border px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(r=>(
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.fecha}</td>
                <td className="border px-2 py-1">{r.parcela}</td>
                <td className="border px-2 py-1">{r.nombre}</td>
                <td className="border px-2 py-1">{r.meses}</td>
                <td className="border px-2 py-1 text-right">{formatCLP(r.monto)}</td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={()=>setEditRow(r.raw)} className="px-2 py-1 border rounded mr-2">Editar</button>
                  <button onClick={()=>eliminar(r.id)} className="px-2 py-1 border rounded text-red-700">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow && (
        <EditIngresoModal
          record={editRow}
          onClose={()=>setEditRow(null)}
          onSaved={async (updated)=>{
            await updateIngreso(updated.id, {
              fecha: updated.fecha,
              parcela: String(updated.parcela),
              nombre: updated.nombre,
              monto: Number(updated.monto),
              detalleMeses: updated.detalleMeses
            });
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}

/* Modal editar ingreso */
function EditIngresoModal({ record, onClose, onSaved }) {
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const yNow = new Date().getFullYear();
  const YEARS = Array.from({length:5},(_,i)=> yNow+1 - i);

  const [fecha, setFecha] = useState(record.fecha);
  const [parcela, setParcela] = useState(String(record.parcela||""));
  const [nombre, setNombre] = useState(record.nombre||"");
  const [monto, setMonto] = useState(record.monto);
  const [meses, setMeses] = useState(Array.isArray(record.detalleMeses)? record.detalleMeses : []); // [{year,month,monto}]
  const [selMes, setSelMes] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(yNow);
  const [errores, setErrores] = useState({});

  const parseMonto = (str) => {
    if (typeof str === "number") return Math.round(str);
    const limpio = String(str).replace(/[^\d-]/g, "");
    return limpio ? parseInt(limpio, 10) : 0;
  };
  const fmtCLP = (n) =>
    new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(parseMonto(n));

  const addMes = () => {
    const exists = meses.some(m=> m.year===selYear && m.month===selMes);
    if (exists) return;
    setMeses(prev=> [...prev, {year:selYear, month:selMes, monto:0}]);
  };
  const rmMes = (y,m) => setMeses(prev=> prev.filter(x=> !(x.year===y && x.month===m)));
  const setMontoMes = (y,m,val) =>
    setMeses(prev=> prev.map(x=> (x.year===y && x.month===m)? {...x, monto: parseMonto(val)} : x));

  const totalAsignado = meses.reduce((a,m)=> a + parseMonto(m.monto||0), 0);
  const totalDeposito = parseMonto(monto);

  function validar(){
    const e={};
    if(!fecha) e.fecha="Requerida";
    if(!parcela) e.parcela="Requerida";
    if(!nombre.trim()) e.nombre="Requerido";
    if(totalDeposito<=0) e.monto="Debe ser > 0";
    if(!meses.length) e.meses="Agrega al menos un mes";
    if(totalAsignado!==totalDeposito) e.descuadre=`Desglose ${fmtCLP(totalAsignado)} ≠ Total ${fmtCLP(totalDeposito)}`;
    setErrores(e);
    return Object.keys(e).length===0;
  }

  function save(){
    if(!validar()) return;
    onSaved({
      ...record,
      fecha,
      parcela: String(parcela),
      nombre: nombre.trim(),
      monto: totalDeposito,
      detalleMeses: meses
        .slice()
        .sort((a,b)=>(a.year-b.year)||(a.month-b.month))
        .map(m=> ({year:m.year, month:m.month, monto: parseMonto(m.monto)})),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-5">
        <h4 className="text-lg font-semibold mb-3">Editar ingreso</h4>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Fecha</label>
            <input type="date" value={fecha} min="2024-02-01" onChange={e=>setFecha(e.target.value)} className="w-full border rounded px-2 py-1"/>
            {errores.fecha && <p className="text-red-600 text-xs">{errores.fecha}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-600">Parcela</label>
            <select value={parcela} onChange={e=>setParcela(e.target.value)} className="w-full border rounded px-2 py-1">
              {Array.from({length:26},(_,i)=>i+1).map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
            {errores.parcela && <p className="text-red-600 text-xs">{errores.parcela}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600">Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full border rounded px-2 py-1"/>
            {errores.nombre && <p className="text-red-600 text-xs">{errores.nombre}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600">Monto total (CLP)</label>
            <input inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)} onBlur={e=>setMonto(fmtCLP(e.target.value))} className="w-full border rounded px-2 py-1"/>
            {errores.monto && <p className="text-red-600 text-xs">{errores.monto}</p>}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-600">Mes(es) del pago</label>
          <div className="flex gap-2 items-center">
            <select value={selMes} onChange={e=>setSelMes(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {MESES.map((m,i)=> <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {YEARS.map(y=> <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={addMes} className="px-3 py-1 border rounded">Agregar</button>
          </div>

          <div className="mt-2 space-y-2 max-h-56 overflow-auto">
            {meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month)).map(m=>(
              <div key={`${m.year}-${m.month}`} className="flex items-center gap-2">
                <span className="flex-1 text-xs bg-gray-100 border px-2 py-1 rounded">
                  {MESES[m.month]} {m.year}
                </span>
                <input
                  className="w-32 border rounded px-2 py-1"
                  inputMode="numeric"
                  value={m.monto}
                  onChange={e=>setMontoMes(m.year,m.month, e.target.value)}
                />
                <button onClick={()=>rmMes(m.year,m.month)} className="px-2 py-1 border rounded">Quitar</button>
              </div>
            ))}
          </div>

          <div className="text-xs mt-2">
            Total asignado: <b>{fmtCLP(totalAsignado)}</b> — Total depósito: <b>{fmtCLP(totalDeposito)}</b>
            {errores.descuadre && <p className="text-red-600">{errores.descuadre}</p>}
            {errores.meses && <p className="text-red-600">{errores.meses}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 border rounded">Cancelar</button>
          <button onClick={save} className="px-3 py-2 rounded bg-gray-900 text-white">Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

/*********************** Egreso (categorías + agregar) ************************/
const DEFAULT_CATS=["Seguridad","Mantencion","Camino","Porton","Electricidad","Compras"];
function EgresoForm({ onAdd }){
  const hoy=new Date().toISOString().slice(0,10);
  const [categorias,setCategorias]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('categorias_egresos')||'[]');
      return saved?.length ? saved : DEFAULT_CATS;
    }catch{ return DEFAULT_CATS; }
  });
  const [nuevaCat,setNuevaCat]=useState("");
  const [form,setForm]=useState({ fecha:hoy, categoria:categorias[0]||DEFAULT_CATS[0], descripcion:"", monto:"" });
  const [errores,setErrores]=useState({});

  useEffect(()=>{ try{ localStorage.setItem('categorias_egresos', JSON.stringify(categorias)); }catch{} },[categorias]);
  useEffect(()=>{ if(!categorias.includes(form.categoria)) setForm(f=>({...f, categoria: categorias[0]||"" })); },[categorias]);

  function actualizar(k,v){ setForm(f=>({ ...f, [k]: v })); }
  function addCat(){
    const n=(nuevaCat||"").trim(); if(!n) return;
    const existe=categorias.some(c=>c.toLowerCase()===n.toLowerCase());
    if(existe){ setNuevaCat(""); return; }
    setCategorias([...categorias,n]); setNuevaCat("");
  }
  function validar(){
    const e={};
    if(!form.fecha) e.fecha="La fecha es obligatoria";
    if(!form.categoria) e.categoria="Selecciona una categoría";
    if(!form.descripcion.trim()) e.descripcion="Agrega una descripción";
    const m=parseMontoCLP(form.monto); if(!m||m<=0) e.monto="El monto debe ser mayor a 0";
    setErrores(e); return Object.keys(e).length===0;
  }
  async function onSubmit(ev){
    ev.preventDefault(); if(!validar()) return;
    const egreso={
      fecha:form.fecha, categoria:form.categoria, descripcion:form.descripcion.trim(),
      monto:parseMontoCLP(form.monto), creadoEn:new Date().toISOString()
    };
    await addEgreso(egreso);   // <-- Firestore
    onAdd?.(egreso);
    setForm(f=>({ ...f, descripcion:"", monto:"" }));
  }

  return(
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Registrar egreso</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input type="date" value={form.fecha} min="2024-02-01" onChange={e=>actualizar('fecha',e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          {errores.fecha&&<p className="text-sm text-red-600 mt-1">{errores.fecha}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select value={form.categoria} onChange={e=>actualizar('categoria',e.target.value)} className="w-full border rounded-lg px-3 py-2">
            {categorias.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          {errores.categoria&&<p className="text-sm text-red-600 mt-1">{errores.categoria}</p>}
          <div className="mt-3 flex gap-2">
            <input type="text" placeholder="Agregar nueva categoría" value={nuevaCat} onChange={e=>setNuevaCat(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" />
            <button type="button" onClick={addCat} className="px-3 py-2 rounded-xl shadow bg-gray-900 text-white">Agregar</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <input type="text" value={form.descripcion} onChange={e=>actualizar('descripcion',e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          {errores.descripcion&&<p className="text-sm text-red-600 mt-1">{errores.descripcion}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monto (CLP)</label>
          <input inputMode="numeric" placeholder="$0" value={form.monto} onChange={e=>actualizar('monto',e.target.value)} onBlur={()=>actualizar('monto', formatCLP(form.monto))} className="w-full border rounded-lg px-3 py-2" />
          {errores.monto&&<p className="text-sm text-red-600 mt-1">{errores.monto}</p>}
        </div>
        <div className="pt-2"><button className="w-full md:w-auto px-4 py-2 rounded-xl shadow bg-gray-900 text-white">Guardar egreso</button></div>
      </form>
    </div>
  );
}

/*********************** Tabla Histórica de Egresos ************************/
function EgresosTabla() {
  const [data,setData]=useState([]);
  const [editRow, setEditRow] = useState(null);

  const fmtCLP = (n) =>
    new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})
      .format(typeof n==="number" ? n : parseInt(String(n).replace(/[^\d-]/g,"")||"0",10));

  useEffect(()=>{
    const off = watchEgresos(setData); // tiempo real
    return () => off && off();
  },[]);

  const filas = useMemo(()=> {
    const out = data.slice();
    out.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));
    return out;
  },[data]);

  async function eliminar(id){
    if(!window.confirm("¿Eliminar este egreso?")) return;
    await deleteEgreso(id);
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Historial de Egresos</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Fecha</th>
              <th className="border px-2 py-1 text-left">Categoría</th>
              <th className="border px-2 py-1 text-left">Descripción</th>
              <th className="border px-2 py-1 text-right">Monto</th>
              <th className="border px-2 py-1 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(r=>(
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.fecha}</td>
                <td className="border px-2 py-1">{r.categoria}</td>
                <td className="border px-2 py-1">{r.descripcion}</td>
                <td className="border px-2 py-1 text-right">{fmtCLP(r.monto)}</td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={()=>setEditRow(r)} className="px-2 py-1 border rounded mr-2">Editar</button>
                  <button onClick={()=>eliminar(r.id)} className="px-2 py-1 border rounded text-red-700">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow && (
        <EditEgresoModal
          record={editRow}
          onClose={()=>setEditRow(null)}
          onSaved={async (updated)=>{
            await updateEgreso(updated.id, {
              fecha: updated.fecha,
              categoria: updated.categoria,
              descripcion: updated.descripcion,
              monto: Number(updated.monto)
            });
            setEditRow(null);
          }}
        />
      )}
    </div>
  );
}

/* Modal editar egreso */
function EditEgresoModal({ record, onClose, onSaved }) {
  const [fecha, setFecha] = useState(record.fecha);
  const [categoria, setCategoria] = useState(record.categoria||"");
  const [descripcion, setDescripcion] = useState(record.descripcion||"");
  const [monto, setMonto] = useState(record.monto);

  const parseMonto = (str) => {
    if (typeof str === "number") return Math.round(str);
    const limpio = String(str).replace(/[^\d-]/g, "");
    return limpio ? parseInt(limpio, 10) : 0;
  };
  const fmtCLP = (n) =>
    new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(parseMonto(n));

  function save(){
    if(!fecha || !categoria || !descripcion || parseMonto(monto)<=0) return;
    onSaved({
      ...record,
      fecha,
      categoria: categoria.trim(),
      descripcion: descripcion.trim(),
      monto: parseMonto(monto),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow p-5">
        <h4 className="text-lg font-semibold mb-3">Editar egreso</h4>

        <div className="grid gap-3">
          <div>
            <label className="block text-xs text-gray-600">Fecha</label>
            <input type="date" value={fecha} min="2024-02-01" onChange={e=>setFecha(e.target.value)} className="w-full border rounded px-2 py-1"/>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Categoría</label>
            <input value={categoria} onChange={e=>setCategoria(e.target.value)} className="w-full border rounded px-2 py-1"/>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Descripción</label>
            <input value={descripcion} onChange={e=>setDescripcion(e.target.value)} className="w-full border rounded px-2 py-1"/>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Monto</label>
            <input inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)} onBlur={e=>setMonto(fmtCLP(e.target.value))} className="w-full border rounded px-2 py-1"/>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 border rounded">Cancelar</button>
          <button onClick={save} className="px-3 py-2 rounded bg-gray-900 text-white">Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
