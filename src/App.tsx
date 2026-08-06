import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type PointerEvent,
} from "react";

import {
  LEVELS,
  canCurate,
  scoreExhibition,
  type ExhibitionOutcome,
  type GamePhase,
  type LevelDefinition,
  type LevelId,
} from "./domain/game";
import type {
  DiveController,
  DiveDirection,
  DiveHud,
  DiveResult,
} from "./game/runtime";
import { InstallButton } from "./pwa/InstallButton";
import { ReloadPrompt } from "./pwa/ReloadPrompt";

function initialHud(level: LevelDefinition): DiveHud {
  return {
    oxygen: 100,
    cargo: 0,
    depth: 4,
    recovered: 0,
    total: level.evidence.length,
  };
}

function loadCompletedLevels(): LevelId[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem("sunken-ages-completed") ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is LevelId => LEVELS.some((level) => level.id === id))
      : [];
  } catch {
    return [];
  }
}

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<GamePhase>("briefing");
  const [levelIndex, setLevelIndex] = useState(0);
  const [day, setDay] = useState(3);
  const [credits, setCredits] = useState(240);
  const [reputation, setReputation] = useState(12);
  const [completedLevels, setCompletedLevels] = useState<LevelId[]>(loadCompletedLevels);
  const level = LEVELS[levelIndex];
  const [hud, setHud] = useState<DiveHud>(() => initialHud(level));
  const [recovered, setRecovered] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [claimId, setClaimId] = useState(level.claims[0].id);
  const [outcome, setOutcome] = useState<ExhibitionOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem("sunken-ages-completed", JSON.stringify(completedLevels));
  }, [completedLevels]);

  const resetLevelState = (nextLevel: LevelDefinition) => {
    setHud(initialHud(nextLevel));
    setRecovered([]);
    setSelected([]);
    setClaimId(nextLevel.claims[0].id);
    setOutcome(null);
  };

  const selectLevel = (index: number) => {
    const nextLevel = LEVELS[index];
    setLevelIndex(index);
    resetLevelState(nextLevel);
    setNotice(index === 1 ? "潮门站可直接体验；建议先完成盐雾航道以理解证据链。" : null);
    setPhase("briefing");
  };

  const startDive = () => {
    resetLevelState(level);
    setNotice(null);
    setPhase("dive");
  };

  const finishDive = (result: DiveResult) => {
    setRecovered(result.recovered);
    setSelected(result.recovered);

    if (canCurate(level, result.recovered)) {
      setNotice(result.forced ? "救援浮标已将证据送回修复室。" : null);
      setPhase("museum");
    } else {
      setNotice("本次下潜没有取得足够的独立证据，展览无法立项。可以调整路线后再次下潜。");
      setPhase("briefing");
    }
  };

  const publish = () => {
    const result = scoreExhibition(level, claimId, selected);
    setOutcome(result);
    setCredits((value) => value + result.income);
    setReputation((value) => value + result.reputation);
    setCompletedLevels((items) => [...new Set([...items, level.id])]);
    setPhase("result");
  };

  const advance = () => {
    const nextIndex = levelIndex + 1;
    setDay((value) => value + 1);

    if (nextIndex < LEVELS.length) {
      const nextLevel = LEVELS[nextIndex];
      setLevelIndex(nextIndex);
      resetLevelState(nextLevel);
      setNotice(`新调查地点已开放：${nextLevel.location}`);
    } else {
      resetLevelState(level);
      setNotice("当前原型的两处调查已完成。你可以重玩关卡，尝试不同证据组合与策展结论。");
    }

    setPhase("briefing");
  };

  return (
    <main className={`app-shell level-${level.id}`}>
      <TopBar
        day={day}
        credits={credits}
        reputation={reputation}
        levelNumber={level.number}
      />

      {phase === "briefing" ? (
        <Briefing
          level={level}
          levelIndex={levelIndex}
          completedLevels={completedLevels}
          notice={notice}
          onSelectLevel={selectLevel}
          onStart={startDive}
        />
      ) : null}
      {phase === "dive" ? (
        <DiveScreen
          key={level.id}
          level={level}
          hud={hud}
          onHud={setHud}
          onRecovered={(id) => setRecovered((items) => [...new Set([...items, id])])}
          onSurface={finishDive}
        />
      ) : null}
      {phase === "museum" ? (
        <Museum
          level={level}
          claimId={claimId}
          recovered={recovered}
          selected={selected}
          notice={notice}
          onClaim={setClaimId}
          onToggle={(id) =>
            setSelected((items) =>
              items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
            )
          }
          onPublish={publish}
        />
      ) : null}
      {phase === "result" && outcome ? (
        <Result
          level={level}
          outcome={outcome}
          hasNextLevel={levelIndex < LEVELS.length - 1}
          onAdvance={advance}
        />
      ) : null}

      <ReloadPrompt />
    </main>
  );
}

