// Gestion du catalogue de formations dynamique
import { supabase } from './supabase-config.js'

document.addEventListener('DOMContentLoaded', async () => {
    await loadDynamicFormations();
    await loadDynamicVideoCourses();
});

async function loadDynamicVideoCourses() {
    const container = document.getElementById('videoCoursesGrid');
    if (!container) return;

    try {
        const { data: dbVideoCourses, error } = await supabase
            .from('cours_videos')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.warn("Table 'cours_videos' absente ou inadmissible. Les thématiques statiques par défaut s'affichent.");
            return;
        }

        if (dbVideoCourses && dbVideoCourses.length > 0) {
            const colors = ['orange', 'blue', 'green'];
            container.innerHTML = dbVideoCourses.map((course, index) => {
                const color = colors[index % 3];
                const title = course.titre || 'Cours Vidéo';
                const description = course.description || 'Découvrez nos enregistrements et modules d\'enseignement.';
                const slug = course.id;

                return `
                    <div class="premium-course-card ${color}-border">
                        <span class="course-badge" style="background: rgba(244, 124, 32, 0.1); color: #f47c20;">Vidéos</span>
                        <h3>${title}</h3>
                        <p>${description}</p>
                        <a href="video.html?course=${slug}" class="course-btn ${color}-btn" style="display: block; text-decoration: none; text-align: center; font-size: 0.9rem; font-weight: bold; padding: 10px 15px; border-radius: 25px;">
                            Visionner les cours
                        </a>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.warn('Erreur lors du chargement dynamique des thématiques de cours vidéo :', err);
    }
}

async function loadDynamicFormations() {
    const container = document.getElementById('premiumCoursesGrid');
    if (!container) return;

    try {
        // Charger les formations actives de la base de données Supabase
        const { data: dbFormations, error } = await supabase
            .from('formations')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Filtrer les formations non brouillonnes
        // (le statut de stockage est 'active' pour publiées, 'inactive' pour brouillon, 'completed' pour archivées)
        const visibleFormations = (dbFormations || []).filter(item => item.statut === 'active');

        if (visibleFormations.length > 0) {
            renderFormations(visibleFormations, container);
        } else {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; grid-column: 1 / -1; color: #64748b;">
                    <div style="font-size: 2.5rem; margin-bottom: 12px;">🏫</div>
                    <h3 style="color: #003366; margin: 0 0 6px 0; font-family: 'Outfit', sans-serif;">Aucun programme disponible</h3>
                    <p style="color: #64748b; font-size: 0.88rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">De nouveaux programmes de formation certifiants et de perfectionnement professionnel seront bientôt mis en ligne par l'INFJ.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Erreur lors du chargement des formations depuis Supabase:', err);
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; grid-column: 1 / -1; color: #e11d48;">
                <div style="font-size: 2.5rem; margin-bottom: 12px;">⚠️</div>
                <h3 style="color: #e11d48; margin: 0 0 6px 0; font-family: 'Outfit', sans-serif;">Indisponible temporairement</h3>
                <p style="color: #64748b; font-size: 0.88rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">Une erreur est survenue lors du chargement de l'offre académique. Veuillez recharger la page ou réessayer ultérieurement.</p>
            </div>
        `;
    }
}

// Rendu des formations de la base de données
function renderFormations(formationsList, container) {
    const colors = ['orange', 'blue', 'green'];
    
    container.innerHTML = formationsList.map((course, index) => {
        const color = colors[index % 3];
        const title = course.titre || 'Formation INFJ';
        const description = course.description || 'Développez vos compétences professionnelles avec nos formateurs.';
        
        // Gérer le cas où le bouton redirige soit vers le slug traditionnel soit vers l'ID UUID de Supabase
        let redirectArg = course.id;
        
        // Si le titre correspond à l'un des cours par défaut, on peut utiliser son slug traditionnel
        const titleLower = title.toLowerCase();
        if (titleLower.includes('leadership')) redirectArg = 'leadership';
        else if (titleLower.includes('entrepreneuriat')) redirectArg = 'entrepreneuriat';
        else if (titleLower.includes('communication')) redirectArg = 'communication';
        else if (titleLower.includes('marketing')) redirectArg = 'marketing';
        else if (titleLower.includes('site web') || titleLower.includes('création de site')) redirectArg = 'web';
        else if (titleLower.includes('dropshipping')) redirectArg = 'dropshipping';

        return `
            <div class="premium-course-card ${color}-border">
                <span class="course-badge">Préenregistré</span>
                <h3>🎓 ${title}</h3>
                <p>${description}</p>
                <button onclick="redirectToCourse('${redirectArg}')" class="course-btn ${color}-btn">
                    Accéder à la formation
                </button>
            </div>
        `;
    }).join('');
}

// Exposer globalement si besoin
window.loadDynamicFormations = loadDynamicFormations;
