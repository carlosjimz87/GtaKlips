# Módulo de publicación en X

Estado: **preparado, publicación desactivada por defecto**. Ningún secreto vive en el repo.

## Qué hace

- `GET /admin/x/drafts?date=YYYY-MM-DD` (acceso de editor): borradores del día.
  - `top`: clip destacado de la edición publicada. Texto con título, crédito `@creador`, contexto, enlace a la fuente (X muestra la tarjeta/reproductor) y `#GTAVI`. El enlace a la web va en una **auto-respuesta** con UTM (`utm_campaign=x_top`), porque los enlaces externos en el post principal penalizan alcance.
  - `creator_hunt`: candidatos del día sin creador. Pregunta «¿Quién es el creador?» y pide `@usuario` o enlace de canal. Auto-respuesta con enlace al archivo (`utm_campaign=x_creator_hunt`).
- `POST /admin/x/publish` `{date, kind, ref, confirm:true}`: publica **un** borrador (el texto se recalcula en servidor). Idempotente (`x_posts`, UNIQUE kind+ref; reclamo previo a la llamada; reintento solo si `failed`).
- `parseCreatorReply(texto)`: extrae `@handles` y URLs de canal de las respuestas para estructurar el crédito (la ingesta automática queda como siguiente paso; hoy el editor confirma el crédito en el inbox).

## Activación (acción del propietario, no incluida en la PR)

1. Crear app en el portal de desarrolladores de X con OAuth 2.0 user-context, scopes `tweet.read tweet.write users.read offline.access`.
2. Guardar el token como secreto: `wrangler secret put X_ACCESS_TOKEN` (y `X_PUBLISH_ENABLED=true` solo cuando se quiera publicar de verdad).
3. Sin ambos, `publish` devuelve `dry-run` y no llama a la API ni escribe en BD.
   Nota: los tokens de usuario caducan (2 h) salvo refresh; el refresco automático NO está implementado (siguiente paso; hoy se rota el secreto a mano o se usa un token de larga vida).

## Investigación: formatos que funcionan para el objetivo

- **Hilo de 2 posts**: post principal sin enlace a la web (alcance), respuesta propia con el enlace + UTM. Medible por `utm_content`.
- **Pregunta de crédito («¿quién es?»)**: las preguntas cerradas con una acción mínima (responder con @) generan más respuestas que «comenta». Plantilla fija y reconocible = hábito en la audiencia. Variante: encuesta de 2-4 opciones cuando hay candidatos probables (la API v2 admite `poll`).
- **Citar al creador**: mencionar `@creador` genera notificación y reposts del propio creador (tráfico gratis). Solo con el handle verificado.
- **Serie y formato recurrente**: «Clip del día» a hora fija y «Sin dueño» (hunts) semanal; el nombre estable facilita seguirlo.
- **Tarjetas/vídeo**: X no permite incrustar clips de terceros por la API; la tarjeta del enlace (og:video de Twitch/YouTube) es lo viable. Subir vídeo propio exige derechos del creador: **no** se propone.
- **Imagen social**: `og:image` 1200×630 con el logo (PR #9) para el enlace a la web.
- **Animaciones / UI web**: página `/ayuda-creador/<id>` con el clip y un formulario de una línea (@usuario) que alimente el inbox; microanimación de «crédito desbloqueado» al enviar (respetando `prefers-reduced-motion`); contador público de clips acreditados. No implementado aquí (alcance).
- **Riesgos**: política de automatización de X (publicar solo con confirmación humana, sin respuestas masivas), ToS de Twitch/YouTube (solo enlazar), acoso por señalar creadores (no publicar hunts de clips sensibles).

## Verificación

`tests/x-social.test.ts`, `tests/x-admin.test.ts` (dry-run sin credenciales, no doble publicación, reintento tras fallo).
