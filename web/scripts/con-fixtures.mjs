// Ejecuta un comando con PALANTE_FIXTURES=1 y PUBLIC_RUTAS=true (datos de prueba de rutas) en cualquier sistema.
import { spawnSync } from 'node:child_process';

const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, PALANTE_FIXTURES: '1', PUBLIC_RUTAS: 'true' } });
process.exit(r.status ?? 1);
