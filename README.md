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

## Notes

- If you delete a task hold from your calendar, it may be recreated on the next sync. Delete the task from Todoist instead.
- The script uses the Todoist task ID to track which tasks have been synced, preventing duplicates
- Tasks are scheduled by deadline priority using the Earliest Deadline First (EDF) algorithm
- Far-deadline tasks are intelligently spread across the 2-week window to preserve near-term capacity

## License

MIT

