// app.js - Budget Tracker Logic

const CATEGORY_IDS = [
    "expenses-Groceries", 
    "expenses-Housing", 
    "expenses-Transportation", 
    "expenses-Entertainment", 
    "expenses-Income", 
    "expenses-Other"
];

document.addEventListener("DOMContentLoaded", () => {
    
    // --- Materialize Initialization ---
    const tabs = document.querySelectorAll('.tabs');
    M.Tabs.init(tabs);
    M.updateTextFields();

    // --- Service Worker Registration ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
            .register("service-worker.js")
            .then(() => console.log("Service Worker registered"));
    }

    // --- Element References ---
    const form = document.getElementById("taskForm");
    const descInput = document.getElementById("expenseDescription"); 
    const amountInput = document.getElementById("expenseAmount"); 
    const taskIdInput = document.getElementById("taskId");
    const formActionButton = form.querySelector("button[type='submit']");
    let categorySelect;
  
    // 1. DYNAMICALLY INSERT CATEGORY DROPDOWN
    if (form) {
        const categoryHTML = `
            <div class="input-field">
                <select id="taskCategory" required>
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
        // Insert the category dropdown BEFORE the title input's div
        descInput.parentElement.insertAdjacentHTML('beforebegin', categoryHTML); 
        categorySelect = document.getElementById('taskCategory');
    }
    const selects = document.querySelectorAll('select');
    M.FormSelect.init(selects);
    
    // --- Form Submission Handler ---
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const title = descInput.value.trim();
        const amount = parseFloat(amountInput.value); 
        const id = taskIdInput.value.trim();
        
        // FIX: Added fallback to category value because Materialize initialization is failing 
        const categoryInstance = categorySelect ? M.FormSelect.getInstance(categorySelect) : null;
        const category = categoryInstance ? categoryInstance.el.value : "Other"; // Use "Other" as default if dropdown fails

        // FIX: Removed the '!category' check so the transaction can save
        if (!title || isNaN(amount) || amount <= 0) { 
            M.toast({ html: "Please enter a title and valid amount", classes: "red darken-2" });
            return;
        }

        // Add timestamp for sorting and unique ID generation if offline
        const taskData = { title, amount, category: category, status: "completed", timestamp: Date.now() }; 

        if (id) {
            await handleEdit(id, taskData);
        } else {
            await handleAdd(taskData);
        }

        // Reset form and UI
        form.reset();
        taskIdInput.value = "";
        formActionButton.textContent = "Add Transaction";
        M.updateTextFields();
        
        if (categorySelect) {
            // Re-initialize dropdown after reset
            M.FormSelect.getInstance(categorySelect)?.destroy(); 
            M.FormSelect.init(categorySelect); 
        }
        
        loadTasks(); 
    });
});

// ----------------------------------------------------
// Core CRUD Helpers (Offline/Online logic)
// ----------------------------------------------------

async function handleAdd(taskData) {
    try {
        if (navigator.onLine) {
            const firebaseId = await addTask(taskData);
            saveTask({ ...taskData, id: firebaseId, synced: true });
        } else {
            const tempId = "temp-" + Date.now();
            saveTask({ ...taskData, id: tempId, synced: false });
        }
    } catch (err) {
        console.error("handleAdd error:", err);
        M.toast({ html: "Failed to add transaction", classes: "red darken-2" });
    }
}

async function handleEdit(id, taskData) {
    try {
        if (navigator.onLine) {
            await updateTask(id, taskData);
            saveTask({ ...taskData, id, synced: true });
        } else {
            saveTask({ ...taskData, id, synced: false });
        }
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
        deleteTaskById(id);
    } else {
        if (id.startsWith("temp-")) {
            deleteTaskById(id);
        } else {
            const task = await getTaskById(id);
            if (task) {
                saveTask({ ...task, toDelete: true, synced: false });
            }
        }
    }
    loadTasks();
};


// ----------------------------------------------------
// UI Rendering (loadTasks)
// ----------------------------------------------------

window.loadTasks = async function () {
    const taskContainer = document.getElementById("tasksListContainer");
    if (!taskContainer) return;

    if (!window.localDB) {
        setTimeout(() => window.loadTasks(), 200);
        return;
    }

    // --- Data Fetching and Merging ---
    const localTasks = await new Promise((resolve) => {
        const tx = localDB.transaction("tasks", "readonly");
        const store = tx.objectStore("tasks");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });

    let tasks = [];

    if (navigator.onLine) {
        const firebaseTasks = await getTasks();
        const firebaseMap = new Map(firebaseTasks.map((t) => [t.id, t]));

        localTasks.forEach((t) => {
            if (t.synced === false) firebaseMap.set(t.id, t);
        });

        tasks = Array.from(firebaseMap.values()).filter((t) => !t.toDelete);
    } else {
        tasks = localTasks.filter((t) => !t.toDelete);
    }
    
    // Sort by timestamp (newest first)
    tasks.sort((a, b) => b.timestamp - a.timestamp);


    // --- Financial Summary Calculation ---
    let totalIncome = 0;
    let totalExpenses = 0;

    tasks.forEach(task => {
        const amount = parseFloat(task.amount) || 0; 
        if (task.category === "Income") {
            totalIncome += amount;
        } else {
            totalExpenses += amount;
        }
    });

    const netBalance = totalIncome - totalExpenses;

    // Update the Summary Panel
    document.getElementById('netBalance').textContent = `$${netBalance.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;

    // Set the color based on balance
    const cardPanel = document.getElementById('summaryContainer').querySelector('.card-panel');
    if (netBalance >= 0) {
        cardPanel.classList.remove('red', 'darken-2');
        cardPanel.classList.add('teal', 'lighten-1');
    } else {
        cardPanel.classList.remove('teal', 'lighten-1');
        cardPanel.classList.add('red', 'darken-2');
    }
    
    
    // --- RENDERING INTO CATEGORY TABS ---
    
    // A. Clearing Phase (FIXED logic for DIV containers)
    CATEGORY_IDS.forEach(id => {
        const el = document.getElementById(id); 
        if (el) {
            let ul = el.querySelector('.collection');
            if (ul) ul.remove();
            
            let message = el.querySelector('.initial-message');
            if (!message) {
                el.insertAdjacentHTML('beforeend', '<p class="center-align initial-message">No transactions in this category yet.</p>');
            }
        }
    });


    // D. Injection Phase
    tasks.forEach((task) => {
        const targetId = `expenses-${task.category}`; 
        const targetElement = document.getElementById(targetId);
        
        const isIncome = task.category === 'Income';
        const amountSign = isIncome ? '+' : ''; // Income doesn't need a negative sign
        const colorClass = isIncome ? 'green-text text-darken-3' : 'red-text text-darken-3';

        if (targetElement) {
            // 1. Remove the placeholder message
            const initialMessage = targetElement.querySelector('.initial-message');
            if (initialMessage) {
                initialMessage.remove();
            }

            // 2. Create the Materialize <ul> element if it doesn't exist
            let ul = targetElement.querySelector('.collection');
            if (!ul) {
                ul = document.createElement('ul');
                ul.className = 'collection';
                targetElement.appendChild(ul); 
            }
            
            // 3. Create the list item (li)
            const li = document.createElement("li");
            li.className = `collection-item`; 
            
            const sanitizedTitle = task.title.replace(/'/g, "\\'");
            const sanitizedCategory = (task.category || '').replace(/'/g, "\\'");
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <strong>${task.title}</strong>
                        <span class="grey-text" style="display: block; font-size: 0.8em;">${new Date(task.timestamp).toLocaleDateString()}</span>
                    </div>
                    <span class="${colorClass} flow-text" style="font-weight: 600;">
                        ${amountSign}${(parseFloat(task.amount)).toFixed(2)}
                    </span>
                    <div>
                        <a href="#!" class="secondary-content" onclick="handleDelete('${task.id}')">
                            <i class="material-icons red-text">delete</i>
                        </a>
                        <a href="#!" class="secondary-content" style="margin-right: 30px;" onclick="openEditForm('${task.id}', '${sanitizedTitle}', '${task.amount}', '${sanitizedCategory}')">
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
// Edit Form Setup
// ----------------------------------------------------

window.openEditForm = function (id, title, amount, category) {
    const descInput = document.getElementById("expenseDescription");
    const amountInput = document.getElementById("expenseAmount");
    const taskIdInput = document.getElementById("taskId");
    const formActionButton = document.querySelector("#taskForm button[type='submit']");
    const categorySelect = document.getElementById('taskCategory');

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
// Sync Logic and Event Listener
// ----------------------------------------------------

window.syncTasks = async function () {
  console.log("Attempting to sync tasks...");
  const unsyncedTasks = await getUnsyncedTasks();

  if (unsyncedTasks.length === 0) {
    console.log("No unsynced tasks found.");
    return;
  }

  for (const task of unsyncedTasks) {
    const { id, synced, toDelete, ...taskToSync } = task;

    try {
      if (toDelete) {
        await deleteTask(id);
        deleteTaskById(id);
        console.log(`Synced deletion for task ${id}`);
      } else if (id.startsWith("temp-")) {
        const firebaseId = await addTask(taskToSync);
        deleteTaskById(id);
        saveTask({ ...taskToSync, id: firebaseId, synced: true });
        console.log(`Synced new task. New ID: ${firebaseId}`);
      } else {
        await updateTask(id, taskToSync);
        saveTask({ ...task, synced: true });
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