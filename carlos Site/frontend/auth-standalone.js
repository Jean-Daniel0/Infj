// Fonctions d'authentification standalone (sans modules ES6)
// Pour fonctionner avec file://

// Fonction de déconnexion simplifiée
function handleLogout() {
    // Supprimer les données de session
    localStorage.removeItem('user')
    sessionStorage.clear()
    
    // Rediriger vers la page de connexion
    window.location.href = 'login.html'
}

// Exposer globalement
window.handleLogout = handleLogout

