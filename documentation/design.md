### Daily Google Tasks Manager – Technical Design (v2.4 Final)

**Change Log:**

*   **v2.3 -> v2.4:** Added the `processInboxTasks` feature. This automatically moves non-recurring tasks with a due date of "today" from the Inbox to the newly created daily list. This feature is controlled by the `AUTO_MOVE_DUE_TASKS` script property.
*   **v2.2 -> v2.3:** Implemented logging for all completed tasks from stale lists. The task titles and completion timestamps are now archived in a new `CompletedTasks` column in the log sheet.
*   **v2.1 -> v2.2:** Added a detailed, phased development and testing plan tailored for AI-led, human-assisted implementation.
*   **v2.0 -> v2.1:** Added an optional in-context summary task for user feedback. Implemented an execution time safeguard to prevent timeouts. Added rollover tracking in task notes for enhanced analytics.
*   **v1.0 -> v2.0:** Consolidated to a single daily trigger. Added LockService. Implemented a prefix-based system for list identification. Switched to atomic Tasks.move() API. Added caching for Inbox List ID.

### 0. Document Purpose

This document translates the Conceptual Specification into a complete, implementation-ready design for a standalone Google Apps Script project. It outlines the final architecture, key modules, data structures, configuration, error handling, testing, and a phased development plan.

### 1. High-Level Architecture

The system is orchestrated by a single daily trigger. The architecture is designed for robustness with locking, self-healing, and timeout prevention.

                                  ┌───────────────────────────────┐
                                  │ Time-Driven Trigger           │
                                  │ (Daily @ DAILY_TRIGGER_HOUR)  │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
┌──────────────────┐ ◀─── acquires lock ── ┌─────────────┐
|   LockService    |                      │ dailyRunner │ ── checks day ──▶ calls ──┐
└──────────────────┘                      └──────┬──────┘                           │
                                                 │                                  │
                                                 │ calls                            │
                                                 ▼                                  │
                                     ┌───────────────────┐                          │
                                     │ rolloverProcess   │                          │
                                     └─────────┬─────────┘                          │
                                               │ uses                               │
                         ┌─────────────────────┼─────────────────────┐              │
                         │                     │                     │              │
                         ▼                     ▼                     ▼              │
                  ┌──────────────┐      ┌─────────────┐      ┌────────────────┐      │
                  │ ListService  │      │ TaskService │      │ LoggingSheetUtil ◀─┐   │
                  └──────────────┘      └──────┬──────┘      └────────┬───────┘   │   │
                                               │ reads completed      │ reads runs  │   │
                                               │ tasks & notes        │ for digest  │   │
                                               └──────────────────────┼─────────────┼───▼
                                                                      │             │
                                                                      ▼             │
                                                                ┌──────────────┐    │
                                                                │ DigestMailer │────┘
                                                                └──────────────┘

*   **dailyRunner:** Single entry-point. Manages locking, timing, and calls `rolloverProcess`, `processInboxTasks`, and `DigestMailer`.
*   **rolloverProcess:** Orchestrates list cleanup and task migration from stale lists to the Inbox.
*   **processInboxTasks (New):** Moves non-recurring tasks due today from the Inbox to the new daily list.
*   **ListService / TaskService:** Wrappers for the Google Tasks API.
*   **LoggingSheetUtil:** Manages reads/writes to the logging spreadsheet.
*   **DigestMailer:** Composes and sends the weekly summary email.

### 2. Deployment & Auth

| Step | Action |
| :--- | :--- |
| 1    | Create a stand-alone Apps Script Project in the user’s account. |
| 2    | Enable Google Tasks API, Gmail API, and Google Drive API in Advanced Services & Cloud Console. |
| 3    | Add script properties (see §3). |
| 4    | Create **one** time-driven trigger via `ScriptApp.newTrigger()`: `dailyRunner` to run daily at `DAILY_TRIGGER_HOUR`. |
| 5    | Perform a first manual run to authorize OAuth scopes (tasks, spreadsheets, gmail.send, drive.file). |

### 3. Configuration (Script Properties)

