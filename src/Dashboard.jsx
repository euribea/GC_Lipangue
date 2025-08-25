import { useEffect, useMemo, useState } from "react";

/* ===== Constantes y utilidades ===== */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PARCELAS_TOTAL = 26;
const CUOTA_MENSUAL = 40000;                   // Ajusta si cambia la cuota
const INICIO_DEUDA  = { year: 2024, month: 1 } // feb/2024  (0=Ene, 1=Feb)

const parseMonto = (v) => {
  if (typeof v === "number") return Math.round(v);
  const limpio = String(v ?? "").replace(/[^\d-]/g, "");
  return limpio ? parseInt(limpio, 10) : 0;
};
const fmtCLP = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
    .format(parseMonto(n));

const getIngresos = () => {
  try { const d = JSON.parse(localStorage.getItem("ingresos") || "[]"); return Array.isArray(d) ? d : []; }
  catch { return []; }
};
const getEgresos = () => {
  try { const d = JSON.parse(localStorage.getItem("egresos") || "[]"); return Array.isArray(d) ? d : []; }
  catch { return []; }
};

// meses entre dos puntos (incluye extremos)
function monthsBetweenInclusive(aY, aM, bY, bM) {
  return (bY - aY) * 12 + (bM - aM) + 1;
}
// (y,m) dentro del rango [a..b] (incl.)
function isMonthInRange(y, m, aY, aM, bY, bM) {
  const a = aY * 12 + aM, b = bY * 12 + bM, v = y * 12 + m;
  return v >= a && v <= b;
}

