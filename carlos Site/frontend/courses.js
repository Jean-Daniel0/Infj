// Gestion de la page des cours
import { supabase, auth, formations, inscriptions } from './supabase-config.js'
import { handleLogout } from './auth.js'
import { getCourseVideos } from './supabase-videos.js'

// État de l'application
let currentUser = null
let userCourses = []
let availableCourses = []

// Fonction de résolution d'images locales physiques (évite l'I.A. et les liens brisés)
function resolveCourseImageWithLocalFallbacks(rawImageUrl, title) {
    const raw = (rawImageUrl || '').trim();
    const txt = (raw + ' ' + (title || '')).toLowerCase();

    // Si c'est déjà un chemin d'image local correct
    if (raw.startsWith('/images/') || raw.startsWith('images/')) {
        return raw.startsWith('/') ? raw : '/' + raw;
    }

    // Association stricte d'après le titre ou l'URL par rapport aux images physiques réelles présentes
    if (txt.includes('leadership') || txt.includes('pullman') || txt.includes('toulouse')) {
        return '/images/pullman_toulouse.jpeg';
    } else if (txt.includes('entrepreneuriat') || txt.includes('business')) {
        return '/images/business_photos.jpeg';
    } else if (txt.includes('communication') || txt.includes('deal') || txt.includes('handshake')) {
        return '/images/handshake_deal.jpeg';
    } else if (txt.includes('marketing') || txt.includes('office') || txt.includes('dropshipping')) {
        return '/images/office.jpeg';
    } else if (txt.includes('site') || txt.includes('création') || txt.includes('web') || txt.includes('design') || txt.includes('workforce') || txt.includes('langage')) {
        return '/images/workforce_photos.jpeg';
    }

    // Image par défaut parmi les physiques existantes
    return '/images/pullman_toulouse.jpeg';
}

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    // Essayer de charger l'utilisateur et d'attendre la réponse
    await checkAuthentication()
    
    // Configuration des gestionnaires d'événements
    setupEventListeners()
    
    // Charger les données
    await loadUserData()
    loadCourses()
})

// Vérification de l'authentification
async function checkAuthentication() {
    try {
        const { user, error } = await auth.getCurrentUser()
        
        if (error || !user) {
            // Accès anonyme possible
            return null
        }
        
        currentUser = user
        updateUserInterface()
        return user
        
    } catch (error) {
        console.error('Erreur de vérification d\'authentification:', error)
        return null
    }
}

// Configuration des gestionnaires d'événements
function setupEventListeners() {
    // Bouton de déconnexion
    const logoutBtn = document.getElementById('logoutBtn')
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout)
    }

    // Gestionnaires des Onglets de formations
    const tabInprogressBtn = document.getElementById('tabInprogressBtn')
    const tabCompletedBtn = document.getElementById('tabCompletedBtn')
    const activeCoursesContainer = document.getElementById('activeCourses')
    const completedCoursesContainer = document.getElementById('completedCoursesList')

    if (tabInprogressBtn && tabCompletedBtn) {
        tabInprogressBtn.addEventListener('click', () => {
            tabInprogressBtn.classList.add('active')
            tabCompletedBtn.classList.remove('active')
            if (activeCoursesContainer) activeCoursesContainer.style.display = 'flex'
            if (completedCoursesContainer) completedCoursesContainer.style.display = 'none'
        })

        tabCompletedBtn.addEventListener('click', () => {
            tabCompletedBtn.classList.add('active')
            tabInprogressBtn.classList.remove('active')
            if (activeCoursesContainer) activeCoursesContainer.style.display = 'none'
            if (completedCoursesContainer) completedCoursesContainer.style.display = 'flex'
        })
    }
}

// Mise à jour de l'interface utilisateur
function updateUserInterface() {
    if (!currentUser) return
    
    // Mettre à jour le nom d'utilisateur
    const userName = document.getElementById('userName')
    if (userName) {
        const displayName = currentUser.user_metadata?.prenom || 
                          currentUser.user_metadata?.nom || 
                          currentUser.email?.split('@')[0]
        userName.textContent = displayName
    }
}

// Mise à jour de l'affichage des statistiques de l'élève
function updateStatsUI(enrolledCount, certsCount) {
    const statEnrolled = document.getElementById('statEnrolled')
    const statHours = document.getElementById('statHours')
    const statCertificates = document.getElementById('statCertificates')
    const statScore = document.getElementById('statScore')
    
    if (statEnrolled) statEnrolled.textContent = enrolledCount
    if (statHours) statHours.textContent = enrolledCount > 0 ? (enrolledCount * 30) + 'h' : '0h'
    if (statCertificates) statCertificates.textContent = certsCount
    if (statScore) statScore.textContent = enrolledCount > 0 ? (certsCount > 0 ? '92%' : '85%') : '0%'
}

