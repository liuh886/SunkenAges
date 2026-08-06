import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type PointerEvent,
} from "react";

import {
  EVIDENCE,
  canCurate,
  scoreExhibition,
  type ExhibitionClaim,
  type ExhibitionOutcome,
  type GamePhase,
} from "./domain/game";
import type {
  DiveController,
  DiveDirection,
  DiveHud,
  DiveResult,
} from "./game/runtime";
import { InstallButton } from "./pwa/InstallButton";
import { ReloadPrompt } from "./pwa/ReloadPrompt";

const INITIAL_HUD: DiveHud = { oxygen: 100, cargo: 0, depth: 4 };

export default function App(): JSX.Element {
  const [phase, setPhase] = useState<GamePhase>("briefing");
  const [day, setDay] = useState(3);
  const [credits, setCredits] = useState(240);
  const [reputation, setReputation] = useState(12);
  const [hud, setHud] = useState<DiveHud>(INITIAL_HUD);
  const [recovered, setRecovered] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [claim, setClaim] = useState<ExhibitionClaim>("orderly");
  const [outcome, setOutcome] = useState<ExhibitionOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startDive = () => {
    setHud(INITIAL_HUD);
    setRecovered([]);
    setSelectedEvidence([]);
    setOutcome(null);
    setNotice(null);
    setPhase("dive");
  };

  const finishDive = (result: DiveResult) => {
    setRecovered(result.recovered);
    setSelectedEvidence(result.recovered);

    if (canCurate(result.recovered)) {
      setNotice(result.forced ? "救援浮标已将证据送回修复室。" : null);
      setPhase("museum");
      return;
    }

    setNotice("本次下潜没有取得足够的独立证据，展览无法立项。");
    setPhase("briefing");
  };

  const toggleEvidence = (id: string) => {
    setSelectedEvidence((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const publish = () => {
    const nextOutcome = scoreExhibition(claim, selectedEvidence);
    setOutcome(nextOutcome);
    setCredits((value) => value + nextOutcome.income);
    setReputation((value) => value + nextOutcome.reputation);
    setPhase("result");
  };

  const restart = () => {
    setDay((value) => value + 1);
    setClaim("orderly");
    setNotice(null);
    setPhase("briefing");
  };

  return (
    <main className="app-shell">
      <TopBar day={day} credits={credits} reputation={reputation} />

      {phase === "briefing" ? <BriefingScreen notice={notice} onStart={startDive} /> : null}
      {phase === "dive" ? (
        <DiveScreen
          hud={hud}
          onHud={setHud}
          onRecovered={(id) => setRecovered((items) => [...new Set([...items, id])])}
          onSurface={finishDive}
        />
      ) : null}
      {phase === "museum" ? (
        <MuseumScreen
          claim={claim}
          recovered={recovered}
          selected={selectedEvidence}
          notice={notice}
          onClaim={setClaim}
          onToggleEvidence={toggleEvidence}
          onPublish={publish}
        />
      ) : null}
      {phase === "result" && outcome ? <ResultScreen outcome={outcome} onRestart={restart} /> : null}

      <ReloadPrompt />
    </main>
  );
}

interface TopBarProps {
  day: number;
  credits: number;
  reputation: number;
}

function TopBar({ day, credits, reputation }: TopBarProps): JSX.Element {
  return (
    <header className="topbar">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="沉没纪元首页">
        <span className="brand-mark" aria-hidden="true">
          SA
        </span>
        <span>
          <strong>沉没纪元</strong>
          <small>SUNKEN AGES</small>
        </span>
      </a>

      <div className="topbar-actions">
        <div className="status-strip" aria-label="博物馆状态">
          <span>
            <b>{String(day).padStart(2, "0")}</b> 日
          </span>
          <span>
            <b>{credits}</b> 信用点
          </span>
          <span>
            <b>{reputation}</b> 信誉
          </span>
        </div>
        <InstallButton />
      </div>
    </header>
  );
}

interface BriefingScreenProps {
  notice: string | null;
  onStart: () => void;
}

function BriefingScreen({ notice, onStart }: BriefingScreenProps): JSX.Element {
  return (
    <section className="screen briefing-screen">
      <div className="briefing-copy">
        <p className="section-index">01 / 首次调查</p>
        <h1>
          今天打捞的，
          <br />
          可能不是宝藏。
        </h1>
        <p className="lead">
          浅海航道发现一艘沉没于海侵初期的民用运输船。官方记录称那是一场“有序撤离”，但船体位置与航线档案并不吻合。
        </p>

        {notice ? <p className="notice">{notice}</p> : null}

        <div className="mission-facts" aria-label="任务信息">
          <div>
            <span>目标海域</span>
            <strong>盐雾航道 · 42 m</strong>
          </div>
          <div>
            <span>任务</span>
            <strong>回收三件可验证证据</strong>
          </div>
          <div>
            <span>限制</span>
            <strong>氧气 100 · 载重 6</strong>
          </div>
        </div>

        <button className="primary-button" type="button" onClick={onStart}>
          开始下潜 <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="briefing-visual" aria-label="盐雾航道声呐记录">
        <div className="planet" aria-hidden="true" />
        <div className="museum-window">
          <div className="window-header">
            <span>盐雾航道</span>
            <span>信号强度 73%</span>
          </div>
          <div className="wreck-map" aria-hidden="true">
            <div className="depth-lines" />
            <div className="sonar-ring ring-one" />
            <div className="sonar-ring ring-two" />
            <div className="wreck-silhouette" />
            <i className="signal-dot dot-one" />
            <i className="signal-dot dot-two" />
            <i className="signal-dot dot-three" />
          </div>
          <div className="window-footer">
            <span>民用船只 / 约 312 年前</span>
            <span>档案冲突</span>
          </div>
        </div>
        <blockquote>
          “游客喜欢完整的故事。可惜历史通常不配合。”
          <cite>— 馆长助理弥洛</cite>
        </blockquote>
      </div>
    </section>
  );
}

interface DiveScreenProps {
  hud: DiveHud;
  onHud: (hud: DiveHud) => void;
  onRecovered: (id: string) => void;
  onSurface: (result: DiveResult) => void;
}

function DiveScreen({ hud, onHud, onRecovered, onSurface }: DiveScreenProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DiveController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState("正在初始化潜水系统…");

  useEffect(() => {
    let active = true;

    void import("./game/runtime").then(({ createDiveGame }) => {
      if (!active || !hostRef.current) return;
      controllerRef.current = createDiveGame(hostRef.current, {
        onHud,
        onRecovered,
        onSurface,
        onToast(message) {
          setToast(message);
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(""), 1800);
        },
      });
    });

    return () => {
      active = false;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [onHud, onRecovered, onSurface]);

  const directionHandlers = (direction: DiveDirection) => ({
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
    onPointerCancel() {
      controllerRef.current?.setDirection(direction, false);
    },
    onPointerLeave() {
      controllerRef.current?.setDirection(direction, false);
    },
  });

  return (
    <section className="screen dive-screen" aria-label="深海打捞场景">
      <div className="dive-hud">
        <div className="hud-cluster oxygen-cluster">
          <span>氧气</span>
          <div className="meter">
            <i style={{ width: `${hud.oxygen}%` }} />
          </div>
          <strong>{hud.oxygen}</strong>
        </div>
        <div className="hud-cluster location-cluster">
          <small>盐雾航道</small>
          <strong>深度 {String(hud.depth).padStart(2, "0")} m</strong>
        </div>
        <div className="hud-cluster cargo-cluster">
          <span>载重</span>
          <strong>{hud.cargo} / 6</strong>
        </div>
      </div>

      <div className="canvas-frame">
        <div ref={hostRef} className="game-host" />
        {toast ? <div className="dive-toast">{toast}</div> : null}
      </div>

      <div className="dive-bottom-bar">
        <div className="toolbelt" aria-label="打捞工具">
          <span><b>01</b> 扫描仪</span>
          <span><b>02</b> 密封箱</span>
          <span><b>03</b> 微型切割器</span>
        </div>
        <button type="button" className="surface-button" onClick={() => controllerRef.current?.surface()}>
          返回水面
        </button>
      </div>

      <div className="mobile-controls" aria-label="移动端控制">
        <div className="dpad">
          <button type="button" aria-label="向上" {...directionHandlers("up")}>↑</button>
          <button type="button" aria-label="向左" {...directionHandlers("left")}>←</button>
          <button type="button" aria-label="向下" {...directionHandlers("down")}>↓</button>
          <button type="button" aria-label="向右" {...directionHandlers("right")}>→</button>
        </div>
        <button
          type="button"
          className="action-control"
          onPointerDown={() => controllerRef.current?.interact()}
        >
          打捞
        </button>
      </div>
    </section>
  );
}

interface MuseumScreenProps {
  claim: ExhibitionClaim;
  recovered: string[];
  selected: string[];
  notice: string | null;
  onClaim: (claim: ExhibitionClaim) => void;
  onToggleEvidence: (id: string) => void;
  onPublish: () => void;
}

function MuseumScreen({
  claim,
  recovered,
  selected,
  notice,
  onClaim,
  onToggleEvidence,
  onPublish,
}: MuseumScreenProps): JSX.Element {
  const recoveredEvidence = useMemo(
    () => EVIDENCE.filter((evidence) => recovered.includes(evidence.id)),
    [recovered],
  );

  return (
    <section className="screen museum-screen">
      <aside className="museum-sidebar">
        <p className="section-index">02 / 闭馆后</p>
        <h2>首个专题展</h2>
        <p>选择历史判断，再用打捞证据建立证据链。收入与信誉不会总是站在同一边。</p>
        {notice ? <p className="notice compact">{notice}</p> : null}

        <div className="claim-picker" role="radiogroup" aria-label="展览主张">
          <ClaimButton
            label="A"
            title="撤离是一场有序行动"
            description="符合官方记录，商业风险较低。"
            selected={claim === "orderly"}
            onClick={() => onClaim("orderly")}
          />
          <ClaimButton
            label="B"
            title="撤离只服务于少数人"
            description="证据尚不完整，但能解释航线冲突。"
            selected={claim === "selective"}
            onClick={() => onClaim("selective")}
          />
        </div>

        <button
          className="primary-button publish-button"
          type="button"
          disabled={!canCurate(selected)}
          onClick={onPublish}
        >
          发布展览 <span aria-hidden="true">→</span>
        </button>
      </aside>

      <div className="investigation-area">
        <div className="timeline-panel">
          <div>
            <small>文明时间线</small>
            <strong>海侵初期 · 312 年前</strong>
          </div>
          <div className="timeline-track" aria-label="远古至文明末期">
            <span>远古</span><i /><b>海侵初期</b><i /><span>文明末期</span>
          </div>
        </div>

        <div className="evidence-board">
          <div className="board-header">
            <div>
              <small>调查墙 01</small>
              <h3>盐雾航道撤离事件</h3>
            </div>
            <span>已选证据 {selected.length} / {recoveredEvidence.length}</span>
          </div>

          <div className="evidence-grid">
            {recoveredEvidence.map((evidence) => (
              <button
                key={evidence.id}
                className={`evidence-card ${selected.includes(evidence.id) ? "is-selected" : ""}`}
                type="button"
                aria-pressed={selected.includes(evidence.id)}
                onClick={() => onToggleEvidence(evidence.id)}
              >
                <small>{evidence.code}</small>
                <strong>{evidence.name}</strong>
                <p>{evidence.description}</p>
                <span>{evidence.tool}</span>
              </button>
            ))}
          </div>

          <div className="board-note">
            <b aria-hidden="true">!</b>
            <p>证据支持度并不等于真相。星际游客会用自己的文明经验挑战你的解释。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface ClaimButtonProps {
  label: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function ClaimButton({ label, title, description, selected, onClick }: ClaimButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`claim-option ${selected ? "is-selected" : ""}`}
      role="radio"
      aria-checked={selected}
      onClick={onClick}
    >
      <span>{label}</span>
      <b>{title}</b>
      <small>{description}</small>
    </button>
  );
}

interface ResultScreenProps {
  outcome: ExhibitionOutcome;
  onRestart: () => void;
}

function ResultScreen({ outcome, onRestart }: ResultScreenProps): JSX.Element {
  return (
    <section className="screen result-screen">
      <div className="result-copy">
        <p className="section-index">03 / 开馆日</p>
        <h2>{outcome.title}</h2>
        <p className="lead">{outcome.summary}</p>

        <div className="result-metrics">
          <div><span>首日收入</span><strong>+{outcome.income}</strong></div>
          <div><span>学术信誉</span><strong>{outcome.reputation > 0 ? "+" : ""}{outcome.reputation}</strong></div>
          <div><span>新线索</span><strong>1</strong></div>
        </div>

        <button className="primary-button" type="button" onClick={onRestart}>
          下一调查日 <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="visitor-panel">
        <div className="visitor-portrait" aria-hidden="true"><span /></div>
        <div>
          <small>星际旅行者 · 奥罗</small>
          <blockquote>{outcome.visitorQuote}</blockquote>
          <p>新调查地点已记录：<b>潮门避难站</b><br />官方地图称它从未投入使用。</p>
        </div>
      </div>
    </section>
  );
}
