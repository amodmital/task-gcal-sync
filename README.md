# Todoist → Google Calendar Sync

A Google Apps Script that intelligently schedules your Todoist tasks into available "Work Block" time slots on your Google Calendar.

## Overview

This script bridges your Todoist task list with Google Calendar by:

- Fetching active tasks with deadlines from your Todoist account via the Todoist API
- Creating 30-minute calendar holds within existing "Work Block" time slots
- Intelligently avoiding conflicts with other accepted/busy calendar events
- Scheduling tasks as soon as possible (ASAP) starting from the current time

## Features

- **Smart Work Block Scheduling**: Only creates task holds within existing "Work Block" calendar events
- **Conflict Avoidance**: Checks for conflicts with accepted and busy calendar events before scheduling
- **ASAP Scheduling**: Schedules tasks starting from the earliest available time (never in the past)
- **Multiple Tasks Per Block**: Work blocks can accommodate multiple 30-minute task slots
- **Task Filtering**: Only syncs active Todoist tasks that have due dates
- **Duplicate Prevention**: Skips tasks that have already been synced to your calendar
- **Clear Naming Convention**: All synced tasks are prefixed with "Task:" for easy identification

## How It Works

1. **Work Block Detection**: The script scans your calendar for events titled "Work Block" within the next 7 days
2. **Task Filtering**: Only active Todoist tasks with due dates are considered for scheduling
3. **Sequential Scheduling**: Tasks are scheduled in order, filling the earliest available slots first
4. **30-Minute Slots**: Each task is allocated exactly 30 minutes
5. **Conflict Detection**: Before placing a task, the script checks for:
   - Other tasks already scheduled in that time slot
   - Accepted calendar events (GuestStatus.YES)
   - Events you own (GuestStatus.OWNER)
6. **Slot Advancement**: If a conflict is found, the script moves to the next 30-minute slot within the same work block
7. **Block Advancement**: If a task doesn't fit in the current work block, the script moves to the next available work block

## Setup

1. Create a new Google Apps Script project at [script.google.com](https://script.google.com)
2. Copy the contents of `script.js` into the editor
3. Set up your Todoist API token:
   - Go to File → Project Properties → Script Properties
   - Add a new property with key: `TODOIST_API_KEY`
   - Value: Your Todoist API token (get it from Todoist Settings → Integrations → Developer)
4. Create "Work Block" events on your primary Google Calendar for times when you want tasks to be scheduled
5. Set up a time-based trigger for automatic syncing:
   - Go to Triggers (clock icon in left sidebar)
   - Add a new trigger for the `syncTodoistToWorkBlocks` function
   - Recommended: Run hourly or every few hours

## Prerequisites

- **Work Blocks**: You must create calendar events titled exactly "Work Block" on your Google Calendar. These define the time windows where task holds can be scheduled.
- **Todoist Tasks**: Tasks must be active and have a due date to be considered for scheduling.

## Configuration

Required Script Properties:

- **TODOIST_API_KEY**: Your Todoist API token from Todoist Settings → Integrations → Developer

The script will:
- Use your primary Google Calendar
- Look ahead 7 days for available work blocks
- Create 30-minute task holds prefixed with "Task:"

## Example Workflow

1. **Create Work Blocks**: Add calendar events titled "Work Block" to your Google Calendar
   - Example: "Work Block" from 9:00 AM - 12:00 PM (3 hours)
   
2. **Add Todoist Tasks**: Create tasks in Todoist with due dates
   - Example: "Review PR #123", "Write documentation", "Bug fix"

3. **Run the Script**: The script will automatically:
   - Find the 9:00 AM - 12:00 PM work block
   - Schedule "Task: Review PR #123" from 9:00-9:30 AM
   - Schedule "Task: Write documentation" from 9:30-10:00 AM
   - Schedule "Task: Bug fix" from 10:00-10:30 AM
   - Skip any time slots where you have accepted meetings

4. **Result**: Your calendar now shows blocked time for each task, making it clear to others (and yourself) when you're working on specific tasks

## Notes

- If you delete a task hold from your calendar, it may be recreated on the next sync. Delete the task from Todoist instead.
- The script uses the Todoist task ID to track which tasks have been synced, preventing duplicates
- Tasks are scheduled in the order they're returned from the Todoist API

## License

MIT

