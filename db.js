// db.js — IndexedDB for Budget Tracker

const DB_NAME = "BudgetTrackerDB";
const DB_VERSION = 1;
const STORE_NAME = "transactions"; // single source of truth

let localDB;

// Open the database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      localDB = event.target.result;
      window.localDB = localDB; // make sure it's global
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

// Save or update a transaction
window.saveTask = function (transaction) {
  return new Promise((resolve, reject) => {
    console.log("Attempting to save to IndexedDB:", transaction);

    const tx = localDB.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(transaction);

    request.onsuccess = () => {
      console.log("Saved to IndexedDB:", transaction);
      resolve();
    };
    request.onerror = (event) => {
      console.error("IndexedDB save error:", event.target.error);
      reject(event.target.error);
    };
  });
};

// Delete a transaction by ID
window.deleteTaskById = function (id) {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

// Get a single transaction by ID
window.getTaskById = function (id) {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

// Get all unsynced transactions
window.getUnsyncedTasks = function () {
  return new Promise((resolve, reject) => {
    const tx = localDB.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const unsynced = request.result.filter((t) => t.synced === false);
      resolve(unsynced);
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

// Open DB immediately
openDB();
