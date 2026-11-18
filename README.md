# GtaKlips

Selección editorial de clips de GTA VI en español. Etapa 1: edición manual, borradores privados, publicación, archivo por fecha, filtros, retirada de clips y borrador para X. No importa clips ni publica en redes automáticamente.

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

Las pruebas de integración ejecutan el Worker y las migraciones con D1 real local en Miniflare; los JWT se firman con claves efímeras y solo el endpoint JWKS se simula. Playwright recorre el editor con viewport móvil, guarda cinco fixtures, verifica privacidad, ordena, publica, copia el post, abre la URL sin sesión de editor y retira el destacado. Los reportes locales se generan en `playwright-report/` y `test-results/`, excluidos de Git. Las pruebas E2E escriben únicamente en D1 local; no hay cambios remotos.

Pendiente antes de una publicación real: configurar dominio/D1/Access, comprobar el acceso desde Cloudflare, revisión humana de fuentes y derechos, y verificación visual en dispositivo. No hay analítica, formularios de contacto ni cookies propias. Twitch aplica sus políticas cuando se abre una fuente externa.

Referencias: [D1](https://developers.cloudflare.com/d1/), [validación de JWT de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [plan del producto](plan-gtaklips.md).
