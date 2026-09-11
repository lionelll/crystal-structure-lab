import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultSettings, modules, type CrystalType } from '../data/crystals';
import { ControlPanel } from './ControlPanel';

const noop = () => {};

function renderPanel(crystal: CrystalType) {
  return renderToStaticMarkup(
    <ControlPanel
      family="metal"
      activeModule="cell"
      crystal={crystal}
      ionicCrystal="cscl"
      settings={defaultSettings}
      onFamilyChange={noop}
      onCrystalChange={noop}
      onIonicCrystalChange={noop}
      onModuleChange={noop}
      onSettingsChange={noop}
    />,
  );
}

describe('metal module visibility', () => {
  it.each<CrystalType>(['FCC', 'BCC'])('retains the drawing module for %s', (crystal) => {
    const markup = renderPanel(crystal);
    for (const item of modules) expect(markup).toContain(`<span>${item.title}</span>`);
  });

  it('omits only the drawing module for HCP', () => {
    const markup = renderPanel('HCP');
    for (const item of modules) {
      const label = `<span>${item.title}</span>`;
      if (item.id === 'drawing') expect(markup).not.toContain(label);
      else expect(markup).toContain(label);
    }
  });
});
