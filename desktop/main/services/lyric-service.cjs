function parseLrc(rawLyrics) {
  const rows = String(rawLyrics || '').split(/\r?\n/);
  const lines = [];
  const timePattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const row of rows) {
    const matches = [...row.matchAll(timePattern)];
    const text = row.replace(timePattern, '').trim();
    if (!matches.length || !text) continue;

    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = Number((match[3] || '0').padEnd(3, '0'));
      lines.push({
        time: minutes * 60 + seconds + fraction / 1000,
        text,
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function getCurrentLyricLine(lines, currentTime) {
  if (!Array.isArray(lines) || !lines.length) return null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (currentTime >= lines[index].time) return lines[index];
  }
  return lines[0];
}

module.exports = { parseLrc, getCurrentLyricLine };
