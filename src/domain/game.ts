export type GamePhase = "briefing" | "dive" | "museum" | "result";
export type LevelId = "salt-route" | "tidegate";
export type WorldVariant = "freighter" | "station";

export interface Evidence {
  id: string;
  code: string;
  name: string;
  tool: string;
  weight: number;
  description: string;
}

export interface ExhibitionClaim {
  id: string;
  label: string;
  title: string;
  description: string;
}

export interface ExhibitionOutcome {
  title: string;
  summary: string;
  visitorQuote: string;
  income: number;
  reputation: number;
  nextLead: string;
}

export interface DiveTarget {
  evidenceId: string;
  x: number;
  y: number;
}

export interface CurrentZone {
  x: number;
  y: number;
  width: number;
  height: number;
  forceX: number;
  forceY: number;
}

export interface JellyHazard {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
}

export interface VentHazard {
  x: number;
  y: number;
  width: number;
  height: number;
  period: number;
  activeFor: number;
  phase: number;
}

export interface GatePuzzle {
  x: number;
  top: number;
  bottom: number;
  consoleX: number;
  consoleY: number;
}

export interface DiveConfig {
  variant: WorldVariant;
  maxDepth: number;
  oxygenDrain: number;
  startX: number;
  startY: number;
  palette: {
    shallow: number;
    middle: number;
    deep: number;
    accent: number;
    glow: number;
  };
  targets: readonly DiveTarget[];
  currents: readonly CurrentZone[];
  jellies: readonly JellyHazard[];
  vents: readonly VentHazard[];
  gate?: GatePuzzle;
}

interface OutcomeRule {
  title: string;
  summary: string;
  visitorQuote: string;
  baseIncome: number;
  evidenceBonus: number;
  fullChainReputation: number;
  partialChainReputation: number;
  nextLead: string;
}

export interface LevelDefinition {
  id: LevelId;
  number: number;
  eyebrow: string;
  headline: string;
  description: string;
  location: string;
  depthLabel: string;
  era: string;
  signal: string;
  objective: string;
  quote: string;
  quoteBy: string;
  boardTitle: string;
  timelineLabel: string;
  timelineProgress: number;
  maxCargo: number;
  tools: readonly string[];
  evidence: readonly Evidence[];
  claims: readonly ExhibitionClaim[];
  outcomes: Readonly<Record<string, OutcomeRule>>;
  dive: DiveConfig;
}

export const MINIMUM_EVIDENCE = 2;

