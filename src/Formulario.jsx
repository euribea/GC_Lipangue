import { useEffect, useMemo, useState } from "react";
import {
  onUser, login, logout,
  addIngreso, addEgreso,
  watchIngresos, watchEgresos,
  updateIngreso, updateEgreso,
  deleteIngreso, deleteEgreso
} from "./lib/firebase";

/* =================== Helpers =================== */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function parseMonto(str){ if(typeof str==="number") return Math.round(str); const limpio=String(str).replace(/[^\d-]/g,""); return limpio?parseInt(limpio,10):0; }
function fmtCLP(n){ return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(parseMonto(n)); }

/* =================== Export por defecto: Ruta protegida =================== */
export default function Movimientos() {
  const [user, setUser] = useState(null);
  useEffect(() => onUser(setUser), []);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-2">Acceso privado</h1>
        <p className="mb-5 text-gray-600">
          Inicia sesión para registrar y editar movimientos.
        </p>
        <button onClick={login} className="px-4 py-2 bg-gray-900 text-white rounded">
          Entrar con Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <div className="text-sm text-gray-600">
          Conectado como <b>{user.email}</b>{" "}
          <button onClick={logout} className="ml-3 underline">Cerrar sesión</button>
        </div>
      </div>
      <FinanzasForm />
    </div>
  );
}

/* =================== Componente principal de formularios + tablas =================== */
function FinanzasForm() {
  const [tipo, setTipo] = useState("ingreso");
  return (
    <>
      <div className="bg-white p-4 rounded-2xl shadow flex gap-6 items-center">
        <span className="text-sm text-gray-600">Tipo de movimiento</span>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="ingreso" checked={tipo==="ingreso"} onChange={()=>setTipo("ingreso")} /> Ingreso
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="tipo" value="egreso" checked={tipo==="egreso"} onChange={()=>setTipo("egreso")} /> Egreso
        </label>
      </div>

      {tipo==="ingreso" ? (
        <>
          <IngresoForm />
          <IngresosTabla />
        </>
      ) : (
        <>
          <EgresoForm />
          <EgresosTabla />
        </>
      )}
    </>
  );
}

