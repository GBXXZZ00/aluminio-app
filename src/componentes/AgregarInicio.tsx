// Botón "Agregar a inicio": ancla la app a la pantalla de inicio del celular.
// - Android con Chrome: abre directamente la ventana del sistema.
// - iPhone o cualquier otro caso: muestra los pasos con dibujos sencillos.
// No aparece si la app ya se abrió desde el ícono.
import { useEffect, useState } from 'react';
import { anclarDirecto, escucharInstalacion, esIphone, iphoneSinSafari, puedeAvisoDirecto, yaAnclada } from '../instalar.ts';
import { Modal } from './comunes.tsx';

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span className="mono" style={{ flex: 'none', width: 28, height: 28, borderRadius: 14, border: '2px solid var(--acento)', color: 'var(--acento)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{n}</span>
      <span style={{ fontSize: 16, lineHeight: 1.45, paddingTop: 2 }}>{children}</span>
    </li>
  );
}

const IconoCompartir = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

const IconoAnclar = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3" /><path d="M12 8v6" /><path d="M9 11h6" />
  </svg>
);

export function AgregarInicio() {
  const [, refrescar] = useState(0);
  const [pasos, setPasos] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => escucharInstalacion(() => refrescar((x) => x + 1)), []);

  if (yaAnclada() || listo) return null;

  async function tocar() {
    if (puedeAvisoDirecto()) {
      if (await anclarDirecto()) setListo(true);
      return;
    }
    setPasos(true);
  }

  const iphone = esIphone();

  return (
    <>
      <button type="button" className="btn secundario" onClick={tocar} style={{ width: '100%' }}>
        <IconoAnclar /> Agregar a la pantalla de inicio
      </button>

      {pasos && (
        <Modal titulo="Anclar la app a tu inicio" onCerrar={() => setPasos(false)}>
          {iphoneSinSafari() ? (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Paso n={1}>En iPhone solo se puede desde <strong>Safari</strong>. Copia el enlace de esta página.</Paso>
              <Paso n={2}>Abre <strong>Safari</strong>, pega el enlace y vuelve a tocar este botón.</Paso>
            </ol>
          ) : iphone ? (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Paso n={1}>Toca el botón <strong>Compartir</strong> <IconoCompartir /> (abajo en el centro, o arriba a la derecha en iPad).</Paso>
              <Paso n={2}>Baja en la lista y toca <strong>"Agregar a pantalla de inicio"</strong>.</Paso>
              <Paso n={3}>Toca <strong>"Agregar"</strong> arriba a la derecha. Listo: aparece el ícono <strong>Cortes</strong>.</Paso>
            </ol>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Paso n={1}>Abre esta página en <strong>Chrome</strong> (no dentro de WhatsApp ni de otra app).</Paso>
              <Paso n={2}>Toca el menú <strong>⋮</strong> (tres puntos, arriba a la derecha).</Paso>
              <Paso n={3}>Toca <strong>"Agregar a pantalla principal"</strong> o <strong>"Instalar app"</strong>, y luego <strong>"Agregar"</strong>.</Paso>
            </ol>
          )}
          <button type="button" className="btn primario" onClick={() => setPasos(false)}>Entendido</button>
        </Modal>
      )}
    </>
  );
}
