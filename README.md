# GtaKlips

Selección editorial de clips de GTA VI en español. Edición manual, borradores privados, publicación, archivo por fecha, filtros, retirada de clips y borrador para X. La etapa 2 añade importación privada de candidatos de Twitch; su publicación siempre requiere revisión editorial y una acción manual.

## Desarrollo local

Requiere Node.js 22.12 o posterior y npm.

```sh
npm ci
npm run db:local
npm run dev
```

Abre `http://127.0.0.1:8787/admin`. El servidor local usa una entrada independiente, `src/local.ts`, y una autorización de desarrollo explícita limitada a HTTP loopback con el origen configurado. No expongas ese servidor mediante túneles ni publiques la configuración local. La entrada de producción es `src/index.ts`: ignora la configuración de autorización local y siempre exige Access.

Los datos se conservan en D1 local entre reinicios. No se incluyen clips precargados. Los identificadores `Demo…` de las pruebas son ficticios y **no son clips verificados**.

## Preparación de producción

Antes de desplegar, sustituye los placeholders de `wrangler.jsonc`:

- `database_id`: identificador de tu base D1.
- `PUBLIC_ORIGIN`: origen HTTPS público exacto, sin ruta, parámetros ni barra final, por ejemplo `https://clips.example.com`.
- `ACCESS_ISSUER`: `https://<equipo>.cloudflareaccess.com`.
- `ACCESS_AUDIENCE`: AUD de la aplicación Access.

Configura Cloudflare Access para proteger tanto `/admin` como `/admin/*` en el dominio público, con una política de acceso para los editores autorizados. El Worker comprueba además la firma RS256, issuer, audience, expiración y claims requeridos del encabezado `Cf-Access-Jwt-Assertion`. Sin configuración válida el panel permanece cerrado. Las claves se obtienen del endpoint oficial del equipo, con caché y rotación gestionadas por JOSE.

Aplica `migrations/` a la base D1 de destino antes de servir tráfico. Usa siempre la configuración de producción; `npm run build` solo genera un paquete de comprobación y **no despliega**. Este repositorio no configura un despliegue automático.

## Operación editorial

1. Crea una edición con fecha de Madrid, título, entradilla y gancho para X.
2. Añade entre 1 y 10 enlaces directos HTTPS de Twitch, YouTube o X, crédito del streamer, título, categoría y contexto propio.
3. Ordena con **Subir/Bajar** y marca exactamente un destacado.
4. **Guardar borrador** conserva cambios privados. Reabre desde **Ediciones guardadas**.
5. Para una edición real, desmarca demostración y confirma que revisaste disponibilidad, autoría, contexto, spoilers y duplicados. El producto valida el formato del enlace, no comprueba remotamente el vídeo ni sus derechos.
6. **Publicar edición** hace visible la instantánea completa, con orden y destacado. **Copiar post** usa esa versión publicada y añade UTM y ancla del destacado. Revisa el texto y publícalo manualmente en X; no hay envío automático. Si el texto excede el límite de tu cuenta, acórtalo al publicarlo.
7. Abre el enlace público y comprueba las fuentes. Puedes abrir la fuente original o usar la vista previa oficial cuando esté disponible.
8. Para retirar un clip, abre su edición y utiliza su URL original o ID de ficha. Se conserva el resto; el primer clip restante sustituye al destacado retirado. Si retiras todos, la página permanece con un estado vacío y no se genera un post. La retirada elimina también el clip del borrador en la misma escritura, evitando republicarlo por accidente.

La publicación usa una instantánea JSON acotada en una fila D1. Borrador y publicación son columnas independientes. Las escrituras condicionadas por revisión evitan sobrescribir cambios de otra sesión; ante conflicto, recarga y revisa antes de repetir. La selección se actualiza en una operación atómica, nunca clip a clip. No se sirven datos de borrador en rutas públicas ni sitemap; las respuestas no se almacenan en caché.

## Verificación

