import Phaser from "phaser";

import type {
  DiveTarget,
  Evidence,
  LevelDefinition,
  VentHazard,
} from "../domain/game";

export type DiveDirection = "up" | "down" | "left" | "right";

export interface DiveHud {
  oxygen: number;
  cargo: number;
  depth: number;
  recovered: number;
  total: number;
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

interface SalvageTarget extends DiveTarget {
  evidence: Evidence;
}

type ControlKey = "up" | "down" | "left" | "right" | "action" | "surface";
type ControlKeys = Record<ControlKey, Phaser.Input.Keyboard.Key>;

const WIDTH = 960;
const HEIGHT = 540;

class DiveScene extends Phaser.Scene {
  private readonly level: LevelDefinition;
  private readonly callbacks: DiveCallbacks;
  private readonly targets: readonly SalvageTarget[];
  private graphics!: Phaser.GameObjects.Graphics;
  private keys?: ControlKeys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly touchDirections: Record<DiveDirection, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  private readonly recovered = new Set<string>();
  private readonly particles = Array.from({ length: 96 }, (_, index) => ({
    x: (index * 137) % WIDTH,
    y: (index * 83) % HEIGHT,
    radius: 0.6 + (index % 4) * 0.45,
    speed: 5 + (index % 7) * 1.4,
    drift: ((index % 5) - 2) * 0.65,
  }));
  private readonly fish = Array.from({ length: 16 }, (_, index) => ({
    x: (index * 211) % WIDTH,
    y: 55 + ((index * 71) % 360),
    speed: 10 + (index % 5) * 4,
    scale: 0.55 + (index % 4) * 0.16,
    direction: index % 2 === 0 ? 1 : -1,
    layer: index % 3,
  }));
  private player: { x: number; y: number; radius: number; facing: number };
  private oxygen = 100;
  private cargo = 0;
  private hazardCooldown = 0;
  private gateHintCooldown = 0;
  private hudAccumulator = 0;
  private queuedAction = false;
  private queuedSurface = false;
  private finished = false;
  private gateUnlocked: boolean;

  constructor(level: LevelDefinition, callbacks: DiveCallbacks) {
    super(`dive-${level.id}`);
    this.level = level;
    this.callbacks = callbacks;
    this.player = {
      x: level.dive.startX,
      y: level.dive.startY,
      radius: 16,
      facing: 1,
    };
    this.gateUnlocked = !level.dive.gate;

    const evidenceById = new Map(level.evidence.map((item) => [item.id, item]));
    this.targets = level.dive.targets.map((target) => {
      const evidence = evidenceById.get(target.evidenceId);
      if (!evidence) throw new Error(`关卡 ${level.id} 缺少证据 ${target.evidenceId}`);
      return { ...target, evidence };
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.level.dive.palette.deep);
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
      this.cursors = keyboard.createCursorKeys();
      keyboard.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
      ]);
    }

