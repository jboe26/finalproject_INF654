// app.js — Budget Tracker Logic (ES module)

import { auth, addTask, updateTask, deleteTask, getTasks } from "./firebaseDB.js";

const CATEGORY_IDS = [
  "expenses-Groceries",
  "expenses-Housing",
  "expenses-Transportation",
  "expenses-Entertainment",
  "expenses-Income",
  "expenses-Other"
];

// Wait until IndexedDB is ready before wiring up the UI
function waitForDBReady(callback) {
  if (window.localDB) {
    callback();
  } else {
    setTimeout(() => waitForDBReady(callback), 100);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  M.Tabs.init(document.querySelectorAll(".tabs"));
  M.updateTextFields();

  const userEmailSpan = document.getElementById("userEmail");

  auth.onAuthStateChanged((user) => {
    if (user && userEmailSpan) {
      userEmailSpan.textContent = `Logged in as ${user.email}`;
    }
  });


  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("Service Worker registered"));
  }

  waitForDBReady(() => {
    const form = document.getElementById("taskForm");
    const descInput = document.getElementById("expenseDescription");
    const amountInput = document.getElementById("expenseAmount");
    const taskIdInput = document.getElementById("taskId");
    const formActionButton = form.querySelector("button[type='submit']");

    // Inject category select
    let categorySelect;
    if (form) {
      const categoryHTML = `
        <div class="input-field">
          <select id="taskCategory" name="taskCategory" required>
            <option value="" disabled selected>Choose Category</option>
            <option value="Groceries">Groceries</option>
            <option value="Housing">Housing</option>
            <option value="Transportation">Transportation</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Income">Income</option>
            <option value="Other">Other</option>
          </select>
          <label>Category</label>
        </div>
      `;
      descInput.parentElement.insertAdjacentHTML("beforebegin", categoryHTML);
      categorySelect = document.getElementById("taskCategory");
    }

    M.FormSelect.init(document.querySelectorAll("select"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = descInput.value.trim();
      const amount = parseFloat(amountInput.value);
      const id = taskIdInput.value.trim();
      const category = categorySelect?.value || "Other";

      console.log("Form submitted with:", { title, amount, category });

      if (!title || isNaN(amount) || amount <= 0) {
        M.toast({ html: "Please enter a title and valid amount", classes: "red darken-2" });
        return;
      }

      const taskData = {
        title,
        amount,
        category,
        status: "completed",
        timestamp: Date.now()
      };

      if (id) {
        await handleEdit(id, taskData);
      } else {
        await handleAdd(taskData);
      }

      form.reset();
      taskIdInput.value = "";
      formActionButton.textContent = "Add Transaction";
      M.updateTextFields();

      if (categorySelect) {
        M.FormSelect.getInstance(categorySelect)?.destroy();
        M.FormSelect.init(categorySelect);
      }

      `loadTasks()`;
    });
  });
});

// ----------------------------------------------------
// Core CRUD helpers (Offline/Online logic)
// ----------------------------------------------------

async function handleAdd(taskData) {
  try {
    if (navigator.onLine) {
      const firebaseId = await addTask(taskData);
      await saveTask({ ...taskData, id: firebaseId, synced: true });
    } else {
      const tempId = "temp-" + Date.now();
      await saveTask({ ...taskData, id: tempId, synced: false });
    }

    M.toast({ html: "Transaction saved!", classes: "red lighten-2" });
    setTimeout(() => loadTasks(), 100);
  } catch (err) {
    console.error("handleAdd error:", err);
    M.toast({ html: "Failed to add transaction", classes: "red darken-2" });
  }
}

async function handleEdit(id, taskData) {
  try {
    if (navigator.onLine) {
      await updateTask(id, taskData);
      await saveTask({ ...taskData, id, synced: true });
    } else {
      await saveTask({ ...taskData, id, synced: false });
    }
    M.toast({ html: "Transaction updated!", classes: "red lighten-2" });
    setTimeout(() => loadTasks(), 100);
  } catch (err) {
    console.error("handleEdit error:", err);
    M.toast({ html: "Failed to edit transaction", classes: "red darken-2" });
  }
}

window.handleDelete = async function (id) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;

  if (navigator.onLine) {
    try {
      await deleteTask(id);
    } catch (error) {
      console.error("Error deleting from Firebase:", error);
    }
    await deleteTaskById(id);
  } else {
    if (id.startsWith("temp-")) {
      await deleteTaskById(id);
    } else {
      const task = await getTaskById(id);
      if (task) {
        await saveTask({ ...task, toDelete: true, synced: false });
      }
    }
  }
  loadTasks();
};

// ----------------------------------------------------
// UI rendering (loadTasks)
// ----------------------------------------------------

