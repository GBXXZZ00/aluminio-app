# Cortes / Aluminio — reglas del proyecto

App web **mobile-first** para un taller de herrería. Calcula los cortes de perfiles de aluminio y vidrios de ventanas, la lista de compra (barras de 6 m y accesorios), y lleva las finanzas por lotes. Base de datos: **Supabase** (proyecto `qfnoaldpopikhghizvyb`, "Aluminio app").

El dueño (usuario administrador **raymundo**) no es programador: toda la interfaz y los mensajes van en **español**, con palabras sencillas.

---

## 1. Herrerías y acceso

- Dos herrerías **totalmente separadas**: `famoso` (id 1) y `artesanos` (id 2). Nunca se mezclan datos, **ni siquiera para el administrador**. Para ver la otra herrería se cierra sesión y se entra por ella.
- Pantalla inicial: elegir herrería → usuario + clave. **Sin correos.** Supabase Auth exige correo, así que se usa uno interno oculto: `<usuario>@<slug>.aluminio.local` (minúsculas). El mismo nombre de usuario puede existir en las dos herrerías.
- El administrador tiene **una cuenta por herrería** (usuario `raymundo` en cada una).
- Usuarios los crea el administrador (función segura del servidor, nunca desde el navegador con la llave de servicio). Primer ingreso con clave inicial → obliga a cambiarla (`perfiles.debe_cambiar_clave`).
- Usuario inactivo no entra ni ve nada.
- Error de login siempre genérico: "Usuario o clave incorrectos".
- Permisos por usuario: `puede_finanzas` (ver módulo Finanzas y gastos) y `puede_cierre` (hacer el cierre general). El admin siempre tiene ambos. **Todos** pueden escribir el precio de venta de las ventanas.

## 2. Lotes

- Número **consecutivo por herrería**, empieza en 001, se asigna en el servidor, **nunca se reutiliza** (ni al borrar, ni después de un cierre: sigue 005, 006…).
- Fecha automática. Campo opcional "Cliente u obra".
- Cada entrada de ventana: **cantidad** de ventanas iguales, **sistema** (ecobel / panoramico), **color** (negro / blanco), **alto** y **ancho** en cm, **protección** sí/no, **precio unitario** y **precio total**.
- Opciones del lote: abrir, duplicar, eliminar. **Eliminar solo con permiso de Finanzas** (borra también sus gastos); a los demás no se les muestra la opción. Un lote cerrado (con `cierre_id`) es de solo lectura.

## 3. Fórmulas (todas las ventanas son de 2 paños)

**Redondeo:** las medidas de corte se redondean a 1 decimal y **.x5 siempre sube** (42.95 → 43.0), como se corta en el taller.

**Tamaño mínimo:** no hay mínimo de fábrica; solo se rechaza lo imposible (medidas ≤ 20 cm o algún corte/vidrio ≤ 0).

**Protección:** si la ventana lleva protección, se restan **6 cm al alto y 6 cm al ancho** antes de todo cálculo de cortes. (El **precio** usa la medida original.)

Sea `A` = alto de trabajo y `W` = ancho de trabajo (ya con la resta de protección si aplica). Cantidades **por ventana**; multiplicar por la cantidad de ventanas iguales.

### Ecobel
| Pieza | Cant. | Medida (cm) |
|---|---|---|
| Marco | 2 | A |
| Marco | 2 | W |
| Liso | 2 | A − 4.3 |
| Enganche | 2 | A − 4.3 |
| Horizontal | 4 | (W − 8.2) / 2 |
| Vidrio | 2 paños | alto = A − 11.5 · ancho = Horizontal − 0.5 |

**Marco es UN solo tipo de tubo**: las piezas de alto y de ancho se suman juntas como "Marco".

Accesorios por ventana: 4 ruedas Ecobel, 1 trancador, 12 tornillos 8 × 1½", 8 remaches 5/32", 4 topes, **goma de vidrio 4 mm: 500 g fijos** (sin importar la medida).

### Panorámico
| Pieza | Cant. | Medida (cm) |
|---|---|---|
| Lateral | 2 | A |
| Cabezal | 1 | W − 2.4 |
| Sabote | 1 | = Cabezal |
| Riel | 2 | (Sabote + 5) / 2 |
| Vidrio | 2 paños | alto = Lateral − 6.5 · ancho = Riel |

Accesorios por ventana: 4 ruedas, 1 trancador tipo chupón, 4 tornillos 8 × 1½", **felpa = Cabezal (en m) × 4**, **goma: 250 g** (1 kg rinde 4 ventanas).

### Caso de prueba obligatorio
3 Ecobel blancas 100 × 100 con protección (trabajo 94 × 94):
Marco 12 × 94.0 → 2 barras · Liso 6 × 89.7 → 1 · Enganche 6 × 89.7 → 1 · Horizontal 12 × 42.9 → 1 · Vidrio 6 paños 82.5 × 42.4 · Ruedas 12 · Trancador 3 · Topes 12 · Tornillos 36 → 100 · Remaches 24 → 100 · Goma 1.5 kg → 2 kg · Venta sugerida $100 c/u → $300.

## 4. Compra de tubos (barras de 6 m)

