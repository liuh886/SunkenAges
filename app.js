const screens = {
  briefing: document.getElementById("briefingScreen"),
  dive: document.getElementById("diveScreen"),
  museum: document.getElementById("museumScreen"),
  result: document.getElementById("resultScreen"),
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  day: document.getElementById("dayValue"),
  credits: document.getElementById("creditsValue"),
  reputation: document.getElementById("reputationValue"),
  oxygenBar: document.getElementById("oxygenBar"),
  oxygenValue: document.getElementById("oxygenValue"),
  cargoValue: document.getElementById("cargoValue"),
  depthValue: document.getElementById("depthValue"),
  interactionPrompt: document.getElementById("interactionPrompt"),
  diveToast: document.getElementById("diveToast"),
  evidenceGrid: document.getElementById("evidenceGrid"),
  evidenceCounter: document.getElementById("evidenceCounter"),
  publishButton: document.getElementById("publishButton"),
  resultTitle: document.getElementById("resultTitle"),
  resultSummary: document.getElementById("resultSummary"),
  incomeResult: document.getElementById("incomeResult"),
  reputationResult: document.getElementById("reputationResult"),
  visitorQuote: document.getElementById("visitorQuote"),
};

const evidenceCatalog = [
  {
    id: "pass",
    x: 390,
    y: 390,
    weight: 2,
    tool: "扫描仪",
    symbol: "券",
    code: "E-17 / 登船凭证",
    name: "疏散通行证",
    description: "票面写着“全体居民”，背面却盖有只向高信用等级开放的优先码。",
    color: "#f3c969",
  },
  {
    id: "ration",
    x: 655,
    y: 292,
    weight: 2,
    tool: "密封箱",
    symbol: "罐",
    code: "R-08 / 冷藏货物",
    name: "未开封配给罐",
    description: "生产日期比官方撤离结束晚九年，说明船只曾长期向封闭区域运送补给。",
    color: "#78dcc8",
  },
  {
    id: "log",
    x: 820,
    y: 430,
    weight: 2,
    tool: "微型切割器",
    symbol: "录",
    code: "B-02 / 航行记录",
    name: "舰桥黑匣子",
    description: "最后航线绕过公共避难港，驶向地图中不存在的“潮门站”。",
    color: "#ff8f6b",
  },
];

const currents = [
  { x: 185, y: 165, width: 235, height: 90, forceX: 20, forceY: 2 },
  { x: 535, y: 342, width: 205, height: 86, forceX: -16, forceY: -4 },
];

const jellyfish = [
  { x: 492, y: 210, radius: 25, phase: 0.3, drift: 12 },
  { x: 745, y: 164, radius: 21, phase: 2.1, drift: 17 },
  { x: 574, y: 454, radius: 24, phase: 4.4, drift: 9 },
];

const particles = Array.from({ length: 72 }, (_, index) => ({
  x: (index * 137) % canvas.width,
  y: (index * 83) % canvas.height,
  radius: 0.6 + (index % 4) * 0.45,
  speed: 5 + (index % 7) * 1.4,
  alpha: 0.12 + (index % 5) * 0.05,
}));

const fish = Array.from({ length: 12 }, (_, index) => ({
  x: (index * 211) % canvas.width,
  y: 60 + ((index * 71) % 370),
  speed: 8 + (index % 5) * 4,
  scale: 0.55 + (index % 4) * 0.16,
  direction: index % 2 === 0 ? 1 : -1,
}));

const state = {
  day: 3,
  credits: 240,
  reputation: 12,
  oxygen: 100,
  cargo: 0,
  running: false,
  lastTime: 0,
  hazardCooldown: 0,
  toastTimer: 0,
  selectedClaim: "orderly",
  selectedEvidence: new Set(),
  recovered: new Set(),
  player: {
    x: 92,
    y: 88,
    radius: 17,
    speed: 138,
    facing: 1,
    hitFlash: 0,
  },
};

const keys = new Set();
let animationFrame = 0;
let activeArtifact = null;

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("is-active", key === name);
  });
}

