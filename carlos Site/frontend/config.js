// Configuration Supabase - Clés de production
export const SUPABASE_CONFIG = {
  url: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://nnppbnqavajmublpfhkj.supabase.co',
  anonKey: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_kYqjUg-ftxahv35qUaDdpA_CMkJdwL-'
}

// Configuration Supabase Storage pour les videos
export const SUPABASE_STORAGE = {
  bucket: 'cours',
  public: true,
  signedUrlExpiresIn: 3600
}

// Configuration de l'application
export const APP_CONFIG = {
  name: 'Institut National de Formation des Jeunes',
  version: '1.0.0',
  email: {
    from: 'noreply@infj.com',
    to: 'institutnationaldfj@gmail.com'
  }
}

// Configuration de la passerelle de paiement MonCash (sans citer de nom commercial)
export const PAYMENT_CONFIG = {
  // Clés API pour l'intégration automatique (Laisser vide pour activer la simulation locale)
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_BAZIK_API_KEY || import.meta.env.VITE_MONCASH_API_KEY)) || '',
  apiUrl: (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_BAZIK_API_URL || import.meta.env.VITE_MONCASH_API_URL)) || 'https://api.ebazik.io/v1/payments',
  // Numéro de transfert de secours (pour le mode manuel)
  manualPhone: '+509 4634-1547',
  manualReceiver: 'Me Robertho Carlos Deronceray'
}
