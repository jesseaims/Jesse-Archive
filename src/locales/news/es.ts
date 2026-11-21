import type { NewsTranslations } from '../../news-changelog';

// Spanish titles and descriptions of the News entries, by entry id.
const news: NewsTranslations = {
  'extension-permissions': [
    'Extensión con menos permisos y avisos de subdominios',
    'La extensión del navegador ya no pide permiso para leer todas las pestañas abiertas, que no necesitaba: al instalarla desaparece el aviso sobre el historial de navegación, y el rellenado, el guardado de cuentas y las passkeys funcionan como antes. En la miniventana, las cuentas guardadas para la dirección exacta de la página aparecen primero; las guardadas para otro subdominio del mismo sitio indican dónde están guardadas (por ejemplo «Guardado para accounts.google.com»), y si el campo está en un marco de otra dirección la miniventana lo indica.',
  ],
  'browser-channel-hardening': [
    'Conexión con el navegador más protegida',
    'El archivo con el código de acceso que la extensión usa para conectarse a la app ahora solo puede leerlo tu usuario de Windows, aunque la carpeta permita leer a otros, y se elimina al cerrar la app. Además, la app cierra las conexiones que no se identifican a tiempo, las que sobran y las que envían demasiados mensajes. El rellenado de credenciales funciona como antes y sigue siendo siempre tu elección en la miniventana.',
  ],
  'generator-checks': [
    'Generador y comprobación de contraseñas más precisos',
    'El generador ya no crea PIN triviales como 000000 o 123456, y la opción «Caracteres únicos» funciona también con longitudes cercanas al número de caracteres disponibles, donde antes solía dar error. Los bits estimados de las contraseñas generadas son ahora una estimación prudente que tiene en cuenta las opciones elegidas. La comprobación de salud de las contraseñas reconoce también contraseñas comunes con pequeños cambios (como «Password123!», «p4ssw0rd» o un nombre seguido de un año), repeticiones y secuencias del teclado: algunas contraseñas antes consideradas robustas pueden aparecer ahora como débiles.',
  ],
  'password-bulk-select': [
    'Archivo de contraseñas más fácil de limpiar',
    'En el Archivo de contraseñas, el botón «Seleccionar todo» selecciona de una vez todas las contraseñas eliminables que se muestran, también filtradas con la búsqueda, para limpiar el historial sin marcarlas una a una. Las contraseñas actuales de las cuentas no se pueden seleccionar: se cambian en la cuenta. Tras eliminar, la app indica cuántas contraseñas ha quitado. Además, al eliminar definitivamente un elemento (también vaciando la papelera), se eliminan también sus contraseñas del historial, en lugar de quedar como contraseñas no vinculadas.',
  ],
  'css-cleanup': [
    'Hoja de estilos depurada',
    'Se eliminaron del estilo de la interfaz las reglas que ya no tenían efecto: propiedades siempre sobrescritas por reglas posteriores y el estilo de un elemento que ya no existe. La app se ve exactamente igual, y una comprobación automática lo verificó regla por regla.',
  ],
  'legacy-python-removed': [
    'Eliminada del código fuente la antigua versión en Python',
    'La primera versión de Jesse’s Archive, escrita en Python, ya no forma parte del código fuente: la app no la usaba y dificultaba el mantenimiento. Sigue disponible en el historial del proyecto. Los vaults creados con esa versión se siguen abriendo, y una prueba lo comprueba en cada cambio. Para quien usa la app no cambia nada.',
  ],
  'export-keeps-groups': [
    'Los archivos exportados conservan grupos y favoritos',
    'Al exportar el vault a CSV y volver a importarlo, las cuentas de apps y servicios sin sitio web (por ejemplo, varias cuentas del mismo juego) vuelven a su grupo con su nombre en lugar de acabar cada una en un grupo separado, y los favoritos se mantienen. La exportación JSON ahora también conserva los nombres e iconos de los grupos. Además, los elementos eliminados y luego importados de nuevo desde un archivo JSON ya no desaparecen al guardar.',
  ],
  'window-permissions': [
    'Cada ventana solo puede hacer su propio trabajo',
    'La miniventana del navegador, la búsqueda rápida y la guía de las extensiones ahora solo pueden usar las funciones que necesita cada una: por ejemplo, ya no pueden exportar el vault, leer contraseñas que no muestran, modificar elementos ni cambiar la contraseña maestra. Todo esto sigue siendo posible solo desde la ventana principal. No cambia nada en el uso diario.',
  ],
  'group-favorites': [
    'Favoritos directamente desde los grupos de cuentas',
    'En la vista por grupos de las cuentas, cada cuenta tiene una estrella para añadirla o quitarla de favoritos, y la estrella junto al nombre del grupo añade o quita todas sus cuentas a la vez, sin abrirlas una por una.',
  ],
  'ui-secrets-on-demand': [
    'Las contraseñas ya no quedan abiertas en la ventana principal',
    'La ventana principal ahora recibe solo los nombres, usuarios y direcciones de los elementos. Las contraseñas, PIN, CVV, números de tarjeta, seed phrases, códigos TOTP y el texto de las notas permanecen en el motor de la app, separado de la interfaz, hasta que los muestras, los copias o abres el elemento para editarlo, y se olvidan al cerrar el elemento o bloquear el vault. Las contraseñas copiadas desde las fichas de las cuentas y desde el historial van directamente al portapapeles sin pasar por la ventana. La búsqueda sigue encontrando las palabras escritas en las notas.',
  ],
  'vault-scrypt-rollback': [
    'Contraseña maestra más difícil de forzar y aviso sobre copias antiguas',
    'En el primer desbloqueo, la protección de la contraseña maestra pasa a un cálculo cuatro veces más pesado (scrypt con 128 MB de memoria): quien consiga una copia del vault tardará mucho más en probar contraseñas. El desbloqueo puede tardar una fracción de segundo más. Los nuevos paquetes .jshare también usan esta protección. Si el archivo del vault se sustituye por una copia más antigua (por ejemplo, en la carpeta de la nube), aparece un aviso al abrirlo. Además, un cambio que no se guardó porque el archivo estaba ocupado ahora se guarda en la siguiente sincronización. Si usas el vault en varios PC, actualízalos todos: tras el primer desbloqueo con esta versión, las anteriores ya no pueden abrirlo.',
  ],
  'vault-header-key-rotation': [
    'Más protección al cambiar la contraseña maestra',
    'El encabezado del vault ahora está firmado con una clave que solo tú puedes obtener: una copia antigua colocada en la carpeta del vault (por ejemplo, por alguien con acceso a tu nube) ya no puede devolver una contraseña maestra antigua. Al cambiar la contraseña maestra puedes marcar «Puede que alguien haya descubierto la contraseña anterior»: también cambia la clave que cifra los datos, así la contraseña anterior ya no abre el vault, ni siquiera desde una copia, y recibes un nuevo código de recuperación para guardar. Un nuevo código de recuperación siempre cambia también la clave. Si usas el vault en varios PC, actualízalos todos antes.',
  ],
  'universal-import': [
    'Importa desde los principales gestores de contraseñas',
    'La importación reconoce ahora los archivos de Bitwarden (CSV y JSON sin cifrar), LastPass, 1Password, Dashlane, NordPass, Proton Pass, KeePass y KeePassXC (CSV y XML), RoboForm y de Chrome, Edge, Brave, Opera, Firefox y Contraseñas de Apple. Antes de importar, una vista previa muestra el programa reconocido y cuántos elementos ha encontrado; en los CSV puedes revisar y cambiar a qué campo va cada columna, así también funcionan archivos de otros programas.',
  ],
  'bulk-select-accounts': [
    'Selecciona muchas cuentas a la vez',
    'En «Todos los elementos» y «Cuentas» ahora puedes seleccionar grupos enteros o cuentas sueltas con su casilla, o todo lo que ves con «Seleccionar todo» (también los resultados de una búsqueda), y moverlos de una vez a la papelera o a una carpeta.',
  ],
  'kaspersky-import': [
    'Importar desde Kaspersky Password Manager',
    'Jesse’s Archive ya importa el archivo de texto (.txt) que crea Kaspersky Password Manager con «Exportar a archivo de texto»: sitios web, aplicaciones y otras cuentas pasan a ser cuentas con nombre, dirección, usuario, contraseña y comentarios, y las notas de Kaspersky pasan a ser notas. Después borra el archivo exportado: contiene tus contraseñas en claro.',
  ],
  'unlock-throttling': [
    'Protección contra quien intenta adivinar la contraseña',
    'Tras 5 intentos fallidos seguidos de desbloquear el vault (contraseña maestra o código de recuperación), Jesse’s Archive te hace esperar 30 segundos antes del siguiente, el doble cada vez hasta 15 minutos. El recuento se mantiene al reiniciar la app y se borra con el primer desbloqueo correcto.',
  ],
  'save-new-logins': [
    'Guarda las cuentas nuevas desde el navegador',
    'Cuando te registras en un sitio, o inicias sesión con una cuenta que aún no está en el vault, Jesse’s Archive te pregunta si quieres guardarla: nombre, usuario o correo, contraseña y, si quieres, los demás datos introducidos pasan a una cuenta nueva para ese sitio. Si cambias una contraseña en un sitio, te ofrece actualizar la guardada. No se guarda nada sin tu confirmación, y puedes desactivarlo o excluir sitios en Ajustes. Requiere la extensión actualizada.',
  ],
  'installer-sharper-images': [
    'Imágenes del instalador más nítidas',
    'El logotipo y el nombre en el lateral del instalador ahora se ven nítidos: proceden de la ilustración original y se preparan con el tamaño exacto para cada escala de pantalla, así que Windows ya no tiene que estirarlos.',
  ],
  'new-installer': [
    'Nuevo instalador con el estilo de la app',
    'El instalador se ha rehecho: una sola ventana de principio a fin, con el tema oscuro y el logotipo de Jesse’s Archive, en lugar del procedimiento que pasaba por Windows Installer. Ahora también tiene su propia desinstalación, que quita el programa sin tocar la bóveda ni la configuración. Al actualizar desde la versión anterior no tienes que hacer nada: el nuevo instalador sustituye al anterior en la misma carpeta.',
  ],
  'extension-logo-autoreload': [
    'Logotipo de la extensión y recarga automática',
    'La extensión del navegador ahora muestra el logotipo de Jesse’s Archive en la barra y en la lista de extensiones. Después de cada actualización se recarga sola en cuanto se conecta a la app, sin tener que hacerlo a mano desde la página de extensiones. Por esta vez recárgala a mano: la recarga automática se aplica a partir de las próximas actualizaciones.',
  ],
  'breach-check-autofill-fixes': [
    'Verificación de filtraciones y autocompletado más fiables',
    'La verificación de cuentas comprometidas ahora también funciona con bóvedas grandes (antes se detenía con «No se puede contactar con Pwned Passwords» a partir de unas 120 contraseñas) y vuelve a intentarlo sola si la red falla. El autocompletado del navegador también reconoce los campos de acceso de los sitios creados con componentes web, como Reddit, y los marcos de acceso de un subdominio del mismo sitio, como el de Ubisoft. Después de actualizar, recarga la extensión desde la página de extensiones del navegador.',
  ],
  'global-quick-search': [
    'Búsqueda rápida global',
    'Pulsa Ctrl+Shift+Space desde cualquier aplicación, incluso con Jesse’s Archive en el área de notificación, para abrir una ventana de búsqueda compacta: encuentra cuentas por nombre, usuario, correo o sitio, con las cuentas del mismo servicio agrupadas, y copia el usuario o la contraseña, muestra la contraseña unos segundos, abre el sitio o abre el elemento en el almacén, todo desde el teclado. Solo funciona con el almacén desbloqueado, las contraseñas se copian sin pasar por la ventana y el portapapeles se vacía como siempre. El atajo y las opciones están en Ajustes → Búsqueda rápida global.',
  ],
  'window-state': [
    'La ventana recuerda su tamaño y posición',
    'Jesse’s Archive se vuelve a abrir como lo dejaste: a pantalla completa, maximizado o con el tamaño y la posición que habías elegido, incluso después de pasar por la bandeja del sistema. Si la pantalla en la que estaba ya no está conectada, la ventana se abre en el centro de la disponible.',
  ],
  'customizable-dashboard': [
    'Panel personalizable',
    'El nuevo Panel es el centro de control de la aplicación: puntuación de seguridad, análisis de contraseñas, resumen de la bóveda, favoritos, elementos recientes, notas protegidas, acciones rápidas, generador, estado de la copia de seguridad y privacidad. Con «Personalizar panel» añades, quitas, arrastras y cambias el tamaño de los widgets, eliges entre varios diseños y ajustas las opciones de cada uno; todo se guarda solo en la bóveda cifrada y ningún widget muestra contraseñas.',
  ],
  multilanguage: [
    'Jesse’s Archive habla tu idioma',
    'Con el nuevo botón «Idioma» arriba a la derecha puedes elegir italiano, inglés, español, francés, alemán, portugués, ruso, chino, japonés o coreano. Toda la aplicación cambia al instante, incluidas la pantalla de desbloqueo, la miniventana del navegador y el menú del área de notificación; en el primer inicio se usa el idioma de Windows. El instalador y la extensión del navegador también siguen el idioma del sistema.',
  ],
  'installer-logo': [
    'Logotipo del instalador corregido',
    'Durante la instalación, el logotipo de arriba a la derecha ya no aparece aplastado: ahora es el logotipo de la aplicación, nítido y con las proporciones correctas incluso con la pantalla ampliada.',
  ],
  'webauthn-passkeys': [
    'Llaves de acceso en los sitios web',
    'Cuando un sitio ofrece una llave de acceso, Jesse’s Archive abre la miniventana: puedes guardarla en la bóveda cifrada y usarla para iniciar sesión, o elegir «Usar otro dispositivo» para el teléfono o Windows Hello. Cada uso necesita tu confirmación. Vuelve a cargar la extensión en el navegador después de actualizar; Firefox necesita la versión 128 o posterior. Se desactiva en Ajustes → Escritorio.',
  ],
  'auto-update': [
    'Actualizaciones automáticas',
    'La aplicación busca nuevas versiones al iniciar y una vez al día y te pregunta si quieres instalarlas: «Actualizar ahora» descarga el instalador, verifica la firma digital del autor y vuelve a abrir la aplicación actualizada. En Ajustes → Actualizaciones puedes buscarlas a mano o desactivar la comprobación automática.',
  ],
  'zoom-typed-min-max': [
    'Zoom a medida, mínimo y máximo',
    'En Ajustes → Apariencia puedes escribir el porcentaje de zoom que prefieras (de 50 a 200) y usar los dos nuevos botones para pasar directamente al zoom mínimo o máximo.',
  ],
  'interface-zoom': [
    'Zoom de la interfaz',
    'Amplía o reduce la aplicación con Ctrl + + y Ctrl + − (o Ctrl + F12 / Ctrl + F11 o Ctrl + rueda del ratón) y vuelve al 100% con Ctrl + 0. También está en Ajustes → Apariencia: vale para todas las ventanas y se recuerda en este PC.',
  ],
  'empty-trash': [
    'Vaciar papelera',
    'En la página Papelera, el botón «Vaciar papelera» elimina definitivamente todos los elementos de una vez, tras dos confirmaciones que muestran lo que se eliminará.',
  ],
  'settings-layout-installer-flow': [
    'Ajustes más compactos e instalación más cómoda',
    'Los paneles de Ajustes se colocan sin espacios vacíos. El instalador ofrece la casilla para iniciar la aplicación al terminar, y la guía de extensiones tiene el botón «He instalado la extensión», que la cierra y abre Jesse’s Archive.',
  ],
  'refresh-feedback-appearance': [
    'Botón Actualizar con resultado y nueva pestaña Apariencia',
    'El botón Actualizar muestra lo que ha hecho: si ha encontrado elementos nuevos, modificados o eliminados, o si todo estaba ya actualizado, y si hay problemas explica qué ha fallado. Los temas y colores de la aplicación tienen ahora su propia pestaña, Apariencia, en Ajustes.',
  ],
  'regroup-on-site-change': [
    'El sitio de una cuenta se actualiza al cambiarlo',
    'Si cambias el sitio web de una cuenta, en la colección aparece enseguida bajo el nuevo sitio en lugar de quedarse en el que pusiste al principio. Las entradas guardadas antes también se corrigen solas.',
  ],
  'delete-accounts-and-groups': [
    'Eliminación de cuentas, grupos y elementos',
    'Cada grupo de cuentas tiene el botón «Eliminar cuenta» para una sola cuenta y una papelera para eliminar todo el grupo, con doble confirmación que enumera lo que se eliminará. Los elementos de las demás categorías también se eliminan con un clic y una confirmación. Todo va a la Papelera, desde donde se puede restaurar.',
  ],
  'session-hardening': [
    'Bloqueo automático más fiable e importaciones más seguras',
    'La bóveda se bloquea de verdad tras el tiempo de inactividad elegido, incluso con la ventana oculta, y la pantalla se vacía. Teclado, clics y desplazamiento cuentan como actividad. Un archivo de importación con un solo elemento no válido se rechaza sin modificar la bóveda, y la longitud mínima de las contraseñas cuenta ahora correctamente las letras acentuadas.',
  ],
  'news-entry-timestamps': [
    'Fecha y hora en cada novedad y commit',
    'Cada entrada de las pestañas Novedades y Commits muestra abajo a la derecha su fecha y hora, en texto legible. Las horas se mantienen iguales de una compilación a otra.',
  ],
  'browser-site-matching': [
    'Cuentas reconocidas entre dominio y subdominios',
    'Las direcciones guardadas sin protocolo se reconocen y las cuentas se proponen también en las páginas de inicio de sesión de los subdominios del mismo sitio, como Epic Games Store. La comparación distingue los dominios ajenos y los servicios con subdominios independientes.',
  ],
  'browser-extension-navigation': [
    'Apertura correcta de la página de extensiones',
    'La guía abre una nueva ventana del navegador elegido y llega a su página de extensiones desde la barra de direcciones. Se han añadido una dirección para copiar y un botón para reintentar.',
  ],
  'browser-setup-wizard': [
    'Configuración guiada de los navegadores',
    'El instalador abre un asistente que detecta los navegadores, registra automáticamente la conexión local y abre la página y la carpeta para cargar la extensión. También está disponible en Ajustes.',
  ],
  'browser-quick-fill': [
    'Relleno rápido en los navegadores',
    'Atajo global personalizable, desbloqueo en una miniventana y selección de las cuentas para el dominio HTTPS actual mediante la extensión para Chromium o Firefox. Rellena los campos sin enviar el inicio de sesión.',
  ],
  'news-dialog': [
    'Novedades e historial de commits dentro de JesseArchive',
    'Se ha añadido el botón Noticias junto a «Protegido localmente»: dos pestañas, Novedades y Commits, con búsqueda, detalles de las revisiones e historial de Git consultable sin conexión.',
  ],
  'git-ready': [
    'Historial de Git y repositorio de GitHub',
    'Se ha preparado el repositorio con la historia reconstruida del proyecto, los mensajes de commit, las reglas para excluir bóvedas y archivos sensibles y las herramientas para publicar el código.',
  ],
  'generator-button': [
    'Botón Generar más grande',
    'El botón principal del generador de contraseñas es más grande, con texto y zona de clic más legibles incluso en ventanas pequeñas.',
  ],
  'beta-label': [
    'Fase Beta identificada',
    'Se ha añadido en Ajustes la etiqueta «Version: Beta», con el número tomado de la versión de la aplicación.',
  ],
  'version-file': [
    'Versión visible e instalador con nombre sencillo',
    'Se ha añadido el número de versión en Ajustes y se ha simplificado el nombre del instalador a JesseArchive-Setup.exe.',
  ],
  'installer-images': [
    'Gráficos del instalador corregidos',
    'Se usa el logotipo original de JesseArchive en la barra lateral y en la cabecera del instalador, manteniendo sus proporciones.',
  ],
  'installer-folder': [
    'Carpeta de instalación seleccionable',
    'Se ha añadido al instalador una pantalla para elegir la ruta de instalación y pasarla al paquete MSI.',
  ],
  'category-create': [
    'Nuevos elementos en la categoría correcta',
    'Desde Cuentas, Llaves de acceso, Notas, Tarjetas, Identidades y Cripto, el editor selecciona automáticamente el tipo de elemento; desde las vistas generales se puede seguir cambiando.',
  ],
  'inno-exe': [
    'Instalador EXE con Inno Setup',
    'Se ha añadido la distribución mediante un único instalador EXE que contiene el MSI de Tauri, evitando el problema de las macros NSIS encontrado en las compilaciones.',
  ],
  offline: [
    'Instalación en Windows también sin conexión',
    'El paquete MSI incluye WebView2 sin conexión, así que los demás PC no necesitan Node.js, Rust ni conexión para descargar el entorno de ejecución.',
  ],
  'msi-brand': [
    'Instalador MSI personalizado',
    'Se han añadido imágenes personalizadas en las pantallas del asistente MSI manteniendo el logotipo original de la aplicación.',
  ],
  cloud: [
    'Búsqueda mejorada de carpetas en la nube locales',
    'Se ha ampliado la detección de las carpetas de OneDrive, Dropbox y otros proveedores y se han añadido mensajes claros cuando la búsqueda no encuentra nada.',
  ],
  history: [
    'Recuperación desde el historial más clara',
    'Se ha sustituido el selector confuso por «Usar en cuenta»: eliges una contraseña archivada y confirmas qué cuenta local actualizar. Se ha añadido la firma de Instagram del desarrollador.',
  ],
  dialogs: [
    'Ventanas de confirmación con el estilo de la aplicación',
    'Se han sustituido las ventanas nativas de Windows y del navegador por diálogos acordes con los temas para eliminaciones, comprobaciones, importaciones y otras operaciones.',
  ],
  'clipboard-fixes': [
    'Correcciones en la gestión del portapapeles',
    'Se han resuelto incompatibilidades de Rust surgidas durante las pruebas del componente clipboard-win.',
  ],
  clipboard: [
    'Copiar contraseñas sin ventanas de CMD',
    'Se han eliminado los procesos de PowerShell usados para copiar y borrar contraseñas del portapapeles de Windows; se han añadido los iconos de ojo en las tarjetas de los grupos.',
  ],
  'theme-groups': [
    'Temas completos, logotipos y grupos de cuentas',
    'Se ha restaurado el logotipo original, se han introducido paletas completas y colores personalizables, grupos por sitio o aplicación con logotipos, se ha renombrado «Accesso» como «Cuenta» y se han mejorado las barras de desplazamiento.',
  ],
  recovery: [
    'Confirmación del código de recuperación corregida',
    'Se ha corregido el botón de confirmación del código de recuperación y se ha evitado que la ventana se cierre sin querer antes de confirmar.',
  ],
  'compat-fixture': [
    'Prueba de compatibilidad con la bóveda antigua',
    'Se ha corregido la ruta del archivo cifrado sintético usado para comprobar el descifrado del formato original de Python.',
  ],
  'rust-keys': [
    'Correcciones en las claves criptográficas de Rust',
    'Se han corregido incompatibilidades de tipos y lifetimes en la migración a Rust sin cambiar el formato de cifrado existente.',
  ],
  migration: [
    'Migración de Python a Rust y React',
    'Se ha creado el nuevo proyecto de escritorio para Windows basado en Rust, Tauri 2, React y TypeScript, compatible con el formato original de la bóveda.',
  ],
  legacy: [
    'Proyecto Python conservado',
    'Se ha conservado una copia del código Python original como referencia para la migración, sin incluir la bóveda personal en el repositorio.',
  ],
};

export default news;