```sh
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Las pruebas de integración ejecutan el Worker y las migraciones con D1 real local en Miniflare; los JWT se firman con claves efímeras y solo el endpoint JWKS se simula. Playwright ejecuta la entrada de producción con JWT efímeros y D1 local, comprueba que una sesión anónima no accede al panel y recorre el editor con viewport móvil, guarda cinco fixtures, verifica privacidad, ordena, publica, copia el post, abre la URL sin sesión de editor y retira el destacado. Los reportes locales se generan en `playwright-report/` y `test-results/`, excluidos de Git. Las pruebas E2E escriben únicamente en D1 local; no hay cambios remotos.

Pendiente antes de una publicación real: configurar dominio/D1/Access, comprobar el acceso desde Cloudflare, revisión humana de fuentes y derechos, y verificación visual en dispositivo. No hay analítica, formularios de contacto ni cookies propias. Twitch aplica sus políticas cuando se abre una fuente externa.

Referencias: [D1](https://developers.cloudflare.com/d1/), [validación de JWT de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [plan del producto](plan-gtaklips.md).

## Etapa 2 · Candidatos de Twitch

Desde **Importaciones y candidatos** puedes importar o reintentar, consultar las diez últimas ejecuciones, revisar candidatos y marcarlos pendientes, seleccionados o rechazados. **Usar en editor** abre una edición nueva con fuente, autor y título; requiere escribir contexto propio y publicar manualmente. Importar o seleccionar no modifica las ediciones públicas. La revisión se conserva al actualizar las vistas de un candidato ya conocido.

La integración está preparada, pero **todavía no se ha verificado con Twitch real**: las pruebas usan respuestas controladas e identificadores ficticios. Antes de activarla, registra una aplicación de Twitch y configura `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` en el entorno. En desarrollo puedes usar el archivo ignorado `.dev.vars`; en Cloudflare utiliza secretos del Worker. No guardes valores reales en el repositorio, capturas, logs o conversaciones.

`TWITCH_GAME_ID` es opcional. Sin él se consulta el nombre exacto `Grand Theft Auto VI`; con él se verifica que el ID devuelto corresponde exactamente a ese nombre. Si Twitch no devuelve la categoría esperada, se detiene la importación. El panel muestra la categoría confirmada para cada ejecución; no hay un ID real preconfigurado o verificado en este repositorio.

La ventana de consulta abarca las últimas 24 horas UTC. Se solicitan hasta cinco páginas de cien clips, con un máximo de siete solicitudes de proveedor, cinco segundos por solicitud y un MiB por respuesta. Alcanzar el límite o recibir un cursor repetido se registra como resultado parcial. Los contadores de guardado incluyen únicamente páginas confirmadas en D1; un fallo no borra lo importado previamente ni cambia la última edición pública. Los errores se resumen mediante códigos seguros, sin guardar cuerpos de respuesta, tokens o secretos.

La configuración de producción incluye Cron a las **06:00 y 18:00 UTC**, dos veces al día. Ambos eventos llaman al mismo importador que el botón manual. Esta configuración no activa ningún servicio remoto hasta desplegar el Worker y configurar la cuenta. Un bloqueo D1 con caducidad de 60 segundos evita importaciones solapadas; un reintento recupera ejecuciones interrumpidas y rechaza las escrituras de un proceso antiguo.

### Migración y compatibilidad

Aplica también `0002_twitch.sql` antes de ejecutar la etapa 2. Es una migración aditiva: incorpora candidatos, historial y bloqueo, sin modificar la tabla de ediciones. Las pruebas parten de una base con una edición de etapa 1 y comprueban que se conserva. Si hay que volver al código anterior, las tablas añadidas pueden permanecer; conserva una copia de seguridad y evita eliminarlas para no perder historial ni candidatos. Desactiva los nuevos Cron si vuelves a una versión que no incorpora el importador.

### Cobertura adicional

Las pruebas verifican deduplicación y actualización, conservación de la revisión, OAuth y categoría, paginación y resultados parciales, respuestas vacías o malformadas, límites, conexión y tiempo de espera, migración, bloqueo y recuperación, errores de escritura y privacidad. El navegador móvil prueba fallo, reintento, revisión privada y publicación editorial explícita. Las fuentes ficticias no acreditan disponibilidad, permisos ni contenido real. La conexión real con Twitch y la configuración de Cloudflare quedan pendientes hasta disponer de una aplicación y de un destino de despliegue.

Referencias de integración: [Get Clips](https://dev.twitch.tv/docs/api/reference/clips), [Get Games](https://dev.twitch.tv/docs/api/reference/games), [OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), [Cron](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/).

## Catálogo visual y demo local

La portada presenta un destacado con reproducción en Twitch, tarjetas con miniaturas, navegación horizontal, filtros por categoría y búsqueda por título, creador o contexto. Las imágenes son opcionales: si faltan o fallan, se conservan la ficha, el crédito y el enlace. Solo se admiten miniaturas HTTPS de los CDN de Twitch, YouTube y X especificados por el validador.

Aplica también `0003_candidate_thumbnails.sql` con `npm run db:local`. Conserva las tablas y ediciones previas; añade una columna opcional para las miniaturas de los candidatos.

Para preparar cinco clips reales **solo en D1 local**:

```sh
npm run db:local
npm run seed:demo
npm run dev
```

`seed:demo` guarda antes un respaldo ignorado en `.wrangler/demo-backups/`. Crea una edición de demostración para la fecha de Madrid y retira de publicación únicamente los fixtures automatizados reconocidos, conservándolos como borradores. Repetir el comando no duplica la edición. Si encuentra una edición propia o cualquier cambio manual en la demo de hoy —incluida la retirada de un clip—, se detiene para no sobrescribirlo; tampoco permite seleccionar un destino remoto. Las pruebas de navegador usan un puerto separado del servidor de desarrollo.

Las fuentes de `demo/twitch-clips.json` se contrastaron con las fichas públicas y miniaturas de Twitch. Eso acredita la disponibilidad de esos metadatos en la fecha indicada; no garantiza disponibilidad futura, revisión editorial, permisos comerciales ni que Twitch contabilice una visualización. Las tarjetas conservan el enlace al original y permiten vistas previas mediante el reproductor oficial, sin alojar copias de vídeo.

### Vistas previas de Twitch

El destacado intenta reproducirse sin sonido en escritorio cuando el reproductor está completamente visible. Las tarjetas muestran una vista previa flotante tras mantener el ratón encima durante medio segundo. La portada se amplía suavemente en una capa anclada, sin cambiar la geometría ni el scroll del catálogo; Twitch se monta cuando termina la entrada. Solo se mantiene un iframe activo: alejarse de la tarjeta y su panel, ocultar la pestaña, dejar el reproductor fuera de pantalla o pulsar Escape lo retira. También hay botones para iniciar y cerrar con teclado o toque; el cierre devuelve el foco al control original. El puntero puede pasar de la tarjeta al panel y al vídeo sin interrumpirlo. Desplazar o redimensionar la página cierra el panel para no dejarlo separado de su origen.

Se respeta movimiento reducido y ahorro de datos: ambos desactivan los inicios automáticos. Twitch exige un reproductor visible de al menos 400×300 px; las pantallas que no permiten ese espacio conservan la imagen y el enlace original. En móvil se requiere interacción. No se ocultan los controles ni se superponen textos al reproductor.

El iframe usa únicamente `https://clips.twitch.tv/embed`, con el clip validado, `muted=true`, `autoplay=true` y `parent` tomado del hostname actual. El dominio publicado debe servir la página mediante HTTPS con el hostname correspondiente; las pruebas locales con reproductor simulado comprueban la interfaz y no acreditan vídeo reproducido ni vistas contabilizadas. Si Twitch o el navegador bloquean el inicio, permanece el enlace al original. Los clips no ofrecen una API interactiva que permita detectar con certeza la reproducción o recortar una preview a un número exacto de segundos. [Documentación oficial](https://dev.twitch.tv/docs/embed/video-and-clips/).