function TopBar({
  day,
  credits,
  reputation,
  levelNumber,
}: {
  day: number;
  credits: number;
  reputation: number;
  levelNumber: number;
}): JSX.Element {
  return (
    <header className="topbar">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="沉没纪元首页">
        <span className="brand-mark" aria-hidden="true">SA</span>
        <span><strong>沉没纪元</strong><small>SUNKEN AGES</small></span>
      </a>
      <div className="topbar-actions">
        <div className="campaign-progress" aria-label="调查进度">
          <span>调查</span><b>{levelNumber} / {LEVELS.length}</b>
        </div>
        <div className="status-strip" aria-label="博物馆状态">
          <span><b>{String(day).padStart(2, "0")}</b> 日</span>
          <span><b>{credits}</b> 信用点</span>
          <span><b>{reputation}</b> 信誉</span>
        </div>
        <InstallButton />
      </div>
    </header>
  );
}

interface BriefingProps {
  level: LevelDefinition;
  levelIndex: number;
  completedLevels: LevelId[];
  notice: string | null;
  onSelectLevel: (index: number) => void;
  onStart: () => void;
}

function Briefing({
  level,
  levelIndex,
  completedLevels,
  notice,
  onSelectLevel,
  onStart,
}: BriefingProps): JSX.Element {
  const [headlineFirst, headlineSecond] = level.headline.split("\n");

  return (
    <section className="screen briefing-screen">
      <div className="briefing-copy">
        <p className="section-index">{String(level.number).padStart(2, "0")} / {level.eyebrow}</p>
        <h1>{headlineFirst}<br />{headlineSecond}</h1>
        <p className="lead">{level.description}</p>
        {notice ? <p className="notice">{notice}</p> : null}

        <div className="mission-selector" aria-label="调查地点">
          {LEVELS.map((item, index) => {
            const completed = completedLevels.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`mission-card ${index === levelIndex ? "is-active" : ""}`}
                onClick={() => onSelectLevel(index)}
              >
                <span>{String(item.number).padStart(2, "0")}</span>
                <div><b>{item.location}</b><small>{item.depthLabel} · {item.timelineLabel}</small></div>
                <em>{completed ? "已完成" : index === 1 ? "可体验" : "当前任务"}</em>
              </button>
            );
          })}
        </div>

        <div className="mission-facts" aria-label="任务信息">
          <div><span>目标海域</span><strong>{level.location} · {level.depthLabel}</strong></div>
          <div><span>任务</span><strong>{level.objective}</strong></div>
          <div><span>限制</span><strong>氧气 100 · 载重 {level.maxCargo}</strong></div>
        </div>
        <button className="primary-button" type="button" onClick={onStart}>
          开始第 {level.number} 关 <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={`briefing-visual visual-${level.dive.variant}`} aria-label={`${level.location}声呐记录`}>
        <div className="planet" aria-hidden="true" />
        <div className="museum-window">
          <div className="window-header"><span>{level.location}</span><span>{level.signal}</span></div>
          <div className="wreck-map" aria-hidden="true">
            <div className="depth-lines" />
            <div className="sonar-ring ring-one" />
            <div className="sonar-ring ring-two" />
            <div className="wreck-silhouette" />
            {level.evidence.map((item, index) => (
              <i key={item.id} className={`signal-dot dot-${index + 1}`} />
            ))}
          </div>
          <div className="window-footer"><span>{level.era}</span><span>档案冲突</span></div>
        </div>
        <blockquote>“{level.quote}”<cite>— {level.quoteBy}</cite></blockquote>
      </div>
    </section>
  );
}

