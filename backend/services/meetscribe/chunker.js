// Split extracted per-page text into overlapping chunks suitable for embedding.
// Character-based windows approximate tokens (~4 chars/token): the defaults of
// ~2800 chars / ~400 overlap ≈ 700 tokens / 100 overlap, per the design guide.
// Chunking is done per page so each chunk keeps an exact page number for
// citations.
function chunkPages(pages, { chunkChars = 2800, overlapChars = 400 } = {}) {
  const chunks = [];
  let chunkIndex = 0;

  for (const { page, text } of pages) {
    if (!text) continue;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    if (clean.length <= chunkChars) {
      chunks.push({ chunkIndex: chunkIndex++, pageNumber: page, content: clean });
      continue;
    }

    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkChars, clean.length);
      let slice = clean.slice(start, end);

      // Prefer to break on a word boundary (unless this is the final slice).
      if (end < clean.length) {
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > chunkChars * 0.6) slice = slice.slice(0, lastSpace);
      }

      const content = slice.trim();
      if (content) chunks.push({ chunkIndex: chunkIndex++, pageNumber: page, content });

      const consumed = slice.length;
      if (start + consumed >= clean.length) break;
      start = start + consumed - overlapChars;
      if (start < 0) start = 0;
    }
  }

  return chunks;
}

module.exports = { chunkPages };