const SALT_ROUTE: LevelDefinition = {
  id: "salt-route",
  number: 1,
  eyebrow: "首次调查",
  headline: "今天打捞的，\n可能不是宝藏。",
  description:
    "浅海航道发现一艘沉没于海侵初期的民用运输船。官方记录称那是一场“有序撤离”，但船体位置与航线档案并不吻合。",
  location: "盐雾航道",
  depthLabel: "42 m",
  era: "海侵初期 · 312 年前",
  signal: "信号强度 73%",
  objective: "回收三件可验证证据",
  quote: "游客喜欢完整的故事。可惜历史通常不配合。",
  quoteBy: "馆长助理弥洛",
  boardTitle: "盐雾航道撤离事件",
  timelineLabel: "海侵初期",
  timelineProgress: 64,
  maxCargo: 6,
  tools: ["扫描仪", "密封箱", "微型切割器"],
  evidence: [
    {
      id: "salt-pass",
      code: "E-17 / 登船凭证",
      name: "疏散通行证",
      tool: "扫描仪",
      weight: 2,
      description: "票面写着“全体居民”，背面却盖有只向高信用等级开放的优先码。",
    },
    {
      id: "salt-ration",
      code: "R-08 / 冷藏货物",
      name: "未开封配给罐",
      tool: "密封箱",
      weight: 2,
      description: "生产日期比官方撤离结束晚九年，说明船只曾长期向封闭区域运送补给。",
    },
    {
      id: "salt-log",
      code: "B-02 / 航行记录",
      name: "舰桥黑匣子",
      tool: "微型切割器",
      weight: 2,
      description: "最后航线绕过公共避难港，驶向地图中不存在的“潮门站”。",
    },
  ],
  claims: [
    {
      id: "orderly",
      label: "A",
      title: "撤离是一场有序行动",
      description: "符合官方记录，商业风险较低。",
    },
    {
      id: "selective",
      label: "B",
      title: "撤离只服务于少数人",
      description: "证据尚不完整，但能解释航线冲突。",
    },
  ],
  outcomes: {
    orderly: {
      title: "《最后一班撤离船》已开放",
      summary:
        "官方叙事容易理解，首日客流表现很好；但团队认为展览回避了通行证等级与异常航线之间的冲突。",
      visitorQuote:
        "我们星球也曾把配给叫作‘全民保障’。后来才知道，全民只是一个印在海报上的词。",
      baseIncome: 148,
      evidenceBonus: 8,
      fullChainReputation: -1,
      partialChainReputation: -2,
      nextLead: "潮门避难站",
    },
    selective: {
      title: "《谁被允许离开》已开放",
      summary:
        "展览没有给出舒适的答案，却让游客第一次注意到撤离制度、秘密补给与潮门站之间的联系。",
      visitorQuote:
        "潮门站不是避难所的名字。在我的母语里，它更接近‘封锁某种东西的门’。",
      baseIncome: 104,
      evidenceBonus: 8,
      fullChainReputation: 4,
      partialChainReputation: 2,
      nextLead: "潮门避难站",
    },
  },
  dive: {
    variant: "freighter",
    maxDepth: 42,
    oxygenDrain: 0.64,
    startX: 88,
    startY: 84,
    palette: {
      shallow: 0x0f5260,
      middle: 0x082f3b,
      deep: 0x031820,
      accent: 0xf3c969,
      glow: 0x78dcc8,
    },
    targets: [
      { evidenceId: "salt-pass", x: 382, y: 394 },
      { evidenceId: "salt-ration", x: 652, y: 286 },
      { evidenceId: "salt-log", x: 812, y: 422 },
    ],
    currents: [
      { x: 165, y: 156, width: 240, height: 92, forceX: 24, forceY: 2 },
      { x: 522, y: 336, width: 218, height: 90, forceX: -19, forceY: -4 },
    ],
    jellies: [
      { x: 492, y: 205, radius: 24, phase: 0.3, drift: 13 },
      { x: 744, y: 162, radius: 21, phase: 2.1, drift: 17 },
      { x: 574, y: 454, radius: 23, phase: 4.4, drift: 10 },
    ],
    vents: [],
  },
};

