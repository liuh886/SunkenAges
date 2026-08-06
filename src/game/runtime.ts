import Phaser from "phaser";

import { EVIDENCE, type Evidence } from "../domain/game";

export type DiveDirection = "up" | "down" | "left" | "right";

export interface DiveHud {
  oxygen: number;
  cargo: number;
  depth: number;
}

export interface DiveResult {
  recovered: string[];
  forced: boolean;
}

export interface DiveCallbacks {
  onHud: (hud: DiveHud) => void;
  onRecovered: (evidenceId: string) => void;
  onSurface: (result: DiveResult) => void;
  onToast: (message: string) => void;
}

export interface DiveController {
  destroy: () => void;
  interact: () => void;
  setDirection: (direction: DiveDirection, active: boolean) => void;
  surface: () => void;
}

interface SalvageTarget {
  evidence: Evidence;
  x: number;
  y: number;
}

type ControlKey = "up" | "down" | "left" | "right" | "action" | "surface";
type ControlKeys = Record<ControlKey, Phaser.Input.Keyboard.Key>;

const WIDTH = 960;
const HEIGHT = 540;
const MAX_CARGO = 6;

const TARGETS: readonly SalvageTarget[] = [
  { evidence: EVIDENCE[0], x: 382, y: 394 },
  { evidence: EVIDENCE[1], x: 652, y: 286 },
  { evidence: EVIDENCE[2], x: 812, y: 422 },
];

const CURRENTS = [
  { x: 165, y: 156, width: 240, height: 92, forceX: 24, forceY: 2 },
  { x: 522, y: 336, width: 218, height: 90, forceX: -19, forceY: -4 },
] as const;

const JELLIES = [
  { x: 492, y: 205, radius: 24, phase: 0.3, drift: 13 },
  { x: 744, y: 162, radius: 21, phase: 2.1, drift: 17 },
  { x: 574, y: 454, radius: 23, phase: 4.4, drift: 10 },
] as const;

class DiveScene extends Phaser.Scene {
  private readonly callbacks: DiveCallbacks;
  private graphics!: Phaser.GameObjects.Graphics;
  private keys?: ControlKeys;
  private readonly touchDirections: Record<DiveDirection, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  private readonly recovered = new Set<string>();
  private readonly particles = Array.from({ length: 70 }, (_, index) => ({
    x: (index * 137) % WIDTH,
    y: (index * 83) % HEIGHT,
    radius: 1 + (index % 3),
    speed: 5 + (index % 7) * 1.4,
  }));
  private player = { x: 88, y: 84, radius: 16, facing: 1 };
  private oxygen = 100;
  private cargo = 0;
  private hazardCooldown = 0;
  private hudAccumulator = 0;
  private queuedAction = false;
  private queuedSurface = false;
  private finished = false;

