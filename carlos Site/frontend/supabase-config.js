// Configuration Supabase
// Utilisation du CDN Supabase (chargé via script dans le HTML)
// Le script doit être chargé avant ce module : <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// Configuration Supabase
import { SUPABASE_CONFIG } from './config.js'

const supabaseUrl = SUPABASE_CONFIG.url
const supabaseAnonKey = SUPABASE_CONFIG.anonKey

// Créer le client Supabase en utilisant le CDN global
// Vérifier que supabase est disponible globalement
let supabaseClient

if (typeof window !== 'undefined' && window.supabase) {
  // Utiliser Supabase depuis le CDN global
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Fallback : attendre que Supabase soit chargé
  console.warn('Supabase CDN non chargé. Assurez-vous d\'inclure le script CDN dans le HTML.')
  // Créer un client mock pour éviter les erreurs
  supabaseClient = {
    auth: {
      signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase non initialisé. Chargez le CDN Supabase.' } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase non initialisé. Chargez le CDN Supabase.' } }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: null }, error: null })
    },
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase non initialisé' } }) }),
      update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
    })
  }
}

export const supabase = supabaseClient

if (typeof window !== 'undefined' && supabaseClient) {
  window.supabaseClient = supabaseClient
}

// Configuration des tables
export const TABLES = {
  FORMATIONS: 'formations',
  CONTACTS: 'contacts',
  INSCRIPTIONS: 'inscriptions',
  USERS: 'users'
}

// Fonctions utilitaires pour l'authentification
export const auth = {
  // Inscription d'un nouvel utilisateur
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Connexion d'un utilisateur
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Déconnexion
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error }
    }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { user, error }
    } catch (error) {
      return { user: null, error }
    }
  },

  // Écouter les changements d'authentification
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Fonctions pour les formations
export const formations = {
  // Récupérer toutes les formations
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TABLES.FORMATIONS)
        .select('*')
        .order('created_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Récupérer une formation par ID
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FORMATIONS)
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Créer une nouvelle formation (admin seulement)
  async create(formationData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FORMATIONS)
        .insert([formationData])
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Mettre à jour une formation (admin seulement)
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FORMATIONS)
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Supprimer une formation (admin seulement)
  async delete(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FORMATIONS)
        .delete()
        .eq('id', id)
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Fonctions pour les contacts
export const contacts = {
  // Envoyer un message de contact
  async sendMessage(contactData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTACTS)
        .insert([{
          ...contactData,
          created_at: new Date().toISOString(),
          status: 'nouveau'
        }])
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Récupérer tous les messages (admin seulement)
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTACTS)
        .select('*')
        .order('created_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Marquer un message comme lu (admin seulement)
  async markAsRead(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTACTS)
        .update({ status: 'lu' })
        .eq('id', id)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Fonctions pour les inscriptions
export const inscriptions = {
  // S'inscrire à une formation ou à un cours vidéo
  async register(formationId, userData, coursVideoId = null) {
    try {
      const insertPayload = {
        status: 'en_attente',
        ...userData,
        created_at: new Date().toISOString()
      }
      if (formationId) insertPayload.formation_id = formationId;
      if (coursVideoId) insertPayload.cours_video_id = coursVideoId;

      const { data, error } = await supabase
        .from(TABLES.INSCRIPTIONS)
        .insert([insertPayload])
        .select()
      
      if (!error && data && data.length > 0 && formationId) {
        // Décrémenter places_restantes après une inscription réussie à un cours classique
        try {
          const { data: formObj } = await supabase
            .from('formations')
            .select('places_restantes')
            .eq('id', formationId)
            .maybeSingle()
          
          if (formObj) {
            const currentRestantes = formObj.places_restantes !== null ? Number(formObj.places_restantes) : 0;
            const newRestantes = Math.max(0, currentRestantes - 1);
            await supabase
              .from('formations')
              .update({ places_restantes: newRestantes })
              .eq('id', formationId);
          }
        } catch (dbErr) {
          console.warn("Erreur de décrémentation des places restantes :", dbErr);
        }
      }

      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Récupérer les inscriptions d'un utilisateur
  async getUserInscriptions(userId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.INSCRIPTIONS)
        .select(`
          *,
          formations (
            id,
            titre,
            description,
            date_debut,
            date_fin,
            modules
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Récupérer toutes les inscriptions (admin seulement)
  async getAll() {
    try {
      const { data, error } = await supabase
        .from(TABLES.INSCRIPTIONS)
        .select(`
          *,
          formations (
            id,
            titre,
            description,
            duree,
            formateur_nom,
            formateur_role
          ),
          certificats (
            id,
            numero_certificat,
            pdf_url,
            date_emission
          )
        `)
        .order('created_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Mettre à jour le statut d'une inscription (admin seulement)
  async updateStatus(id, status) {
    try {
      const { data, error } = await supabase
        .from(TABLES.INSCRIPTIONS)
        .update({ status })
        .eq('id', id)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error }
    }
  }
}

// Fonctions utilitaires
export const utils = {
  // Vérifier si l'utilisateur est admin
  async isAdmin() {
    try {
      const { user } = await auth.getCurrentUser()
      if (!user) return false
      
      const adminEmails = ['mradmin@infj.com']
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        try {
          await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', user.id)
        } catch (e) {
          console.error('Erreur auto-promotion admin client:', e);
        }
        return true
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      
      return data?.role === 'admin'
    } catch (error) {
      return false
    }
  },

  // Gérer les erreurs
  handleError(error) {
    console.error('Supabase Error:', error)
    return {
      message: error.message || 'Une erreur est survenue',
      details: error.details || null
    }
  }
}

export default supabase
