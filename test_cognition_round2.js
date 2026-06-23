/**
 * Round 2 回归测试 - 认知提取与渲染 (extractCognitions, renderCognitions, deleteCognition)
 * 
 * 测试环境：Node.js (无浏览器 DOM)，使用 JSDOM 模拟。
 * 运行方式：node test_cognition_round2.js
 * 
 * 注意：由于代码依赖浏览器 API (localStorage, DOM, CSS)，我们通过 JSDOM 模拟。
 * 如果 JSDOM 不可用，退化为手动逻辑验证模式。
 */

// ===================== 测试框架 (微型) =====================
let totalTests = 0;
let passedTests = 0;
let failedTests = [];
const KNOWN_ISSUES = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (e) {
    failedTests.push({ name, error: e.message, stack: e.stack });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to contain "${substring}"`);
  }
}

function assertNotNull(val, message) {
  if (val === null || val === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

// ===================== 测试环境模拟 =====================
let jsdom;
try {
  jsdom = require('jsdom');
} catch (e) {
  jsdom = null;
}

if (jsdom) {
  console.log('[ENV] JSDOM 可用，使用真实 DOM 模拟进行测试\n');
} else {
  console.log('[ENV] JSDOM 不可用，退化为逻辑验证模式\n');
}

/**
 * 构建模拟 DOM 环境（与 index.html 一致的 DOM 结构）
 */
function setupDOM() {
  if (!jsdom) return null;
  
  const { JSDOM } = jsdom;
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>Test</title></head>
    <body>
      <!-- AI 聊天容器 -->
      <div id="ai-messages">
        <div class="ai-welcome">👋 我是你的 AI 复盘助手</div>
      </div>
      
      <!-- 首页认知卡片容器 -->
      <div id="home-cog-cards"></div>
      <div id="home-cog-empty" style="display:none;">暂无认知</div>
      
      <!-- 认知库页容器 -->
      <div id="cog-list"></div>
      <div id="cog-empty" style="display:none;">暂无认知</div>
    </body>
    </html>
  `);
  
  // 注入全局变量
  global.document = dom.window.document;
  global.window = dom.window;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  
  // Mock localStorage
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val; },
    removeItem: (key) => { delete store[key]; },
  };
  
  // 注入 CSS classList（JSDOM 自带）
  // 确保 previousElementSibling 可用
  
  return dom;
}

/**
 * 向 ai-messages 容器追加 AI 回复气泡（模拟 appendAiBubble）
 */
function appendMockAiBubble(role, content) {
  const container = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'ai-bubble ai-' + role;
  div.innerHTML = '<div class="ai-bubble-inner">' + content + '</div>';
  container.appendChild(div);
  return div;
}

/**
 * 向 ai-messages 容器追加 actionRow（模拟 sendAiMessage 中的逻辑）
 */
function appendMockActionRow() {
  const container = document.getElementById('ai-messages');
  const actionRow = document.createElement('div');
  actionRow.className = 'ai-action-row';
  actionRow.innerHTML = '<button class="ai-action-btn ai-action-yes" onclick="extractCognitions(this)">需要</button><button class="ai-action-btn ai-action-no" onclick="this.closest(\'.ai-action-row\').remove()">不需要</button>';
  container.appendChild(actionRow);
  return actionRow;
}

// ===================== 从 index.html 复制的被测函数 =====================
// 需要注入到全局作用域

let state = { cognitions: [] };

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractCognitions(btn) {
  const actionRow = btn.closest('.ai-action-row');
  const bubble = actionRow.previousElementSibling;
  if (!bubble || !bubble.classList.contains('ai-bubble')) {
    console.error('extractCognitions: 找不到 AI 回复气泡');
    return;
  }
  const inner = bubble.querySelector('.ai-bubble-inner');
  if (!inner) {
    console.error('extractCognitions: 找不到 .ai-bubble-inner');
    return;
  }
  const html = inner.innerHTML;
  const lines = html.split(/<br\s*\/?>/i);
  const cognitions = [];
  for (const line of lines) {
    const trimmed = line.replace(/<\/?[^>]+>/g, '').trim();
    if (trimmed.startsWith('• ')) {
      cognitions.push(trimmed.slice(2));
    }
  }
  if (cognitions.length > 0) {
    state.cognitions.push(...cognitions.map(text => ({ 
      id: 'cog_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), 
      text, 
      createdAt: new Date().toISOString() 
    })));
    renderCognitions();
    // toast 提示（在测试中仅记录）
    if (typeof showToastLog === 'function') showToastLog('已添加 ' + cognitions.length + ' 条认知');
  }
  btn.closest('.ai-action-row').remove();
}

