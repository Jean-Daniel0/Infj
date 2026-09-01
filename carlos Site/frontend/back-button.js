// Gestion du bouton retour
// Version standalone (sans modules ES6)

function createBackButton() {
    // Ne pas afficher sur la page d'accueil
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
        return
    }
    
    // Créer le bouton retour
    const backButton = document.createElement('a')
    backButton.className = 'back-button'
    backButton.href = 'index.html'
    backButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5"></path>
            <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Retour</span>
    `
    
    // Insérer dans le header s'il existe
    const header = document.querySelector('.page-header')
    if (header) {
        header.appendChild(backButton)
    } else {
        document.body.appendChild(backButton)
    }
    
    // Gestion du clic avec historique du navigateur
    backButton.addEventListener('click', (e) => {
        // Si on peut revenir en arrière dans l'historique, utiliser ça
        if (window.history.length > 1) {
            e.preventDefault()
            window.history.back()
        }
        // Sinon, rediriger vers l'accueil
    })
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', createBackButton)

