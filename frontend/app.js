class MCPMonitor {
  constructor() {
    this.baseUrl = "/api";
    this.chartColors = [
      "#667eea",
      "#f093fb",
      "#4facfe",
      "#00f2fe",
      "#43e97b",
      "#fa709a",
      "#fee140",
      "#30cfd0",
      "#330867",
      "#a8edea",
      "#fed6e3",
    ];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadAllData();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    // 刷新按钮
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.loadAllData();
    });

    // 清除数据按钮
    document.getElementById("clearBtn").addEventListener("click", () => {
      this.clearData();
    });

    // 状态过滤器
    document.getElementById("filterStatus").addEventListener("change", (e) => {
      this.loadCalls();
    });
  }

  startAutoRefresh() {
    // 每30秒自动刷新一次
    this.refreshInterval = setInterval(() => {
      this.loadAllData();
    }, 30000);
  }

  async loadSessionGraph(sessionId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/graph?sessionId=${sessionId}`,
      );
      const data = await response.json();

      if (data.success) {
        // 显示调用关系图面板
        const graphPanel =
          document.querySelector("#callGraph").parentNode.parentNode;
        graphPanel.style.display = "block";
        this.renderCallGraph(data.data);
      }
    } catch (error) {
      console.error("Error loading session graph:", error);
    }
  }

  hideCallGraph() {
    // 隐藏调用关系图面板
    const graphPanel =
      document.querySelector("#callGraph").parentNode.parentNode;
    graphPanel.style.display = "none";

    // 清除图形内容
    d3.select("#callGraph").selectAll("*").remove();
  }

  async loadAllData() {
    try {
      await Promise.all([
        this.loadStats(),
        this.loadCalls(),
        this.loadPerformance(),
        this.loadUsagePatterns(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      this.showMessage("加载数据失败", "error");
    }
  }

  // 渲染工具使用统计图表
  renderToolChart(toolsData) {
    const ctx = document.getElementById("toolChart");
    if (!ctx) return;

    const labels = Object.keys(toolsData);
    const data = Object.values(toolsData).map((tool) => tool.count);

    // 销毁现有图表
    if (this.toolChart) {
      this.toolChart.destroy();
    }

    this.toolChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "调用次数",
            data: data,
            backgroundColor: "rgba(90, 103, 216, 0.8)",
            borderColor: "rgba(90, 103, 216, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
          title: {
            display: true,
            text: "工具使用统计",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "调用次数",
            },
          },
          x: {
            title: {
              display: true,
              text: "工具名称",
            },
          },
        },
      },
    });
  }

  // 渲染服务器使用统计图表
  renderServerChart(serversData) {
    const ctx = document.getElementById("serverChart");
    if (!ctx) return;

    const labels = Object.keys(serversData);
    const data = Object.values(serversData).map((server) => server.count);

    // 销毁现有图表
    if (this.serverChart) {
      this.serverChart.destroy();
    }

    this.serverChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            label: "调用次数",
            data: data,
            backgroundColor: [
              "rgba(90, 103, 216, 0.8)",
              "rgba(107, 70, 193, 0.8)",
              "rgba(66, 153, 225, 0.8)",
              "rgba(79, 172, 254, 0.8)",
              "rgba(129, 140, 248, 0.8)",
            ],
            borderColor: [
              "rgba(90, 103, 216, 1)",
              "rgba(107, 70, 193, 1)",
              "rgba(66, 153, 225, 1)",
              "rgba(79, 172, 254, 1)",
              "rgba(129, 140, 248, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
          },
          title: {
            display: true,
            text: "服务器使用统计",
          },
        },
      },
    });
  }

  async loadStats() {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);
      const data = await response.json();

      if (data.success) {
        document.getElementById("totalCalls").textContent =
          data.data.totalCalls;
        document.getElementById("successfulCalls").textContent =
          data.data.successfulCalls;
        document.getElementById("failedCalls").textContent =
          data.data.failedCalls;
        document.getElementById("avgDuration").textContent =
          data.data.avgDuration;
        document.getElementById("toolCount").textContent = Object.keys(
          data.data.tools,
        ).length;
        document.getElementById("serverCount").textContent = Object.keys(
          data.data.servers,
        ).length;

        // 渲染图表
        this.renderToolChart(data.data.tools);
        this.renderServerChart(data.data.servers);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async loadCalls() {
    try {
      const status = document.getElementById("filterStatus").value;
      const url = status
        ? `${this.baseUrl}/calls?status=${status}`
        : `${this.baseUrl}/calls`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        this.renderCallsTable(data.data);
      }
    } catch (error) {
      console.error("Error loading calls:", error);
    }
  }

  renderCallsTable(calls) {
    // 初始隐藏调用关系图
    this.hideCallGraph();

    const tbody = document.getElementById("callsBody");
    tbody.innerHTML = "";

    // 按 session_id 分组
    const sessionGroups = new Map();
    calls.forEach((call) => {
      const sessionId = call.context?.sessionId || "—";
      if (!sessionGroups.has(sessionId)) {
        sessionGroups.set(sessionId, []);
      }
      sessionGroups.get(sessionId).push(call);
    });

    // 渲染分组后的表格
    sessionGroups.forEach((groupCalls, sessionId) => {
      // 渲染 session 分组行
      const sessionRow = tbody.insertRow();
      sessionRow.className = "session-group-row";
      sessionRow.dataset.sessionId = sessionId;

      // 合并单元格
      const expandCell = sessionRow.insertCell();
      expandCell.innerHTML = '<span class="expand-icon">+</span>';
      expandCell.className = "expand-cell";
      expandCell.addEventListener("click", () =>
        this.toggleSessionGroup(sessionId),
      );

      const sessionCell = sessionRow.insertCell();
      sessionCell.textContent = sessionId;
      sessionCell.className = "session-cell";
      sessionCell.colSpan = 6; // 合并剩余列

      // 统计信息
      const callCount = groupCalls.length;
      const durationSum = groupCalls.reduce(
        (sum, call) => sum + (call.duration || 0),
        0,
      );
      const avgDuration = Math.round(durationSum / callCount);
      const successCount = groupCalls.filter(
        (call) => call.status === "success",
      ).length;
      const errorCount = groupCalls.filter(
        (call) => call.status === "error",
      ).length;
      const pendingCount = groupCalls.filter(
        (call) => call.status === "pending",
      ).length;

      sessionCell.textContent = `Session: ${sessionId} (${callCount} calls, ${successCount} success, ${errorCount} error, ${pendingCount} pending, avg ${avgDuration}ms)`;
      sessionCell.style.cursor = "pointer";
      sessionCell.addEventListener("click", () =>
        this.loadSessionGraph(sessionId),
      );

      // 渲染详细行
      groupCalls.forEach((call) => {
        const detailRow = tbody.insertRow();
        detailRow.className = "session-detail-row";
        detailRow.dataset.sessionId = sessionId;
        detailRow.style.display = "none"; // 默认隐藏

        detailRow.insertCell(); // 空白列，与分组行的 expand 列对齐
        detailRow.insertCell().textContent = call.tool;
        detailRow.insertCell().textContent = call.server;
        detailRow.insertCell().textContent = call.timestamp;
        detailRow.insertCell().textContent = call.duration
          ? `${call.duration}ms`
          : "—";

        const statusCell = detailRow.insertCell();
        const statusText = call.status;
        statusCell.textContent = statusText;
        statusCell.className = `status-${statusText}`;

        // 渲染参数信息
        const paramsCell = detailRow.insertCell();
        if (call.input) {
          const paramsStr = this.formatParams(call.input);
          paramsCell.textContent = paramsStr;
          paramsCell.title = JSON.stringify(call.input, null, 2);
          paramsCell.classList.add("params-cell");
        } else {
          paramsCell.textContent = "—";
        }
      });
    });
  }

  // 切换 session 分组的显示/隐藏
  toggleSessionGroup(sessionId) {
    const detailRows = document.querySelectorAll(
      `.session-detail-row[data-session-id="${sessionId}"]`,
    );
    const expandIcon = document.querySelector(
      `.session-group-row[data-session-id="${sessionId}"] .expand-icon`,
    );

    const isHidden = detailRows[0].style.display === "none";

    detailRows.forEach((row) => {
      row.style.display = isHidden ? "table-row" : "none";
    });

    expandIcon.textContent = isHidden ? "−" : "+";
  }

  // 格式化参数信息，以便在表格中显示
  formatParams(input) {
    if (!input) return "—";

    // 如果是对象，尝试提取关键信息
    if (typeof input === "object") {
      // 处理常见的参数格式
      if (input.libraryId) {
        return input.libraryId;
      }
      if (input.keywords) {
        return input.keywords;
      }
      if (input.location) {
        return input.location;
      }
      if (input.city) {
        return input.city;
      }
      if (input.id) {
        return input.id;
      }

      // 如果没有特定格式，返回简短的 JSON 字符串
      const str = JSON.stringify(input);
      return str.length > 30 ? str.substring(0, 27) + "..." : str;
    }

    return String(input);
  }

  async loadGraphData() {
    try {
      const response = await fetch(`${this.baseUrl}/graph`);
      const data = await response.json();

      if (data.success) {
        this.renderCallGraph(data.data);
      }
    } catch (error) {
      console.error("Error loading graph data:", error);
    }
  }

  renderCallGraph(graphData) {
    const svg = d3.select("#callGraph");
    svg.selectAll("*").remove();

    const width = svg.node().clientWidth;
    const height = 400;
    const padding = 50; // 边界 padding

    const g = svg.append("g");

    // 为工具节点分配不同的颜色
    const toolColors = new Map();
    const colors = [
      "#667eea",
      "#f093fb",
      "#4facfe",
      "#00f2fe",
      "#43e97b",
      "#fa709a",
      "#fee140",
      "#30cfd0",
      "#330867",
      "#a8edea",
      "#fed6e3",
    ];
    let colorIndex = 0;

    graphData.nodes.forEach((node) => {
      if (node.type === "tool") {
        if (!toolColors.has(node.label)) {
          toolColors.set(node.label, colors[colorIndex % colors.length]);
          colorIndex++;
        }
      }
    });

    // 为节点设置固定位置，会话节点在最左侧
    graphData.nodes.forEach((node) => {
      if (node.type === "session") {
        node.fx = padding;
        node.fy = height / 2;
      } else {
        node.fx = null;
        node.fy = null;
      }
    });

    // 创建力导向图
    const simulation = d3
      .forceSimulation(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink(graphData.links)
          .id((d) => d.id)
          .distance(150), // 调整链接距离
      )
      .force("charge", d3.forceManyBody().strength(-500)) // 调整排斥力
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40)); // 调整碰撞检测半径

    // 绘制连接线
    const links = g
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("stroke", (d) => {
        if (d.type === "starts") return "#667eea";
        if (d.type === "followedBy") return "#f093fb";
        if (d.type === "runsOn") return "#4facfe";
        return "#999";
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.count) * 2);

    // 绘制节点
    const node = g
      .append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .enter()
      .append("circle")
      .attr("r", 15) // 所有节点大小一致
      .attr("fill", (d) => {
        if (d.type === "server") return "#667eea";
        if (d.type === "session") return "#f093fb";
        return toolColors.get(d.label) || "#4facfe";
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => this.dragstarted(event, d, simulation))
          .on("drag", (event, d) => this.dragged(event, d))
          .on("end", (event, d) => this.dragended(event, d, simulation)),
      );

    // 添加标签
    const labels = g
      .append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.type === "server" ? 40 : 25))
      .text((d) => {
        // 工具节点显示工具名 + 调用次数
        if (d.type === "tool") {
          return `${d.label} (${d.count})`;
        }
        return d.label;
      })
      .style("font-size", "12px")
      .style("pointer-events", "none");

    // 连接线标签
    const linkLabels = g
      .append("g")
      .selectAll("text")
      .data(graphData.links)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#666");

    // 更新位置，添加边界约束
    simulation.on("tick", () => {
      // 约束节点在边界内
      graphData.nodes.forEach((node) => {
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      });

      links
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      labels.attr("x", (d) => d.x).attr("y", (d) => d.y);

      linkLabels
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2)
        .text((d) => d.count);
    });
  }

  dragstarted(event, d, simulation) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragended(event, d, simulation) {
    if (!event.active) simulation.alphaTarget(0);
    // 保持节点在拖动后的位置
    d.fx = event.x;
    d.fy = event.y;
  }

  async loadPerformance() {
    try {
      const response = await fetch(`${this.baseUrl}/performance`);
      const data = await response.json();

      if (data.success) {
        this.renderPerformance(data.data);
      }
    } catch (error) {
      console.error("Error loading performance data:", error);
    }
  }

  renderPerformance(data) {
    const container = document.getElementById("performance");
    container.innerHTML = "";

    if (data.slowest.length > 0) {
      const slowestDiv = this.createElementWithClass("div", "performance-item");
      const h3 = this.createElementWithClass("h3");
      h3.textContent = "最慢的工具";
      slowestDiv.appendChild(h3);

      const ul = this.createElementWithClass("ul");
      data.slowest.forEach((item, index) => {
        const li = this.createElementWithClass("li");
        li.textContent = `${index + 1}. ${item.tool}: 平均 ${item.avg}ms (${item.count} 次)`;
        ul.appendChild(li);
      });
      slowestDiv.appendChild(ul);
      container.appendChild(slowestDiv);
    }

    if (data.fastest.length > 0) {
      const fastestDiv = this.createElementWithClass("div", "performance-item");
      const h3 = this.createElementWithClass("h3");
      h3.textContent = "最快的工具";
      fastestDiv.appendChild(h3);

      const ul = this.createElementWithClass("ul");
      data.fastest.forEach((item, index) => {
        const li = this.createElementWithClass("li");
        li.textContent = `${index + 1}. ${item.tool}: 平均 ${item.avg}ms (${item.count} 次)`;
        ul.appendChild(li);
      });
      fastestDiv.appendChild(ul);
      container.appendChild(fastestDiv);
    }
  }

  async loadUsagePatterns() {
    try {
      const response = await fetch(`${this.baseUrl}/patterns`);
      const data = await response.json();

      if (data.success) {
        this.renderUsagePatterns(data.data);
      }
    } catch (error) {
      console.error("Error loading usage patterns:", error);
    }
  }

  renderUsagePatterns(patterns) {
    const container = document.getElementById("usagePatterns");
    container.innerHTML = "";

    if (patterns.length === 0) {
      const p = this.createElementWithClass("p");
      p.textContent = "暂无使用模式数据";
      container.appendChild(p);
      return;
    }

    patterns.forEach((pattern) => {
      const itemDiv = this.createElementWithClass("div", "pattern-item");
      const countDiv = this.createElementWithClass("div");
      countDiv.textContent = `共同使用次数: ${pattern.count}`;
      itemDiv.appendChild(countDiv);

      const toolsDiv = this.createElementWithClass("div", "pattern-tools");
      pattern.tools.forEach((tool) => {
        const toolTag = this.createElementWithClass("span", "pattern-tool");
        toolTag.textContent = tool;
        toolsDiv.appendChild(toolTag);
      });
      itemDiv.appendChild(toolsDiv);

      container.appendChild(itemDiv);
    });
  }

  async clearData() {
    if (confirm("确定要清除所有数据吗？")) {
      try {
        const response = await fetch(`${this.baseUrl}/calls`, {
          method: "DELETE",
        });
        const data = await response.json();

        if (data.success) {
          this.loadAllData();
          this.showMessage("数据清除成功", "success");
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        console.error("Error clearing data:", error);
        this.showMessage("清除数据失败", "error");
      }
    }
  }

  showMessage(text, type) {
    const messageDiv = this.createElementWithClass("div", `${type}-message`);
    messageDiv.textContent = text;

    const container = document.querySelector(".container");
    container.insertBefore(messageDiv, container.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }

  createElementWithClass(tag, className) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    return element;
  }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new MCPMonitor();
});
