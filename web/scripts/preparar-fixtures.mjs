// Prepara web/public-fixtures/: copia de public/ con los datos de prueba de fixtures/web/ encima.
// Solo para pruebas locales y CI. El resultado nunca se publica (el build normal usa public/).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('..', import.meta.url));
const destino = `${web}/public-fixtures`;
const fixtures = fileURLToPath(new URL('../../fixtures/web', import.meta.url));

rmSync(destino, { recursive: true, force: true });
cpSync(`${web}/public`, destino, { recursive: true });
if (existsSync(fixtures)) cpSync(fixtures, destino, { recursive: true });
console.log(`public-fixtures listo${existsSync(fixtures) ? ' con datos de prueba' : ' (sin datos de prueba)'}`);
