function syncTodoistToWorkBlocks() {
    const props = PropertiesService.getScriptProperties();
    const TODOIST_TOKEN = props.getProperty('TODOIST_API_KEY');
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    // Round 'now' up to the nearest 15 minutes to avoid messy start times
    const cleanNow = new Date(Math.ceil(now.getTime() / 900000) * 900000); 
    const endWindow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // Look ahead 2 weeks
  
    // Duration mapping based on task labels (simplified to 3 tiers)
    const durationMap = {
      's': 15,
      'm': 30,
      'l': 60
    };
  
    // Helper function to get task duration in minutes
    function getTaskDuration(task) {
      if (!task.labels || task.labels.length === 0) {
        return 15; // Default to 's' if no labels
      }
      // Check if any label matches our duration labels
      for (let label of task.labels) {
        if (durationMap[label]) {
          return durationMap[label];
        }
      }
      return 15; // Default to 's' if no matching label found
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
        
        // Generate 15-minute slots within this block
        let slotStart = new Date(blockStart.getTime());
        while (slotStart < blockEnd) {
          slots.push({
            start: new Date(slotStart.getTime()),
            blockId: block.getId(),
            blockEnd: blockEnd
          });
          slotStart = new Date(slotStart.getTime() + (15 * 60000)); // 15 min increments
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
    
    // Helper function to calculate remaining continuous space in a block starting from a slot
    function getRemainingBlockSpace(slot, blockEnd) {
      const slotStart = slot.start;
      let continuousEnd = new Date(slotStart.getTime());
      
      // Find the next conflict or block end
      let checkTime = new Date(slotStart.getTime());
      while (checkTime < blockEnd) {
        const nextCheckTime = new Date(checkTime.getTime() + (15 * 60000));
        const eventsInRange = calendar.getEvents(checkTime, nextCheckTime);
        const hasConflict = eventsInRange.some(event => {
          if (event.getId() === slot.blockId) return false;
          const status = event.getMyStatus();
          return (status === CalendarApp.GuestStatus.YES || status === CalendarApp.GuestStatus.OWNER);
        });
        
        if (hasConflict) {
          break;
        }
        continuousEnd = nextCheckTime;
        checkTime = nextCheckTime;
      }
      
      // Return minutes of continuous space available
      return Math.min((blockEnd - slotStart) / 60000, (continuousEnd - slotStart) / 60000);
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
      
      // Score each slot based on multiple factors
      const scoredSlots = validSlots.map(slot => {
        const slotStart = slot.start;
        const daysUntilDeadline = (deadline - slotStart) / (1000 * 60 * 60 * 24);
        const daysFromNow = (slotStart - cleanNow) / (1000 * 60 * 60 * 24);
        const remainingSpace = getRemainingBlockSpace(slot, slot.blockEnd);
        
        // Scoring heuristic with multiple factors:
        let score = 0;
        
        // HARD CONSTRAINTS: Heavy penalties
        if (slotStart > deadline) {
          score = -1000; // Heavy penalty for being after deadline
        } else if (daysUntilDeadline < 0.5) {
          score = -500; // Penalty for being too close to deadline (less than 12 hours)
        } else {
          // BASE SCORE: ASAP preference (but modulated by deadline distance)
          if (daysUntilDeadline > 7) {
            // Far deadline: reduce ASAP urgency, encourage spreading
            // Penalize slots that are too early for far-deadline tasks
            score = 100 - daysFromNow * 5; // Weaker ASAP preference
            
            // Encourage using middle-to-later slots for far-deadline tasks
            const normalizedPosition = daysFromNow / 7; // Position in the week (0=now, 1=week out)
            const targetPosition = Math.min(daysUntilDeadline / 14, 0.7); // Target spreading
            const positionPenalty = Math.abs(normalizedPosition - targetPosition) * 30;
            score -= positionPenalty;
          } else if (daysUntilDeadline > 3) {
            // Medium deadline: moderate ASAP preference
            score = 100 - daysFromNow * 7;
          } else {
            // Near deadline: strong ASAP preference
            score = 100 - daysFromNow * 15;
          }
          
          // BONUS: Deadline buffer
          if (daysUntilDeadline > 1) {
            score += 20;
          }
          
          // BONUS: Longer tasks prefer larger continuous spaces
          // This prevents fragmenting large blocks with small tasks
          const taskDurationHours = taskDurationMins / 60;
          const remainingSpaceHours = remainingSpace / 60;
          
          if (taskDurationHours >= 1) {
            // For longer tasks (≥1 hour), bonus for being in larger blocks
            const spaceUtilization = taskDurationMins / remainingSpace;
            if (spaceUtilization > 0.3 && spaceUtilization < 0.8) {
              // Good fit: using 30-80% of available space
              score += 30 + (taskDurationHours * 10);
            } else if (remainingSpaceHours >= taskDurationHours * 1.5) {
              // Large block: bonus for long tasks
              score += 20 + (taskDurationHours * 5);
            }
          } else {
            // For shorter tasks, slight penalty for very large blocks
            // (save them for longer tasks)
            if (remainingSpaceHours > 2) {
              score -= 10;
            }
          }
        }
        
        return { slot, score };
      });
      
      // Sort by score (highest first) and pick the best slot
      scoredSlots.sort((a, b) => b.score - a.score);
      const bestSlot = scoredSlots[0].slot;
      const bestScore = scoredSlots[0].score;
      
      // Schedule the task
      const taskStart = bestSlot.start;
      const taskEnd = new Date(taskStart.getTime() + (taskDurationMins * 60000));
      
      calendar.createEvent(`Task: ${task.content}`, taskStart, taskEnd, {
        description: "Todoist ID: " + task.id
      });
      
      const daysUntilSlot = (taskStart - cleanNow) / (1000 * 60 * 60 * 24);
      const daysUntilDeadline = (deadline - cleanNow) / (1000 * 60 * 60 * 24);
      console.log(`✅ Scheduled "${task.content}" (${taskDurationMins}min) at ${taskStart.toLocaleString()} (score: ${bestScore.toFixed(1)}, ${daysUntilSlot.toFixed(1)}d from now, ${daysUntilDeadline.toFixed(1)}d until due)`);
      
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