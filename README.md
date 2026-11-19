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
2. Añade entre 1 y 10 enlaces directos HTTPS de Twitch, crédito del streamer, título, categoría y contexto propio.
3. Ordena con **Subir/Bajar** y marca exactamente un destacado.
4. **Guardar borrador** conserva cambios privados. Reabre desde **Ediciones guardadas**.
5. Para una edición real, desmarca demostración y confirma que revisaste disponibilidad, autoría, contexto, spoilers y duplicados. El producto valida el formato del enlace, no comprueba remotamente el vídeo ni sus derechos.
6. **Publicar edición** hace visible la instantánea completa, con orden y destacado. **Copiar post** usa esa versión publicada y añade UTM y ancla del destacado. Revisa el texto y publícalo manualmente en X; no hay envío automático. Si el texto excede el límite de tu cuenta, acórtalo al publicarlo.
7. Abre el enlace público y comprueba las fuentes. El clip se abre en Twitch, no en un reproductor integrado.
8. Para retirar un clip, abre su edición y utiliza su ID de Twitch. Se conserva el resto; el primer clip restante sustituye al destacado retirado. Si retiras todos, la página permanece con un estado vacío y no se genera un post. La retirada elimina también el clip del borrador en la misma escritura, evitando republicarlo por accidente.

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

La portada presenta un destacado con reproducción en Twitch, tarjetas con miniaturas, navegación horizontal, filtros por categoría y búsqueda por título, creador o contexto. Las imágenes son opcionales: si faltan o fallan, se conservan la ficha, el crédito y el enlace. Solo se admiten miniaturas HTTPS de los CDN de Twitch especificados por el validador.

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

El destacado intenta reproducirse sin sonido en escritorio cuando el reproductor está completamente visible. Las tarjetas muestran una vista previa tras mantener el ratón encima durante medio segundo y amplían su espacio para alojar el reproductor. Solo se mantiene un iframe activo: salir de la tarjeta, ocultar la pestaña, dejar el reproductor fuera de pantalla o pulsar Escape lo retira. También hay botones para iniciar y detener la vista previa con teclado o toque.

Se respeta movimiento reducido y ahorro de datos: ambos desactivan los inicios automáticos. Twitch exige un reproductor visible de al menos 400×300 px; las pantallas que no permiten ese espacio conservan la imagen y el enlace original. En móvil se requiere interacción. No se ocultan los controles ni se superponen textos al reproductor.

El iframe usa únicamente `https://clips.twitch.tv/embed`, con el clip validado, `muted=true`, `autoplay=true` y `parent` tomado del hostname actual. El dominio publicado debe servir la página mediante HTTPS con el hostname correspondiente; las pruebas locales con reproductor simulado comprueban la interfaz y no acreditan vídeo reproducido ni vistas contabilizadas. Si Twitch o el navegador bloquean el inicio, permanece el enlace al original. Los clips no ofrecen una API interactiva que permita detectar con certeza la reproducción o recortar una preview a un número exacto de segundos. [Documentación oficial](https://dev.twitch.tv/docs/embed/video-and-clips/).

Comprobación de proveedor en desarrollo: el iframe real cargó en loopback HTTP y el vídeo avanzó tras la confirmación de contenido para audiencias adultas de Twitch; otra tarjeta inició su vídeo silenciado al pasar el ratón en esa sesión. Esa excepción local no sustituye los requisitos documentados de HTTPS para el dominio publicado ni garantiza autoplay en otras sesiones. Twitch puede pedir confirmación por clip o sesión y controlar el audio tras un clic del usuario. Los tests de CI simulan el contenido del iframe para comprobar su ciclo de vida; no afirman que el proveedor reproduzca vídeo. No se detectan automáticamente los fallos internos de un iframe de otro origen; el enlace alternativo se muestra siempre.


### Presentación editorial

La interfaz pública usa un sistema de negro, lima y tipografía nativa, con fecha de edición, numeración de la selección y crédito visible. La cabecera permite llegar al buscador con foco en el campo; el footer conecta con la selección y el archivo. El catálogo se adapta a pantallas pequeñas y mantiene navegación por teclado y toque. Las microinteracciones afectan a portadas y colores; el reproductor y sus controles conservan posiciones estables y el modo de movimiento reducido elimina las transiciones. No añade dependencias de interfaz, Liquid Glass ni efectos 3D.
