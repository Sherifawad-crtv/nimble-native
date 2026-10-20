import { Fragment, type ReactNode } from 'react';
import { Text } from 'react-native';
import { T } from '../ui';
import { color, font } from '../ui/theme';

/** Inline: **bold**, *italic* and `code`. Anything unmatched stays as typed. */
function inline(text: string, key: string): ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <Text key={k} style={{ fontFamily: font.sansSemi }}>{part.slice(2, -2)}</Text>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <Text key={k} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <Text key={k} style={{ fontFamily: font.sansMedium, backgroundColor: color.surfaceControl }}> {part.slice(1, -1)} </Text>;
    return part;
  });
}

/** The few Markdown shapes the assistant writes: paragraphs, bullet and numbered lists, bold, italic and code. */
export function Md({ text }: { text: string }) {
  // While text is still arriving, close a dangling ** so it never flashes as raw asterisks.
  const safe = (text.match(/\*\*/g)?.length ?? 0) % 2 ? `${text}**` : text;
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <T key={blocks.length} variant="body" style={{ marginBottom: 4 }}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {i ? '\n' : null}
              {inline(l, `p${blocks.length}-${i}`)}
            </Fragment>
          ))}
        </T>,
      );
    }
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const ordered = list.ordered;
    blocks.push(
      <T key={blocks.length} variant="body" style={{ marginBottom: 4 }}>
        {items.map((it, i) => (
          <Fragment key={i}>
            {i ? '\n' : null}
            {ordered ? `${i + 1}. ` : '•  '}
            {inline(it, `l${blocks.length}-${i}`)}
          </Fragment>
        ))}
      </T>,
    );
    list = null;
  };

  for (const raw of safe.split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '').trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const number = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || number) {
      flushPara();
      const ordered = !!number;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? number)![1] as string);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}
