import 'dotenv/config';
import { generateRoster } from './panelist';

async function main() {
  const topic = process.argv[2] ?? '远程办公是否会降低团队创新力';
  console.log(`\n[try] 议题：${topic}\n`);

  const list = await generateRoster(topic, 4);

  console.table(
    list.map((p) => ({
      角色: p.role,
      姓名: p.name,
      头衔: p.title,
      立场: p.stance,
      颜色: p.color,
    }))
  );
}

main().catch((e) => {
  console.error('[try] 失败：', e);
  process.exit(1);
});
