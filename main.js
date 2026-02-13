/**
 * @fileoverview Main script file containing the dailyRunner entry point and core orchestration logic.
 * This file is responsible for the main execution flow of the script.
 * @see /@documentation/design.md
 */

/**
 * The main entry point for the script, intended to be called by a daily time-driven trigger.
 * This function manages locking, orchestrates the daily rollover, processes the inbox,
 * logs the results, and triggers the weekly digest email.
 */
function dailyRunner() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { // Wait up to 30s for the lock
    console.log('Aborting run: Could not acquire lock. Another instance is likely running.');
    return;
  }

  const startTime = new Date();
  const stats = {
    timestamp: startTime,
    inboxAdds: 0,
    listDeleted: 0,
    listCreated: 0,
    inboxMoves: 0, // New stat for this feature
    completedTasks: [],
    notes: '',
  };

  try {
    const tz = getLocalTimeZone();
    const todayTitle = Utilities.formatDate(startTime, tz, 'MMMM d, yyyy');

    // Core processes
    const { todayListId, inboxId } = rolloverProcess(todayTitle, startTime, stats);

    if (getAutoMoveDueTasks()) {
      processInboxTasks(todayListId, inboxId, stats);
    }

    LoggingSheetUtil.logRun(stats);

    if (startTime.getDay() == getWeeklyDigestDay()) {
      DigestMailer.sendWeeklyDigest();
    }

  } catch (e) {
    console.error(`Fatal error in dailyRunner: ${e.message}\n${e.stack}`);
    stats.notes = `FATAL: ${e.message}`;
    LoggingSheetUtil.logRun(stats); // Log the failure
    GmailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Google Tasks Script has failed!',
      `The daily task rollover script encountered a fatal error and could not complete.\n\nError: ${e.message}`
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Orchestrates the daily rollover process: finds and deletes stale lists,
 * migrating their incomplete tasks to the inbox.
 * @param {string} todayTitle The formatted title for today's list.
 * @param {Date} startTime The script start time, for the timeout safeguard.
 * @param {object} stats The statistics object to be updated.
 * @returns {{todayListId: string, inboxId: string}} The IDs of the critical lists.
 */
function rolloverProcess(todayTitle, startTime, stats) {
  LoggingSheetUtil.setup();

  const dailyListPrefix = getDailyListPrefix();
  const todayListFullName = `${dailyListPrefix} ${todayTitle}`;

  const inboxList = ListService.getListByTitle(getInboxListName());
  if (!inboxList) {
    throw new Error(`Inbox list "${getInboxListName()}" not found.`);
  }
  const inboxId = inboxList.id;

  const allLists = ListService.listAll();
  let todayList = allLists.find(list => list.title === todayListFullName);
  const staleLists = allLists.filter(list => 
    list.title.startsWith(dailyListPrefix) && list.title !== todayListFullName
  );

  const timeoutSeconds = getExecutionTimeoutSeconds();
  for (const staleList of staleLists) {
    if ((new Date() - startTime) / 1000 > timeoutSeconds) {
      stats.notes = 'Run paused during rollover due to execution timeout.';
      console.warn('Execution time exceeded during rollover. Pausing run.');
      break;
    }
    stats.inboxAdds += migrateIncompleteTasks(staleList.id, inboxId);
    stats.completedTasks.push(...CompletedTaskService.getCompletedTasksFromList(staleList.id));
    ListService.deleteList(staleList.id);
    stats.listDeleted++;
  }

  if (!todayList) {
    todayList = ListService.createList(todayListFullName);
    stats.listCreated++;
  }

  return { todayListId: todayList.id, inboxId };
}

/**
 * Moves non-recurring tasks due today from the Inbox to today's daily list.
 * @param {string} todayListId The ID of the list for today's tasks.
 * @param {string} inboxId The ID of the Inbox list.
 * @param {object} stats The statistics object to be updated.
 */
function processInboxTasks(todayListId, inboxId, stats) {
  const tasks = TaskService.listAllTasks(inboxId);
  const today = new Date();
  const todayDateString = Utilities.formatDate(today, getLocalTimeZone(), 'yyyy-MM-dd');

  for (const task of tasks) {
    // Skip tasks with no due date or that have a recurrence rule
    if (!task.due || task.recurrence) {
      continue;
    }

    // Google Tasks API returns 'due' as an RFC 3339 timestamp (e.g., "2025-07-10T00:00:00.000Z")
    // We only care about the date part.
    const taskDueDate = task.due.substring(0, 10);

    if (taskDueDate === todayDateString) {
      TaskService.move(task, inboxId, todayListId);
      stats.inboxMoves++;
    }
  }
  console.log(`Moved ${stats.inboxMoves} tasks due today from Inbox to the daily list.`);
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
      const updatedTask = TaskService.updateNotes(sourceListId, task.id, notes);
      TaskService.move(updatedTask, sourceListId, destListId);
    } else {
      TaskService.move(task, sourceListId, destListId);
    }
  }
  return tasksToMove.length;
}