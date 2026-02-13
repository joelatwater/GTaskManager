# Task Manager Concept Document
The purpose of this code is manage daily to do lists in Google Tasks. It should run in Google App Script.

# User Persona
The user is a professional, working on personal and side projects, by themselves. They manage their todo list in Google Tasks, using several lists.

# Concept
- A script runs at midnight (or setable time). The script:
    - Inspects the previous day's list and logs the items completed and not completed.
    - Moves uncompleted items to the inbox list
    - Creates a new task list titled with the date for the user to populate.
        - The script should check if a list with this title already exists.
    - At the beginning of the day, the user populates the new list with their tasks for the day.