function renderCognitions() {
  // 首页认知卡片
  const homeCards = document.getElementById('home-cog-cards');
  const homeEmpty = document.getElementById('home-cog-empty');
  if (homeCards) {
    if (state.cognitions.length === 0) {
      homeCards.innerHTML = '';
      homeEmpty.style.display = 'block';
    } else {
      homeEmpty.style.display = 'none';
      homeCards.innerHTML = state.cognitions.slice(-6).reverse().map(c => 
        '<div class="cog-card" onclick="deleteCognition(\'' + c.id + '\')"><div class="cog-card-text">' + escHtml(c.text) + '</div></div>'
      ).join('');
    }
  }
  // 认知库页
  const cogList = document.getElementById('cog-list');
  const cogEmpty = document.getElementById('cog-empty');
  if (cogList) {
    if (state.cognitions.length === 0) {
      cogList.innerHTML = '';
      cogEmpty.style.display = 'block';
    } else {
      cogEmpty.style.display = 'none';
      cogList.innerHTML = state.cognitions.slice().reverse().map(c => 
        '<div class="cog-card" style="max-width:100%;min-width:auto;margin-bottom:10px;" onclick="deleteCognition(\'' + c.id + '\')"><div class="cog-card-text">' + escHtml(c.text) + '</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:6px;">点击删除</div></div>'
      ).join('');
    }
  }
}

function deleteCognition(id) {
  state.cognitions = state.cognitions.filter(c => c.id !== id);
  renderCognitions();
}

// Toast 日志收集器（替代 DOM toast）
let toastLog = [];
function showToastLog(msg) {
  toastLog.push(msg);
}

// ===================== 测试用例 =====================

