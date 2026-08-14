// Gestion de l'authentification avec Supabase
import { supabase, auth } from './supabase-config.js'

// Éléments du DOM
const loginForm = document.getElementById('loginForm')
const registerForm = document.getElementById('registerForm')
const passwordInput = document.getElementById('password')
const confirmPasswordInput = document.getElementById('confirmPassword')
const strengthBar = document.querySelector('.strength-bar')
const strengthText = document.querySelector('.strength-text')

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si l'utilisateur est déjà connecté (uniquement sur la page de connexion ou d'inscription)
    if (document.getElementById('loginForm') || document.getElementById('registerForm')) {
        checkAuthState()
    }
    
    // Configuration des gestionnaires d'événements
    setupEventListeners()
    
    // Configuration de la force du mot de passe
    if (passwordInput) {
        setupPasswordStrength()
    }
})

// Configuration des gestionnaires d'événements
function setupEventListeners() {
    // Formulaire de connexion
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin)
    }
    
    // Formulaire d'inscription
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister)
    }
    
    // Validation de la confirmation du mot de passe
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch)
    }
}

// Gestion de la connexion
async function handleLogin(e) {
    e.preventDefault()
    
    const formData = new FormData(loginForm)
    const email = formData.get('email')
    const password = formData.get('password')
    const remember = formData.get('remember')
    
    const submitBtn = loginForm.querySelector('.auth-btn')
    const btnText = submitBtn.querySelector('.btn-text')
    const btnLoading = submitBtn.querySelector('.btn-loading')
    
    try {
        // Désactiver le bouton et afficher le loading
        setButtonLoading(submitBtn, true)
        
        // Connexion avec Supabase
        const { data, error } = await auth.signIn(email, password)
        
        if (error) {
            throw error
        }
        
        if (data.user) {
            // Sauvegarder les informations utilisateur
            localStorage.setItem('user', JSON.stringify(data.user))
            
            // Vérifier si l'utilisateur est admin
            const adminEmails = ['mradmin@infj.com']
            let isAdmin = data.user.user_metadata?.role === 'admin' || (data.user.email && adminEmails.includes(data.user.email.toLowerCase()))
            if (!isAdmin) {
                try {
                    const { data: dbUser } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', data.user.id)
                        .maybeSingle()
                    if (dbUser?.role === 'admin') {
                        isAdmin = true
                    }
                } catch (e) {
                    console.error('Erreur lors de la récupération du rôle:', e)
                }
            }
            
            // Rediriger vers la page demandée ou par défaut ('admin-videos.html' pour admin, 'cours.html' pour user)
            const urlParams = new URLSearchParams(window.location.search)
            const defaultRedirect = isAdmin ? 'admin-videos.html' : 'cours.html'
            const redirectUrl = urlParams.get('redirect') || defaultRedirect
            
            showMessage('Connexion réussie !', 'success')
            setTimeout(() => {
                window.location.href = redirectUrl
            }, 1500)
        }
        
    } catch (error) {
        console.error('Erreur de connexion:', error)
        showMessage(getErrorMessage(error), 'error')
    } finally {
        setButtonLoading(submitBtn, false)
    }
}

// Gestion de l'inscription
async function handleRegister(e) {
    e.preventDefault()
    
    const formData = new FormData(registerForm)
    const userData = {
        prenom: formData.get('prenom'),
        nom: formData.get('nom'),
        email: formData.get('email'),
        telephone: formData.get('telephone'),
        password: formData.get('password'),
        formation: formData.get('formation')
    }
    
    // Validation côté client
    if (!validateRegistration(userData)) {
        return
    }
    
    const submitBtn = registerForm.querySelector('.auth-btn')
    
    try {
        setButtonLoading(submitBtn, true)
        
        // Inscription avec Supabase
        const adminEmails = ['mradmin@infj.com']
        const isUserAdmin = adminEmails.includes(userData.email.trim().toLowerCase())
        const { data, error } = await auth.signUp(userData.email, userData.password, {
            prenom: userData.prenom,
            nom: userData.nom,
            telephone: userData.telephone,
            formation_interet: userData.formation,
            role: isUserAdmin ? 'admin' : 'user'
        })
        
        if (error) {
            throw error
        }
        
        if (data.user) {
            // Sauvegarder les informations utilisateur si connecté ou enregistré
            localStorage.setItem('user', JSON.stringify(data.user))
            
            showMessage('Inscription réussie ! Redirection vers votre tableau de bord...', 'success')
            
            // Rediriger vers votre tableau de bord ('admin-videos.html' pour l'admin, 'cours.html' pour l'utilisateur) après 1.5 seconde
            setTimeout(() => {
                window.location.href = isUserAdmin ? 'admin-videos.html' : 'cours.html'
            }, 1500)
        }
        
    } catch (error) {
        console.error('Erreur d\'inscription:', error)
        showMessage(getErrorMessage(error), 'error')
    } finally {
        setButtonLoading(submitBtn, false)
    }
}