const TIDEGATE: LevelDefinition = {
  id: "tidegate",
  number: 2,
  eyebrow: "第二调查",
  headline: "避难站的门，\n为什么从里面上锁？",
  description:
    "潮门站位于被官方地图抹去的断层边缘。外环仍有低频供能，内部压力喷口周期性启动；有人在文明灭亡后继续维护这里。",
  location: "潮门避难站",
  depthLabel: "78 m",
  era: "封锁时期 · 286 年前",
  signal: "反应堆余波 41%",
  objective: "开启隔离闸门并选择性回收证据",
  quote: "一扇门能保护两边。问题是，哪一边才是被保护的？",
  quoteBy: "异星语言学家奥罗",
  boardTitle: "潮门站封锁事件",
  timelineLabel: "封锁时期",
  timelineProgress: 78,
  maxCargo: 6,
  tools: ["脉冲扫描仪", "数据探针", "密封箱", "微型切割器"],
  evidence: [
    {
      id: "gate-ring",
      code: "C-11 / 居民识别",
      name: "儿童身份环",
      tool: "脉冲扫描仪",
      weight: 1,
      description: "身份环保存了 1,204 名儿童资料，但入站记录只有 48 条。其余记录被标注为“外部观察组”。",
    },
    {
      id: "gate-protocol",
      code: "Q-04 / 封锁协议",
      name: "隔离协议残片",
      tool: "微型切割器",
      weight: 2,
      description: "协议要求闸门在内部生命体征消失前不得开启，并明确禁止向外发送完整病理信息。",
    },
    {
      id: "gate-reactor",
      code: "P-31 / 动力日志",
      name: "反应堆冷却日志",
      tool: "数据探针",
      weight: 2,
      description: "官方宣称站点从未启用，但冷却系统在封锁令后持续运行了十七年。",
    },
    {
      id: "gate-roster",
      code: "A-09 / 离站名册",
      name: "管理层离站名册",
      tool: "密封箱",
      weight: 3,
      description: "十二名项目管理者在封锁前两小时离站；名单末尾印着一句荒诞备注：‘演练圆满完成。’",
    },
  ],
  claims: [
    {
      id: "elite-bunker",
      label: "A",
      title: "潮门站是精英的秘密避难所",
      description: "能解释离站名单，也更容易吸引公众。",
    },
    {
      id: "containment",
      label: "B",
      title: "潮门站真正用途是封锁某种灾难",
      description: "证据更危险，也会引来星际机构关注。",
    },
  ],
  outcomes: {
    "elite-bunker": {
      title: "《最后的特权避难所》已开放",
      summary:
        "展览迅速售罄，但‘避难所’解释无法说明内部上锁、长期冷却与被禁止外传的病理信息。团队关系开始紧张。",
      visitorQuote:
        "如果这里是给统治者准备的避难所，为什么最昂贵的门锁朝向里面？",
      baseIncome: 182,
      evidenceBonus: 10,
      fullChainReputation: 0,
      partialChainReputation: -2,
      nextLead: "深渊脉冲源",
    },
    containment: {
      title: "《门后没有幸存者》已开放",
      summary:
        "你把潮门站定义为一座主动维持多年的隔离设施。公众不喜欢这个答案，但多个异星文明开始提供相似灾难记录。",
      visitorQuote:
        "我们的祖先也封锁过一座城市。区别是，他们留下了警告；这里的人似乎害怕警告本身被读懂。",
      baseIncome: 128,
      evidenceBonus: 10,
      fullChainReputation: 6,
      partialChainReputation: 3,
      nextLead: "深渊脉冲源",
    },
  },
  dive: {
    variant: "station",
    maxDepth: 78,
    oxygenDrain: 0.76,
    startX: 82,
    startY: 108,
    palette: {
      shallow: 0x123a4d,
      middle: 0x071f31,
      deep: 0x020b14,
      accent: 0xff8f6b,
      glow: 0x78dcc8,
    },
    targets: [
      { evidenceId: "gate-ring", x: 244, y: 382 },
      { evidenceId: "gate-protocol", x: 654, y: 184 },
      { evidenceId: "gate-reactor", x: 824, y: 348 },
      { evidenceId: "gate-roster", x: 718, y: 448 },
    ],
    currents: [
      { x: 116, y: 256, width: 210, height: 70, forceX: 10, forceY: -15 },
      { x: 610, y: 116, width: 210, height: 74, forceX: -12, forceY: 8 },
    ],
    jellies: [{ x: 420, y: 392, radius: 20, phase: 1.2, drift: 18 }],
    vents: [
      { x: 584, y: 486, width: 54, height: 150, period: 4.2, activeFor: 1.45, phase: 0 },
      { x: 756, y: 486, width: 62, height: 170, period: 5.1, activeFor: 1.6, phase: 1.8 },
      { x: 884, y: 486, width: 48, height: 130, period: 3.8, activeFor: 1.2, phase: 0.9 },
    ],
    gate: {
      x: 510,
      top: 92,
      bottom: 470,
      consoleX: 390,
      consoleY: 168,
    },
  },
};

export const LEVELS: readonly LevelDefinition[] = [SALT_ROUTE, TIDEGATE] as const;

export function canCurate(level: LevelDefinition, evidenceIds: readonly string[]): boolean {
  const validIds = new Set(level.evidence.map((item) => item.id));
  return new Set(evidenceIds.filter((id) => validIds.has(id))).size >= MINIMUM_EVIDENCE;
}

export function scoreExhibition(
  level: LevelDefinition,
  claimId: string,
  evidenceIds: readonly string[],
): ExhibitionOutcome {
  if (!canCurate(level, evidenceIds)) {
    throw new Error("发布展览至少需要两件独立证据");
  }

  const rule = level.outcomes[claimId];
  if (!rule) {
    throw new Error(`未知展览主张：${claimId}`);
  }

  const validIds = new Set(level.evidence.map((item) => item.id));
  const evidenceCount = new Set(evidenceIds.filter((id) => validIds.has(id))).size;
  const complete = evidenceCount === level.evidence.length;

  return {
    title: rule.title,
    summary: rule.summary,
    visitorQuote: rule.visitorQuote,
    income: rule.baseIncome + evidenceCount * rule.evidenceBonus,
    reputation: complete ? rule.fullChainReputation : rule.partialChainReputation,
    nextLead: rule.nextLead,
  };
}