| Key | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `AUTO_MOVE_DUE_TASKS` | boolean | `true` | **(New)** If `true`, moves tasks due today from the Inbox to the daily list. |
| `INBOX_LIST_NAME` | string | "Inbox" | Title of the list where tasks are moved. |
| `INBOX_LIST_ID` | string | *(none)* | **(Recommended)** Cached ID of the Inbox list. Auto-populated. |
| `DAILY_LIST_PREFIX` | string | `[Daily]` | Prefix used to identify and manage daily lists. |
| `LOCAL_TIME_ZONE` | string | User TZ | IANA Time Zone (e.g., "America/Los_Angeles"). |
| `DAILY_TRIGGER_HOUR` | int | 0 | 0–23. The hour for the daily run. |
| `LOG_SHEET_ID` | string | required | Spreadsheet ID for logging. |
| `WEEKLY_DIGEST_DAY` | int | 1 | 0=Sun...6=Sat. Day to send the weekly digest. |
| `WEEKLY_DIGEST_HOUR` | int | 9 | The hour for the digest email. |
| `ADD_SUMMARY_TASK` | boolean | `true` | If `true`, adds a task to the new list summarizing the run. |
| `TRACK_ROLLOVER_COUNT` | boolean | `true` | If `true`, updates task notes with a rollover count. |
| `EXECUTION_TIMEOUT_SECONDS` | int | 270 | Max seconds before run is paused (e.g., 4.5 min). |

### 4. Logging Sheet Schema

The script will automatically create a sheet/tab named "Runs" in the spreadsheet specified by `LOG_SHEET_ID` if it doesn't exist, with the following header row:
`Timestamp · InboxAdds · InboxMoves · ListDeleted · ListCreated · CompletedTasks · Notes`

### 5. Core Algorithms & Pseudocode

#### 5.1 dailyRunner()

```javascript
function dailyRunner() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.log('Aborting run: Could not acquire lock.');
    return;
  }

  const startTime = new Date();
  const stats = { /* inboxAdds, inboxMoves, etc. */ };

  try {
    const todayTitle = Utilities.formatDate(startTime, getTz(), 'MMMM d, yyyy');
    
    const { todayListId, inboxId } = rolloverProcess(todayTitle, startTime, stats);

    if (getAutoMoveDueTasks()) {
      processInboxTasks(todayListId, inboxId, stats);
    }

    LoggingSheetUtil.logRun(stats);

    if (today.getDay() == getWeeklyDigestDay()) {
      DigestMailer.sendWeeklyDigest();
    }

  } catch (e) {
    // Global error handler
    LoggingSheetUtil.logRun({notes: `FATAL: ${e.message}`});
    GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Tasks Script Failed', e.message);
  } finally {
    lock.releaseLock();
  }
}
```

#### 5.2 rolloverProcess(todayTitle, startTime, stats)

1.  Verify logging sheet exists.
2.  Resolve Inbox list ID.
3.  Fetch all lists. Partition into `todayList` and `staleLists`.
4.  For each `staleList`:
    a.  Check execution time against `EXECUTION_TIMEOUT_SECONDS`.
    b.  `stats.inboxAdds += migrateIncompleteTasks(staleList.id, inboxId)`.
    c.  Delete the list and increment `stats.listDeleted`.
5.  Ensure `todayList` exists, creating it if not.
6.  Return `{ todayListId, inboxId }`.

#### 5.3 processInboxTasks(todayListId, inboxId, stats)

1.  Fetch all tasks from the `inboxId`.
2.  Get today's date as a formatted string (e.g., '2025-07-10').
3.  For each `task` in the list:
    a.  **If `task.due` is null OR `task.recurrence` is not null, continue.**
    b.  Extract the date part of the `task.due` timestamp.
    c.  **If the task's due date matches today's date string:**
        i.  Move the task to `todayListId`.
        ii. Increment `stats.inboxMoves`.

#### 5.4 migrateIncompleteTasks(sourceListId, destListId)

*No changes to this function's logic.* It continues to move all incomplete tasks and, if enabled, updates the rollover count in the task notes.

### 6. Utility Classes (Sketch)

*   **ListService**: `getListByTitle(name)`, `createList(title)`, `deleteList(id)`, `listAll()`
*   **TaskService**: `listAllTasks(listId)`, `listIncompleteTasks(listId)`, `move(task, sourceListId, destListId)`, `updateNotes(listId, taskId, notes)`
*   **LoggingSheetUtil**: `logRun({stats})`, `setup()`
*   **DigestMailer**: `sendWeeklyDigest()`

