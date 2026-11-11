// Conexión a MySQL. DATABASE_URL tiene el formato:
//   mysql://USUARIO:CONTRASEÑA@localhost:3306/lab5_notas
const URL_POR_DEFECTO = 'mysql://root@localhost:3306/lab5_notas';

function urlBaseDeDatos() {
  return process.env.DATABASE_URL?.trim() || URL_POR_DEFECTO;
}

// Convierte la URL en las opciones del conector mariadb (compatible con MySQL).
function opcionesConexion(url = urlBaseDeDatos()) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
    // MySQL 8 usa caching_sha2_password; sin SSL necesita la clave pública del servidor.
    allowPublicKeyRetrieval: true,
    connectionLimit: 5,
  };
}

module.exports = { urlBaseDeDatos, opcionesConexion };