- Agrupar piezas por **sistema + perfil + color** (ej. Ecobel · Marco · Negro).
- **No** dividir total de metros entre 6: acomodar las piezas **barra por barra** (first-fit decreasing en barras de 600 cm), descontando el **grosor del disco** por cada corte (por defecto **0.3 cm**, editable por lote). Una pieza nunca se reparte entre dos barras.
- **Decisión del dueño:** se acepta que este método use a veces (≈2 % de los casos) **1 barra más** que el acomodo perfecto; no buscar el acomodo óptimo.
- Mostrar el acomodo de cada barra y su sobrante.
- **Nunca** mostrar "6 m" / "(6 metros)" en ninguna pantalla, PDF ni mensaje. Solo "Marco: 2".

## 5. Redondeo de accesorios
- Tornillos y remaches: se venden por **100** → redondear **hacia arriba** al múltiplo de 100 (28 → 100, 130 → 200). En la app mostrar también cuántos se usan.
- Goma: por **kg** → sumar todo el lote y redondear **hacia arriba** al kg entero.
- Felpa: **metros exactos**, 2 decimales, sin redondear.
- Tornillos, remaches y goma se suman para **todo el lote** (sección "General") y se redondean una sola vez.

## 6. Mensaje de WhatsApp (formato exacto)
Sin nombre de herrería ni cliente. Un bloque por cada combinación sistema+color presente. Sin etiqueta "_Tubos_". Sin metros.
```
*Lote 004*
03/11/2026

▪️ *ECOBEL · NEGRO*
Marco: 2
Liso: 1
Enganche: 1
Horizontal: 1
_Accesorios_
Ruedas Ecobel: 8
Trancador: 2
Topes: 8

▫️ *PANORÁMICO · BLANCO*
Lateral: 1
Cabezal: 1
Sabote: 1
Riel: 1
_Accesorios_
Ruedas: 4
Trancador tipo chupón: 1
Felpa: 6.86 m

🔩 *GENERAL*
Tornillos 8 × 1½": 100
Remaches 5/32": 100
Goma vidrio 4 mm: 2 kg
```
(▪️ para negro, ▫️ para blanco.) Botones: Enviar por WhatsApp, Copiar texto, Descargar PDF.

## 7. CSV para CutList Optimizer
Solo **vidrios**, un archivo: `Length,Width,Qty,Label` → alto, ancho, cantidad y **etiqueta vacía** (decisión del dueño: en CutList no debe salir el nombre de la ventana).

## 8. Finanzas
- **Precio:** área = alto × ancho **originales** / 10 000. Precio por m² sugerido: Ecobel **$100**, Panorámico **$90** — **oculto** (no se muestra). Se ven y editan **precio unitario** y **precio total**: cambiar uno recalcula el otro (total = unitario × cantidad). Al cambiar la cantidad se mantiene el unitario.
- **Gastos del lote** (tabla `gastos_lote`): un monto de **perfilería de aluminio** (incluye accesorios) y uno de **vidrio**.
- **Mano de obra**: gasto general del período (no por lote).
- **Sin abonos**: vendido = cobrado.
- Ganancia = vendido − perfilería − vidrio − mano de obra. Cálculo oficial: `resumen_periodo()` en el servidor.
- **Cierre general**: muestra resumen, pide la **clave de cierre** (una por herrería, la crea/cambia solo el admin, guardada con bcrypt), archiva lotes y mano de obra abiertos (`cerrar_periodo`). No se deshace. Historial de cierres consultable.

## 9. Diseño
- Mobile-first, botones ≥ 52–60 px, campos con letra ≥ 16 px.
- Tema oscuro (por defecto) y claro; se guarda por usuario (`perfiles.tema`).
- Oscuro: fondo `#0a0a0a`, tarjetas `#171717` radio 16 px, texto `#fafafa` / `#a1a1a1`, bordes `#262626`, campos hundidos `#111214` radio 8 px, botón principal `#e5e5e5` con texto oscuro, botones radio 8 px.
- Efecto 3D "tecla de teclado": `inset 0 1px 0 rgba(255,255,255,.06), 0 0 0 1px rgba(255,255,255,.10), inset 0 -2px 0 rgba(0,0,0,.45)`; campos: `inset 0 2px 4px rgba(0,0,0,.6)`.
- Acento por herrería: **Famoso naranja `#ff8833`** (claro: `#c4560c`), **Artesanos gris `#a1a1a1`**.
- Fuentes: **Inter** (texto) y **Geist Mono** (medidas, números, lotes).
- Botón de WhatsApp verde `#2FA866`.
- Diseño de referencia: lienzo "Cortes / Aluminio" (12 pantallas).

## 10. Calidad
- Lógica de cálculo en módulos puros con **pruebas automáticas** (incluye el caso de prueba de la sección 3). Las pruebas corren en GitHub en cada cambio; si fallan, no se publica.
- Cambios de base de datos solo como archivos en `supabase/migrations/`.
- Agentes de revisión: verificador de cálculos, probador de pantallas (tamaño celular, ambos temas), revisor de seguridad (intenta romper RLS), revisor de código antes de publicar.

## 11. Etapas
1. Base de datos (tablas, RLS, funciones) — hecho.
2. App: pantallas, cálculos, exportaciones, instalable en el celular.
3. Usuarios (función segura del servidor) y clave de cierre.
4. Publicar en Vercel.