function updateGlobalStatus() {
  ui.day.textContent = String(state.day).padStart(2, "0");
  ui.credits.textContent = String(state.credits);
  ui.reputation.textContent = String(state.reputation);
}

function resetDive() {
  state.oxygen = 100;
  state.cargo = 0;
  state.lastTime = 0;
  state.hazardCooldown = 0;
  state.toastTimer = 0;
  state.selectedEvidence.clear();
  state.recovered.clear();
  state.player.x = 92;
  state.player.y = 88;
  state.player.facing = 1;
  state.player.hitFlash = 0;
  activeArtifact = null;
  evidenceCatalog.forEach((artifact) => {
    artifact.collected = false;
  });
  updateDiveHud();
}

function startDive() {
  resetDive();
  showScreen("dive");
  state.running = true;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function updateDiveHud() {
  const roundedOxygen = Math.max(0, Math.round(state.oxygen));
  ui.oxygenValue.textContent = String(roundedOxygen);
  ui.oxygenBar.style.width = `${state.oxygen}%`;
  ui.oxygenBar.style.backgroundColor =
    state.oxygen < 24 ? "#ff6f72" : state.oxygen < 48 ? "#f3c969" : "#78dcc8";
  ui.cargoValue.textContent = String(state.cargo);
  const depth = Math.max(4, Math.round((state.player.y / canvas.height) * 42));
  ui.depthValue.textContent = `深度 ${String(depth).padStart(2, "0")} m`;
}

function showDiveToast(message, duration = 1800) {
  ui.diveToast.textContent = message;
  ui.diveToast.classList.add("is-visible");
  state.toastTimer = duration / 1000;
}

function hideDiveToast() {
  ui.diveToast.classList.remove("is-visible");
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearbyArtifact() {
  return (
    evidenceCatalog.find(
      (artifact) => !artifact.collected && distance(state.player, artifact) < 56,
    ) || null
  );
}

function updateToolbelt(artifact) {
  const tools = [...document.querySelectorAll(".tool")];
  tools.forEach((tool, index) => {
    const toolName = ["扫描仪", "密封箱", "微型切割器"][index];
    tool.classList.toggle("is-active", artifact ? artifact.tool === toolName : index === 0);
  });
}

function retrieveArtifact() {
  const artifact = findNearbyArtifact();
  if (!artifact) {
    showDiveToast("附近没有可打捞目标", 1000);
    return;
  }

  if (state.cargo + artifact.weight > 6) {
    showDiveToast("载重已满，请返回水面");
    return;
  }

  artifact.collected = true;
  state.cargo += artifact.weight;
  state.recovered.add(artifact.id);
  showDiveToast(`${artifact.tool}完成：${artifact.name}`);
  activeArtifact = null;
  ui.interactionPrompt.hidden = true;
  updateToolbelt(null);
  updateDiveHud();
}

function returnToMuseum(forced = false) {
  if (!state.running) return;

  if (!forced && state.recovered.size < 2) {
    showDiveToast("至少需要两件证据才能策展");
    return;
  }

  state.running = false;
  cancelAnimationFrame(animationFrame);
  ui.interactionPrompt.hidden = true;
  hideDiveToast();
  renderEvidenceBoard();
  showScreen("museum");
}

function handleHazards(delta) {
  state.hazardCooldown = Math.max(0, state.hazardCooldown - delta);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - delta);

  jellyfish.forEach((jelly) => {
    const currentY = jelly.y + Math.sin(performance.now() / 900 + jelly.phase) * jelly.drift;
    const hitDistance = Math.hypot(state.player.x - jelly.x, state.player.y - currentY);
    if (hitDistance < state.player.radius + jelly.radius && state.hazardCooldown <= 0) {
      state.oxygen = Math.max(0, state.oxygen - 9);
      state.hazardCooldown = 1.1;
      state.player.hitFlash = 0.35;
      const pushDirection = state.player.x < jelly.x ? -1 : 1;
      state.player.x += pushDirection * 34;
      showDiveToast("触碰刺胞生物：氧气泄漏", 1200);
    }
  });
}

function applyCurrents(delta) {
  currents.forEach((current) => {
    const withinX = state.player.x > current.x && state.player.x < current.x + current.width;
    const withinY = state.player.y > current.y && state.player.y < current.y + current.height;
    if (withinX && withinY) {
      state.player.x += current.forceX * delta;
      state.player.y += current.forceY * delta;
    }
  });
}

function updatePlayer(delta) {
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("left")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD") || keys.has("right")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("up")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS") || keys.has("down")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const magnitude = Math.hypot(dx, dy);
    dx /= magnitude;
    dy /= magnitude;
    state.player.x += dx * state.player.speed * delta;
    state.player.y += dy * state.player.speed * delta;
    if (dx !== 0) state.player.facing = Math.sign(dx);
  }

  applyCurrents(delta);

  state.player.x = Math.min(canvas.width - 28, Math.max(28, state.player.x));
  state.player.y = Math.min(canvas.height - 34, Math.max(30, state.player.y));
}