Comprobación de proveedor en desarrollo: el iframe real cargó en loopback HTTP y el vídeo avanzó tras la confirmación de contenido para audiencias adultas de Twitch; otra tarjeta inició su vídeo silenciado al pasar el ratón en esa sesión. Esa excepción local no sustituye los requisitos documentados de HTTPS para el dominio publicado ni garantiza autoplay en otras sesiones. Twitch puede pedir confirmación por clip o sesión y controlar el audio tras un clic del usuario. Los tests de CI simulan el contenido del iframe para comprobar su ciclo de vida; no afirman que el proveedor reproduzca vídeo. No se detectan automáticamente los fallos internos de un iframe de otro origen; el enlace alternativo se muestra siempre.

### Presentación editorial

La interfaz pública usa un sistema de negro, lima y tipografía nativa, con fecha de edición, numeración de la selección y crédito visible. La cabecera permite llegar al buscador con foco en el campo; el footer conecta con la selección y el archivo. El catálogo se adapta a pantallas pequeñas y mantiene navegación por teclado y toque. Las microinteracciones afectan a portadas y colores; el reproductor y sus controles conservan posiciones estables y el modo de movimiento reducido elimina las transiciones. No añade dependencias de interfaz, Liquid Glass ni efectos 3D.

La ampliación de tarjetas anima únicamente la cubierta previa al vídeo durante 240 ms, con salida de 140 ms y sin animación ante movimiento reducido. Una apertura cancelada nunca inserta un iframe tardío. El panel se mantiene dentro de la ventana, debajo de la cabecera y fuera del recorte del carrusel; el reproductor conserva su tamaño mínimo y se detiene antes de la salida. Las tarjetas originales y sus controles mantienen ancho, alto y posición durante todo el ciclo.

