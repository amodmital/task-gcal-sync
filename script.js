function syncTodoistToWorkBlocks() {
    const props = PropertiesService.getScriptProperties();
    const TODOIST_TOKEN = props.getProperty('TODOIST_API_KEY');
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    // Round 'now' up to the nearest 5 minutes to avoid messy start times
    const cleanNow = new Date(Math.ceil(now.getTime() / 300000) * 300000); 
    const endWindow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); 
  
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
      console.log("No Work Blocks found.");
      return;
    }
  
    // 3. Initialize the "Cursor"
    // We start looking at the first block.
    let blockIndex = 0;
    let currentBlock = workBlocks[0];
    
    // Determine valid start time for the first block (can't be in the past)
    let cursorTime = currentBlock.getStartTime() < cleanNow ? cleanNow : currentBlock.getStartTime();
  
    tasks.forEach(task => {
      // Filter: Must have due date
      if (!task.due) return;
  
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
  
      let taskScheduled = false;
  
      // Keep trying to find a slot for this task until we run out of blocks
      while (!taskScheduled && blockIndex < workBlocks.length) {
        
        let blockEnd = currentBlock.getEndTime();
        let taskEndTime = new Date(cursorTime.getTime() + (30 * 60000)); // 30 min duration
  
        // CASE A: The current cursor + 30mins is OUTSIDE the current block
        // Move to the next block
        if (taskEndTime > blockEnd) {
          blockIndex++;
          if (blockIndex < workBlocks.length) {
            currentBlock = workBlocks[blockIndex];
            // Reset cursor to start of new block (or Now, if block started in past)
            let bStart = currentBlock.getStartTime();
            cursorTime = bStart < cleanNow ? cleanNow : bStart;
          }
          continue; // Retry logic with new block
        }
  
        // CASE B: Check for conflicts in this specific 30-min slot
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
          console.log(`✅ Scheduled "${task.content}" at ${cursorTime.toLocaleTimeString()}`);
          
          // Move cursor forward for the NEXT task
          cursorTime = taskEndTime; 
          taskScheduled = true;
        } else {
          // FAIL: Slot is busy. Skip this specific 30-min slot.
          // Move cursor forward by 30 mins and try again (same task, same block)
          console.log(`Conflict at ${cursorTime.toLocaleTimeString()}. Skipping slot.`);
          cursorTime = taskEndTime; 
        }
      }
    });
  }