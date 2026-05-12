// @ts-nocheck
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const cron = require('node-cron');

const TZ = 'Asia/Jerusalem';

// ── Placeholder job handlers (implemented in their respective feature specs) ──

/**
 * F13 — Weekly submissions auto-flag
 * Every Sunday at 23:59 IL time: mark any week with no submission as 'missing'.
 * Idempotent: only updates rows still in 'draft' / no submission row.
 */
async function checkMissingSubmissions() {
  // TODO: implement in F13
  console.log('[cron] checkMissingSubmissions fired');
}

/**
 * F19 — Reminder email dispatch
 * Every Thursday at 09:00 IL time: send reminder to users who haven't submitted.
 * Idempotent: checks submission status before sending, skips already-sent.
 */
async function dispatchReminderEmails() {
  // TODO: implement in F19
  console.log('[cron] dispatchReminderEmails fired');
}

// ── Cron registry ─────────────────────────────────────────────────────────────

function initCron() {
  // Sunday 23:59 IL — weekly submissions auto-flag (F13)
  cron.schedule('59 23 * * 0', checkMissingSubmissions, { timezone: TZ });

  // Thursday 09:00 IL — reminder email dispatch (F19)
  cron.schedule('0 9 * * 4', dispatchReminderEmails, { timezone: TZ });

  console.log('[cron] Scheduler initialised (TZ=%s)', TZ);
}

// ── On-demand trigger (called per time_entry save from service layer) ─────────

/**
 * F09/F19 — Quota warning check
 * Called synchronously after every time_entry save.
 * Idempotent: checks current totals, only fires notification if threshold crossed.
 * @param {number} userId
 */
async function checkQuotaWarning(userId) {
  // TODO: implement in F09/F19
  void userId;
}

module.exports = { initCron, checkQuotaWarning };

