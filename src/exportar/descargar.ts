// Descarga de archivos desde el navegador (liviano, sin librerías).
export function descargar(nombre: string, contenido: Blob) {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function descargarCsv(nombre: string, texto: string) {
  descargar(nombre, new Blob([texto], { type: 'text/csv;charset=utf-8' }));
}
