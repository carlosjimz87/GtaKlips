# GtaKlips — Plan de desarrollo y captación

**Fecha de referencia** · 18 de noviembre de 2026
**Producto** · Web independiente en español que selecciona los mejores clips de jugabilidad de GTA VI.
**Piloto** · 14 días desde la primera edición pública, con $0 en anuncios.
**Primer hito** · Publicar una edición de cinco clips desde el panel, generar su post para X y verificar que el enlace abre el clip destacado.

## Próximos pasos · orden actualizado

1. **Telegram manual multifuente.** Captura privada local de Twitch, YouTube y X, revisión y selección por fecha, preparación y carga confirmada al editor; reproducción oficial y publicación web explícita. Verificar primero con proveedores/Telegram simulados y después con el bot dedicado real, sin depender de nuevas credenciales Twitch.
2. **Integración Twitch real.** Configurar la aplicación, verificar categoría y ejecutar la importación existente contra el proveedor.
3. **Medición.** Implementar y validar eventos y atribución sin confundir aperturas con reproducciones.
4. **Despliegue y bot siempre activo.** Elegir alojamiento, proteger accesos y definir operación continua; el runner actual es local y no despliega nada.
5. **Primera edición pública real.** Revisar derechos, contexto y disponibilidad, publicar explícitamente y comprobar en móvil.
6. **Piloto de catorce días.** Medir operación y resultados, revisar los días 7 y 14.

Las entregas históricas y sus criterios se conservan más abajo. El nuevo orden no acredita comprobaciones reales pendientes ni autoriza publicaciones automáticas.

## 1. Producto y alcance del MVP

GtaKlips ayuda a descubrir en unos minutos qué merece la pena ver de GTA VI cada día. La web ofrece entre cinco y diez clips cuando haya suficientes candidatos verificados. Cada ficha incluye una explicación breve en español, crédito al streamer y enlace a la fuente. Las categorías iniciales son **Fails**, **Jugadas**, **Detalles** y **Reacciones**.

El operador puede gestionar el producto sin jugar a GTA VI. Su trabajo consiste en mirar los clips finalistas, elegir los que funcionan, comprobar el contexto y descartar spoilers o duplicados. Twitch es la primera fuente automática y X es el primer canal de captación.

| Incluido en el MVP                      | Se evalúa después del piloto            |
| --------------------------------------- | --------------------------------------- |
| Portada, ediciones por fecha y filtros  | Guías o comparativas con afiliación     |
| Alta manual multifuente y panel privado | Nuevas fuentes automáticas              |
| Importación programada de Twitch        | Publicación mediante la API de X        |
| Borradores para X y enlaces atribuidos  | Campaña pagada con presupuesto aprobado |

La revisión editorial y la publicación en X son manuales durante el piloto. La automatización prepara los candidatos, conserva los datos y genera el borrador de distribución.

**Descubrimiento en X.** Usar el hashtag `#gtavi` para encontrar publicaciones relevantes sobre GTA VI. Revisar los resultados como fuente complementaria de candidatos y comprobar el autor, el contexto y la fuente original antes de seleccionar un momento.

## 2. Embudo de captación

**Post en X → clip destacado en la edición del día → otro clip o compartir la selección → volver al ranking.**

1. **Atraer.** Publicar un post orgánico al día desde una cuenta de GtaKlips. Contar un momento concreto en una frase y ofrecer el resto de la selección como motivo para abrir el enlace. Alternar humor, detalles y reacciones durante la primera semana.
2. **Cumplir la promesa.** Enlazar a la edición exacta con el clip anunciado destacado o señalado mediante un ancla. En móvil, mostrar contexto y acceso al clip en la primera pantalla útil.
3. **Facilitar el descubrimiento.** Permitir filtrar por categoría y abrir un segundo clip con un toque. Mostrar autor y fuente en cada ficha.
4. **Distribuir.** Compartir dos o tres selecciones durante la primera semana en comunidades que admitan aportes relevantes. Adaptar el mensaje al contexto. Fijar en X un post con enlace a la portada, donde aparece la última edición.
5. **Favorecer el retorno.** Publicar a una hora reconocible, inicialmente alrededor de las 19:00 de Madrid. Ofrecer archivo por fecha y botón para compartir cada selección.

### Ejemplo de post

> Quería aparcar. Terminó bloqueando media avenida.
> Ese fue el fail del día en GTA VI. Aquí van ese clip y otros cuatro, sin spoilers → [edición del día]

