import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";          // la vista nueva
import FinanzasForm from "./Formulario.jsx";      // tu componente actual (donde tienes ingresos/egresos)

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <header className="bg-white shadow">
        <nav className="max-w-6xl mx-auto px-4 py-3 flex gap-4">
          <NavLink
            to="/"
            end
            className={({isActive}) =>
              `px-3 py-2 rounded-xl ${isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`
            }
          >
            Dashboard
          </NavLink>
          {/* Movimientos ahora con <a> para forzar carga completa */}
          <a
            href="/movimientos"
            className="px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100"
          >
            Movimientos
          </a>
        </nav>
      </header>

      {/* Contenido por ruta */}
      <main className="py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/movimientos" element={<FinanzasForm />} />
          {/* 404 simple */}
          <Route path="*" element={
            <div className="max-w-6xl mx-auto p-6">
              <div className="bg-white p-6 rounded-2xl shadow">
                <h1 className="text-2xl font-semibold mb-2">Página no encontrada</h1>
                <p className="text-gray-600">Revisa la URL o vuelve al <NavLink className="text-blue-600 underline" to="/">Dashboard</NavLink>.</p>
              </div>
            </div>
          }/>
        </Routes>
      </main>
    </div>
  );
}
