import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Revisa con axe-core: cero errores serios o críticos (WCAG 2.2 AA). */
export async function sinErroresAxe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
