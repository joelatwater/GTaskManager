/**
 * @fileoverview Configuration file for the script.
 * This file provides getter functions for all script properties, allowing for centralized
 * management and default values.
 * @see /@documentation/design.md#3-configuration-script-properties
 */

// --- Script Property Getters ---

function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getInboxListName() {
  return getProperty('INBOX_LIST_NAME') || 'Inbox';
}

function getInboxListId() {
  return getProperty('INBOX_LIST_ID') || null;
}

function getDailyListPrefix() {
  return getProperty('DAILY_LIST_PREFIX') || '[Daily]';
}

function getLocalTimeZone() {
  return getProperty('LOCAL_TIME_ZONE') || Session.getScriptTimeZone();
}

function getDailyTriggerHour() {
  return parseInt(getProperty('DAILY_TRIGGER_HOUR') || '0', 10);
}

function getLogSheetId() {
  return getProperty('LOG_SHEET_ID'); // Required, no default
}

function getWeeklyDigestDay() {
  return parseInt(getProperty('WEEKLY_DIGEST_DAY') || '1', 10); // Default: Monday
}

function getWeeklyDigestHour() {
  return parseInt(getProperty('WEEKLY_DIGEST_HOUR') || '9', 10);
}

function getAddSummaryTask() {
  const value = getProperty('ADD_SUMMARY_TASK');
  return value !== 'false'; // Default to true
}

function getTrackRolloverCount() {
  const value = getProperty('TRACK_ROLLOVER_COUNT');
  return value !== 'false'; // Default to true
}

function getExecutionTimeoutSeconds() {
  return parseInt(getProperty('EXECUTION_TIMEOUT_SECONDS') || '270', 10);
}

/**
 * NEW: Gets the setting for auto-moving tasks due today from the Inbox.
 * Defaults to true if the property is not set.
 */
function getAutoMoveDueTasks() {
  const value = getProperty('AUTO_MOVE_DUE_TASKS');
  return value !== 'false'; // Default to true
}
