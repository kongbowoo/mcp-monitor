#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const Database = require('./database');
const Analyzer = require('./analyzer');

const program = new Command();

program
  .name('mcp-reporter')
  .description('MCP 工具调用分析报告生成器')
  .version('1.0.0');

program
  .option('--format <type>', '报告格式 (json, csv, html)', 'json')
  .option('--output <path>', '输出文件路径')
  .option('--limit <number>', '限制报告中的记录数')
  .option('--tool <name>', '过滤特定工具')
  .option('--server <name>', '过滤特定服务器')
  .option('--start <date>', '开始日期 (ISO 格式)')
  .option('--end <date>', '结束日期 (ISO 格式)');

program.parse(process.argv);

const options = program.opts();
const db = new Database();
const analyzer = new Analyzer();

/**
 * 生成 CSV 格式报告
 */
async function generateCsvReport(outputPath, query) {
  const calls = db.findCalls(query);

  if (calls.length === 0) {
    console.log('没有符合条件的调用记录');
    return;
  }

  // 准备数据
  const records = calls.map(call => ({
    id: call.id,
    tool: call.tool,
    server: call.server,
    operation: call.operation,
    timestamp: call.timestamp,
    duration: call.duration || '',
    status: call.status,
    input: JSON.stringify(call.input),
    output: JSON.stringify(call.output),
    sessionId: call.context.sessionId,
    conversationId: call.context.conversationId
  }));

  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'tool', title: '工具' },
      { id: 'server', title: '服务器' },
      { id: 'operation', title: '操作' },
      { id: 'timestamp', title: '时间戳' },
      { id: 'duration', title: '持续时间(ms)' },
      { id: 'status', title: '状态' },
      { id: 'input', title: '输入' },
      { id: 'output', title: '输出' },
      { id: 'sessionId', title: '会话ID' },
      { id: 'conversationId', title: '对话ID' }
    ]
  });

  await csvWriter.writeRecords(records);
  console.log(`CSV 报告已生成: ${outputPath}`);
}

/**
 * 生成 HTML 格式报告
 */
function generateHtmlReport(outputPath, query) {
  const calls = db.findCalls(query);
  const statistics = db.getStatistics();
  const performance = analyzer.getPerformanceAnalysis();
  const errors = analyzer.getErrorAnalysis();

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP 工具调用分析报告</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
        }
        h2 {
            color: #555;
            border-bottom: 2px solid #ddd;
            padding-bottom: 10px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .status-success {
            color: green;
        }
        .status-error {
            color: red;
        }
        .status-pending {
            color: orange;
        }
        .tools-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .tool-tag {
            background: #e9ecef;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
        }
        .report-time {
            text-align: right;
            color: #666;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>MCP 工具调用分析报告</h1>
        <div class="report-time">生成时间: ${new Date().toISOString()}</div>

        <h2>总体统计</h2>
        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${statistics.totalCalls}</div>
                <div class="stat-label">总调用次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.successfulCalls}</div>
                <div class="stat-label">成功次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.failedCalls}</div>
                <div class="stat-label">失败次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.avgDuration}</div>
                <div class="stat-label">平均耗时(ms)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(statistics.tools).length}</div>
                <div class="stat-label">工具数量</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(statistics.servers).length}</div>
                <div class="stat-label">服务器数量</div>
            </div>
        </div>

        <h2>调用详情</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>工具</th>
                    <th>服务器</th>
                    <th>时间</th>
                    <th>耗时(ms)</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                ${calls.slice(0, options.limit || calls.length).map(call => `
                    <tr>
                        <td>${call.id}</td>
                        <td>${call.tool}</td>
                        <td>${call.server}</td>
                        <td>${call.timestamp}</td>
                        <td>${call.duration}</td>
                        <td class="status-${call.status}">${call.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>工具使用统计</h2>
        ${Object.entries(statistics.tools).map(([tool, data]) => `
            <h3>${tool}</h3>
            <p>调用次数: ${data.count}, 成功: ${data.successful}, 失败: ${data.failed},
            平均耗时: ${data.avgDuration}ms</p>
        `).join('')}

        <h2>服务器使用统计</h2>
        ${Object.entries(statistics.servers).map(([server, data]) => `
            <h3>${server}</h3>
            <p>调用次数: ${data.count}, 成功: ${data.successful}, 失败: ${data.failed}</p>
            <div class="tools-list">
                ${data.tools.map(tool => `<span class="tool-tag">${tool}</span>`).join('')}
            </div>
        `).join('')}

        <h2>性能分析</h2>
        <h3>最慢的工具</h3>
        ${performance.slowest.map((item, index) => `
            <p>${index + 1}. ${item.tool}: 平均 ${item.avg}ms (${item.count} 次调用)</p>
        `).join('')}

        <h3>最快的工具</h3>
        ${performance.fastest.map((item, index) => `
            <p>${index + 1}. ${item.tool}: 平均 ${item.avg}ms (${item.count} 次调用)</p>
        `).join('')}

        <h2>错误分析</h2>
        <p>总错误数: ${errors.totalErrors}</p>

        <h3>按工具分类的错误</h3>
        ${Object.entries(errors.errorsByTool).map(([tool, count]) => `
            <p>${tool}: ${count} 次错误</p>
        `).join('')}

        <h3>常见错误类型</h3>
        ${errors.commonErrors.slice(0, 10).map((item, index) => `
            <p>${index + 1}. ${item.error}: ${item.count} 次</p>
        `).join('')}
    </div>
</body>
</html>
  `;

  fs.writeFileSync(outputPath, html);
  console.log(`HTML 报告已生成: ${outputPath}`);
}

/**
 * 生成 JSON 格式报告
 */
async function generateJsonReport(outputPath, query) {
  const report = analyzer.generateComprehensiveReport();
  const data = JSON.stringify(report, null, 2);
  fs.writeFileSync(outputPath, data);
  console.log(`JSON 报告已生成: ${outputPath}`);
}

/**
 * 主函数
 */
async function main() {
  const query = {};

  if (options.tool) {
    query.tool = options.tool;
  }

  if (options.server) {
    query.server = options.server;
  }

  if (options.start) {
    query.startTime = options.start;
  }

  if (options.end) {
    query.endTime = options.end;
  }

  // 确定输出路径
  let outputPath = options.output;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(__dirname, '..', `report-${timestamp}.${options.format}`);
  }

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成报告
  switch (options.format) {
    case 'json':
      await generateJsonReport(outputPath, query);
      break;
    case 'csv':
      await generateCsvReport(outputPath, query);
      break;
    case 'html':
      generateHtmlReport(outputPath, query);
      break;
    default:
      console.error(`不支持的格式: ${options.format}`);
      process.exit(1);
  }
}

main().catch(error => {
  console.error('生成报告失败:', error);
  process.exit(1);
});
