export function checkedChecklistItems(markdown: string): ReadonlySet<string> {
  const items = new Set<string>();
  let currentItem: string | null = null;

  function finishItem() {
    if (currentItem !== null) {
      items.add(currentItem.replace(/\s+/g, ' ').trim());
      currentItem = null;
    }
  }

  for (const line of markdown.split(/\r?\n/)) {
    const checkbox = /^- \[([ x])\] (.*)$/.exec(line);
    if (checkbox) {
      finishItem();
      currentItem = checkbox[1] === 'x' ? (checkbox[2] ?? '') : null;
    } else if (currentItem !== null && /^\s{2,}\S/.test(line)) {
      currentItem += ` ${line.trim()}`;
    } else {
      finishItem();
    }
  }

  finishItem();
  return items;
}