### 7. Error Handling & Idempotency

| Scenario | Strategy |
| :--- | :--- |
| **API Quota (429/5xx)** | Retry with exponential back-off (max 3 retries) within service methods. |
| **Partial Crash Mid-Run** | `LockService` prevents concurrent runs. The next day's run will re-process any stale lists that weren't deleted. The `processInboxTasks` is also idempotent. |
| **Script Timeout** | A proactive timer in `rolloverProcess` will pause the run cleanly. The next day's run will resume where it left off. |
| **Logging Failure** | The `setup()` check mitigates most issues. A global try/catch in `dailyRunner` will email the owner. |
| **Missing Inbox List** | The script will throw a fatal error and notify the user. |

### 8. Testing Plan

| Layer | Approach |
| :--- | :--- |
| **Unit** | Use mocks/stubs for Google API services to test individual functions in isolation. **New Test Case:** `processInboxTasks` with various tasks (no due date, past due date, today's due date, recurring). |
| **Integration** | Use a sandbox Google account with sample data. **New Test Case:** Populate the Inbox list with a mix of tasks and run `dailyRunner` to verify only the correct tasks are moved. |
| **Acceptance** | Implement a `DRY_RUN` flag in script properties that skips all write operations but logs the intended actions. |

### 9. Future-Proof Hooks

*   `V2_ENABLE_ANALYTICS = false` feature flag.
*   `LIST_EXCLUSION_REGEX` property for future opt-out of lists.
*   Task notes field will be updated with `sourceListTitle` on moves to preserve history.

### 10. File Layout (Apps Script project)

/Code
  ├─ main.js         // dailyRunner, rolloverProcess, processInboxTasks
  ├─ config.js       // property getters
  ├─ services.js     // ListService, TaskService
  ├─ logging.js      // LoggingSheetUtil
  ├─ digest.js       // DigestMailer
  └─ utils.gs        // helpers, retry logic, locking

### 11. Phased Development & Testing Plan

This plan assumes a collaborative model where an AI Agent performs the primary coding and a Human Developer provides setup, real-world data, and final validation.

#### Phase 1: Core Rollover Engine (MVP)

*   **Goal:** Implement the minimum viable product: find stale lists, move incomplete tasks, delete stale lists, and create the new daily list.
*   **AI Developer Tasks:** Implement `config.js`, core `ListService`/`TaskService` methods, the basic `rolloverProcess`, and `dailyRunner`.
*   **Human Developer Tasks:** Set up a sandbox account with test data. Manually run and verify core logic.

#### Phase 2: Robustness - Logging & Error Handling

*   **Goal:** Make the core engine resilient and transparent.
*   **AI Developer Tasks:** Implement `LoggingSheetUtil` (with `setup()`), integrate logging, and add `LockService` and global try/catch error handling to `dailyRunner`.
*   **Human Developer Tasks:** Provide `LOG_SHEET_ID`. Verify sheet creation/re-creation and error email notifications.

#### Phase 3: Advanced Features & UX

*   **Goal:** Implement the "v2.1" and "v2.4" enhancements.
*   **AI Developer Tasks:** Implement the execution time safeguard, the `ADD_SUMMARY_TASK` logic, the `TRACK_ROLLOVER_COUNT` logic, and the new `processInboxTasks` feature with its `AUTO_MOVE_DUE_TASKS` toggle.
*   **Human Developer Tasks:** Test the timeout safeguard. Verify the summary task, rollover count, and the new inbox processing logic.

#### Phase 4: Weekly Digest

*   **Goal:** Implement the final major feature.
*   **AI Developer Tasks:** Implement the `DigestMailer` module.
*   **Human Developer Tasks:** Set the digest day to today for testing. Run the script and verify the digest email.

#### Phase 5: Acceptance Testing & Deployment

*   **Goal:** Final validation and full deployment.
*   **AI Developer Tasks:** Implement the `DRY_RUN` flag.
*   **Human Developer Tasks:** Set up the script against the live account with `DRY_RUN=true`. Review logs. Once confident, set `DRY_RUN=false` and create the final time-driven trigger.
