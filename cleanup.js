function deleteSyncedTasks() {
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const endWindow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // Look ahead 2 weeks
    
    console.log(`🧹 Starting cleanup of synced tasks from ${now.toLocaleString()} to ${endWindow.toLocaleString()}`);
    
    // Get all events in the time window
    const allEvents = calendar.getEvents(now, endWindow);
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    // Filter and delete events that have a Todoist ID
    allEvents.forEach(event => {
        const description = event.getDescription();
        
        // Check if the event was created by the sync script (has Todoist ID)
        if (description && description.includes("Todoist ID:")) {
            const eventTitle = event.getTitle();
            const eventStart = event.getStartTime();
            
            try {
                event.deleteEvent();
                deletedCount++;
                console.log(`🗑️ Deleted: "${eventTitle}" at ${eventStart.toLocaleString()}`);
            } catch (e) {
                console.log(`❌ Failed to delete: "${eventTitle}" at ${eventStart.toLocaleString()} - ${e.message}`);
                skippedCount++;
            }
        }
    });
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} event(s)`);
    console.log(`   Skipped: ${skippedCount} event(s)`);
    console.log(`   Total events checked: ${allEvents.length}`);
}

