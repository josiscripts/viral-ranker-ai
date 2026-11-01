// Renders the design layer of the preview canvas (titles, highlighted words, rank
// list, shading over the video) to a transparent PNG at export size, so the
// exported video shows exactly what the preview shows. No library: the canvas is
// cloned with its computed styles inlined, wrapped in an SVG <foreignObject> and
// drawn on a <canvas>. The <video> itself is left out; the server draws the clip.

export const OVERLAY_SIZE = { width: 1080, height: 1920 };

// An SVG image cannot load web fonts, so Inter (loaded from Google Fonts in
// index.html) is embedded as data URLs. Only the Latin faces are kept.
let embeddedFontCss: Promise<string> | null = null;

const toDataUrl = async (url: string): Promise<string> => {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const loadEmbeddedFontCss = (): Promise<string> => {
  if (!embeddedFontCss) {
    embeddedFontCss = (async () => {
      const link = document.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com"]');
      if (!link) return '';
      const css = await (await fetch(link.href)).text();
      const faces = (css.match(/@font-face\s*{[^}]*}/g) || []).filter(face => /unicode-range:[^;]*U\+0000-00FF/.test(face));
      const embedded = await Promise.all(faces.map(async face => {
        const url = face.match(/url\((https:[^)]+)\)/)?.[1];
        return url ? face.replace(url, await toDataUrl(url)) : '';
      }));
      return embedded.join('\n');
    })().catch(error => {
      // Without Inter the layer still renders, with the browser's fallback font
      console.warn('[EXPORT] Could not embed the preview font:', error);
      embeddedFontCss = null;
      return '';
    });
  }
  return embeddedFontCss;
};

const inlineComputedStyles = (source: Element, target: Element) => {
  const computed = getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  for (let i = 0; i < computed.length; i++) {
    const property = computed[i];
    style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
  for (let i = 0; i < source.children.length; i++) {
    inlineComputedStyles(source.children[i], target.children[i]);
  }
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The design layer could not be rendered'));
    image.src = src;
  });

export async function renderOverlayPng(canvasElement: HTMLElement): Promise<Blob> {
  const fontCss = await loadEmbeddedFontCss();
  const { width, height } = canvasElement.getBoundingClientRect();

  const clone = canvasElement.cloneNode(true) as HTMLElement;
  inlineComputedStyles(canvasElement, clone);
  clone.querySelectorAll('video').forEach(video => video.remove());
  // The background color is drawn by the server around the video
  clone.style.backgroundColor = 'transparent';
  clone.style.margin = '0';

  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style>${fontCss}</style>${markup}</div></foreignObject></svg>`;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  await image.decode();

  const output = document.createElement('canvas');
  output.width = OVERLAY_SIZE.width;
  output.height = OVERLAY_SIZE.height;
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  context.drawImage(image, 0, 0, OVERLAY_SIZE.width, OVERLAY_SIZE.height);

  return new Promise((resolve, reject) => {
    output.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The design layer could not be encoded'))), 'image/png');
  });
}
