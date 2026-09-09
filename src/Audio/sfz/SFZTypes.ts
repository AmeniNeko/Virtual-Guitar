/**
 * SFZTypes.ts — SFZ 原始解析结果
 *
 * Parser 只负责把文本拆成 header / opcode 结构，不做任何乐器语义解释。
 * 语义解释（key 展开、根音、dB→线性等）属于 InstrumentAdapter。
 */

/** 单个 opcode 表。值统一为字符串，解释交给 Adapter。 */
export type OpcodeMap = Map<string, string>;

export interface SFZRegionRaw {
  opcodes: OpcodeMap;
  /** region 头所在行号（1 起，便于报错） */
  line: number;
}

export interface SFZGroupRaw {
  opcodes: OpcodeMap;
  regions: SFZRegionRaw[];
  line: number;
}

export interface SFZDocument {
  /** 所有 <global> 合并后的最终状态 */
  globals: OpcodeMap;
  /** <control> opcode（default_path 等） */
  controls: OpcodeMap;
  groups: SFZGroupRaw[];
  /** `//+ Name: ...` 形式的注释元数据 */
  metadata: Record<string, string>;
  /** 解析过程中的非致命问题 */
  warnings: string[];
}

/**
 * 合并 global / group / region 的 opcode。
 *
 * 关键语义：同级 header 之间 **不继承**。
 * - 新的 <group> 回退到 <global> 默认值（不是上一个 group）
 * - 新的 <region> 回退到 <group> + <global>（不是上一个 region）
 *
 * 这条规则由这四套音源强制要求：若 group 级 opcode 持续继承，
 * 电吉他音源中 `lovel=93` 会继承前一个 group 的 `hivel=92`，
 * 得到空区间，所有强力度层将永久静音。
 */
export function resolveOpcodes(
  globals: OpcodeMap,
  group: OpcodeMap | null,
  region: OpcodeMap | null,
): OpcodeMap {
  const merged: OpcodeMap = new Map(globals);
  if (group) for (const [k, v] of group) merged.set(k, v);
  if (region) for (const [k, v] of region) merged.set(k, v);
  return merged;
}

/** 读取数值 opcode，缺失或非法时返回 fallback。 */
export function numOpcode(map: OpcodeMap, key: string, fallback: number): number {
  const raw = map.get(key);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** 读取字符串 opcode。 */
export function strOpcode(map: OpcodeMap, key: string): string | undefined {
  const raw = map.get(key);
  return raw === undefined ? undefined : raw;
}
