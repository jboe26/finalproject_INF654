// auth.js
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const logoutButton = document.getElementById("logoutButton");

    // Login Form Submission Handler
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;

            try {
                await signInWithEmailPassword(email, password);
                M.toast({ html: 'Logged in successfully!', classes: 'green darken-2' });
                window.location.href = "index.html"; 
            } catch (error) {
                M.toast({ html: `Login failed: ${error.message}`, classes: 'red darken-2' });
                console.error("Login error:", error);
            }
        });
    }

    // Sign-up Form Submission Handler
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = signupForm.email.value;
            const password = signupForm.password.value;

            try {
                await signUpWithEmailPassword(email, password);
                M.toast({ html: 'Account created and logged in!', classes: 'green darken-2' });
                window.location.href = "index.html";
            } catch (error) {
                M.toast({ html: `Sign-up failed: ${error.message}`, classes: 'red darken-2' });
                console.error("Sign-up error:", error);
            }
        });
    }

    // Logout Button Handler (on index.html)
    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await signOutUser();
                M.toast({ html: 'Logged out!', classes: 'blue darken-1' });
                window.location.href = "auth.html";
            } catch (error) {
                M.toast({ html: 'Logout failed.', classes: 'red darken-2' });
                console.error("Logout error:", error);
            }
        });
    }
});