interface DiveScreenProps {
  level: LevelDefinition;
  hud: DiveHud;
  onHud: (hud: DiveHud) => void;
  onRecovered: (id: string) => void;
  onSurface: (result: DiveResult) => void;
}

function DiveScreen({ level, hud, onHud, onRecovered, onSurface }: DiveScreenProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DiveController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onHud, onRecovered, onSurface });
  const [toast, setToast] = useState("正在初始化潜水系统…");

  callbacksRef.current = { onHud, onRecovered, onSurface };

  useEffect(() => {
    let active = true;

    void import("./game/runtime").then(({ createDiveGame }) => {
      if (!active || !hostRef.current) return;
      controllerRef.current = createDiveGame(hostRef.current, level, {
        onHud: (value) => callbacksRef.current.onHud(value),
        onRecovered: (id) => callbacksRef.current.onRecovered(id),
        onSurface: (result) => callbacksRef.current.onSurface(result),
        onToast(message) {
          setToast(message);
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(""), 2100);
        },
      });
    });

    return () => {
      active = false;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [level]);

  const hold = (direction: DiveDirection) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      event.currentTarget.setPointerCapture(event.pointerId);
      controllerRef.current?.setDirection(direction, true);
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      controllerRef.current?.setDirection(direction, false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel() { controllerRef.current?.setDirection(direction, false); },
    onPointerLeave() { controllerRef.current?.setDirection(direction, false); },
  });

  return (
    <section className="screen dive-screen" aria-label={`${level.location}深海打捞场景`}>
      <div className="dive-hud">
        <div className="hud-cluster oxygen-cluster">
          <span>氧气</span><div className="meter"><i style={{ width: `${hud.oxygen}%` }} /></div><strong>{hud.oxygen}</strong>
        </div>
        <div className="hud-cluster location-cluster">
          <small>{level.location}</small>
          <strong>深度 {String(hud.depth).padStart(2, "0")} m</strong>
        </div>
        <div className="hud-cluster cargo-cluster">
          <span>证据 {hud.recovered}/{hud.total}</span><strong>{hud.cargo} / {level.maxCargo}</strong>
        </div>
      </div>

      <div className="canvas-frame">
        <div ref={hostRef} className="game-host" />
        <div className="objective-chip">
          <span>{level.number === 2 && hud.recovered === 0 ? "先扫描控制台开启闸门" : level.objective}</span>
          <b>空格 / 打捞</b>
        </div>
        {toast ? <div className="dive-toast">{toast}</div> : null}
      </div>

      <div className="dive-bottom-bar">
        <div className="toolbelt" aria-label="打捞工具">
          {level.tools.map((tool, index) => (
            <span key={tool}><b>{String(index + 1).padStart(2, "0")}</b> {tool}</span>
          ))}
        </div>
        <div className="surface-actions">
          <small>R 键</small>
          <button type="button" className="surface-button" onClick={() => controllerRef.current?.surface()}>返回水面</button>
        </div>
      </div>

      <div className="mobile-controls" aria-label="移动端控制">
        <div className="dpad">
          <button type="button" aria-label="向上" {...hold("up")}>↑</button>
          <button type="button" aria-label="向左" {...hold("left")}>←</button>
          <button type="button" aria-label="向下" {...hold("down")}>↓</button>
          <button type="button" aria-label="向右" {...hold("right")}>→</button>
        </div>
        <button type="button" className="action-control" onPointerDown={() => controllerRef.current?.interact()}>扫描 / 打捞</button>
      </div>
    </section>
  );
}

interface MuseumProps {
  level: LevelDefinition;
  claimId: string;
  recovered: string[];
  selected: string[];
  notice: string | null;
  onClaim: (claimId: string) => void;
  onToggle: (id: string) => void;
  onPublish: () => void;
}