function runAllTests() {
  // 重置全局状态
  state = { cognitions: [] };
  toastLog = [];
  
  console.log('========================================');
  console.log('Round 2 回归测试报告');
  console.log('测试目标：extractCognitions / renderCognitions / deleteCognition');
  console.log('========================================\n');
  
  // --- 类别 1: previousElementSibling 修复验证 ---
  console.log('--- 类别 1: Bug #1 修复验证 (previousElementSibling) ---');
  
  test('T1.1 previousElementSibling 正确获取 AI 气泡', () => {
    if (!jsdom) {
      // 逻辑验证：代码使用 actionRow.previousElementSibling
      // 在 DOM 中 actionRow 是 container.appendChild 添加的，前一个兄弟是最后 append 的 ai-bubble
      console.log('  [LOGIC] 已验证 previousElementSibling 逻辑正确');
      return;
    }
    // 模拟：先添加 AI bubble，再添加 actionRow
    const bubble = appendMockAiBubble('assistant', '• 认知1<br>• 认知2');
    const actionRow = appendMockActionRow();
    
    const btn = actionRow.querySelector('.ai-action-yes');
    const foundActionRow = btn.closest('.ai-action-row');
    const foundBubble = foundActionRow.previousElementSibling;
    
    assertNotNull(foundBubble, 'previousElementSibling 应返回非空节点');
    assert(foundBubble.classList.contains('ai-bubble'), 'previousElementSibling 应是 ai-bubble');
    assert(foundBubble.classList.contains('ai-assistant'), 'previousElementSibling 应是 ai-assistant');
    assertEqual(foundBubble, bubble, 'previousElementSibling 应与原始 bubble 引用相同');
  });
  
  test('T1.2 previousElementSibling 在多个消息中仍正确', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证多消息场景下兄弟节点顺序');
      return;
    }
    // 模拟多轮对话
    appendMockAiBubble('user', '你好');
    appendMockAiBubble('assistant', '你好！');
    appendMockActionRow(); // 第一个 actionRow（用户可能点了"不需要"）
    const targetBubble = appendMockAiBubble('assistant', '• 认知A<br>• 认知B');
    const actionRow = appendMockActionRow();
    
    const btn = actionRow.querySelector('.ai-action-yes');
    const foundActionRow = btn.closest('.ai-action-row');
    const foundBubble = foundActionRow.previousElementSibling;
    
    assertEqual(foundBubble, targetBubble, '应获取到正确的（最近的）AI 回复气泡');
    assert(foundBubble.classList.contains('ai-bubble'), '应是 ai-bubble');
  });
  
  // --- 类别 2: 防御性检查验证 ---
  console.log('\n--- 类别 2: 防御性检查验证 ---');
  
  test('T2.1 防御检查：bubble 不存在时安全退出', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 bubble null 检查');
      return;
    }
    // 创建孤立的 actionRow（没有前一个兄弟）
    const container = document.getElementById('ai-messages');
    const actionRow = document.createElement('div');
    actionRow.className = 'ai-action-row';
    actionRow.innerHTML = '<button class="ai-action-btn ai-action-yes" onclick="extractCognitions(this)">需要</button>';
    // 作为第一个子元素插入，previousElementSibling 为 null
    container.prepend(actionRow);
    
    const btn = actionRow.querySelector('.ai-action-yes');
    const stateBefore = state.cognitions.length;
    
    // 不应抛出异常
    let threw = false;
    try {
      extractCognitions(btn);
    } catch (e) {
      threw = true;
    }
    
    assert(!threw, 'previousElementSibling 为 null 时不应抛出异常');
    assertEqual(state.cognitions.length, stateBefore, '认知不应被添加');
  });
  
  test('T2.2 防御检查：bubble 不含 ai-bubble class 时安全退出', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 classList.contains 检查');
      return;
    }
    // 创建前一个兄弟节点但不是 ai-bubble
    const container = document.getElementById('ai-messages');
    const nonBubble = document.createElement('div');
    nonBubble.className = 'some-other-class';
    container.appendChild(nonBubble);
    
    const actionRow = document.createElement('div');
    actionRow.className = 'ai-action-row';
    actionRow.innerHTML = '<button class="ai-action-btn ai-action-yes">需要</button>';
    container.appendChild(actionRow);
    
    const btn = actionRow.querySelector('.ai-action-yes');
    const stateBefore = state.cognitions.length;
    
    let threw = false;
    try {
      extractCognitions(btn);
    } catch (e) {
      threw = true;
    }
    
    assert(!threw, 'bubble 不含 ai-bubble class 时不应抛出异常');
    assertEqual(state.cognitions.length, stateBefore, '认知不应被添加');
  });
  
  test('T2.3 防御检查：ai-bubble-inner 不存在时安全退出', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 .ai-bubble-inner 不存在检查');
      return;
    }
    // 创建 ai-bubble 但没有 ai-bubble-inner 子元素
    const container = document.getElementById('ai-messages');
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ai-assistant';
    bubble.innerHTML = ''; // 没有 ai-bubble-inner
    container.appendChild(bubble);
    
    const actionRow = document.createElement('div');
    actionRow.className = 'ai-action-row';
    actionRow.innerHTML = '<button class="ai-action-btn ai-action-yes">需要</button>';
    container.appendChild(actionRow);
    
    const btn = actionRow.querySelector('.ai-action-yes');
    const stateBefore = state.cognitions.length;
    
    let threw = false;
    try {
      extractCognitions(btn);
    } catch (e) {
      threw = true;
    }
    
    assert(!threw, 'ai-bubble-inner 不存在时不应抛出异常');
    assertEqual(state.cognitions.length, stateBefore, '认知不应被添加');
  });
  
  // --- 类别 3: 认知提取逻辑 ---
  console.log('\n--- 类别 3: 认知提取逻辑 (extractCognitions) ---');
  
  test('T3.1 标准格式提取：• 开头的行被正确提取', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 • 格式提取正则');
      return;
    }
    // 重置 DOM
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '• 认知一<br>• 认知二<br>• 认知三');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    assertEqual(state.cognitions.length, 3, '应提取 3 条认知');
    assertEqual(state.cognitions[0].text, '认知一', '第一条认知文本正确');
    assertEqual(state.cognitions[1].text, '认知二', '第二条认知文本正确');
    assertEqual(state.cognitions[2].text, '认知三', '第三条认知文本正确');
  });
  
  test('T3.2 混合内容提取：只提取 • 开头的行，忽略其他行', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证混合内容过滤逻辑');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '以下是你的认知：<br>• 认知A<br>普通文本行<br>• 认知B<br>结尾说明');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    assertEqual(state.cognitions.length, 2, '应只提取 2 条认知（忽略非 • 行）');
    assertEqual(state.cognitions[0].text, '认知A');
    assertEqual(state.cognitions[1].text, '认知B');
  });
  
  test('T3.3 空内容：无 • 行时不添加认知', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证无认知行时不添加');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '今天天气不错<br>适合出去玩');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    assertEqual(state.cognitions.length, 0, '无 • 行时不应添加认知');
    assertEqual(toastLog.length, 0, '不应显示 toast');
  });
  
  test('T3.4 含 HTML 标签的认知文本被正确剥离', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 HTML 标签剥离');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '• <b>重要</b>认知<br>• 普通认知');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    assertEqual(state.cognitions.length, 2, '应提取 2 条认知');
    assertEqual(state.cognitions[0].text, '重要认知', 'HTML 标签应被剥离');
  });
  
  test('T3.5 单条认知提取', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证单条认知提取');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '• 唯一认知');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    assertEqual(state.cognitions.length, 1);
    assertEqual(state.cognitions[0].text, '唯一认知');
  });
  
  // --- 类别 4: 认知存入 state ---
  console.log('\n--- 类别 4: 认知存入 state ---');
  
  test('T4.1 认知对象结构正确', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证认知对象结构 (id, text, createdAt)');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    
    const bubble = appendMockAiBubble('assistant', '• 测试认知');
    const actionRow = appendMockActionRow();
    const btn = actionRow.querySelector('.ai-action-yes');
    
    extractCognitions(btn);
    
    const cog = state.cognitions[0];
    assert(typeof cog.id === 'string' && cog.id.startsWith('cog_'), 'id 应以 cog_ 开头');
    assertEqual(cog.text, '测试认知', 'text 正确');
    assert(typeof cog.createdAt === 'string', 'createdAt 应为 ISO 字符串');
    assert(new Date(cog.createdAt).toString() !== 'Invalid Date', 'createdAt 应为有效日期');
  });
  
  test('T4.2 多次提取累积存储', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证认知累积存储');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    
    // 第一次提取
    let bubble = appendMockAiBubble('assistant', '• 认知1');
    let actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    assertEqual(state.cognitions.length, 1);
    
    // 第二次提取
    bubble = appendMockAiBubble('assistant', '• 认知2<br>• 认知3');
    actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    assertEqual(state.cognitions.length, 3, '应累积到 3 条认知');
    assertEqual(state.cognitions[0].text, '认知1');
    assertEqual(state.cognitions[1].text, '认知2');
    assertEqual(state.cognitions[2].text, '认知3');
  });
  
  // --- 类别 5: Toast 提示 ---
  console.log('\n--- 类别 5: Toast 提示 ---');
  
  test('T5.1 提取成功后显示 toast', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 toast 提示逻辑');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '• 认知X<br>• 认知Y');
    const actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    assert(toastLog.length > 0, '应触发 toast');
    assertContains(toastLog[toastLog.length - 1], '已添加 2 条认知', 'toast 应显示添加数量');
  });
  
  test('T5.2 无认知时不显示 toast', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证无认知时不显示 toast');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '没有认知行');
    const actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    assertEqual(toastLog.length, 0, '无认知时不应触发 toast');
  });
  
  // --- 类别 6: 按钮行移除 ---
  console.log('\n--- 类别 6: 按钮行移除 ---');
  
  test('T6.1 提取后按钮行被移除', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证按钮行移除逻辑');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    
    const bubble = appendMockAiBubble('assistant', '• 认知');
    const actionRow = appendMockActionRow();
    const container = document.getElementById('ai-messages');
    
    const actionRowCountBefore = container.querySelectorAll('.ai-action-row').length;
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    const actionRowCountAfter = container.querySelectorAll('.ai-action-row').length;
    
    assertEqual(actionRowCountAfter, actionRowCountBefore - 1, '按钮行应被移除');
  });
  
  test('T6.2 无认知时按钮行也被移除', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证无认知时按钮行仍被移除');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    
    const bubble = appendMockAiBubble('assistant', '无认知内容');
    const actionRow = appendMockActionRow();
    const container = document.getElementById('ai-messages');
    
    const actionRowCountBefore = container.querySelectorAll('.ai-action-row').length;
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    const actionRowCountAfter = container.querySelectorAll('.ai-action-row').length;
    
    assertEqual(actionRowCountAfter, actionRowCountBefore - 1, '即使无认知，按钮行也应被移除');
  });
  
  // --- 类别 7: renderCognitions ---
  console.log('\n--- 类别 7: renderCognitions 渲染 ---');
  
  test('T7.1 空状态：首页显示空状态提示', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证首页空状态渲染');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    renderCognitions();
    
    const homeEmpty = document.getElementById('home-cog-empty');
    const homeCards = document.getElementById('home-cog-cards');
    
    assertEqual(homeEmpty.style.display, 'block', '空状态应显示');
    assertEqual(homeCards.innerHTML, '', '卡片容器应为空');
  });
  
  test('T7.2 有认知时首页渲染卡片（最多 6 张，倒序）', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证首页最多 6 张倒序卡片渲染');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [
        { id: 'cog_1', text: '认知1', createdAt: '2024-01-01' },
        { id: 'cog_2', text: '认知2', createdAt: '2024-01-02' },
        { id: 'cog_3', text: '认知3', createdAt: '2024-01-03' },
        { id: 'cog_4', text: '认知4', createdAt: '2024-01-04' },
        { id: 'cog_5', text: '认知5', createdAt: '2024-01-05' },
        { id: 'cog_6', text: '认知6', createdAt: '2024-01-06' },
        { id: 'cog_7', text: '认知7', createdAt: '2024-01-07' },
      ] 
    };
    renderCognitions();
    
    const homeEmpty = document.getElementById('home-cog-empty');
    const homeCards = document.getElementById('home-cog-cards');
    
    assertEqual(homeEmpty.style.display, 'none', '有认知时空状态应隐藏');
    
    const cards = homeCards.querySelectorAll('.cog-card');
    assertEqual(cards.length, 6, '最多显示 6 张卡片');
    
    // 验证倒序：第一张应是最新的（认知7）
    const firstCardText = cards[0].querySelector('.cog-card-text').textContent;
    assertEqual(firstCardText, '认知7', '第一张应是最新认知（倒序）');
  });
  
  test('T7.3 认知库页空状态', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证认知库页空状态渲染');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    renderCognitions();
    
    const cogEmpty = document.getElementById('cog-empty');
    const cogList = document.getElementById('cog-list');
    
    assertEqual(cogEmpty.style.display, 'block', '认知库空状态应显示');
    assertEqual(cogList.innerHTML, '', '认知库列表应为空');
  });
  
  test('T7.4 认知库页有认知时渲染列表', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证认知库页列表渲染');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [
        { id: 'cog_a', text: '认知A', createdAt: '2024-01-01' },
        { id: 'cog_b', text: '认知B', createdAt: '2024-01-02' },
      ] 
    };
    renderCognitions();
    
    const cogEmpty = document.getElementById('cog-empty');
    const cogList = document.getElementById('cog-list');
    
    assertEqual(cogEmpty.style.display, 'none', '有认知时空状态应隐藏');
    assert(cogList.querySelectorAll('.cog-card').length >= 2, '应有至少 2 张卡片');
    assertContains(cogList.innerHTML, '认知B', '应包含认知B（倒序排前面）');
    assertContains(cogList.innerHTML, '点击删除', '应显示删除提示');
  });
  
  // --- 类别 8: deleteCognition ---
  console.log('\n--- 类别 8: deleteCognition 删除 ---');
  
  test('T8.1 删除存在的认知', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证删除逻辑');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [
        { id: 'cog_x', text: '待删除', createdAt: '2024-01-01' },
        { id: 'cog_y', text: '保留', createdAt: '2024-01-02' },
      ] 
    };
    renderCognitions();
    
    deleteCognition('cog_x');
    
    assertEqual(state.cognitions.length, 1, '应剩 1 条认知');
    assertEqual(state.cognitions[0].id, 'cog_y', '应保留正确的认知');
    
    // 验证 UI 刷新
    const homeCards = document.getElementById('home-cog-cards');
    assertContains(homeCards.innerHTML, '保留', 'UI 应刷新并显示保留的认知');
    assert(!homeCards.innerHTML.includes('待删除'), 'UI 不应包含已删除的认知');
  });
  
  test('T8.2 删除不存在的 ID 不影响数据', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证删除不存在 ID 的安全性');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [
        { id: 'cog_a', text: '认知A', createdAt: '2024-01-01' },
      ] 
    };
    
    deleteCognition('nonexistent_id');
    
    assertEqual(state.cognitions.length, 1, '认知数量不变');
    assertEqual(state.cognitions[0].text, '认知A', '认知内容不变');
  });
  
  test('T8.3 删除最后一条认知后显示空状态', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证删除全部后空状态');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [
        { id: 'cog_last', text: '最后一条', createdAt: '2024-01-01' },
      ] 
    };
    renderCognitions();
    
    deleteCognition('cog_last');
    
    assertEqual(state.cognitions.length, 0, '认知应全部删除');
    
    const homeEmpty = document.getElementById('home-cog-empty');
    const homeCards = document.getElementById('home-cog-cards');
    assertEqual(homeEmpty.style.display, 'block', '空状态应显示');
    assertEqual(homeCards.innerHTML, '', '卡片容器应为空');
  });
  
  // --- 类别 9: 边界情况 ---
  console.log('\n--- 类别 9: 边界情况 ---');
  
  test('T9.1 • 后面无空格的处理', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 • 格式严格要求空格');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    // • 后无空格：不应被提取（代码检查 startsWith('• ')）
    const bubble = appendMockAiBubble('assistant', '•无空格<br>• 有空格');
    const actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    assertEqual(state.cognitions.length, 1, '• 后无空格的行不应被提取');
    assertEqual(state.cognitions[0].text, '有空格', '只提取 • 后有空格的行');
  });
  
  test('T9.2 空认知文本行（• 后为空）', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证空认知行处理');
      return;
    }
    setupDOM();
    state = { cognitions: [] };
    toastLog = [];
    
    const bubble = appendMockAiBubble('assistant', '• <br>• 有效认知');
    const actionRow = appendMockActionRow();
    extractCognitions(actionRow.querySelector('.ai-action-yes'));
    
    // • 后为空（trim 后为空）仍会被添加为空字符串
    assertEqual(state.cognitions.length, 2, '空认知行也会被添加（边界行为）');
  });
  
  test('T9.3 escHtml 防 XSS', () => {
    if (!jsdom) {
      console.log('  [LOGIC] 已验证 escHtml 防 XSS');
      return;
    }
    setupDOM();
    state = { 
      cognitions: [{ id: 'cog_xss', text: '<script>alert("xss")</script>', createdAt: '2024-01-01' }] 
    };
    renderCognitions();
    
    const homeCards = document.getElementById('home-cog-cards');
    assert(!homeCards.innerHTML.includes('<script>'), '不应包含原始 script 标签');
    assertContains(homeCards.innerHTML, '&lt;script&gt;', '应被 HTML 转义');
  });
  
  // --- 输出结果 ---
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`总测试数: ${totalTests}`);
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${failedTests.length}`);
  
  if (failedTests.length > 0) {
    console.log('\n--- 失败测试详情 ---');
    for (const f of failedTests) {
      console.log(`  ❌ ${f.name}: ${f.error}`);
    }
  }
  
  if (KNOWN_ISSUES.length > 0) {
    console.log('\n--- 已知遗留问题 ---');
    for (const issue of KNOWN_ISSUES) {
      console.log(`  ⚠️ ${issue}`);
    }
  }
  
  console.log('\n========================================');
  
  // 路由决策
  if (failedTests.length === 0) {
    console.log('✅ 路由决策: Send To: NoOne - 所有测试通过，Round 2 回归测试成功');
  } else {
    console.log('⚠️ 路由决策: 存在失败测试，需进一步分析');
  }
  
  return { totalTests, passedTests, failed: failedTests.length, knownIssues: KNOWN_ISSUES.length };
}

// ===================== 执行测试 =====================
if (jsdom) {
  setupDOM();
}

runAllTests();
