// Piezas de interfaz que se repiten en varias pantallas.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Atras } from './iconos.tsx';
import { leerNumero } from '../calculos/index.ts';

export function Encabezado({ titulo, sub, volver, derecha }: { titulo: ReactNode; sub?: ReactNode; volver?: string | -1; derecha?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="encabezado">
      {volver !== undefined &&
        (volver === -1 ? (
          <button type="button" className="icono-btn" aria-label="Volver" onClick={() => nav(-1)}><Atras /></button>
        ) : (
          <Link to={volver} className="icono-btn" aria-label="Volver"><Atras /></Link>
        ))}
      <div className="titulo">
        <h1>{titulo}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {derecha}
    </header>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <div className="cargando" role="status">{texto}</div>;
}

export function ErrorCaja({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return <div className="aviso error" role="alert">{mensaje}</div>;
}

export function Interruptor({ activo, onCambio, etiqueta, ayuda }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; ayuda?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{etiqueta}</div>
        {ayuda && <div className="ayuda" style={{ fontSize: 12 }}>{ayuda}</div>}
      </div>
      <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} className="interruptor" onClick={() => onCambio(!activo)}>
        <span />
      </button>
    </div>
  );
}

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Campo de número que acepta coma o punto y no se vuelve loco al escribir. */
export function CampoNumero({ id, valor, onCambio, grande, decimales = 2, dinero = false, maximo = 9_999_999, ...resto }: {
  id: string; valor: number; onCambio: (n: number) => void; grande?: boolean; decimales?: number;
  /** Campos de dinero: entienden separadores de miles ("1,500" = 1500). */
  dinero?: boolean; maximo?: number;
  disabled?: boolean; 'aria-label'?: string; style?: React.CSSProperties; onBlur?: () => void;
}) {
  const [texto, setTexto] = useState(fmtEntrada(valor, decimales));
  const [enfocado, setEnfocado] = useState(false);
  useEffect(() => {
    if (!enfocado) setTexto(fmtEntrada(valor, decimales));
  }, [valor, enfocado, decimales]);
  return (
    <input
      id={id}
      className={`entrada numero${grande ? ' grande' : ''}`}
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onFocus={(e) => { setEnfocado(true); e.target.select(); }}
      onBlur={() => { setEnfocado(false); resto.onBlur?.(); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, '');
        setTexto(t);
        if (t === '') return onCambio(0);
        const n = leerNumero(t, dinero);
        if (n === null) return;
        const factor = 10 ** decimales;
        onCambio(Math.min(maximo, Math.round(n * factor) / factor));
      }}
      disabled={resto.disabled}
      aria-label={resto['aria-label']}
      style={resto.style}
    />
  );
}

function fmtEntrada(n: number, dec: number): string {
  if (!Number.isFinite(n) || n === 0) return n === 0 ? '0' : '';
  return String(Math.round(n * 10 ** dec) / 10 ** dec);
}

export function Pie({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>{children}</div>;
}
