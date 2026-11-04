// Usuarios y permisos de la herrería (solo administrador).
import { useCallback, useEffect, useState } from 'react';
import { api, type Perfil } from '../datos/index.ts';
import { useSesion } from '../sesion.tsx';
import { Cargando, Encabezado, ErrorCaja, Interruptor, Modal } from '../componentes/comunes.tsx';
import { Candado, Lapiz } from '../componentes/iconos.tsx';

const permisosTexto = (p: Perfil) =>
  p.es_admin ? 'Administrador · Finanzas y cierre' : p.puede_cierre ? 'Finanzas y cierre' : p.puede_finanzas ? 'Finanzas' : 'Solo lotes';

export function Usuarios() {
  const { sesion, avisar } = useSesion();
  const [lista, setLista] = useState<Perfil[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<Perfil | null>(null);
  const [claveModal, setClaveModal] = useState(false);
  const [tieneClave, setTieneClave] = useState<boolean | null>(null);
  // Formulario nuevo usuario
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [fin, setFin] = useState(false);
  const [cie, setCie] = useState(false);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLista(await api.listarUsuarios());
      setTieneClave(await api.tieneClaveCierre());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!sesion) return null;

  async function crear() {
    setError(null);
    setCreando(true);
    try {
      await api.crearUsuario({ usuario, nombre, clave, puede_finanzas: fin || cie, puede_cierre: cie });
      avisar(`Usuario ${usuario.trim().toLowerCase()} creado`);
      setNombre(''); setUsuario(''); setClave(''); setFin(false); setCie(false);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <main className="pantalla">
      <Encabezado volver="/lotes" titulo="Usuarios" sub={<span className="acento">Herrería {sesion.herreria.nombre}</span>} />
      <ErrorCaja mensaje={error} />
      {!lista && !error && <Cargando />}
      {lista && (
        <div className="lista">
          {lista.map((p) => (
            <div key={p.id} className={`tarjeta${p.id === sesion.perfil.id ? ' acentuada' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', opacity: p.activo ? 1 : 0.6 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--tarjeta-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flex: 'none' }}>
                {p.nombre.slice(0, 2).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{p.nombre} <span className="sec mono" style={{ fontSize: 13, fontWeight: 400 }}>@{p.usuario}</span></span>
                <span className="sec" style={{ fontSize: 13 }}>{permisosTexto(p)} · {p.activo ? 'activo' : 'inactivo'}</span>
              </span>
              {!p.es_admin && (
                <button type="button" className="icono-btn" aria-label={`Editar a ${p.nombre}`} onClick={() => setEditar(p)}><Lapiz /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="tarjeta pad pila">
        <span style={{ fontSize: 18, fontWeight: 600 }}>Nuevo usuario</span>
        <div className="campo">
          <label htmlFor="n-nombre">Nombre</label>
          <input id="n-nombre" className="entrada" maxLength={60} placeholder="Nombre de la persona" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="n-usuario">Usuario (para entrar)</label>
          <input id="n-usuario" className="entrada" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30}
            placeholder="ej. pedro" value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))} />
          <span className="ayuda">Solo letras sin acento, números, punto o guion. Mínimo 3.</span>
        </div>
        <div className="campo">
          <label htmlFor="n-clave">Clave inicial (la cambia al entrar)</label>
          <input id="n-clave" className="entrada" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        <span className="lbl sec" style={{ fontSize: 14, fontWeight: 600 }}>Permisos</span>
        <Interruptor etiqueta="Ver Finanzas" ayuda="Ve ventas, gastos y ganancias; puede borrar lotes" activo={fin || cie} onCambio={(v) => { setFin(v); if (!v) setCie(false); }} />
        <Interruptor etiqueta="Hacer cierre general" ayuda="Además necesita la clave de cierre" activo={cie} onCambio={(v) => { setCie(v); if (v) setFin(true); }} />
        <span className="ayuda">Todos pueden escribir el precio de venta al agregar ventanas.</span>
        <button type="button" className="btn primario" disabled={creando || !nombre.trim() || usuario.length < 3 || clave.length < 6} onClick={crear}>
          {creando ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>

      <div className="tarjeta pad pila">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--acento-fondo)', color: 'var(--acento)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Candado /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>Clave de cierre</span>
            <span className="sec" style={{ fontSize: 13 }}>{tieneClave ? 'Creada. Se pide al hacer el cierre general.' : 'Aún no creada: nadie puede hacer el cierre.'}</span>
          </span>
        </div>
        <button type="button" className="btn secundario" onClick={() => setClaveModal(true)}>{tieneClave ? 'Cambiar clave de cierre' : 'Crear clave de cierre'}</button>
      </div>
      <p className="ayuda">Para quitar el acceso a alguien, edítalo y desactívalo. Sus lotes se conservan.</p>

      {editar && <EditarUsuario p={editar} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); cargar(); }} />}
      {claveModal && <ClaveCierre onCerrar={() => setClaveModal(false)} onGuardado={() => { setClaveModal(false); setTieneClave(true); avisar('Clave de cierre guardada'); }} />}
    </main>
  );
}

function EditarUsuario({ p, onCerrar, onGuardado }: { p: Perfil; onCerrar: () => void; onGuardado: () => void }) {
  const { avisar } = useSesion();
  const [nombre, setNombre] = useState(p.nombre);
  const [fin, setFin] = useState(p.puede_finanzas || p.puede_cierre);
  const [cie, setCie] = useState(p.puede_cierre);
  const [activo, setActivo] = useState(p.activo);
  const [nuevaClave, setNuevaClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await api.actualizarUsuario(p.id, { nombre, puede_finanzas: fin || cie, puede_cierre: cie, activo });
      if (nuevaClave) await api.cambiarClaveUsuario(p.id, nuevaClave);
      avisar('Cambios guardados');
      onGuardado();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={`Editar a ${p.nombre}`} onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="e-nombre">Nombre</label>
        <input id="e-nombre" className="entrada" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <Interruptor etiqueta="Ver Finanzas" activo={fin || cie} onCambio={(v) => { setFin(v); if (!v) setCie(false); }} />
      <Interruptor etiqueta="Hacer cierre general" activo={cie} onCambio={(v) => { setCie(v); if (v) setFin(true); }} />
      <Interruptor etiqueta="Activo" ayuda="Si lo desactivas, no puede entrar ni ver nada" activo={activo} onCambio={setActivo} />
      <div className="campo">
        <label htmlFor="e-clave">Nueva clave (opcional)</label>
        <input id="e-clave" className="entrada" autoComplete="off" placeholder="Déjalo vacío para no cambiarla" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} />
        <span className="ayuda">Si la cambias, le pedirá crear una propia al entrar.</span>
      </div>
      <ErrorCaja mensaje={error} />
      <button type="button" className="btn primario" disabled={guardando || !nombre.trim() || (nuevaClave.length > 0 && nuevaClave.length < 6)} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
      <button type="button" className="btn secundario" onClick={onCerrar}>Cancelar</button>
    </Modal>
  );
}

function ClaveCierre({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    setError(null);
    if (a.length < 6) return setError('La clave de cierre debe tener al menos 6 caracteres.');
    if (a !== b) return setError('Las dos claves no coinciden.');
    try {
      await api.establecerClaveCierre(a);
      onGuardado();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal titulo="Clave de cierre" onCerrar={onCerrar}>
      <p className="ayuda">Se pide para confirmar el cierre general. Es distinta a la clave para entrar.</p>
      <div className="campo">
        <label htmlFor="cc-a">Clave nueva (mínimo 6)</label>
        <input id="cc-a" className="entrada" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="cc-b">Repite la clave</label>
        <input id="cc-b" className="entrada" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <ErrorCaja mensaje={error} />
      <button type="button" className="btn primario" onClick={guardar}>Guardar</button>
      <button type="button" className="btn secundario" onClick={onCerrar}>Cancelar</button>
    </Modal>
  );
}