La pantalla completa del reproductor conserva la sesión: los eventos de redimensionado asociados no la cierran. El panel continúa el orden de tabulación tras la tarjeta y el paso rápido por otra tarjeta no deja un vídeo anterior abierto.

## Bandeja multifuente y Telegram local

Esta ampliación añade captura manual de Twitch, YouTube (watch, Shorts y youtu.be) y publicaciones X/Twitter. No descarga archivos ni aloja vídeos. Se admiten únicamente enlaces HTTPS directos de los hosts exactos del validador; se eliminan parámetros conocidos de seguimiento y se rechazan redirecciones, acortadores y otros parámetros. Los IDs y anclas históricos de Twitch permanecen intactos; YouTube usa `youtube:ID` y X `x:ID`. Las instantáneas antiguas sin proveedor se interpretan como Twitch.

### Configuración privada

1. Ejecuta `npm run db:local` para aplicar también `0004_manual_inbox.sql`, aditiva y sin cambios en las tablas de importación Twitch ni en las ediciones existentes.
2. Configura un **bot dedicado** y su propietario en archivos locales ignorados. No uses otro bot de automatización. No necesitas claves YouTube ni una API X de pago.
3. Genera una clave compartida aleatoria (por ejemplo, `openssl rand -hex 32`). En `.dev.vars` configura:

```dotenv
LOCAL_BRIDGE_SECRET=<clave-aleatoria-compartida-de-al-menos-32-caracteres>
TELEGRAM_OWNER_CHAT_ID=<chat-privado-del-propietario>
TELEGRAM_OWNER_USER_ID=<usuario-del-propietario>
```

En `.env.telegram` configura los mismos valores y el token del bot dedicado:

```dotenv
TELEGRAM_BOT_TOKEN=<token-del-bot-dedicado>
TELEGRAM_OWNER_CHAT_ID=<chat-privado-del-propietario>
TELEGRAM_OWNER_USER_ID=<usuario-del-propietario>
LOCAL_BRIDGE_SECRET=<misma-clave-aleatoria>
LOCAL_BRIDGE_ORIGIN=http://127.0.0.1:8787
```

Protege ambos archivos con permisos privados (`chmod 600 .dev.vars .env.telegram`). No incluyas valores reales en Git ni logs. Reinicia el servidor después de cambiar `.dev.vars`.

```sh
npm run dev
# En otra terminal:
npm run bot
# Estado local:
npm run bot:status
```

