# Todoist → Google Calendar Sync

A Google Apps Script that intelligently schedules your Todoist tasks into available "Work Block" time slots on your Google Calendar.

## Overview

This script bridges your Todoist task list with Google Calendar by:

- Fetching active tasks with deadlines from your Todoist account via the Todoist API
- Creating calendar holds within existing "Work Block" time slots (15, 30, or 60 minutes based on task labels)
- Intelligently avoiding conflicts with other accepted/busy calendar events
- Using smart scheduling that considers deadlines, block sizes, and task duration

## Features

- **Smart Work Block Scheduling**: Only creates task holds within existing "Work Block" calendar events
- **Label-Based Durations**: Tasks are sized based on labels: `s`=15min, `m`=30min, `l`=60min (default: 15min)
- **Intelligent Scheduling**: Uses Earliest Deadline First (EDF) algorithm with optimization scoring
- **Deadline-Aware Spreading**: Tasks with far-out deadlines are distributed across the schedule
- **Block Size Matching**: Longer tasks are prioritized for larger work blocks to prevent fragmentation
- **Conflict Avoidance**: Checks for conflicts with accepted and busy calendar events before scheduling
- **Multiple Tasks Per Block**: Work blocks can accommodate multiple task slots
- **Task Filtering**: Only syncs active Todoist tasks that have due dates
- **Duplicate Prevention**: Skips tasks that have already been synced to your calendar
- **Clear Naming Convention**: All synced tasks are prefixed with "Task:" for easy identification

## How It Works

1. **Work Block Detection**: The script scans your calendar for events titled "Work Block" within the next 14 days (2 weeks)
2. **Task Filtering**: Only active Todoist tasks with due dates are considered for scheduling
3. **Priority Sorting**: Tasks are sorted by deadline (Earliest Deadline First)
4. **Slot Generation**: Creates 15-minute time slots across all available work blocks
5. **Smart Scoring**: Each potential slot is scored based on:
   - ASAP preference (earlier is better)
   - Deadline proximity (avoid too-close or after-deadline slots)
   - Block size matching (long tasks prefer large blocks)
   - Deadline distance (far deadlines get spread out)
6. **Conflict Detection**: Before placing a task, the script checks for:
   - Other tasks already scheduled in that time slot
   - Accepted calendar events (GuestStatus.YES)
   - Events you own (GuestStatus.OWNER)
7. **Best Slot Selection**: Picks the highest-scoring slot for each task
8. **Dynamic Updates**: Removes used slots from the pool after scheduling each task

## Project Files

- **`script.js`**: Main sync script that schedules Todoist tasks into Work Blocks
- **`cleanup.js`**: Utility script to delete all synced tasks from your calendar

## Setup

1. Create a new Google Apps Script project at [script.google.com](https://script.google.com)
2. Copy the contents of `script.js` into the default `Code.gs` file
3. (Optional) Create an additional file for `cleanup.js` if you want the cleanup utility
4. Set up your Todoist API token:
   - Go to Project Settings (gear icon) → Script Properties
   - Add a new property with key: `TODOIST_API_KEY`
   - Value: Your Todoist API token (get it from Todoist Settings → Integrations → Developer)
5. Create "Work Block" events on your primary Google Calendar for times when you want tasks to be scheduled
6. Set up a time-based trigger for automatic syncing:
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
- Look ahead 14 days (2 weeks) for available work blocks
- Create task holds with duration based on labels: `s`=15min, `m`=30min, `l`=60min
- All task holds are prefixed with "Task:"

## Example Workflow

1. **Create Work Blocks**: Add calendar events titled "Work Block" to your Google Calendar
   - Example: "Work Block" from 9:00 AM - 12:00 PM (3 hours)
   
2. **Add Todoist Tasks**: Create tasks in Todoist with due dates and labels
   - Example: "Review PR #123" (label: `s`), "Write documentation" (label: `m`), "Bug fix" (label: `s`)

3. **Run the Script**: The script will automatically:
   - Find the 9:00 AM - 12:00 PM work block
   - Sort tasks by deadline priority
   - Schedule "Task: Review PR #123" from 9:00-9:15 AM (15 min)
   - Schedule "Task: Write documentation" from 9:15-9:45 AM (30 min)
   - Schedule "Task: Bug fix" from 9:45-10:00 AM (15 min)
   - Skip any time slots where you have accepted meetings

4. **Result**: Your calendar now shows blocked time for each task, making it clear to others (and yourself) when you're working on specific tasks

## Task Duration Labels

Use these labels in Todoist to control task duration:
- **`s`** (small): 15 minutes
- **`m`** (medium): 30 minutes  
- **`l`** (large): 60 minutes
- **No label**: Defaults to 15 minutes

## Cleanup Script

The `cleanup.js` script provides a way to bulk-delete all synced tasks from your calendar.

### When to Use

- You want to clear all synced tasks and start fresh
- You're testing the sync script and need to reset your calendar
- You've made changes to task labels/durations and want to reschedule everything

### How to Use

1. In your Google Apps Script project, create a new file called `cleanup.js`
2. Copy the contents of `cleanup.js` from this repository
3. Run the `deleteSyncedTasks()` function manually from the script editor
4. The script will:
   - Scan your calendar for the next 2 weeks
   - Identify events with "Todoist ID:" in their description
   - Delete all matching events
   - Provide a summary of deleted events

### Important Notes

- **This action cannot be undone** - deleted calendar events go to your calendar's trash
- Only events created by the sync script (with Todoist ID in description) will be deleted
- Your "Work Block" events will NOT be affected
- Other calendar events will NOT be affected
- After cleanup, run the main sync script to reschedule tasks

## Notes

- If you delete a task hold from your calendar, it may be recreated on the next sync. Delete the task from Todoist instead, or use the cleanup script to bulk-delete all synced tasks.
- The script uses the Todoist task ID to track which tasks have been synced, preventing duplicates
- Tasks are scheduled by deadline priority using the Earliest Deadline First (EDF) algorithm
- Far-deadline tasks are intelligently spread across the 2-week window to preserve near-term capacity
- To reset your schedule completely, run `cleanup.js` followed by `script.js`

## License

MIT

