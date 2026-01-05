function syncTodoistToWorkBlocks() {
    const props = PropertiesService.getScriptProperties();
    const TODOIST_TOKEN = props.getProperty('TODOIST_API_KEY');
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    // Round 'now' up to the nearest 5 minutes to avoid messy start times
    const cleanNow = new Date(Math.ceil(now.getTime() / 300000) * 300000); 
    const endWindow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  
    // Duration mapping based on task labels
    const durationMap = {
      'xs': 10,
      's': 20,
      'm': 30,
      'l': 60,
      'xl': 120
    };
  
    // Helper function to get task duration in minutes
    function getTaskDuration(task) {
      if (!task.labels || task.labels.length === 0) {
        return 10; // Default to 'xs' if no labels
      }
      // Check if any label matches our duration labels
      for (let label of task.labels) {
        if (durationMap[label]) {
          return durationMap[label];
        }
      }
      return 10; // Default to 'xs' if no matching label found
    } 
  
    // 1. Fetch active tasks
    const response = UrlFetchApp.fetch("https://api.todoist.com/rest/v2/tasks", {
      headers: { "Authorization": "Bearer " + TODOIST_TOKEN }
    });
    const tasks = JSON.parse(response.getContentText());
  
    // 2. Get Work Blocks & Sort them by time to ensure we fill earliest slots first
    const allEvents = calendar.getEvents(now, endWindow);
    const workBlocks = allEvents.filter(e => e.getTitle() === "Work Block")
                                .sort((a, b) => a.getStartTime() - b.getStartTime());
  
    if (workBlocks.length === 0) {
      console.log("❌ No Work Blocks found.");
      return;
    }
    
    console.log(`📅 Found ${workBlocks.length} Work Block(s) and ${tasks.length} task(s) to process`);
  
    // 3. Process each task independently
    tasks.forEach(task => {
      // Filter: Must have due date
      if (!task.due) {
        console.log(`⏭️ Skipping "${task.content}" - no due date`);
        return;
      }
  
      // Check if already synced
      const alreadySynced = calendar.getEvents(now, endWindow, {search: task.id});
      if (alreadySynced.length > 0) {
        // Task already exists, check if name needs updating
        const existingEvent = alreadySynced[0];
        const expectedTitle = `Task: ${task.content}`;
        if (existingEvent.getTitle() !== expectedTitle) {
          existingEvent.setTitle(expectedTitle);
          console.log(`📝 Updated task name: "${task.content}"`);
        }
        return;
      }
  
      console.log(`🔍 Looking for slot for "${task.content}"...`);
      let taskScheduled = false;
      
      // Reset cursor for each task to check all blocks from the beginning
      let blockIndex = 0;
      let currentBlock = workBlocks[0];
      let cursorTime = currentBlock.getStartTime() < cleanNow ? cleanNow : currentBlock.getStartTime();
  
      // Keep trying to find a slot for this task until we run out of blocks
      while (!taskScheduled && blockIndex < workBlocks.length) {
        
        let blockEnd = currentBlock.getEndTime();
        let taskDurationMins = getTaskDuration(task);
        let taskEndTime = new Date(cursorTime.getTime() + (taskDurationMins * 60000));
  
        // CASE A: The task duration extends OUTSIDE the current block
        // Move to the next block
        if (taskEndTime > blockEnd) {
          blockIndex++;
          if (blockIndex < workBlocks.length) {
            currentBlock = workBlocks[blockIndex];
            // Reset cursor to start of new block (or Now, if block started in past)
            let bStart = currentBlock.getStartTime();
            cursorTime = bStart < cleanNow ? cleanNow : bStart;
            console.log(`   Moving to next work block starting at ${cursorTime.toLocaleString()}`);
          }
          continue; // Retry logic with new block
        }
  
        // CASE B: Check for conflicts in this time slot
        let eventsInSlot = calendar.getEvents(cursorTime, taskEndTime);
        let realConflicts = eventsInSlot.filter(event => {
          if (event.getId() === currentBlock.getId()) return false; // Ignore container block
          let status = event.getMyStatus();
          return (status === CalendarApp.GuestStatus.YES || status === CalendarApp.GuestStatus.OWNER); 
        });
  
        if (realConflicts.length === 0) {
          // SUCCESS: Slot is free
          calendar.createEvent(`Task: ${task.content}`, cursorTime, taskEndTime, {
            description: "Todoist ID: " + task.id
          });
          console.log(`✅ Scheduled "${task.content}" (${taskDurationMins}min) at ${cursorTime.toLocaleString()}`);
          taskScheduled = true;
        } else {
          // FAIL: Slot is busy. Skip ahead by 5 minutes and try again
          console.log(`   Conflict at ${cursorTime.toLocaleString()}. Trying next slot...`);
          cursorTime = new Date(cursorTime.getTime() + (5 * 60000)); // Advance by 5 minutes
        }
      }
      
      if (!taskScheduled) {
        console.log(`❌ Could not schedule "${task.content}" (${getTaskDuration(task)}min) - no available slots found`);
      }
    });
  }