  constructor(callbacks: DiveCallbacks) {
    super("dive");
    this.callbacks = callbacks;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#061d27");
    this.graphics = this.add.graphics();

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        action: Phaser.Input.Keyboard.KeyCodes.SPACE,
        surface: Phaser.Input.Keyboard.KeyCodes.R,
      }) as ControlKeys;
      keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
      ]);
    }

    this.publishHud();
    this.callbacks.onToast("盐雾航道信号已锁定");
  }

  update(time: number, deltaMs: number): void {
    if (this.finished) return;

    const delta = Math.min(deltaMs / 1000, 0.04);
    this.readInput(delta);
    this.applyCurrents(delta);
    this.applyHazards(time, delta);
    this.updateParticles(delta);

    const depthFactor = this.player.y / HEIGHT;
    this.oxygen = Math.max(0, this.oxygen - delta * (0.64 + depthFactor * 0.28));
    this.hudAccumulator += delta;

    if (this.hudAccumulator >= 0.1) {
      this.hudAccumulator = 0;
      this.publishHud();
    }

    if (this.oxygen <= 0) {
      this.callbacks.onToast("氧气耗尽，救援浮标正在回收潜水员");
      this.finishDive(true);
    }

    this.drawWorld(time);
  }

  setDirection(direction: DiveDirection, active: boolean): void {
    this.touchDirections[direction] = active;
  }

  queueInteraction(): void {
    this.queuedAction = true;
  }

  queueSurface(): void {
    this.queuedSurface = true;
  }

  private readInput(delta: number): void {
    const cursor = this.input.keyboard?.createCursorKeys();
    const left =
      this.touchDirections.left || Boolean(this.keys?.left.isDown) || Boolean(cursor?.left.isDown);
    const right =
      this.touchDirections.right || Boolean(this.keys?.right.isDown) || Boolean(cursor?.right.isDown);
    const up = this.touchDirections.up || Boolean(this.keys?.up.isDown) || Boolean(cursor?.up.isDown);
    const down =
      this.touchDirections.down || Boolean(this.keys?.down.isDown) || Boolean(cursor?.down.isDown);

    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);

    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.hypot(dx, dy);
      dx /= magnitude;
      dy /= magnitude;
      this.player.x += dx * 142 * delta;
      this.player.y += dy * 142 * delta;
      if (dx !== 0) this.player.facing = Math.sign(dx);
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 24, WIDTH - 24);
    this.player.y = Phaser.Math.Clamp(this.player.y, 28, HEIGHT - 32);

    const keyboardAction = this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.action) : false;
    if (keyboardAction || this.queuedAction) {
      this.queuedAction = false;
      this.retrieveNearbyTarget();
    }

    const keyboardSurface = this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.surface) : false;
    if (keyboardSurface || this.queuedSurface) {
      this.queuedSurface = false;
      this.finishDive(false);
    }
  }

  private applyCurrents(delta: number): void {
    for (const current of CURRENTS) {
      const inside =
        this.player.x > current.x &&
        this.player.x < current.x + current.width &&
        this.player.y > current.y &&
        this.player.y < current.y + current.height;

      if (inside) {
        this.player.x += current.forceX * delta;
        this.player.y += current.forceY * delta;
      }
    }
  }

  private applyHazards(time: number, delta: number): void {
    this.hazardCooldown = Math.max(0, this.hazardCooldown - delta);

    for (const jelly of JELLIES) {
      const y = jelly.y + Math.sin(time / 900 + jelly.phase) * jelly.drift;
      const hit = Phaser.Math.Distance.Between(this.player.x, this.player.y, jelly.x, y);

      if (hit < this.player.radius + jelly.radius && this.hazardCooldown === 0) {
        this.oxygen = Math.max(0, this.oxygen - 9);
        this.hazardCooldown = 1.1;
        this.player.x += this.player.x < jelly.x ? -32 : 32;
        this.callbacks.onToast("刺胞生物损伤供氧管线：氧气 -9");
        this.publishHud();
      }
    }
  }

  private updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.y -= particle.speed * delta;
      if (particle.y < -8) {
        particle.y = HEIGHT + 8;
      }
    }
  }

  private retrieveNearbyTarget(): void {
    const target = TARGETS.find(
      ({ evidence, x, y }) =>
        !this.recovered.has(evidence.id) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 58,
    );

    if (!target) {
      this.callbacks.onToast("附近没有可验证的打捞目标");
      return;
    }

    if (this.cargo + target.evidence.weight > MAX_CARGO) {
      this.callbacks.onToast("载重已满，请返回水面");
      return;
    }

    this.recovered.add(target.evidence.id);
    this.cargo += target.evidence.weight;
    this.callbacks.onRecovered(target.evidence.id);
    this.callbacks.onToast(`${target.evidence.tool}完成：${target.evidence.name}`);
    this.publishHud();
  }

  private finishDive(forced: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.callbacks.onSurface({ recovered: [...this.recovered], forced });
  }

  private publishHud(): void {
    this.callbacks.onHud({
      oxygen: Math.max(0, Math.round(this.oxygen)),
      cargo: this.cargo,
      depth: Math.max(4, Math.round((this.player.y / HEIGHT) * 42)),
    });
  }

  private drawWorld(time: number): void {
    const graphics = this.graphics;
    graphics.clear();

    graphics.fillStyle(0x082b37, 1);
    graphics.fillRect(0, 0, WIDTH, HEIGHT);

    for (let index = 0; index < 5; index += 1) {
      const offset = Math.sin(time / 1400 + index) * 16;
      graphics.fillStyle(0x8be2d1, 0.045);
      graphics.fillTriangle(
        70 + index * 190 + offset,
        0,
        210 + index * 190 + offset,
        0,
        360 + index * 140 + offset,
        HEIGHT,
      );
    }

    graphics.fillStyle(0x03151c, 0.9);
    graphics.fillRect(0, 472, WIDTH, 68);
    graphics.fillStyle(0x07242d, 1);
    graphics.fillTriangle(110, 472, 310, 410, 520, 472);
    graphics.fillTriangle(430, 472, 710, 420, 900, 472);

    this.drawWreck(graphics);
    this.drawCurrents(graphics, time);
    this.drawTargets(graphics, time);
    this.drawJellies(graphics, time);

    for (const particle of this.particles) {
      graphics.fillStyle(0xc7fff2, 0.14);
      graphics.fillCircle(particle.x, particle.y, particle.radius);
    }

    graphics.fillStyle(0xf3c969, 1);
    graphics.fillCircle(this.player.x, this.player.y, this.player.radius);
    graphics.fillStyle(0x153d49, 1);
    graphics.fillRect(this.player.x - 9, this.player.y - 7, 18, 14);
    graphics.lineStyle(3, 0x78dcc8, 0.85);
    graphics.lineBetween(
      this.player.x - this.player.facing * 8,
      this.player.y + 5,
      this.player.x - this.player.facing * 24,
      this.player.y + 12,
    );
  }

  private drawWreck(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x0d3945, 1);
    graphics.fillRect(276, 322, 552, 120);
    graphics.fillTriangle(190, 442, 276, 322, 276, 442);
    graphics.fillTriangle(828, 322, 910, 442, 828, 442);
    graphics.lineStyle(4, 0x176274, 0.8);
    graphics.strokeRect(300, 346, 490, 72);

    for (let index = 0; index < 7; index += 1) {
      graphics.fillStyle(0x031820, 1);
      graphics.fillRect(330 + index * 63, 365, 34, 27);
    }
  }

  private drawCurrents(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const current of CURRENTS) {
      graphics.lineStyle(2, 0x78dcc8, 0.2);
      for (let row = 0; row < 4; row += 1) {
        const shift = (time / 24) % 36;
        const y = current.y + 18 + row * 18;
        for (let x = current.x - 36 + shift; x < current.x + current.width; x += 36) {
          graphics.lineBetween(x, y, x + Math.sign(current.forceX) * 18, y + current.forceY);
        }
      }
    }
  }

  private drawTargets(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const target of TARGETS) {
      if (this.recovered.has(target.evidence.id)) continue;
      const pulse = 14 + Math.sin(time / 260 + target.x) * 3;
      graphics.lineStyle(2, 0xf3c969, 0.65);
      graphics.strokeCircle(target.x, target.y, pulse + 7);
      graphics.fillStyle(0xf3c969, 0.88);
      graphics.fillCircle(target.x, target.y, pulse * 0.45);
    }
  }

  private drawJellies(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const jelly of JELLIES) {
      const y = jelly.y + Math.sin(time / 900 + jelly.phase) * jelly.drift;
      graphics.fillStyle(0xd997ff, 0.52);
      graphics.fillCircle(jelly.x, y, jelly.radius);
      graphics.lineStyle(2, 0xe9c5ff, 0.48);
      graphics.lineBetween(jelly.x - 10, y + 16, jelly.x - 14, y + 39);
      graphics.lineBetween(jelly.x, y + 18, jelly.x + 2, y + 42);
      graphics.lineBetween(jelly.x + 10, y + 16, jelly.x + 15, y + 37);
    }
  }
}

export function createDiveGame(parent: HTMLElement, callbacks: DiveCallbacks): DiveController {
  const scene = new DiveScene(callbacks);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#061d27",
    scene: [scene],
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  return {
    destroy: () => game.destroy(true),
    interact: () => scene.queueInteraction(),
    setDirection: (direction, active) => scene.setDirection(direction, active),
    surface: () => scene.queueSurface(),
  };
}
