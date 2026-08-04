import { describe, expect, it } from 'vitest';
import { pwaManifest } from '../src/pwaManifest';

describe('pwaManifest', () => {
  it('has the correct name and short_name', () => {
    expect(pwaManifest.name).toBe('Rondo');
    expect(pwaManifest.short_name).toBe('Rondo');
  });

  it('displays standalone, in portrait, scoped to the whole app', () => {
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.orientation).toBe('portrait');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.scope).toBe('/');
  });

  it('uses the real theme colors, not invented ones', () => {
    expect(pwaManifest.theme_color).toBe('#0B0D0F');
    expect(pwaManifest.background_color).toBe('#0B0D0F');
  });

  it('is tagged for Argentine Spanish', () => {
    expect(pwaManifest.lang).toBe('es-AR');
  });

  it('includes the required icon sizes and a maskable icon', () => {
    const icons = pwaManifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '180x180')).toBe(true);
  });

  it('describes the app in Spanish', () => {
    expect(pwaManifest.description).toBe('Organizá partidos, invitá jugadores y coordiná con tu equipo.');
  });
});
