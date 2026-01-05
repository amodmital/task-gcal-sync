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
  
    // 3. Filter and prepare tasks for scheduling
    const tasksToSchedule = tasks.filter(task => {
      if (!task.due) {
        console.log(`⏭️ Skipping "${task.content}" - no due date`);
        return false;
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
        return false;
      }
      return true;
    });
    
    // Sort tasks by deadline (earliest deadline first - EDF algorithm)
    tasksToSchedule.sort((a, b) => {
      const dateA = new Date(a.due.date);
      const dateB = new Date(b.due.date);
      return dateA - dateB;
    });
    
    console.log(`📋 ${tasksToSchedule.length} task(s) need scheduling (sorted by deadline)`);
    
    // 4. Find all available slots across all work blocks
    function findAvailableSlots() {
      const slots = [];
      
      workBlocks.forEach(block => {
        let blockStart = block.getStartTime();
        let blockEnd = block.getEndTime();
        
        // Adjust block start if it's in the past
        if (blockStart < cleanNow) {
          blockStart = cleanNow;
        }
        
        // Skip if entire block is in the past
        if (blockEnd <= cleanNow) {
          return;
        }
        
        // Generate 5-minute slots within this block
        let slotStart = new Date(blockStart.getTime());
        while (slotStart < blockEnd) {
          slots.push({
            start: new Date(slotStart.getTime()),
            blockId: block.getId(),
            blockEnd: blockEnd
          });
          slotStart = new Date(slotStart.getTime() + (5 * 60000)); // 5 min increments
        }
      });
      
      return slots;
    }
    
    const availableSlots = findAvailableSlots();
    console.log(`🎯 Found ${availableSlots.length} potential time slots`);
    
    // 5. Helper function to check if a slot can accommodate a task
    function canScheduleInSlot(slot, taskDurationMins, blockEnd) {
      const taskStart = slot.start;
      const taskEnd = new Date(taskStart.getTime() + (taskDurationMins * 60000));
      
      // Check if task fits within the block
      if (taskEnd > blockEnd) {
        return false;
      }
      
      // Check for conflicts
      const eventsInSlot = calendar.getEvents(taskStart, taskEnd);
      const conflicts = eventsInSlot.filter(event => {
        if (event.getId() === slot.blockId) return false; // Ignore the work block itself
        const status = event.getMyStatus();
        return (status === CalendarApp.GuestStatus.YES || status === CalendarApp.GuestStatus.OWNER);
      });
      
      return conflicts.length === 0;
    }
    
    // 6. Schedule tasks using intelligent placement
    tasksToSchedule.forEach(task => {
      const taskDurationMins = getTaskDuration(task);
      const deadline = new Date(task.due.date);
      
      console.log(`🔍 Scheduling "${task.content}" (${taskDurationMins}min, due: ${deadline.toLocaleDateString()})...`);
      
      // Find all valid slots for this task
      const validSlots = availableSlots.filter(slot => 
        canScheduleInSlot(slot, taskDurationMins, slot.blockEnd)
      );
      
      if (validSlots.length === 0) {
        console.log(`❌ Could not schedule "${task.content}" - no available slots found`);
        return;
      }
      
      // Score each slot based on proximity to deadline and earliness
      const scoredSlots = validSlots.map(slot => {
        const slotStart = slot.start;
        const daysUntilDeadline = (deadline - slotStart) / (1000 * 60 * 60 * 24);
        const daysFromNow = (slotStart - cleanNow) / (1000 * 60 * 60 * 24);
        
        // Scoring heuristic:
        // - Prefer slots that are ASAP (negative penalty for being far in future)
        // - But not too close to deadline (leave buffer)
        // - Penalize slots after deadline heavily
        let score = 0;
        
        if (slotStart > deadline) {
          score = -1000; // Heavy penalty for being after deadline
        } else if (daysUntilDeadline < 0.5) {
          score = -500; // Penalty for being too close to deadline (less than 12 hours)
        } else {
          // Prefer earlier slots (ASAP) but with diminishing returns
          score = 100 - daysFromNow * 10;
          // Bonus for having reasonable buffer before deadline
          if (daysUntilDeadline > 1) {
            score += 20;
          }
        }
        
        return { slot, score };
      });
      
      // Sort by score (highest first) and pick the best slot
      scoredSlots.sort((a, b) => b.score - a.score);
      const bestSlot = scoredSlots[0].slot;
      
      // Schedule the task
      const taskStart = bestSlot.start;
      const taskEnd = new Date(taskStart.getTime() + (taskDurationMins * 60000));
      
      calendar.createEvent(`Task: ${task.content}`, taskStart, taskEnd, {
        description: "Todoist ID: " + task.id
      });
      
      console.log(`✅ Scheduled "${task.content}" (${taskDurationMins}min) at ${taskStart.toLocaleString()}`);
      
      // Remove used slots from available slots to prevent double-booking
      const taskStartTime = taskStart.getTime();
      const taskEndTime = taskEnd.getTime();
      for (let i = availableSlots.length - 1; i >= 0; i--) {
        const slotTime = availableSlots[i].start.getTime();
        if (slotTime >= taskStartTime && slotTime < taskEndTime) {
          availableSlots.splice(i, 1);
        }
      }
    });
  }