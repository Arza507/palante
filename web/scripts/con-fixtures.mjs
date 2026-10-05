// Ejecuta un comando con PALANTE_FIXTURES=1 en cualquier sistema operativo.
import { spawnSync } from 'node:child_process';

const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, PALANTE_FIXTURES: '1' } });
process.exit(r.status ?? 1);
