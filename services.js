/**
 * @fileoverview Service wrappers for the Google Tasks API.
 * This file encapsulates all direct API calls into logical modules (ListService, TaskService)
 * to abstract away the API's complexity and provide a clean interface for the main script logic.
 * @see /@documentation/design.md
 */

/**
 * A service for interacting with Google Task Lists.
 */
const ListService = {
  /**
   * Retrieves all task lists from the user's account.
   * @returns {Array<GoogleAppsScript.Tasks.Schema.TaskList>} An array of TaskList objects. Returns an empty array on failure.
   */
  listAll() {
    return Tasks.Tasklists.list().items || [];
  },

  /**
   * Finds a task list by its exact title.
   * @param {string} title The title of the list to find.
   * @returns {GoogleAppsScript.Tasks.Schema.TaskList|null} The found list object, or null if not found.
   */
  getListByTitle(title) {
    const lists = this.listAll();
    return lists.find(list => list.title === title) || null;
  },

  /**
   * Creates a new task list.
   * @param {string} title The title for the new list.
   * @returns {GoogleAppsScript.Tasks.Schema.TaskList} The created list object.
   */
  createList(title) {
    const taskListResource = {
      title: title
    };
    return Tasks.Tasklists.insert(taskListResource);
  },

  /**
   * Deletes a task list by its ID.
   * @param {string} listId The ID of the list to delete.
   */
  deleteList(listId) {
    Tasks.Tasklists.remove(listId);
  },
};

/**
 * A service for interacting with individual Google Tasks.
 */
const TaskService = {
  /**
   * Retrieves all top-level, incomplete tasks from a specific list.
   * @param {string} listId The ID of the list.
   * @returns {Array<GoogleAppsScript.Tasks.Schema.Task>} An array of incomplete Task objects.
   */
  listIncompleteTasks(listId) {
    const allTasks = Tasks.Tasks.list(listId).items || [];
    return allTasks.filter(task => task.status === 'needsAction');
  },

  /**
   * Updates the notes for a specific task. Required for rollover tracking.
   * @param {string} listId The ID of the list containing the task.
   * @param {string} taskId The ID of the task to update.
   * @param {string} newNotes The new content for the task's notes.
   * @returns {GoogleAppsScript.Tasks.Schema.Task} The updated task object.
   */
  updateNotes(listId, taskId, newNotes) {
    const taskResource = { notes: newNotes };
    return Tasks.Tasks.patch(taskResource, listId, taskId);
  },

  /**
   * Moves a task to a different list.
   * If the task was created from an email in Gmail, it appends a link to the original email in the notes.
   * @param {GoogleAppsScript.Tasks.Schema.Task} task The full task object to move.
   * @param {string} sourceListId The ID of the task's current list.
   * @param {string} destListId The ID of the target list.
   */
  move(task, sourceListId, destListId) {
    const newTask = Tasks.newTask();

    let newTitle = task.title;
    let newNotes = task.notes || ""; // Ensure notes is a string

    // If task was created from an email, preserve the link in the notes.
    if (task.links && task.links.some(link => link.type === 'email')) {
      const emailLink = task.links.find(link => link.type === 'email').link;
      if (emailLink && !newNotes.includes(emailLink)) {
        newTitle += ' [from email]';
        newNotes += `\n\n---\nOriginal Email: ${emailLink}`;
      }
    }

    newTask.title = newTitle;
    newTask.notes = newNotes;
    
    if (task.due) {
      newTask.due = task.due;
    }
    
    Tasks.Tasks.insert(newTask, destListId);
    Tasks.Tasks.remove(sourceListId, task.id);
  },
};