El ejemplo se utiliza solo si describe una escena real. El panel genera el texto con el gancho aprobado y la cantidad efectiva de clips. La tarjeta gráfica incorpora el nombre GtaKlips y elementos originales. También se puede citar una publicación original del creador cuando encaje. La subida de un recorte a X requiere permisos para ese uso.

El panel ofrece **Copiar post**. El operador revisa y publica desde su cuenta. Se evitan mensajes repetidos, respuestas masivas y menciones automáticas.

### Atribución

```text
/dia/2026-11-19?utm_source=x&utm_medium=organic_social&utm_campaign=estreno_gtavi&utm_content=fail_dia_01#clip-ejemplo
```

Para comunidades, usar `utm_medium=referral` y un identificador conocido de origen. La URL canónica prescinde de parámetros y ancla. Registrar únicamente los campos de atribución admitidos. La medición del piloto cuenta acciones agregadas y no requiere un píxel publicitario.

## 3. Arquitectura técnica propuesta

Un proyecto en **TypeScript**, con **Cloudflare Workers** para servir HTML y ejecutar las tareas programadas, **D1** como base de datos y **Cron Triggers** para importar candidatos. Proteger el panel y sus acciones mediante **Cloudflare Access**. Las páginas públicas son accesibles sin cuenta.

| Ruta              | Función                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `/`               | Última edición publicada o mensaje de estreno si todavía no existe.   |
| `/dia/AAAA-MM-DD` | Edición permanente con filtros, destacado, créditos y enlaces.        |
| `/archivo`        | Ediciones publicadas desde la más reciente.                           |
| `/admin`          | Cola de revisión, editor, importaciones y métricas.                   |
| `/admin/*`        | Acciones protegidas para importar, guardar, publicar y retirar clips. |
| `/eventos`        | Recepción de eventos públicos permitidos y agregación diaria.         |
| `/sitemap.xml`    | Portada, archivo y ediciones publicadas.                              |

### Datos mínimos

| Entidad          | Campos principales                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Clip             | ID de Twitch, URL, streamer, título de origen, idioma, fecha, duración, vistas observadas, fecha de consulta y estado. |
| Edición          | Fecha editorial de Madrid, título, entradilla, estado y hora de publicación.                                           |
| Clip de edición  | Edición, clip, posición, categoría, texto editorial y destacado.                                                       |
| Importación      | Hora, resultado, candidatos encontrados y error resumido.                                                              |
| Métrica agregada | Fecha, edición, origen, acción y contador.                                                                             |

Guardar instantes en UTC y calcular fechas editoriales con `Europe/Madrid`. Guardar secretos de Twitch en el entorno del Worker. Validar y escapar el texto externo antes de mostrarlo. Admitir enlaces HTTPS de formatos reconocidos de Twitch sin cargar direcciones arbitrarias desde el servidor.

Las acciones de escritura comprueban autorización incluso cuando se accede directamente a sus endpoints. Validar origen y proteger las solicitudes contra cambios no autorizados. Publicar la edición y su orden de clips de forma atómica. Deduplicar importaciones por identificador de Twitch y permitir reintentos seguros.

## 4. Automatización y operación diaria

1. **Importar.** Consultar la categoría correcta de GTA VI en Twitch dos veces al día y buscar clips de las últimas 24 horas. Guardar o actualizar cada candidato por ID.
2. **Preseleccionar.** Comparar vistas entre clips de antigüedad semejante. Reservar espacio a candidatos recientes y creadores pequeños. Los datos priorizan la revisión editorial.
3. **Revisar.** Mirar hasta 20 candidatos y seleccionar entre cinco y diez cuando cumplan los criterios. Descartar revelaciones de historia, duplicados del mismo momento y piezas incomprensibles fuera del directo. Comprobar disponibilidad y atribución.
4. **Editar.** Añadir una frase propia en español por ficha, asignar categoría y elegir el destacado. El objetivo inicial de revisión es de 15–20 minutos diarios y se contrasta con tiempo real registrado.
5. **Publicar.** Publicar la edición y comprobarla en móvil. Si hay menos candidatos aptos, ajustar el título a la cantidad real o conservar la última edición con su fecha visible.
6. **Distribuir.** Copiar el borrador de X, revisar el gancho y publicar. Guardar la URL del post en el panel cuando esté disponible.
7. **Recuperar.** Si Twitch falla, mantener disponible la última edición y permitir alta manual. Si desaparece un clip, retirarlo conservando el resto de la selección.