function Museum({
  level,
  claimId,
  recovered,
  selected,
  notice,
  onClaim,
  onToggle,
  onPublish,
}: MuseumProps): JSX.Element {
  const evidence = useMemo(
    () => level.evidence.filter((item) => recovered.includes(item.id)),
    [level, recovered],
  );

  return (
    <section className="screen museum-screen">
      <aside className="museum-sidebar">
        <p className="section-index">{String(level.number).padStart(2, "0")} / 闭馆后</p>
        <h2>{level.number === 1 ? "首个专题展" : "第二次解释权争夺"}</h2>
        <p>选择历史判断，再用打捞证据建立证据链。第二关无法一次带回全部文物，你必须决定哪些证据更重要。</p>
        {notice ? <p className="notice compact">{notice}</p> : null}
        <div className="claim-picker" role="radiogroup" aria-label="展览主张">
          {level.claims.map((claim) => (
            <Claim
              key={claim.id}
              label={claim.label}
              title={claim.title}
              description={claim.description}
              selected={claimId === claim.id}
              onClick={() => onClaim(claim.id)}
            />
          ))}
        </div>
        <button
          className="primary-button publish-button"
          type="button"
          disabled={!canCurate(level, selected)}
          onClick={onPublish}
        >
          发布展览 <span aria-hidden="true">→</span>
        </button>
      </aside>

      <div className="investigation-area">
        <div className="timeline-panel">
          <div><small>文明时间线</small><strong>{level.era}</strong></div>
          <div className="timeline-rail" aria-label="远古至文明末期">
            <span>远古</span><i><b style={{ width: `${level.timelineProgress}%` }} /></i><strong>{level.timelineLabel}</strong><span>文明末期</span>
          </div>
        </div>
        <div className="evidence-board">
          <div className="board-header">
            <div><small>调查墙 {String(level.number).padStart(2, "0")}</small><h3>{level.boardTitle}</h3></div>
            <span>已选证据 {selected.length} / {evidence.length}</span>
          </div>
          <div className={`evidence-grid evidence-count-${evidence.length}`}>
            {evidence.map((item) => (
              <button
                key={item.id}
                className={`evidence-card ${selected.includes(item.id) ? "is-selected" : ""}`}
                type="button"
                aria-pressed={selected.includes(item.id)}
                onClick={() => onToggle(item.id)}
              >
                <small>{item.code}</small>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                <span>{item.tool}</span>
                <em>重量 {item.weight}</em>
              </button>
            ))}
          </div>
          <div className="board-note"><b aria-hidden="true">!</b><p>证据支持度并不等于真相。你留下的空白，也会成为游客解读展览的一部分。</p></div>
        </div>
      </div>
    </section>
  );
}

function Claim({
  label,
  title,
  description,
  selected,
  onClick,
}: {
  label: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`claim-option ${selected ? "is-selected" : ""}`}
      role="radio"
      aria-checked={selected}
      onClick={onClick}
    >
      <span>{label}</span><b>{title}</b><small>{description}</small>
    </button>
  );
}

function Result({
  level,
  outcome,
  hasNextLevel,
  onAdvance,
}: {
  level: LevelDefinition;
  outcome: ExhibitionOutcome;
  hasNextLevel: boolean;
  onAdvance: () => void;
}): JSX.Element {
  return (
    <section className="screen result-screen">
      <div className="result-copy">
        <p className="section-index">{String(level.number).padStart(2, "0")} / 开馆日</p>
        <h2>{outcome.title}</h2>
        <p className="lead">{outcome.summary}</p>
        <div className="result-metrics">
          <div><span>首日收入</span><strong>+{outcome.income}</strong></div>
          <div><span>学术信誉</span><strong>{outcome.reputation > 0 ? "+" : ""}{outcome.reputation}</strong></div>
          <div><span>{hasNextLevel ? "新地点" : "新线索"}</span><strong>1</strong></div>
        </div>
        <button className="primary-button" type="button" onClick={onAdvance}>
          {hasNextLevel ? "前往第二关" : "返回任务台"} <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className={`visitor-panel visitor-${level.dive.variant}`}>
        <div className="visitor-portrait" aria-hidden="true"><span /></div>
        <div>
          <small>星际旅行者 · 奥罗</small>
          <blockquote>{outcome.visitorQuote}</blockquote>
          <p>
            {hasNextLevel ? "新调查地点已记录" : "下一阶段线索已记录"}：<b>{outcome.nextLead}</b><br />
            {hasNextLevel ? "官方地图称它从未投入使用。" : "目前尚无足够设备继续下潜。"}
          </p>
        </div>
      </div>
    </section>
  );
}