/* =================== Ingreso =================== */
function IngresoForm() {
  const hoy = new Date().toISOString().slice(0,10);
  const yNow = new Date().getFullYear();
  const YEARS = Array.from({length:5},(_,i)=> yNow+1-i); // año actual+1 hacia atrás

  const [form, setForm] = useState({ fecha: hoy, parcela:"", nombre:"", monto:"", meses:[]/*[{year,month}]*/ });
  const [selMes, setSelMes] = useState(new Date().getMonth());
  const [selYear, setSelYear] = useState(yNow);
  const [mesMontos, setMesMontos] = useState({}); // key "YYYY-MM" => "$..."
  const [errores, setErrores] = useState({});

  const keyMes = (y,m)=> `${y}-${String(m+1).padStart(2,"0")}`;
  const labelMes = (y,m)=> `${MESES[m]} ${y}`;
  const actualizar = (k,v)=> setForm(f=>({...f,[k]:v}));

  function agregarMes(){
    const existe = form.meses.some(x=> x.year===selYear && x.month===selMes);
    if(!existe) setForm(f=>({...f, meses:[...f.meses, {year:selYear, month:selMes}]}));
  }
  function quitarMes(y,m){
    setForm(f=>({...f, meses:f.meses.filter(x=> !(x.year===y&&x.month===m))}));
    setMesMontos(prev=>{ const {[keyMes(y,m)]:_, ...rest}=prev; return rest; });
  }
  function setMontoMes(y,m,val){ setMesMontos(prev=>({...prev, [keyMes(y,m)]:val})); }

  function validar(){
    const e={};
    if(!form.fecha) e.fecha="Requerida";
    if(!form.parcela) e.parcela="Requerida";
    if(!form.nombre.trim()) e.nombre="Requerido";
    const total=parseMonto(form.monto); if(!total||total<=0) e.monto="Debe ser > 0";
    if(!form.meses.length) e.meses="Agrega al menos un mes";

    const asignado=form.meses.reduce((acc,m)=> acc+parseMonto(mesMontos[keyMes(m.year,m.month)]||0),0);
    if(asignado!==total) e.descuadre=`Desglose ${fmtCLP(asignado)} ≠ Total ${fmtCLP(total)}`;

    setErrores(e);
    return Object.keys(e).length===0;
  }

  async function onSubmit(e){
    e.preventDefault();
    if(!validar()) return;

    const detalleMeses = form.meses
      .slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month))
      .map(m=>({year:m.year, month:m.month, monto:parseMonto(mesMontos[keyMes(m.year,m.month)]||0)}));

    const ingreso = {
      fecha:form.fecha,
      parcela:String(form.parcela).trim(),
      nombre:form.nombre.trim(),
      monto:parseMonto(form.monto),
      detalleMeses,
      creadoEn:new Date().toISOString()
    };

    try {
      await addIngreso(ingreso); // Firestore
      // limpiar
      setForm(f=>({...f, parcela:"", nombre:"", monto:"", meses:[]}));
      setMesMontos({});
      setErrores({});
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar el ingreso en Firestore: " + (err?.message || err));
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Registrar ingreso</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm">Fecha</label>
          <input type="date" value={form.fecha} min="2024-02-01"
                 onChange={e=>actualizar("fecha",e.target.value)}
                 className="w-full border rounded px-2 py-1"/>
          {errores.fecha && <p className="text-red-600 text-sm">{errores.fecha}</p>}
        </div>
        <div>
          <label className="block text-sm">Parcela</label>
          <select value={form.parcela} onChange={e=>actualizar("parcela",e.target.value)}
                  className="w-full border rounded px-2 py-1">
            <option value="">Selecciona parcela</option>
            {Array.from({length:26},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          {errores.parcela && <p className="text-red-600 text-sm">{errores.parcela}</p>}
        </div>
        <div>
          <label className="block text-sm">Nombre</label>
          <input value={form.nombre} onChange={e=>actualizar("nombre",e.target.value)}
                 className="w-full border rounded px-2 py-1"/>
          {errores.nombre && <p className="text-red-600 text-sm">{errores.nombre}</p>}
        </div>
        <div>
          <label className="block text-sm">Monto total (CLP)</label>
          <input inputMode="numeric" placeholder="$0" value={form.monto}
                 onChange={e=>actualizar("monto",e.target.value)}
                 onBlur={()=>actualizar("monto", fmtCLP(form.monto))}
                 className="w-full border rounded px-2 py-1"/>
          {errores.monto && <p className="text-red-600 text-sm">{errores.monto}</p>}
        </div>

        <div>
          <label className="block text-sm">Mes(es) a pagar con monto</label>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={selMes} onChange={e=>setSelMes(parseInt(e.target.value))}
                    className="border rounded px-2 py-1">
              {MESES.map((m,i)=><option key={m} value={i}>{m}</option>)}
            </select>
            <select value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))}
                    className="border rounded px-2 py-1">
              {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" onClick={agregarMes}
                    className="px-3 py-1 bg-gray-900 text-white rounded">Agregar</button>
          </div>

          <div className="mt-2 space-y-2">
            {form.meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month)).map(m=>(
              <div key={keyMes(m.year,m.month)} className="flex items-center gap-2">
                <span className="flex-1 text-xs bg-gray-100 border px-2 py-1 rounded">
                  {labelMes(m.year,m.month)}
                </span>
                <input
                  placeholder="$0" inputMode="numeric"
                  value={mesMontos[keyMes(m.year,m.month)]||""}
                  onChange={e=>setMontoMes(m.year,m.month,e.target.value)}
                  onBlur={e=>setMontoMes(m.year,m.month, fmtCLP(e.target.value))}
                  className="w-32 border rounded px-2 py-1"
                />
                <button type="button" onClick={()=>quitarMes(m.year,m.month)}
                        className="px-2 py-1 border rounded">Quitar</button>
              </div>
            ))}
          </div>

          {errores.meses && <p className="text-red-600 text-sm">{errores.meses}</p>}
          {errores.descuadre && <p className="text-red-600 text-sm">{errores.descuadre}</p>}
        </div>

        <button className="px-4 py-2 bg-gray-900 text-white rounded">Guardar ingreso</button>
      </form>
    </div>
  );
}

/* =================== Tabla de Ingresos =================== */
function IngresosTabla(){
  const [data,setData]=useState([]);
  const [editRow,setEditRow]=useState(null);

  useEffect(()=>{ const off=watchIngresos(setData); return ()=>off&&off(); },[]);
  const filas=useMemo(()=> data.map(i=>{
    const meses=Array.isArray(i.detalleMeses)?i.detalleMeses:[];
    const etiqueta=meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month))
      .map(m=>`${MESES[m.month]} ${m.year}`).join(", ");
    return { id:i.id, fecha:i.fecha, parcela:i.parcela, nombre:i.nombre, meses:etiqueta, monto:i.monto, raw:i };
  }),[data]);

  async function eliminar(id){
    if(!window.confirm("¿Eliminar este ingreso?")) return;
    try { await deleteIngreso(id); } catch(e){ alert("Error al eliminar: "+(e?.message||e)); }
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
                <td className="border px-2 py-1 text-right">{fmtCLP(r.monto)}</td>
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
          onSaved={async(updated)=>{
            try {
              await updateIngreso(updated.id, {
                fecha: updated.fecha,
                parcela: String(updated.parcela),
                nombre: updated.nombre,
                monto: Number(updated.monto),
                detalleMeses: updated.detalleMeses
              });
              setEditRow(null);
            } catch(e){ alert("No se pudo actualizar: "+(e?.message||e)); }
          }}
        />
      )}
    </div>
  );
}

