const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CALLS_FILE = path.join(DATA_DIR, 'calls.json');

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
      const data = JSON.parse(fs.readFileSync(CALLS_FILE, 'utf8'));
      return data;
    } catch (error) {
      console.error('Error reading calls:', error);
      return [];
    }
  }

  /**
   * 根据条件查询调用记录
   */
  findCalls(query = {}) {
    const allCalls = this.getAllCalls();

    return allCalls.filter(call => {
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
      successfulCalls: allCalls.filter(call => call.status === 'success').length,
      failedCalls: allCalls.filter(call => call.status === 'error').length,
      pendingCalls: allCalls.filter(call => call.status === 'pending').length,
      avgDuration: 0,
      tools: {},
      servers: {}
    };

    // 计算平均持续时间（只统计成功的调用）
    const successfulWithDuration = allCalls.filter(
      call => call.status === 'success' && call.duration != null
    );
    if (successfulWithDuration.length > 0) {
      const totalDuration = successfulWithDuration.reduce((sum, call) => sum + call.duration, 0);
      stats.avgDuration = Math.round(totalDuration / successfulWithDuration.length);
    }

    // 工具统计
    allCalls.forEach(call => {
      if (!stats.tools[call.tool]) {
        stats.tools[call.tool] = {
          count: 0,
          successful: 0,
          failed: 0,
          duration: 0
        };
      }

      stats.tools[call.tool].count++;
      if (call.status === 'success') {
        stats.tools[call.tool].successful++;
        if (call.duration != null) {
          stats.tools[call.tool].duration += call.duration;
        }
      } else if (call.status === 'error') {
        stats.tools[call.tool].failed++;
      }
    });

    // 计算工具平均持续时间
    Object.keys(stats.tools).forEach(tool => {
      if (stats.tools[tool].successful > 0) {
        stats.tools[tool].avgDuration = Math.round(
          stats.tools[tool].duration / stats.tools[tool].successful
        );
      }
      delete stats.tools[tool].duration;
    });

    // 服务器统计
    allCalls.forEach(call => {
      if (!stats.servers[call.server]) {
        stats.servers[call.server] = {
          count: 0,
          successful: 0,
          failed: 0,
          tools: new Set()
        };
      }

      stats.servers[call.server].count++;
      if (call.status === 'success') {
        stats.servers[call.server].successful++;
      } else if (call.status === 'error') {
        stats.servers[call.server].failed++;
      }

      stats.servers[call.server].tools.add(call.tool);
    });

    // 转换 Set 为数组
    Object.keys(stats.servers).forEach(server => {
      stats.servers[server].tools = Array.from(stats.servers[server].tools);
    });

    return stats;
  }

  /**
   * 获取调用关系图数据
   */
  getGraphData() {
    const allCalls = this.getAllCalls();
    const nodes = new Map();
    const links = new Map();

    allCalls.forEach(call => {
      // 添加会话节点
      const sessionId = call.context?.sessionId;
      if (sessionId && !nodes.has(sessionId)) {
        nodes.set(sessionId, {
          id: sessionId,
          type: 'session',
          label: `Session: ${sessionId.substring(0, 8)}...`,
          count: 0,
          tools: new Set()
        });
      }
      if (sessionId) {
        nodes.get(sessionId).count++;
        nodes.get(sessionId).tools.add(call.tool);
      }

      // 添加服务器节点
      if (!nodes.has(call.server)) {
        nodes.set(call.server, {
          id: call.server,
          type: 'server',
          label: call.server,
          count: 0,
          tools: new Set()
        });
      }
      nodes.get(call.server).count++;
      nodes.get(call.server).tools.add(call.tool);

      // 添加工具节点
      if (!nodes.has(call.tool)) {
        nodes.set(call.tool, {
          id: call.tool,
          type: 'tool',
          label: call.tool,
          count: 0,
          server: call.server
        });
      }
      nodes.get(call.tool).count++;

      // 添加会话到工具的连接
      if (sessionId) {
        const sessionToolLinkKey = `${sessionId}->${call.tool}`;
        if (!links.has(sessionToolLinkKey)) {
          links.set(sessionToolLinkKey, {
            source: sessionId,
            target: call.tool,
            count: 0,
            type: 'uses'
          });
        }
        links.get(sessionToolLinkKey).count++;
      }

      // 添加服务器到工具的连接
      const serverToolLinkKey = `${call.server}->${call.tool}`;
      if (!links.has(serverToolLinkKey)) {
        links.set(serverToolLinkKey, {
          source: call.server,
          target: call.tool,
          count: 0,
          type: 'uses'
        });
      }
      links.get(serverToolLinkKey).count++;
    });

    // 转换 Set 为数组
    nodes.forEach(node => {
      if (node.tools) {
        node.tools = Array.from(node.tools);
      }
    });

    return {
      nodes: Array.from(nodes.values()),
      links: Array.from(links.values())
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
      console.error('Error clearing calls:', error);
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

    const keptCalls = allCalls.filter(call => new Date(call.timestamp) > cutoff);

    try {
      fs.writeFileSync(CALLS_FILE, JSON.stringify(keptCalls, null, 2));
      return {
        kept: keptCalls.length,
        deleted: allCalls.length - keptCalls.length
      };
    } catch (error) {
      console.error('Error pruning records:', error);
      return null;
    }
  }
}

module.exports = Database;
