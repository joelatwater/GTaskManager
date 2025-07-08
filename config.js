/**
 * @fileoverview Configuration getters and setup function for script properties.
 * This file centralizes access to all configuration and provides a function to initialize the script.
 * @see /README.md for details on how to set these properties.
 */

/**
 * An interactive setup function to configure the script.
 * This function will create a new Google Sheet for logging if one doesn't exist,
 * set the required script property, and create the daily time-driven trigger.
 */
function setup() {
  // --- Configure Logging Sheet ---
  let sheetId = getLogSheetId();
  let isNewSheet = false;

  // Check if a sheet ID is already stored.
  if (sheetId) {
    try {
      // Verify the existing sheet is accessible.
      const sheet = SpreadsheetApp.openById(sheetId);
      console.log(`✅ Using existing logging sheet: ${sheet.getUrl()}`);
    } catch (e) {
      // If the sheet is not accessible (e.g., deleted), clear the invalid ID.
      console.warn('Could not access the configured logging sheet. A new one will be created.');
      sheetId = null;
    }
  }

  // If no valid sheet ID exists, create a new one.
  if (!sheetId) {
    const sheet = SpreadsheetApp.create('GTaskManager Logs');
    sheetId = sheet.getId();
    PropertiesService.getScriptProperties().setProperty('LOG_SHEET_ID', sheetId);
    console.log(`✅ New logging sheet created. URL: ${sheet.getUrl()}`);
    isNewSheet = true;
  }

  // --- Clean up old triggers ---
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'dailyRunner') {
      ScriptApp.deleteTrigger(trigger);
      console.log('ℹ️ Removed an old daily trigger.');
    }
  }

  // --- Create Daily Trigger ---
  const triggerHour = getDailyTriggerHour();
  ScriptApp.newTrigger('dailyRunner')
    .timeBased()
    .atHour(triggerHour)
    .everyDays(1)
    .create();
  console.log(`✅ Daily trigger created to run every day around ${triggerHour}:00.`);

  // --- Final Instructions ---
  console.log('\n🚀 Setup is complete!');
  if (isNewSheet) {
    console.log('A "Runs" tab will be created automatically on the first run.');
  }
  console.log('If you haven\'t already, please run the `dailyRunner` function manually once to authorize the script.');
}

/**
 * A private helper function to retrieve all script properties.
 * @returns {GoogleAppsScript.Properties.Properties} The script properties object.
 */
const getProperties = () => PropertiesService.getScriptProperties();

/**
 * Gets the name of the task list to move incomplete tasks to.
 * @returns {string} The title of the Inbox list. Defaults to "Inbox".
 */
const getInboxListName = () => getProperties().getProperty('INBOX_LIST_NAME') || 'Inbox';

/**
 * Gets the prefix used to identify daily task lists.
 * @returns {string} The prefix for daily lists. Defaults to "[Daily]".
 */
const getDailyListPrefix = () => getProperties().getProperty('DAILY_LIST_PREFIX') || '[Daily]';

/**
 * Gets the IANA Time Zone for date formatting.
 * @returns {string} The IANA time zone. Defaults to the script's time zone.
 */
const getLocalTimeZone = () => getProperties().getProperty('LOCAL_TIME_ZONE') || Session.getScriptTimeZone();

/**
 * Gets the hour (0-23) for the daily trigger.
 * @returns {number} The hour for the daily trigger. Defaults to 0.
 */
const getDailyTriggerHour = () => parseInt(getProperties().getProperty('DAILY_TRIGGER_HOUR'), 10) || 2; // Default to 2 AM

/**
 * Gets the ID of the Google Sheet used for logging.
 * @returns {string} The logging spreadsheet ID.
 */
const getLogSheetId = () => getProperties().getProperty('LOG_SHEET_ID');

/**
 * Gets the day of the week (0=Sun, 6=Sat) to send the weekly digest.
 * @returns {number} The day for the weekly digest. Defaults to 1 (Monday).
 */
const getWeeklyDigestDay = () => parseInt(getProperties().getProperty('WEEKLY_DIGEST_DAY'), 10) || 1;

/**
 * Gets the user's preference for tracking task rollover counts.
 * @returns {boolean} True if rollover counts should be tracked. Defaults to true.
 */
const getTrackRolloverCount = () => {
  const prop = getProperties().getProperty('TRACK_ROLLOVER_COUNT');
  return prop === null || prop === 'true'; // Default to true if not set
};

/**
 * Gets the execution timeout in seconds.
 * @returns {number} The timeout in seconds. Defaults to 270.
 */
const getExecutionTimeoutSeconds = () => parseInt(getProperties().getProperty('EXECUTION_TIMEOUT_SECONDS'), 10) || 270;