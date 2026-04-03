"Hola Claude, quiero seguir desarrollando mi proyecto 'ÚNICO'. Te adjunto los archivos principales (App.tsx, package.json, MaterialScreen.tsx, FormScreen.tsx, InformesScreen.tsx y BackupScreen.tsx).
Puntos clave de la aplicación:
1. Tecnología: React + Vite + Supabase.
2. Auto-Refresco: La app usa `useLocation` en `App.tsx` para recargar datos automáticamente al cambiar de pantalla. Esto evita que los registros no aparezcan tras cambiar su estado.
3. Navegación: Se usa `Maps()` de `react-router-dom`. NO usar window.location.assign porque rompe el despliegue en GitHub Pages (error 404).
4. Backup/Deploy: El backup del código va a la rama `main` de GitHub. El despliegue de la web va a `gh-pages`.
5. Borradores: Las pantallas de Material y Formulario tienen lógica de `draftKey` (localStorage) para no perder datos si la app se cierra.
   Tu tarea: Por favor, analiza el código y dame siempre archivos completos.
6. la aplicacion consiste en registral el material que entra cladificarlo
7. Ir pasando por las distints categorias, hasta su montaje final
8. los paso son, entra el material, de ahi ha armandose, despues en entregas con su fecha y hora de entragas,
9. depues a terminaciones donde se pondran las faltas de la cocina para su posterior terminacion
10. hay una parte de informes el cual me gutaria imprinmir la trazabilidad de un resgistro, y las categorias segun se seleccione
11. 