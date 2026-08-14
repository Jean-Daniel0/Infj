// Gestion de la navigation - Drawer mobile et menu latéral PC

// Fonction pour créer le menu de navigation
function createNavigation(currentPage = '') {
    const menuItems = [
        { href: '/index.html', text: 'Accueil', icon: '🏠' },
        { href: '/formation.html', text: 'Formation', icon: '📚' },
        { href: '/contact.html', text: 'Contact', icon: '📞' },
        { href: '/cours.html', text: 'Mes Cours', icon: '🎓' },
        { href: '/admin-videos.html', text: 'Admin Vidéos', icon: '⚙️' },
        { href: '#', text: 'Déconnexion', icon: '🚪', id: 'logoutBtn', style: 'display:none;' }
    ]
    
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
    const logoutBtn = document.getElementById('logoutBtn')
    if (logoutBtn && window.handleLogout) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault()
            window.handleLogout()
        })
    }
}

// Initialiser la navigation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Déterminer la page actuelle
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    createNavigation(currentPage)
})
