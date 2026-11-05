import { dashboard } from '@lark-base-open/js-sdk';

const host = document.getElementById('host');
const save = document.getElementById('save');
const result = document.getElementById('result');
document.getElementById('script').textContent = '脚本已启动';

async function connect() {
  if (window.self === window.top) {
    host.textContent = '请在飞书仪表盘中添加此页面，以验证连接';
    return;
  }
  const timer = setTimeout(() => {
    host.textContent = '页面已运行，仍在等待仪表盘回应';
  }, 8000);
  try {
    const ready = await dashboard.setRendered();
    host.textContent = ready ? '飞书仪表盘已确认连接' : '飞书尚未确认连接';
    save.hidden = !ready || !['Create', 'Config'].includes(dashboard.state);
  } catch {
    host.textContent = '飞书连接失败，请重新打开测试组件';
  } finally {
    clearTimeout(timer);
  }
}

save.onclick = async () => {
  save.disabled = true;
  try {
    const saved = await dashboard.saveConfig({dataConditions: [], customConfig: { version: 1 }});
    result.textContent = saved ? '测试组件已保存' : '仪表盘未确认保存';
    save.hidden = Boolean(saved);
  } catch {
    result.textContent = '保存失败，可重试';
  } finally {
    save.disabled = false;
  }
};
connect();
