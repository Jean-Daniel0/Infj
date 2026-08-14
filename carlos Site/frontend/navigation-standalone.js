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

// Fonction pour rediriger automatiquement /images/ vers le bucket public "images_s" sur Supabase
function applySupabaseImageRedirections() {
    const supabaseBucketUrl = 'https://nnppbnqavajmublpfhkj.supabase.co/storage/v1/object/public/images_s/';
    
    const updateImageElement = (img) => {
        if (img.dataset.redirected) return;
        
        const src = img.getAttribute('src');
        if (src && src.includes('images/')) {
            const filename = src.split('images/').pop();
            
            // Liste ordonnée de tentatives pour trouver le bon fichier et format dans le bucket public Supabase
            const attempts = [];
            attempts.push(filename); // Exact match
            
            const lowerFilename = filename.toLowerCase();
            if (lowerFilename !== filename) {
                attempts.push(lowerFilename); // Lowercase match
            }
            
            // Variantes d'extensions pour les icônes de contact et logos
            const dotIndex = filename.lastIndexOf('.');
            if (dotIndex !== -1) {
                const base = filename.substring(0, dotIndex);
                const ext = filename.substring(dotIndex).toLowerCase();
                const baseLower = base.toLowerCase();
                
                const altExts = [];
                if (ext === '.webp') altExts.push('.png', '.svg', '.jpeg', '.jpg');
                else if (ext === '.png') altExts.push('.svg', '.webp', '.jpeg', '.jpg');
                else if (ext === '.svg') altExts.push('.png', '.webp');
                else if (ext === '.jpeg' || ext === '.jpg') altExts.push('.png', '.webp');
                
                for (const ae of altExts) {
                    attempts.push(base + ae);
                    attempts.push(baseLower + ae);
                }
            }
            
            const uniqueAttempts = [...new Set(attempts)];
            let attemptIndex = 0;
            
            img.dataset.originalSrc = src;
            img.dataset.redirected = "true";
            
            const tryNextAttempt = () => {
                if (attemptIndex < uniqueAttempts.length) {
                    const currentAttempt = uniqueAttempts[attemptIndex];
                    attemptIndex++;
                    img.src = supabaseBucketUrl + currentAttempt;
                } else {
                    // Si aucun fichier dans le bucket n'a fonctionné, retour au fallback local local
                    console.warn(`[Image Redirect] Aucun fichier correspondant trouvé pour ${filename} sur Supabase. Fallback local.`);
                    img.src = src;
                    img.onerror = null;
                }
            };
            
            img.onerror = () => {
                tryNextAttempt();
            };
            
            tryNextAttempt();
        }
    };

    // Traiter les images existantes
    document.querySelectorAll('img').forEach(updateImageElement);

    // Regarder via MutationObserver si de nouvelles images sont ajoutées dynamiquement ou si leur 'src' est modifié
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                if (mutation.target.tagName === 'IMG') {
                    // Retirer le flag pour permettre la modification si l'attribut change
                    delete mutation.target.dataset.redirected;
                    updateImageElement(mutation.target);
                }
            } else if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG') {
                            updateImageElement(node);
                        } else {
                            node.querySelectorAll('img').forEach(updateImageElement);
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

// Initialiser la navigation au chargement et appliquer les redirections d'images
document.addEventListener('DOMContentLoaded', () => {
    // Déterminer la page actuelle
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    createNavigation(currentPage)
    
    // Activer la redirection d'images d'arrière-plan/images_s
    applySupabaseImageRedirections()
})