    this.publishHud();
    this.callbacks.onToast(`${this.level.location}信号已锁定`);
  }

  update(time: number, deltaMs: number): void {
    if (this.finished) return;

    const delta = Math.min(deltaMs / 1000, 0.04);
    this.readInput(delta);
    this.applyCurrents(delta);
    this.applyHazards(time, delta);
    this.updateAmbient(delta);

    const depthFactor = this.player.y / HEIGHT;
    this.oxygen = Math.max(
      0,
      this.oxygen - delta * (this.level.dive.oxygenDrain + depthFactor * 0.3),
    );
    this.hudAccumulator += delta;
    this.gateHintCooldown = Math.max(0, this.gateHintCooldown - delta);

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
    const left =
      this.touchDirections.left || Boolean(this.keys?.left.isDown) || Boolean(this.cursors?.left.isDown);
    const right =
      this.touchDirections.right ||
      Boolean(this.keys?.right.isDown) ||
      Boolean(this.cursors?.right.isDown);
    const up =
      this.touchDirections.up || Boolean(this.keys?.up.isDown) || Boolean(this.cursors?.up.isDown);
    const down =
      this.touchDirections.down || Boolean(this.keys?.down.isDown) || Boolean(this.cursors?.down.isDown);

    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);
    const previousX = this.player.x;

    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.hypot(dx, dy);
      dx /= magnitude;
      dy /= magnitude;
      this.player.x += dx * 146 * delta;
      this.player.y += dy * 146 * delta;
      if (dx !== 0) this.player.facing = Math.sign(dx);
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 24, WIDTH - 24);
    this.player.y = Phaser.Math.Clamp(this.player.y, 28, HEIGHT - 32);
    this.applyGateCollision(previousX);

    const keyboardAction = this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.action) : false;
    if (keyboardAction || this.queuedAction) {
      this.queuedAction = false;
      this.interactNearby();
    }

    const keyboardSurface = this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.surface) : false;
    if (keyboardSurface || this.queuedSurface) {
      this.queuedSurface = false;
      this.finishDive(false);
    }
  }

  private applyGateCollision(previousX: number): void {
    const gate = this.level.dive.gate;
    if (!gate || this.gateUnlocked) return;
    if (this.player.y < gate.top || this.player.y > gate.bottom) return;

    const crossedFromLeft = previousX < gate.x && this.player.x >= gate.x - 8;
    const crossedFromRight = previousX > gate.x && this.player.x <= gate.x + 8;
    if (!crossedFromLeft && !crossedFromRight) return;

    this.player.x = crossedFromLeft ? gate.x - 22 : gate.x + 22;
    if (this.gateHintCooldown === 0) {
      this.callbacks.onToast("隔离闸门锁定：寻找外部控制台");
      this.gateHintCooldown = 1.8;
    }
  }

  private interactNearby(): void {
    const gate = this.level.dive.gate;
    if (gate && !this.gateUnlocked) {
      const consoleDistance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        gate.consoleX,
        gate.consoleY,
      );
      if (consoleDistance < 58) {
        this.gateUnlocked = true;
        this.callbacks.onToast("脉冲扫描完成：隔离闸门已开启");
        this.cameras.main.flash(180, 120, 220, 200, false);
        return;
      }
    }

    this.retrieveNearbyTarget();
  }

  private applyCurrents(delta: number): void {
    for (const current of this.level.dive.currents) {
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

    for (const jelly of this.level.dive.jellies) {
      const y = jelly.y + Math.sin(time / 900 + jelly.phase) * jelly.drift;
      const hit = Phaser.Math.Distance.Between(this.player.x, this.player.y, jelly.x, y);

      if (hit < this.player.radius + jelly.radius && this.hazardCooldown === 0) {
        this.damagePlayer(9, "刺胞生物损伤供氧管线：氧气 -9", jelly.x);
      }
    }

    for (const vent of this.level.dive.vents) {
      if (!this.isVentActive(vent, time)) continue;
      const inside =
        Math.abs(this.player.x - vent.x) < vent.width / 2 + this.player.radius &&
        this.player.y > vent.y - vent.height &&
        this.player.y < vent.y + 16;

      if (inside && this.hazardCooldown === 0) {
        this.player.y = Math.max(30, this.player.y - 54);
        this.damagePlayer(8, "压力喷口冲击潜水服：氧气 -8", vent.x);
      }
    }
  }

  private damagePlayer(amount: number, message: string, sourceX: number): void {
    this.oxygen = Math.max(0, this.oxygen - amount);
    this.hazardCooldown = 1.05;
    this.player.x += this.player.x < sourceX ? -28 : 28;
    this.callbacks.onToast(message);
    this.cameras.main.shake(130, 0.004);
    this.publishHud();
  }

  private isVentActive(vent: VentHazard, time: number): boolean {
    const seconds = time / 1000 + vent.phase;
    return seconds % vent.period < vent.activeFor;
  }

  private updateAmbient(delta: number): void {
    for (const particle of this.particles) {
      particle.y -= particle.speed * delta;
      particle.x += particle.drift * delta;
      if (particle.y < -8) particle.y = HEIGHT + 8;
      if (particle.x < -8) particle.x = WIDTH + 8;
      if (particle.x > WIDTH + 8) particle.x = -8;
    }

    for (const fish of this.fish) {
      fish.x += fish.speed * fish.direction * delta;
      if (fish.direction > 0 && fish.x > WIDTH + 40) fish.x = -40;
      if (fish.direction < 0 && fish.x < -40) fish.x = WIDTH + 40;
    }
  }

  private retrieveNearbyTarget(): void {
    const target = this.targets.find(
      ({ evidence, x, y }) =>
        !this.recovered.has(evidence.id) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 60,
    );

    if (!target) {
      this.callbacks.onToast("附近没有可验证的打捞目标");
      return;
    }

    if (this.cargo + target.evidence.weight > this.level.maxCargo) {
      this.callbacks.onToast("载重不足：必须放弃部分证据并返回水面");
      return;
    }

    this.recovered.add(target.evidence.id);
    this.cargo += target.evidence.weight;
    this.callbacks.onRecovered(target.evidence.id);
    this.callbacks.onToast(`${target.evidence.tool}完成：${target.evidence.name}`);
    this.cameras.main.flash(90, 243, 201, 105, false);
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
      depth: Math.max(
        4,
        Math.round(4 + (this.player.y / HEIGHT) * (this.level.dive.maxDepth - 4)),
      ),
      recovered: this.recovered.size,
      total: this.targets.length,
    });
  }

  private drawWorld(time: number): void {
    const graphics = this.graphics;
    graphics.clear();

    this.drawWater(graphics, time);
    this.drawDistantTerrain(graphics, time);

    if (this.level.dive.variant === "freighter") {
      this.drawFreighter(graphics, time);
    } else {
      this.drawStation(graphics, time);
    }

    this.drawCurrents(graphics, time);
    this.drawVents(graphics, time);
    this.drawGate(graphics, time);
    this.drawTargets(graphics, time);
    this.drawJellies(graphics, time);
    this.drawFish(graphics, time);

    for (const particle of this.particles) {
      graphics.fillStyle(0xc7fff2, this.level.dive.variant === "station" ? 0.1 : 0.15);
      graphics.fillCircle(particle.x, particle.y, particle.radius);
    }

    this.drawPlayer(graphics, time);
    this.drawDepthVignette(graphics);
  }

  private drawWater(graphics: Phaser.GameObjects.Graphics, time: number): void {
    const palette = this.level.dive.palette;
    graphics.fillStyle(palette.deep, 1);
    graphics.fillRect(0, 0, WIDTH, HEIGHT);
    graphics.fillStyle(palette.middle, 0.92);
    graphics.fillRect(0, 0, WIDTH, 350);
    graphics.fillStyle(palette.shallow, this.level.dive.variant === "station" ? 0.3 : 0.52);
    graphics.fillRect(0, 0, WIDTH, 150);

    const rayCount = this.level.dive.variant === "station" ? 3 : 7;
    for (let index = 0; index < rayCount; index += 1) {
      const offset = Math.sin(time / 1500 + index * 1.7) * 22;
      graphics.fillStyle(this.level.dive.palette.glow, 0.025 + (index % 2) * 0.015);
      graphics.fillTriangle(
        30 + index * 155 + offset,
        0,
        128 + index * 155 + offset,
        0,
        270 + index * 118 + offset,
        HEIGHT,
      );
    }

    for (let row = 0; row < 4; row += 1) {
      const wave = Math.sin(time / 900 + row) * 18;
      graphics.lineStyle(1, this.level.dive.palette.glow, 0.06);
      graphics.lineBetween(0, 82 + row * 66 + wave, WIDTH, 72 + row * 66 - wave);
    }
  }

  private drawDistantTerrain(graphics: Phaser.GameObjects.Graphics, time: number): void {
    graphics.fillStyle(0x020d13, 0.62);
    graphics.fillTriangle(0, 470, 170, 386 + Math.sin(time / 1600) * 4, 340, 470);
    graphics.fillTriangle(250, 470, 520, 402, 730, 470);
    graphics.fillTriangle(610, 470, 830, 374, WIDTH, 470);
    graphics.fillStyle(0x03151c, 0.94);
    graphics.fillRect(0, 470, WIDTH, 70);

    for (let index = 0; index < 14; index += 1) {
      const x = 30 + index * 72;
      const height = 15 + (index % 5) * 7;
      graphics.lineStyle(3, 0x176052, 0.35);
      graphics.lineBetween(x, 474, x + Math.sin(time / 800 + index) * 5, 474 - height);
      graphics.lineBetween(x + 4, 474, x + 13, 474 - height * 0.62);
    }
  }

  private drawFreighter(graphics: Phaser.GameObjects.Graphics, time: number): void {
    graphics.fillStyle(0x0b3540, 1);
    graphics.fillRect(268, 320, 568, 126);
    graphics.fillTriangle(176, 446, 268, 320, 268, 446);
    graphics.fillTriangle(836, 320, 922, 446, 836, 446);
    graphics.fillStyle(0x0f4652, 1);
    graphics.fillRect(338, 274, 224, 50);
    graphics.fillRect(596, 292, 132, 32);
    graphics.lineStyle(4, 0x1d6d7b, 0.7);
    graphics.strokeRect(298, 344, 500, 74);
    graphics.lineBetween(562, 274, 596, 320);

    for (let index = 0; index < 7; index += 1) {
      const flicker = 0.2 + Math.max(0, Math.sin(time / 450 + index)) * 0.16;
      graphics.fillStyle(index === 5 ? 0xff8f6b : 0x031820, 1);
      graphics.fillRect(326 + index * 65, 362, 36, 28);
      graphics.fillStyle(0x78dcc8, flicker);
      graphics.fillRect(330 + index * 65, 366, 28, 20);
    }

    graphics.lineStyle(5, 0x072029, 0.9);
    graphics.lineBetween(250, 446, 212, 482);
    graphics.lineBetween(720, 446, 764, 486);
    graphics.lineBetween(802, 446, 844, 482);
  }

  private drawStation(graphics: Phaser.GameObjects.Graphics, time: number): void {
    graphics.fillStyle(0x071b29, 1);
    graphics.fillCircle(710, 316, 148);
    graphics.fillStyle(0x0c2c3b, 1);
    graphics.fillCircle(710, 316, 112);
    graphics.fillStyle(0x04121c, 1);
    graphics.fillCircle(710, 316, 68);
    graphics.lineStyle(6, 0x176274, 0.7);
    graphics.strokeCircle(710, 316, 130);
    graphics.strokeCircle(710, 316, 82);

    const reactorPulse = 0.13 + Math.max(0, Math.sin(time / 520)) * 0.16;
    graphics.fillStyle(0x78dcc8, reactorPulse);
    graphics.fillCircle(710, 316, 48);

    graphics.fillStyle(0x0b3040, 1);
    graphics.fillRect(130, 340, 350, 88);
    graphics.fillRect(500, 286, 92, 74);
    graphics.fillRect(480, 304, 250, 36);
    graphics.fillRect(796, 252, 132, 96);
    graphics.lineStyle(3, 0x1c5e70, 0.65);
    graphics.strokeRect(152, 360, 294, 46);
    graphics.strokeRect(812, 268, 94, 62);

    for (let index = 0; index < 5; index += 1) {
      graphics.fillStyle(index === 3 ? 0xff8f6b : 0x78dcc8, 0.2 + (index % 2) * 0.12);
      graphics.fillRect(178 + index * 52, 373, 28, 18);
    }

    graphics.lineStyle(2, 0xff8f6b, 0.28);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + time / 6000;
      graphics.lineBetween(
        710 + Math.cos(angle) * 86,
        316 + Math.sin(angle) * 86,
        710 + Math.cos(angle) * 122,
        316 + Math.sin(angle) * 122,
      );
    }
  }

  private drawCurrents(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const current of this.level.dive.currents) {
      graphics.lineStyle(2, this.level.dive.palette.glow, 0.18);
      for (let row = 0; row < 4; row += 1) {
        const direction = Math.sign(current.forceX || 1);
        const shift = ((time / 24) % 36) * direction;
        const y = current.y + 18 + row * 18;
        for (let x = current.x - 36 + shift; x < current.x + current.width; x += 36) {
          graphics.lineBetween(x, y, x + direction * 18, y + current.forceY * 0.2);
        }
      }
    }
  }

  private drawVents(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const vent of this.level.dive.vents) {
      const active = this.isVentActive(vent, time);
      graphics.fillStyle(0x0c3540, 1);
      graphics.fillRect(vent.x - vent.width / 2, vent.y - 10, vent.width, 20);
      graphics.lineStyle(2, active ? 0xff8f6b : 0x176274, active ? 0.8 : 0.35);
      graphics.strokeRect(vent.x - vent.width / 2, vent.y - 10, vent.width, 20);

      if (!active) continue;
      for (let index = 0; index < 5; index += 1) {
        const sway = Math.sin(time / 120 + index) * 10;
        graphics.fillStyle(0xff8f6b, 0.06 + index * 0.018);
        graphics.fillTriangle(
          vent.x - vent.width / 2 + index * (vent.width / 5),
          vent.y,
          vent.x + sway,
          vent.y - vent.height,
          vent.x + vent.width / 2 - index * 4,
          vent.y,
        );
      }
    }
  }

  private drawGate(graphics: Phaser.GameObjects.Graphics, time: number): void {
    const gate = this.level.dive.gate;
    if (!gate) return;

    graphics.fillStyle(0x082634, 1);
    graphics.fillRect(gate.x - 16, gate.top - 20, 32, gate.bottom - gate.top + 40);
    graphics.lineStyle(3, this.gateUnlocked ? 0x78dcc8 : 0xff8f6b, 0.78);

    if (this.gateUnlocked) {
      graphics.strokeRect(gate.x - 34, gate.top, 18, gate.bottom - gate.top);
      graphics.strokeRect(gate.x + 16, gate.top, 18, gate.bottom - gate.top);
    } else {
      graphics.strokeRect(gate.x - 14, gate.top, 28, gate.bottom - gate.top);
      for (let y = gate.top + 16; y < gate.bottom; y += 24) {
        graphics.lineBetween(gate.x - 12, y, gate.x + 12, y);
      }
    }

    const consolePulse = 0.35 + Math.max(0, Math.sin(time / 260)) * 0.45;
    graphics.fillStyle(this.gateUnlocked ? 0x78dcc8 : 0xf3c969, consolePulse);
    graphics.fillRect(gate.consoleX - 13, gate.consoleY - 18, 26, 36);
    graphics.lineStyle(2, 0xc7fff2, 0.58);
    graphics.strokeRect(gate.consoleX - 16, gate.consoleY - 21, 32, 42);
  }

  private drawTargets(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const target of this.targets) {
      if (this.recovered.has(target.evidence.id)) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      const pulse = 13 + Math.sin(time / 260 + target.x) * 3;
      const close = distance < 64;
      graphics.lineStyle(close ? 3 : 2, this.level.dive.palette.accent, close ? 0.95 : 0.55);
      graphics.strokeCircle(target.x, target.y, pulse + (close ? 12 : 7));
      graphics.fillStyle(this.level.dive.palette.accent, close ? 1 : 0.78);
      graphics.fillCircle(target.x, target.y, pulse * 0.42);
      graphics.lineStyle(1, this.level.dive.palette.accent, 0.28);
      graphics.lineBetween(target.x, target.y - 24, target.x, target.y - 38);
    }
  }

  private drawJellies(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const jelly of this.level.dive.jellies) {
      const y = jelly.y + Math.sin(time / 900 + jelly.phase) * jelly.drift;
      graphics.fillStyle(0xd997ff, 0.48);
      graphics.fillCircle(jelly.x, y, jelly.radius);
      graphics.fillStyle(0xe9c5ff, 0.16);
      graphics.fillCircle(jelly.x - 6, y - 6, jelly.radius * 0.55);
      graphics.lineStyle(2, 0xe9c5ff, 0.44);
      graphics.lineBetween(jelly.x - 10, y + 16, jelly.x - 14, y + 39);
      graphics.lineBetween(jelly.x, y + 18, jelly.x + 2, y + 42);
      graphics.lineBetween(jelly.x + 10, y + 16, jelly.x + 15, y + 37);
    }
  }

  private drawFish(graphics: Phaser.GameObjects.Graphics, time: number): void {
    for (const fish of this.fish) {
      if (this.level.dive.variant === "station" && fish.layer === 2) continue;
      const y = fish.y + Math.sin(time / 700 + fish.x * 0.01) * 5;
      const length = 15 * fish.scale;
      const height = 7 * fish.scale;
      const color = fish.layer === 0 ? 0x78dcc8 : 0x8ba9aa;
      graphics.fillStyle(color, fish.layer === 0 ? 0.22 : 0.13);
      graphics.fillTriangle(
        fish.x + fish.direction * length,
        y,
        fish.x - fish.direction * length * 0.55,
        y - height,
        fish.x - fish.direction * length * 0.55,
        y + height,
      );
      graphics.fillTriangle(
        fish.x - fish.direction * length * 0.45,
        y,
        fish.x - fish.direction * length,
        y - height,
        fish.x - fish.direction * length,
        y + height,
      );
    }
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics, time: number): void {
    const facing = this.player.facing;
    const lightLength = this.level.dive.variant === "station" ? 178 : 132;
    graphics.fillStyle(this.level.dive.palette.glow, this.level.dive.variant === "station" ? 0.075 : 0.04);
    graphics.fillTriangle(
      this.player.x + facing * 10,
      this.player.y - 5,
      this.player.x + facing * lightLength,
      this.player.y - 62,
      this.player.x + facing * lightLength,
      this.player.y + 62,
    );

    const bubbleOffset = (time / 65) % 46;
    for (let index = 0; index < 4; index += 1) {
      graphics.lineStyle(1, 0xc7fff2, 0.3 - index * 0.05);
      graphics.strokeCircle(
        this.player.x - facing * (18 + index * 6),
        this.player.y - ((bubbleOffset + index * 13) % 48),
        2 + (index % 2),
      );
    }

    graphics.fillStyle(0xf3c969, 1);
    graphics.fillCircle(this.player.x, this.player.y - 6, 13);
    graphics.fillStyle(0x123d49, 1);
    graphics.fillCircle(this.player.x + facing * 3, this.player.y - 7, 8);
    graphics.fillStyle(0x0a2732, 1);
    graphics.fillRect(this.player.x - 9, this.player.y + 5, 18, 19);
    graphics.fillStyle(0x176274, 1);
    graphics.fillRect(this.player.x - facing * 14, this.player.y + 4, 8, 21);
    graphics.lineStyle(3, 0x78dcc8, 0.82);
    graphics.lineBetween(
      this.player.x - 4,
      this.player.y + 22,
      this.player.x - facing * 16,
      this.player.y + 34,
    );
    graphics.lineBetween(
      this.player.x + 5,
      this.player.y + 22,
      this.player.x + facing * 17,
      this.player.y + 33,
    );

    const sonarRadius = 34 + ((time / 24) % 80);
    graphics.lineStyle(1, this.level.dive.palette.glow, Math.max(0, 0.22 - sonarRadius / 430));
    graphics.strokeCircle(this.player.x, this.player.y, sonarRadius);
  }

  private drawDepthVignette(graphics: Phaser.GameObjects.Graphics): void {
    if (this.level.dive.variant !== "station") return;
    graphics.fillStyle(0x01060b, 0.26);
    graphics.fillRect(0, 0, WIDTH, 36);
    graphics.fillRect(0, HEIGHT - 34, WIDTH, 34);
    graphics.fillRect(0, 0, 42, HEIGHT);
    graphics.fillRect(WIDTH - 42, 0, 42, HEIGHT);
  }
}

export function createDiveGame(
  parent: HTMLElement,
  level: LevelDefinition,
  callbacks: DiveCallbacks,
): DiveController {
  const scene = new DiveScene(level, callbacks);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: level.dive.palette.deep,
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
