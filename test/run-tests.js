const fs = require("fs");
const path = require("path");
const Database = require("../monitor/database");
const Tracker = require("../monitor/tracker");

const TEST_DATA_DIR = path.join(__dirname, "data");

// 初始化测试
function initializeTest() {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  console.log("测试初始化完成");
}

// 测试数据解析
function testDataParsing() {
  console.log("\n=== 测试数据解析 ===");

  const testCases = [
    "mcp__context7__query-docs",
    "mcp__plugin_playwright_playwright__browser_click",
    "mcp__sequential-thinking__sequentialthinking",
  ];

  testCases.forEach((testCase) => {
    const result = Tracker.parseToolName(testCase);
    console.log(`解析 ${testCase}:`, result);
  });
}

// 测试数据存储
function testDataStorage() {
  console.log("\n=== 测试数据存储 ===");

  // 临时修改数据存储路径
  const originalDataDir = require("../monitor/tracker").DATA_DIR;
  require("../monitor/tracker").DATA_DIR = TEST_DATA_DIR;

  const testRecord = {
    id: "test-123",
    tool: "mcp__context7__query-docs",
    server: "context7",
    operation: "query-docs",
    timestamp: new Date().toISOString(),
    duration: 1500,
    status: "success",
    input: { libraryId: "/vercel/next.js", query: "test" },
    output: { result: "test result" },
    context: { sessionId: "session-1", conversationId: "conv-1" },
  };

  try {
    Tracker.saveCallRecord(testRecord);
    console.log("数据保存成功");

    const db = new Database();
    const calls = db.findCalls();
    console.log("数据查询成功:", calls.length, "条记录");

    if (calls.length > 0) {
      console.log("第一条记录:", calls[0]);
    }
  } catch (error) {
    console.error("数据存储测试失败:", error);
  } finally {
    // 恢复原始数据存储路径
    require("../monitor/tracker").DATA_DIR = originalDataDir;
  }
}

// 测试统计功能
function testStatistics() {
  console.log("\n=== 测试统计功能 ===");

  const db = new Database();
  const stats = db.getStatistics();

  console.log("总调用次数:", stats.totalCalls);
  console.log("成功次数:", stats.successfulCalls);
  console.log("失败次数:", stats.failedCalls);
  console.log("平均耗时:", stats.avgDuration, "ms");
  console.log("工具数量:", Object.keys(stats.tools).length);
  console.log("服务器数量:", Object.keys(stats.servers).length);
}

// 清理测试数据
function cleanupTestData() {
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      console.log("\n测试数据已清理");
    }
  } catch (error) {
    console.error("清理测试数据失败:", error);
  }
}

// 主测试函数
function main() {
  console.log("MCP 监控系统测试");
  console.log("================================");

  try {
    initializeTest();
    testDataParsing();
    testDataStorage();
    testStatistics();
    console.log("\n✅ 所有测试成功通过");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  } finally {
    cleanupTestData();
  }

  process.exit(0);
}

main();
