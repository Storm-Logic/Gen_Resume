import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import JSZip from 'jszip';

export const defaultStyle = { font: 'helvetica', nameSize: 23, bodySize: 10, headingSize: 9, accent: '#243949', alignment: 'left', divider: true, uppercaseHeadings: true, margin: 50, format: 'a4', template: 'simple' };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fontClass = family => /sans-serif/i.test(family || '') ? 'helvetica' : /times|georgia|garamond|cambria|serif/i.test(family || '') ? 'times' : /courier|consolas|mono/i.test(family || '') ? 'courier' : 'helvetica';
const hex = value => /^[0-9a-f]{6}$/i.test(value || '') && !/^(000000|ffffff)$/i.test(value) ? `#${value}` : null;
const median = values => { const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)]; };

export async function extractPdf(buffer) {
  let visual = null;
  const parsed = await pdfParse(buffer, { pagerender: async page => {
    const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
    const items = content.items.filter(item => item.str?.trim());
    if (!visual && items.length) {
      const view = page.view || [0, 0, 595, 842];
      const width = Math.abs(view[2] - view[0]);
      const height = Math.abs(view[3] - view[1]);
      const sizes = items.map(item => Math.round(Math.hypot(item.transform?.[2] || 0, item.transform?.[3] || 0) || item.height || 10)).filter(n => n >= 6 && n <= 36);
      const bodySize = sizes.length ? median(sizes) : 10;
      const topItems = items.filter(item => (item.transform?.[5] || 0) > height * .76);
      const nameSize = Math.max(bodySize + 5, ...topItems.map(item => Math.round(item.height || Math.hypot(item.transform?.[2] || 0, item.transform?.[3] || 0) || bodySize)));
      const first = topItems[0] || items[0];
      const firstX = first?.transform?.[4] || 50;
      const centered = Math.abs(firstX + (first?.width || 0)/2 - width/2) < width * .12;
      const xs = items.map(item => item.transform?.[4]).filter(x => Number.isFinite(x) && x > 12 && x < width/2);
      const margin = xs.length ? Math.min(...xs) : 50;
      const fontCounts = new Map();
      items.forEach(item => { const family = content.styles?.[item.fontName]?.fontFamily || item.fontName; if (family) fontCounts.set(family, (fontCounts.get(family) || 0) + 1); });
      const family = [...fontCounts].sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
      const text = items.map(item => item.str.trim()).join(' ');
      const boxed = centered && /EMPLOYMENT HISTORY/.test(text) && /TECHNICAL SKILLS/.test(text);
      visual = { ...defaultStyle, font: fontClass(family), nameSize: clamp(nameSize, 16, 30), bodySize: clamp(bodySize, 8, 12), headingSize: clamp(bodySize, 8, 12), accent: '#242424', alignment: centered ? 'center' : 'left', divider: false, uppercaseHeadings: /\b(EXPERIENCE|EDUCATION|SKILLS|SUMMARY|PROFILE)\b/.test(text), margin: clamp(Math.round(margin), 36, 72), format: Math.abs(width-612) < Math.abs(width-595) ? 'letter' : 'a4', template: boxed ? 'boxed' : 'simple' };
    }
    let lastY;
    return items.map(item => {
      const currentY = Math.round(item.transform?.[5] || 0);
      const separator = lastY === undefined ? '' : Math.abs(currentY-lastY) > 2 ? '\n' : ' ';
      lastY = currentY;
      return separator + item.str;
    }).join('');
  } });
  if (visual && buffer.includes(Buffer.from('LiberationSerif'))) visual.font = 'liberation';
  return { text: parsed.text, style: visual || defaultStyle };
}

const firstMatch = (xml, expression) => xml.match(expression)?.[1];
export async function extractDocx(buffer) {
  const text = (await mammoth.extractRawText({ buffer })).value;
  const zip = await JSZip.loadAsync(buffer);
  const document = await zip.file('word/document.xml')?.async('string') || '';
  const styles = await zip.file('word/styles.xml')?.async('string') || '';
  const theme = await zip.file('word/theme/theme1.xml')?.async('string') || '';
  const combined = `${document}\n${styles}`;
  const fontName = firstMatch(combined, /<w:rFonts\b[^>]*w:ascii="([^"]+)"/) || firstMatch(theme, /<a:latin\b[^>]*typeface="([^"]+)"/) || '';
  const sizes = [...combined.matchAll(/<w:sz\b[^>]*w:val="(\d+)"/g)].map(match => Number(match[1])/2).filter(n=>n>=7&&n<=36);
  const bodySize = sizes.length ? median(sizes) : 10;
  const nameSize = sizes.length ? Math.max(...sizes.slice(0, 12), bodySize+5) : 23;
  const rawColors = [...combined.matchAll(/<w:color\b[^>]*w:val="([0-9a-fA-F]{6})"/g)].map(match => hex(match[1])).filter(Boolean);
  const accent = rawColors[0] || '#242424';
  const marginTwips = Number(firstMatch(document, /<w:pgMar\b[^>]*w:left="(\d+)"/));
  const widthTwips = Number(firstMatch(document, /<w:pgSz\b[^>]*w:w="(\d+)"/));
  const firstParagraph = firstMatch(document, /(<w:p\b[\s\S]*?<\/w:p>)/) || '';
  const centered = /<w:jc\b[^>]*w:val="center"/.test(firstParagraph);
  const divider = /<w:pBdr\b/.test(combined);
  return { text, style: { ...defaultStyle, font: fontClass(fontName), nameSize: clamp(nameSize, 16, 30), bodySize: clamp(bodySize, 8, 12), headingSize: clamp(bodySize, 8, 12), accent, alignment: centered ? 'center' : 'left', divider, uppercaseHeadings: /\b(EXPERIENCE|EDUCATION|SKILLS|SUMMARY|PROFILE)\b/.test(text), margin: marginTwips ? clamp(Math.round(marginTwips/20), 36, 72) : 50, format: widthTwips && widthTwips < 12000 ? 'letter' : 'a4' } };
}