El Worker local y el runner deben estar en el mismo ordenador. El bridge existe **solo en `src/local.ts`**, con flag explícito de desarrollo, origen HTTP loopback exacto y secreto compartido; rechaza solicitudes de navegador con `Origin`. La entrada de producción no incluye sus rutas. No uses túneles, webhooks ni exposición de puertos. La web local se usa en el ordenador; no se envían enlaces localhost como si fueran accesibles desde Telegram móvil.

Para detener el runner, pulsa Ctrl-C; se libera el lease al terminar la operación en curso. Al reiniciar se retoma el cursor en D1 local. No se crea una segunda base de estado en Node. Telegram conserva actualizaciones pendientes **como máximo 24 horas**: apagar el equipo o dejar de sondear más tiempo puede perder mensajes, que deben reenviarse. Un segundo receptor no puede adquirir el lease hasta que el primero lo libere o caduque (90 segundos). No ejecutes otra aplicación con ese token.

### Captura y edición

- Envía texto, enlaces de entidades o pies de foto, también texto reenviado, hasta diez URLs por mensaje. Se informa guardados, duplicados, rechazados y exceso. No se usa el autor del reenvío como crédito de la fuente.
- Los archivos adjuntos no se descargan; los mensajes editados no se importan: envía un mensaje nuevo. La validación del propietario (chat privado **y** usuario) ocurre antes de guardar contenido o consultar proveedores; otros usuarios no reciben respuestas.
- `/ayuda` muestra instrucciones; `/estado` muestra el avance y `/edicion YYYY-MM-DD` cambia la fecha (Madrid). `/seleccion` abre controles actuales. `/publicar` o `/preparar` presenta una vista previa completa, nunca publica por sí mismo. `/cancelar` cancela la entrada de texto pendiente.
- Los botones Editar y Excluir llevan a acciones breves; la edición completa está en admin. Los controles ligados a una revisión antigua no pisan cambios recientes. Si compartes enlaces mientras se solicita texto editorial, se capturan sin convertirlos en ese texto.
- `/admin/inbox` permite capturar sin bot, filtrar, revisar la fuente y editar todos los datos del clip. YouTube usa oEmbed oficial sin redirecciones, hasta 32 KiB y cuatro segundos; Twitch reutiliza Helix/datos importados. Los metadatos no acreditan derechos ni visualización del vídeo.
- Consulta el apartado «Captura automática y publicación revisada desde Telegram» para el recorrido actual y sus límites.

### Recuperación y límites de entrega

Cursor, deduplicación por `update_id`, sesión, botones temporales y respuestas pendientes se guardan en D1 local ignorado (`.wrangler/`). Los efectos de cada actualización y su respuesta se confirman en una transacción antes de avanzar el cursor. No se almacenan actualizaciones crudas ni se registran IDs personales, tokens o cuerpos de errores. Las respuestas se envían exclusivamente al propietario configurado y como respuesta a actualizaciones autorizadas y al terminar sus lotes de importación; no hay publicaciones sociales.

La outbox reintenta con espera exponencial acotada (hasta cinco minutos), respetando `retry_after` hasta 24 horas; después de ocho intentos queda marcada como fallida para diagnóstico. El estado muestra pendientes y fallidas. Una caída después de que Telegram acepte una respuesta pero antes de confirmar la entrega puede duplicar **esa respuesta**: `sendMessage` no ofrece clave de idempotencia. No duplica candidatos ni efectos editoriales. Reenvía el comando si una respuesta queda fallida. Las lecturas de sondeo están limitadas a diez actualizaciones y 256 KiB, con timeout; los handlers locales limitan el cuerpo a 64 KiB. No hay consultas arbitrarias a URLs enviadas.

### Reproductores multifuente

Se mantiene una única sesión de reproducción y la capa fija de entrada 240 ms/salida 140 ms, sin cambiar geometría ni scroll. Movimiento reducido, ahorro de datos, pérdida de visibilidad, Escape, foco, teclado, toque y pantalla completa conservan controles de cierre y fuente original.

