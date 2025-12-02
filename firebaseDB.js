// ----------------------------------------------------
// 1. FIREBASE MODULAR IMPORTS
// ----------------------------------------------------
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

// ----------------------------------------------------
// 2. CONFIG + INIT
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDfjxhcISvtwzbnbnrygPQsUutoXFCW_zo",
  authDomain: "budget-tracker-d9dfc.firebaseapp.com",
  projectId: "budget-tracker-d9dfc",
  storageBucket: "budget-tracker-d9dfc.appspot.com",
  messagingSenderId: "636586422154",
  appId: "1:636586422154:web:e46f153faf789f69b2a273",
  measurementId: "G-E82MCR928G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;

// ----------------------------------------------------
// 3. AUTH STATUS + AUTH HELPERS
// ----------------------------------------------------
function checkAuthStatus() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;

      if (window.location.pathname.endsWith('auth.html')) {
        window.location.href = 'index.html';
      }

      if (window.loadTasks) {
        window.loadTasks();
      }
    } else {
      currentUserId = null;
      if (!window.location.pathname.endsWith('auth.html')) {
        window.location.href = 'auth.html';
      }
    }
  });
}

async function signInWithEmailPassword(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

async function signUpWithEmailPassword(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create a user profile doc with their email
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    createdAt: Date.now()
  });

  return user;
}

async function signOutUser() {
  await signOut(auth);
}

// expose for non-module scripts
window.checkAuthStatus = checkAuthStatus;
window.signInWithEmailPassword = signInWithEmailPassword;
window.signUpWithEmailPassword = signUpWithEmailPassword;
window.signOutUser = signOutUser;

// ----------------------------------------------------
// 4. FIRESTORE CRUD (transactions)
// ----------------------------------------------------
const getTransactionsCollection = () => {
  if (!currentUserId) throw new Error("User not authenticated for DB operation.");
  return collection(db, `users/${currentUserId}/transactions`);
};

async function addTask(taskData) {
  const docRef = await addDoc(getTransactionsCollection(), taskData);
  return docRef.id;
}

async function updateTask(id, taskData) {
  await updateDoc(doc(getTransactionsCollection(), id), taskData);
}

async function deleteTask(id) {
  await deleteDoc(doc(getTransactionsCollection(), id));
}

async function getTasks() {
  const q = query(getTransactionsCollection());
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// expose for non-module scripts (optional)
window.addTask = addTask;
window.updateTask = updateTask;
window.deleteTask = deleteTask;
window.getTasks = getTasks;

// kick off auth listener
checkAuthStatus();

// ----------------------------------------------------
// 5. EXPORTS FOR MODULE CONSUMERS (app.js)
// ----------------------------------------------------
export {
  auth,
  db,
  addTask,
  updateTask,
  deleteTask,
  getTasks,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signOutUser,
  checkAuthStatus
};
