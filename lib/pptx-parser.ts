import JSZip from "jszip";

export interface Slide {
  index: number;
  text: string;
  notes: string;
}

export interface ParsedDeck {
  slideCount: number;
  slides: Slide[];
  combinedText: string;
}

function extractText(xml: string): string {
  const textNodeRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = textNodeRe.exec(xml)) !== null) {
    const t = decodeXml(m[1]).trim();
    if (t) parts.push(t);
  }
  return parts.join(" ");
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function slideOrderKey(name: string): number {
  const m = name.match(/slide(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 9999;
}

export async function parsePptx(buffer: ArrayBuffer): Promise<ParsedDeck> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideOrderKey(a) - slideOrderKey(b));

  const slides = await Promise.all(
    slideFiles.map(async (name) => {
      const idx = slideOrderKey(name);
      const slideXml = await zip.files[name].async("string");
      const text = extractText(slideXml);

      const notesName = `ppt/notesSlides/notesSlide${idx}.xml`;
      let notes = "";
      if (zip.files[notesName]) {
        const notesXml = await zip.files[notesName].async("string");
        notes = extractText(notesXml);
      }

      return { index: idx, text, notes };
    }),
  );

  const combinedText = slides
    .map((s) => {
      const body = s.text || "(空白)";
      const note = s.notes ? `\n[备注] ${s.notes}` : "";
      return `=== Slide ${s.index} ===\n${body}${note}`;
    })
    .join("\n\n");

  return { slideCount: slides.length, slides, combinedText };
}
