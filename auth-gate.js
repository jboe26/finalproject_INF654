// auth-gate.js
document.addEventListener("DOMContentLoaded", () => {
    // checkAuthStatus must be defined in firebaseDB.js
    if (typeof checkAuthStatus === 'function') {
        checkAuthStatus();
    } else {
        console.warn("checkAuthStatus function not found. FirebaseDB might be missing or slow to load.");
        // Basic fallback: redirect if no user is found in local storage (though less reliable)
        // Note: For a real app, rely on Firebase listener.
    }
});