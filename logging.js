/**
 * @fileoverview Utility for logging script runs to a Google Sheet.
 * This file manages the creation, setup, and writing to the designated log sheet.
 * @see /@documentation/design.md
 */

/**
 * A utility object for managing all logging operations to a Google Sheet.
 */
const LoggingSheetUtil = {
  SHEET_NAME: 'Runs', // The required name for the logging tab in the sheet.
  HEADER_ROW: ['Timestamp', 'InboxAdds', 'ListDeleted', 'ListCreated', 'Notes'],

  /**
   * Ensures the logging sheet and its header row are correctly set up.
   * If the sheet or tab does not exist, it creates them.
   * This makes the script self-healing from accidental sheet deletion.
   */
  setup() {
    try {
      const sheetId = getLogSheetId();
      if (!sheetId) {
        console.warn('LOG_SHEET_ID is not configured. Skipping logging setup.');
        return;
      }
      const ss = SpreadsheetApp.openById(sheetId);
      let sheet = ss.getSheetByName(this.SHEET_NAME);

      if (!sheet) {
        sheet = ss.insertSheet(this.SHEET_NAME, 0);
        console.log(`Created logging sheet: "${this.SHEET_NAME}"`);
        sheet.appendRow(this.HEADER_ROW);
        console.log('Appended header row to new logging sheet.');
      }
    } catch (e) {
      // This error is critical for the user to see.
      const message = `Failed to set up logging sheet. Please check that LOG_SHEET_ID is valid. Error: ${e.message}`;
      console.error(message);
      GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'GTaskManager Setup Error', message);
    }
  },

  /**
   * Logs the results of a script run to the spreadsheet.
   * @param {object} stats The statistics object from the rollover process.
   * @param {Date} stats.timestamp - The start time of the run.
   * @param {number} stats.inboxAdds - Number of tasks moved to the inbox.
   * @param {number} stats.listDeleted - Number of stale lists deleted.
   * @param {number} stats.listCreated - Number of new lists created (0 or 1).
   * @param {string} stats.notes - Any notable events, like a timeout.
   */
  logRun(stats) {
    try {
      const sheetId = getLogSheetId();
      if (!sheetId) return; // Silently fail if logging is not configured.

      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      if (!sheet) {
         console.error(`Logging sheet "${this.SHEET_NAME}" not found. Cannot log run.`);
         return;
      }

      // Ensure all stat properties are defined to prevent errors.
      const rowData = {
        timestamp: stats.timestamp || new Date(),
        inboxAdds: stats.inboxAdds || 0,
        listDeleted: stats.listDeleted || 0,
        listCreated: stats.listCreated || 0,
        notes: stats.notes || ''
      };

      // Append the data in the correct order.
      sheet.appendRow([
        rowData.timestamp,
        rowData.inboxAdds,
        rowData.listDeleted,
        rowData.listCreated,
        rowData.notes,
      ]);
    } catch (e) {
      console.error(`Failed to log run to spreadsheet. Error: ${e.message}`);
      // Fallback to email if logging fails to ensure the user is notified.
      GmailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        'GTaskManager Logging Failure',
        `The script could not write to the log sheet.\n\nError: ${e.message}`
      );
    }
  },
};