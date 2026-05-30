const Database = require("./database");

class Analyzer {
  constructor() {
    this.db = new Database();
  }

  /**
   * 获取调用链分析
   * 尝试找出同一会话中工具调用的顺序关系
   */
  getCallChains() {
    const calls = this.db.getAllCalls();

    // 按会话和时间分组
    const sessions = new Map();
    calls.forEach((call) => {
      const sessionId = call.context?.sessionId;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
      }
      sessions.get(sessionId).push(call);
    });

    // 对每个会话的调用按时间排序
    for (const [sessionId, sessionCalls] of sessions.entries()) {
      sessionCalls.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      );
    }

    // 构建调用链
    const chains = [];

    sessions.forEach((sessionCalls, sessionId) => {
      if (sessionCalls.length < 2) {
        return; // 至少需要两个调用才能形成链
      }

      const chain = {
        sessionId,
        calls: sessionCalls.map((call) => ({
          id: call.id,
          tool: call.tool,
          timestamp: call.timestamp,
          duration: call.duration,
        })),
        totalDuration: sessionCalls.reduce(
          (sum, call) => sum + (call.duration || 0),
          0,
        ),
      };

      chains.push(chain);
    });

    // 按调用数量降序排序
    chains.sort((a, b) => b.calls.length - a.calls.length);

    return chains;
  }

  /**
   * 获取工具使用模式
   * 找出经常一起使用的工具组合
   */
  getUsagePatterns(minSupport = 1) {
    const calls = this.db.getAllCalls();
    console.log("Total calls:", calls.length);
    const sessions = new Map();

    // 按会话分组工具调用
    calls.forEach((call) => {
      const sessionId = call.context?.sessionId;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
      }
      sessions.get(sessionId).add(call.tool);
    });

    console.log("Session count:", sessions.size);
    sessions.forEach((tools, sessionId) => {
      console.log("Session", sessionId, "tools:", Array.from(tools));
    });

    // 统计工具组合的支持度
    const combinations = new Map();

    sessions.forEach((tools) => {
      const toolArray = Array.from(tools);

      // 生成所有可能的组合
      for (let i = 0; i < toolArray.length; i++) {
        for (let j = i + 1; j < toolArray.length; j++) {
          const combo = [toolArray[i], toolArray[j]].sort().join("|");
          combinations.set(combo, (combinations.get(combo) || 0) + 1);
        }
      }
    });

    console.log("Combinations:", Array.from(combinations.entries()));

    // 过滤出支持度足够的组合
    const patterns = Array.from(combinations.entries())
      .filter(([combo, count]) => count >= minSupport)
      .map(([combo, count]) => ({
        tools: combo.split("|"),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    console.log("Patterns:", patterns);
    return patterns;
  }

  /**
   * 获取性能分析
   * 找出最慢和最快的工具
   */
  getPerformanceAnalysis() {
    const calls = this.db
      .getAllCalls()
      .filter((call) => call.status === "success" && call.duration != null);

    if (calls.length === 0) {
      return {
        slowest: [],
        fastest: [],
        mostConsistent: [],
        performanceByTool: {},
      };
    }

    // 按工具分组
    const tools = new Map();
    calls.forEach((call) => {
      if (!tools.has(call.tool)) {
        tools.set(call.tool, []);
      }
      tools.get(call.tool).push(call.duration);
    });

    // 计算每个工具的性能指标
    const performanceByTool = {};

    tools.forEach((durations, tool) => {
      const sum = durations.reduce((a, b) => a + b, 0);
      const avg = sum / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const variance =
        durations.reduce(
          (sum, duration) => sum + Math.pow(duration - avg, 2),
          0,
        ) / durations.length;
      const stdDev = Math.sqrt(variance);

      performanceByTool[tool] = {
        count: durations.length,
        avg: Math.round(avg),
        min,
        max,
        stdDev: Math.round(stdDev),
      };
    });

    // 获取最慢和最快的工具（基于平均时间）
    const sortedByAvg = Object.entries(performanceByTool).sort(
      ([, a], [, b]) => a.avg - b.avg,
    );

    const fastest = sortedByAvg.slice(0, 5).map(([tool, data]) => ({
      tool,
      avg: data.avg,
      count: data.count,
    }));

    const slowest = sortedByAvg
      .slice(-5)
      .reverse()
      .map(([tool, data]) => ({
        tool,
        avg: data.avg,
        count: data.count,
      }));

    // 获取最稳定的工具（标准偏差最小）
    const sortedByStdDev = Object.entries(performanceByTool).sort(
      ([, a], [, b]) => a.stdDev - b.stdDev,
    );

    const mostConsistent = sortedByStdDev.slice(0, 5).map(([tool, data]) => ({
      tool,
      stdDev: data.stdDev,
      avg: data.avg,
      count: data.count,
    }));

    return {
      slowest,
      fastest,
      mostConsistent,
      performanceByTool,
    };
  }

  /**
   * 获取时间分布分析
   * 显示工具调用在一天中的分布
   */
  getTimeDistribution() {
    const calls = this.db.getAllCalls();

    // 按小时分组
    const hourlyDistribution = new Array(24).fill(0);

    calls.forEach((call) => {
      const hour = new Date(call.timestamp).getHours();
      hourlyDistribution[hour]++;
    });

    return hourlyDistribution;
  }

  /**
   * 获取错误分析
   * 显示错误发生的频率和模式
   */
  getErrorAnalysis() {
    const calls = this.db
      .getAllCalls()
      .filter((call) => call.status === "error");

    if (calls.length === 0) {
      return {
        totalErrors: 0,
        errorsByTool: {},
        errorsByServer: {},
        commonErrors: [],
      };
    }

    // 按工具统计错误
    const errorsByTool = new Map();
    calls.forEach((call) => {
      errorsByTool.set(call.tool, (errorsByTool.get(call.tool) || 0) + 1);
    });

    // 按服务器统计错误
    const errorsByServer = new Map();
    calls.forEach((call) => {
      errorsByServer.set(
        call.server,
        (errorsByServer.get(call.server) || 0) + 1,
      );
    });

    // 分析常见的错误类型（基于 output 信息）
    const commonErrors = new Map();
    calls.forEach((call) => {
      if (call.output && call.output.error) {
        const error = call.output.error;
        commonErrors.set(error, (commonErrors.get(error) || 0) + 1);
      }
    });

    return {
      totalErrors: calls.length,
      errorsByTool: Object.fromEntries(errorsByTool),
      errorsByServer: Object.fromEntries(errorsByServer),
      commonErrors: Array.from(commonErrors.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * 生成综合分析报告
   */
  generateComprehensiveReport() {
    return {
      timestamp: new Date().toISOString(),
      callChains: this.getCallChains(),
      usagePatterns: this.getUsagePatterns(),
      performance: this.getPerformanceAnalysis(),
      timeDistribution: this.getTimeDistribution(),
      errors: this.getErrorAnalysis(),
      statistics: this.db.getStatistics(),
    };
  }
}

module.exports = Analyzer;
