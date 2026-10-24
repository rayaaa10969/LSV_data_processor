import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = fileURLToPath(new URL('../dist/', import.meta.url));
const files = ['index.html', 'style.css', 'app.mjs', 'core.mjs', 'eis.mjs', 'eis-core.mjs'];

async function fixture(t, omitted) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lsv-build-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ['build-static.cjs', ...files]) {
    if (name !== omitted) await copyFile(path.join(source, name), path.join(dir, name));
  }
  return dir;
}

test('Vercel 构建生成 v3 配置与完整静态文件，支持重复构建', async t => {
  const dir = await fixture(t);
  const run = () => spawnSync(process.execPath, [path.join(dir, 'build-static.cjs')], { cwd: tmpdir(), encoding: 'utf8' });
  for (let i = 0; i < 2; i++) {
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    assert.match(built.stdout, /6 static files prepared/);
    const output = path.join(dir, '.vercel/output');
    assert.deepEqual(JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8')), { version: 3 });
    assert.deepEqual((await readdir(path.join(output, 'static'))).sort(), [...files].sort());
    for (const name of files) {
      assert.deepEqual(await readFile(path.join(output, 'static', name)), await readFile(path.join(source, name)));
    }
  }
});

test('任意必需文件缺失时构建必须失败，避免发布不完整页面', async t => {
  for (const missing of files) {
    await t.test(missing, async t => {
      const dir = await fixture(t, missing);
      const built = spawnSync(process.execPath, [path.join(dir, 'build-static.cjs')], { encoding: 'utf8' });
      assert.notEqual(built.status, 0);
      assert.ok(built.stderr.includes(missing), built.stderr);
      await assert.rejects(readdir(path.join(dir, '.vercel/output/static')), { code: 'ENOENT' });
    });
  }
});

test('页面引用的本地入口和模块依赖存在于部署文件中', async () => {
  const html = await readFile(path.join(source, 'index.html'), 'utf8');
  assert.match(html, /type="module" src="app\.mjs"/);
  assert.match(html, /href="style\.css"/);
  const app = await readFile(path.join(source, 'app.mjs'), 'utf8');
  assert.match(app, /from '\.\/core\.mjs'/);
});

