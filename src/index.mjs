// dsh-look · 视觉 consent 插件（2026-11-20 发布体检版）
// 规矩：默认不看，主动看必留痕，可拒绝。
// 旗标：first-frame-off.json 存在 = 被动看关；删除 = 恢复被动看。
// 路径优先级：DSH_LOOK_FLAG_FILE > DSH_HOME > dsh-look.local.json > ~/.dsh。
// 本包只管理视觉 consent；截屏能力由 dsh-orb 等工具提供，缺席时礼貌降级。
// 工具注册交标准 JSON Schema，不 import 宿主内部 @deepseek-ai/dsh-tools。

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-look';
export const inject = ['tools'];

const LOCAL_CONFIG_FILE = fileURLToPath(new URL('../dsh-look.local.json', import.meta.url));
const DEFAULT_FLAG_NAME = join('dsh-orb', 'first-frame-off.json');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function flagCandidates() {
  const explicit = process.env.DSH_LOOK_FLAG_FILE?.trim();
  if (explicit) return [explicit];
  if (process.env.DSH_HOME) return [join(process.env.DSH_HOME, DEFAULT_FLAG_NAME)];
  const local = readJson(LOCAL_CONFIG_FILE);
  if (typeof local?.flagPath === 'string' && local.flagPath.trim()) return [local.flagPath.trim()];
  return [join(homedir(), '.dsh', DEFAULT_FLAG_NAME)];
}

function flagState() {
  for (const path of flagCandidates()) {
    if (!existsSync(path)) continue;
    return { passive: false, path, meta: readJson(path) };
  }
  return { passive: true, path: flagCandidates()[0], meta: null };
}

function writeFlag(off) {
  const target = flagCandidates().find((path) => existsSync(path)) ?? flagCandidates()[0];
  mkdirSync(dirname(target), { recursive: true });
  if (off) {
    const tmp = target + '.tmp';
    writeFileSync(tmp, JSON.stringify({
      firstFrame: 'off',
      since: new Date().toISOString(),
      by: 'dsh-look',
      rule: '默认不看，主动看必留痕，可拒绝',
    }, null, 2), 'utf8');
    renameSync(tmp, target);
    return;
  }
  rmSync(target, { force: true });
}

export function apply(ctx) {
  const dispose = ctx.tools.register({
    name: 'look_mode',
    description:
      '查询或切换视觉 consent 状态（被动屏幕视觉的开关）。'
      + '不带参数=查询当前状态；action="off"=关闭被动看（创建旗标，视觉转为仅主动看）；'
      + 'action="on"=恢复被动看（删除旗标）。每次变更都在转录里留痕——这就是 consent 的实现方式。'
      + '开关语义归她：替她切换前先得到她的同意。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['off', 'on'], description: 'off=关被动看；on=恢复被动看。缺省=只查不改。' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          passiveVision: { type: 'string' },
          flagPath: { type: 'string' },
          meta: { type: 'object' },
          rule: { type: 'string' },
          changed: { type: 'boolean' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `视觉 consent：${value.passiveVision}` }],
    },
    async execute(args) {
      const action = args?.action;
      if (action !== undefined) writeFlag(action === 'off');
      const state = flagState();
      return {
        ...(action === undefined ? {} : { changed: true }),
        passiveVision: state.passive ? 'on（每轮自动附屏幕截图）' : 'off（仅主动看）',
        flagPath: state.path,
        ...(state.meta === null ? {} : { meta: state.meta }),
        rule: '默认不看，主动看必留痕，可拒绝',
      };
    },
  });
  if (typeof ctx.effect === 'function' && typeof dispose === 'function') {
    ctx.effect(() => dispose);
  }
}
