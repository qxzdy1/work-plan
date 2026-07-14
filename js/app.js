/**
 * 应用主逻辑
 * 依赖：config.js 中的 Supabase 配置与常量
 */

// ===== 初始化 Supabase =====
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 日程分栏常量 =====
const SPLIT_HOUR = 15; // 左列 06:00-15:00，右列 15:00-00:00
const HALF_HOURS = 9;

// ===== DOM 元素 =====
const els = {
  yearSelect: document.getElementById('yearSelect'),
  monthSelect: document.getElementById('monthSelect'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  calendarGrid: document.getElementById('calendarGrid'),
  scheduleDateTitle: document.getElementById('scheduleDateTitle'),
  scheduleWrapper: document.getElementById('scheduleWrapper'),
  trashToggle: document.getElementById('trashToggle'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  messageList: document.getElementById('messageList'),
  messageForm: document.getElementById('messageForm'),
  messageAuthor: document.getElementById('messageAuthor'),
  messageContent: document.getElementById('messageContent'),
  announcementList: document.getElementById('announcementList'),
  taskModal: document.getElementById('taskModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  taskForm: document.getElementById('taskForm'),
  taskId: document.getElementById('taskId'),
  taskDate: document.getElementById('taskDate'),
  taskStart: document.getElementById('taskStart'),
  taskEnd: document.getElementById('taskEnd'),
  taskTitle: document.getElementById('taskTitle'),
  taskDesc: document.getElementById('taskDesc'),
  taskLevel: document.getElementById('taskLevel'),
  formError: document.getElementById('formError')
};

// ===== 状态 =====
let currentDate = new Date();
let selectedDate = new Date();
let monthTasks = [];
let dayTasks = [];
let deleteMode = false;

// ===== 工具函数 =====
function pad(n) {
  return n.toString().padStart(2, '0');
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInputValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addHours(date, h) {
  const d = new Date(date);
  d.setHours(d.getHours() + h);
  return d;
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatDateCn(date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
}

function formatTimeRange(start, end) {
  const fmt = (d) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(start)} - ${fmt(end)}`;
}

function getTaskEnd(task) {
  if (task.end_time) return new Date(task.end_time);
  return addHours(new Date(task.task_time), 1);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showError(msg) {
  els.formError.textContent = msg;
}

function clearError() {
  els.formError.textContent = '';
}

// ===== 数据加载 =====
async function loadMonthTasks() {
  try {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();

    const { data, error } = await supabaseClient
      .from(TASKS_TABLE)
      .select('*')
      .gte('task_time', start)
      .lt('task_time', end)
      .order('task_time');

    if (error) throw error;
    monthTasks = data || [];
    renderCalendar();
  } catch (err) {
    console.error('加载月任务失败:', err);
    const detail = err?.message || err?.code || JSON.stringify(err);
    alert('加载月任务失败：' + detail + '\n请检查 Supabase 配置、表结构（task_time 应为 timestamptz）和 RLS 策略。');
  }
}

async function loadDayTasks() {
  try {
    const s = startOfDay(selectedDate).toISOString();
    const e = endOfDay(selectedDate).toISOString();

    const { data, error } = await supabaseClient
      .from(TASKS_TABLE)
      .select('*')
      .lt('task_time', e)
      .or(`end_time.gte.${s},end_time.is.null`)
      .order('task_time');

    if (error) throw error;
    dayTasks = data || [];
    renderSchedule();
  } catch (err) {
    console.error('加载日任务失败:', err);
    const detail = err?.message || err?.code || JSON.stringify(err);
    alert('加载日任务失败：' + detail + '\n请检查 Supabase 配置、表结构（task_time/end_time 应为 timestamptz）和 RLS 策略。');
  }
}

async function loadMessages() {
  try {
    const { data, error } = await supabaseClient
      .from(MESSAGES_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    renderMessages(data || []);
  } catch (err) {
    console.error('加载留言失败:', err);
  }
}

async function loadAnnouncements() {
  try {
    const { data, error } = await supabaseClient
      .from(ANNOUNCEMENTS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    renderAnnouncements(data || []);
  } catch (err) {
    console.error('加载公告失败:', err);
  }
}

// ===== 日历渲染 =====
function getTaskCountMap() {
  const map = new Map();
  monthTasks.forEach(task => {
    const d = new Date(task.task_time);
    const key = toDateInputValue(d);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function getHeatClass(count) {
  if (!count) return 'heat-0';
  if (count <= 2) return 'heat-1';
  if (count <= 5) return 'heat-2';
  return 'heat-3';
}

function renderCalendar() {
  const grid = els.calendarGrid;
  grid.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const counts = getTaskCountMap();

  const totalCells = 42;

  for (let i = 0; i < totalCells; i++) {
    const offset = i - firstDay;
    const dayNumber = offset + 1;
    let cellDate;
    let isOtherMonth = false;

    if (offset < 0) {
      cellDate = new Date(year, month - 1, prevDays + offset + 1);
      isOtherMonth = true;
    } else if (offset >= daysInMonth) {
      cellDate = new Date(year, month + 1, offset - daysInMonth + 1);
      isOtherMonth = true;
    } else {
      cellDate = new Date(year, month, dayNumber);
    }

    const count = counts.get(toDateInputValue(cellDate)) || 0;
    const isSelected = sameDay(cellDate, selectedDate);
    const heatClass = getHeatClass(count);

    const cell = document.createElement('div');
    cell.className = `calendar-day ${heatClass} ${isSelected ? 'selected' : ''} ${isOtherMonth ? 'other-month' : ''}`;
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.innerHTML = `
      <span class="day-number">${cellDate.getDate()}</span>
      <span class="task-count">${count} 项</span>
    `;

    cell.addEventListener('click', () => selectDate(cellDate));
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') selectDate(cellDate);
    });

    grid.appendChild(cell);
  }
}

function selectDate(date) {
  selectedDate = new Date(date);
  if (!sameDay(date, currentDate) && (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear())) {
    currentDate = new Date(date);
    populateDateSelectors();
    loadMonthTasks();
  }
  renderCalendar();
  loadDayTasks();
}

// ===== 日程渲染（双列 + 冲突均分） =====
function assignLanes(segments) {
  // 按开始时间排序
  segments.sort((a, b) => a.segStart - b.segStart || a.segEnd - b.segEnd);

  const lanes = []; // { index, end }
  segments.forEach(seg => {
    // 找一个已经结束的车道复用
    const freeLane = lanes
      .filter(l => l.end <= seg.segStart)
      .sort((a, b) => a.index - b.index)[0];

    if (freeLane) {
      seg.lane = freeLane.index;
      freeLane.end = seg.segEnd;
    } else {
      seg.lane = lanes.length;
      lanes.push({ index: seg.lane, end: seg.segEnd });
    }
  });

  const totalLanes = lanes.length || 1;
  segments.forEach(seg => {
    seg.width = 100 / totalLanes;
    seg.left = seg.lane * seg.width;
  });
}

function createTaskBlock(task, topPct, heightPct, leftPct, widthPct) {
  const start = new Date(task.task_time);
  const end = getTaskEnd(task);

  const block = document.createElement('div');
  block.className = `task-block level-${task.level}`;
  block.style.top = `${topPct}%`;
  block.style.height = `${heightPct}%`;
  block.style.left = `calc(${leftPct}% + 3px)`;
  block.style.width = `calc(${widthPct}% - 6px)`;
  block.dataset.id = task.id;

  block.innerHTML = `
    <div class="task-title">${escapeHtml(task.title)}</div>
    <div class="task-time">${formatTimeRange(start, end)}</div>
    <button type="button" class="task-delete-btn" data-id="${task.id}" title="删除">×</button>
  `;

  block.addEventListener('click', (e) => {
    if (deleteMode || e.target.closest('.task-delete-btn')) return;
    openTaskModal(task);
  });

  const delBtn = block.querySelector('.task-delete-btn');
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  return block;
}

function renderSchedule() {
  els.scheduleDateTitle.textContent = `${formatDateCn(selectedDate)} 日程`;
  const wrapper = els.scheduleWrapper;
  wrapper.innerHTML = '';

  const dayStart = new Date(selectedDate);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
  const splitTime = new Date(selectedDate);
  splitTime.setHours(SPLIT_HOUR, 0, 0, 0);

  const cols = [
    { baseHour: DAY_START_HOUR, endHour: SPLIT_HOUR },
    { baseHour: SPLIT_HOUR, endHour: DAY_END_HOUR }
  ];

  // 先把每个任务按时间拆分到左右两列
  const colSegments = [[], []];
  dayTasks.forEach(task => {
    const start = new Date(task.task_time);
    const end = getTaskEnd(task);

    if (end <= dayStart || start >= dayEnd) return;

    const visStart = start < dayStart ? dayStart : start;
    const visEnd = end > dayEnd ? dayEnd : end;

    if (visStart < splitTime && visEnd > splitTime) {
      colSegments[0].push({ task, segStart: visStart, segEnd: splitTime });
      colSegments[1].push({ task, segStart: splitTime, segEnd: visEnd });
    } else if (visEnd <= splitTime) {
      colSegments[0].push({ task, segStart: visStart, segEnd: visEnd });
    } else {
      colSegments[1].push({ task, segStart: visStart, segEnd: visEnd });
    }
  });

  cols.forEach((col, idx) => {
    const colEl = document.createElement('div');
    colEl.className = 'schedule-col';

    const labelsEl = document.createElement('div');
    labelsEl.className = 'time-labels';
    labelsEl.setAttribute('aria-hidden', 'true');
    for (let h = col.baseHour; h < col.endHour; h++) {
      const label = document.createElement('div');
      label.className = 'time-label';
      label.textContent = `${pad(h)}:00`;
      labelsEl.appendChild(label);
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'schedule-content';
    if (deleteMode) contentEl.classList.add('delete-mode');

    const segments = colSegments[idx];
    const msInHalf = HALF_HOURS * 3600 * 1000;
    const colBase = new Date(selectedDate);
    colBase.setHours(col.baseHour, 0, 0, 0);

    if (segments.length > 0) {
      assignLanes(segments);
      segments.forEach(seg => {
        const topPct = ((seg.segStart - colBase) / msInHalf) * 100;
        const heightPct = ((seg.segEnd - seg.segStart) / msInHalf) * 100;
        const block = createTaskBlock(seg.task, topPct, heightPct, seg.left, seg.width);
        contentEl.appendChild(block);
      });
    } else if (dayTasks.length === 0 && idx === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-tip';
      empty.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
      empty.textContent = '当天暂无任务，点击右上角 + 添加';
      contentEl.appendChild(empty);
    }

    colEl.appendChild(labelsEl);
    colEl.appendChild(contentEl);
    wrapper.appendChild(colEl);
  });
}

// ===== 任务弹窗 =====
function openTaskModal(task = null) {
  clearError();
  els.taskForm.reset();
  els.taskId.value = '';

  if (task) {
    els.modalTitle.textContent = '编辑任务';
    els.taskId.value = task.id;
    const start = new Date(task.task_time);
    const end = getTaskEnd(task);
    els.taskDate.value = toDateInputValue(start);
    els.taskStart.value = toTimeInputValue(start);
    els.taskEnd.value = toTimeInputValue(end);
    els.taskTitle.value = task.title || '';
    els.taskDesc.value = task.description || '';
    els.taskLevel.value = String(task.level || 2);
  } else {
    els.modalTitle.textContent = '新建任务';
    els.taskDate.value = toDateInputValue(selectedDate);
    els.taskStart.value = '09:00';
    els.taskEnd.value = '10:00';
    els.taskLevel.value = '2';
  }

  els.taskModal.hidden = false;
  els.taskTitle.focus();
}

function closeTaskModal() {
  els.taskModal.hidden = true;
  clearError();
}

async function saveTask(e) {
  e.preventDefault();
  clearError();

  const id = els.taskId.value;
  const dateVal = els.taskDate.value;
  const startVal = els.taskStart.value;
  const endVal = els.taskEnd.value;

  if (!dateVal || !startVal || !endVal) {
    showError('请填写完整的时间信息');
    return;
  }

  const start = new Date(`${dateVal}T${startVal}`);
  const end = new Date(`${dateVal}T${endVal}`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    showError('时间格式不正确');
    return;
  }

  if (end <= start) {
    showError('结束时间必须晚于开始时间');
    return;
  }

  const payload = {
    title: els.taskTitle.value.trim(),
    description: els.taskDesc.value.trim(),
    level: parseInt(els.taskLevel.value, 10),
    task_time: start.toISOString(),
    end_time: end.toISOString()
  };

  try {
    let error;
    if (id) {
      const res = await supabaseClient.from(TASKS_TABLE).update(payload).eq('id', id);
      error = res.error;
    } else {
      const res = await supabaseClient.from(TASKS_TABLE).insert(payload);
      error = res.error;
    }

    if (error) throw error;

    closeTaskModal();
    await loadMonthTasks();
    await loadDayTasks();
  } catch (err) {
    console.error('保存任务失败:', err);
    showError('保存失败：' + (err.message || '未知错误'));
  }
}

async function deleteTask(id) {
  if (!confirm('确定要删除这个任务吗？')) return;
  try {
    const { error } = await supabaseClient.from(TASKS_TABLE).delete().eq('id', id);
    if (error) throw error;
    await loadMonthTasks();
    await loadDayTasks();
  } catch (err) {
    console.error('删除任务失败:', err);
    alert('删除失败：' + (err.message || '未知错误'));
  }
}

function toggleDeleteMode() {
  deleteMode = !deleteMode;
  els.trashToggle.classList.toggle('active', deleteMode);
  els.trashToggle.setAttribute('aria-pressed', String(deleteMode));
  document.querySelectorAll('.schedule-content').forEach(el => {
    el.classList.toggle('delete-mode', deleteMode);
  });
}

// ===== 留言与公告 =====
function renderMessages(list) {
  const container = els.messageList;
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-tip">还没有留言，快来第一条吧～</div>';
    return;
  }

  list.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'message-item';
    const created = new Date(msg.created_at);
    item.innerHTML = `
      <div class="message-meta">
        <span class="message-author">${escapeHtml(msg.author || '匿名')}</span>
        <span>${created.toLocaleString('zh-CN')}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    `;
    container.appendChild(item);
  });
}

function renderAnnouncements(list) {
  const container = els.announcementList;
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-tip">暂无公告</div>';
    return;
  }

  const item = list[0];
  const created = new Date(item.created_at);
  const div = document.createElement('div');
  div.className = 'announcement-full';
  div.innerHTML = `
    <div class="announcement-meta">${created.toLocaleString('zh-CN')}</div>
    <div class="announcement-content">${escapeHtml(item.content)}</div>
  `;
  container.appendChild(div);
}

async function submitMessage(e) {
  e.preventDefault();
  const content = els.messageContent.value.trim();
  if (!content) return;

  try {
    const { error } = await supabaseClient.from(MESSAGES_TABLE).insert({
      author: els.messageAuthor.value.trim() || '匿名',
      content
    });
    if (error) throw error;

    els.messageForm.reset();
    await loadMessages();
  } catch (err) {
    console.error('提交留言失败:', err);
    alert('提交留言失败：' + (err.message || '未知错误'));
  }
}

// ===== 控件初始化 =====
function populateDateSelectors() {
  const currentYear = new Date().getFullYear();
  const selectedYear = currentDate.getFullYear();

  els.yearSelect.innerHTML = '';
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}年`;
    if (y === selectedYear) opt.selected = true;
    els.yearSelect.appendChild(opt);
  }

  els.monthSelect.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${m + 1}月`;
    if (m === currentDate.getMonth()) opt.selected = true;
    els.monthSelect.appendChild(opt);
  }
}

function bindEvents() {
  els.prevMonth.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    populateDateSelectors();
    loadMonthTasks();
  });

  els.nextMonth.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    populateDateSelectors();
    loadMonthTasks();
  });

  els.yearSelect.addEventListener('change', () => {
    currentDate.setFullYear(parseInt(els.yearSelect.value, 10));
    loadMonthTasks();
  });

  els.monthSelect.addEventListener('change', () => {
    currentDate.setMonth(parseInt(els.monthSelect.value, 10));
    loadMonthTasks();
  });

  els.addTaskBtn.addEventListener('click', () => openTaskModal());
  els.trashToggle.addEventListener('click', toggleDeleteMode);

  els.modalClose.addEventListener('click', closeTaskModal);
  els.modalCancel.addEventListener('click', closeTaskModal);
  els.taskForm.addEventListener('submit', saveTask);

  els.taskModal.addEventListener('click', (e) => {
    if (e.target === els.taskModal) closeTaskModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.taskModal.hidden) closeTaskModal();
  });

  els.messageForm.addEventListener('submit', submitMessage);
}

// ===== 启动 =====
function init() {
  populateDateSelectors();
  bindEvents();
  loadMonthTasks();
  loadDayTasks();
  loadMessages();
  loadAnnouncements();
}

init();
