const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CALLS_FILE = path.join(DATA_DIR, "calls.json");

class Database {
  constructor() {
    // 确保数据目录存在
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 确保数据文件存在
    if (!fs.existsSync(CALLS_FILE)) {
      fs.writeFileSync(CALLS_FILE, JSON.stringify([], null, 2));
    }
  }

  /**
   * 获取所有调用记录
   */
  getAllCalls() {
    try {
      const data = JSON.parse(fs.readFileSync(CALLS_FILE, "utf8"));
      return data;
    } catch (error) {
      console.error("Error reading calls:", error);
      return [];
    }
  }

  /**
   * 根据条件查询调用记录
   */
  findCalls(query = {}) {
    const allCalls = this.getAllCalls();

    return allCalls.filter((call) => {
      // 工具名称过滤
      if (query.tool && !call.tool.includes(query.tool)) {
        return false;
      }

      // 服务器名称过滤
      if (query.server && call.server !== query.server) {
        return false;
      }

      // 状态过滤
      if (query.status && call.status !== query.status) {
        return false;
      }

      // 时间范围过滤
      if (query.startTime) {
        const callTime = new Date(call.timestamp);
        const startTime = new Date(query.startTime);
        if (callTime < startTime) {
          return false;
        }
      }

      if (query.endTime) {
        const callTime = new Date(call.timestamp);
        const endTime = new Date(query.endTime);
        if (callTime > endTime) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 获取调用统计信息
   */
  getStatistics() {
    const allCalls = this.getAllCalls();

    const stats = {
      totalCalls: allCalls.length,
      successfulCalls: allCalls.filter((call) => call.status === "success")
        .length,
      failedCalls: allCalls.filter((call) => call.status === "error").length,
      pendingCalls: allCalls.filter((call) => call.status === "pending").length,
      avgDuration: 0,
      tools: {},
      servers: {},
    };

    // 计算平均持续时间（只统计成功的调用）
    const successfulWithDuration = allCalls.filter(
      (call) => call.status === "success" && call.duration != null,
    );
    if (successfulWithDuration.length > 0) {
      const totalDuration = successfulWithDuration.reduce(
        (sum, call) => sum + call.duration,
        0,
      );
      stats.avgDuration = Math.round(
        totalDuration / successfulWithDuration.length,
      );
    }

    // 工具统计
    allCalls.forEach((call) => {
      if (!stats.tools[call.tool]) {
        stats.tools[call.tool] = {
          count: 0,
          successful: 0,
          failed: 0,
          duration: 0,
        };
      }

      stats.tools[call.tool].count++;
      if (call.status === "success") {
        stats.tools[call.tool].successful++;
        if (call.duration != null) {
          stats.tools[call.tool].duration += call.duration;
        }
      } else if (call.status === "error") {
        stats.tools[call.tool].failed++;
      }
    });

    // 计算工具平均持续时间
    Object.keys(stats.tools).forEach((tool) => {
      if (stats.tools[tool].successful > 0) {
        stats.tools[tool].avgDuration = Math.round(
          stats.tools[tool].duration / stats.tools[tool].successful,
        );
      }
      delete stats.tools[tool].duration;
    });

    // 服务器统计
    allCalls.forEach((call) => {
      if (!stats.servers[call.server]) {
        stats.servers[call.server] = {
          count: 0,
          successful: 0,
          failed: 0,
          tools: new Set(),
        };
      }

      stats.servers[call.server].count++;
      if (call.status === "success") {
        stats.servers[call.server].successful++;
      } else if (call.status === "error") {
        stats.servers[call.server].failed++;
      }

      stats.servers[call.server].tools.add(call.tool);
    });

    // 转换 Set 为数组
    Object.keys(stats.servers).forEach((server) => {
      stats.servers[server].tools = Array.from(stats.servers[server].tools);
    });

    return stats;
  }

  /**
   * 获取调用关系图数据
   */
  getGraphData(sessionId = null) {
    // 当没有指定 sessionId 时，返回空数据
    if (!sessionId) {
      return {
        nodes: [],
        links: [],
      };
    }

    const allCalls = this.getAllCalls();
    const nodes = new Map();
    const links = new Map();

    // 按会话分组调用
    const sessions = new Map();
    allCalls.forEach((call) => {
      const callSessionId = call.context?.sessionId;
      if (sessionId && callSessionId !== sessionId) {
        return; // 只返回指定会话的调用数据
      }
      if (!sessions.has(callSessionId)) {
        sessions.set(callSessionId, []);
      }
      sessions.get(callSessionId).push(call);
    });

    // 对每个会话的调用按时间排序
    sessions.forEach((calls) => {
      calls.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    // 为每个会话创建拓扑链路
    sessions.forEach((calls, callSessionId) => {
      // 添加会话节点
      if (!nodes.has(callSessionId)) {
        nodes.set(callSessionId, {
          id: callSessionId,
          type: "session",
          label: `Session: ${callSessionId.substring(0, 8)}...`,
          count: calls.length,
          tools: new Set(),
        });
      }

      // 添加工具节点（每个工具调用都创建独立节点，按时间顺序显示）
      calls.forEach((call, index) => {
        const toolNodeId = `${callSessionId}__${call.tool}__${index}`;
        nodes.set(toolNodeId, {
          id: toolNodeId,
          type: "tool",
          label: call.tool,
          count: 1,
          server: call.server,
          sessionId: callSessionId,
          timestamp: call.timestamp,
        });
        nodes.get(callSessionId).tools.add(call.tool);
      });

      // 添加会话到第一个工具的连接
      if (calls.length > 0) {
        const firstToolNodeId = `${callSessionId}__${calls[0].tool}__0`;
        const sessionToolLinkKey = `${callSessionId}->${firstToolNodeId}`;
        if (!links.has(sessionToolLinkKey)) {
          links.set(sessionToolLinkKey, {
            source: callSessionId,
            target: firstToolNodeId,
            count: 1,
            type: "starts",
            timestamp: calls[0].timestamp,
          });
        }
      }
      // 添加工具调用之间的时序连接（按时间顺序连接每个工具调用节点）
      for (let i = 0; i < calls.length - 1; i++) {
        const currentCall = calls[i];
        const nextCall = calls[i + 1];
        const currentToolNodeId = `${callSessionId}__${currentCall.tool}__${i}`;
        const nextToolNodeId = `${callSessionId}__${nextCall.tool}__${i + 1}`;

        const toolLinkKey = `${currentToolNodeId}->${nextToolNodeId}`;
        if (!links.has(toolLinkKey)) {
          links.set(toolLinkKey, {
            source: currentToolNodeId,
            target: nextToolNodeId,
            count: 1,
            type: "followedBy",
            timestamp: nextCall.timestamp,
          });
        }
      }
    });

    // 转换 Set 为数组
    nodes.forEach((node) => {
      if (node.tools) {
        node.tools = Array.from(node.tools);
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      links: Array.from(links.values()),
    };
  }

  /**
   * 清除所有调用记录
   */
  clearAll() {
    try {
      fs.writeFileSync(CALLS_FILE, JSON.stringify([], null, 2));
      return true;
    } catch (error) {
      console.error("Error clearing calls:", error);
      return false;
    }
  }

  /**
   * 删除旧的调用记录
   * @param {number} daysToKeep 保留多少天的记录
   */
  pruneOldRecords(daysToKeep = 7) {
    const allCalls = this.getAllCalls();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const keptCalls = allCalls.filter(
      (call) => new Date(call.timestamp) > cutoff,
    );

    try {
      fs.writeFileSync(CALLS_FILE, JSON.stringify(keptCalls, null, 2));
      return {
        kept: keptCalls.length,
        deleted: allCalls.length - keptCalls.length,
      };
    } catch (error) {
      console.error("Error pruning records:", error);
      return null;
    }
  }
}

module.exports = Database;
