# Cortes · registro de cortes de pelo (Yeray y Jan)

Web estática (GitHub Pages) + Google Sheet como base de datos + Apps Script como mini-API.

```
Móvil  --fetch-->  Apps Script (Web App)  -->  Google Sheet
```

## Probar en local (modo demo)
Con `API_URL` vacío en `config.js` la web funciona con datos de prueba guardados en el navegador. PIN: `1234`.

```bash
python3 -m http.server 8000   # y abre http://localhost:8000
```

## Puesta en marcha

### 1. Crear el Sheet y el script
1. Crea un Google Sheet nuevo (en el Drive del dueño del negocio) y llámalo `Cortes`.
2. **Extensiones → Apps Script**. Borra lo que haya y pega todo `apps-script/Code.gs`. Guarda.
3. En el desplegable de funciones elige **`setup`** y pulsa **Ejecutar**. Acepta los permisos
   (Google avisará de "app no verificada": *Avanzado → Ir a … (no seguro)*, es tu propio script).
   Esto crea las hojas `Cortes`, `Resumen` y `Config`, con formato y fórmulas.
4. **Cambiar el PIN** (por defecto `1234`): en `setPin()` cambia `NUEVO_PIN` y ejecútala.

### 2. Publicar la API
1. **Implementar → Nueva implementación → tipo "Aplicación web"**.
2. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier persona**.
3. Copia la URL (termina en `/exec`) y pégala en `config.js`:
   ```js
   window.CORTES_CONFIG = { API_URL: "https://script.google.com/macros/s/XXXX/exec" };
   ```
> Cada vez que cambies `Code.gs` hay que hacer **Implementar → Gestionar implementaciones → editar → Nueva versión**.

### 3. Subir a GitHub Pages
La carpeta `Website-Templates-master/` (428 MB) NO se sube: ya está en `.gitignore`.
```bash
git init && git add . && git commit -m "Cortes"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cortes.git
git push -u origin main
```
En GitHub: **Settings → Pages → Deploy from a branch → `main` / root**. La web queda en `https://TU_USUARIO.github.io/cortes/`.

En el móvil: abrir la URL → menú del navegador → **Añadir a pantalla de inicio**.

## Precio automático
En **Ajustes** (rueda dentada) se fija el *precio habitual*; se guarda en `Config!B4` del Sheet y es el mismo para los dos.
Al apuntar un corte el precio aparece ya puesto. Si lo cambias, solo afecta a ese corte; el siguiente vuelve al habitual.

## Cómo funciona
- El PIN se pide una vez y se guarda en el móvil. Va en cada petición y el script rechaza las que no lo traen bien.
  El PIN se guarda en las propiedades del script, no en el Sheet.
- Los cortes en **Conjunto** se reparten según `Config!B3` (por defecto 50/50).
- El Sheet es privado: solo lo ven las cuentas con las que lo compartas. Yeray y Jan no necesitan cuenta de Google para usar la web.
- Conviene compartir el Sheet con una segunda cuenta como copia de seguridad.

## Seguridad (honestamente)
La URL del script está en el código público de la web. El PIN frena a curiosos, no es seguridad fuerte.
No guardes datos sensibles (solo nombres de pila e importes).

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html`, `style.css`, `app.js` | La web (estilo barbería) |
| `assets/fa/` | Iconos Font Awesome, copiados de la plantilla `beauty-salon-bootstrap-html5-template` |
| `config.js` | URL de la API |
| `manifest.json`, `icon.svg` | Instalable en el móvil |
| `apps-script/Code.gs` | Backend + `setup()` que crea el Sheet |
