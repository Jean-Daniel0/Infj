// Gestion de la page des vidéos
import { getCourseVideos } from './supabase-videos.js'
import { supabase, auth } from './supabase-config.js'
import { PAYMENT_CONFIG } from './config.js'

// État de l'application
let currentVideos = []
let currentCourseType = 'web'
let currentVideoUrl = ''

// Mapping des noms de cours vers les types
const courseTypeMap = {
    'web': 'Création de Site Web',
    'creation-site-web': 'Création de Site Web',
    'leadership': 'Leadership Organisationnel',
    'entrepreneuriat': 'Entrepreneuriat',
    'communication': 'Communication',
    'marketing': 'Marketing Digital',
    'dropshipping': 'Dropshipping'
}

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    // Récupérer le type de cours depuis l'URL
    const urlParams = new URLSearchParams(window.location.search)
    const courseType = urlParams.get('course') || 'web'
    
    currentCourseType = courseType
    
    // 1. Authentification de l'étudiant obligatoire
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
        window.location.href = `login.html?redirect=video.html?course=${courseType}`
        return
    }

    // 2. Chercher les informations de prix de ce cours vidéo dans la base de données
    let courseData = null
    try {
        const { data } = await supabase
            .from('cours_videos')
            .select('*')
            .eq('id', courseType)
            .maybeSingle()
        courseData = data
    } catch (e) {
        console.warn("Erreur de récupération thématique cours_videos :", e)
    }

    // 3. Bloquer l'accès si payant et non inscrit
    const isPaid = courseData && courseData.gratuit === false && Number(courseData.prix || 0) > 0
    if (isPaid) {
        try {
            const { data: enrollment } = await supabase
                .from('inscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('cours_video_id', courseType)
                .maybeSingle()

            if (!enrollment || enrollment.status !== 'acceptee') {
                displayLockedScreen(courseData, enrollment, user)
                return
            }
        } catch (err) {
            console.error("Erreur de vérification des droits :", err)
        }
    }

    // Mettre à jour le titre du cours
    await updateCourseHeader(courseType, courseData ? courseData.titre : '', courseData ? courseData.description : '')
    
    // Charger les vidéos
    loadVideos(courseType)
    
    // Configuration du bouton de déconnexion
    const logoutBtn = document.getElementById('logoutBtn')
    if (logoutBtn) {
        logoutBtn.style.display = 'block'
        logoutBtn.addEventListener('click', handleLogout)
    }
})

