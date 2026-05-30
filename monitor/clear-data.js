#!/usr/bin/env node

const Database = require('./database');

const db = new Database();

function main() {
  const args = process.argv.slice(2);
  const options = {
    confirm: args.includes('--confirm'),
    help: args.includes('--help') || args.includes('-h')
  };

  if (options.help) {
    console.log(`
MCP 工具调用记录清除工具

用法:
  node monitor/clear-data.js [选项]

选项:
  --confirm    确认清除所有数据（必需）
  --help, -h   显示此帮助信息

示例:
  node monitor/clear-data.js --confirm
`);
    process.exit(0);
  }

  if (!options.confirm) {
    console.log('请使用 --confirm 参数确认要清除所有数据');
    process.exit(1);
  }

  console.log('正在清除所有 MCP 工具调用记录...');
  const success = db.clearAll();

  if (success) {
    console.log('数据清除成功');
  } else {
    console.error('数据清除失败');
  }
}

main();