/* ===== Tarjeta mini estilo reporte ===== */
function StatCard({ title, value, icon, accent = "violet" }) {
  const accents = {
    violet: "border-violet-500 bg-violet-50",
    green:  "border-emerald-500 bg-emerald-50",
    red:    "border-rose-500 bg-rose-50",
    yellow: "border-amber-500 bg-amber-50",
    indigo: "border-indigo-500 bg-indigo-50",
  };
  return (
    <div className={`rounded-xl shadow border-l-4 ${accents[accent]} p-4`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-xs font-semibold text-gray-600">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const hoy = new Date();

  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);

  useEffect(() => {
    setIngresos(getIngresos());
    setEgresos(getEgresos());
  }, []);

  /* ===== Sección 1: Balance mensual ===== */
  const ingresoMensual = useMemo(() => {
    let total = 0;
    for (const ing of ingresos) {
      const det = Array.isArray(ing.detalleMeses) ? ing.detalleMeses : [];
      for (const d of det) if (d.year === anio && d.month === mes) total += parseMonto(d.monto);
    }
    return total;
  }, [ingresos, mes, anio]);

  const egresoMensual = useMemo(() => {
    let total = 0;
    for (const eg of egresos) {
      const f = new Date(eg.fecha);
      if (f.getFullYear() === anio && f.getMonth() === mes) total += parseMonto(eg.monto);
    }
    return total;
  }, [egresos, mes, anio]);

  const ingresoHistorico = useMemo(() => {
    let total = 0;
    for (const ing of ingresos) {
      const det = Array.isArray(ing.detalleMeses) ? ing.detalleMeses : [];
      for (const d of det) total += parseMonto(d.monto);
    }
    return total;
  }, [ingresos]);

  const egresoHistorico = useMemo(() => {
    let total = 0;
    for (const eg of egresos) total += parseMonto(eg.monto);
    return total;
  }, [egresos]);

  const diferencia = ingresoMensual - egresoMensual;
  const totalDisponible = ingresoHistorico - egresoHistorico;

  const egresosDelMes = useMemo(() => {
    const arr = egresos.filter(e => {
      const f = new Date(e.fecha);
      return f.getFullYear() === anio && f.getMonth() === mes;
    });
    arr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return arr;
  }, [egresos, mes, anio]);

  /* ===== Sección 2: Matriz anual (por año seleccionado) ===== */
  const matrizPagosAnual = useMemo(() => {
    const matrix   = Array.from({ length: PARCELAS_TOTAL }, () => Array(12).fill(0));
    const totalFila= Array(PARCELAS_TOTAL).fill(0);
    const totalCol = Array(12).fill(0);

    for (const ing of ingresos) {
      const parc = Number(ing.parcela);
      if (!parc || parc < 1 || parc > PARCELAS_TOTAL) continue;
      const det = Array.isArray(ing.detalleMeses) ? ing.detalleMeses : [];
      for (const d of det) {
        if (d.year === anio && d.month >= 0 && d.month < 12) {
          const v = parseMonto(d.monto);
          matrix[parc - 1][d.month] += v;
        }
      }
    }
    for (let r = 0; r < PARCELAS_TOTAL; r++) {
      for (let c = 0; c < 12; c++) {
        totalFila[r] += matrix[r][c];
        totalCol[c]  += matrix[r][c];
      }
    }
    return { matrix, totalFila, totalCol };
  }, [ingresos, anio]);

  /* === NUEVO cálculo de deuda agrupada por año === */
  const deudaHistorica = useMemo(() => {
  const corteY = hoy.getFullYear();
  const corteM = hoy.getMonth();

  // Años de deuda desde inicio (2024 hasta año actual)
  const anios = [];
  for (let y = INICIO_DEUDA.year; y <= corteY; y++) anios.push(y);

  // Inicializamos matriz: [parcela][anio]
  const deudaPorParcela = Array.from({ length: PARCELAS_TOTAL }, () =>
    Object.fromEntries(anios.map(a => [a, 0]))
  );

  // Meses esperados por año
  for (let p = 1; p <= PARCELAS_TOTAL; p++) {
    for (let y of anios) {
      const desdeMes = (y === INICIO_DEUDA.year) ? INICIO_DEUDA.month : 0;
      const hastaMes = (y === corteY) ? corteM : 11;
      const mesesEsperados = monthsBetweenInclusive(y, desdeMes, y, hastaMes);
      deudaPorParcela[p - 1][y] = mesesEsperados * CUOTA_MENSUAL;
    }
  }

  // Restamos pagos por año
  for (const ing of ingresos) {
    const parc = Number(ing.parcela);
    if (!parc || parc < 1 || parc > PARCELAS_TOTAL) continue;
    const det = Array.isArray(ing.detalleMeses) ? ing.detalleMeses : [];
    for (const d of det) {
      if (d.year >= INICIO_DEUDA.year && d.year <= corteY) {
        deudaPorParcela[parc - 1][d.year] -= parseMonto(d.monto);
      }
    }
  }

  // Recalculamos: deuda negativa se corrige a 0
  const filas = [];
  const totalPorAnio = Object.fromEntries(anios.map(a => [a, 0]));
  let totalGlobal = 0;

  for (let p = 1; p <= PARCELAS_TOTAL; p++) {
    const fila = { parcela: p };
    let totalP = 0;
    for (let y of anios) {
      const deuda = Math.max(0, deudaPorParcela[p - 1][y]);
      fila[y] = deuda;
      totalP += deuda;
      totalPorAnio[y] += deuda;
    }
    fila.total = totalP;
    totalGlobal += totalP;
    filas.push(fila);
  }

  return { filas, anios, totalPorAnio, totalGlobal };
}, [ingresos]);


  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banda morada con el mes/año */}
      <div className="bg-violet-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 text-center text-2xl font-extrabold tracking-wide">
          {MESES[mes]} {anio}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Filtros */}
        <section className="bg-white rounded-2xl shadow border border-violet-100 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Mes</label>
              <select
                value={mes}
                onChange={(e)=>setMes(parseInt(e.target.value))}
                className="border rounded px-3 py-2 bg-violet-50 focus:ring-2 focus:ring-violet-400"
              >
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Año</label>
              <select
                value={anio}
                onChange={(e)=>setAnio(parseInt(e.target.value))}
                className="border rounded px-3 py-2 bg-violet-50 focus:ring-2 focus:ring-violet-400"
              >
                {Array.from({length:6},(_,i)=> hoy.getFullYear()+1 - i).map(y=>
                  <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="ml-auto text-sm text-gray-600">
              Mostrando: <b>{MESES[mes]} {anio}</b>
            </div>
          </div>
        </section>

        {/* Balance */}
        <section className="grid md:grid-cols-4 gap-4">
          <StatCard title="Ingreso mensual" value={fmtCLP(ingresoMensual)} icon="💸" accent="green" />
          <StatCard title="Egreso mensual"  value={fmtCLP(egresoMensual)}  icon="🧾" accent="red" />
          <StatCard
            title="Diferencia"
            value={<span className={`font-bold ${diferencia>=0 ? "text-emerald-700" : "text-red-600"}`}>{fmtCLP(diferencia)}</span>}
            icon="➖➕"
            accent="indigo"
          />
          <StatCard title="Saldo disponible (histórico)" value={fmtCLP(totalDisponible)} icon="🪙" accent="yellow" />
        </section>

        {/* Detalle egresos del mes */}
        <section className="bg-white rounded-2xl shadow border border-violet-100 p-4">
          <h3 className="text-lg font-semibold mb-3 text-violet-800">
            Detalle de egresos — {MESES[mes]} {anio}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-violet-100 text-violet-900">
                <tr>
                  <th className="border px-3 py-2 text-left">Fecha</th>
                  <th className="border px-3 py-2 text-left">Categoría</th>
                  <th className="border px-3 py-2 text-left">Descripción</th>
                  <th className="border px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {egresosDelMes.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-500">No hay egresos para este mes.</td></tr>
                )}
                {egresosDelMes.map(e=>(
                  <tr key={e.id} className="odd:bg-gray-50 hover:bg-violet-50">
                    <td className="border px-3 py-1">{e.fecha}</td>
                    <td className="border px-3 py-1">{e.categoria}</td>
                    <td className="border px-3 py-1">{e.descripcion}</td>
                    <td className="border px-3 py-1 text-right font-medium">{fmtCLP(e.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td colSpan={3} className="border px-3 py-2 font-bold text-right">Total</td>
                  <td className="border px-3 py-2 text-right font-bold">{fmtCLP(egresoMensual)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Matriz anual GC (celdas coloreadas completas) */}
        <section className="bg-white rounded-2xl shadow border border-violet-100 p-4">
          <h3 className="text-lg font-semibold mb-3 text-violet-800">
            Detalle de gastos comunes (matriz anual — {anio})
          </h3>
          <div className="overflow-x-auto">
            <table className="text-sm border border-gray-200 min-w-max">
              <thead className="bg-violet-100 text-violet-900">
                <tr>
                  <th className="border px-2 py-1 text-left">Parcela</th>
                  {MESES.map(m=><th key={m} className="border px-2 py-1 text-center">{m}</th>)}
                  <th className="border px-2 py-1 text-right bg-violet-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({length: PARCELAS_TOTAL},(_,idx)=>{
                  const parcela = idx+1;
                  const row     = matrizPagosAnual.matrix[idx];
                  const totalRow= matrizPagosAnual.totalFila[idx];

                  return(
                    <tr key={parcela} className="odd:bg-gray-50">
                      <td className="border px-2 py-1 font-medium">{parcela}</td>
                      {row.map((pagado, c) => {
                        const esAñoActual = anio === hoy.getFullYear();
                        const esPasado    = anio <  hoy.getFullYear();
                        const mesActual   = hoy.getMonth();

                        let vencido;
                        if (esPasado)           vencido = true;
                        else if (esAñoActual)   vencido = c <= mesActual;
                        else                     vencido = false; // año futuro

                        // Valor a mostrar
                        const valor = pagado >= CUOTA_MENSUAL
                          ? fmtCLP(pagado)
                          : pagado > 0
                            ? fmtCLP(pagado)
                            : (vencido ? "DB" : "—");

                        // Clase de fondo/colores para toda la celda
                        let bgClass = "bg-white text-gray-800 font-bold text-center";
                        if (valor === "DB") {
                          bgClass = "bg-red-500/80 text-white font-bold text-center";
                        } else if (valor === "—") {
                          bgClass = "bg-gray-100 text-gray-500 font-bold text-center";
                        } else if (pagado >= CUOTA_MENSUAL) {
                          bgClass = "bg-green-600 text-white font-bold text-center";
                        } else if (pagado > 0) {
                          bgClass = "bg-amber-500 text-white font-bold text-center";
                        }

                        return (
                          <td key={c} className={`border px-2 py-1 ${bgClass}`}>{valor}</td>
                        );
                      })}
                      <td className="border px-2 py-1 text-right font-bold bg-violet-50">{fmtCLP(totalRow)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="border px-2 py-1 text-left">Total Mes</td>
                  {matrizPagosAnual.totalCol.map((v,i)=><td key={i} className="border px-2 py-1 text-right">{fmtCLP(v)}</td>)}
                  <td className="border px-2 py-1 text-right bg-violet-100 font-bold">
                    {fmtCLP(matrizPagosAnual.totalCol.reduce((a,b)=>a+b,0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-600 flex flex-wrap gap-4">
            <span><span className="inline-block w-3 h-3 bg-green-600 rounded-sm align-middle mr-1" />Pagado ≥ {fmtCLP(CUOTA_MENSUAL)}</span>
            <span><span className="inline-block w-3 h-3 bg-amber-500 rounded-sm align-middle mr-1" />Parcial &lt; {fmtCLP(CUOTA_MENSUAL)}</span>
            <span><span className="inline-block w-3 h-3 bg-red-500/80 rounded-sm align-middle mr-1" />Debe (mes vencido sin pago)</span>
            <span><span className="inline-block w-3 h-3 bg-gray-300 rounded-sm align-middle mr-1" />— (mes futuro sin pago)</span>
          </div>
        </section>

        {/* Sección 3: Deuda acumulada al corte */}
        {/* Sección 3: Deuda histórica agrupada por año */}
        <section className="bg-white rounded-2xl shadow border border-violet-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-violet-800">Deuda histórica</h3>
            <small className="text-gray-600">
              Desde Feb 2024 hasta {MESES[hoy.getMonth()]} {hoy.getFullYear()}
            </small>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-violet-100 text-violet-900">
                <tr>
                  <th className="border px-3 py-2 text-left">Parcela</th>
                  {deudaHistorica.anios.map(y => (
                    <th key={y} className="border px-3 py-2 text-right">Deuda {y}</th>
                  ))}
                  <th className="border px-3 py-2 text-right bg-violet-200">Deuda total</th>
                </tr>
              </thead>
              <tbody>
                {deudaHistorica.filas.map(r => (
                  <tr key={r.parcela} className="odd:bg-gray-50">
                    <td className="border px-3 py-2 font-medium">{r.parcela}</td>
                    {deudaHistorica.anios.map(y => (
                      <td key={y} className="border px-3 py-2 text-right font-bold">
                        {r[y] > 0 ? fmtCLP(r[y]) : "-"}
                      </td>
                    ))}
                    <td className="border px-3 py-2 text-right font-bold bg-violet-50">{fmtCLP(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="border px-3 py-2 text-right">Totales</td>
                  {deudaHistorica.anios.map(y => (
                    <td key={y} className="border px-3 py-2 text-right">{fmtCLP(deudaHistorica.totalPorAnio[y])}</td>
                  ))}
                  <td className="border px-3 py-2 text-right bg-violet-100 font-bold">{fmtCLP(deudaHistorica.totalGlobal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
