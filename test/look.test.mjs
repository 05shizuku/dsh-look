import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { apply } from '../src/index.mjs';

function toolUnderTest() {
  let tool;
  apply({ tools: { register(value) { tool = value; } }, effect() {} });
  assert.ok(tool, 'look_mode should register');
  return tool;
}

function isolatedHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-look-test-'));
  const previousHome = process.env.DSH_HOME;
  const previousFlag = process.env.DSH_LOOK_FLAG_FILE;
  process.env.DSH_HOME = home;
  delete process.env.DSH_LOOK_FLAG_FILE;
  t.after(() => {
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    if (previousFlag === undefined) delete process.env.DSH_LOOK_FLAG_FILE;
    else process.env.DSH_LOOK_FLAG_FILE = previousFlag;
    rmSync(home, { recursive: true, force: true });
  });
  return home;
}

test('off/on/off 双向切换与重复切换', async (t) => {
  const home = isolatedHome(t);
  const tool = toolUnderTest();
  const flag = join(home, 'dsh-orb', 'first-frame-off.json');

  const initial = await tool.execute({});
  assert.equal(initial.passiveVision.startsWith('on'), true);
  assert.equal(existsSync(flag), false);

  const off = await tool.execute({ action: 'off' });
  assert.equal(off.changed, true);
  assert.equal(off.passiveVision.startsWith('off'), true);
  assert.equal(existsSync(flag), true);

  const on = await tool.execute({ action: 'on' });
  assert.equal(on.passiveVision.startsWith('on'), true);
  assert.equal(existsSync(flag), false);

  const offAgain = await tool.execute({ action: 'off' });
  assert.equal(offAgain.passiveVision.startsWith('off'), true);
  assert.equal(existsSync(flag), true);
});

test('带 BOM 的旗标可读，空 meta 不输出 null', async (t) => {
  const home = isolatedHome(t);
  const tool = toolUnderTest();
  const flag = join(home, 'dsh-orb', 'first-frame-off.json');
  mkdirSync(dirname(flag), { recursive: true });
  writeFileSync(flag, '\uFEFF{"firstFrame":"off","by":"amikar"}', 'utf8');

  const state = await tool.execute({});
  assert.equal(state.passiveVision.startsWith('off'), true);
  assert.equal(state.meta.by, 'amikar');

  writeFileSync(flag, 'not-json', 'utf8');
  const invalid = await tool.execute({});
  assert.equal(Object.hasOwn(invalid, 'meta'), false);
});

test('DSH_LOOK_FLAG_FILE 显式路径优先于 DSH_HOME', async (t) => {
  const home = isolatedHome(t);
  const tool = toolUnderTest();
  const explicit = join(home, 'custom', 'vision-flag.json');
  process.env.DSH_LOOK_FLAG_FILE = explicit;

  const off = await tool.execute({ action: 'off' });
  assert.equal(off.flagPath, explicit);
  assert.equal(existsSync(explicit), true);
  assert.equal(existsSync(join(home, 'dsh-orb', 'first-frame-off.json')), false);
});