function updateDive(delta) {
  updatePlayer(delta);
  handleHazards(delta);

  const depthFactor = state.player.y / canvas.height;
  state.oxygen = Math.max(0, state.oxygen - delta * (0.62 + depthFactor * 0.26));

  particles.forEach((particle) => {
    particle.y -= particle.speed * delta;
    particle.x += Math.sin(particle.y * 0.018) * 2.2 * delta;
    if (particle.y < -10) {
      particle.y = canvas.height + 10;
      particle.x = Math.random() * canvas.width;
    }
  });

  fish.forEach((item) => {
    item.x += item.speed * item.direction * delta;
    if (item.direction > 0 && item.x > canvas.width + 40) item.x = -40;
    if (item.direction < 0 && item.x < -40) item.x = canvas.width + 40;
  });

  if (state.toastTimer > 0) {
    state.toastTimer -= delta;
    if (state.toastTimer <= 0) hideDiveToast();
  }

  activeArtifact = findNearbyArtifact();
  ui.interactionPrompt.hidden = !activeArtifact;
  if (activeArtifact) {
    ui.interactionPrompt.querySelector("span").textContent = `${activeArtifact.tool} · ${activeArtifact.name}`;
  }
  updateToolbelt(activeArtifact);
  updateDiveHud();

  if (state.oxygen <= 0) {
    showDiveToast("氧气耗尽，自动回收潜水员", 900);
    setTimeout(() => returnToMuseum(true), 700);
  }
}

function gameLoop(timestamp) {
  if (!state.running) return;
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  updateDive(delta);
  drawDiveScene(timestamp / 1000);
  animationFrame = requestAnimationFrame(gameLoop);
}

function drawDiveScene(time) {
  const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#155163");
  background.addColorStop(0.38, "#0a3441");
  background.addColorStop(1, "#031820");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawLightRays(time);
  drawDistantTerrain();
  drawCurrents(time);
  drawFish(time);
  drawWreck();
  drawArtifacts(time);
  drawJellyfish(time);
  drawParticles();
  drawDiver(time);
  drawVignette();
}

