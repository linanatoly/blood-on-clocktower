// build-exe.mjs — 将 server.js 打包为独立 exe（免 Node.js）
import { build } from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, renameSync } from 'fs';

const BUNDLE_FILE = 'server-bundle.cjs';
const EXE_FILE = 'server.exe';

console.log('📦 步骤 1/3: esbuild 打包 ESM → CJS...');
await build({
  entryPoints: ['server.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: BUNDLE_FILE,
  external: [],           // 全部内联
  minify: false,
});
console.log(`   ✅ 已生成 ${BUNDLE_FILE}`);

console.log('🔨 步骤 2/3: pkg 编译为 exe...');
try {
  execSync(
    `npx pkg ${BUNDLE_FILE} --targets node18-win-x64 --output ${EXE_FILE}`,
    { stdio: 'inherit', timeout: 120000 }
  );
} catch (e) {
  console.error('❌ pkg 编译失败，可能原因：');
  console.error('   1. 首次编译需下载 node 二进制（约30MB），请确保网络畅通');
  console.error('   2. 若一直卡住，手动运行: npx pkg server-bundle.cjs --targets node18-win-x64');
  process.exit(1);
}

if (existsSync(EXE_FILE)) {
  console.log(`   ✅ 已生成 ${EXE_FILE}`);
} else {
  console.error('❌ 未找到输出文件');
  process.exit(1);
}

console.log('🧹 步骤 3/3: 清理临时文件...');
unlinkSync(BUNDLE_FILE);
console.log(`   ✅ 已删除 ${BUNDLE_FILE}`);

console.log('');
console.log('🎉 打包完成！双击 server.exe 即可启动服务器。');
