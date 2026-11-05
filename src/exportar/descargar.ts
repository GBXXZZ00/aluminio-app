// Descarga de archivos desde el navegador (liviano, sin librerías).
//
// iPhone/iPad: Safari (y sobre todo la app abierta desde el ícono de inicio)
// ignora las descargas normales, así que ahí se abre el menú "Compartir" del
// teléfono con el archivo: "Guardar en Archivos", WhatsApp, Correo, etc.
// Android y computadoras: descarga normal.

function esIphone() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function descargaNormal(nombre: string, contenido: Blob) {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function compartir(archivo: File) {
  await navigator.share({ files: [archivo], title: archivo.name });
}

/**
 * Si el iPhone no deja abrir el menú Compartir (pasa cuando el archivo tardó en
 * prepararse, como un PDF), se muestra un aviso con un botón: al tocarlo se abre.
 */
function avisoArchivoListo(archivo: File) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  const caja = document.createElement('div');
  caja.className = 'modal';
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-label', 'Archivo listo');
  const titulo = document.createElement('h2');
  titulo.textContent = 'Tu archivo está listo';
  const texto = document.createElement('p');
  texto.className = 'ayuda';
  texto.textContent = `${archivo.name} — toca "Guardar o compartir" y elige "Guardar en Archivos" o la app donde lo quieres enviar.`;
  const si = document.createElement('button');
  si.type = 'button';
  si.className = 'btn primario';
  si.textContent = 'Guardar o compartir';
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn secundario';
  no.textContent = 'Cancelar';
  const cerrar = () => fondo.remove();
  si.onclick = () => { cerrar(); compartir(archivo).catch(() => {}); };
  no.onclick = cerrar;
  fondo.onclick = (e) => { if (e.target === fondo) cerrar(); };
  caja.append(titulo, texto, si, no);
  fondo.append(caja);
  document.body.append(fondo);
  si.focus();
}

export async function descargar(nombre: string, contenido: Blob) {
  if (esIphone() && typeof navigator.share === 'function') {
    const archivo = new File([contenido], nombre, { type: contenido.type || 'application/octet-stream' });
    if (!navigator.canShare || navigator.canShare({ files: [archivo] })) {
      try {
        await compartir(archivo);
        return;
      } catch (e) {
        const n = (e as Error).name;
        if (n === 'AbortError') return; // la persona cerró el menú: no hacer nada
        if (n === 'NotAllowedError') { avisoArchivoListo(archivo); return; }
        // Otro problema: se intenta la descarga normal.
      }
    }
  }
  descargaNormal(nombre, contenido);
}

export function descargarCsv(nombre: string, texto: string) {
  return descargar(nombre, new Blob([texto], { type: 'text/csv;charset=utf-8' }));
}
