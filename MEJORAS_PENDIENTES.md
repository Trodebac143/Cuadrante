# Mejoras pendientes — CUADRANTE UPO4

> Documento de planificación. Estas propuestas no están implementadas y no modifican el funcionamiento actual de la aplicación.

**Fecha de revisión:** 16 de julio de 2026  
**Estado general:** la aplicación tiene una estructura sencilla, adecuada para móvil y orientada a una consulta rápida. Conviene conservar su arquitectura y aplicar en el futuro cambios mínimos, controlados y comprobados.

## Orden recomendado

1. Auditar la seguridad de Supabase.
2. Corregir la lógica de mañanas y tardes.
3. Decidir y, en su caso, permitir varias incidencias del mismo NIP en un día.
4. Reforzar sesiones, importaciones y operaciones destructivas.
5. Incorporar mejoras prácticas y de mantenimiento.

## Prioridad alta

### 1. Auditar la seguridad real de Supabase

Comprobar el SQL y la configuración desplegada:

- RLS activado en todas las tablas.
- Un usuario nunca puede modificar incidencias ajenas manipulando una petición.
- Las funciones administrativas validan en el servidor el token y el rol de administrador.
- Los tokens tienen caducidad y pueden invalidarse.
- Las contraseñas se almacenan mediante hash seguro.
- Existe limitación frente a intentos repetidos de acceso.
- Los permisos `GRANT` y `REVOKE` de tablas y funciones son correctos.
- Ninguna operación depende exclusivamente de controles del frontend.

La clave pública `anon` visible en el navegador no es un secreto. La protección efectiva debe estar en RLS, permisos y funciones de Supabase.

### 2. Corregir la lógica de mañanas y tardes

La función actual alterna por meses completos. Debe respetar la regla operativa real:

- Cadencia de siete días de trabajo y siete días libres, de jueves a miércoles.
- Junio de 2026 corresponde a tardes.
- El cambio de mañana/tarde debe tener en cuenta si el final del mes cae dentro de un periodo de trabajo.

Preparar fechas de prueba conocidas antes de modificar `getMonthShift()`.

### 3. Estudiar varias incidencias para un mismo NIP y fecha

Actualmente la interfaz localiza una única incidencia mediante fecha y NIP. Esto puede impedir registrar dos conceptos distintos el mismo día o hacer que uno sustituya a otro.

Ejemplo: un agente podría necesitar registrar `J` y `FH` el mismo día.

Si se decide permitirlo:

- Identificar cada registro por su `id`.
- Mostrar, editar y borrar cada anotación de forma independiente.
- Revisar el índice único o la lógica de actualización de Supabase.
- Conservar los registros existentes.

### 4. Caducidad y cierre de sesión

- Establecer caducidad real del token en Supabase.
- Cerrar la sesión tras un periodo razonable de inactividad.
- Invalidar las sesiones afectadas cuando se cambie una contraseña.
- Volver al acceso cuando el servidor rechace un token caducado.
- No almacenar tokens persistentemente de forma insegura.

## Prioridad media

### 5. Validar horas y cambios

Validaciones tanto en el frontend como en Supabase:

- La hora final debe ser posterior a la inicial.
- El NIP indicado en un cambio debe existir.
- El NIP de cambio no puede coincidir con el afectado.
- Decidir si un cambio debe relacionarse con una anotación del otro agente.
- Rechazar fechas, horas, conceptos y NIP inválidos.
- Mantener en la base de datos la lista de conceptos permitidos.

### 6. Proteger operaciones destructivas

Para borrar un mes:

- Mostrar mes, año y número de registros afectados.
- Pedir una confirmación reforzada, por ejemplo escribir `BORRAR`.
- Generar u ofrecer una exportación previa.
- Registrar quién realizó el borrado y cuándo.
- Valorar recuperación temporal si se considera necesaria.

### 7. Reforzar la importación JSON

- Limitar tamaño del archivo y número de registros.
- Validar todas las fechas.
- Comprobar que cada NIP exista.
- Admitir únicamente conceptos autorizados.
- Validar coherencia de horas.
- Confirmar el intervalo de fechas.
- Informar de registros válidos, rechazados y actualizados.
- Ejecutar la importación de forma transaccional cuando sea posible.
- Mantener la operación reservada al administrador.

### 8. Abrir inicialmente el mes actual

El código arranca mostrando junio de 2026. Debe mostrar por defecto el mes y año actuales, manteniendo los selectores y sin alterar la lógica del ciclo.

## Mejoras prácticas de uso

### 9. Mostrar horas en el calendario

Cuando haya espacio, mostrar las horas de `FH`, `VM` y `J`, conservando la legibilidad en móvil.

### 10. Indicadores de carga y bloqueo de botones

- Mostrar cuándo una operación está en curso.
- Desactivar temporalmente guardar, borrar, importar o actualizar.
- Evitar dobles pulsaciones y solicitudes duplicadas.
- Restaurar los botones si ocurre un error.

### 11. Control de modificaciones simultáneas

- Comparar `updated_at` antes de guardar.
- Avisar si otro usuario modificó el registro después de abrirlo.
- Recargar los datos antes de confirmar una sobrescritura.

### 12. Vista «Mis incidencias»

Añadir un resumen mensual sencillo del usuario conectado con concepto, fecha, horario y compañero de cambio cuando corresponda.

### 13. Accesibilidad del modal

- Cerrar con Escape.
- Mantener el foco dentro del modal.
- Devolver el foco al día seleccionado al cerrarlo.
- Añadir nombres accesibles a los controles.
- Comprobar contraste, tamaño táctil y navegación por teclado.

## Mantenimiento

### 14. Versionar el esquema de Supabase

Guardar una copia depurada del SQL necesario para reproducir la base:

- Tablas, índices y restricciones.
- RLS y políticas.
- Funciones RPC.
- Permisos.
- Migraciones posteriores.

Nunca incluir contraseñas, tokens privados, claves `service_role` ni datos reales.

### 15. Añadir un README

Incluir finalidad, estructura, requisitos de Supabase, despliegue, copias de seguridad, pruebas básicas y advertencias sobre secretos.

### 16. Mantener un historial de versiones

Registrar versión, fecha, cambios realizados, pruebas efectuadas y problemas conocidos.

### 17. Incorporar pruebas mínimas

Probar:

- Ciclo de siete días de trabajo y siete libres.
- Alternancia de mañanas y tardes.
- Cambios de mes y año.
- Vacaciones por rango.
- `FH`, `VM` y `J` con horas.
- Cambios entre compañeros.
- Permisos de usuario y administrador.
- Importación, exportación y borrado mensual.
- Uso en móvil y escritorio.

### 18. Fijar la versión de Supabase JS

En lugar de cargar genéricamente `@supabase/supabase-js@2`:

- Fijar una versión concreta y probada.
- Actualizar solo después de revisar compatibilidad.
- Valorar medidas de integridad del recurso si el método de distribución lo permite.

## Criterios para ejecutar futuras mejoras

1. Crear una copia de seguridad.
2. Trabajar en una rama independiente.
3. Hacer cambios pequeños y separados.
4. No renombrar ni reestructurar archivos sin necesidad.
5. Probar en móvil y escritorio.
6. Verificar permisos con un usuario normal y con el administrador.
7. No publicar secretos ni datos personales.
8. Incorporar a `main` únicamente tras comprobar que no se ha roto lo existente.
