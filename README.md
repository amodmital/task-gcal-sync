# Todoist → Google Calendar Sync

A Google Apps Script that automatically creates calendar holds on your Google Calendar based on your Todoist tasks.

## Overview

This script bridges your Todoist task list with Google Calendar by:

- Fetching tasks from your Todoist account via the Todoist API
- Creating corresponding calendar events as "holds" or blocked time slots
- Keeping your calendar in sync with your task deadlines and due dates

## Features

- **Automatic Sync**: Pulls tasks from Todoist and creates calendar events
- **Calendar Holds**: Creates time blocks so others know when you're working on tasks
- **Due Date Mapping**: Converts Todoist due dates into calendar events

## Setup

1. Create a new Google Apps Script project at [script.google.com](https://script.google.com)
2. Copy the contents of `script.js` into the editor
3. Add your Todoist API token (Settings → Integrations → Developer)
4. Configure your target Google Calendar ID
5. Set up a time-based trigger for automatic syncing

## Configuration

You'll need:

- **Todoist API Token**: Get this from Todoist Settings → Integrations → Developer
- **Google Calendar ID**: The calendar where events will be created (use `primary` for your main calendar)

## License

MIT

