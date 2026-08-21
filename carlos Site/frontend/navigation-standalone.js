// Gestion de la navigation - Drawer mobile et menu latéral PC (Version standalone dynamique avec Supabase)
import { supabase } from './supabase-config.js'

// Fonction pour créer le menu de navigation
async function createNavigation(currentPage = '') {
    // Si on est dans un iframe (ex: rendu d'un certificat, etc.), on n'injecte pas de navigation et on ne redirige pas
    if (window.self !== window.top) {
        return
    }

    let currentUser = null
    let isAdmin = false

    try {
        if (supabase) {
            const { data: { user } } = await supabase.auth.getUser()
            currentUser = user
            
            if (currentUser) {
                // Vérifier si l'utilisateur est admin
                const adminEmails = ['mradmin@infj.com']
                if (currentUser.user_metadata?.role === 'admin' || (currentUser.email && adminEmails.includes(currentUser.email.toLowerCase()))) {
                    isAdmin = true
                } else {
                    const { data } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', currentUser.id)
                        .maybeSingle()
                    if (data?.role === 'admin') {
                        isAdmin = true
                    }
                }
            }
        }
    } catch (e) {
        console.error('Erreur lors de la récupération de la session Supabase:', e)
    }

    // Fallback locale si hors ligne ou erreur Supabase
    if (!currentUser) {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser)
                const adminEmails = ['mradmin@infj.com']
                if (currentUser?.user_metadata?.role === 'admin' || currentUser?.role === 'admin' || (currentUser?.email && adminEmails.includes(currentUser.email.toLowerCase()))) {
                    isAdmin = true
                }
            } catch (e) {}
        }
    }

    // Contrôle d'accès strict pour l'admin (ne peut pas suivre de cours / accéder aux autres pages)
    if (currentUser && isAdmin) {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        
        // Liste des pages autorisées pour l'admin : index, admin-videos, ou dossier admin/
        const isIndex = page === 'index.html' || path === '/' || path.endsWith('/');
        const isAdminVideo = page === 'admin-videos.html';
        const isUnderAdminFolder = path.includes('/admin/');
        
        if (!isIndex && !isAdminVideo && !isUnderAdminFolder) {
            console.log(`Accès refusé pour l'admin vers la page : ${page}. Redirection vers Admin Vidéos.`);
            window.location.href = '/admin-videos.html';
            return;
        }
    }

    // Construction dynamique des boutons, en chemins absolus pour supporter les sous-dossiers
    const menuItems = []

    if (currentUser) {
        if (isAdmin) {
            menuItems.push({ href: '/index.html', text: 'Accueil', icon: '🏠' })
            menuItems.push({ href: '/admin-videos.html', text: 'Admin Vidéos', icon: '⚙️' })
            menuItems.push({ href: '#', text: 'Déconnexion', icon: '🚪', id: 'logoutBtn' })
        } else {
            menuItems.push({ href: '/index.html', text: 'Accueil', icon: '🏠' })
            menuItems.push({ href: '/formation.html', text: 'Formation', icon: '📚' })
            menuItems.push({ href: '/contact.html', text: 'Contact', icon: '📞' })
            menuItems.push({ href: '/cours.html', text: 'Mes Cours', icon: '🎓' })
            menuItems.push({ href: '#', text: 'Déconnexion', icon: '🚪', id: 'logoutBtn' })
        }
    } else {
        menuItems.push({ href: '/index.html', text: 'Accueil', icon: '🏠' })
        menuItems.push({ href: '/formation.html', text: 'Formation', icon: '📚' })
        menuItems.push({ href: '/contact.html', text: 'Contact', icon: '📞' })
        menuItems.push({ href: '/login.html', text: 'Connexion', icon: '🔑' })
        menuItems.push({ href: '/register.html', text: 'S\'inscrire', icon: '📝' })
    }
    
    // Créer la barre de titre globale (Header)
    const header = document.createElement('header')
    header.className = 'page-header'
    header.innerHTML = `
        <div class="page-header-content">
            <img src="/images/logo.png" alt="Logo INFJ" class="page-header-logo">
            <h1>INSTITUT NATIONAL DE FORMATION DES JEUNES</h1>
        </div>
    `

    // Créer le menu latéral (Desktop)
    const sidebar = document.createElement('aside')
    sidebar.className = 'sidebar-menu'
    sidebar.innerHTML = `
        <div class="sidebar-header" style="padding: 15px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.15);">
            <span style="font-size: 0.8rem; font-weight: 700; color: #f47c20; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block;">Navigation</span>
        </div>
        <nav class="sidebar-nav">
            <ul>
                ${menuItems.map(item => {
                    const itemPage = item.href.split('?')[0].split('/').pop();
                    const isActive = currentPage === itemPage;
                    return `
                        <li>
                            <a href="${item.href}" ${item.id ? `id="${item.id}"` : ''} ${item.style || ''} 
                               ${isActive ? 'class="active"' : ''}>
                                <span style="margin-right: 10px; font-size: 1.2em;">${item.icon}</span>
                                ${item.text}
                            </a>
                        </li>
                    `;
                }).join('')}
            </ul>
        </nav>
    `
    
    // Créer le bouton hamburger (Mobile)
    const menuToggle = document.createElement('button')
    menuToggle.className = 'menu-toggle'
    menuToggle.setAttribute('aria-label', 'Ouvrir le menu')
    menuToggle.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `
    
    // Créer le drawer menu (Mobile)
    const drawer = document.createElement('aside')
    drawer.className = 'drawer-menu'
    drawer.innerHTML = `
        <div class="drawer-header" style="padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.15); flex-direction: row; text-align: left;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #f47c20; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">Menu</span>
            <button class="close-btn" aria-label="Fermer le menu" style="position: static; transform: none; width: 30px; height: 30px; line-height: 1; font-size: 24px; padding: 0;">×</button>
        </div>
        <nav class="drawer-nav">
            <ul>
                ${menuItems.map(item => {
                    const itemPage = item.href.split('?')[0].split('/').pop();
                    const isActive = currentPage === itemPage;
                    return `
                        <li>
                            <a href="${item.href}" ${item.id ? `id="${item.id}"` : ''} ${item.style || ''}
                               ${isActive ? 'class="active"' : ''}>
                                <span style="margin-right: 10px; font-size: 1.2em;">${item.icon}</span>
                                ${item.text}
                            </a>
                        </li>
                    `;
                }).join('')}
            </ul>
        </nav>
    `
    
    // Créer l'overlay pour le drawer
    const overlay = document.createElement('div')
    overlay.className = 'drawer-overlay'
    
    // Ajouter au body / header
    document.body.insertBefore(header, document.body.firstChild)
    document.body.insertBefore(sidebar, document.body.firstChild)
    header.appendChild(menuToggle)
    document.body.insertBefore(drawer, document.body.firstChild)
    document.body.insertBefore(overlay, document.body.firstChild)
    
    // Ajouter la classe has-sidebar sur desktop
    if (window.innerWidth > 768) {
        document.body.classList.add('has-sidebar')
    }
    
    // Gestion du toggle du drawer (Mobile)
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active')
        drawer.classList.toggle('open')
        overlay.classList.toggle('active')
        document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : ''
    })
    
    // Fermer le drawer
    const closeBtn = drawer.querySelector('.close-btn')
    closeBtn.addEventListener('click', () => {
        menuToggle.classList.remove('active')
        drawer.classList.remove('open')
        overlay.classList.remove('active')
        document.body.style.overflow = ''
    })
    
    // Fermer en cliquant sur l'overlay
    overlay.addEventListener('click', () => {
        menuToggle.classList.remove('active')
        drawer.classList.remove('open')
        overlay.classList.remove('active')
        document.body.style.overflow = ''
    })
    
    // Fermer en cliquant sur un lien (mobile)
    drawer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                menuToggle.classList.remove('active')
                drawer.classList.remove('open')
                overlay.classList.remove('active')
                document.body.style.overflow = ''
            }
        })
    })
    
    // Gestion du redimensionnement
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            document.body.classList.add('has-sidebar')
            drawer.classList.remove('open')
            overlay.classList.remove('active')
            menuToggle.classList.remove('active')
            document.body.style.overflow = ''
        } else {
            document.body.classList.remove('has-sidebar')
        }
    })
    
    // Gestion du bouton de déconnexion
    const logoutButtons = document.querySelectorAll('#logoutBtn')
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault()
            try {
                if (supabase) {
                    await supabase.auth.signOut()
                }
            } catch (err) {
                console.error('Erreur de déconnexion:', err)
            }
            localStorage.removeItem('user')
            sessionStorage.clear()
            window.location.href = '/index.html'
        })
    })
}


// NOTE: La fonction applySupabaseImageRedirections() a été retirée.
// Elle réécrivait chaque <img src="/images/..."> pour tenter de charger depuis
// le bucket Supabase "images_s" en premier, avant de retomber sur le fichier local.
// Or plusieurs fichiers du bucket ont des noms complètement différents des fichiers
// locaux (ex: "weel_tech_logo.png" vs "Logo WEEL TECH.png" dans le bucket, ou
// "pullman_toulouse.jpeg" carrément absent du bucket) → échecs réseau systématiques,
// clignotement d'images cassées, chargement ralenti — pour un bucket qui n'apporte
// aucun bénéfice puisque les images locales (/images/...) fonctionnent déjà très bien.

// Bascule l'affichage des détails additionnels d'une carte (cours, formation...) au clic sur "Voir plus"
window.toggleCardDetails = function(buttonEl) {
    const card = buttonEl.closest('.course-card-list, .premium-course-card')
    if (!card) return
    const details = card.querySelector('.course-card-extra-details')
    if (!details) return
    const isHidden = details.style.display === 'none' || !details.style.display
    details.style.display = isHidden ? 'block' : 'none'
    buttonEl.textContent = isHidden ? 'Voir moins ▴' : 'Voir plus ▾'
}

// --- Fenêtre "À propos" réutilisable pour n'importe quelle carte de formation/cours/vidéo ---
// Nécessite que la page hôte contienne le HTML de la modale (#courseAboutModalOverlay, etc.)
// modulesList est optionnel : un tableau de chaînes (ex: ["Introduction...", "Développement..."])
window.showCourseAboutModal = function(title, description, modulesList) {
    const overlay = document.getElementById('courseAboutModalOverlay')
    if (!overlay) {
        console.warn('[À propos] Modale absente de cette page.')
        return
    }
    document.getElementById('aboutModalTitle').textContent = title || 'À propos'
    document.getElementById('aboutModalDescription').textContent = description || ''

    const modulesWrap = document.getElementById('aboutModalModulesWrap')
    const modulesList_ = document.getElementById('aboutModalModulesList')
    if (Array.isArray(modulesList) && modulesList.length > 0) {
        modulesList_.innerHTML = modulesList.map((m, i) => `<li><strong>Module ${i + 1} :</strong> ${m}</li>`).join('')
        modulesWrap.style.display = 'block'
    } else {
        modulesWrap.style.display = 'none'
    }

    overlay.style.display = 'flex'
    document.body.style.overflow = 'hidden'
}

window.closeCourseAboutModal = function() {
    const overlay = document.getElementById('courseAboutModalOverlay')
    if (overlay) overlay.style.display = 'none'
    document.body.style.overflow = ''
}

// Initialiser la navigation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Déterminer la page actuelle
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    createNavigation(currentPage)
})