// Validation de l'inscription
function validateRegistration(userData) {
    // Validation des champs obligatoires
    if (!userData.prenom || !userData.nom || !userData.email || !userData.password) {
        showMessage('Veuillez remplir tous les champs obligatoires.', 'error')
        return false
    }
    
    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userData.email)) {
        showMessage('Veuillez entrer une adresse email valide.', 'error')
        return false
    }
    
    // Validation du mot de passe
    if (userData.password.length < 6) {
        showMessage('Le mot de passe doit contenir au moins 6 caractères.', 'error')
        return false
    }
    
    // Validation de la confirmation du mot de passe
    const confirmPassword = document.getElementById('confirmPassword').value
    if (userData.password !== confirmPassword) {
        showMessage('Les mots de passe ne correspondent pas.', 'error')
        return false
    }
    
    // Validation des conditions d'utilisation
    const termsCheckbox = document.getElementById('terms')
    if (!termsCheckbox.checked) {
        showMessage('Veuillez accepter les conditions d\'utilisation.', 'error')
        return false
    }
    
    return true
}

// Configuration de la force du mot de passe
function setupPasswordStrength() {
    passwordInput.addEventListener('input', function() {
        const password = this.value
        const strength = calculatePasswordStrength(password)
        updatePasswordStrength(strength)
    })
}

// Calcul de la force du mot de passe
function calculatePasswordStrength(password) {
    let score = 0
    
    if (password.length >= 6) score++
    if (password.length >= 8) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    
    return score
}

// Mise à jour de l'affichage de la force du mot de passe
function updatePasswordStrength(strength) {
    const percentage = (strength / 6) * 100
    strengthBar.style.width = percentage + '%'
    
    if (strength < 2) {
        strengthBar.style.background = '#dc3545'
        strengthText.textContent = 'Mot de passe faible'
        strengthText.style.color = '#dc3545'
    } else if (strength < 4) {
        strengthBar.style.background = '#ffc107'
        strengthText.textContent = 'Mot de passe moyen'
        strengthText.style.color = '#ffc107'
    } else {
        strengthBar.style.background = '#28a745'
        strengthText.textContent = 'Mot de passe fort'
        strengthText.style.color = '#28a745'
    }
}

// Validation de la correspondance des mots de passe
function validatePasswordMatch() {
    const password = passwordInput.value
    const confirmPassword = this.value
    
    if (confirmPassword && password !== confirmPassword) {
        this.style.borderColor = '#dc3545'
        showMessage('Les mots de passe ne correspondent pas.', 'error')
    } else {
        this.style.borderColor = '#e1e5e9'
        hideMessage()
    }
}

// Vérification de l'état d'authentification
async function checkAuthState() {
    const { user } = await auth.getCurrentUser()
    
    if (user) {
        const adminEmails = ['mradmin@infj.com']
        let isAdmin = user.user_metadata?.role === 'admin' || (user.email && adminEmails.includes(user.email.toLowerCase()))
        if (!isAdmin) {
            try {
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle()
                if (dbUser?.role === 'admin') {
                    isAdmin = true
                }
            } catch (e) {}
        }
        // L'utilisateur est connecté, rediriger vers la page correspondante
        window.location.href = isAdmin ? 'admin-videos.html' : 'cours.html'
    }
}

// Gestion du bouton de chargement
function setButtonLoading(button, loading) {
    const btnText = button.querySelector('.btn-text')
    const btnLoading = button.querySelector('.btn-loading')
    
    if (loading) {
        button.disabled = true
        button.classList.add('loading')
        btnText.style.display = 'none'
        btnLoading.style.display = 'inline'
    } else {
        button.disabled = false
        button.classList.remove('loading')
        btnText.style.display = 'inline'
        btnLoading.style.display = 'none'
    }
}

// Affichage des messages
function showMessage(message, type = 'info') {
    // Supprimer les messages existants
    hideMessage()
    
    // Créer le nouveau message
    const messageEl = document.createElement('div')
    messageEl.className = `auth-message ${type}`
    messageEl.textContent = message
    
    // Insérer le message au début du formulaire
    const form = document.querySelector('.auth-form')
    if (form) {
        form.insertBefore(messageEl, form.firstChild)
    }
    
    // Auto-masquer après 5 secondes
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl)
        }
    }, 5000)
}

// Masquage des messages
function hideMessage() {
    const existingMessage = document.querySelector('.auth-message')
    if (existingMessage) {
        existingMessage.remove()
    }
}

// Gestion des erreurs
function getErrorMessage(error) {
    const errorMessages = {
        'Invalid login credentials': 'Email ou mot de passe incorrect.',
        'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter.',
        'User already registered': 'Un compte existe déjà avec cet email.',
        'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
        'Invalid email': 'Adresse email invalide.'
    }
    
    return errorMessages[error.message] || error.message || 'Une erreur est survenue.'
}

// Gestion de la déconnexion
async function handleLogout() {
    try {
        const { error } = await auth.signOut()
        if (error) {
            throw error
        }
        
        // Supprimer les données locales
        localStorage.removeItem('user')
        
        // Rediriger vers la page d'accueil
        window.location.href = 'index.html'
        
    } catch (error) {
        console.error('Erreur de déconnexion:', error)
        showMessage('Erreur lors de la déconnexion', 'error')
    }
}

// Export des fonctions pour utilisation dans d'autres fichiers
export { handleLogout, showMessage, hideMessage }