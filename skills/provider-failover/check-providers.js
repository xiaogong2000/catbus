#!/usr/bin/env node
/**
 * Provider Health Check & Auto-Failover
 * 
 * 检查各 LLM provider 健康状态，故障时自动切换并通知
 * 
 * Usage:
 *   node check-providers.js --status    # 检查状态（不触发切换）
 *   node check-providers.js --check     # 检查并自动切换（cron 用）
 *   node check-providers.js --switch <model>  # 强制切换
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// === 配置 ===
// 从 OpenClaw config 读取 bot token
function getTelegramBotToken() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'));
    return config.channels?.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  } catch (e) {
    return process.env.TELEGRAM_BOT_TOKEN || '';
  }
}
const TELEGRAM_BOT_TOKEN = getTelegramBotToken();
const TELEGRAM_CHAT_ID = '1149648904';
const OPENCLAW_CONFIG_PATH = path.join(process.env.HOME, '.openclaw/openclaw.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const FAILURE_THRESHOLD = 2; // 连续失败次数阈值

// Provider 优先级列表（按顺序尝试）
// 线路分组：azure / newcli / openai
const PROVIDER_PRIORITY = [
  { provider: 'azure-claude', model: 'claude-opus-4-5', group: 'azure' },
  { provider: 'newcli', model: 'claude-opus-4-6', group: 'newcli' },
  { provider: 'openai', model: 'gpt-5-mini', group: 'openai' },
  { provider: 'newcli-aws', model: 'claude-opus-4-5', group: 'newcli' },
  { provider: 'newcli-codex', model: 'gpt-5.2', group: 'newcli' },
  { provider: 'newcli-gemini', model: 'gemini-2.5-pro', group: 'newcli' },
];

// 线路分组（同组视为一条线路）
const PROVIDER_GROUPS = {
  'azure-claude': 'azure',
  'newcli': 'newcli',
  'newcli-aws': 'newcli',
  'newcli-codex': 'newcli',
  'newcli-gemini': 'newcli',
  'openai': 'openai',
};

// === 工具函数 ===

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
  } catch (e) {}
  return { failures: {}, lastCheck: null, lastSwitch: null, manualOverride: false };
}

function saveState(state) {
  state.lastCheck = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadOpenClawConfig() {
  return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
}

function saveOpenClawConfig(config) {
  // 备份
  const backupPath = OPENCLAW_CONFIG_PATH + '.bak';
  fs.copyFileSync(OPENCLAW_CONFIG_PATH, backupPath);
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getCurrentPrimary() {
  const config = loadOpenClawConfig();
  return config.agents?.defaults?.model?.primary || 'unknown';
}

// 发送 Telegram 通知
async function notify(message) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[Notify] No bot token, skip:', message);
    return;
  }
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });
  
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

// 检查单个 provider - 发送真实请求验证
async function checkProvider(providerName, config) {
  const providerConfig = config.models?.providers?.[providerName];
  if (!providerConfig) {
    return { ok: false, error: 'Provider not configured' };
  }
  
  const baseUrl = providerConfig.baseUrl;
  const apiKey = providerConfig.apiKey;
  const api = providerConfig.api;
  
  if (!baseUrl || !apiKey) {
    return { ok: false, error: 'Missing baseUrl or apiKey' };
  }
  
  // 根据 API 类型构造请求
  let endpoint, body, headers;
  
  if (api === 'anthropic-messages') {
    const modelId = providerConfig.models?.[0]?.id || 'claude-opus-4-5';
    endpoint = baseUrl.replace(/\/$/, '') + '/v1/messages';
    body = JSON.stringify({
      model: modelId,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }]
    });
    headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    
    // Azure 用 api-key header
    if (baseUrl.includes('azure.com')) {
      headers['api-key'] = apiKey;
    } else {
      // newcli 等用 Authorization Bearer
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else if (api === 'openai-completions') {
    endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions';
    body = JSON.stringify({
      model: providerConfig.models?.[0]?.id || 'gpt-5.2',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }]
    });
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  } else if (api === 'google-generative-ai') {
    // Gemini 用 generateContent
    const modelId = providerConfig.models?.[0]?.id || 'gemini-2.5-pro';
    endpoint = baseUrl.replace(/\/$/, '') + `/models/${modelId}:generateContent`;
    body = JSON.stringify({
      contents: [{ parts: [{ text: 'hi' }] }],
      generationConfig: { maxOutputTokens: 5 }
    });
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  } else {
    return { ok: false, error: `Unknown API type: ${api}` };
  }
  
  return new Promise((resolve) => {
    const urlObj = new URL(endpoint);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: body ? 'POST' : 'GET',
      headers,
      timeout: 15000
    };
    
    const proto = urlObj.protocol === 'https:' ? https : http;
    const req = proto.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // 200-299 成功
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode });
        } 
        // 400 可能是参数问题但连接正常（比如 max_tokens 太小）
        else if (res.statusCode === 400) {
          // 检查是否是格式/参数错误（说明 API 能响应）
          if (data.includes('max_tokens') || data.includes('parameter') || data.includes('invalid')) {
            resolve({ ok: true, status: res.statusCode, note: 'param error but API reachable' });
          } else {
            resolve({ ok: false, error: `HTTP ${res.statusCode}`, status: res.statusCode });
          }
        }
        // 其他错误
        else {
          let errorMsg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(data);
            errorMsg = parsed.error?.message || parsed.message || errorMsg;
          } catch (e) {}
          resolve({ ok: false, error: errorMsg, status: res.statusCode });
        }
      });
    });
    
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
    
    if (body) req.write(body);
    req.end();
  });
}

// 切换 primary
async function switchPrimary(newModel, reason) {
  const config = loadOpenClawConfig();
  const oldPrimary = config.agents?.defaults?.model?.primary || 'unknown';
  
  if (oldPrimary === newModel) {
    console.log(`[Switch] Already using ${newModel}, skip`);
    return false;
  }
  
  // 更新 primary
  if (!config.agents) config.agents = {};
  if (!config.agents.defaults) config.agents.defaults = {};
  if (!config.agents.defaults.model) config.agents.defaults.model = {};
  
  config.agents.defaults.model.primary = newModel;
  
  // 更新 fallbacks（按优先级排列，排除新 primary）
  const newFallbacks = PROVIDER_PRIORITY
    .map(p => `${p.provider}/${p.model}`)
    .filter(m => m !== newModel);
  config.agents.defaults.model.fallbacks = newFallbacks;
  
  saveOpenClawConfig(config);
  
  // 更新 state
  const state = loadState();
  state.lastSwitch = {
    from: oldPrimary,
    to: newModel,
    reason,
    at: new Date().toISOString()
  };
  // 重置新 primary 的失败计数
  state.failures[newModel] = 0;
  saveState(state);
  
  // 通知
  const msg = `🔄 <b>Provider 自动切换</b>\n\n` +
    `从: <code>${oldPrimary}</code>\n` +
    `到: <code>${newModel}</code>\n` +
    `原因: ${reason}\n` +
    `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  await notify(msg);
  
  console.log(`[Switch] ${oldPrimary} -> ${newModel} (${reason})`);
  
  // 重启 gateway
  try {
    execSync('openclaw gateway restart', { timeout: 10000 });
    console.log('[Switch] Gateway restarted');
  } catch (e) {
    console.log('[Switch] Gateway restart failed, may need manual restart');
  }
  
  return true;
}

// 主检查逻辑
async function runCheck() {
  console.log('[Check] Starting provider health check...');
  
  const config = loadOpenClawConfig();
  const state = loadState();
  const currentPrimary = getCurrentPrimary();
  
  console.log(`[Check] Current primary: ${currentPrimary}`);
  
  // 如果有手动覆盖标记，跳过自动切换
  if (state.manualOverride) {
    console.log('[Check] Manual override active, skipping auto-switch');
  }
  
  const results = {};
  const groupStatus = {}; // 记录每个线路组的状态
  let healthyProvider = null;
  
  // 检查所有 provider
  for (const { provider, model, group } of PROVIDER_PRIORITY) {
    const modelKey = `${provider}/${model}`;
    
    // 跳过当前 primary 的检测（假定正在工作就是健康的）
    if (modelKey === currentPrimary) {
      console.log(`[Check] ${provider}: 🟢 [PRIMARY - assumed healthy]`);
      if (!state.failures[modelKey]) state.failures[modelKey] = 0;
      healthyProvider = healthyProvider || modelKey;
      results[provider] = { ok: true, note: 'primary - assumed healthy' };
      groupStatus[group] = 'healthy';
      continue;
    }
    
    // 如果同组已有一个失败，跳过检测（同一线路）
    if (groupStatus[group] === 'failed') {
      console.log(`[Check] ${provider}: ⏭️ [skipped - same group "${group}" already failed]`);
      if (!state.failures[modelKey]) state.failures[modelKey] = 0;
      state.failures[modelKey]++;
      results[provider] = { ok: false, error: 'group failed' };
      continue;
    }
    
    const result = await checkProvider(provider, config);
    results[provider] = result;
    
    const status = result.ok ? '✅' : '❌';
    console.log(`[Check] ${provider}: ${status} ${result.error || result.note || ''}`);
    
    // 更新失败计数
    if (!state.failures[modelKey]) state.failures[modelKey] = 0;
    
    if (result.ok) {
      state.failures[modelKey] = 0;
      groupStatus[group] = 'healthy'; // 有一个成功就算健康
      if (!healthyProvider) healthyProvider = modelKey;
    } else {
      state.failures[modelKey]++;
      // 只有组还没标记为健康时才标记失败
      if (groupStatus[group] !== 'healthy') {
        groupStatus[group] = 'failed';
      }
    }
  }
  
  // 检查当前 primary 状态（只有手动设置失败计数时才触发）
  const primaryFailures = state.failures[currentPrimary] || 0;
  
  // 如果 primary 连续失败且没有手动覆盖，自动切换
  if (primaryFailures >= FAILURE_THRESHOLD && !state.manualOverride) {
    console.log(`[Check] Primary ${currentPrimary} failed ${primaryFailures} times, looking for alternative...`);
    
    // 找一个不同组的健康 provider
    const currentGroup = PROVIDER_GROUPS[currentPrimary.split('/')[0]];
    const altProvider = PROVIDER_PRIORITY.find(p => {
      const k = `${p.provider}/${p.model}`;
      return p.group !== currentGroup && results[p.provider]?.ok;
    });
    
    if (altProvider) {
      await switchPrimary(`${altProvider.provider}/${altProvider.model}`, `${currentPrimary} 连续失败 ${primaryFailures} 次`);
    } else if (healthyProvider && healthyProvider !== currentPrimary) {
      // 没有不同组的，用同组的也行
      await switchPrimary(healthyProvider, `${currentPrimary} 连续失败 ${primaryFailures} 次`);
    } else {
      console.log('[Check] No healthy alternative found!');
      await notify(`⚠️ <b>Provider 全部异常</b>\n\n所有 provider 检测失败，请手动检查！`);
    }
  }
  
  saveState(state);
  console.log('[Check] Done');
}

// 显示状态
async function showStatus() {
  const config = loadOpenClawConfig();
  const state = loadState();
  const currentPrimary = getCurrentPrimary();
  
  console.log('\n=== Provider Health Status ===\n');
  console.log(`Current Primary: ${currentPrimary}`);
  console.log(`Last Check: ${state.lastCheck || 'Never'}`);
  if (state.lastSwitch) {
    console.log(`Last Switch: ${state.lastSwitch.from} -> ${state.lastSwitch.to} (${state.lastSwitch.at})`);
  }
  console.log(`Manual Override: ${state.manualOverride ? 'Yes' : 'No'}`);
  console.log('\nProvider Status:');
  
  for (const { provider, model } of PROVIDER_PRIORITY) {
    const modelKey = `${provider}/${model}`;
    const result = await checkProvider(provider, config);
    const failures = state.failures[modelKey] || 0;
    const isPrimary = modelKey === currentPrimary ? ' [PRIMARY]' : '';
    const status = result.ok ? '✅' : '❌';
    console.log(`  ${status} ${modelKey}${isPrimary} (failures: ${failures}) ${result.error || result.note || ''}`);
  }
  console.log('');
}

// 强制切换
async function forceSwitch(model) {
  const valid = PROVIDER_PRIORITY.some(p => `${p.provider}/${p.model}` === model);
  if (!valid) {
    console.log(`Invalid model: ${model}`);
    console.log('Valid options:', PROVIDER_PRIORITY.map(p => `${p.provider}/${p.model}`).join(', '));
    process.exit(1);
  }
  
  // 设置手动覆盖标记（防止自动切回）
  const state = loadState();
  state.manualOverride = true;
  saveState(state);
  
  await switchPrimary(model, '手动切换');
}

// 清除手动覆盖
async function clearOverride() {
  const state = loadState();
  state.manualOverride = false;
  saveState(state);
  console.log('[Override] Manual override cleared, auto-switch enabled');
}

// 标记 provider 失败（用于 500 错误等 OpenClaw 原生不触发 fallback 的情况）
async function markFailed(model) {
  const state = loadState();
  if (!state.failures[model]) state.failures[model] = 0;
  state.failures[model] += FAILURE_THRESHOLD; // 直接增加到阈值以上
  saveState(state);
  
  console.log(`[Mark] ${model} marked as failed (failures: ${state.failures[model]})`);
  
  // 如果是当前 primary，立即触发切换
  const currentPrimary = getCurrentPrimary();
  if (model === currentPrimary) {
    console.log('[Mark] This is the current primary, triggering failover...');
    
    const config = loadOpenClawConfig();
    // 找一个健康的备选
    for (const { provider, m } of PROVIDER_PRIORITY) {
      const modelKey = `${provider}/${m || PROVIDER_PRIORITY.find(p => p.provider === provider)?.model}`;
      if (modelKey === model) continue;
      
      const result = await checkProvider(provider, config);
      if (result.ok) {
        await switchPrimary(modelKey, `${model} 手动标记失败`);
        return;
      }
    }
    
    // 如果所有检测都失败，选第一个非当前的
    const fallback = PROVIDER_PRIORITY.find(p => `${p.provider}/${p.model}` !== model);
    if (fallback) {
      await switchPrimary(`${fallback.provider}/${fallback.model}`, `${model} 手动标记失败（备选未验证）`);
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    await showStatus();
  } else if (args.includes('--check')) {
    await runCheck();
  } else if (args.includes('--switch')) {
    const idx = args.indexOf('--switch');
    const model = args[idx + 1];
    if (!model) {
      console.log('Usage: --switch <provider/model>');
      process.exit(1);
    }
    await forceSwitch(model);
  } else if (args.includes('--clear-override')) {
    await clearOverride();
  } else if (args.includes('--mark-failed')) {
    const idx = args.indexOf('--mark-failed');
    const model = args[idx + 1];
    if (!model) {
      console.log('Usage: --mark-failed <provider/model>');
      process.exit(1);
    }
    await markFailed(model);
  } else {
    // 默认检查
    await runCheck();
  }
}

main().catch(console.error);