function displayLockedScreen(courseData, enrollment, user) {
    const loadingEl = document.getElementById('videosLoading')
    const containerEl = document.getElementById('videosContainer')
    if (loadingEl) loadingEl.style.display = 'none'
    if (containerEl) {
        containerEl.style.display = 'block'
        containerEl.style.maxWidth = '600px'
        containerEl.style.margin = '45px auto'
        
        let statusMessage = ""
        let showBuyForm = true

        if (enrollment) {
            if (enrollment.status === 'en_attente') {
                statusMessage = `
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #b45309; font-size: 0.9rem; line-height: 1.5; text-align: left;">
                        ⏳ <strong>Candidature en attente de validation administrative :</strong><br>
                        Vous avez soumis votre règlement de cours via <strong>${enrollment.methode_paiement}</strong> (Réf: ${enrollment.reference_paiement}). Notre équipe comptable valide les frais sous 24h à 48h afin d'activer votre accès. Veuillez patienter ou nous contacter au besoin.
                    </div>
                `
                showBuyForm = false
            } else if (enrollment.status === 'refusee') {
                statusMessage = `
                    <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #b91c1c; font-size: 0.9rem; line-height: 1.5; text-align: left;">
                        ❌ <strong>Votre paiement précédent n'a pas été validé :</strong><br>
                        Le versement indiqué n'a pas pu être recoupé par la comptabilité de l'INFJ. Veuillez soumettre à nouveau des détails de paiement valides.
                    </div>
                `
            }
        }

        const price = Number(courseData.prix || 0)
        
        containerEl.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; border-top: 6px solid #f47c20; padding: 40px 30px; text-align: center; font-family: 'Inter', sans-serif;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                <h3 style="color: #003366; font-size: 1.6rem; font-weight: 800; margin: 0 0 10px 0; font-family: 'Outfit', sans-serif;">Accès Premium Verrouillé</h3>
                <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin: 0 0 25px 0;">
                    Le cours vidéo certifiant <strong>${courseData.titre}</strong> fait partie de nos programmes payants. Accédez instantanément à toutes les sessions dès validation de vos frais académiques.<br>
                    Tarif du programme : <strong style="color: #f47c20;">${price.toLocaleString()} HTG</strong>
                </p>

                ${statusMessage}

                ${showBuyForm ? `
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: left; box-sizing: border-box;">
                        <h4 style="color: #003366; margin: 0 0 15px 0; font-size: 1.1rem; font-family: 'Outfit', sans-serif;">🛒 Activer mon accès par MonCash</h4>
                        
                        <form id="videoPurchaseForm" style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-weight: 600; color: #475569; font-size: 12px;">Prénom *</label>
                                    <input id="purchasePrenom" type="text" required placeholder="Votre prénom" style="padding: 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 14px;" value="${user.user_metadata?.prenom || ''}" />
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-weight: 600; color: #475569; font-size: 12px;">Nom de famille *</label>
                                    <input id="purchaseNom" type="text" required placeholder="Votre nom" style="padding: 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 14px;" value="${user.user_metadata?.nom || ''}" />
                                </div>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 600; color: #475569; font-size: 12px;">Téléphone / WhatsApp *</label>
                                <input id="purchasePhone" type="tel" required placeholder="Ex: +509 4634-1547" style="padding: 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 14px;" value="${user.user_metadata?.telephone || ''}" />
                            </div>

                            <!-- Input caché pour compatibilité JS -->
                            <input type="radio" name="video_pay_method" value="MonCashOnline" checked style="display: none;" />

                            <div id="video-instr-MonCashOnline" class="purchase-instr-box" style="display: block; font-size: 12px; color: #475569; padding: 15px; background: #ecfdf5; border-radius: 6px; line-height: 1.4; border-left: 3px solid #10b981;">
                                <strong>Paiement en ligne sécurisé par MonCash :</strong><br>
                                Entrez votre téléphone MonCash ci-dessous pour lancer la transaction.<br>
                                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
                                    <label style="font-weight: 600; font-size: 11px; color:#475569;">Numéro d'appel MonCash *</label>
                                    <input id="videoMoncashPhone" type="tel" placeholder="Ex: +509 4634-1547" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px;" />
                                </div>
                            </div>

                            <div id="purchaseFormFeedback" style="display: none; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: bold; text-align: center; margin-top: 5px;"></div>

                            <button type="submit" style="background: linear-gradient(135deg, #f47c20 0%, #ff6b35 100%); color: white; border: none; padding: 12px; border-radius: 30px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(244, 124, 32, 0.25); margin-top: 5px;">
                                Soumettre mon paiement pour activation
                            </button>
                        </form>
                    </div>
                ` : ''}

                <div style="margin-top: 25px;">
                    <a href="cours.html" style="color: #170e7c; font-weight: 700; text-decoration: none; font-size: 0.9rem; display: inline-block;">← Retourner au catalogue des cours</a>
                </div>
            </div>
        `

        // Attacher les gestionnaires des radios de paiement dans la page verrouillée
        if (showBuyForm) {
            const form = document.getElementById('videoPurchaseForm')
            form.addEventListener('submit', async (e) => {
                e.preventDefault()
                const feedback = document.getElementById('purchaseFormFeedback')
                feedback.style.display = 'none'

                const prenom = document.getElementById('purchasePrenom').value.trim()
                const nom = document.getElementById('purchaseNom').value.trim()
                const telephone = document.getElementById('purchasePhone').value.trim()
                const methodRadio = document.querySelector('input[name="video_pay_method"]:checked')
                
                if (!prenom || !nom || !telephone || !methodRadio) {
                    feedback.style.display = 'block'
                    feedback.style.background = '#fef2f2'
                    feedback.style.color = '#ef4444'
                    feedback.textContent = "Veuillez remplir tous les champs obligatoires."
                    return
                }

                const method = methodRadio.value
                let reference = ""
                let status = "en_attente"
                let dynamicSubmitMethod = 'MonCash (Manuel)'

                if (method === 'MonCashOnline') {
                    const onlinePhone = document.getElementById('videoMoncashPhone').value.trim()
                    if (!onlinePhone) {
                        feedback.style.display = 'block'
                        feedback.style.background = '#fef2f2'
                        feedback.style.color = '#ef4444'
                        feedback.textContent = "Veuillez saisir votre numéro de téléphone MonCash."
                        return
                    }

                    dynamicSubmitMethod = 'MonCash (En Ligne)'

                    try {
                        feedback.style.display = 'block'
                        feedback.style.background = '#eff6ff'
                        feedback.style.color = '#1d4ed8'
                        feedback.textContent = "Raccordement sécurisé MonCash en cours..."
                        
                        const response = await fetch('/api/bazik/pay-video', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                coursVideoId: courseData.id,
                                userId: user.id,
                                price: price
                            })
                        });
                        
                        const data = await response.json()
                        if (response.ok && data.redirectUrl) {
                            reference = data.referenceId
                            
                            // Enregistrer d'abord l'inscription en attente de paiement
                            const purchaseData = {
                                user_id: user.id,
                                cours_video_id: courseData.id,
                                nom: nom,
                                prenom: prenom,
                                email: user.email,
                                telephone: telephone,
                                motivation: "Achat dynamique en ligne de la mallette du cours : " + courseData.titre,
                                methode_paiement: 'MonCash (En Ligne)',
                                reference_paiement: reference,
                                montant_paye: price,
                                status: 'en_attente'
                            }
                            await supabase.from('inscriptions').insert([purchaseData])
                            
                            window.location.href = data.redirectUrl
                            return
                        } else {
                            throw new Error(data.error || "Clés d'API Bazik non configurées sur ce serveur ou transaction défaillante.")
                        }
                    } catch (apiErr) {
                        console.error("Échec du raccordement Bazik :", apiErr)
                        feedback.style.display = 'block'
                        feedback.style.background = '#fef2f2'
                        feedback.style.color = '#ef4444'
                        feedback.textContent = "Erreur de passerelle : " + (apiErr.text || apiErr.message || apiErr)
                        return
                    }
                }

                // Soumettre l'enregistrement
                try {
                    const purchaseData = {
                        user_id: user.id,
                        cours_video_id: courseData.id,
                        nom: nom,
                        prenom: prenom,
                        email: user.email,
                        telephone: telephone,
                        motivation: "Achat direct de la mallette thématique de cours vidéo : " + courseData.titre,
                        methode_paiement: dynamicSubmitMethod,
                        reference_paiement: reference,
                        montant_paye: price,
                        status: status
                    }

                    // On enregistre
                    const { error } = await supabase
                        .from('inscriptions')
                        .insert([purchaseData])

                    if (error) throw error

                    feedback.style.display = 'block'
                    feedback.style.background = '#f0fdf4'
                    feedback.style.color = '#15803d'
                    
                    if (status === 'acceptee') {
                        feedback.textContent = "Paiement agréé instantanément ! Ouverture du cours..."
                        setTimeout(() => {
                            window.location.reload()
                        }, 2500)
                    } else {
                        feedback.textContent = "Votre reçu de paiement a été soumis à la direction académique. Accès actif après approbation administrative."
                        setTimeout(() => {
                            window.location.href = "cours.html"
                        }, 4000)
                    }
                } catch (err) {
                    feedback.style.display = 'block'
                    feedback.style.background = '#fef2f2'
                    feedback.style.color = '#ef4444'
                    feedback.textContent = "Erreur de transmission : " + err.message
                }
            })
        }
    }
}

// Mettre à jour l'en-tête du cours
async function updateCourseHeader(courseType, customTitle = '', customDescription = '') {
    const courseTitle = document.getElementById('courseTitle')
    const courseDescription = document.getElementById('courseDescription')
    
    let courseName = customTitle || courseTypeMap[courseType]
    let desc = customDescription
    
    if (!courseName) {
        try {
            const { data, error } = await supabase
                .from('cours_videos')
                .select('*')
                .eq('id', courseType)
                .single()
            if (!error && data) {
                courseName = data.titre
                desc = desc || data.description
            }
        } catch (e) {
            console.warn("Erreur de récupération thématique cours_videos :", e)
        }
    }
    
    courseName = courseName || 'Formation'
    
    if (courseTitle) {
        courseTitle.textContent = courseName
    }
    
    if (courseDescription) {
        courseDescription.textContent = desc || `Vidéos du cours : ${courseName}`
    }
}

// Charger les vidéos du cours
async function loadVideos(courseType) {
    const loadingEl = document.getElementById('videosLoading')
    const errorEl = document.getElementById('videosError')
    const containerEl = document.getElementById('videosContainer')
    const emptyStateEl = document.getElementById('emptyState')
    
    try {
        // Afficher le chargement
        loadingEl.style.display = 'block'
        errorEl.style.display = 'none'
        containerEl.style.display = 'none'
        emptyStateEl.style.display = 'none'
        
        // Récupérer les vidéos
        const { videos, courseType: type, message, courseTitle, courseDescription } = await getCourseVideos(courseType)
        
        // Masquer le chargement
        loadingEl.style.display = 'none'
        
        if (!videos || videos.length === 0) {
            // Afficher l'état vide
            const emptyStateMessage = emptyStateEl?.querySelector('p')
            if (emptyStateMessage && message) {
                emptyStateMessage.textContent = message
            }
            emptyStateEl.style.display = 'block'
            return
        }
        
        currentVideos = videos
        await updateCourseHeader(courseType, courseTitle, courseDescription)

        // Afficher les vidéos
        displayVideos(videos)
        containerEl.style.display = 'grid'
        
    } catch (error) {
        console.error('Erreur lors du chargement des vidéos:', error)
        
        // Masquer le chargement
        loadingEl.style.display = 'none'
        
        // Afficher l'erreur avec plus de détails
        let errorMessage = error.message || 'Erreur lors du chargement des vidéos. Veuillez réessayer.'
        
        if (error.message && error.message.includes('Unauthorized')) {
            errorMessage = 'Erreur d\'authentification: accès non autorisé aux vidéos Supabase. Vérifiez les règles de Storage.'
        }
        
        errorEl.textContent = errorMessage
        errorEl.style.display = 'block'
    }
}

// Afficher les vidéos
function displayVideos(videos) {
    const container = document.getElementById('videosContainer')
    if (!container) return
    
    container.innerHTML = videos.map((video, index) => {
        // Utiliser l'URL de la miniature si disponible, sinon utiliser previewUrl ou thumbnailUrl
        const thumbnailSrc = video.thumbnailUrl || video.previewUrl || ''
        
        return `
        <div class="video-card" onclick="playVideo(${index})">
            <div class="video-thumbnail">
                ${thumbnailSrc 
                    ? `<img src="${thumbnailSrc}" alt="${video.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="play-icon" style="display:none;">▶</div>`
                    : `<div class="play-icon">▶</div>`
                }
                <div class="video-number">${index + 1}</div>
            </div>
            <div class="video-info">
                <h3>${video.title}</h3>
                <div class="video-meta">
                    ${video.duration ? `<span>⏱️ ${formatDuration(video.duration)}</span>` : ''}
                    ${video.views ? `<span>👁️ ${video.views} vues</span>` : ''}
                </div>
            </div>
        </div>
        `
    }).join('')
}

// Jouer une vidéo
function playVideo(index) {
    const video = currentVideos[index]
    if (!video) return
    
    const modal = document.getElementById('videoPlayerModal')
    const videoContainer = document.getElementById('videoPlayerContainer')
    
    // Nouveaux éléments de description split
    const themeTitle = document.getElementById('videoCourseThemeTitle')
    const customTitle = document.getElementById('videoPlayerTitleCustom')
    const customDescription = document.getElementById('videoPlayerDescriptionCustom')
    
    if (!modal || !videoContainer) return
    
    // Obtenir l'ID de la vidéo
    const videoId = video.id || video.guid || ''
    if (!videoId) {
        console.error('ID de vidéo non trouvé', video)
        videoContainer.innerHTML = '<p style="color: white; padding: 20px; text-align: center;">Erreur: ID de vidéo non trouvé</p>'
        modal.classList.add('active')
        return
    }
    
    const videoUrl = video.streamingUrl || video.publicUrl || video.url || ''
    currentVideoUrl = videoUrl

    console.log('Chargement vidéo:', { videoId, videoTitle: video.title, videoUrl, video })

    if (!videoUrl) {
        videoContainer.innerHTML = '<p style="color: white; padding: 20px; text-align: center;">Erreur: URL de vidéo non trouvée</p>'
        modal.classList.add('active')
        return
    }

    // Récupérer le nom de la thématique
    const themeName = courseTypeMap[currentCourseType] || 'Cours'
    if (themeTitle) {
        themeTitle.textContent = themeName
    }
    
    if (customTitle) {
        customTitle.textContent = video.title || 'Sans titre'
    }
    
    if (customDescription) {
        const descriptionText = video.description || video.details || 'Aucune description disponible pour cette partie du cours.'
        customDescription.textContent = descriptionText
    }

    // Créer le lecteur vidéo HTML5 avec le logo WEEL TECH et contrôles personnalisés
    videoContainer.innerHTML = `
        <div class="custom-video-wrapper" style="position: absolute; top:0; left:0; width:100%; height:100%; background: #000; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
            <!-- Élément vidéo standard -->
            <video id="customHtml5Video" src="${videoUrl}" autoplay style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: contain; cursor: pointer;"></video>
            
            <!-- Logo WEEL TECH en filigrane (Watermark) -->
            <div class="video-watermark" style="position: absolute; top: 18px; left: 18px; pointer-events: none; transition: opacity 0.3s; z-index: 10; display: flex; align-items: center; gap: 8px;">
                <img src="/images/weel_tech_logo.png" style="height: 38px; width: auto; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.75)); background: rgba(255,255,255,0.92); padding: 5px 10px; border-radius: 6px;" alt="WEEL TECH Logo">
            </div>

            <!-- Grand bouton central de lecture quand en pause -->
            <div id="videoCenterPlayOverlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); cursor: pointer; background: rgba(0, 51, 102, 0.9); width: 75px; height: 75px; border-radius: 50%; display: none; align-items: center; justify-content: center; color: white; font-size: 28px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.3); transition: all 0.2s; z-index: 11; user-select: none;">
                ▶
            </div>

            <!-- Barre de contrôle personnalisée -->
            <div id="customControlsBar" style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.65) 60%, transparent 100%); padding: 15px 20px; display: flex; flex-direction: column; gap: 10px; transition: opacity 0.35s ease-in-out; opacity: 1; z-index: 10;">
                
                <!-- Barre de progression -->
                <div id="customProgressContainer" style="position: relative; width: 100%; height: 7px; background: rgba(255,255,255,0.22); border-radius: 4px; cursor: pointer; transition: height 0.1s;">
                    <div id="customProgressBar" style="position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: linear-gradient(90deg, #f47c20 0%, #3b82f6 100%); border-radius: 4px;"></div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <!-- Bouton Play/Pause -->
                        <button id="customPlayPauseBtn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.1); transition: background 0.2s;" title="Play / Pause">
                            ⏸️
                        </button>
                        
                        <!-- Libellé temps écoulé / total -->
                        <span id="customTimeLabel" style="color: #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.6);">
                            0:00 / 0:00
                        </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 20px;">
                        <!-- Contrôle de volume -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button id="customMuteBtn" style="background: none; border: none; color: white; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center;" title="Muet">
                                🔊
                            </button>
                            <input type="range" id="customVolumeSlider" min="0" max="1" step="0.05" value="1" style="width: 70px; height: 4px; accent-color: #f47c20; cursor: pointer; outline: none; border: none; background: rgba(255,255,255,0.25);">
                        </div>

                        <!-- Plein écran -->
                        <button id="customFullscreenBtn" style="background: none; border: none; color: white; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.1); transition: background 0.2s;" title="Plein écran">
                            ⛶
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `

    // Configuration des gestionnaires d'évènements pour le lecteur personnalisé
    const wrapper = videoContainer.querySelector('.custom-video-wrapper')
    const videoEl = document.getElementById('customHtml5Video')
    const playPauseBtn = document.getElementById('customPlayPauseBtn')
    const centerOverlay = document.getElementById('videoCenterPlayOverlay')
    const controlsBar = document.getElementById('customControlsBar')
    const progressContainer = document.getElementById('customProgressContainer')
    const progressBar = document.getElementById('customProgressBar')
    const timeLabel = document.getElementById('customTimeLabel')
    const muteBtn = document.getElementById('customMuteBtn')
    const volumeSlider = document.getElementById('customVolumeSlider')
    const fullscreenBtn = document.getElementById('customFullscreenBtn')

    if (videoEl) {
        // Toggle play/pause
        const togglePlay = () => {
            if (videoEl.paused) {
                videoEl.play()
            } else {
                videoEl.pause()
            }
        }

        videoEl.addEventListener('click', togglePlay)
        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay)
        if (centerOverlay) centerOverlay.addEventListener('click', togglePlay)

        // Events de statut video
        videoEl.addEventListener('play', () => {
            if (playPauseBtn) playPauseBtn.textContent = '⏸️'
            if (centerOverlay) centerOverlay.style.display = 'none'
        })

        videoEl.addEventListener('pause', () => {
            if (playPauseBtn) playPauseBtn.textContent = '▶'
            if (centerOverlay) centerOverlay.style.display = 'flex'
        })

        // Formatage du chrono
        const formatTime = (time) => {
            const minutes = Math.floor(time / 60)
            const seconds = Math.floor(time % 60)
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
        }

        // Fin de la vidéo si c'est la dernière
        videoEl.addEventListener('ended', () => {
            console.log('Vidéo terminée !');
            if (index === currentVideos.length - 1) {
                console.log('Dernière vidéo du cours complétée.');
                const certContainer = document.getElementById('certificateClaimContainer');
                if (certContainer) {
                    certContainer.style.display = 'block';
                    certContainer.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

        // Progression de la vidéo
        videoEl.addEventListener('timeupdate', () => {
            if (videoEl.duration) {
                const percentage = (videoEl.currentTime / videoEl.duration) * 100
                if (progressBar) progressBar.style.width = `${percentage}%`
                if (timeLabel) {
                    timeLabel.textContent = `${formatTime(videoEl.currentTime)} / ${formatTime(videoEl.duration)}`
                }
            }
        })

        videoEl.addEventListener('loadedmetadata', () => {
            if (timeLabel) {
                timeLabel.textContent = `0:00 / ${formatTime(videoEl.duration)}`
            }
        })

        // Modier le temps en cliquant sur la barre
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const totalWidth = rect.width
                if (videoEl.duration) {
                    videoEl.currentTime = (clickX / totalWidth) * videoEl.duration
                }
            })
        }

        // Mute / Unmute
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                videoEl.muted = !videoEl.muted
                muteBtn.textContent = videoEl.muted ? '🔇' : '🔊'
                if (volumeSlider) {
                    volumeSlider.value = videoEl.muted ? 0 : videoEl.volume
                }
            })
        }

        // Reglage volume par slider
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value)
                videoEl.volume = vol
                videoEl.muted = vol === 0
                if (muteBtn) {
                    muteBtn.textContent = vol === 0 ? '🔇' : '🔊'
                }
            })
        }

        // Double-clic plein écran
        videoEl.addEventListener('dblclick', () => {
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen().catch(err => console.warn(err))
            } else {
                document.exitFullscreen()
            }
        })

        // Plein écran
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    wrapper.requestFullscreen().catch(err => {
                        console.warn(err)
                    })
                } else {
                    document.exitFullscreen()
                }
            })
        }

        // Gestion auto-hide de la barre de contrôle
        let controlsTimeout
        const showControls = () => {
            if (controlsBar) controlsBar.style.opacity = '1'
            clearTimeout(controlsTimeout)
            if (!videoEl.paused) {
                controlsTimeout = setTimeout(() => {
                    if (controlsBar) controlsBar.style.opacity = '0'
                }, 2500)
            }
        }

        if (wrapper) {
            wrapper.addEventListener('mousemove', showControls)
            wrapper.addEventListener('mouseleave', () => {
                if (!videoEl.paused && controlsBar) {
                    controlsBar.style.opacity = '0'
                }
            })
        }
    }
    
    // Afficher la modal
    modal.classList.add('active')
    
    // Rendre la playlist des autres modules juste en dessous du lecteur
    renderModalPlaylist(index)

    // Afficher ou masquer le conteneur de certification selon s'il s'agit de la dernière vidéo du cours
    const certContainer = document.getElementById('certificateClaimContainer');
    if (certContainer) {
        if (index === currentVideos.length - 1) {
            certContainer.style.display = 'block';
        } else {
            certContainer.style.display = 'none';
        }
    }
}

// Fonction de rendu de la playlist dynamique sous le lecteur dans la modal
function renderModalPlaylist(currentIndex) {
    const slider = document.getElementById('videoModalPlaylistSlider')
    if (!slider) return
    
    if (!currentVideos || currentVideos.length === 0) {
        slider.innerHTML = '<p style="color: #64748b; font-size: 0.82rem; padding: 10px;">Aucun autre module dans cette formation.</p>'
        return
    }
    
    slider.innerHTML = currentVideos.map((video, idx) => {
        const isCurrent = idx === currentIndex
        const thumbnailSrc = video.thumbnailUrl || video.previewUrl || ''
        const borderStyle = isCurrent ? 'border: 2px solid #f47c20; background: rgba(244, 124, 32, 0.15);' : 'border: 1px solid #1e293b; background: rgba(15, 23, 42, 0.6);'
        const opacityStyle = isCurrent ? 'opacity: 1;' : 'opacity: 0.7; cursor: pointer;'
        const durationText = video.duration ? formatDuration(video.duration) : ''
        
        return `
            <div onclick="window.playVideo(${idx})" class="modal-playlist-item" style="flex: 0 0 160px; width: 160px; border-radius: 8px; overflow: hidden; ${borderStyle} ${opacityStyle} transition: all 0.2s; display: flex; flex-direction: column; cursor: pointer;" title="Accéder au module : ${video.title || 'Partie ' + (idx + 1)}">
                <div style="position: relative; width: 100%; height: 90px; background: #000; overflow: hidden;">
                    ${thumbnailSrc 
                        ? `<img src="${thumbnailSrc}" alt="${video.title || 'Partie ' + (idx + 1)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div style="display:none; position: absolute; inset:0; align-items:center; justify-content:center; background: rgba(0,0,0,0.5); font-size: 1.1rem; color: white;">▶</div>`
                        : `<div style="display:flex; position: absolute; inset:0; align-items:center; justify-content:center; background: rgba(15, 23, 42, 0.8); font-size: 1.1rem; color: white;">▶</div>`
                    }
                    <div style="position: absolute; bottom: 4px; left: 6px; background: rgba(0,0,0,0.75); color: white; padding: 2px 5px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; font-family: monospace;">#${idx + 1}</div>
                    ${durationText ? `<div style="position: absolute; bottom: 4px; right: 6px; background: rgba(0,0,0,0.75); color: white; padding: 2px 5px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; font-family: monospace;">${durationText}</div>` : ''}
                </div>
                <div style="padding: 8px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; box-sizing: border-box; background: #0f172a;">
                    <h5 style="margin: 0; color: ${isCurrent ? '#f47c20' : '#e2e8f0'}; font-size: 0.75rem; font-weight: ${isCurrent ? '800' : '500'}; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 32px;" title="${video.title || 'Module ' + (idx + 1)}">
                        ${video.title || 'Module de cours'}
                    </h5>
                    ${isCurrent 
                        ? '<span style="font-size: 0.6rem; color: #f47c20; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">● LECTURE</span>' 
                        : '<span style="font-size: 0.6rem; color: #64748b; font-weight: 500; text-transform: uppercase;">Cliquez pour lire</span>'
                    }
                </div>
            </div>
        `
    }).join('')
}

// Fermer le lecteur vidéo
function closeVideoPlayer() {
    const modal = document.getElementById('videoPlayerModal')
    const videoContainer = document.getElementById('videoPlayerContainer')
    
    if (modal) {
        modal.classList.remove('active')
    }
    
    // Vider le conteneur pour arrêter la vidéo
    if (videoContainer) {
        videoContainer.innerHTML = ''
    }

    currentVideoUrl = ''
}

// Fermer avec la touche Échap
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeVideoPlayer()
    }
})

// Fermer en cliquant en dehors de la vidéo
document.getElementById('videoPlayerModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeVideoPlayer()
    }
})

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

// Exporter les fonctions pour utilisation globale
window.playVideo = playVideo
window.closeVideoPlayer = closeVideoPlayer

// Déconnexion locale (sans dépendre de auth.js)
async function handleLogout() {
    try {
        await auth.signOut()
    } catch (error) {
        console.error('Erreur de déconnexion:', error)
    } finally {
        localStorage.removeItem('user')
        sessionStorage.clear()
        window.location.href = 'login.html'
    }
}

window.handleLogout = handleLogout

// Récupérer ou créer automatique une inscription active pour la formation
async function getOrCreateInscriptionForCourse(user, courseType) {
    // 1. Chercher si l'étudiant a déjà une inscription active pour ce cours_video_id ou ce formation_id
    const { data: userInscriptions, error: insErr } = await supabase
        .from('inscriptions')
        .select(`
            *,
            formations (
                id,
                titre
            )
        `)
        .eq('user_id', user.id);
        
    if (!insErr && userInscriptions) {
        // Recherche exacte ou approximative par cours_video_id
        let found = userInscriptions.find(ins => ins.cours_video_id === courseType);
        if (found) return found;

        // Sinon recherche par titre de formation
        found = userInscriptions.find(ins => {
            const title = (ins.formations?.titre || '').toLowerCase();
            return title.includes(courseType.toLowerCase());
        });
        if (found) return found;
    }

    // 2. Si aucune inscription n'existe, on va chercher ou créer le cours id correspondant dans la table formations ou cours_videos
    let formationId = null;
    try {
        const { data: forms } = await supabase
            .from('formations')
            .select('id, titre');
        if (forms) {
            const match = forms.find(f => f.titre.toLowerCase().includes(courseType.toLowerCase()));
            if (match) {
                formationId = match.id;
            }
        }
    } catch (e) {
        console.warn("Erreur recherche correspondances formations :", e);
    }

    // Récupérer le nom dans le profil utilisateur public
    let studentNom = user.user_metadata?.nom || 'Étudiant';
    let studentPrenom = user.user_metadata?.prenom || '';
    
    try {
        const { data: profile } = await supabase
            .from('users')
            .select('nom, prenom')
            .eq('id', user.id)
            .maybeSingle();
        if (profile) {
            if (profile.nom) studentNom = profile.nom;
            if (profile.prenom) studentPrenom = profile.prenom;
        }
    } catch (e) {
        console.warn("Erreur profil utilisateur:", e);
    }

    const insData = {
        user_id: user.id,
        nom: studentNom,
        prenom: studentPrenom,
        email: user.email,
        status: 'acceptee',
        motivation: 'Génération automatique suite à la complétion du cours vidéo',
        methode_paiement: 'Génération Automatique',
        montant_paye: 0,
        cours_video_id: courseType
    };
    if (formationId) {
        insData.formation_id = formationId;
    }

    const { data: newIns, error: createErr } = await supabase
        .from('inscriptions')
        .insert([insData])
        .select()
        .single();

    if (createErr) {
        console.error("Impossible de créer l'inscription auto :", createErr);
        throw createErr;
    }
    return newIns;
}

// Réclamer le certificat par l'étudiant
async function claimCertificate() {
    const btn = document.getElementById('claimCertificateBtn');
    const spinner = document.getElementById('claimSpinner');
    const resultBox = document.getElementById('claimResult');
    
    if (!btn || !spinner || !resultBox) return;
    
    btn.style.display = 'none';
    spinner.style.display = 'flex';
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';
    
    try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
            throw new Error("Vous devez être connecté pour réclamer un certificat.");
        }
        
        // 1. Obtenir ou créer l'inscription
        spinner.querySelector('span').textContent = "Vérification de votre inscription...";
        const inscription = await getOrCreateInscriptionForCourse(user, currentCourseType);
        if (!inscription) {
            throw new Error("Impossible de lier votre compte à une inscription active pour ce cours.");
        }
        
        // 2. Vérifier s'il y a déjà un certificat émis pour l'une des inscriptions de cette formation
        spinner.querySelector('span').textContent = "Vérification des certificats existants...";
        
        const formationId = inscription.formation_id || inscription.course_id;
        if (formationId) {
            const { data: userInscriptions, error: uiErr } = await supabase
                .from('inscriptions')
                .select('id')
                .eq('user_id', user.id)
                .eq('formation_id', formationId);
                
            if (!uiErr && userInscriptions && userInscriptions.length > 0) {
                const insIds = userInscriptions.map(ui => ui.id);
                const { data: existingCerts } = await supabase
                    .from('certificats')
                    .select('*')
                    .in('inscription_id', insIds);
                    
                if (existingCerts && existingCerts.length > 0) {
                    // Un certificat existe déjà pour cette formation et cet utilisateur
                    spinner.style.display = 'none';
                    resultBox.style.display = 'block';
                    resultBox.innerHTML = `
                        <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.45); padding: 12px; border-radius: 8px; color: #93c5fd; font-size: 0.85rem; line-height: 1.45; text-align: center;">
                            👑 Vous possédez déjà un certificat officiel pour cette formation !<br>
                            <a href="${existingCerts[0].pdf_url}" target="_blank" style="display: inline-block; margin-top: 10px; background: #3b82f6; color: white; border-radius: 6px; padding: 6px 12px; font-weight: bold; text-decoration: none;">👁️ Voir mon certificat</a>
                        </div>
                    `;
                    return;
                }
            }
        }
        
        // 3. Pas de certificat trouvé, on va en générer un nouveau.
        // Créer l'iframe pour certificat-complet.html
        spinner.querySelector('span').textContent = "Chargement de la matrice du certificat...";
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:842px;height:595px;border:none;';
        iframe.src = '/certificat-complet.html';
        document.body.appendChild(iframe);
        
        await new Promise((resolve) => {
            iframe.onload = resolve;
        });
        
        let tries = 0;
        while ((!iframe.contentWindow || typeof iframe.contentWindow.lancerCertificat !== 'function') && tries < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tries++;
        }
        
        if (!iframe.contentWindow || typeof iframe.contentWindow.lancerCertificat !== 'function') {
            document.body.removeChild(iframe);
            throw new Error("L'initialisation de l'outil de certification a expiré.");
        }
        
        spinner.querySelector('span').textContent = "Génération de votre certificat officiel PDF...";
        const res = await iframe.contentWindow.lancerCertificat(inscription.id);
        document.body.removeChild(iframe);
        
        const pdfUrl = res.pdfUrl;
        const uniqueNumber = res.certId;
        
        spinner.style.display = 'none';
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
            <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.45); padding: 12px; border-radius: 8px; color: #86efac; font-size: 0.85rem; line-height: 1.45; text-align: center;">
                🎉 Félicitations ! Votre certificat d'aptitude professionnelle a été généré avec succès.<br>
                <strong style="color: #4ade80;">N° ${uniqueNumber}</strong><br>
                <a href="${pdfUrl}" target="_blank" style="display: inline-block; margin-top: 10px; background: #22c55e; color: white; border-radius: 6px; padding: 6px 12px; font-weight: bold; text-decoration: none;">⬇️ Télécharger mon certificat</a>
            </div>
        `;
        
        // Si la page contient une liste de certificats ou des éléments qui doivent recharger, on rafraîchit
        if (window.opener && typeof window.opener.loadUserCertificates === 'function') {
            window.opener.loadUserCertificates();
        }
    } catch (err) {
        console.error("Erreur réclamer certificat :", err);
        spinner.style.display = 'none';
        btn.style.display = 'block';
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.45); padding: 10px; border-radius: 6px; color: #fca5a5; font-size: 0.8rem; text-align: center;">
                ❌ Échec de la réclamation : ${err.message}
            </div>
        `;
    }
}

window.claimCertificate = claimCertificate