- **Twitch:** mismo iframe oficial y mínimo 400×300; las pantallas estrechas ofrecen el original.
- **YouTube:** iframe API oficial, controles completos, `origin`, `enablejsapi`, `playsinline`, referencia `strict-origin-when-cross-origin` y mínimo 200×200. Intenta inicio silenciado cuando procede; hay botón de reproducción y controles oficiales si se bloquea. La orientación puede corregirse en el editor; el vídeo no se recorta ni distorsiona. No requiere clave de YouTube Data API.
- **X:** carga `widgets.js` y llama a `twttr.widgets.createTweet` **solo después de un clic explícito**, conservando el contexto de la publicación en una zona desplazable. No se promete hover, autoplay, disponibilidad ni vistas contabilizadas. No se ejecuta HTML oEmbed. La CSP permite únicamente los hosts oficiales necesarios, sin comodines, `unsafe-inline` ni `unsafe-eval`; las páginas exclusivamente Twitch mantienen su política de scripts/frames anterior.

**Comprobación de viabilidad X (2026-11-19):** la documentación oficial actual describe `createTweet`, su promesa y opciones; el `widgets.js` oficial respondió e incluye esa API. La antigua URL de documentación redirige al nuevo portal. Esto verifica la vía técnica pública, no la disponibilidad de una publicación concreta. Restricciones de cuenta, contenido borrado/protegido, consentimiento, bloqueadores o cambios del proveedor pueden impedir el embed. El enlace original permanece visible. [Referencia oficial](https://docs.x.com/x-for-websites/embedded-posts/guides/embedded-post-javascript-factory-function).

Las pruebas automáticas separan D1/Telegram simulado y adaptadores oficiales simulados de comprobaciones reales. Los tests de navegador prueban una selección de cinco enlaces/tres proveedores, duplicados, privacidad, publicación explícita, retirada, y catálogo mixto a 320/390/768/1440 px. La verificación real de desarrollo observó reproducción silenciada de YouTube y reproducción de vídeo en una publicación de X después de pulsar sus controles oficiales. El bot real sigue pendiente de configurar su token privado; los mocks no acreditan reproducciones ni derechos. La carga de un embed tampoco acredita una reproducción completada ni vistas contabilizadas. El SDK de X intenta inyectar un estilo inline auxiliar que la CSP bloquea; se conserva la política estricta, y el post y sus controles se comprobaron por separado.

### Rollback

Detén el runner antes de volver al código anterior. Conserva una copia privada de D1 local; las tablas aditivas pueden permanecer. No elimines las tablas Twitch ni las ediciones. Las ediciones antiguas Twitch son compatibles; un código anterior a multifuente no entiende nuevas ediciones YouTube/X, por lo que no debe servirlas sin restaurar un snapshot compatible revisado. No se realiza despliegue ni rollback remoto automáticamente.

## Análisis local de publicaciones de X

Al capturar una fuente X por la bandeja o el bot, se guarda primero la fuente y un trabajo privado. El navegador y el modelo funcionan en un proceso Node separado del Worker; nunca bloquean la captura ni el polling del bot. Las capturas duplicadas no repiten análisis. Para fuentes antiguas o fallos, usa **Analizar / reintentar**. Los controles manuales siguen disponibles aunque no haya modelo.

Aplica las migraciones locales con `npm run db:local` antes de iniciar el servicio. Instala el navegador de Playwright si no está disponible (`npx playwright install chromium`). No cambian dependencias ni se requiere ninguna API de pago. Ollama debe estar disponible en el bucle local fijo `http://127.0.0.1:11434`; instala un modelo adecuado por tus propios medios y elige su nombre en el entorno privado. No se envían datos a un proveedor de IA remoto.

Configura en el archivo local ignorado `.env.telegram` (también usado por `npm run bot`):

```dotenv
# Nombre del modelo ya instalado en tu Ollama local. Sin valor público predeterminado.
ENRICHMENT_MODEL=nombre-del-modelo-local
# Número máximo de respuestas públicas que se intentan recoger (0..50, defecto 10).
ENRICHMENT_COMMENTS=10
# 0 desactiva el análisis integrado en el bot; cualquier otro valor lo habilita.
ENRICHMENT_ENABLED=1
# Reutiliza el secreto privado y el origen del bridge local ya configurados.
# LOCAL_BRIDGE_SECRET=...
# LOCAL_BRIDGE_ORIGIN=http://127.0.0.1:8787
```

`npm run bot` inicia también el procesador local, salvo `ENRICHMENT_ENABLED=0`. El modelo es opcional: sin `ENRICHMENT_MODEL` se recuperan metadatos y se informa de campos pendientes, sin inferencia. Sin bot, `npm run enrich` usa el mismo archivo privado junto al servidor local. No hace falta lanzar ambos: el lease global permite un único trabajo activo. `/estado` y `npm run bot:status` indican actividad del procesador y configuración del modelo. El Worker de producción no incluye Playwright, Ollama ni bridges locales; los trabajos de una instalación remota requieren una futura solución de operación remota, no incluida aquí.

El recolector utiliza un contexto efímero sin cookies guardadas y el embed oficial de X. Verifica el identificador del artículo mediante su enlace temporal y separa el autor del post del streamer original. Intenta la conversación pública sin iniciar sesión; no sortea bloqueos, CAPTCHA ni pantallas de acceso. **0/10 comentarios significa cero comentarios leídos**, aunque el proveedor anuncie más respuestas. Sólo se consideran respuestas con pertenencia visible a la conversación; las sugerencias y los comentarios no verifican hechos ni autoría. Hay límites de tiempo, desplazamientos, texto y red. La inferencia recibe como máximo 6000 caracteres de comentarios (hasta 500 por comentario), además del texto acotado del post; no se promete cobertura exhaustiva.

La orientación procede de dimensiones intrínsecas del vídeo, o de su área de reproducción medida y etiquetada; admite horizontal, vertical, cuadrada y desconocida. Se intenta una imagen JPEG del elemento de vídeo con un fotograma decodificado en tiempo cercano a cero. Si no está disponible, se puede guardar el póster oficial etiquetado **provider_poster**, que no garantiza ser el fotograma inicial. Nunca se guarda un vídeo completo: las solicitudes de vídeo se rechazan salvo respuestas parciales acotadas, con un máximo de cuatro manifiestos HLS de 8 KiB y dos bloques iniciales de medios de 512 KiB. La imagen final está limitada a 300 KiB; puede no estar disponible.

El modelo usa JSON estructurado, temperatura cero, sin herramientas, entrada/salida y tiempos acotados, con un máximo de dos intentos ante salida inválida. El título y el contexto deben estar en español; un control heurístico rechaza señales comunes de francés/inglés, pero la revisión editorial sigue siendo necesaria. El streamer queda vacío si el post no lo identifica explícitamente; la cuenta que comparte el vídeo no se convierte automáticamente en su creador. Si falla el modelo, se conserva una extracción parcial visible y se puede reintentar. Si el post no aporta texto, no se consulta al modelo: se conservan los medios disponibles y se indica el motivo, sin inventar título ni contexto.

La bandeja muestra estado, autor de la fuente, datos y evidencias. Los nuevos enlaces se procesan automáticamente: metadatos de YouTube (oEmbed), Twitch (Helix con credenciales configuradas o datos de descubrimiento) y extracción pública de X. Para Twitch/YouTube, el fallback local utiliza el título recuperado como evidencia limitada; no analiza el vídeo ni convierte el canal en una persona que aparece en él. Sin datos suficientes queda pendiente de edición, no se inventa una atribución. Los campos vacíos se completan en el borrador con su procedencia; nunca se sobrescriben correcciones manuales, incluso si el propietario vació un campo. Una categoría no determinada queda pendiente, sin usar Fails como diagnóstico por defecto. Los registros anteriores conservan su flujo de aplicación explícita. El admin mantiene Aplicar campos vacíos como herramienta de revisión de propuestas y permite la edición completa.

Las propuestas y JPEG se guardan en tablas nuevas de D1 (migración `0005`). Las imágenes se identifican por hash y se revisan por una ruta protegida de administración. Su ruta pública sólo entrega bytes cuando una edición publicada referencia exactamente la imagen; un borrador no basta. Retirar la última referencia publicada revoca inmediatamente el acceso público (sin caché). No se publica texto, comentarios ni evidencia del análisis en rutas públicas. La publicación sigue requiriendo la revisión y acción editorial existentes.

Los trabajos usan un token de fencing, lease de tres minutos y un único análisis simultáneo. Un reinicio recupera los trabajos caducados; hay como máximo tres intentos automáticos, con espera tras error. Un proceso viejo no puede guardar resultados tras perder el lease. Un resultado parcial del modelo requiere reintento explícito para volver a inferir. Las pruebas usan D1 efímera, respuestas de modelo simuladas, HTML público de prueba y ninguna llamada real a X, Ollama o Telegram; la comprobación real del proveedor/modelo se realiza por separado.

## Captura automática y publicación revisada desde Telegram

Aplica las migraciones locales (`npm run db:local`) antes de usar esta versión y reinicia servidor y bot. La migración 0006 conserva candidatos, publicaciones y respuestas pendientes; añade lotes, procedencia y controles versionados. No requiere alterar credenciales ni servicios de pago.

1. Envía hasta diez enlaces: se normalizan, deduplican y guardan como lote privado persistente. Se añaden a la selección de la fecha Madrid elegida, sin duplicados ni recuperación silenciosa de descartados. Fuentes que exceden diez se conservan en bandeja, fuera de la selección.
2. Recibirás un acuse inmediato y un resumen al terminar el lote. `/estado` muestra avance y campos pendientes. El bot ofrece **Editar** y **Excluir** por clip; dentro de Editar están título, crédito, contexto, categoría y reintento.
3. `/publicar` (también `/preparar`) muestra la edición completa: textos generales, orden, destacado y todos los clips. Completa o excluye deliberadamente lo que falte. Una vista previa larga se divide en mensajes, con confirmación sólo al final y entrega ordenada.
4. **Confirmar revisión y publicar** es la única acción de publicación del bot. Requiere propietario autorizado, una edición válida y la versión exacta mostrada; un cambio desde admin obliga a obtener otra vista previa. El doble clic no duplica efectos. Se parte de la edición existente, nunca se reemplaza por el último lote silenciosamente; los cambios del borrador admin, incluidas retiradas, se muestran antes de confirmar.

`/seleccion` muestra los controles actuales; `/edicion YYYY-MM-DD` elige fecha y `/cancelar` cancela una entrada de texto. Admin permite orden, destacado, textos de edición y retirada, además de la edición detallada de cada fuente. El bot no observa el portapapeles: es necesario enviar el enlace. No ofrece localhost como enlace móvil funcional.

El descubrimiento Twitch alimenta el mismo procesamiento, pero no cambia automáticamente la selección del propietario. Ninguna captura, propuesta o tarea programada publica contenido. «Completo» describe campos válidos, no autoría ni hechos verificados: la revisión explícita sigue siendo necesaria. Publicar en una instalación local no despliega la web en Internet ni publica en redes sociales.

### Formulario rápido y análisis en segundo plano

`/admin/quick` comprueba cada cinco segundos el estado del enriquecimiento mientras la pestaña está visible. «Incorporar datos nuevos» actualiza los campos editoriales que hayan cambiado en la fuente desde la apertura y que el usuario no haya editado (incluso si los dejó vacíos). No añade clips ni recupera los quitados automáticamente. Los cambios siguen en el formulario hasta publicar: esto no es autoguardado ni sincronización de vuelta a la bandeja.

Antes de publicar se consulta de nuevo el estado: los datos nuevos incorporables requieren revisión; un análisis pendiente permite confirmar expresamente publicar la copia actual. El enriquecimiento no modifica posteriormente esa publicación. Los cambios concurrentes de la edición conservan el control de versión existente. Si la comprobación falla, se conservan los campos y no se publica. La comprobación periódica termina tras publicar o salir de la página.