window.loadTasks = async function () {
  const taskContainer = document.getElementById("tasksListContainer");
  if (!taskContainer) return;

  if (!window.localDB) {
    setTimeout(() => window.loadTasks(), 200);
    return;
  }

  // --- Data fetching and merging ---
  const localTasks = await new Promise((resolve, reject) => {
    const tx = localDB.transaction("transactions", "readonly");
    const store = tx.objectStore("transactions");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });

  let tasks = [];

  if (navigator.onLine) {
    const firebaseTasks = await getTasks();
    const firebaseMap = new Map(firebaseTasks.map((t) => [t.id, t]));

    // Prefer local unsynced over Firebase
    localTasks.forEach((t) => {
      if (t.synced === false) firebaseMap.set(t.id, t);
    });

    tasks = Array.from(firebaseMap.values()).filter((t) => !t.toDelete);
  } else {
    tasks = localTasks.filter((t) => !t.toDelete);
  }

  // Sort by timestamp (newest first)
  tasks.sort((a, b) => b.timestamp - a.timestamp);

  // --- Financial summary calculation ---
  let totalIncome = 0;
  let totalExpenses = 0;

  tasks.forEach((task) => {
    const amt = parseFloat(task.amount) || 0;
    if (task.category === "Income") totalIncome += amt;
    else totalExpenses += amt;
  });

  const netBalance = totalIncome - totalExpenses;

  // Update the summary panel
  document.getElementById("netBalance").textContent = `$${netBalance.toFixed(2)}`;
  document.getElementById("totalExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
  document.getElementById("totalIncome").textContent = `$${totalIncome.toFixed(2)}`;

  // Set the color based on balance
  const cardPanel = document.getElementById("summaryContainer");
  if (netBalance >= 0) {
    cardPanel.classList.remove("red", "darken-2");
    cardPanel.classList.add("black", "lighten-1");
  } else {
    cardPanel.classList.remove("black", "lighten-1");
    cardPanel.classList.add("red", "darken-2");
  }

  // --- Rendering into category tabs ---
  // Clearing phase
  CATEGORY_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      let ul = el.querySelector(".collection");
      if (ul) ul.remove();

      let message = el.querySelector(".initial-message");
      if (!message) {
        el.insertAdjacentHTML(
          "beforeend",
          '<p class="center-align initial-message">No transactions in this category yet.</p>'
        );
      }
    }
  });

  // Injection phase
  tasks.forEach((task) => {
    const targetId = `expenses-${task.category}`;
    const targetElement = document.getElementById(targetId);

    const isIncome = task.category === "Income";
    const amountSign = isIncome ? "+" : "";
    const colorClass = isIncome ? "green-text text-darken-3" : "red-text text-darken-3";

    if (targetElement) {
      const initialMessage = targetElement.querySelector(".initial-message");
      if (initialMessage) initialMessage.remove();

      let ul = targetElement.querySelector(".collection");
      if (!ul) {
        ul = document.createElement("ul");
        ul.className = "collection";
        targetElement.appendChild(ul);
      }

      const li = document.createElement("li");
      li.className = "collection-item";

      const sanitizedTitle = (task.title || "").replace(/'/g, "\\'");
      const sanitizedCategory = (task.category || "").replace(/'/g, "\\'");

      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <strong>${task.title}</strong>
            <span class="grey-text" style="display: block; font-size: 0.8em;">
              ${new Date(task.timestamp).toLocaleDateString()}
            </span>
          </div>
          <span class="${colorClass} flow-text" style="font-weight: 600;">
            ${amountSign}${(parseFloat(task.amount)).toFixed(2)}
          </span>
          <div>
            <a href="#!" class="secondary-content" onclick="handleDelete('${task.id}')">
              <i class="material-icons red-text">delete</i>
            </a>
            <a href="#!" class="secondary-content" style="margin-right: 30px;"
               onclick="openEditForm('${task.id}', '${sanitizedTitle}', '${task.amount}', '${sanitizedCategory}')">
              <i class="material-icons blue-text">edit</i>
            </a>
          </div>
        </div>
      `;
      ul.appendChild(li);
    }
  });
};

// ----------------------------------------------------
// Edit form setup
// ----------------------------------------------------

window.openEditForm = function (id, title, amount, category) {
  const descInput = document.getElementById("expenseDescription");
  const amountInput = document.getElementById("expenseAmount");
  const taskIdInput = document.getElementById("taskId");
  const formActionButton = document.querySelector("#taskForm button[type='submit']");
  const categorySelect = document.getElementById("taskCategory");

  descInput.value = title;
  amountInput.value = amount;
  taskIdInput.value = id;

  if (categorySelect && category) {
    categorySelect.value = category;
    M.FormSelect.getInstance(categorySelect)?.destroy();
    M.FormSelect.init(categorySelect);
  }

  formActionButton.textContent = "Edit Transaction";
  M.updateTextFields();
  document.getElementById("taskForm").scrollIntoView({ behavior: "smooth" });
};

// ----------------------------------------------------
// Sync logic and event listener
// ----------------------------------------------------

window.syncTasks = async function () {
  console.log("Attempting to sync tasks...");
  const unsyncedTasks = await getUnsyncedTasks(); // IndexedDB global (db.js)

  if (unsyncedTasks.length === 0) {
    console.log("No unsynced tasks found.");
    return;
  }

  for (const task of unsyncedTasks) {
    const { id, synced, toDelete, ...taskToSync } = task;

    try {
      if (toDelete) {
        await deleteTask(id);
        await deleteTaskById(id);
        console.log(`Synced deletion for task ${id}`);
      } else if (id.startsWith("temp-")) {
        const firebaseId = await addTask(taskToSync);
        await deleteTaskById(id);
        await saveTask({ ...taskToSync, id: firebaseId, synced: true });
        console.log(`Synced new task. New ID: ${firebaseId}`);
      } else {
        await updateTask(id, taskToSync);
        await saveTask({ ...task, synced: true });
        console.log(`Synced update for task ${id}`);
      }
    } catch (error) {
      console.error(`Failed to sync task ${id}`, error);
      M.toast({ html: `Sync failed for task ${id}`, classes: "orange darken-2" });
    }
  }

  loadTasks();
};

window.addEventListener("online", () => {
  console.log("Back online — syncing transactions...");
  syncTasks();
});