function drawLightRays(time) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#b6ffe8";
  for (let index = 0; index < 5; index += 1) {
    const offset = Math.sin(time * 0.3 + index) * 18;
    ctx.beginPath();
    ctx.moveTo(90 + index * 185 + offset, 0);
    ctx.lineTo(220 + index * 185 + offset, 0);
    ctx.lineTo(420 + index * 150 + offset, 510);
    ctx.lineTo(230 + index * 150 + offset, 510);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDistantTerrain() {
  ctx.save();
  ctx.fillStyle = "rgba(2, 16, 21, 0.48)";
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.quadraticCurveTo(150, 430, 305, 476);
  ctx.quadraticCurveTo(470, 520, 665, 468);
  ctx.quadraticCurveTo(820, 425, 960, 472);
  ctx.lineTo(960, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(120, 220, 200, 0.08)";
  for (let x = 18; x < canvas.width; x += 46) {
    const height = 10 + ((x * 7) % 28);
    ctx.fillRect(x, 485 - height, 3, height);
  }
  ctx.restore();
}

function drawCurrents(time) {
  ctx.save();
  currents.forEach((current, currentIndex) => {
    ctx.fillStyle = "rgba(120, 220, 200, 0.035)";
    ctx.fillRect(current.x, current.y, current.width, current.height);
    ctx.strokeStyle = "rgba(182, 255, 232, 0.18)";
    ctx.lineWidth = 1;
    const direction = Math.sign(current.forceX);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const travel = ((time * 32 + column * 45 + currentIndex * 20) % current.width);
        const x = direction > 0 ? current.x + travel : current.x + current.width - travel;
        const y = current.y + 20 + row * 24;
        ctx.beginPath();
        ctx.moveTo(x - direction * 12, y);
        ctx.lineTo(x + direction * 9, y);
        ctx.lineTo(x + direction * 4, y - 4);
        ctx.moveTo(x + direction * 9, y);
        ctx.lineTo(x + direction * 4, y + 4);
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}

function drawFish(time) {
  ctx.save();
  ctx.fillStyle = "rgba(182, 255, 232, 0.12)";
  fish.forEach((item, index) => {
    const y = item.y + Math.sin(time * 0.8 + index) * 8;
    ctx.save();
    ctx.translate(item.x, y);
    ctx.scale(item.direction * item.scale, item.scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
    ctx.moveTo(-11, 0);
    ctx.lineTo(-22, -7);
    ctx.lineTo(-20, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

function drawWreck() {
  ctx.save();
  ctx.translate(250, 255);
  ctx.rotate(-0.045);

  ctx.fillStyle = "#092129";
  ctx.strokeStyle = "rgba(120, 220, 200, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 110);
  ctx.lineTo(620, 110);
  ctx.lineTo(575, 232);
  ctx.quadraticCurveTo(330, 270, 72, 220);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0b2c33";
  ctx.fillRect(180, 44, 250, 68);
  ctx.fillRect(248, 8, 78, 38);

  ctx.fillStyle = "rgba(243, 201, 105, 0.2)";
  for (let index = 0; index < 7; index += 1) {
    ctx.beginPath();
    ctx.arc(215 + index * 36, 76, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 143, 107, 0.36)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(505, 110);
  ctx.lineTo(478, 148);
  ctx.lineTo(520, 167);
  ctx.lineTo(487, 207);
  ctx.stroke();

  ctx.fillStyle = "#03151b";
  ctx.beginPath();
  ctx.moveTo(466, 112);
  ctx.lineTo(560, 112);
  ctx.lineTo(538, 188);
  ctx.lineTo(486, 202);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(120, 220, 200, 0.1)";
  ctx.lineWidth = 1;
  for (let x = 96; x < 540; x += 82) {
    ctx.beginPath();
    ctx.moveTo(x, 112);
    ctx.lineTo(x - 18, 222);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(7, 29, 34, 0.72)";
  ctx.fillRect(-40, 224, 700, 28);
  ctx.restore();
}

function drawArtifacts(time) {
  evidenceCatalog.forEach((artifact, index) => {
    if (artifact.collected) return;
    const glow = 0.45 + Math.sin(time * 2.4 + index) * 0.18;
    ctx.save();
    ctx.translate(artifact.x, artifact.y);
    ctx.shadowColor = artifact.color;
    ctx.shadowBlur = 18 + glow * 18;
    ctx.fillStyle = artifact.color;
    ctx.globalAlpha = 0.68 + glow * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = artifact.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + glow * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawJellyfish(time) {
  jellyfish.forEach((jelly) => {
    const y = jelly.y + Math.sin(time + jelly.phase) * jelly.drift;
    ctx.save();
    ctx.translate(jelly.x, y);
    ctx.strokeStyle = "rgba(255, 143, 107, 0.72)";
    ctx.fillStyle = "rgba(255, 143, 107, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, jelly.radius, Math.PI, 0);
    ctx.quadraticCurveTo(jelly.radius * 0.55, jelly.radius * 0.55, 0, jelly.radius * 0.25);
    ctx.quadraticCurveTo(-jelly.radius * 0.55, jelly.radius * 0.55, -jelly.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let index = -2; index <= 2; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * 7, jelly.radius * 0.24);
      ctx.bezierCurveTo(
        index * 9 + Math.sin(time * 2 + index) * 4,
        jelly.radius + 12,
        index * 6 - Math.sin(time * 1.7 + index) * 6,
        jelly.radius + 25,
        index * 8,
        jelly.radius + 36,
      );
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawParticles() {
  ctx.save();
  particles.forEach((particle) => {
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = "#d5fff0";
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawDiver(time) {
  const { x, y, facing, hitFlash } = state.player;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const beam = ctx.createLinearGradient(16, 0, 148, 0);
  beam.addColorStop(0, "rgba(243, 201, 105, 0.22)");
  beam.addColorStop(1, "rgba(243, 201, 105, 0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(14, -5);
  ctx.lineTo(150, -38);
  ctx.lineTo(150, 38);
  ctx.lineTo(14, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = hitFlash > 0 ? "#ff6f72" : "#f3c969";
  ctx.fillRect(-19, -7, 14, 25);
  ctx.fillStyle = "#174a55";
  ctx.fillRect(-9, -8, 24, 34);

  ctx.fillStyle = "#d8f7e9";
  ctx.beginPath();
  ctx.arc(5, -17, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0c3843";
  ctx.beginPath();
  ctx.arc(10, -17, 10, -1.4, 1.4);
  ctx.fill();

  ctx.strokeStyle = "#d8f7e9";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2, 19);
  ctx.lineTo(-5, 35 + Math.sin(time * 5) * 3);
  ctx.moveTo(11, 19);
  ctx.lineTo(20, 33 - Math.sin(time * 5) * 3);
  ctx.stroke();

  ctx.fillStyle = "#78dcc8";
  ctx.beginPath();
  ctx.moveTo(-5, 34);
  ctx.lineTo(-20, 42);
  ctx.lineTo(-3, 43);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, 32);
  ctx.lineTo(34, 40);
  ctx.lineTo(18, 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(216, 247, 233, 0.42)";
  for (let index = 0; index < 3; index += 1) {
    const bubbleOffset = (time * 18 + index * 13) % 44;
    ctx.beginPath();
    ctx.arc(-18, -18 - bubbleOffset, 2 + index * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    120,
    canvas.width / 2,
    canvas.height / 2,
    610,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 8, 12, 0.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderEvidenceBoard() {
  state.selectedEvidence.clear();
  ui.evidenceGrid.innerHTML = "";

  evidenceCatalog.forEach((artifact) => {
    const recovered = state.recovered.has(artifact.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `evidence-card${recovered ? "" : " is-missing"}`;
    card.disabled = !recovered;
    card.dataset.evidenceId = artifact.id;
    card.setAttribute("aria-pressed", "false");
    card.innerHTML = `
      <span class="evidence-pin" aria-hidden="true"></span>
      <span class="evidence-icon" aria-hidden="true">${recovered ? artifact.symbol : "?"}</span>
      <small>${recovered ? artifact.code : "未回收 / 信号中断"}</small>
      <strong>${recovered ? artifact.name : "证据缺失"}</strong>
      <p>${recovered ? artifact.description : "再次下潜后才能确认这部分历史。"}</p>
    `;

    if (recovered) {
      card.addEventListener("click", () => toggleEvidence(artifact.id, card));
    }
    ui.evidenceGrid.appendChild(card);
  });

  updateEvidenceSelection();
}

function toggleEvidence(id, card) {
  if (state.selectedEvidence.has(id)) {
    state.selectedEvidence.delete(id);
    card.classList.remove("is-selected");
    card.setAttribute("aria-pressed", "false");
  } else {
    state.selectedEvidence.add(id);
    card.classList.add("is-selected");
    card.setAttribute("aria-pressed", "true");
  }
  updateEvidenceSelection();
}

function updateEvidenceSelection() {
  ui.evidenceCounter.textContent = `已选证据 ${state.selectedEvidence.size} / ${state.recovered.size}`;
  ui.publishButton.disabled = state.selectedEvidence.size < 2;
}

function selectClaim(claim, button) {
  state.selectedClaim = claim;
  document.querySelectorAll(".claim-option").forEach((option) => {
    const selected = option === button;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function publishExhibition() {
  const evidenceCount = state.selectedEvidence.size;
  if (evidenceCount < 2) return;

  let income;
  let reputationChange;
  let title;
  let summary;
  let visitorQuote;

  if (state.selectedClaim === "selective") {
    income = 120 + evidenceCount * 22;
    reputationChange = evidenceCount === 3 ? 4 : 2;
    title = "《谁被允许离开》已开放";
    summary =
      evidenceCount === 3
        ? "三件证据共同指向同一事实：所谓公共撤离，实际上将生存顺序与信用等级绑定。展览引发争议，却也让博物馆第一次进入星际学术网络。"
        : "展览提出了一个尚不完整但值得追查的判断：撤离资源可能只向少数人开放。部分学者要求你补充航线记录。";
    visitorQuote =
      "“你们把它叫作优先码。我们故乡曾把同一种制度叫作‘文明连续性名额’。后来，没拿到名额的人烧掉了所有名单。”";
  } else {
    income = 172 + evidenceCount * 25;
    reputationChange = evidenceCount === 3 ? -1 : 0;
    title = "《最后一次有序撤离》已开放";
    summary =
      "熟悉而完整的故事带来了更高客流，但证据之间的矛盾没有消失。评论区开始质疑博物馆是否为了收入延续官方叙事。";
    visitorQuote =
      "“很漂亮的故事。我们故乡的博物馆也曾这样展出那份名单——直到有人发现，名单上的‘全体居民’只有总人口的百分之七。”";
  }

  state.credits += income;
  state.reputation += reputationChange;
  state.day += 1;
  updateGlobalStatus();

  ui.resultTitle.textContent = title;
  ui.resultSummary.textContent = summary;
  ui.incomeResult.textContent = `+${income}`;
  ui.reputationResult.textContent = reputationChange >= 0 ? `+${reputationChange}` : `${reputationChange}`;
  ui.visitorQuote.textContent = visitorQuote;
  showScreen("result");
}

function restartPrototype() {
  showScreen("briefing");
}

function registerKeyboardControls() {
  window.addEventListener("keydown", (event) => {
    const gameKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "KeyR",
    ];

    if (state.running && gameKeys.includes(event.code)) event.preventDefault();
    keys.add(event.code);

    if (!state.running) return;
    if (event.code === "Space" && !event.repeat) retrieveArtifact();
    if (event.code === "KeyR" && !event.repeat) returnToMuseum();
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
}

function registerMobileControls() {
  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;

    const press = (event) => {
      event.preventDefault();
      if (control === "action") {
        retrieveArtifact();
      } else {
        keys.add(control);
      }
    };

    const release = (event) => {
      event.preventDefault();
      if (control !== "action") keys.delete(control);
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

function registerInterface() {
  document.getElementById("startDiveButton").addEventListener("click", startDive);
  document.getElementById("surfaceButton").addEventListener("click", () => returnToMuseum());
  document.getElementById("restartButton").addEventListener("click", restartPrototype);
  ui.publishButton.addEventListener("click", publishExhibition);

  document.querySelectorAll(".claim-option").forEach((button) => {
    button.addEventListener("click", () => selectClaim(button.dataset.claim, button));
  });

  const dialog = document.getElementById("controlsDialog");
  document.getElementById("howToButton").addEventListener("click", () => dialog.showModal());
  document.getElementById("closeDialogButton").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

registerKeyboardControls();
registerMobileControls();
registerInterface();
updateGlobalStatus();
updateDiveHud();
drawDiveScene(0);