La primera entrega puede ofrecer **Ver en Twitch**. Los reproductores oficiales se incorporan cuando funcionen correctamente en móvil y cumplan las condiciones del proveedor, con enlace de respaldo. Alojar copias de vídeos requiere comprobar los derechos correspondientes.

## 5. Entregas de desarrollo

### Entrega 1 · Publicación manual completa

- Inicializar el proyecto, las migraciones de D1 y las rutas públicas.
- Implementar alta manual, borrador, orden, destacado y publicación.
- Proteger el panel y todos sus endpoints de escritura.
- Añadir metadatos para vista previa, URL canónica y sitemap.
- Generar desde el panel el borrador de X y su enlace con UTM.
- Probar en móvil con una edición de cinco clips. Identificar claramente los datos de demostración y verificar las fuentes de la edición pública.

**Criterio de aceptación.** Crear y publicar una edición desde el panel, copiar su post y abrir el enlace en una sesión sin acceso al panel. El enlace lleva al clip anunciado. Los borradores son privados.

### Entrega 2 · Importación de Twitch

- Configurar credenciales y verificar el identificador de la categoría.
- Implementar consultas por intervalo temporal y ejecución programada.
- Ofrecer importación manual para reintentar desde el panel.
- Mostrar última ejecución, resultado y error cuando proceda.
- Verificar importaciones repetidas, respuestas vacías, credenciales inválidas y límites de la API.

**Criterio de aceptación.** Dos ejecuciones sobre la misma fuente actualizan los candidatos sin duplicarlos. Un error mantiene accesible la última edición y queda registrado para diagnóstico.

### Entrega 3 · Medición y piloto

- Registrar `visita_edicion`, `abrir_clip` y `compartir_edicion` por edición y origen.
- Añadir un resumen diario para comparar publicaciones y canales.
- Validar los eventos, limitar abuso y excluir comprobaciones internas cuando sea posible.
- Verificar la atribución desde una URL con UTM hasta el clic de salida.
- Revisar resultados al final de los días 7 y 14.

**Criterio de aceptación.** Identificar qué fuentes envían visitas y qué ediciones provocan aperturas de clips. Una apertura mide el clic de acceso, sin acreditar una reproducción completada. Los contadores agregados no identifican retornos individuales.

## 6. Piloto de 14 días

| Periodo   | Trabajo                                                                                                        | Decisión                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Días 1–3  | Publicar una edición diaria, comprobar enlaces y vista previa en X, compartir un aporte en una comunidad afín. | Corregir diferencias entre lo prometido en X y lo mostrado en la página.      |
| Días 4–7  | Alternar humor, detalles y reacciones. Registrar tiempo editorial y aperturas por edición.                     | Repetir los formatos que envían visitas y generan aperturas.                  |
| Días 8–14 | Mantener la cadencia, repetir dos ganchos eficaces con clips nuevos y comparar fuentes.                        | Ampliar distribución, mejorar la página o reducir esfuerzo si apenas hay uso. |

### Scoreboard

```text
fecha | edición | origen | formato del post | visitas | aperturas de clips |
compartidos | minutos de revisión | observación | siguiente prueba
```

Métrica inicial propuesta, **aperturas registradas por cada 100 visitas atribuidas**. Puede superar 100 cuando una visita abre varios clips. Evaluarla junto al volumen de visitas y al tiempo de operación. Con poco tráfico, revisar casos concretos antes de interpretar porcentajes.

## 7. Monetización y tráfico pagado

**Presupuesto del piloto de anuncios e ingresos previstos, $0.** El dominio o los servicios externos pueden tener coste y se revisarán antes de contratar.

- **Pocas visitas.** Ajustar el gancho y la distribución, probar otra comunidad y comprobar que el enlace funciona.
- **Visitas con pocas aperturas.** Mejorar la pantalla de llegada, el acceso al destacado y la velocidad en móvil.
- **Visitas y aperturas sostenidas.** Probar una única salida comercial, como una tabla de ediciones y tiendas por consola y país basada en fichas oficiales. Activar afiliación únicamente donde exista un programa verificable e identificar la relación comercial.
- **Anuncios de captación.** Si hay una acción medible y presupuesto aprobado, reutilizar el formato orgánico más eficaz con un tope de gasto. Medir coste por acción útil y, cuando haya ventas atribuibles, coste por venta frente a comisión o margen.
- **Publicidad en la web.** Evaluar display en páginas elegibles con valor propio sustancial. Las visualizaciones de reproductores externos no generan por sí mismas ingresos de GtaKlips.