/* =================== Modal editar ingreso =================== */
function EditIngresoModal({ record, onClose, onSaved }) {
  const yNow = new Date().getFullYear();
  const YEARS = Array.from({length:5},(_,i)=> yNow+1-i);

  const [fecha,setFecha]=useState(record.fecha);
  const [parcela,setParcela]=useState(String(record.parcela||""));
  const [nombre,setNombre]=useState(record.nombre||"");
  const [monto,setMonto]=useState(record.monto);
  const [meses,setMeses]=useState(Array.isArray(record.detalleMeses)?record.detalleMeses:[]);
  const [selMes,setSelMes]=useState(new Date().getMonth());
  const [selYear,setSelYear]=useState(yNow);
  const [errores,setErrores]=useState({});

  const addMes=()=>{ if(!meses.some(m=>m.year===selYear&&m.month===selMes)) setMeses(p=>[...p,{year:selYear,month:selMes,monto:0}]); };
  const rmMes=(y,m)=> setMeses(p=>p.filter(x=>!(x.year===y&&x.month===m)));
  const setMontoMes=(y,m,val)=> setMeses(p=>p.map(x=>x.year===y&&x.month===m?{...x,monto:parseMonto(val)}:x));

  const totalAsignado = meses.reduce((a,m)=>a+parseMonto(m.monto||0),0);
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
      parcela:String(parcela),
      nombre:nombre.trim(),
      monto:totalDeposito,
      detalleMeses: meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month)).map(m=>({
        year:m.year, month:m.month, monto:parseMonto(m.monto)
      })),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-5">
        <h4 className="text-lg font-semibold mb-3">Editar ingreso</h4>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Fecha</label>
            <input type="date" value={fecha} min="2024-02-01"
                   onChange={e=>setFecha(e.target.value)}
                   className="w-full border rounded px-2 py-1"/>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Parcela</label>
            <select value={parcela} onChange={e=>setParcela(e.target.value)}
                    className="w-full border rounded px-2 py-1">
              {Array.from({length:26},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600">Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} className="w-full border rounded px-2 py-1"/>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-600">Monto total (CLP)</label>
            <input inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)}
                   onBlur={e=>setMonto(fmtCLP(e.target.value))}
                   className="w-full border rounded px-2 py-1"/>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-600">Mes(es) del pago</label>
          <div className="flex gap-2 items-center">
            <select value={selMes} onChange={e=>setSelMes(parseInt(e.target.value))}
                    className="border rounded px-2 py-1">
              {MESES.map((m,i)=><option key={m} value={i}>{m}</option>)}
            </select>
            <select value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))}
                    className="border rounded px-2 py-1">
              {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={addMes} className="px-3 py-1 border rounded">Agregar</button>
          </div>

          <div className="mt-2 space-y-2 max-h-56 overflow-auto">
            {meses.slice().sort((a,b)=>(a.year-b.year)||(a.month-b.month)).map(m=>(
              <div key={`${m.year}-${m.month}`} className="flex items-center gap-2">
                <span className="flex-1 text-xs bg-gray-100 border px-2 py-1 rounded">
                  {MESES[m.month]} {m.year}
                </span>
                <input className="w-32 border rounded px-2 py-1" inputMode="numeric"
                       value={m.monto} onChange={e=>setMontoMes(m.year,m.month,e.target.value)} />
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

/* =================== Egreso =================== */
const DEFAULT_CATS=["Seguridad","Mantencion","Camino","Porton","Electricidad","Compras"];

function EgresoForm(){
  const hoy=new Date().toISOString().slice(0,10);
  const [categorias,setCategorias]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('categorias_egresos')||'[]');
      return saved?.length? saved : DEFAULT_CATS;
    }catch{ return DEFAULT_CATS; }
  });
  const [nuevaCat,setNuevaCat]=useState("");
  const [form,setForm]=useState({ fecha:hoy, categoria:DEFAULT_CATS[0], descripcion:"", monto:"" });
  const [errores,setErrores]=useState({});

  useEffect(()=>{ try{ localStorage.setItem('categorias_egresos', JSON.stringify(categorias)); }catch{} },[categorias]);

  function actualizar(k,v){ setForm(f=>({...f,[k]:v})); }
  function addCat(){
    const n=(nuevaCat||"").trim(); if(!n) return;
    if(categorias.some(c=>c.toLowerCase()===n.toLowerCase())){ setNuevaCat(""); return; }
    setCategorias([...categorias,n]); setNuevaCat("");
  }
  function validar(){
    const e={};
    if(!form.fecha) e.fecha="Requerida";
    if(!form.categoria) e.categoria="Elige categoría";
    if(!form.descripcion.trim()) e.descripcion="Requerida";
    if(parseMonto(form.monto)<=0) e.monto="Debe ser > 0";
    setErrores(e); return Object.keys(e).length===0;
  }

  async function onSubmit(e){
    e.preventDefault();
    if(!validar()) return;
    const egreso={ fecha:form.fecha, categoria:form.categoria, descripcion:form.descripcion.trim(), monto:parseMonto(form.monto), creadoEn:new Date().toISOString() };
    try {
      await addEgreso(egreso);
      setForm(f=>({...f, descripcion:"", monto:""}));
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar el egreso en Firestore: " + (err?.message || err));
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Registrar egreso</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm">Fecha</label>
          <input type="date" value={form.fecha} min="2024-02-01"
                 onChange={e=>actualizar("fecha",e.target.value)}
                 className="w-full border rounded px-2 py-1"/>
          {errores.fecha && <p className="text-red-600 text-sm">{errores.fecha}</p>}
        </div>
        <div>
          <label className="block text-sm">Categoría</label>
          <select value={form.categoria} onChange={e=>actualizar("categoria",e.target.value)}
                  className="w-full border rounded px-2 py-1">
            {categorias.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {errores.categoria && <p className="text-red-600 text-sm">{errores.categoria}</p>}
          <div className="mt-2 flex gap-2">
            <input className="flex-1 border rounded px-2 py-1" placeholder="Agregar nueva categoría"
                   value={nuevaCat} onChange={e=>setNuevaCat(e.target.value)} />
            <button type="button" onClick={addCat} className="px-3 py-1 bg-gray-900 text-white rounded">Agregar</button>
          </div>
        </div>
        <div>
          <label className="block text-sm">Descripción</label>
          <input value={form.descripcion} onChange={e=>actualizar("descripcion",e.target.value)}
                 className="w-full border rounded px-2 py-1"/>
          {errores.descripcion && <p className="text-red-600 text-sm">{errores.descripcion}</p>}
        </div>
        <div>
          <label className="block text-sm">Monto (CLP)</label>
          <input inputMode="numeric" placeholder="$0" value={form.monto}
                 onChange={e=>actualizar("monto",e.target.value)}
                 onBlur={()=>actualizar("monto", fmtCLP(form.monto))}
                 className="w-full border rounded px-2 py-1"/>
          {errores.monto && <p className="text-red-600 text-sm">{errores.monto}</p>}
        </div>
        <button className="px-4 py-2 bg-gray-900 text-white rounded">Guardar egreso</button>
      </form>
    </div>
  );
}

/* =================== Tabla de Egresos =================== */
function EgresosTabla(){
  const [data,setData]=useState([]);
  const [editRow,setEditRow]=useState(null);

  useEffect(()=>{ const off=watchEgresos(setData); return ()=>off&&off(); },[]);
  const filas=useMemo(()=> data.slice().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)),[data]);

  async function eliminar(id){
    if(!window.confirm("¿Eliminar este egreso?")) return;
    try { await deleteEgreso(id); } catch(e){ alert("Error al eliminar: "+(e?.message||e)); }
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
          onSaved={async(updated)=>{
            try{
              await updateEgreso(updated.id, {
                fecha: updated.fecha,
                categoria: updated.categoria,
                descripcion: updated.descripcion,
                monto: Number(updated.monto)
              });
              setEditRow(null);
            }catch(e){ alert("No se pudo actualizar: "+(e?.message||e)); }
          }}
        />
      )}
    </div>
  );
}

/* =================== Modal editar egreso =================== */
function EditEgresoModal({ record, onClose, onSaved }){
  const [fecha,setFecha]=useState(record.fecha);
  const [categoria,setCategoria]=useState(record.categoria||"");
  const [descripcion,setDescripcion]=useState(record.descripcion||"");
  const [monto,setMonto]=useState(record.monto);

  function save(){
    if(!fecha || !categoria || !descripcion || parseMonto(monto)<=0) return;
    onSaved({
      ...record,
      fecha,
      categoria:categoria.trim(),
      descripcion:descripcion.trim(),
      monto:parseMonto(monto)
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow p-5">
        <h4 className="text-lg font-semibold mb-3">Editar egreso</h4>
        <div className="grid gap-3">
          <div>
            <label className="block text-xs text-gray-600">Fecha</label>
            <input type="date" value={fecha} min="2024-02-01" onChange={e=>setFecha(e.target.value)}
                   className="w-full border rounded px-2 py-1"/>
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
            <input inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)}
                   onBlur={e=>setMonto(fmtCLP(e.target.value))}
                   className="w-full border rounded px-2 py-1"/>
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
