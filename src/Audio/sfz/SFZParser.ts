/**
 * SFZParser.ts — SFZ 文本解析器
 *
 * 只做结构解析：header 划分 + opcode 提取。不做任何乐器语义解释。
 *
 * 支持：<global> <group> <region> <control>
 * 忽略（记录 warning）：<master> <curve> <effect> 等未实现的 header
 *
 * 注释：双斜杠行注释、C 风格块注释、以及 `//+ Key: Value` 元数据。
 */

import {
  type OpcodeMap,
  type SFZDocument,
  type SFZGroupRaw,
  type SFZRegionRaw,
} from './SFZTypes';

/** `<region>` / `<group>` 等 header */
const HEADER_RE = /^<\s*([a-zA-Z_][\w-]*)\s*>/;
/**
 * 一行里可以写多个 opcode（真实音源大量使用 `lokey=35 hikey=38`）。
 * 值可以是带引号的字符串，或一个不含空白的 token。
 */
const OPCODE_PAIR_RE = /([a-zA-Z_][\w$]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
/** `//+ Name: FSS Steel String Guitar` */
const METADATA_RE = /^\s*\/\/\+\s*([A-Za-z][\w ]*?)\s*:\s*(.+?)\s*$/;

/** 去掉双斜杠行注释与 C 风格块注释。逐行处理，不会影响 sample 的值。 */
function stripComments(text: string): string {
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

/** 提取一行里的所有 `key=value` 对。 */
function extractOpcodes(line: string): [string, string][] {
  const pairs: [string, string][] = [];
  OPCODE_PAIR_RE.lastIndex = 0;
  let match = OPCODE_PAIR_RE.exec(line);
  while (match !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    pairs.push([match[1].toLowerCase(), value]);
    match = OPCODE_PAIR_RE.exec(line);
  }
  return pairs;
}

/**
 * 解析 SFZ 文本。
 *
 * 注意 sample 的路径解析不在这里完成 —— 这里保存的 `sample=` 值是 SFZ 中的原始相对路径。
 */
export function parseSFZ(text: string): SFZDocument {
  const metadata: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = METADATA_RE.exec(line);
    if (m) metadata[m[1].trim().toLowerCase()] = m[2].trim();
  }

  const doc: SFZDocument = {
    globals: new Map(),
    controls: new Map(),
    groups: [],
    metadata,
    warnings: [],
  };

  let currentGroup: SFZGroupRaw | null = null;
  /** opcode 落点：当前 header 的 map。未进入任何 header 时丢弃并警告。 */
  let currentOpcodes: OpcodeMap | null = null;
  let currentRegion: SFZRegionRaw | null = null;

  const lines = stripComments(text).split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const lineNo = i + 1;

    const header = HEADER_RE.exec(line);
    if (header) {
      const name = header[1].toLowerCase();
      currentRegion = null;
      switch (name) {
        case 'global':
          currentOpcodes = doc.globals;
          break;
        case 'control':
          // 新的 <control> 只重置 default_path，其余保持
          doc.controls.delete('default_path');
          currentOpcodes = doc.controls;
          break;
        case 'group':
          currentGroup = { opcodes: new Map(), regions: [], line: lineNo };
          doc.groups.push(currentGroup);
          currentOpcodes = currentGroup.opcodes;
          break;
        case 'region': {
          if (!currentGroup) {
            currentGroup = { opcodes: new Map(), regions: [], line: lineNo };
            doc.groups.push(currentGroup);
          }
          currentRegion = { opcodes: new Map(), line: lineNo };
          currentGroup.regions.push(currentRegion);
          currentOpcodes = currentRegion.opcodes;
          break;
        }
        default:
          doc.warnings.push(`Unsupported header <${name}> at line ${lineNo}; opcodes ignored`);
          currentOpcodes = null;
          break;
      }
      continue;
    }

    const pairs = extractOpcodes(line);
    if (pairs.length > 0) {
      if (!currentOpcodes) {
        doc.warnings.push(`Opcode outside of any header at line ${lineNo}: ${line}`);
        continue;
      }
      for (const [name, value] of pairs) currentOpcodes.set(name, value);
      continue;
    }

    doc.warnings.push(`Unrecognized line ${lineNo}: ${line}`);
  }

  return doc;
}

/** 统计所有 region 数量（含被 Adapter 丢弃前的原始数量）。 */
export function countRegions(doc: SFZDocument): number {
  let n = 0;
  for (const g of doc.groups) n += g.regions.length;
  return n;
}
