// Pantallas de acceso: elegir herrería, iniciar sesión y cambiar la clave inicial.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSesion, aplicarApariencia } from '../sesion.tsx';
import { api, MODO_DEMO, type Slug } from '../datos/index.ts';
import { Atras, Flecha, Ojo, Ventana } from '../componentes/iconos.tsx';
import { ErrorCaja } from '../componentes/comunes.tsx';

const HERRERIAS: { slug: Slug; nombre: string; letra: string }[] = [
  { slug: 'famoso', nombre: 'Famoso', letra: 'F' },
  { slug: 'artesanos', nombre: 'Artesanos', letra: 'A' },
];

function Logo({ slug, tam = 64 }: { slug: Slug; tam?: number }) {
  const famoso = slug === 'famoso';
  return (
    <div
      aria-hidden="true"
      style={{
        width: tam, height: tam, borderRadius: 12, flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: tam * 0.44, fontWeight: 600,
        border: `2px solid ${famoso ? '#ff8833' : '#a1a1a1'}`,
        background: famoso ? '#2a1a0f' : '#1f1f1f',
        color: famoso ? '#ff8833' : '#a1a1a1',
      }}
    >
      {famoso ? 'F' : 'A'}
    </div>
  );
}

export function Inicio() {
  const { sesion } = useSesion();
  useEffect(() => aplicarApariencia(document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro', null), []);
  if (sesion) return <Navigate to="/lotes" replace />;
  return (
    <main className="pantalla" style={{ minHeight: '100dvh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 64, textAlign: 'center' }}>
        <span style={{ color: '#ff8833' }}><Ventana /></span>
        <div className="mono" style={{ fontSize: 15, letterSpacing: '.1em', color: '#ff8833', textTransform: 'uppercase' }}>Cortes / Aluminio</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Elige tu herrería</h1>
      </div>
      <div className="lista">
        {HERRERIAS.map((h) => (
          <Link key={h.slug} to={`/entrar/${h.slug}`} className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, textDecoration: 'none', color: 'var(--texto)' }}>
            <Logo slug={h.slug} />
            <div style={{ flex: 1 }}>
              <div className="sec" style={{ fontSize: 14 }}>Herrería</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{h.nombre}</div>
            </div>
            <span className="sec"><Flecha /></span>
          </Link>
        ))}
      </div>
      <p className="ayuda" style={{ textAlign: 'center', marginTop: 'auto' }}>
        Cada herrería tiene sus propios lotes y usuarios.
        {MODO_DEMO && <><br /><strong>Modo demostración:</strong> usuario raymundo o pedro, clave demo123.</>}
      </p>
    </main>
  );
}

export function Login() {
  const { slug } = useParams();
  const { sesion, entrar } = useSesion();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const h = HERRERIAS.find((x) => x.slug === slug);

  useEffect(() => {
    if (h) aplicarApariencia(document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro', h.slug);
  }, [h]);

  if (!h) return <Navigate to="/" replace />;
  if (sesion) return <Navigate to="/lotes" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await entrar(h!.slug, usuario, clave);
      nav('/lotes', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pantalla" style={{ minHeight: '100dvh' }}>
      <div className="encabezado">
        <Link to="/" className="icono-btn" aria-label="Cambiar de herrería"><Atras /></Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 16, textAlign: 'center' }}>
        <Logo slug={h.slug} tam={72} />
        <div className="sec">Herrería {h.nombre}</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Iniciar sesión</h1>
      </div>
      <form className="pila" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="usuario">Usuario</label>
          <input id="usuario" className="entrada" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="Tu usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="clave">Clave</label>
          <div style={{ position: 'relative', display: 'flex' }}>
            <input id="clave" className="entrada" type={ver ? 'text' : 'password'} autoComplete="current-password"
              value={clave} onChange={(e) => setClave(e.target.value)} style={{ paddingRight: 56 }} />
            <button type="button" className="icono-btn plano" aria-label={ver ? 'Ocultar clave' : 'Mostrar clave'}
              aria-pressed={ver} onClick={() => setVer(!ver)} style={{ position: 'absolute', right: 4, top: 4 }}>
              <Ojo />
            </button>
          </div>
        </div>
        <ErrorCaja mensaje={error} />
        <button type="submit" className="btn primario" disabled={enviando || !usuario || !clave}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="ayuda" style={{ textAlign: 'center', marginTop: 'auto' }}>¿Olvidaste tu clave? Pídela al administrador.</p>
    </main>
  );
}

export function CambiarClave() {
  const { sesion, refrescar, salir } = useSesion();
  const nav = useNavigate();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!sesion) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (a.length < 6) return setError('La clave debe tener al menos 6 caracteres.');
    if (a !== b) return setError('Las dos claves no coinciden.');
    setEnviando(true);
    try {
      await api.cambiarMiClave(a);
      await refrescar();
      nav('/lotes', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pantalla" style={{ minHeight: '100dvh' }}>
      <div style={{ paddingTop: 32 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Crea tu clave</h1>
        <p className="ayuda" style={{ fontSize: 15 }}>
          Hola, {sesion.perfil.nombre}. Entraste con una clave temporal. Escribe una clave nueva que solo tú conozcas.
        </p>
      </div>
      <form className="pila" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="nueva">Clave nueva (mínimo 6 caracteres)</label>
          <input id="nueva" className="entrada" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="repetir">Repite la clave</label>
          <input id="repetir" className="entrada" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        <ErrorCaja mensaje={error} />
        <button type="submit" className="btn primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar clave'}</button>
        <button type="button" className="btn secundario" onClick={() => salir().then(() => nav('/', { replace: true }))}>Salir</button>
      </form>
    </main>
  );
}
