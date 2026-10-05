import type { APIRoute, GetStaticPaths } from 'astro';
import { paginasOg } from '../../og/paginas';
import { renderOg, type DatosOg } from '../../og/render';

export const getStaticPaths = (async () =>
  (await paginasOg()).map((p) => ({ params: { slug: p.slug }, props: p }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(props as DatosOg)), { headers: { 'Content-Type': 'image/png' } });
