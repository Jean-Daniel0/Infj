// Gestion du formulaire de contact avec Supabase
import { contacts } from './supabase-config.js'

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Récupérer les données du formulaire
            const formData = new FormData(form);
            const contactData = {
                nom: formData.get('nom'),
                email: formData.get('email'),
                telephone: formData.get('telephone') || null,
                sujet: formData.get('sujet') || null,
                message: formData.get('message')
            };
            
            // Validation basique
            if (!contactData.nom || !contactData.email || !contactData.message) {
                showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
                return;
            }
            
            // Validation email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactData.email)) {
                showMessage('Veuillez entrer une adresse email valide.', 'error');
                return;
            }
            
            try {
                // Désactiver le bouton et afficher le loading
                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Envoi en cours...';
                
                // Envoyer le message via Supabase
                const { data, error } = await contacts.sendMessage(contactData);
                
                if (error) {
                    throw error;
                }
                
                // Succès
                showMessage('Message envoyé avec succès ! Nous vous répondrons bientôt.', 'success');
                form.reset();
                
            } catch (error) {
                console.error('Erreur lors de l\'envoi du message:', error);
                showMessage('Erreur lors de l\'envoi du message. Veuillez réessayer.', 'error');
            } finally {
                // Réactiver le bouton
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

// Fonction pour afficher les messages
function showMessage(message, type = 'info') {
    // Créer ou mettre à jour l'élément de message
    let messageEl = document.getElementById('contactMessage');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'contactMessage';
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
        `;
        document.body.appendChild(messageEl);
    }

    // Définir le style selon le type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };

    messageEl.style.backgroundColor = colors[type] || colors.info;
    messageEl.textContent = message;

    // Auto-masquer après 5 secondes
    setTimeout(() => {
        if (messageEl && messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
} 