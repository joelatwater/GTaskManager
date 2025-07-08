/**
 * @fileoverview Main script file containing the dailyRunner entry point and core orchestration logic.
 * This file is responsible for the main execution flow of the script.
 * @see /@documentation/design.md
 */

/**
 * The main entry point for the script, intended to be called by a daily time-driven trigger.
 * This function manages locking to prevent concurrent runs, orchestrates the daily rollover
 * process, logs the results, and triggers the weekly digest email.
 */
function dailyRunner() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { // Wait up to 30s for the lock
    console.log('Aborting run: Could not acquire lock. Another instance is likely running.');
    return;
  }

  const startTime = new Date(); // Start timer for execution safeguard

  try {
    const tz = getLocalTimeZone();
    const todayTitle = Utilities.formatDate(startTime, tz, 'MMMM d, yyyy');

    // Run the core process and get statistics back
    const stats = rolloverProcess(todayTitle, startTime);
    LoggingSheetUtil.logRun(stats);

    // Check if today is the day for the weekly digest
    if (startTime.getDay() == getWeeklyDigestDay()) {
      DigestMailer.sendWeeklyDigest();
    }

  } catch (e) {
    // Global error handler for any uncaught exceptions
    console.error(`Fatal error in dailyRunner: ${e.message}\n${e.stack}`);
    LoggingSheetUtil.logRun({ notes: `FATAL: ${e.message}` });
    GmailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Google Tasks Script has failed!',
      `The daily task rollover script encountered a fatal error and could not complete.\n\nError: ${e.message}`
    );
  } finally {
    // Always release the lock to ensure future runs are not blocked
    lock.releaseLock();
  }
}

/**
 * Orchestrates the daily rollover process.
 * This function finds stale daily lists, migrates their incomplete tasks, deletes them,
 * and ensures a list for the current day exists.
 * @param {string} todayTitle The formatted title for today's list (e.g., "July 08, 2025").
 * @param {Date} startTime The time the script began execution, used for the timeout safeguard.
 * @returns {object} A statistics object summarizing the run for logging purposes.
 * @throws {Error} If the designated Inbox list cannot be found.
 */
function rolloverProcess(todayTitle, startTime) {
  const stats = {
    timestamp: startTime,
    inboxAdds: 0,
    listDeleted: 0,
    listCreated: 0,
    notes: '',
  };

  LoggingSheetUtil.setup(); // Ensure the logging sheet is ready

  const dailyListPrefix = getDailyListPrefix();
  const todayListFullName = `${dailyListPrefix} ${todayTitle}`;

  const inboxList = ListService.getListByTitle(getInboxListName());
  if (!inboxList) {
    throw new Error(`Inbox list "${getInboxListName()}" not found. Please check your configuration.`);
  }
  const inboxId = inboxList.id;

  const allLists = ListService.listAll();
  const staleLists = [];
  let todayList = null;

  // Partition lists into today's list and stale lists
  for (const list of allLists) {
    if (list.title.startsWith(dailyListPrefix)) {
      if (list.title === todayListFullName) {
        todayList = list;
      } else {
        staleLists.push(list);
      }
    }
  }

  // Process each stale list, respecting the execution timeout
  const timeoutSeconds = getExecutionTimeoutSeconds();
  for (const staleList of staleLists) {
    if ((new Date() - startTime) / 1000 > timeoutSeconds) {
      stats.notes = 'Run paused due to execution timeout.';
      console.warn('Execution time exceeded. Pausing run.');
      break; // Exit loop cleanly
    }
    
    const movedCount = migrateIncompleteTasks(staleList.id, inboxId);
    stats.inboxAdds += movedCount;

    ListService.deleteList(staleList.id);
    stats.listDeleted++;
  }

  // Ensure today's list exists, creating it if necessary
  if (!todayList) {
    todayList = ListService.createList(todayListFullName);
    stats.listCreated++;
  }

  // If the run completed without other notes (e.g., a timeout), create a summary.
  if (!stats.notes) {
    stats.notes = `Run completed successfully. Tasks moved: ${stats.inboxAdds}. Lists deleted: ${stats.listDeleted}.`;
  }
  return stats;
}

/**
 * Migrates all incomplete tasks from a source list to a destination list.
 * If rollover tracking is enabled, it updates a counter in the task's notes.
 * @param {string} sourceListId The ID of the list to migrate tasks from.
 * @param {string} destListId The ID of the list to migrate tasks to.
 * @returns {number} The number of tasks that were moved.
 */
function migrateIncompleteTasks(sourceListId, destListId) {
  const tasksToMove = TaskService.listIncompleteTasks(sourceListId);
  let movedCount = 0;
  const trackRollover = getTrackRolloverCount();

  for (const task of tasksToMove) {
    if (trackRollover) {
      let notes = task.notes || "";
      const match = notes.match(/Rollover Count: (\d+)/);

      if (match) {
        const count = parseInt(match[1], 10) + 1;
        notes = notes.replace(/Rollover Count: \d+/, `Rollover Count: ${count}`);
      } else {
        notes += (notes ? "\n\n" : "") + "Rollover Count: 1";
      }
      
      // Update the task notes in place before moving
      // The updated task object is returned and used in the move operation
      const updatedTask = TaskService.updateNotes(sourceListId, task.id, notes);
      TaskService.move(updatedTask, sourceListId, destListId);
    } else {
      // If not tracking, move the original task
      TaskService.move(task, sourceListId, destListId);
    }
    movedCount++;
  }

  console.log(`Moved ${movedCount} incomplete tasks from list ${sourceListId}.`);
  return movedCount;
}