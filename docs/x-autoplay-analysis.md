# Autoplay de vídeo en X: análisis y plan

Fecha de la investigación: 21 nov 2026. Certeza: **A** = documentación oficial leída hoy · **M** = fuente secundaria o inferencia razonable · **N** = no verificado.

Limitación: el buscador web falló a mitad de la sesión y `help.x.com` bloquea fetch automatizado (403), así que lo relativo al comportamiento del timeline y al algoritmo no pudo contrastarse con documentación oficial.

## Resumen y recomendación

1. **El autoplay lo da el vídeo nativo del post (o de un post citado).** Un enlace a YouTube/Twitch no autorreproduce en el timeline (M).
2. **La API de pago por uso no permite quote-post** (`quote_tweet_id` exige Enterprise) (A). Tampoco podemos subir vídeo ajeno sin permiso. Con esos dos límites, la vía segura y viable hoy es: **post con el enlace a la fuente al final** + auto-respuesta con la web.
3. **Coste que el módulo ignoraba:** en pago por uso `Post: Create (with URL)` cuesta **$0,20** frente a $0,015 sin URL (A). Un `top` actual lleva URL en el post y en la respuesta: unos **$0,40 por clip publicado**. Con un clip/día son ~$12/mes. Aceptable, pero conviene saberlo antes de activar.
4. **Recomendación:** no subir vídeo propio ni re-subir clips. Fase 1 (hecha en esta PR): para fuentes de X, la URL de estado va **al final** del post. Fase 2: publicar manualmente (copiar borrador) con quote-post desde la app de X, que sí lo permite, hasta decidir si compensa Enterprise. Fase 3: og:image por edición/clip para que el enlace a la web luzca bien.

## 1. Cómo se reproduce el vídeo en el timeline

