# GTaskManager: Automated Daily Google Tasks Manager

GTaskManager is a Google Apps Script that automates your daily task management workflow. It automatically rolls over incomplete tasks from previous days into a designated "Inbox" list, creates a fresh task list for the current day, and sends you a weekly email digest summarizing your progress.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Key Features

- **Automated Daily Rollover:** Moves all unfinished tasks from dated lists to your Inbox.
- **Daily List Creation:** Automatically creates a new list for the current day (e.g., `[Daily] July 08, 2025`).
- **Weekly Email Digest:** Sends a summary of completed and "procrastinated" tasks.
- **Rollover Tracking:** Tracks how many times a task has been rolled over, adding a "Rollover Count" to the task's notes.
- **Timeout Protection:** Intelligently pauses execution on large backlogs to prevent Google Apps Script timeouts.
- **Sheet-Based Logging:** Keeps a detailed log of every run in a Google Sheet for easy monitoring.

## Installation

There are two ways to install this script: using the automated setup function (recommended) or from the command line using `clasp`.

### Option 1: Automated Setup (Recommended)

This is the easiest way to get started.

1.  **Create the Script Project:**
    *   Go to [script.google.com](https://script.google.com) and click **New project**. Give it a name like "GTaskManager".

2.  **Copy the Code:**
    *   Delete the default `Code.gs` file.
    *   Create new script files for each `.js` file in this repository (`main.js`, `config.js`, `services.js`, `logging.js`, `digest.js`, and `testing_utils.js`).
    *   Copy the contents of each file from this repository into the corresponding file in your Apps Script project.

3.  **Enable Google Tasks API:**
    *   In the Apps Script Editor sidebar, click **Services +**.
    *   Select **Google Tasks API** from the list and click **Add**.

4.  **Run the Setup Function:**
    *   In the editor, select the `setup` function from the function list at the top.
    *   Click **Run**.
    *   This will create a new Google Sheet for logging, create the daily trigger, and ask for the necessary permissions.

5.  **Authorize and Complete:**
    *   A popup window will appear asking you to "Review permissions." Follow the prompts to grant access.
    *   Check the execution log for the URL of your new logging sheet.

That's it! The script is now fully configured and will run automatically every day.

### Option 2: Command-Line Installation (using clasp)

This option is for developers familiar with the command line.

1.  **Install `clasp`:**
    *   `npm install -g @google/clasp`

2.  **Clone the Repository:**
    *   `git clone https://github.com/joelatwater/GTaskManager.git`
    *   `cd GTaskManager`

3.  **Login and Create Project:**
    *   `clasp login`
    *   `clasp create --type standalone --title "GTaskManager"`

4.  **Push and Open:**
    *   `clasp push -f`
    *   `clasp open`

5.  **Complete Setup in Editor:**
    *   In the Apps Script editor, follow the instructions for the **Automated Setup** (Option 1) starting from Step 3.

## Configuration (Optional)

The `setup` function handles all required configuration. However, you can optionally add the following keys to the **Script Properties** (under **Project Settings** ⚙️) to customize the script's behavior.

| Key | Default Value | Description |
| :--- | :--- | :--- |
| `INBOX_LIST_NAME` | `Inbox` | The **exact name** of the task list where unfinished items are moved. |
| `DAILY_LIST_PREFIX` | `[Daily]` | The prefix used to identify and manage daily lists. |
| `LOCAL_TIME_ZONE` | Your Account TZ | Your IANA Time Zone (e.g., "America/New_York") to ensure dates are correct. |
| `DAILY_TRIGGER_HOUR` | `2` | The hour (0-23) the script should run. Default is 2 AM. |
| `WEEKLY_DIGEST_DAY` | `1` | The day to send the weekly digest email (0=Sun, 1=Mon...6=Sat). |
| `WEEKLY_DIGEST_HOUR`| `9` | The hour (0-23) to send the digest email. |
| `TRACK_ROLLOVER_COUNT`| `true` | Set to `false` to disable counting rollovers in task notes. |
| `EXECUTION_TIMEOUT_SECONDS`| `270` | Max seconds a run can last before pausing. Default is 4.5 minutes. |

## For Developers

### Project Structure
- `main.js`: Main entry point (`dailyRunner`) and core orchestration logic.
- `services.js`: Wrappers for the Google Tasks API (`ListService`, `TaskService`).
- `config.js`: Getter functions to retrieve script properties.
- `logging.js`: Handles all interaction with the logging Google Sheet.
- `digest.js`: Composes and sends the weekly digest email.
- `testing_utils.js`: Helper functions to create dummy data for testing.

### Testing
To test the rollover logic, you can manually run the `createYesterdayListWithDummyData` function from the `testing_utils.js` file. This will create a stale list with a mix of complete and incomplete tasks, ready for the `dailyRunner` to process.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
