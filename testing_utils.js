/**
 * @fileoverview Contains utility functions for testing the script.
 * These functions are not part of the main application logic but are used
 * during development to create test data and scenarios.
 * @see /README.md for instructions on how to use these functions.
 */

/**
 * Creates a "stale" list for yesterday and populates it with a mix of
 * complete and incomplete dummy tasks. This is the primary function for
 * setting up a standard test case for the daily rollover process.
 */
function createYesterdayListWithDummyData() {
  console.log('Starting dummy list creation for yesterday.');
  const dailyListPrefix = getDailyListPrefix();
  const tz = getLocalTimeZone();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTitle = Utilities.formatDate(yesterday, tz, 'MMMM d, yyyy');
  const listTitle = `${dailyListPrefix} ${yesterdayTitle}`;

  // Check if the list already exists to avoid duplicates.
  const existingList = ListService.getListByTitle(listTitle);
  if (existingList) {
    console.warn(`Test list "${listTitle}" already exists. Aborting creation.`);
    return;
  }

  // Create the new list for yesterday.
  console.log(`Creating test list: "${listTitle}"`);
  const newList = ListService.createList(listTitle);
  if (!newList) {
    console.error('Failed to create new list. The ListService may have failed.');
    return;
  }
  const listId = newList.id;

  // Define dummy tasks based on the testing plan scenarios in the design doc.
  const dummyTasks = [
    { title: 'Incomplete Task 1 (Simple)' },
    { title: 'Incomplete Task 2 (With Notes)', notes: 'This task has some notes.' },
    { title: 'Completed Task', status: 'completed' }, // This task should be ignored by the rollover.
    { title: 'Task with existing rollover', notes: 'This task has been rolled over before.\n\nRollover Count: 3' },
    { title: 'Another incomplete task' },
  ];

  // Add the dummy tasks to the new list.
  dummyTasks.forEach(taskData => {
    const task = Tasks.newTask();
    task.title = taskData.title;
    if (taskData.notes) {
      task.notes = taskData.notes;
    }
    if (taskData.status) {
      task.status = taskData.status;
    }
    Tasks.Tasks.insert(task, listId);
  });

  console.log(`${dummyTasks.length} dummy tasks created in "${listTitle}". Setup complete.`);
}