Comprobar los términos del proveedor antes de monetizar páginas con contenido integrado. Google limita anuncios en páginas con contenido ajeno sin valor añadido sustancial. Las aportaciones editoriales del ranking son una hipótesis de producto y no garantizan aprobación publicitaria. Revisar los requisitos de privacidad y consentimiento antes de activar píxeles o anuncios.

Las compras dentro de GTA VI solo se incluyen en las previsiones cuando exista un programa verificable que pague por referirlas. Las guías comerciales se incorporan según los resultados del piloto y la capacidad de producir información fiable.

## 8. Checklist de aceptación

- [ ] La web carga en móvil y el clip anunciado en X es fácil de encontrar.
- [ ] Cada clip lleva fuente, streamer, explicación en español y enlace funcional.
- [ ] La selección pasó revisión de spoilers, contexto y duplicados.
- [ ] El panel y sus acciones rechazan solicitudes sin autorización.
- [ ] El archivo y el sitemap incluyen únicamente ediciones publicadas.
- [ ] El post enlaza a la edición correcta y funciona la atribución.
- [ ] Una importación repetida no duplica clips.
- [ ] Un fallo de importación mantiene visible la última edición.
- [ ] Se puede retirar un clip conservando el resto de la edición.
- [ ] Los textos de contacto y privacidad corresponden al despliegue real.
- [ ] El informe de entrega explica cómo ejecutarlo, qué se verificó y qué está pendiente.

## 9. Fuentes oficiales de referencia

Referencias del plan original. Revisar sus condiciones vigentes al implementar cada integración.

- [API de clips de Twitch](https://dev.twitch.tv/docs/api/reference/clips)
- [Requisitos de los reproductores de Twitch](https://dev.twitch.tv/docs/embed/)
- [Política de Rockstar sobre publicación de su material](https://support.rockstargames.com/articles/7bNaeoMFTV0iUDGhStTXvz/policy-on-posting-copyrighted-rockstar-games-material)
- [Reglas de automatización de X](https://help.x.com/en/rules-and-policies/x-automation)
- [Política de autenticidad de X](https://help.x.com/en/rules-and-policies/authenticity)
- [Campañas de tráfico web de X](https://business.x.com/en/advertising/campaign-types/website-traffic)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Política de AdSense sobre contenido replicado](https://support.google.com/publisherpolicies/answer/11190248)

## Continuación del paso 1: propuestas automáticas de X

La captura manual de X en bandeja y Telegram añade un trabajo privado, sin esperar al navegador ni al modelo. La continuación utiliza únicamente el embed oficial y contenido público accesible, sin API de pago, inicio de sesión o descarga de vídeos. Las respuestas públicas son oportunistas (por defecto hasta diez, configurable 0..50) y se muestra siempre cuántas se han leído realmente y por qué pueden faltar.

El servicio local Node requiere Chromium de Playwright y Ollama en loopback con un modelo ya instalado cuyo nombre se configura fuera de Git. Se integra como bucle independiente en el bot y también puede ejecutarse con `npm run enrich`. La producción no incorpora navegador ni inferencia; la D1 usada por el servicio es la del servidor local configurado. El trabajo usa un lease global con fencing, recuperación de reinicios y reintentos acotados.

Se generan propuestas separadas de los campos editoriales: streamer sólo con evidencia explícita, título y contexto atribuido en español, categoría, orientación medida e imagen inicial o póster oficial claramente etiquetado. El autor del post no equivale al streamer. Los resultados parciales y los desconocidos se muestran honestamente. Las imágenes JPEG acotadas se guardan en D1, tienen revisión privada y sólo son públicas mientras las referencia una edición publicada.

La acción explícita **Aplicar campos vacíos** en la bandeja o el bot verifica la revisión editorial y la versión de la propuesta. Conserva valores manuales y el estado de revisión. Preparar, aplicar y reanalizar nunca publican ni aprueban una edición. La revisión y publicación existentes siguen siendo obligatorias. La comprobación del proveedor/modelo real es independiente de las pruebas deterministas con bases efímeras y proveedores simulados.
