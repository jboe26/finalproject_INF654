// db.js
const DB_NAME = "BudgetTrackerDB"; // Changed DB name
const DB_VERSION = 1;
const STORE_NAME = "tasks"; // Store name remains simple "tasks"

let localDB;

// Function to open the database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      localDB = event.target.result;
      console.log("IndexedDB opened successfully");
      if (window.loadTasks) {
          window.loadTasks(); 
      }
      resolve(localDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

// Save or update a task
window.saveTask = function (task) {
  return new Promise((resolve, reject) => {
    const transaction = localDB.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(task);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

// Delete a task by ID
window.deleteTaskById = function (id) {
  return new Promise((resolve, reject) => {
    const transaction = localDB.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

// Get a single task by ID
window.getTaskById = function (id) {
    return new Promise((resolve, reject) => {
        const transaction = localDB.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

// Get all tasks that need syncing (synced: false)
window.getUnsyncedTasks = function () {
    return new Promise((resolve, reject) => {
        const transaction = localDB.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const unsynced = request.result.filter(task => task.synced === false);
            resolve(unsynced);
        };
        request.onerror = (event) => reject(event.target.error);
    });
};

// Open the database when the script loads
openDB();