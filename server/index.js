const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const Database = require("../monitor/database");
const Analyzer = require("../monitor/analyzer");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database();
const analyzer = new Analyzer();

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, "..", "frontend")));

// API 路由

// 获取所有调用记录
app.get("/api/calls", (req, res) => {
  try {
    const query = {};

    if (req.query.tool) {
      query.tool = req.query.tool;
    }

    if (req.query.server) {
      query.server = req.query.server;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.startTime) {
      query.startTime = req.query.startTime;
    }

    if (req.query.endTime) {
      query.endTime = req.query.endTime;
    }

    const filteredCalls = db.findCalls(query);

    // 分页
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const calls = filteredCalls.slice(offset, offset + limit);

    res.json({
      success: true,
      data: calls,
      pagination: {
        offset,
        limit,
        total: filteredCalls.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取按 session_id 归并的调用记录
app.get("/api/calls-by-session", (req, res) => {
  try {
    const query = {};

    if (req.query.tool) {
      query.tool = req.query.tool;
    }

    if (req.query.server) {
      query.server = req.query.server;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.startTime) {
      query.startTime = req.query.startTime;
    }

    if (req.query.endTime) {
      query.endTime = req.query.endTime;
    }

    const calls = db.findCalls(query);

    // 按 session_id 归并
    const sessions = new Map();
    calls.forEach((call) => {
      const sessionId = call.context?.sessionId || "undefined";
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          sessionId,
          calls: [],
          startTime: call.timestamp,
          endTime: call.timestamp,
          totalDuration: 0,
          tools: new Set(),
          servers: new Set(),
          status: new Map(),
        });
      }

      const session = sessions.get(sessionId);
      session.calls.push(call);

      // 更新时间范围
      const callTime = new Date(call.timestamp);
      const sessionStartTime = new Date(session.startTime);
      const sessionEndTime = new Date(session.endTime);

      if (callTime < sessionStartTime) {
        session.startTime = call.timestamp;
      }
      if (callTime > sessionEndTime) {
        session.endTime = call.timestamp;
      }

      // 累加总耗时
      if (call.duration) {
        session.totalDuration += call.duration;
      }

      // 添加工具和服务器
      session.tools.add(call.tool);
      session.servers.add(call.server);

      // 统计状态
      const statusCount = session.status.get(call.status) || 0;
      session.status.set(call.status, statusCount + 1);
    });

    // 转换为数组并排序
    const sessionsArray = Array.from(sessions.values())
      .map((session) => ({
        ...session,
        tools: Array.from(session.tools),
        servers: Array.from(session.servers),
        status: Object.fromEntries(session.status),
        callCount: session.calls.length,
        avgDuration: Math.round(session.totalDuration / session.calls.length),
      }))
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    res.json({
      success: true,
      data: sessionsArray,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取统计信息
app.get("/api/stats", (req, res) => {
  try {
    const stats = db.getStatistics();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取图表数据
app.get("/api/graph", (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const graphData = db.getGraphData(sessionId);
    res.json({
      success: true,
      data: graphData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取调用链分析
app.get("/api/chains", (req, res) => {
  try {
    const chains = analyzer.getCallChains();
    res.json({
      success: true,
      data: chains,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取使用模式
app.get("/api/patterns", (req, res) => {
  try {
    const minSupport = parseInt(req.query.minSupport) || 1;
    const patterns = analyzer.getUsagePatterns(minSupport);
    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取性能分析
app.get("/api/performance", (req, res) => {
  try {
    const performance = analyzer.getPerformanceAnalysis();
    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取错误分析
app.get("/api/errors", (req, res) => {
  try {
    const errors = analyzer.getErrorAnalysis();
    res.json({
      success: true,
      data: errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取时间分布
app.get("/api/timedist", (req, res) => {
  try {
    const timeDist = analyzer.getTimeDistribution();
    res.json({
      success: true,
      data: timeDist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 生成综合报告
app.get("/api/report", (req, res) => {
  try {
    const report = analyzer.generateComprehensiveReport();
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 清除所有数据
app.delete("/api/calls", (req, res) => {
  try {
    const success = db.clearAll();
    res.json({
      success,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 修剪旧记录
app.delete("/api/calls/prune", (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 7;
    const result = db.pruneOldRecords(daysToKeep);

    if (result) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "修剪记录失败",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 获取服务器健康状态
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "服务器内部错误",
  });
});

// 404 处理
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "接口未找到",
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`MCP 监控服务器已启动，访问地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
