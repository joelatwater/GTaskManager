/**
 * @fileoverview Manages the creation and sending of the weekly digest email.
 * This file reads data from the log sheet to compile a summary of the week's activity.
 * @see /@documentation/design.md
 */

/**
 * A utility object for composing and sending the weekly digest email.
 */
const DigestMailer = {
  /**
   * Composes and sends the weekly summary email.
   * It reads the last 7 days of data from the "Runs" sheet, formats it into an HTML table,
   * and emails it to the script's effective user.
   */
  sendWeeklyDigest() {
    const sheetId = getLogSheetId();
    if (!sheetId) {
      console.warn('Cannot send weekly digest: LOG_SHEET_ID is not configured.');
      return;
    }

    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Runs');
      if (!sheet) {
        console.error('Cannot send weekly digest: "Runs" sheet not found.');
        return;
      }

      // --- Data Collection ---
      const data = sheet.getDataRange().getValues();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const dailyStats = {}; // Use an object to store stats by date string for efficient lookup.

      // Start from row 1 to skip the header row.
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const timestamp = new Date(row[0]);

        if (timestamp >= sevenDaysAgo) {
          const dateString = Utilities.formatDate(timestamp, getLocalTimeZone(), 'yyyy-MM-dd');
          dailyStats[dateString] = {
            rolledOver: parseInt(row[1], 10) || 0, // Column B: InboxAdds
            note: row[4] || '' // Column E: Notes
          };
        }
      }

      // --- Email Composition ---
      let tableRows = '';
      // Iterate backwards from today to build the table in chronological order.
      for (let i = 0; i > -7; i--) {
        const day = new Date();
        day.setDate(day.getDate() + i);

        const dateString = Utilities.formatDate(day, getLocalTimeZone(), 'yyyy-MM-dd');
        const dayName = Utilities.formatDate(day, getLocalTimeZone(), 'EEEE, MMMM d');
        
        const stats = dailyStats[dateString];
        const rolledOverCount = stats ? stats.rolledOver : 0;
        
        // Prepend rows to build the table from oldest to newest.
        tableRows = `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">${dayName}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${rolledOverCount}</td></tr>` + tableRows;
      }

      const recipient = Session.getEffectiveUser().getEmail();
      const subject = 'GTaskManager - Weekly Digest';
      const htmlBody = `
        <html>
          <body style="font-family: sans-serif; margin: 20px;">
            <h2>GTaskManager Weekly Summary</h2>
            <p>Here is your daily breakdown of rolled-over tasks for the past 7 days:</p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="padding: 12px; border-bottom: 2px solid #333; text-align: left;">Day</th>
                  <th style="padding: 12px; border-bottom: 2px solid #333; text-align: center;">Tasks Rolled Over</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <p style="font-size: 12px; color: #777; margin-top: 20px;">This is an automated report from your GTaskManager script.</p>
          </body>
        </html>
      `;

      GmailApp.sendEmail(recipient, subject, '', { htmlBody: htmlBody });
      console.log(`Weekly digest sent to ${recipient}.`);

    } catch (e) {
      console.error(`Failed to send weekly digest. Error: ${e.message}`);
      GmailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        'GTaskManager Digest Failure',
        `The script could not generate or send the weekly digest.\n\nError: ${e.message}`
      );
    }
  },
};