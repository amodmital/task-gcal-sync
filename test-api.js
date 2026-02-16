/**
 * Test script to verify Todoist API v1 response format
 * Run this in Google Apps Script to check label handling before migrating
 */

function testTodoistAPIv1() {
  const props = PropertiesService.getScriptProperties();
  const TODOIST_TOKEN = props.getProperty('TODOIST_API_KEY');

  if (!TODOIST_TOKEN) {
    console.log("❌ TODOIST_API_KEY not found in script properties");
    return;
  }

  console.log("🔍 Testing new Todoist API v1 endpoint...\n");

  try {
    // Test the new API v1 endpoint
    const response = UrlFetchApp.fetch("https://api.todoist.com/api/v1/tasks", {
      headers: { "Authorization": "Bearer " + TODOIST_TOKEN }
    });

    const responseText = response.getContentText();
    const data = JSON.parse(responseText);

    console.log(`✅ API v1 is accessible!\n`);
    console.log(`📦 Response type: ${typeof data}`);
    console.log(`📦 Response structure: ${JSON.stringify(data, null, 2).substring(0, 500)}...\n`);

    // Handle different response formats
    let tasks;
    if (Array.isArray(data)) {
      tasks = data;
    } else if (data.results) {
      tasks = data.results;
    } else if (data.items) {
      tasks = data.items;
    } else if (data.tasks) {
      tasks = data.tasks;
    } else {
      console.log("❌ Unexpected response format. Full response:");
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`Found ${tasks.length} task(s)\n`);

    if (tasks.length === 0) {
      console.log("⚠️ No tasks found. Add some tasks in Todoist to test label handling.\n");
      return;
    }

    // Examine the first few tasks to understand the format
    console.log("📋 Sample task structure:\n");

    const sampleCount = Math.min(3, tasks.length);
    for (let i = 0; i < sampleCount; i++) {
      const task = tasks[i];
      console.log(`Task ${i + 1}: "${task.content}"`);
      console.log(`  - ID: ${task.id}`);
      console.log(`  - Due: ${task.due ? JSON.stringify(task.due) : 'None'}`);

      // Check label format
      if (task.labels) {
        console.log(`  - labels property: ${JSON.stringify(task.labels)}`);
        console.log(`  - labels type: array of ${typeof task.labels[0]}`);
      } else if (task.label_ids) {
        console.log(`  - label_ids property: ${JSON.stringify(task.label_ids)}`);
        console.log(`  - label_ids type: array of ${typeof task.label_ids[0]}`);
      } else {
        console.log(`  - labels: None`);
      }

      console.log("");
    }

    // Check if labels are strings (old format) or IDs (new format)
    const taskWithLabels = tasks.find(t => (t.labels && t.labels.length > 0) || (t.label_ids && t.label_ids.length > 0));

    if (taskWithLabels) {
      if (taskWithLabels.labels && typeof taskWithLabels.labels[0] === 'string') {
        console.log("✅ Labels are returned as strings (e.g., 's', 'm', 'l') - no code changes needed!\n");
      } else if (taskWithLabels.label_ids) {
        console.log("⚠️ Labels are returned as label_ids (integer IDs) - code needs updating!\n");
        console.log("You'll need to:");
        console.log("1. Fetch labels separately using GET /api/v1/labels");
        console.log("2. Map label IDs to label names");
        console.log("3. Update the getTaskDuration() function to handle this\n");
      }
    } else {
      console.log("⚠️ No tasks with labels found. Add labels 's', 'm', or 'l' to some tasks to test.\n");
    }

    // Test old endpoint to confirm it's deprecated
    console.log("🔍 Testing old REST API v2 endpoint...\n");
    try {
      const oldResponse = UrlFetchApp.fetch("https://api.todoist.com/rest/v2/tasks", {
        headers: { "Authorization": "Bearer " + TODOIST_TOKEN }
      });
      console.log("⚠️ Old API v2 still works (might be deprecated soon)\n");
    } catch (e) {
      console.log(`❌ Old API v2 failed: ${e.message}`);
      console.log("✅ Confirms migration to v1 is necessary\n");
    }

  } catch (e) {
    console.log(`❌ Error testing API v1: ${e.message}`);
    console.log(`Full error: ${e}`);
  }
}
