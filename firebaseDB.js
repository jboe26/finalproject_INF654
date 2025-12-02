// firebaseDB.js

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
    updateDoc, 
    deleteDoc, 
    getDocs,
    doc,
    query
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';


// ----------------------------------------------------
// 2. YOUR FIREBASE CONFIGURATION
// ----------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDfjxhcISvtwzbnbnrygPQsUutoXFCW_zo", //
    authDomain: "budget-tracker-d9dfc.firebaseapp.com", //
    projectId: "budget-tracker-d9dfc", //
    storageBucket: "budget-tracker-d9dfc.appspot.com", //
    messagingSenderId: "636586422154", //
    appId: "1:636586422154:web:e46f153faf789f69b2a273", //
    measurementId: "G-E82MCR928G" //
};


// 3. Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserId = null;


// ----------------------------------------------------
// 4. AUTHENTICATION FUNCTIONS (Used by auth.js and auth-gate.js)
// ----------------------------------------------------

window.checkAuthStatus = () => {
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
};

window.signInWithEmailPassword = async (email, password) => { 
    await signInWithEmailAndPassword(auth, email, password);
};

window.signUpWithEmailPassword = async (email, password) => { 
    await createUserWithEmailAndPassword(auth, email, password);
};

window.signOutUser = async () => { 
    await signOut(auth);
};


// ----------------------------------------------------
// 5. FIRESTORE CRUD FUNCTIONS (Explicitly attached to window for app.js)
// ----------------------------------------------------

const getTransactionsCollection = () => {
    if (!currentUserId) throw new Error("User not authenticated for DB operation.");
    return collection(db, `users/${currentUserId}/transactions`); 
}

window.addTask = async (taskData) => { 
    const docRef = await addDoc(getTransactionsCollection(), taskData);
    return docRef.id;
};

window.updateTask = async (id, taskData) => { 
    await updateDoc(doc(getTransactionsCollection(), id), taskData);
};

window.deleteTask = async (id) => { 
    await deleteDoc(doc(getTransactionsCollection(), id));
};

window.getTasks = async () => { 
    const q = query(getTransactionsCollection());
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

window.checkAuthStatus();