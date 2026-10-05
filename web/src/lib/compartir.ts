/** Comparte con la Web Share API; si falla por algo distinto a cancelar, abre WhatsApp. */
export async function compartir(title: string, text: string, url: string, respaldo: string): Promise<void> {
  try {
    await navigator.share({ title, text, url });
  } catch (err) {
    if ((err as DOMException)?.name !== 'AbortError') window.open(respaldo, '_blank', 'noopener');
  }
}

/** Enlace de WhatsApp con texto y URL. */
export function enlaceWhatsApp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`;
}
