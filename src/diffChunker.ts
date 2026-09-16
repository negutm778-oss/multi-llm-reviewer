const IGNORED_EXTENSIONS = [
  '.lock', '-lock.json', '.svg', '.png', '.jpg', '.jpeg', 
  '.gif', '.min.js', '.min.css', '.map', '.pdf', '.ico'
];

export function parseAndChunkDiff(rawDiff: string, maxChunkCharLength: number = 12000): string[] {
  const files: string[] = rawDiff.split(/^diff --git /m).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const fileDiff of files) {
    const fullFileDiff = 'diff --git ' + fileDiff;
    const match = fullFileDiff.match(/--- a\/(.*?)\n\+\+\+ b\/(.*?)\n/);
    const fileName = match ? match[2] : '';

    if (IGNORED_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
      continue;
    }

    let processedDiff = fullFileDiff;
    if (processedDiff.length > maxChunkCharLength) {
      processedDiff = processedDiff.slice(0, maxChunkCharLength) + '\n... [Diff trunchiat din cauza dimensiunii mărginite]';
    }

    if ((currentChunk.length + processedDiff.length) > maxChunkCharLength) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = processedDiff;
    } else {
      currentChunk += '\n' + processedDiff;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}