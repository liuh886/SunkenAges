export type GamePhase = "briefing" | "dive" | "museum" | "result";
export type ExhibitionClaim = "orderly" | "selective";

export interface Evidence {
  id: string;
  code: string;
  name: string;
  tool: string;
  weight: number;
  description: string;
}

export interface ExhibitionOutcome {
  title: string;
  summary: string;
  visitorQuote: string;
  income: number;
  reputation: number;
}

export const MINIMUM_EVIDENCE = 2;

export const EVIDENCE: readonly Evidence[] = [
  {
    id: "pass",
    code: "E-17 / 登船凭证",
    name: "疏散通行证",
    tool: "扫描仪",
    weight: 2,
    description: "票面写着“全体居民”，背面却盖有只向高信用等级开放的优先码。",
  },
  {
    id: "ration",
    code: "R-08 / 冷藏货物",
    name: "未开封配给罐",
    tool: "密封箱",
    weight: 2,
    description: "生产日期比官方撤离结束晚九年，说明船只曾长期向封闭区域运送补给。",
  },
  {
    id: "log",
    code: "B-02 / 航行记录",
    name: "舰桥黑匣子",
    tool: "微型切割器",
    weight: 2,
    description: "最后航线绕过公共避难港，驶向地图中不存在的“潮门站”。",
  },
] as const;

export function canCurate(evidenceIds: readonly string[]): boolean {
  return new Set(evidenceIds).size >= MINIMUM_EVIDENCE;
}

export function scoreExhibition(
  claim: ExhibitionClaim,
  evidenceIds: readonly string[],
): ExhibitionOutcome {
  const evidenceCount = new Set(evidenceIds).size;

  if (!canCurate(evidenceIds)) {
    throw new Error("发布展览至少需要两件独立证据");
  }

  if (claim === "orderly") {
    return {
      title: "《最后一班撤离船》已开放",
      summary:
        "官方叙事容易理解，首日客流表现很好；但团队认为展览回避了通行证等级与异常航线之间的冲突。",
      visitorQuote:
        "我们星球也曾把配给叫作‘全民保障’。后来才知道，全民只是一个印在海报上的词。",
      income: 148 + evidenceCount * 8,
      reputation: evidenceCount === 3 ? -1 : -2,
    };
  }

  return {
    title: "《谁被允许离开》已开放",
    summary:
      "展览没有给出舒适的答案，却让游客第一次注意到撤离制度、秘密补给与潮门站之间的联系。",
    visitorQuote:
      "潮门站不是避难所的名字。在我的母语里，它更接近‘封锁某种东西的门’。",
    income: 104 + evidenceCount * 8,
    reputation: evidenceCount === 3 ? 4 : 2,
  };
}