// Chargement des données utilisateur
async function loadUserData() {
    if (!currentUser) {
        const container = document.getElementById('activeCourses')
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Accès aux Programmes</h3>
                    <p>Découvrez notre catalogue ci-dessous. Connectez-vous à votre compte étudiant pour s'inscrire, suivre vos progrès et obtenir vos diplômes d'aptitude officiels.</p>
                </div>
            `
        }
        updateStatsUI(0, 0)
        await loadUserCertificates()
        return
    }
    
    try {
        // Charger les inscriptions de l'utilisateur
        const { data: userInscriptions, error } = await inscriptions.getUserInscriptions(currentUser.id)
        
        if (error) {
            console.error('Erreur lors du chargement des inscriptions:', error)
            updateStatsUI(0, 0)
            await loadUserCertificates()
            return
        }
        
        userCourses = userInscriptions || []
        displayUserCourses()
        
        // Compter les certificats réels de l'étudiant
        let certsCount = 0
        try {
            const { data: certsData } = await supabase
                .from('inscriptions')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('certificat_emission', true)
            if (certsData) {
                certsCount = certsData.length
            }
        } catch (e) {
            console.error('Erreur lors du comptage des certificats:', e)
        }
        
        updateStatsUI(userCourses.length, certsCount)
        await loadUserCertificates()
        
    } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error)
        updateStatsUI(0, 0)
    }
}

// Chargement des cours disponibles
async function loadCourses() {
    try {
        const { data, error } = await supabase
            .from('formations')
            .select('*')
            .eq('statut', 'active')
            .order('created_at', { ascending: false })
            
        if (error) throw error
        
        availableCourses = data || []
        displayAvailableCourses()
        
    } catch (error) {
        console.error('Erreur lors du chargement des cours:', error)
    }
}

// Affichage des cours de l'utilisateur avec répartition par état d'avancement
function displayUserCourses() {
    const container = document.getElementById('activeCourses')
    const completedContainer = document.getElementById('completedCoursesList')
    const countInprogressEl = document.getElementById('countInprogress')
    const countCompletedEl = document.getElementById('countCompleted')
    
    if (!container) return
    
    const completedCourses = userCourses.filter(course => (course.progress >= 100) || (course.certificat_emission === true));
    const activeCourses = userCourses.filter(course => !((course.progress >= 100) || (course.certificat_emission === true)));
    
    if (countInprogressEl) countInprogressEl.textContent = activeCourses.length;
    if (countCompletedEl) countCompletedEl.textContent = completedCourses.length;
    
    // 1. AFFICHAGE DES FORMATIONS EN COURS
    if (activeCourses.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px; text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; width: 100%;">
                <h3 style="color: #003366; margin: 0 0 6px 0; font-family: 'Outfit', sans-serif;">Aucune formation en cours</h3>
                <p style="color: #64748b; font-size: 0.88rem; max-width: 420px; margin: 0 auto 12px auto; line-height: 1.45;">Inscrivez-vous à un programme d'études pour commencer votre apprentissage professionnel.</p>
                <button class="btn-primary" onclick="scrollToAvailable()" style="padding: 10px 18px; font-size: 0.85rem; font-weight: bold; border-radius: 8px;">Voir les programmes disponibles</button>
            </div>
        `;
    } else {
        container.innerHTML = activeCourses.map(course => {
            const title = course.formations?.titre || 'Formation';
            const meta = (course.formations?.modules && typeof course.formations.modules === 'object') ? course.formations.modules : {};
            const rawImg = course.image_url || course.formations?.image_url || meta.image_couverture || '';
            const imageUrl = resolveCourseImageWithLocalFallbacks(rawImg, title);

            const enrollDate = course.created_at ? new Date(course.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : 'N/A';

            let statusLabel = 'En attente';
            let statusColor = '#d97706';
            let statusBg = '#fef3c7';

            if (course.status === 'acceptee') {
                statusLabel = 'Approuvée (En cours)';
                statusColor = '#166534';
                statusBg = '#dcfce7';
            } else if (course.status === 'refusee') {
                statusLabel = 'Refusée';
                statusColor = '#991b1b';
                statusBg = '#fee2e2';
            }

            const prenomEtudiant = course.prenom || currentUser?.user_metadata?.prenom || '';
            const nomEtudiant = course.nom || currentUser?.user_metadata?.nom || '';
            const emailEtudiant = course.email || currentUser?.email || 'Non spécifié';
            const phoneEtudiant = course.telephone || 'Non renseigné';
            const prog = course.progress || 0;

            return `
                <div class="course-card-list active">
                    <div class="course-list-main-info">
                        <div class="course-list-thumb">
                            <img src="${imageUrl}" alt="${title}" referrerPolicy="no-referrer">
                        </div>
                        <div class="course-list-details" data-progress-text="${prog}%">
                            <span class="course-status" style="background: ${statusBg}; color: ${statusColor}; font-size: 0.72rem; font-weight: 700; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; display: inline-block; width: fit-content; text-align: center; margin-bottom: 4px;">${statusLabel}</span>
                            <h3>${title}</h3>
                            <div style="font-size: 0.8rem; color: #64748b; font-family: 'Inter', sans-serif;">
                                📅 Demande: <strong>${enrollDate}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="course-list-divider student">
                        <div style="font-weight: 700; color: #003366;">👤 ${prenomEtudiant} ${nomEtudiant}</div>
                        <div style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">✉️ ${emailEtudiant}</div>
                        <div>📞 ${phoneEtudiant}</div>
                    </div>

                    <div class="course-list-progress-col">
                        <div class="progress-bar" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                            <div class="progress-fill" style="width: ${prog}%; height: 100%; background: #28a745; transition: width 0.5s ease;"></div>
                        </div>
                        <span class="progress-text" style="font-size: 0.75rem; font-weight: 700; color: #475569;">${prog}% complété</span>
                    </div>

                    <div class="course-list-actions-col">
                        ${course.status === 'acceptee' 
                            ? `<button class="btn-primary" onclick="openCourse('${course.formation_id}')" style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; height: auto; text-transform: none; letter-spacing: normal;">Continuer</button>`
                            : `<button class="btn-primary" disabled style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; background: #cbd5e1; color: #64748b; border: none; cursor: not-allowed; height: auto; text-transform: none; letter-spacing: normal;">En attente</button>`
                        }
                        <button class="btn-secondary" onclick="viewProgress('${course.formation_id}')" style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; height: auto;">Détails</button>
                    </div>
                </div>
            `;
        }).join('')
    }

    // 2. AFFICHAGE DES FORMATIONS DÉJÀ SUIVIES (COMPLÉTÉES)
    if (completedContainer) {
        if (completedCourses.length === 0) {
            completedContainer.innerHTML = `
                <div class="empty-state" style="padding: 30px; text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; width: 100%;">
                    <div style="font-size: 2.2rem; margin-bottom: 8px;">🎓</div>
                    <h3 style="color: #003366; margin: 0 0 6px 0; font-family: 'Outfit', sans-serif;">Aucune formation terminée</h3>
                    <p style="color: #64748b; font-size: 0.88rem; max-width: 420px; margin: 0 auto; line-height: 1.45;">Lorsque vous terminez un programme à 100% ou que votre certificat est émis, il apparaît ici.</p>
                </div>
            `;
        } else {
            completedContainer.innerHTML = completedCourses.map(course => {
                const title = course.formations?.titre || 'Formation';
                const meta = (course.formations?.modules && typeof course.formations.modules === 'object') ? course.formations.modules : {};
                const rawImg = course.image_url || course.formations?.image_url || meta.image_couverture || '';
                const imageUrl = resolveCourseImageWithLocalFallbacks(rawImg, title);

                const prenomEtudiant = course.prenom || currentUser?.user_metadata?.prenom || '';
                const nomEtudiant = course.nom || currentUser?.user_metadata?.nom || '';
                const emailEtudiant = course.email || currentUser?.email || 'Non spécifié';

                return `
                    <div class="course-card-list active" style="border-left-color: #28a745;">
                        <div class="course-list-main-info">
                            <div class="course-list-thumb">
                                <img src="${imageUrl}" alt="${title}" referrerPolicy="no-referrer">
                            </div>
                            <div class="course-list-details" data-progress-text="Terminé">
                                <span class="course-status" style="background: #dcfce7; color: #166534; font-size: 0.72rem; font-weight: 700; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; display: inline-block; width: fit-content; text-align: center; margin-bottom: 4px;">Terminée ✓</span>
                                <h3>${title}</h3>
                                <div style="font-size: 0.8rem; color: #64748b; font-family: 'Inter', sans-serif;">
                                    🏆 Cycle académique accompli !
                                </div>
                            </div>
                        </div>

                        <div class="course-list-divider student">
                            <div style="font-weight: 700; color: #003366;">👤 ${prenomEtudiant} ${nomEtudiant}</div>
                            <div style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">✉️ ${emailEtudiant}</div>
                        </div>

                        <div class="course-list-progress-col">
                            <div class="progress-bar" style="width: 100%; height: 8px; background: #28a745; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                                <div class="progress-fill" style="width: 100%; height: 100%; background: #28a745; transition: width 0.5s ease;"></div>
                            </div>
                            <span class="progress-text" style="font-size: 0.75rem; font-weight: 700; color: #166534;">100% Terminée</span>
                        </div>

                        <div class="course-list-actions-col">
                            <button class="btn-primary" onclick="openCourse('${course.formation_id}')" style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; height: auto; text-transform: none; letter-spacing: normal; background-color: #28a745; border-color: #28a745;">Revoir le cours</button>
                            ${course.certificat_emission 
                                ? `<button class="btn-secondary" onclick="scrollToCertificates()" style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #003366; height: auto; font-family: inherit;">Certificat obtenu</button>`
                                : `<button class="btn-secondary" disabled style="padding: 10px; font-size: 0.82rem; font-weight: bold; border-radius: 8px; border: 1px solid #cbd5e1; background: #ebeef2; color: #64748b; height: auto; cursor: not-allowed; font-family: inherit;">Attestation en attente</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// Affichage des cours disponibles
function displayAvailableCourses() {
    const container = document.getElementById('availableCourses')
    if (!container) return
    
    if (availableCourses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Aucun programme de formation disponible de suite</h3>
                <p>Nos formations reviennent d'ici peu. Restez alerté pour les prochaines cohortes !</p>
            </div>
        `
        return
    }
    
    // Insérer les styles CSS spécifiques pour les cartes
    const styleId = 'courses-custom-styles'
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement('style')
        styleSheet.id = styleId
        styleSheet.textContent = `
            .price-badge {
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.78rem;
                font-weight: 800;
                text-transform: uppercase;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
            }
            .price-badge.free {
                background: #22c55e;
                color: #ffffff;
            }
            .price-badge.paid {
                background: #f47c20;
                color: #ffffff;
            }
            .course-card.available:hover img {
                transform: scale(1.05);
            }
        `
        document.head.appendChild(styleSheet)
    }
    
    container.innerHTML = availableCourses.map(course => {
        const title = course.titre || '';
        const desc = course.description || 'Apprentissage professionnel intensif de haute qualité.';
        const duree = course.duree || 'Seulement quelques semaines';
        const modalite = course.modalite || 'En ligne';
        const dateDebut = course.date_debut ? new Date(course.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Très prochainement';
        const placesMax = course.places_max || 50;
        const placesRestantes = course.places_restantes !== undefined ? course.places_restantes : placesMax;
        
        // Extraction sécurisée des informations
        const meta = (course.modules && typeof course.modules === 'object') ? course.modules : {};
        const formateurNom = course.formateur_nom || meta.formateur_nom || 'Jean-Daniel Michel';
        const formateurRole = course.formateur_role || meta.formateur_role || 'Enseignant INFJ';
        
        const rawImageUrl = course.image_url || meta.image_couverture || '';
        const imageUrl = resolveCourseImageWithLocalFallbacks(rawImageUrl, title);
        
        const isFree = course.gratuit !== false && (course.prix === undefined || Number(course.prix) === 0);
        const displayPrice = isFree ? '<span class="price-badge free">Gratuit</span>' : `<span class="price-badge paid">${Number(course.prix).toLocaleString('fr-FR')} HTG</span>`;
        
        const isCompleted = placesRestantes <= 0;
        const buttonText = isCompleted ? 'Complet' : "S'inscrire à cette formation";
        const disabledAttr = isCompleted ? 'disabled style="background: #cbd5e1; color: #64748b; cursor: not-allowed; border: none; transform: none; box-shadow: none;"' : '';
        
        return `
            <div class="course-card-list active">
                <div class="course-list-main-info">
                    <div class="course-list-thumb">
                        <img src="${imageUrl}" alt="${title}" referrerPolicy="no-referrer">
                    </div>
                    <div class="course-list-details">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px; flex-wrap: wrap;">
                            ${displayPrice}
                            <span style="background: #e0f2fe; color: #003366; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">🌐 ${modalite}</span>
                        </div>
                        <h3>${title}</h3>
                        <p class="course-list-desc">${desc}</p>
                    </div>
                </div>

                <div class="course-list-divider teacher">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2rem;">👨‍🏫</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 700; color: #003366; font-size: 0.88rem;">${formateurNom}</span>
                            <span style="color: #64748b; font-size: 0.75rem;">${formateurRole}</span>
                        </div>
                    </div>
                </div>

                <div class="course-list-divider meta">
                    <div style="display: flex; align-items: center; gap: 6px;">⏱️ Durée : <strong>${duree}</strong></div>
                    <div style="display: flex; align-items: center; gap: 6px;">📅 Début : <strong>${dateDebut}</strong></div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span style="font-size: 0.82rem; font-weight: 700; color: ${isCompleted ? '#ef4444' : '#15803d'};">
                            ${isCompleted ? '🚨 Complet' : `👥 Places : <strong>${placesRestantes}</strong> / ${placesMax}`}
                        </span>
                    </div>
                </div>

                <div class="course-list-actions-col">
                    <button class="btn-primary" onclick="enrollCourse('${course.id}')" ${disabledAttr} style="width: 100%; font-weight: 700; font-size: 0.85rem; padding: 12px; border-radius: 10px; height: auto; text-transform: none; letter-spacing: normal;">
                        ${buttonText}
                    </button>
                    <button class="btn-secondary" onclick="viewDetails('${course.id}')" style="width: 100%; margin-top: 8px; font-weight: 700; font-size: 0.85rem; padding: 10px; border-radius: 10px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; display: none;">
                        Détails
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Inscription à un cours
async function enrollCourse(courseId) {
    if (!currentUser) {
        showMessage('Veuillez vous connecter pour vous inscrire à un programme de formation.', 'info')
        setTimeout(() => {
            window.location.href = `login.html?redirect=cours.html`
        }, 1500)
        return
    }
    
    openRegistrationModal(courseId)
}

// Ouvrir le modal d'inscription structuré
function openRegistrationModal(courseId) {
    const course = availableCourses.find(c => c.id === courseId);
    if (!course) {
        showMessage('Formation non trouvée.', 'error');
        return;
    }
    
    // Vérifier les places restantes
    const placesRestantes = course.places_restantes !== undefined ? course.places_restantes : course.places_max;
    if (placesRestantes <= 0) {
        showMessage('Désolé, ce programme de formation est complet.', 'error');
        return;
    }
    
    // Vérifier si déjà inscrit ou approuvé
    const existingEnrollment = userCourses.find(c => c.formation_id === courseId);
    if (existingEnrollment) {
        showMessage('Vous êtes déjà inscrit(e) à ce programme.', 'info');
        return;
    }
    
    // Supprimer le modal s'il traîne toujours
    const existingModal = document.getElementById('enrollmentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Pré-remplissage avec les informations du compte
    const userMeta = currentUser.user_metadata || {};
    const defaultNom = userMeta.nom || '';
    const defaultPrenom = userMeta.prenom || '';
    const defaultPhone = userMeta.telephone || '';
    const defaultEmail = currentUser.email || '';
    
    // Créer la structure du modal moderne
    const modal = document.createElement('div');
    modal.id = 'enrollmentModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        z-index: 11000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
        overflow-y: auto;
    `;
    
    modal.innerHTML = `
        <div class="modal-card" style="background: #ffffff; width: 100%; max-width: 520px; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.15); overflow: hidden; border-top: 6px solid #170e7c; animation: modalEnter 0.3s ease-out; position: relative; margin: auto;">
            <button id="closeEnrollmentBtn" style="position: absolute; top: 15px; right: 15px; background: transparent; border: none; font-size: 24px; font-weight: bold; color: #64748b; cursor: pointer; transition: color 0.2s; z-index: 10;">✕</button>
            <div style="padding: 28px;">
                <h3 style="color: #170e7c; font-size: 1.35rem; font-weight: 800; margin: 0 0 4px 0; font-family: 'Outfit', sans-serif; line-height: 1.3;">S'inscrire au programme ${course.titre}</h3>
                <p style="color: #64748b; font-size: 0.8rem; line-height: 1.4; margin: 0 0 20px 0; font-weight: 500;">Ces informations seront utilisées pour établir votre certificat de réussite.</p>
                
                <form id="enrollmentForm" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; color: #64748b; font-size: 13px;">Prénom <span style="color: #dc2626;">*</span></label>
                            <input id="enrollPrenom" type="text" value="${defaultPrenom}" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s;" />
                            <span class="field-error" id="error-prenom" style="color: #dc2626; font-size: 11px; display: none;"></span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; color: #64748b; font-size: 13px;">Nom <span style="color: #dc2626;">*</span></label>
                            <input id="enrollNom" type="text" value="${defaultNom}" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s;" />
                            <span class="field-error" id="error-nom" style="color: #dc2626; font-size: 11px; display: none;"></span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; color: #64748b; font-size: 13px;">Adresse Email <span style="color: #dc2626;">*</span></label>
                        <input id="enrollEmail" type="email" value="${defaultEmail}" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s;" />
                        <span class="field-error" id="error-email" style="color: #dc2626; font-size: 11px; display: none;"></span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; color: #64748b; font-size: 13px;">Téléphone / WhatsApp <span style="color: #64748b; font-weight: normal;">(Optionnel)</span></label>
                        <input id="enrollPhone" type="tel" value="${defaultPhone}" placeholder="Ex: +509 4634-1547" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s;" />
                        <span class="field-error" id="error-phone" style="color: #dc2626; font-size: 11px; display: none;"></span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; color: #64748b; font-size: 13px;">Date de naissance <span style="color: #dc2626;">*</span></label>
                        <input id="enrollBirth" type="date" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s;" />
                        <span class="field-error" id="error-birth" style="color: #dc2626; font-size: 11px; display: none;"></span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; color: #64748b; font-size: 13px;">Pays <span style="color: #dc2626;">*</span></label>
                            <select id="enrollCountry" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s; background-color: #fff;">
                                <option value="" disabled selected>Choisissez votre pays</option>
                                <option value="Haiti">Haïti</option>
                                <option value="France">France</option>
                                <option value="Canada">Canada</option>
                                <option value="Etats-Unis">États-Unis</option>
                                <option value="Belgique">Belgique</option>
                                <option value="Suisse">Suisse</option>
                                <option value="Republique-Dominicaine">République Dominicaine</option>
                                <option value="Cote-d-Ivoire">Côte d'Ivoire</option>
                                <option value="Senegal">Sénégal</option>
                                <option value="Cameroun">Cameroun</option>
                                <option value="Maroc">Maroc</option>
                                <option value="Algerie">Algérie</option>
                                <option value="Tunisie">Tunisie</option>
                                <option value="Benin">Bénin</option>
                                <option value="Togo">Togo</option>
                                <option value="Mali">Mali</option>
                                <option value="Madagascar">Madagascar</option>
                                <option value="Autre">Autre</option>
                            </select>
                            <span class="field-error" id="error-country" style="color: #dc2626; font-size: 11px; display: none;"></span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; color: #64748b; font-size: 13px;">Niveau d'études <span style="color: #dc2626;">*</span></label>
                            <select id="enrollEducation" style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; height: 42px; font-family: inherit; transition: border-color 0.2s; background-color: #fff;">
                                <option value="" disabled selected>Sélectionner niveau</option>
                                <option value="Bac">Bac</option>
                                <option value="Licence">Licence</option>
                                <option value="Master">Master</option>
                                <option value="Doctorat">Doctorat</option>
                                <option value="Autre">Autre</option>
                            </select>
                            <span class="field-error" id="error-education" style="color: #dc2626; font-size: 11px; display: none;"></span>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; color: #64748b; font-size: 13px;">Pourquoi cette formation ? <span style="color: #64748b; font-weight: normal;">(Optionnel)</span></label>
                        <textarea id="enrollMotivation" maxlength="300" placeholder="Présentez brièvement vos ambitions..." style="padding: 10px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; min-height: 70px; max-height: 120px; resize: vertical; font-family: inherit; transition: border-color 0.2s;"></textarea>
                        <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 2px;" id="charCounter">0 / 300</div>
                    </div>
                    
                    <div id="enrollmentModalMessage" style="display: none; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 13px; text-align: center; margin-top: 5px;"></div>
                    
                    <button type="submit" id="enrollSubmitBtn" style="background: #170e7c; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; width: 100%; height: 46px; cursor: pointer; font-size: 15px; transition: all 0.2s; margin-top: 10px; font-family: inherit;">
                        Confirmer mon inscription
                    </button>
                    <button type="button" id="cancelEnrollmentBtn" style="background: transparent; color: #64748b; border: none; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; margin-top: 4px; padding: 8px;">
                        Annuler
                    </button>
                </form>
            </div>
        </div>
        
        <style>
            @keyframes modalEnter {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #closeEnrollmentBtn:hover {
                color: #dc2626 !important;
            }
            #enrollmentForm input:focus, #enrollmentForm select:focus, #enrollmentForm textarea:focus {
                border-color: #170e7c !important;
                outline: none;
            }
        </style>
    `;
    
    document.body.appendChild(modal);
    
    // Counter characters why this program
    const textEl = document.getElementById('enrollMotivation');
    const counterEl = document.getElementById('charCounter');
    textEl.addEventListener('input', () => {
        counterEl.textContent = `${textEl.value.length} / 300`;
    });
    
    // Gestionnaires de fermeture
    const closeModal = () => modal.remove();
    document.getElementById('closeEnrollmentBtn').addEventListener('click', closeModal);
    document.getElementById('cancelEnrollmentBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Soumission du formulaire
    const formEl = document.getElementById('enrollmentForm');
    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validation inputs
        const prenomInput = document.getElementById('enrollPrenom');
        const nomInput = document.getElementById('enrollNom');
        const emailInput = document.getElementById('enrollEmail');
        const phoneInput = document.getElementById('enrollPhone');
        const birthInput = document.getElementById('enrollBirth');
        const countryInput = document.getElementById('enrollCountry');
        const educationInput = document.getElementById('enrollEducation');
        const motivationInput = document.getElementById('enrollMotivation');
        
        const prenomVal = prenomInput.value.trim();
        const nomVal = nomInput.value.trim();
        const emailVal = emailInput.value.trim();
        const phoneVal = phoneInput.value.trim();
        const birthVal = birthInput.value;
        const countryVal = countryInput.value;
        const educationVal = educationInput.value;
        const motivationVal = motivationInput.value.trim();
        
        let isValid = true;
        
        // Reset errors
        document.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
        
        if (!prenomVal) {
            document.getElementById('error-prenom').textContent = 'Prénom obligatoire.';
            document.getElementById('error-prenom').style.display = 'block';
            isValid = false;
        }
        if (!nomVal) {
            document.getElementById('error-nom').textContent = 'Nom obligatoire.';
            document.getElementById('error-nom').style.display = 'block';
            isValid = false;
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailVal) {
            document.getElementById('error-email').textContent = 'Email obligatoire.';
            document.getElementById('error-email').style.display = 'block';
            isValid = false;
        } else if (!emailRegex.test(emailVal)) {
            document.getElementById('error-email').textContent = 'Format de l\'email invalide (ex: nom@domaine.com).';
            document.getElementById('error-email').style.display = 'block';
            isValid = false;
        }
        
        if (!birthVal) {
            document.getElementById('error-birth').textContent = 'Date de naissance obligatoire.';
            document.getElementById('error-birth').style.display = 'block';
            isValid = false;
        }
        if (!countryVal) {
            document.getElementById('error-country').textContent = 'Veuillez sélectionner un pays.';
            document.getElementById('error-country').style.display = 'block';
            isValid = false;
        }
        if (!educationVal) {
            document.getElementById('error-education').textContent = 'Veuillez choisir un niveau d\'études.';
            document.getElementById('error-education').style.display = 'block';
            isValid = false;
        }
        
        if (!isValid) return;
        
        const msgBox = document.getElementById('enrollmentModalMessage');
        const submitBtn = document.getElementById('enrollSubmitBtn');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Inscription en cours...';
        submitBtn.style.opacity = '0.7';
        
        try {
            // Re-vérifier s'il est déjà inscrit par email
            const { data: checkInsc, error: checkErr } = await supabase
                .from('inscriptions')
                .select('id')
                .eq('email', emailVal)
                .eq('formation_id', courseId)
                .maybeSingle();
                
            if (checkInsc) {
                msgBox.textContent = "Vous êtes déjà inscrit(e) à ce programme.";
                msgBox.style.background = '#fef3c7';
                msgBox.style.color = '#92400e';
                msgBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirmer mon inscription';
                submitBtn.style.opacity = '1';
                return;
            }
            
            // Soumission finale de l'inscription
            const parsedMotivation = `Motivation: ${motivationVal || 'Aucune note'} | Pays: ${countryVal} | Niveau d''études: ${educationVal} | Date de naissance: ${birthVal}`;
            
            const enrollmentData = {
                user_id: currentUser.id,
                formation_id: courseId,
                nom: nomVal,
                prenom: prenomVal,
                email: emailVal,
                telephone: phoneVal,
                date_naissance: birthVal,
                pays: countryVal,
                niveau_etudes: educationVal,
                motivation: parsedMotivation
            };
            
            const { error: insError } = await inscriptions.register(courseId, enrollmentData);
            
            if (insError) {
                throw insError;
            }
            
            // Création et affichage du toast vert de succès
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background-color: #22c55e;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                z-index: 12000;
                font-family: 'Inter', sans-serif;
                font-size: 14px;
                font-weight: 600;
                animation: toastEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            `;
            
            // Animation styles
            const progressStyle = document.createElement('style');
            progressStyle.innerHTML = `
                @keyframes toastEnter {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes toastExit {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100px); opacity: 0; }
                }
            `;
            document.head.appendChild(progressStyle);
            
            toast.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>✓</span>
                    <span>Inscription enregistrée ! Nous vous contacterons sous 48h.</span>
                </div>
            `;
            document.body.appendChild(toast);
            
            // Disparition après 4 secondes
            setTimeout(() => {
                toast.style.animation = 'toastExit 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3700);
            
            // Fermer le modal immédiatement
            closeModal();
            
            // Recharger l'utilisateur localement de suite
            loadUserData();
            loadCourses();
            
        } catch (error) {
            console.error('Erreur inscription:', error);
            msgBox.textContent = "Une erreur est survenue. Veuillez réessayer.";
            msgBox.style.background = '#fee2e2';
            msgBox.style.color = '#991b1b';
            msgBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmer mon inscription';
            submitBtn.style.opacity = '1';
        }
    });
}

// Ouverture d'un cours
function openCourse(courseId) {
    try {
        const course = userCourses.find(c => c.formation_id === courseId) || 
                      availableCourses.find(c => c.id === courseId)
        
        if (!course) {
            showMessage('Cours non trouvé.', 'error')
            return
        }

        const courseTitle = course.formations?.titre || course.titre || ''
        let courseType = courseId
        
        if (courseTitle.toLowerCase().includes('site web') || 
            courseTitle.toLowerCase().includes('web') ||
            courseId === 'web' ||
            courseId === 'creation-site-web') {
            courseType = 'web'
        } else if (courseTitle.toLowerCase().includes('leadership') || courseId === 'leadership') {
            courseType = 'leadership'
        } else if (courseTitle.toLowerCase().includes('entrepreneuriat') || courseId === 'entrepreneuriat') {
            courseType = 'entrepreneuriat'
        } else if (courseTitle.toLowerCase().includes('communication') || courseId === 'communication') {
            courseType = 'communication'
        } else if (courseTitle.toLowerCase().includes('marketing') || courseId === 'marketing') {
            courseType = 'marketing'
        } else if (courseTitle.toLowerCase().includes('dropshipping') || courseId === 'dropshipping') {
            courseType = 'dropshipping'
        }

        window.location.href = `video.html?course=${courseType}`
    } catch (error) {
        console.error('Erreur ouverture cours:', error)
        showMessage('Erreur lors de l\'ouverture du cours.', 'error')
    }
}

// Afficher les vidéos d'un cours
async function displayCourseVideos(courseType = 'web') {
    try {
        showMessage('Chargement des vidéos...', 'info')
        
        const { videos, courseType: type } = await getCourseVideos(courseType)
        
        if (!videos || videos.length === 0) {
            showMessage('Aucune vidéo disponible pour ce cours.', 'warning')
            return
        }

        createVideoModal(videos, type)
        
    } catch (error) {
        console.error('Erreur affichage vidéos:', error)
        let errorMessage = 'Erreur lors du chargement des vidéos. '
        
        if (error.message && error.message.includes('Unauthorized')) {
            errorMessage = 'Erreur d\'authentification: accès non autorisé aux vidéos.'
        } else if (error.message && error.message.includes('Failed to fetch')) {
            errorMessage = 'Impossible de contacter le serveur.'
        } else {
            errorMessage += error.message || 'Veuillez réessayer.'
        }
        
        showMessage(errorMessage, 'error')
    }
}

// Créer une modal pour afficher les vidéos
function createVideoModal(videos, courseType) {
    const existingModal = document.getElementById('videoModal')
    if (existingModal) {
        existingModal.remove()
    }

    const modal = document.createElement('div')
    modal.id = 'videoModal'
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000;
        overflow-y: auto;
        padding: 20px;
        box-sizing: border-box;
    `

    const modalContent = document.createElement('div')
    modalContent.style.cssText = `
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        border-radius: 15px;
        padding: 30px;
        position: relative;
    `

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 15px;
        background: #dc3545;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        font-weight: bold;
    `
    closeBtn.onclick = () => modal.remove()

    const title = document.createElement('h2')
    title.textContent = 'Programmes de Formation - Vidéos du Cours'
    title.style.cssText = `
        color: #003366;
        margin-bottom: 30px;
        font-size: 28px;
    `

    const videosGrid = document.createElement('div')
    videosGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
    `

    videos.forEach((video, index) => {
        const videoCard = document.createElement('div')
        videoCard.style.cssText = `
            background: #f8f9fa;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: transform 0.2s;
        `
        videoCard.onmouseenter = () => videoCard.style.transform = 'scale(1.02)'
        videoCard.onmouseleave = () => videoCard.style.transform = 'scale(1)'
        videoCard.onclick = () => playVideo(video, videos)

        const thumbnail = document.createElement('div')
        thumbnail.style.cssText = `
            width: 100%;
            height: 200px;
            background: linear-gradient(135deg, #003366 0%, #1a3365 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        `

        if (video.thumbnailUrl) {
            const img = document.createElement('img')
            img.src = video.thumbnailUrl
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;'
            img.onerror = () => {
                thumbnail.innerHTML = `
                    <div style="color: white; font-size: 48px;">▶</div>
                `
            }
            thumbnail.appendChild(img)
        } else {
            thumbnail.innerHTML = `
                <div style="color: white; font-size: 48px;">▶</div>
            `
        }

        const badge = document.createElement('div')
        badge.textContent = `${index + 1}`
        badge.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: #f47c20;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        `
        thumbnail.appendChild(badge)

        const videoInfo = document.createElement('div')
        videoInfo.style.cssText = 'padding: 15px;'

        const videoTitle = document.createElement('h3')
        videoTitle.textContent = video.title
        videoTitle.style.cssText = `
            color: #003366;
            margin: 0 0 10px 0;
            font-size: 18px;
        `

        const videoMeta = document.createElement('div')
        videoMeta.style.cssText = `
            color: #666;
            font-size: 14px;
            display: flex;
            gap: 15px;
        `
        if (video.duration) {
            const duration = formatDuration(video.duration)
            videoMeta.innerHTML += `<span>⏱️ ${duration}</span>`
        }
        if (video.views) {
            videoMeta.innerHTML += `<span>👁️ ${video.views} vues</span>`
        }

        videoInfo.appendChild(videoTitle)
        videoInfo.appendChild(videoMeta)
        videoCard.appendChild(thumbnail)
        videoCard.appendChild(videoInfo)
        videosGrid.appendChild(videoCard)
    })

    modalContent.appendChild(closeBtn)
    modalContent.appendChild(title)
    modalContent.appendChild(videosGrid)
    modal.appendChild(modalContent)
    document.body.appendChild(modal)
}

// Jouer une vidéo
function playVideo(video, allVideos) {
    const existingPlayer = document.getElementById('videoPlayer')
    if (existingPlayer) {
        existingPlayer.remove()
    }

    const playerContainer = document.createElement('div')
    playerContainer.id = 'videoPlayer'
    playerContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    `

    const playerContent = document.createElement('div')
    playerContent.style.cssText = `
        max-width: 1200px;
        width: 100%;
        position: relative;
    `

    const closePlayerBtn = document.createElement('button')
    closePlayerBtn.textContent = '✕'
    closePlayerBtn.style.cssText = `
        position: absolute;
        top: -50px;
        right: 0;
        background: #dc3545;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        font-weight: bold;
        z-index: 10002;
    `
    closePlayerBtn.onclick = () => playerContainer.remove()

    const videoElement = document.createElement('video')
    videoElement.src = video.streamingUrl
    videoElement.controls = true
    videoElement.autoplay = true
    videoElement.style.cssText = `
        width: 100%;
        max-height: 80vh;
        border-radius: 10px;
    `

    const videoTitle = document.createElement('h3')
    videoTitle.textContent = video.title
    videoTitle.style.cssText = `
        color: white;
        margin-top: 20px;
        font-size: 24px;
    `

    const videoDescription = document.createElement('p')
    videoDescription.textContent = video.description || video.details || ''
    videoDescription.style.cssText = `
        color: #e6e6e6;
        margin-top: 10px;
        font-size: 16px;
        line-height: 1.6;
    `

    playerContent.appendChild(closePlayerBtn)
    playerContent.appendChild(videoElement)
    playerContent.appendChild(videoTitle)
    playerContent.appendChild(videoDescription)
    playerContainer.appendChild(playerContent)
    document.body.appendChild(playerContainer)
}

// Formater la durée
function formatDuration(seconds) {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`
    } else {
        return `${secs}s`
    }
}

// Affichage du progrès
function viewProgress(courseId) {
    showMessage('Détails de progression disponibles auprès du service de scolarité.', 'info')
}

// Affichage des détails
function viewDetails(courseId) {
    const course = availableCourses.find(c => c.id === courseId)
    if (!course) return
    showMessage(`Détails de "${course.titre}" - Informations additionnelles délivrées sous 48h.`, 'info')
}

// Défilement vers les cours disponibles
function scrollToAvailable() {
    const section = document.querySelector('.available-courses-section')
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' })
    }
}

// Téléchargement de certificat
function downloadCertificate(courseId) {
    showMessage('Certificat officiel disponible au téléchargement une fois le programme terminé.', 'info')
}

// Affichage de certificat
function viewCertificate(courseId) {
    showMessage('Certificat officiel disponible au téléchargement une fois le programme terminé.', 'info')
}

// Chargement dynamique des certificats de l'étudiant connectée
async function loadUserCertificates() {
    const container = document.getElementById('certificates');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state" style="padding:20px; grid-column: 1 / -1;">
                <p style="color:#64748b; text-align: center;">Connectez-vous pour voir vos certificats d'études officiels.</p>
            </div>
        `;
        return;
    }

    try {
        // Étape 1 : Sélectionner les inscriptions approuvées pour l'étudiant qui ont un certificat émis
        const { data: inscriptionsData, error: insError } = await supabase
            .from('inscriptions')
            .select(`
                id,
                nom,
                prenom,
                certificat_emission,
                certificat_date,
                formations (
                    id,
                    titre,
                    duree
                )
            `)
            .eq('user_id', currentUser.id)
            .eq('certificat_emission', true);

        if (insError) throw insError;

        if (!inscriptionsData || inscriptionsData.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px; text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; grid-column: 1 / -1;">
                    <div style="font-size: 2.5rem; margin-bottom: 12px;">🏆</div>
                    <h3 style="color: #003366; margin: 0 0 6px 0; font-family: 'Outfit', sans-serif;">Aucun certificat émis pour l'instant</h3>
                    <p style="color: #64748b; font-size: 0.88rem; max-width: 420px; margin: 0 auto; line-height: 1.45;">Complétez vos sessions d'études et de cours virtuels en direct. Votre certificat officiel sera généré par la direction une fois vos conditions remplies.</p>
                </div>
            `;
            return;
        }

        // Étape 2 : Récupérer les enregistrements réels dans la table 'certificats' pour récupérer les numéros uniques
        const { data: dbCerts, error: certsError } = await supabase
            .from('certificats')
            .select('id, numero_certificat, date_emission, statut, inscription_id, pdf_url');

        // Associer par ID d'inscription pour faciliter l'accès
        const certsMap = {};
        if (dbCerts) {
            dbCerts.forEach(c => {
                certsMap[c.inscription_id] = c;
            });
        }

        // Construire les cartes de certificats dynamiquement
        container.innerHTML = inscriptionsData.map(item => {
            const courseTitle = item.formations?.titre || 'Formation Professionnelle';
            const cert = certsMap[item.id] || null;
            const certNum = cert ? cert.numero_certificat : `INFJ-PND-${item.id.slice(0, 8).toUpperCase()}`;
            const emissionDate = item.certificat_date ? new Date(item.certificat_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Récemment';

            const studentPrenom = item.prenom || currentUser?.user_metadata?.prenom || '';
            const studentNom = item.nom || currentUser?.user_metadata?.nom || '';

            // URL publique du fichier stocké dans Supabase storage bucket "certificats" 
            let fileUrl = cert?.pdf_url || '';
            if (!fileUrl) {
                const pdfFileName = `${certNum}.pdf`;
                const { data: storageUrlData } = supabase.storage
                    .from('certificats')
                    .getPublicUrl(pdfFileName);
                fileUrl = storageUrlData?.publicUrl || '#';
            }

            return `
                <div class="certificate-card" id="cert-card-${item.id}" style="display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: 16px; background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #28a745; box-shadow: 0 10px 25px rgba(0,0,0,0.03); transition: all 0.3s; width: 100%; box-sizing: border-box;">
                    <div class="certificate-icon" style="font-size: 2.8rem; background: #f0fff4; color: #28a745; width: 68px; height: 68px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(40, 167, 69, 0.12);">🏆</div>
                    <div class="certificate-info" style="flex-grow: 1;">
                        <h3 style="color: #003366; font-size: 1.12rem; margin: 0 0 6px 0; font-weight: 800; line-height: 1.3; font-family: 'Outfit', sans-serif;">Certificat d'Aptitude: ${courseTitle}</h3>
                        <p style="color: #475569; font-size: 0.82rem; margin: 0 0 4px 0; font-weight: 500;">Délivré d'après l'inscription de <strong>${studentPrenom} ${studentNom}</strong></p>
                        <p style="color: #64748b; font-size: 0.78rem; margin: 0 0 6px 0;">Date d'émission : ${emissionDate}</p>
                        <p class="certificate-number" style="font-family: inherit; font-size: 0.75rem; font-weight: 700; color: #f47c20; background: #fff7f0; padding: 3px 8px; border-radius: 4px; display: inline-block; border: 1.5px solid rgba(244, 124, 32, 0.15);">N° ${certNum}</p>
                    </div>
                    <div class="certificate-actions" style="display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
                        <button onclick="previewCertificatePopup('${item.id}', \`${courseTitle.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`, \`${(studentPrenom + ' ' + studentNom).replace(/`/g, '\\`').replace(/'/g, "\\'")}\`, '${certNum}', '${emissionDate}', '${item.formations?.duree || '30 heures'}')" class="btn-secondary" style="font-size: 0.8rem; font-weight: bold; padding: 10px 18px; border-radius: 8px; font-family: inherit; line-height: 1.2; border: 1px solid #cbd5e1; background: #fff; color: #1e293b; cursor: pointer; transition: all 0.2s;">👁️ Aperçu</button>
                        <a href="${fileUrl}" target="_blank" class="btn-primary" style="display: block; text-decoration: none; text-align: center; font-size: 0.8rem; font-weight: bold; padding: 10px 18px; border-radius: 8px; font-family: inherit; line-height: 1.2;">Voir / Télécharger</a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Erreur lors du chargement des certificats :', err);
    }
}

// Affichage des messages
function showMessage(message, type = 'info') {
    let messageEl = document.getElementById('courseMessage')
    if (!messageEl) {
        messageEl = document.createElement('div')
        messageEl.id = 'courseMessage'
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: sans-serif;
            font-size: 0.9rem;
        `
        document.body.appendChild(messageEl)
    }

    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f47c20',
        info: '#003366'
    }

    messageEl.style.backgroundColor = colors[type] || colors.info
    messageEl.textContent = message

    setTimeout(() => {
        if (messageEl && messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl)
        }
    }, 6000)
}

// Définition de l'aperçu dynamique de certificat (popup)
function previewCertificatePopup(inscriptionId, courseTitle, studentName, certNum, dateEmission, studyDuration) {
    const existing = document.getElementById('certificatePreviewModal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'certificatePreviewModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(8px);
        z-index: 15000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        overflow-y: auto;
    `;

    modal.innerHTML = `
        <div style="background: #ffffff; width: 100%; max-width: 820px; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.3); overflow: hidden; position: relative; animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; margin: auto;">
            
            <div style="background: #0f172a; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; color: #ffffff;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem;">🏆</span>
                    <span style="font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1rem; color: #f8fafc;">Aperçu du Certificat Officiel</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="window.printCertificateFrame()" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;" class="btn-hover-gray">
                        🖨️ Imprimer / PDF
                    </button>
                    <button style="background: transparent; border: none; font-size: 22px; color: #94a3b8; cursor: pointer; font-weight: bold; transition: color 0.15s;" onclick="document.getElementById('certificatePreviewModal').remove()">✕</button>
                </div>
            </div>

            <div style="padding: 30px; background: #e2e8f0; display: flex; justify-content: center; overflow-x: auto; max-height: calc(100vh - 150px);">
                
                <div id="printCertArea" style="width: 760px; height: 537px; background: #ffffff; border: 12px double #003366; position: relative; padding: 35px 45px; box-sizing: border-box; text-align: center; flex-shrink: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; flex-direction: column; justify-content: space-between;">
                    
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: #003366;"></div>
                    <div style="position: absolute; top: 10px; left: 10px; width: 4px; height: 4px; border-radius: 50%; background: #003366; opacity: 0.3;"></div>
                    <div style="position: absolute; top: 10px; right: 10px; width: 4px; height: 4px; border-radius: 50%; background: #003366; opacity: 0.3;"></div>
                    <div style="position: absolute; bottom: 10px; left: 10px; width: 4px; height: 4px; border-radius: 50%; background: #003366; opacity: 0.3;"></div>
                    <div style="position: absolute; bottom: 10px; right: 10px; width: 4px; height: 4px; border-radius: 50%; background: #003366; opacity: 0.3;"></div>
                    
                    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 0.025; transform: rotate(-25deg); z-index: 1;">
                        <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 100px; font-weight: 900; color: #003366; letter-spacing: 10px;">OFFICIEL</span>
                    </div>

                    <div style="position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                        
                        <div>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                                <img src="/images/logo.png" style="height: 44px; object-fit: contain;" alt="INFJ" />
                                <div style="width: 1.5px; height: 32px; background: rgba(0, 51, 102, 0.25);"></div>
                                <img src="/images/michel_jd_groupe_ltd.png" style="height: 44px; object-fit: contain;" alt="Michel-JD" />
                            </div>
                            <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: #003366; text-transform: uppercase; margin-top: 8px; letter-spacing: 0.5px;">Institut National de Formation des Jeunes</div>
                            <div style="font-family: 'Inter', sans-serif; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #f47c20; font-weight: 600; margin-top: 2px;">RÉPUBLIQUE D'HAÏTI // MICHEL-JD GROUPE LTD</div>
                        </div>

                        <div style="width: 100px; height: 1px; background: linear-gradient(90deg, transparent, #f47c20, transparent); margin: 6px auto;"></div>

                        <div>
                            <div style="font-family: 'Inter', sans-serif; font-size: 9.5px; letter-spacing: 3px; text-transform: uppercase; color: #64748b; font-weight: 500;">Certificat officiel d'aptitude professionnelle</div>
                            <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; font-style: italic; color: #003366; margin: 4px 0 6px 0;">${studentName.toUpperCase()}</div>
                            
                            <div style="font-family: 'Inter', sans-serif; font-size: 11px; color: #334155; line-height: 1.4; max-width: 580px; margin: 0 auto;">
                                Pour avoir accompli l'intégralité du programme académique prescrit et brillamment validé le cycle de contrôle des aptitudes de la formation en :
                                <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: #003366; display: block; margin-top: 4px; letter-spacing: 0.5px;">« ${courseTitle} »</span>
                            </div>
                        </div>

                        <div style="display: flex; gap: 24px; justify-content: center; margin: 6px 0;">
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; font-weight: 600;">DURÉE D'ÉTUDES</span>
                                <span style="font-size: 11px; font-weight: 700; color: #003366;">${studyDuration}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; font-weight: 600;">DATE D'ÉMISSION</span>
                                <span style="font-size: 11px; font-weight: 700; color: #003366;">${dateEmission}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; font-weight: 600;">ID CERTIFICATION</span>
                                <span style="font-size: 11px; font-weight: 700; color: #f47c20;">${certNum}</span>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-around; gap: 15px; width: 100%; margin-top: 5px;">
                            <div style="display: flex; flex-direction: column; align-items: center; width: 220px;">
                                <div style="height: 38px; display: flex; align-items: center; justify-content: center;">
                                    <div style="font-size: 1.5rem; opacity: 0.15; color: #003366;">🏛️</div>
                                </div>
                                <div style="width: 100%; height: 0.75px; background: #cbd5e1; margin: 2px 0;"></div>
                                <span style="font-size: 9px; font-weight: 700; color: #003366;">Me Robertho Carlos Deronceray</span>
                                <span style="font-size: 7.5px; color: #64748b;">Directeur fondateur</span>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: center; width: 220px;">
                                <div style="height: 38px; display: flex; align-items: center; justify-content: center;">
                                    <div style="font-size: 1.5rem; opacity: 0.15; color: #003366;">📝</div>
                                </div>
                                <div style="width: 100%; height: 0.75px; background: #cbd5e1; margin: 2px 0;"></div>
                                <span style="font-size: 9px; font-weight: 700; color: #003366;">Jean-Daniel Michel</span>
                                <span style="font-size: 7.5px; color: #64748b;">Enseignant Titulaire</span>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-top: 0.5px solid rgba(0, 51, 102, 0.1); padding-top: 6px; font-size: 7.5px; color: #64748b; letter-spacing: 0.3px;">
                            <span>Institut National de Formation des Jeunes — République d'Haïti</span>
                            <span>Aperçu Certificat N° ${certNum}</span>
                            <span>Port-au-Prince, ${dateEmission}</span>
                        </div>

                    </div>
                </div>

            </div>
            
            <div style="background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                <button onclick="document.getElementById('certificatePreviewModal').remove()" style="padding: 10px 20px; font-weight: 600; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; pointer-events: auto; cursor: pointer; font-size: 0.85rem;" class="btn-hover-gray">Fermer la vue</button>
            </div>

        </div>

        <style>
            @keyframes modalSlideUp {
                from { transform: translateY(40px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .btn-hover-gray:hover {
                filter: brightness(0.95);
            }
        </style>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function printCertificateFrame() {
    const printArea = document.getElementById('printCertArea');
    if (!printArea) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showMessage("Veuillez autoriser les fenêtres contextuelles pour imprimer.", "error");
        return;
    }
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Certificat INFJ</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap');
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: #fff;
                    font-family: 'Inter', sans-serif;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    @page {
                        size: landscape;
                    }
                }
            </style>
        </head>
        <body>
            <div style="transform: scale(1.15); transform-origin: center;">
                ${printArea.outerHTML}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function scrollToCertificates() {
    const certSection = document.querySelector('.certificates-section');
    if (certSection) {
        certSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Export des fonctions pour utilisation globale
window.enrollCourse = enrollCourse
window.openCourse = openCourse
window.viewProgress = viewProgress
window.viewDetails = viewDetails
window.scrollToAvailable = scrollToAvailable
window.downloadCertificate = downloadCertificate
window.viewCertificate = viewCertificate
window.displayCourseVideos = displayCourseVideos
window.loadUserCertificates = loadUserCertificates
window.previewCertificatePopup = previewCertificatePopup
window.printCertificateFrame = printCertificateFrame
window.scrollToCertificates = scrollToCertificates
