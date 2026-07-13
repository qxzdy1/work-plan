/**
 * Supabase 配置
 * 把这些常量改成环境变量/CI 替换时，只需修改本文件即可。
 * 注意：不要把 service_role key 写进前端代码。
 */
const SUPABASE_URL = 'https://xomsritnqbjlncsxwkml.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sC0evOBDEo9Xw3g_Pnb8Vw_i8QGNw9r';

const TASKS_TABLE = 'tasks';
const MESSAGES_TABLE = 'messages';
const ANNOUNCEMENTS_TABLE = 'announcements';

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const HOURS_COUNT = DAY_END_HOUR - DAY_START_HOUR;

const LEVELS = {
  1: { label: '低', color: 'var(--level-low)' },
  2: { label: '中', color: 'var(--level-medium)' },
  3: { label: '高', color: 'var(--level-high)' }
};

const HEAT_LEVELS = [
  { min: 0, max: 0, class: 'heat-0' },
  { min: 1, max: 2, class: 'heat-1' },
  { min: 3, max: 5, class: 'heat-2' },
  { min: 6, max: Infinity, class: 'heat-3' }
];