| Afirmación                                                                                                                                                                                                                                                                        | Certeza                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Un post con vídeo subido (media nativa) se reproduce en el timeline según el ajuste de autoplay del usuario.                                                                                                                                                                      | M (comportamiento conocido de X; no pude abrir help.x.com) |
| Un post que **cita** otro post con vídeo muestra ese vídeo reproducible en la tarjeta citada.                                                                                                                                                                                     | M                                                          |
| Un enlace a YouTube/Twitch se muestra como tarjeta con miniatura; no autorreproduce.                                                                                                                                                                                              | M                                                          |
| Las Player Cards (`twitter:player`) ya no son fiables: la documentación antigua de cards redirige hoy a la portada de docs.x.com y hay reportes de que dejaron de funcionar ([model-viewer #4071](https://github.com/google/model-viewer/discussions/4071)). No contar con ellas. | M (el reporte es un único hilo)                            |
| Los ajustes de autoplay son del usuario (datos móviles/wifi/nunca), no controlables por el publicador.                                                                                                                                                                            | M                                                          |

Conclusión práctica: no existe un metadato que fuerce autoplay para enlaces externos; solo la media nativa lo hace.

## 2. Opciones para publicar el clip

| Opción                                                                                                  | Viabilidad técnica                                                                                                                                                                                             | Coste/tier                              | Derechos/ToS                                                                                                                            | Veredicto                                                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Subir vídeo nativo** (`POST /2/media/upload/initialize`→`append`→`finalize`, luego `media.media_ids`) | Sí. Límites en post: 20 min / 8 GB (cuentas normales), 125 min / 16 GB (Premium/verificada); H.264/AAC, 5 000 kbps recomendado (A: [best practices](https://docs.x.com/x-api/media/quickstart/best-practices)) | Pago por uso; un post con URL $0,20 (A) | Requiere **derechos** del creador. Descargar y re-subir clips de Twitch/YouTube/X ajenos incumple sus términos y es riesgo de copyright | **Descartada** salvo permiso explícito del creador (y nunca automática)                      |
| **Quote-post del post original** (X-source)                                                             | Por API: `quote_tweet_id` **solo Enterprise** (A: [Create Post](https://docs.x.com/x-api/posts/create-post)). En la app de X: sí (M)                                                                           | Enterprise = coste alto/contrato        | Seguro: es la función nativa de X, el creador conserva autoría y monetización                                                           | **Mejor opción manual**; por API solo si hay Enterprise                                      |
| **URL de estado de X al final del post**                                                                | Sí. X renderiza una URL de estado final como post citado (M: comportamiento observado, no documentado oficialmente; sin verificar contra la API v2 hoy)                                                        | $0,20 por post con URL (A)              | Seguro                                                                                                                                  | **Implementada** en esta PR                                                                  |
| **Clip de otro post** (`clip: {post_id,start_seconds,end_seconds}`)                                     | Existe en la API: 5–60 s, máx. 30 % del vídeo, el post debe tener **un solo vídeo de más de 2 min** (A: esquema OpenAPI de Create Post). Incompatible con media, card, quote                                   | Normal                                  | Nativo de X; no aplica a clips cortos típicos                                                                                           | **Poco útil** (los clips de GTA suelen durar <2 min). Revisar si surgen directos largos en X |
| **Enlace a Twitch/YouTube + tarjeta**                                                                   | Sí (lo que hace hoy el módulo)                                                                                                                                                                                 | $0,20                                   | Seguro                                                                                                                                  | Válida; sin autoplay                                                                         |
| **Respuesta con enlace a la web**                                                                       | Sí                                                                                                                                                                                                             | $0,20                                   | Seguro                                                                                                                                  | Mantener                                                                                     |

Reglas de automatización relevantes (A: [Developer Guidelines](https://docs.x.com/developer-guidelines.md)): cuentas automatizadas etiquetadas, sin respuestas no solicitadas masivas, contenido idéntico repetido es spam. El flujo actual (publicación con confirmación humana, un post y una auto-respuesta propia) encaja.

## 3. Enlaces y alcance

- Práctica habitual: enlace externo fuera del post principal (en la respuesta) para no penalizar el alcance. **Certeza M**: es consenso de la comunidad; no pude verificar con documentación oficial ni con el código abierto del algoritmo en esta sesión (N).
- Estructura recomendada para el `top`:
  1. Post: gancho (título) + crédito `@creador` (genera notificación y posible repost) + contexto + `#GTAVI` + **URL del clip/post original al final**.
  2. Auto-respuesta: enlace a la web con UTM (`utm_campaign=x_top`) (ya implementado).
- Coste: ambos posts llevan URL → $0,40. Alternativa de ahorro (no implementada): si el clip es de X, el post citado cumple la función de enlace y la respuesta sigue siendo la única captación a la web.
- Medir antes de optimizar: `utm_content` ya distingue top/hunt; comparar clics por ruta de entrada y vídeo visto en X Analytics.

## 4. Metadatos de la web

Estado actual (revisado en `src/index.ts:67` y `src/brand.ts:25`): `twitter:card=summary_large_image`, `og:title/description/url/type/site_name/locale`, `og:image` y `twitter:image` fijos (`/brand/og.jpg`, 1200×630, con alt). `twitter:title/description` no están, pero X recurre a og:* (M). Correcto para compartir la web.

- `summary_large_image` es la elección adecuada; `twitter:player` / `og:video` **no recomendados** (player cards no fiables, §1; además serviríamos vídeo ajeno).
- Mejora propuesta (Fase 3, no implementada): `og:image` por página `/dia/<fecha>` con la miniatura del clip destacado (las ediciones ya guardan `thumbnail`). Riesgo: miniaturas de Twitch/YouTube son recursos de terceros con URLs que pueden caducar; usar solo si el origen es estable o generar una imagen propia compuesta (logo + título). Requiere decisión sobre derechos de miniaturas.

## Plan por fases

| Fase | Contenido                                                                                                                                 | Esfuerzo | Riesgo                           | Estado                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------- | -------------------------------- |
| 1    | Borrador `top` para fuentes de X: URL de estado al final y protegida del recorte (render como post citado, vídeo inline)                  | S        | Bajo                             | **Hecho en esta PR** (+test)     |
| 2    | Mostrar el coste estimado por borrador en el panel; para fuentes X sugerir "hacer quote-post manual desde la app" y marcar como publicado | S–M      | Bajo                             | Propuesto                        |
| 3    | `og:image` por edición (imagen propia compuesta)                                                                                          | M        | Bajo–medio (derechos miniaturas) | Propuesto                        |
| 4    | Quote-post por API (`quote_tweet_id`)                                                                                                     | M        | Alto coste (Enterprise)          | Solo si el volumen lo justifica  |
| —    | Vídeo nativo propio                                                                                                                       | —        | Alto (derechos)                  | No hacer sin permiso del creador |

## No verificado (para comprobar en pruebas reales)

- Que X renderice como cita una URL de estado final publicada **vía API v2** (se espera igual que en la app).
- Efecto real del enlace en el alcance en 2026 y comportamiento de autoplay actual (ajustes por usuario).
- Si las player cards siguen funcionando para algún dominio.
- Precios: pueden cambiar; tarifas leídas en [docs.x.com/x-api/getting-started/pricing](https://docs.x.com/x-api/getting-started/pricing).

## Fuentes

- https://docs.x.com/x-api/media/quickstart/best-practices
- https://docs.x.com/x-api/media/quickstart/media-upload-chunked
- https://docs.x.com/x-api/posts/create-post
- https://docs.x.com/x-api/getting-started/pricing
- https://docs.x.com/developer-guidelines.md
- https://github.com/google/model-viewer/discussions/4071
