#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 数据存储目录
const DATA_DIR = path.join(__dirname, '..', 'data');
const CALLS_FILE = path.join(DATA_DIR, 'calls.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 确保数据文件存在
if (!fs.existsSync(CALLS_FILE)) {
  fs.writeFileSync(CALLS_FILE, JSON.stringify([], null, 2));
}

/**
 * 解析 MCP 工具名称
 * 格式: mcp__<server>__<tool>
 */
function parseToolName(fullName) {
  if (!fullName.startsWith('mcp__')) {
    return null;
  }

  const parts = fullName.split('__');
  if (parts.length < 3) {
    return null;
  }

  return {
    fullName,
    server: parts[1],
    tool: parts.slice(2).join('__')
  };
}

/**
 * 保存调用记录
 */
function saveCallRecord(record) {
  try {
    const existingCalls = JSON.parse(fs.readFileSync(CALLS_FILE, 'utf8'));
    const newCalls = [...existingCalls, record];

    fs.writeFileSync(CALLS_FILE, JSON.stringify(newCalls, null, 2));
    console.log(`Saved call record: ${record.id}`);
  } catch (error) {
    console.error('Error saving call record:', error);
  }
}

/**
 * 处理 PreToolUse 事件
 */
function handlePreToolUse(inputData) {
  const { tool_name, tool_input, session_id, conversation_id } = inputData;

  const toolInfo = parseToolName(tool_name);
  if (!toolInfo) {
    return;
  }

  const record = {
    id: uuidv4(),
    tool: toolInfo.fullName,
    server: toolInfo.server,
    operation: toolInfo.tool,
    timestamp: new Date().toISOString(),
    duration: null,
    status: 'pending',
    input: tool_input,
    output: null,
    context: {
      sessionId: session_id,
      conversationId: conversation_id
    }
  };

  saveCallRecord(record);
}

/**
 * 处理 PostToolUse 事件
 */
function handlePostToolUse(inputData) {
  const { tool_name, tool_input, tool_response, session_id, conversation_id } = inputData;

  const toolInfo = parseToolName(tool_name);
  if (!toolInfo) {
    return;
  }

  try {
    const existingCalls = JSON.parse(fs.readFileSync(CALLS_FILE, 'utf8'));
    const callIndex = existingCalls.findIndex(call =>
      call.tool === toolInfo.fullName &&
      call.status === 'pending' &&
      JSON.stringify(call.input) === JSON.stringify(tool_input) &&
      call.context.sessionId === session_id
    );

    if (callIndex !== -1) {
      const callTime = new Date(existingCalls[callIndex].timestamp);
      const duration = Date.now() - callTime.getTime();

      existingCalls[callIndex] = {
        ...existingCalls[callIndex],
        duration,
        status: tool_response.isError === true || tool_response.error != null ? 'error' : 'success',
        output: tool_response
      };

      fs.writeFileSync(CALLS_FILE, JSON.stringify(existingCalls, null, 2));
      console.log(`Updated call record: ${existingCalls[callIndex].id}`);
    } else {
      const record = {
        id: uuidv4(),
        tool: toolInfo.fullName,
        server: toolInfo.server,
        operation: toolInfo.tool,
        timestamp: new Date().toISOString(),
        duration: null,
        status: tool_response.isError === true || tool_response.error != null ? 'error' : 'success',
        input: tool_input,
        output: tool_response,
        context: {
          sessionId: session_id,
          conversationId: conversation_id
        }
      };

      saveCallRecord(record);
    }
  } catch (error) {
    console.error('Error handling PostToolUse:', error);
  }
}

/**
 * 主函数
 */
function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);

  // 处理帮助和版本参数
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP 工具调用跟踪器

用法:
  node monitor/tracker.js [选项]

选项:
  --pre          处理 PreToolUse 事件
  --post         处理 PostToolUse 事件
  --input <JSON> 输入数据（JSON 格式）
  --help, -h     显示此帮助信息
  --version, -v  显示版本信息

示例:
  node monitor/tracker.js --pre --input '{"tool_name":"mcp__context7__query-docs","tool_input":{"libraryId":"/vercel/next.js"}}'
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('1.0.0');
    process.exit(0);
  }

  const options = {
    pre: args.includes('--pre'),
    post: args.includes('--post')
  };

  let inputData = null;

  // 查找 --input 参数
  const inputIndex = args.findIndex(arg => arg.startsWith('--input'));
  if (inputIndex !== -1) {
    try {
      let inputStr;
      if (args[inputIndex].startsWith('--input=')) {
        // 格式：--input=<JSON>
        inputStr = args[inputIndex].replace('--input=', '');
      } else {
        // 格式：--input <JSON>
        inputStr = args[inputIndex + 1];
      }
      inputData = JSON.parse(inputStr);
    } catch (error) {
      console.error('Error parsing input data:', error);
      process.exit(1);
    }
  } else {
    // 从 stdin 读取数据
    const input = [];
    process.stdin.on('data', (chunk) => {
      input.push(chunk);
    });

    process.stdin.on('end', () => {
      try {
        const inputStr = Buffer.concat(input).toString().trim();
        if (!inputStr) {
          console.error('No input data received');
          process.exit(1);
        }
        inputData = JSON.parse(inputStr);
        // 在读取完成后处理事件
        if (options.pre) {
          handlePreToolUse(inputData);
        } else if (options.post) {
          handlePostToolUse(inputData);
        }
        process.exit(0);
      } catch (error) {
        console.error('Error parsing input data from stdin:', error);
        process.exit(1);
      }
    });

    return;
  }

  // 处理事件
  if (options.pre) {
    handlePreToolUse(inputData);
  } else if (options.post) {
    handlePostToolUse(inputData);
  }

  process.exit(0);
}

// 当直接运行脚本时
if (require.main === module) {
  main();
}

module.exports = {
  handlePreToolUse,
  handlePostToolUse,
  parseToolName,
  saveCallRecord
};
