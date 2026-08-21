import { jsPDF } from 'jspdf'
import { supabase, utils, inscriptions, contacts, auth } from './supabase-config.js'
import { SUPABASE_STORAGE } from './config.js'
import { getCourseVideos } from './supabase-videos.js'

const form = document.getElementById('videoUploadForm')
const courseSelect = document.getElementById('courseSelect')
const uploadMessage = document.getElementById('uploadMessage')
const adminAuthMessage = document.getElementById('adminAuthMessage')
const refreshListBtn = document.getElementById('refreshListBtn')
const courseVideosList = document.getElementById('courseVideosList')

let COURSE_LABELS = {
  web: 'Création de Site Web',
  leadership: 'Leadership Organisationnel',
  entrepreneuriat: 'Entrepreneuriat',
  communication: 'Communication',
  marketing: 'Marketing Digital',
  dropshipping: 'Dropshipping'
}

const loadAllVideoCourses = async () => {
  try {
    const { data, error } = await supabase
      .from('cours_videos')
      .select('*')
      .order('created_at', { ascending: true })
      
    if (error) {
      console.warn("Table 'cours_videos' absente ou inaccessible. Utilisation des thématiques par défaut.");
      if (courseSelect) {
        courseSelect.innerHTML = Object.entries(COURSE_LABELS).map(([id, titre]) => `<option value="${id}">${titre}</option>`).join('')
      }
      return
    }

    if (data && data.length > 0) {
      // Re-init COURSE_LABELS dynamically
      COURSE_LABELS = {}
      data.forEach(item => {
        COURSE_LABELS[item.id] = item.titre
      })
      if (courseSelect) {
        courseSelect.innerHTML = data.map(item => `<option value="${item.id}">${item.titre}</option>`).join('')
      }
    } else {
      if (courseSelect) {
        courseSelect.innerHTML = Object.entries(COURSE_LABELS).map(([id, titre]) => `<option value="${id}">${titre}</option>`).join('')
      }
    }
  } catch (err) {
    console.warn("Erreur d'initialisation dynamique de la liste des cours vidéos :", err)
    if (courseSelect) {
      courseSelect.innerHTML = Object.entries(COURSE_LABELS).map(([id, titre]) => `<option value="${id}">${titre}</option>`).join('')
    }
  }
}

// Configuration du formulaire de création de cours vidéo thématique
document.addEventListener('DOMContentLoaded', () => {
  const createForm = document.getElementById('createCourseVideoForm')
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const title = document.getElementById('newCourseTitle').value.trim()
      const desc = document.getElementById('newCourseDescription').value.trim()
      const prixVal = parseFloat(document.getElementById('newCoursePrix')?.value || '0')
      const gratuit = prixVal <= 0
      const messageEl = document.getElementById('createCourseMessage')

      if (!title || !desc) return

      const editId = document.getElementById('editCourseVideoId') ? document.getElementById('editCourseVideoId').value.trim() : ''
      const id = editId || slugify(title)

      try {
        if (messageEl) {
          messageEl.textContent = 'Enregistrement de la nouvelle thématique...'
          messageEl.className = 'admin-message info'
          messageEl.style.display = 'block'
        }

        let dbResult;
        if (editId) {
          dbResult = await supabase
            .from('cours_videos')
            .update({ titre: title, description: desc, prix: prixVal, gratuit: gratuit })
            .eq('id', editId)
        } else {
          dbResult = await supabase
            .from('cours_videos')
            .insert([{ id, titre: title, description: desc, prix: prixVal, gratuit: gratuit }])
        }

        if (dbResult.error) throw dbResult.error

        if (messageEl) {
          messageEl.textContent = editId ? 'Thématique de cours vidéo modifiée avec succès !' : 'Thématique de cours vidéo créée avec succès !'
          messageEl.className = 'admin-message success'
          messageEl.style.display = 'block'
        }

        // Réinitialiser les champs et le mode d'édition
        document.getElementById('newCourseTitle').value = ''
        document.getElementById('newCourseDescription').value = ''
        if (document.getElementById('newCoursePrix')) document.getElementById('newCoursePrix').value = '0'
        const editIdInput = document.getElementById('editCourseVideoId')
        if (editIdInput) editIdInput.value = ''

        const submitBtn = document.getElementById('submitCourseVideoBtn')
        if (submitBtn) {
          submitBtn.innerHTML = '➕ Créer la thématique de cours'
          submitBtn.style.backgroundColor = '#003366'
        }
        const cancelBtn = document.getElementById('cancelEditCourseVideoBtn')
        if (cancelBtn) cancelBtn.style.display = 'none'

        // Recharger le select et la table
        await loadAllVideoCourses()
        if (typeof loadAllVideoCoursesTable === 'function') {
          await loadAllVideoCoursesTable()
        }

        // Sélectionner le nouveau cours créé (uniquement en cas d'insertion)
        if (courseSelect && !editId) {
          courseSelect.value = id
          loadCourseVideos()
        }
      } catch (err) {
        console.error(err)
        if (messageEl) {
          messageEl.textContent = `Erreur : ${err.message}`
          messageEl.className = 'admin-message error'
          messageEl.style.display = 'block'
        }
      }
    })
  }

  // Gestion de l'upload de photo de couverture de formation
  const imageUploadBtn = document.getElementById('formationImageUploadBtn')
  const imageFileInput = document.getElementById('formationImageFile')
  const imageUrlInput = document.getElementById('formationImageUrl')
  const uploadProgress = document.getElementById('formationImageUploadProgress')

  if (imageUploadBtn && imageFileInput && imageUrlInput) {
    imageUploadBtn.addEventListener('click', async () => {
      const file = imageFileInput.files[0]
      if (!file) {
        alert('Veuillez sélectionner un fichier image à uploader.')
        return
      }

      if (uploadProgress) {
        uploadProgress.textContent = "Téléchargement de l'image en cours..."
        uploadProgress.style.color = '#3b82f6'
        uploadProgress.style.display = 'block'
      }

      try {
        const bucket = 'cours'
        const ext = file.name.split('.').pop()
        const uniqueFileName = `covers/cover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`

        const { error } = await supabase.storage
          .from(bucket)
          .upload(uniqueFileName, file, { 
            upsert: true, 
            contentType: file.type || 'image/jpeg' 
          })

        if (error) throw error

        const { data: storageUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uniqueFileName)

        const publicUrl = storageUrlData?.publicUrl || ''
        imageUrlInput.value = publicUrl
        
        if (uploadProgress) {
          uploadProgress.textContent = "✅ Image importée et assignée avec succès !"
          uploadProgress.style.color = '#10b981'
        }
      } catch (err) {
        console.error(err)
        if (uploadProgress) {
          uploadProgress.textContent = `❌ Erreur lors du téléchargement : ${err.message}`
          uploadProgress.style.color = '#ef4444'
        }
      }
    })
  }

  // Gestion de l'upload de la signature du formateur
  const sigFormateurBtn = document.getElementById('formationFormateurSigUploadBtn')
  const sigFormateurFile = document.getElementById('formationFormateurSigFile')
  const sigFormateurUrlInput = document.getElementById('formationFormateurSigUrl')
  const sigFormateurProgress = document.getElementById('formationFormateurSigProgress')

  if (sigFormateurBtn && sigFormateurFile && sigFormateurUrlInput) {
    sigFormateurBtn.addEventListener('click', async () => {
      const file = sigFormateurFile.files[0]
      if (!file) {
        alert('Veuillez sélectionner un fichier image pour la signature du formateur.')
        return
      }

      if (sigFormateurProgress) {
        sigFormateurProgress.textContent = "Téléchargement de la signature du formateur..."
        sigFormateurProgress.style.color = '#3b82f6'
        sigFormateurProgress.style.display = 'block'
      }

      try {
        const bucket = 'cours'
        const ext = file.name.split('.').pop()
        const uniqueFileName = `signatures/sig-formateur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`

        const { error } = await supabase.storage
          .from(bucket)
          .upload(uniqueFileName, file, { 
            upsert: true, 
            contentType: file.type || 'image/png' 
          })

        if (error) throw error

        const { data: storageUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uniqueFileName)

        const publicUrl = storageUrlData?.publicUrl || ''
        sigFormateurUrlInput.value = publicUrl
        
        if (sigFormateurProgress) {
          sigFormateurProgress.textContent = "✅ Signature formateur téléversée avec succès !"
          sigFormateurProgress.style.color = '#10b981'
        }
      } catch (err) {
        console.error(err)
        if (sigFormateurProgress) {
          sigFormateurProgress.textContent = `❌ Erreur : ${err.message}`
          sigFormateurProgress.style.color = '#ef4444'
        }
      }
    })
  }

  // La signature du directeur fondateur est désormais fixe et permanente
  // (voir /images/signature_directeur.png) — plus de champ d'upload admin pour celle-ci.
  // Seule la signature du formateur reste configurable à la création d'une formation.
})

const loadAllFormationsToSelect = async () => {
  try {
    const { data, error } = await supabase
      .from('formations')
      .select('id, titre')
      .order('titre', { ascending: true })
      
    if (error) throw error
    if (data && data.length > 0) {
      data.forEach(item => {
        COURSE_LABELS[item.id] = item.titre
      })
      // NOT overwriting courseSelect, as video courses are separate categories!
    }
  } catch (err) {
    console.warn("Erreur d'initialisation dynamique de la liste des cours :", err)
  }
}

// Fonction globale d'onglets pour le catalogue et la création de formation
window.switchFormationSubTab = (subTab) => {
  const tabList = document.getElementById('formationListContainer')
  const tabCreate = document.getElementById('formationFormContainer')
  const tabVideo = document.getElementById('videoCoursesContainer')
  const btnList = document.getElementById('subTabListBtn')
  const btnCreate = document.getElementById('subTabCreateBtn')
  const btnVideo = document.getElementById('subTabVideoBtn')

  if (subTab === 'list') {
    if (tabList) tabList.style.display = 'block'
    if (tabCreate) tabCreate.style.display = 'none'
    if (tabVideo) tabVideo.style.display = 'none'
    if (btnList) {
      btnList.style.borderBottom = '3px solid #003366'
      btnList.style.color = '#003366'
      btnList.classList.add('active')
    }
    if (btnCreate) {
      btnCreate.style.borderBottom = '3px solid transparent'
      btnCreate.style.color = '#64748b'
      btnCreate.classList.remove('active')
    }
    if (btnVideo) {
      btnVideo.style.borderBottom = '3px solid transparent'
      btnVideo.style.color = '#64748b'
      btnVideo.classList.remove('active')
    }
  } else if (subTab === 'create') {
    if (tabList) tabList.style.display = 'none'
    if (tabCreate) tabCreate.style.display = 'block'
    if (tabVideo) tabVideo.style.display = 'none'
    if (btnList) {
      btnList.style.borderBottom = '3px solid transparent'
      btnList.style.color = '#64748b'
      btnList.classList.remove('active')
    }
    if (btnCreate) {
      btnCreate.style.borderBottom = '3px solid #003366'
      btnCreate.style.color = '#003366'
      btnCreate.classList.add('active')
    }
    if (btnVideo) {
      btnVideo.style.borderBottom = '3px solid transparent'
      btnVideo.style.color = '#64748b'
      btnVideo.classList.remove('active')
    }
  } else if (subTab === 'videoCourses') {
    if (tabList) tabList.style.display = 'none'
    if (tabCreate) tabCreate.style.display = 'none'
    if (tabVideo) tabVideo.style.display = 'block'
    if (btnList) {
      btnList.style.borderBottom = '3px solid transparent'
      btnList.style.color = '#64748b'
      btnList.classList.remove('active')
    }
    if (btnCreate) {
      btnCreate.style.borderBottom = '3px solid transparent'
      btnCreate.style.color = '#64748b'
      btnCreate.classList.remove('active')
    }
    if (btnVideo) {
      btnVideo.style.borderBottom = '3px solid #003366'
      btnVideo.style.color = '#003366'
      btnVideo.classList.add('active')
    }
    loadAllVideoCoursesTable()
  }
}

const loadAllVideoCoursesTable = async () => {
  const container = document.getElementById('videoCoursesListTableBody')
  if (!container) return
  container.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chargement des formations vidéo...</td></tr>'

  try {
    const { data, error } = await supabase
      .from('cours_videos')
      .select('*')
      .order('created_at', { ascending: true })
      
    if (error) throw error

    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 25px; color: #64748b;">Aucune formation vidéo dans le catalogue. Créez-en une en remplissant le formulaire ci-dessus !</td></tr>'
      return
    }

    container.innerHTML = data.map(item => {
      const slug = item.id
      const title = item.titre || 'Sans titre'
      const description = item.description || 'Sans description'
      const isFree = item.gratuit !== false && (item.prix === undefined || Number(item.prix) === 0)
      const priceStr = isFree ? '<span style="color:#22c55e; font-weight:700;">Gratuit</span>' : `<span style="color:#f47c20; font-weight:700;">${Number(item.prix).toLocaleString()} HTG</span>`
      
      return `
        <tr>
          <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">${slug}</code></td>
          <td style="font-weight: 600; color: #003366;">${title}</td>
          <td style="color: #475569; font-size: 0.85rem; max-width: 320px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${description}</td>
          <td>${priceStr}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="admin-btn primary btn-sm" style="padding: 4px 8px; font-size: 11px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.startEditCourseVideo('${slug}', '${title.replace(/'/g, "\\'")}', '${description.replace(/'/g, "\\'")}', ${item.prix || 0})">✏️ Modifier</button>
              <button class="admin-btn danger btn-sm" style="padding: 4px 8px; font-size: 11px; background: #ef4444;" onclick="window.deleteCourseVideo('${slug}')">🗑️ Supprimer</button>
            </div>
          </td>
        </tr>
      `
    }).join('')
  } catch (err) {
    console.warn("Erreur lors du chargement de la table des thématiques:", err)
    container.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Impossible de charger la liste. Veuillez vous assurer que la table "cours_videos" existe.</td></tr>'
  }
}

window.deleteCourseVideo = async (id) => {
  if (!confirm(`Attention: En supprimant la thématique "${id}", celle-ci n'apparaîtra plus sur le portail d'apprentissage. Voulez-vous continuer ?`)) return

  try {
    const { error } = await supabase
      .from('cours_videos')
      .delete()
      .eq('id', id)

    if (error) throw error

    alert("Thématique de cours vidéo supprimée avec succès !")
    await loadAllVideoCoursesTable()
    await loadAllVideoCourses()
    loadCourseVideos()
  } catch (err) {
    alert("Erreur de suppression : " + err.message)
  }
}

window.startEditCourseVideo = (id, titre, description, prix) => {
  const newCourseTitle = document.getElementById('newCourseTitle')
  const newCourseDesc = document.getElementById('newCourseDescription')
  const newCoursePrix = document.getElementById('newCoursePrix')
  const editIdInput = document.getElementById('editCourseVideoId')
  const submitBtn = document.getElementById('submitCourseVideoBtn')
  const cancelBtn = document.getElementById('cancelEditCourseVideoBtn')

  if (newCourseTitle) newCourseTitle.value = titre || ''
  if (newCourseDesc) newCourseDesc.value = description || ''
  if (newCoursePrix) newCoursePrix.value = prix !== undefined ? prix : '0'
  if (editIdInput) editIdInput.value = id || ''

  if (submitBtn) {
    submitBtn.innerHTML = '💾 Enregistrer les modifications'
    submitBtn.style.backgroundColor = '#10b981'
  }
  if (cancelBtn) cancelBtn.style.display = 'inline-block'

  const formEl = document.getElementById('createCourseVideoForm')
  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' })
}

window.cancelEditCourseVideo = () => {
  const newCourseTitle = document.getElementById('newCourseTitle')
  const newCourseDesc = document.getElementById('newCourseDescription')
  const editIdInput = document.getElementById('editCourseVideoId')
  const submitBtn = document.getElementById('submitCourseVideoBtn')
  const cancelBtn = document.getElementById('cancelEditCourseVideoBtn')

  if (newCourseTitle) newCourseTitle.value = ''
  if (newCourseDesc) newCourseDesc.value = ''
  if (editIdInput) editIdInput.value = ''

  if (submitBtn) {
    submitBtn.innerHTML = '➕ Créer la thématique de cours'
    submitBtn.style.backgroundColor = '#003366'
  }
  if (cancelBtn) cancelBtn.style.display = 'none'
}

const showMessage = (text, type = 'info') => {
  if (!uploadMessage) return
  uploadMessage.textContent = text
  uploadMessage.className = `admin-message ${type}`
  uploadMessage.style.display = 'block'
}

const setAuthMessage = (text) => {
  if (!adminAuthMessage) return
  adminAuthMessage.textContent = text
  adminAuthMessage.style.display = 'block'
}

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const ensureExtension = (fileName, file) => {
  const extension = file?.name?.split('.').pop()
  if (!extension) return fileName
  if (fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    return fileName
  }
  return `${fileName}.${extension}`
}

const toTwoDigits = (value) => String(value).padStart(2, '0')

const getManifest = async (bucket, folder) => {
  const manifestPath = `${folder}/manifest.json`
  const { data } = await supabase.storage.from(bucket).download(manifestPath)
  if (!data) return { courseTitle: COURSE_LABELS[folder] || '', courseDescription: '', videos: [] }

  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return {
      courseTitle: parsed.courseTitle || COURSE_LABELS[folder] || '',
      courseDescription: parsed.courseDescription || '',
      videos: Array.isArray(parsed.videos) ? parsed.videos : []
    }
  } catch (error) {
    return { courseTitle: COURSE_LABELS[folder] || '', courseDescription: '', videos: [] }
  }
}

const uploadManifest = async (bucket, folder, manifest) => {
  const payload = JSON.stringify(manifest, null, 2)
  const { error } = await supabase.storage
    .from(bucket)
    .upload(`${folder}/manifest.json`, payload, {
      contentType: 'application/json',
      upsert: true
    })

  if (error) {
    throw error
  }
}

const uploadFile = async (bucket, path, file, contentType) => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType })

  if (error) {
    throw error
  }
}

window.loadVideoToForm = (title, description, order, filename) => {
  if (document.getElementById('videoTitle')) document.getElementById('videoTitle').value = title || ''
  if (document.getElementById('videoDescription')) document.getElementById('videoDescription').value = description || ''
  if (document.getElementById('videoOrder')) document.getElementById('videoOrder').value = order || '1'
  if (document.getElementById('videoFileName')) document.getElementById('videoFileName').value = filename || ''
  
  const uploadMsg = document.getElementById('uploadMessage')
  if (uploadMsg) {
    uploadMsg.textContent = `📋 Les détails de la vidéo "${title}" ont été chargés ci-dessus. Modifiez les champs, puis cliquez sur "Téléverser et publier" pour mettre à jour.`
    uploadMsg.className = "admin-message info"
    uploadMsg.style.display = 'block'
  }
}

window.deleteIndividualVideo = async (courseType, fileId, title) => {
  if (!confirm(`⚠️ Attention: Voulez-vous vraiment supprimer définitivement la vidéo "${title}" du cours "${courseType}" ? Cela retirera l'entrée du programme et supprimera le fichier vidéo associé.`)) return

  try {
    const uploadMsg = document.getElementById('uploadMessage')
    if (uploadMsg) {
      uploadMsg.textContent = "Suppression de la vidéo en cours..."
      uploadMsg.className = "admin-message info"
      uploadMsg.style.display = 'block'
    }

    const bucket = SUPABASE_STORAGE?.bucket || 'cours'
    const folder = courseType
    
    // 1. Charger et mettre à jour le manifest.json
    const manifest = await getManifest(bucket, folder)
    const filename = fileId.split('/').pop()
    
    // Trouver l'entrée de la vidéo pour voir s'il y a une miniature à supprimer également
    const videoEntry = manifest.videos.find(v => v.file === filename)
    const filesToRemove = [fileId]
    
    if (videoEntry && videoEntry.thumbnail && !videoEntry.thumbnail.startsWith('http://') && !videoEntry.thumbnail.startsWith('https://') && !videoEntry.thumbnail.startsWith('data:')) {
      filesToRemove.push(`${folder}/${videoEntry.thumbnail}`)
    }
    
    // Filtrer la vidéo du manifest
    manifest.videos = manifest.videos.filter(v => v.file !== filename)
    await uploadManifest(bucket, folder, manifest)
    
    // 2. Supprimer les fichiers physiques dans Supabase Storage
    const { error: removeErr } = await supabase.storage
      .from(bucket)
      .remove(filesToRemove)
      
    if (removeErr) {
      console.warn("Retrait physique partiel ou impossible, mais l'entrée du catalogue est supprimée :", removeErr)
    }

    if (uploadMsg) {
      uploadMsg.textContent = `✅ Vidéo "${title}" supprimée avec succès.`
      uploadMsg.className = "admin-message success"
    }
    
    alert(`La vidéo "${title}" a été supprimée du programme.`);
    await loadCourseVideos()
  } catch (err) {
    alert("Erreur de suppression de la vidéo : " + err.message)
    console.error(err)
  }
}

const loadCourseVideos = async () => {
  if (!courseVideosList) return
  courseVideosList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #64748b;"><p>Chargement des vidéos en cours...</p></div>'

  try {
    const courseType = courseSelect.value
    const { videos } = await getCourseVideos(courseType)

    if (!videos || videos.length === 0) {
      courseVideosList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; color: #64748b;"><p style="font-weight: 500; margin-bottom: 4px;">Aucune vidéo de cours enregistrée</p><p style="font-size: 0.8rem; color: #94a3b8;">Pour ce domaine d\'apprentissage, publiez une première vidéo en utilisant le formulaire ci-dessus.</p></div>'
      return
    }

    courseVideosList.innerHTML = videos
      .map(
        (video) => {
          const filename = video.id.split('/').pop()
          const sanitizedTitle = (video.title || 'Sans titre').replace(/'/g, "\\'").replace(/"/g, '&quot;')
          const sanitizedDesc = (video.description || 'Aucune description').replace(/'/g, "\\'").replace(/"/g, '&quot;')
          const thumbUrl = video.thumbnailUrl || ''

          return `
            <div class="video-list-item" style="display: flex; flex-direction: column; height: 100%; border: 1px solid #e2e8f0; justify-content: space-between; overflow: hidden; padding: 0;">
              
              <!-- Miniature de la vidéo -->
              <div style="position: relative; width: 100%; height: 140px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${thumbUrl ? `
                  <img src="${thumbUrl}" alt="${video.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                ` : ''}
                <div class="video-thumb-fallback" style="display: ${thumbUrl ? 'none' : 'flex'}; position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: rgba(255,255,255,0.7); flex-direction: column; align-items: center; justify-content: center; gap: 6px;">
                  <span style="font-size: 28px;">▶️</span>
                  <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Cours interactif</span>
                </div>
                
                <!-- Badge d'ordre -->
                <span style="position: absolute; top: 12px; right: 12px; background: #f47c20; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                  Ch. ${video.order || 'N/A'}
                </span>
              </div>

              <!-- Titre et Descriptif -->
              <div style="padding: 18px; flex-grow: 1; display: flex; flex-direction: column; gap: 8px;">
                <h4 style="margin: 0; color: #003366; font-size: 1rem; line-height: 1.35; font-weight: 700;">${video.title || 'Sans titre'}</h4>
                <p style="margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.45; word-break: break-word;">
                  ${video.description || 'Aucune description thématique de support disponible.'}
                </p>
                <div style="margin-top: auto; padding-top: 10px; border-top: 1px dashed #f1f5f9; display: flex; flex-direction: column; gap: 4px;">
                  <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace; word-break: break-all;">
                    📁 Fichier: <strong>${filename}</strong>
                  </span>
                </div>
              </div>

              <!-- Panel d'actions d'administration -->
              <div style="padding: 12px 18px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; gap: 6px; justify-content: flex-end;">
                <a href="${video.streamingUrl}" target="_blank" class="admin-btn" style="padding: 6px 10px; font-size: 0.75rem; background: #003366; color: white !important; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px;" title="Tester le visionnage de la vidéo">
                  🎬 Visionner
                </a>
                <button type="button" class="admin-btn secondary" style="padding: 6px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px;" onclick="window.loadVideoToForm('${sanitizedTitle}', '${sanitizedDesc}', '${video.order || 1}', '${filename}')" title="Modifier les détails de la vidéo">
                  ✏️ Éditer
                </button>
                <button type="button" class="admin-btn danger" style="padding: 6px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; background: #ef4444; color: white !important; border: none; cursor: pointer;" onclick="window.deleteIndividualVideo('${courseType}', '${video.id}', '${sanitizedTitle}')" title="Supprimer définitivement la vidéo">
                  🗑️ Retirer
                </button>
              </div>

            </div>
          `
        }
      )
      .join('')
  } catch (error) {
    courseVideosList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #ef4444;"><p>Impossible de charger la liste des chapitres. Contactez le support.</p></div>'
    console.error(error)
  }
}

const checkAdmin = async () => {
  const isAdmin = await utils.isAdmin()
  if (!isAdmin) {
    setAuthMessage("Accès sécurisé réservé uniquement aux comptes administrateurs de l'INFJ.")
    if (form) form.style.display = 'none'
  }
}

if (courseSelect) {
  courseSelect.addEventListener('change', loadCourseVideos)
}

if (refreshListBtn) {
  refreshListBtn.addEventListener('click', loadCourseVideos)
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    showMessage('Publication et téléversement en cours...', 'info')

    try {
      const bucket = SUPABASE_STORAGE?.bucket || 'cours'
      const courseType = courseSelect.value
      const folder = courseType

      const title = document.getElementById('videoTitle').value.trim()
      const description = document.getElementById('videoDescription').value.trim()
      const order = document.getElementById('videoOrder').value
      let customFileName = document.getElementById('videoFileName').value.trim()

      const videoFile = document.getElementById('videoFile').files[0]
      const thumbnailFile = document.getElementById('thumbnailFile').files[0]

      // Si pas de fichier vidéo et pas de nom de fichier choisi pour la modif externe, on émet une erreur
      if (!videoFile && !customFileName) {
        showMessage("Veuillez sélectionner un fichier vidéo à uploader, ou renseigner le 'Nom du fichier cible' exact pour faire une modification de détails.", 'error')
        return
      }

      let finalName = ''
      if (videoFile) {
        const baseName = customFileName
          ? customFileName.replace(/\s+/g, '-').toLowerCase()
          : `${order ? toTwoDigits(order) + '-' : ''}${slugify(title) || 'video'}`
        finalName = ensureExtension(baseName, videoFile)
        
        const videoPath = `${folder}/${finalName}`
        showMessage('Téléversement du fichier vidéo interactif...', 'info')
        await uploadFile(bucket, videoPath, videoFile, videoFile.type || 'video/mp4')
      } else {
        // En mode édition pure sans fichier
        finalName = customFileName
      }

      let thumbnailName = ''
      if (thumbnailFile) {
        showMessage('Téléversement de la miniature de garde...', 'info')
        const thumbBase = `${finalName.replace(/\.[^.]+$/, '')}-thumb`
        const thumbFinal = ensureExtension(thumbBase, thumbnailFile)
        thumbnailName = thumbFinal
        const thumbPath = `${folder}/${thumbFinal}`
        await uploadFile(bucket, thumbPath, thumbnailFile, thumbnailFile.type || 'image/jpeg')
      }

      // Récupérer le manifest, et modifier ou insérer l'entrée
      const manifest = await getManifest(bucket, folder)
      const existingIndex = manifest.videos.findIndex((video) => video.file === finalName)
      
      const payload = {
        file: finalName,
        title,
        description,
        order: order ? Number(order) : undefined,
        category: folder
      }

      if (thumbnailName) {
        payload.thumbnail = thumbnailName
      } else if (existingIndex >= 0 && manifest.videos[existingIndex].thumbnail) {
        // Conserver l'ancienne si présente en mode édition
        payload.thumbnail = manifest.videos[existingIndex].thumbnail
      }

      if (existingIndex >= 0) {
        manifest.videos[existingIndex] = { ...manifest.videos[existingIndex], ...payload }
      } else {
        manifest.videos.push(payload)
      }

      showMessage('Actualisation du programme du cours...', 'info')
      await uploadManifest(bucket, folder, manifest)

      showMessage('Vidéo répertoriée et publiée avec succès !', 'success')
      form.reset()
      loadCourseVideos()
    } catch (error) {
      console.error(error)
      showMessage(error.message || 'Erreur lors de la publication.', 'error')
    }
  })
}

/* COUPLAGE AVEC LES NOUVELLES TABLES SUPABASE */

// Assurer l'existence du bucket certificats - rappel informatif uniquement pour éviter les erreurs 400 en console client
const ensureCertificatesBucketExists = async () => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.log("Note de configuration : Assurez-vous de créer les buckets publics 'cours' et 'certificats' dans votre tableau de bord Supabase Storage.");
      return
    }
    const bucketExists = buckets && buckets.some(b => b.id === 'certificats')
    if (!bucketExists) {
      console.info("💡 Bucket 'certificats' manquant. Veuillez le créer en mode public dans votre console Supabase.")
    }
  } catch (err) {
    // Sourdine des avertissements bruyants
  }
}
ensureCertificatesBucketExists()

// Assurer l'existence du bucket cours - rappel informatif
const ensureCoursBucketExists = async () => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      return
    }
    const bucketExists = buckets && buckets.some(b => b.id === 'cours')
    if (!bucketExists) {
      console.info("💡 Bucket 'cours' manquant. Veuillez le créer en mode public dans votre console Supabase.")
    }
  } catch (err) {
    // Sourdine
  }
}
ensureCoursBucketExists()

// Onglet : Gestion des Formations (Partie 2)
const loadAllFormationsData = async () => {
  const container = document.getElementById('formationsListTableBody')
  if (!container) return
  container.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chargement du catalogue de formations...</td></tr>'

  try {
    const { data, error } = await supabase
      .from('formations')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) throw error

    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 25px; color: #64748b;">Aucune formation dans le catalogue. Créez-en une ci-dessus !</td></tr>'
      return
    }

    container.innerHTML = data.map(item => {
      // Extraire les métadonnées sérialisées dans le JSONB 'modules'
      const meta = (typeof item.modules === 'object' && item.modules) ? item.modules : {}
      const formateurNom = meta.formateur_nom || 'Non spécifié'
      const formateurRole = meta.formateur_role || ''
      const statusLabel = meta.status_label || (item.statut === 'active' ? 'publiée' : item.statut === 'completed' ? 'archivée' : 'brouillon')

      let displayStatus = 'Brouillon'
      let labelClass = 'en_attente' // orange/gris
      if (statusLabel === 'publiée' || item.statut === 'active') {
        displayStatus = 'Actif / Publié'
        labelClass = 'lu' // vert
      } else if (statusLabel === 'fini') {
        displayStatus = '🏁 Fini'
        labelClass = 'nouveau' // rouge/orange
      } else if (statusLabel === 'archivée' || item.statut === 'completed') {
        displayStatus = 'Archivé'
        labelClass = 'nouveau' // rouge
      }

      const dateDeb = item.date_debut ? new Date(item.date_debut).toLocaleDateString('fr-FR') : 'Non définie'
      const dateF = item.date_fin ? new Date(item.date_fin).toLocaleDateString('fr-FR') : 'Non définie'

      const displayPrice = item.prix && Number(item.prix) > 0 ? `${Number(item.prix).toLocaleString('fr-FR')} HTG` : 'Gratuit'
      const inscritsCount = item.places_max - item.places_restantes
      const seatsText = `${inscritsCount} inscrits / ${item.places_max} places`

      // Actions rapides de changement de statut
      let statusActionBtn = ''
      if (statusLabel === 'brouillon' || item.statut === 'inactive') {
        statusActionBtn = `<button class="admin-btn success btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #22c55e;" onclick="window.updateFormationStatus('${item.id}', 'publiée')">🚀 Publier</button>`
      } else if (statusLabel === 'publiée' || item.statut === 'active') {
        statusActionBtn = `
          <button class="admin-btn warning btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #d97706; color: white;" onclick="window.updateFormationStatus('${item.id}', 'fini')">🏁 Déclarer fini</button>
          <button class="admin-btn secondary btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #64748b; color: white;" onclick="window.updateFormationStatus('${item.id}', 'archivée')">📥 Archiver</button>
        `
      } else if (statusLabel === 'fini') {
        statusActionBtn = `<button class="admin-btn success btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #10b981; color: white;" onclick="window.updateFormationStatus('${item.id}', 'publiée')">🔄 Relancer</button>`
      } else if (statusLabel === 'archivée' || item.statut === 'completed') {
        statusActionBtn = `<button class="admin-btn success btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #22c55e;" onclick="window.updateFormationStatus('${item.id}', 'publiée')">🔄 Relancer</button>`
      }

      const actionButtons = `
        ${statusActionBtn}
        <button class="admin-btn info btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #003366; color: white;" onclick="window.viewFormationParticipants('${item.id}', '${item.titre.replace(/'/g, "\\'")}')">👥 Participants</button>
        <button class="admin-btn secondary btn-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="window.editFormationCourse('${item.id}')">✏️ Modifier</button>
        <button class="admin-btn danger btn-sm" style="padding: 4px 8px; font-size: 11px;" onclick="window.deleteFormationCourse('${item.id}')">🗑️ Supprimer</button>
      `

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #003366; font-size: 13.5px; cursor: pointer;" onclick="window.viewFormationParticipants('${item.id}', '${item.titre.replace(/'/g, "\\'")}')" title="Cliquer pour voir les participants">🎓 ${item.titre}</div>
            <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">Formateur : <strong>${formateurNom}</strong> (${formateurRole})</div>
            <div style="font-size: 11px; color: #64748b; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${item.description || ''}">${item.description || 'Pas de description'}</div>
          </td>
          <td>
            <div style="font-size: 12px; font-weight: 600;">⏱️ ${item.duree || 'N/A'}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Du ${dateDeb} au ${dateF}</div>
          </td>
          <td>
            <div style="font-size: 12.5px; font-weight: 700; color: #e28743;">💰 ${displayPrice}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;"><strong>${seatsText}</strong></div>
            <button class="admin-btn info btn-sm" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 10px; margin-top: 6px; background: #f1f5f9; color: #003366; border: 1px solid rgba(0, 51, 102, 0.15); border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onclick="window.viewFormationParticipants('${item.id}', '${item.titre.replace(/'/g, "\\'")}')" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
              👥 Gérer les élèves
            </button>
          </td>
          <td>
            <span class="badge ${labelClass}">${displayStatus}</span>
          </td>
          <td>${actionButtons}</td>
        </tr>
      `
    }).join('')
  } catch (err) {
    console.error(err)
    container.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #de3a49; font-weight:700;">Impossible de charger le catalogue : ${err.message}</td></tr>`
  }
}

// Soumission du formulaire de création/modification de formation (Partie 2)
const courseCreateForm = document.getElementById('courseCreateForm')
if (courseCreateForm) {
  courseCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const msgEl = document.getElementById('formationMessage')
    if (msgEl) {
      msgEl.textContent = "Traitement en cours..."
      msgEl.className = "admin-message info"
      msgEl.style.display = "block"
    }

    try {
      const id = document.getElementById('formationIdEdit').value.trim()
      const title = document.getElementById('formationTitle').value.trim()
      const formateurNom = document.getElementById('formationFormateurNom').value.trim()
      const formateurRole = document.getElementById('formationFormateurRole').value.trim()
      const duree = document.getElementById('formationDuree').value.trim()
      const dateDebut = document.getElementById('formationDateDebut').value
      const dateFin = document.getElementById('formationDateFin').value
      const prix = parseFloat(document.getElementById('formationPrix').value || '0')
      const placesMax = parseInt(document.getElementById('formationPlacesMax').value || '50')
      const imageUrl = document.getElementById('formationImageUrl').value.trim()
      const statusLabel = document.getElementById('formationStatut').value
      const descCourte = document.getElementById('formationDescCourte').value.trim()
      const descLongue = document.getElementById('formationDescLongue').value.trim()

      const formateurSigUrl = document.getElementById('formationFormateurSigUrl') ? document.getElementById('formationFormateurSigUrl').value.trim() : ''
      // La signature du directeur n'est plus configurable ici : elle est fixe (voir certificat-complet.html)

      // Mappage du statut de stockage
      let statutDb = 'active'
      if (statusLabel === 'brouillon') statutDb = 'inactive'
      if (statusLabel === 'archivée') statutDb = 'completed'
      if (statusLabel === 'fini') statutDb = 'completed'

      // Structure JSONB pour le champ modules
      const metadataModules = {
        description_longue: descLongue,
        formateur_nom: formateurNom,
        formateur_role: formateurRole,
        image_couverture: imageUrl,
        status_label: statusLabel,
        formateur_signature: formateurSigUrl
      }

      const payload = {
        titre: title,
        description: descCourte,
        duree: duree,
        modalite: 'En ligne',
        prix: prix,
        gratuit: prix === 0,
        date_debut: new Date(dateDebut).toISOString(),
        date_fin: new Date(dateFin).toISOString(),
        places_max: placesMax,
        places_restantes: placesMax,
        statut: statutDb,
        modules: metadataModules,
        formateur_nom: formateurNom,
        formateur_role: formateurRole,
        description_longue: descLongue,
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      }

      if (id) {
        // En mode modification, préserver les places restantes ou les recalculer
        const { data: existingCourse } = await supabase.from('formations').select('places_max, places_restantes').eq('id', id).single()
        if (existingCourse) {
          const delta = placesMax - existingCourse.places_max
          payload.places_restantes = Math.max(0, existingCourse.places_restantes + delta)
        }
        
        const { error } = await supabase.from('formations').update(payload).eq('id', id)
        if (error) throw error
        if (msgEl) {
          msgEl.textContent = "Formation modifiée avec succès dans le catalogue !"
          msgEl.className = "admin-message success"
        }
      } else {
        const { data: insertedData, error } = await supabase.from('formations').insert([payload]).select()
        if (error) throw error
        
        let newCourseId = null
        if (insertedData && insertedData[0]) {
          newCourseId = insertedData[0].id
        }

        // Création automatique du dossier de stockage Supabase pour ce cours en chargeant un manifest.json initial
        if (newCourseId) {
          try {
            const bucket = SUPABASE_STORAGE?.bucket || 'cours'
            const initialManifest = {
              courseTitle: title,
              courseDescription: descCourte || '',
              videos: []
            }
            await uploadManifest(bucket, newCourseId, initialManifest)
            console.log(`Dossier de stockage initialisé avec succès pour la formation '${title}' (${newCourseId})`)
          } catch (storageErr) {
            console.warn("Erreur d'initialisation du dossier de stockage de la formation :", storageErr)
          }
        }

        if (msgEl) {
          msgEl.textContent = "Nouvelle formation ajoutée avec succès !"
          msgEl.className = "admin-message success"
        }
      }

      courseCreateForm.reset()
      document.getElementById('formationIdEdit').value = ""
      document.getElementById('formationFormTitle').textContent = "Créer un nouveau programme"
      document.getElementById('formationSubmitBtn').textContent = "💾 Publier le programme"
      document.getElementById('formationCancelEditBtn').style.display = "none"

      setTimeout(() => {
        if (msgEl) msgEl.style.display = 'none'
      }, 4000)

      await loadAllFormationsToSelect()
      loadAllFormationsData()
      
      // Retour automatique sur l'onglet de la liste des formations
      window.switchFormationSubTab('list')
    } catch (err) {
      console.error(err)
      if (msgEl) {
        msgEl.textContent = "Erreur de traitement : " + err.message
        msgEl.className = "admin-message error"
      }
    }
  })
}

// Modifier une formation (Pré-remplissage)
window.editFormationCourse = async (id) => {
  try {
    const { data: item, error } = await supabase.from('formations').select('*').eq('id', id).single()
    if (error) throw error

    document.getElementById('formationIdEdit').value = item.id
    document.getElementById('formationTitle').value = item.titre || ''
    
    const meta = (typeof item.modules === 'object' && item.modules) ? item.modules : {}
    document.getElementById('formationFormateurNom').value = meta.formateur_nom || ''
    document.getElementById('formationFormateurRole').value = meta.formateur_role || ''
    document.getElementById('formationDuree').value = item.duree || ''
    
    if (item.date_debut) {
      document.getElementById('formationDateDebut').value = item.date_debut.split('T')[0]
    }
    if (item.date_fin) {
      document.getElementById('formationDateFin').value = item.date_fin.split('T')[0]
    }
    
    document.getElementById('formationPrix').value = item.prix || 0
    document.getElementById('formationPlacesMax').value = item.places_max || 50
    document.getElementById('formationImageUrl').value = meta.image_couverture || ''
    
    // Pre-fill signature du formateur si elle existe (le directeur est désormais fixe)
    if (document.getElementById('formationFormateurSigUrl')) {
      document.getElementById('formationFormateurSigUrl').value = meta.formateur_signature || ''
    }

    // Reset upload progresses
    const formateurSigProgress = document.getElementById('formationFormateurSigProgress')
    if (formateurSigProgress) formateurSigProgress.style.display = 'none'
    const coverProgress = document.getElementById('formationImageUploadProgress')
    if (coverProgress) coverProgress.style.display = 'none'

    document.getElementById('formationStatut').value = meta.status_label || (item.statut === 'active' ? 'publiée' : item.statut === 'completed' ? 'archivée' : 'brouillon')
    document.getElementById('formationDescCourte').value = item.description || ''
    document.getElementById('formationDescLongue').value = meta.description_longue || ''

    document.getElementById('formationFormTitle').textContent = "Modifier le programme"
    document.getElementById('formationSubmitBtn').textContent = "💾 Mettre à jour"
    document.getElementById('formationCancelEditBtn').style.display = "inline-block"

    // Basculer sur le sous-onglet du formulaire de modification
    window.switchFormationSubTab('create')

    // Remonter en haut de l'onglet
    document.getElementById('formationsTab').scrollIntoView({ behavior: 'smooth' })
  } catch (err) {
    alert("Impossible de charger les données : " + err.message)
  }
}

// Annuler la modification
const cancelEditBtn = document.getElementById('formationCancelEditBtn')
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    if (courseCreateForm) courseCreateForm.reset()
    document.getElementById('formationIdEdit').value = ""
    document.getElementById('formationFormTitle').textContent = "Créer un nouveau programme"
    document.getElementById('formationSubmitBtn').textContent = "💾 Publier le programme"
    cancelEditBtn.style.display = "none"
    
    const formateurSigProgress = document.getElementById('formationFormateurSigProgress')
    if (formateurSigProgress) formateurSigProgress.style.display = 'none'
    const coverProgress = document.getElementById('formationImageUploadProgress')
    if (coverProgress) coverProgress.style.display = 'none'

    window.switchFormationSubTab('list')
  })
}

// Supprimer une formation
window.deleteFormationCourse = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer définitivement cette formation du catalogue ? Les inscriptions correspondantes seront également affectées.")) return

  try {
    const { error } = await supabase.from('formations').delete().eq('id', id)
    if (error) throw error
    alert("La formation a été retirée du catalogue d'apprentissage.")
    loadAllFormationsData()
  } catch (err) {
    alert("Erreur de suppression : " + err.message)
  }
}

// Generer et Enregistrer les Certificats (Partie 3)
window.certifyAndCompleteInscription = async (inscriptionId, studentName, courseTitle, duration, formateurNom, formateurRole) => {
  if (!confirm(`Souhaitez-vous certifier d'aptitude professionnelle ${studentName} pour la formation ${courseTitle} ? Un certificat officiel PDF unique sera immédiatement généré.`)) return

  try {
    // 1. INSERT dans completions
    console.log("[Admin Certifier] Consultation & Insertion dans la table completions pour l'inscription :", inscriptionId);
    
    // Obtenir l'inscription pour être sûr d'avoir formation_id et email
    const { data: inscription, error: fetchErr } = await supabase
      .from('inscriptions')
      .select('formation_id, email, prenom, nom')
      .eq('id', inscriptionId)
      .single();

    if (fetchErr) throw fetchErr;

    const formationId = inscription.formation_id || inscription.course_id;

    // Tenter d'insérer dans completions s'il n'existe pas déjà
    const { data: existingCompl, error: checkComplErr } = await supabase
      .from('completions')
      .select('id')
      .eq('inscription_id', inscriptionId)
      .eq('formation_id', formationId)
      .maybeSingle();

    if (!existingCompl) {
      const { error: complErr } = await supabase
        .from('completions')
        .insert([{
          inscription_id: inscriptionId,
          formation_id: formationId,
          completed_at: new Date().toISOString()
        }]);

      if (complErr) {
        console.warn("L'insertion dans la table completions a renvoyé :", complErr.message);
      }
    } else {
      console.log("[Admin Certifier] Une entrée dans completions existe déjà pour cette inscription/formation.");
    }

    // 2. Création et chargement du module certificat-complet.html via un iframe masqué
    console.log("[Admin Certifier] Chargement du générateur de certificats officiel...");
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:842px;height:595px;border:none;';
    iframe.src = '/certificat-complet.html';
    document.body.appendChild(iframe);

    // Attendre le chargement complet de l'iframe
    await new Promise((resolve) => {
      iframe.onload = resolve;
    });

    // Attendre la présence et la définition de la fonction globale lancerCertificat sur l'iframe
    let tries = 0;
    while ((!iframe.contentWindow || typeof iframe.contentWindow.lancerCertificat !== 'function') && tries < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      tries++;
    }

    if (!iframe.contentWindow || typeof iframe.contentWindow.lancerCertificat !== 'function') {
      document.body.removeChild(iframe);
      throw new Error("L'initialisation du générateur de certificats dans l'iframe a expiré ou a échoué (lancerCertificat introuvable).");
    }

    // 3. Appel de lancerCertificat de l'iframe pour générer, uploader, et enregistrer
    console.log("[Admin Certifier] Déclenchement de la génération haut de gamme via lancerCertificat...");
    const res = await iframe.contentWindow.lancerCertificat(inscriptionId);
    
    // Nettoyer l'iframe masqué immédiatement
    document.body.removeChild(iframe);

    const pdfUrl = res.pdfUrl;
    const uniqueNumber = res.certId;

    if (res.isDuplicate) {
      alert(`Certificat existant récupéré !\nCet étudiant possède déjà le certificat ${uniqueNumber} pour cette formation. Aucun doublon n'a été créé.\n\nLien d'accès public :\n${pdfUrl}`);
      loadAllInscriptionsData();
      if (window.lastViewedFormationId) {
        loadAllFormationsData();
      }
      return;
    }

    // 4. Envoyer le certificat par email via notre endpoint full-stack API
    console.log("[Admin Certifier] Envoi automatique de l'e-mail avec le lien PDF...");
    const emailToUse = inscription.email;
    let emailStatusMessage = "";
    
    try {
      const emailResponse = await fetch('/api/send-certificate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentName: studentName,
          courseTitle: courseTitle,
          pdfUrl: pdfUrl,
          email: emailToUse
        })
      });

      const emailResult = await emailResponse.json();
      console.log("[Admin Certifier] Résultat de l'appel d'envoi d'e-mail :", emailResult);

      if (emailResponse.ok && emailResult.success) {
        if (emailResult.service === "Simulated") {
          emailStatusMessage = `\n\n⚠️ IMPORTANT : L'envoi par e-mail a été SIMULÉ car la clé d'API 'RESEND_API_KEY' n'est pas configurée dans l'environnement de votre site. Veuillez ajouter la variable d'environnement RESEND_API_KEY dans votre configurateur pour envoyer de vrais e-mails.`;
        } else {
          emailStatusMessage = `\n\n📧 Un e-mail officiel contenant le certificat PDF a été envoyé avec succès à l'apprenant (${emailToUse}).`;
        }
      } else {
        const errorMsg = emailResult.error || "Erreur de transmission Resend.";
        emailStatusMessage = `\n\n❌ ÉCHEC DE L'ENVOI DE L'EMAIL : ${errorMsg}\nCependant, le certificat a bien été généré et sauvegardé. Veuillez vérifier votre clé d'API 'RESEND_API_KEY' et vous assurer que votre domaine expéditeur (academie@infj.site) est vérifié dans votre compte Resend.`;
      }
    } catch (msgErr) {
      console.error("[Admin Certifier] Échec lors de la communication avec l'API d'e-mail :", msgErr);
      emailStatusMessage = `\n\n⚠️ Impossible de contacter le service d'e-mail (${msgErr.message}). Mais le certificat a été enregistré avec succès.`;
    }

    // Déclencher le téléchargement local immédiat pour l'administrateur
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.download = `Certificat-${studentName.replace(/\s+/g, '-')}-${uniqueNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Félicitations !\nLe certificat d'aptitude professionnelle ${uniqueNumber} a été généré avec succès dans le Cloud et enregistré en base de données.\n\nLien d'accès public :\n${pdfUrl}${emailStatusMessage}`);
    
    loadAllInscriptionsData();
    if (window.lastViewedFormationId) {
      loadAllFormationsData();
    }
  } catch (err) {
    console.error("Erreur de certification complète :", err);
    alert("Impossible de compléter la certification : " + err.message);
  }
}

// Onglet 2 : Inscriptions des étudiants
const loadAllInscriptionsData = async () => {
  const container = document.getElementById('inscriptionsTableBody')
  if (!container) return
  container.innerHTML = '<tr><td colspan="6" style="text-align:center;">Chargement en cours des candidatures...</td></tr>'

  try {
    const { data, error } = await inscriptions.getAll()
    if (error) throw error

    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 25px; color: #64748b;">Aucune demande de formation enregistrée.</td></tr>'
      return
    }

    container.innerHTML = data.map(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Inconnue'

      const relationCourse = item.formations || {}
      const meta = (typeof relationCourse.modules === 'object' && relationCourse.modules) ? relationCourse.modules : {}
      const formateurNom = relationCourse.formateur_nom || meta.formateur_nom || 'Jean-Daniel Michel'
      const formateurRole = relationCourse.formateur_role || meta.formateur_role || 'Formateur d\'Aptitude'
      const duration = relationCourse.duree || '30 heures'

      let displayStatus = 'En attente'
      let badgeClass = 'en_attente'
      if (item.status === 'acceptee') {
        if (item.certificat_emission) {
          displayStatus = 'Certifié ✔'
          badgeClass = 'lu'
        } else {
          displayStatus = 'Acceptée'
          badgeClass = 'lu'
        }
      } else if (item.status === 'refusee') {
        displayStatus = 'Refusée'
        badgeClass = 'nouveau'
      } else if (item.status === 'annulee') {
        displayStatus = 'Annulée'
        badgeClass = 'nouveau'
      }

      const statusBadge = `<span class="badge ${badgeClass}">${displayStatus}</span>`
      
      let actionButtons = ''
      if (item.status === 'en_attente') {
        actionButtons = `
          <button class="admin-btn success btn-sm" style="padding: 6px 12px; font-size: 11px; margin-right: 6px;" onclick="window.updateInscriptionStatus('${item.id}', 'acceptee')">Approuver</button>
          <button class="admin-btn danger btn-sm" style="padding: 6px 12px; font-size: 11px;" onclick="window.updateInscriptionStatus('${item.id}', 'refusee')">Décliner</button>
        `
      } else if (item.status === 'acceptee' && !item.certificat_emission) {
        const courseTitleSafe = (relationCourse.titre || item.formation || 'Diplôme INFJ').replace(/'/g, "\\'")
        const studentNameSafe = `${item.prenom || ''} ${item.nom || ''}`.replace(/'/g, "\\'")
        const formateurSafe = formateurNom.replace(/'/g, "\\'")
        const roleSafe = formateurRole.replace(/'/g, "\\'")
        const durationSafe = duration.replace(/'/g, "\\'")

        actionButtons = `
          <button class="admin-btn btn-sm" style="padding: 6px 12px; font-size: 11px; background: #e28743;" onclick="window.certifyAndCompleteInscription('${item.id}', '${studentNameSafe}', '${courseTitleSafe}', '${durationSafe}', '${formateurSafe}', '${roleSafe}')">
            📜 Marquer comme diplômé(e)
          </button>
        `
      } else {
        actionButtons = `<span style="color:#64748b; font-size:11px; font-weight:700;">Traité ✔</span>`
      }

      // Parcourir les informations de motivation étendues
      let displayedMotivation = item.motivation || 'Pas de note fournie'
      let extendedDetails = ''
      if (displayedMotivation.includes('|')) {
        const parts = displayedMotivation.split('|')
        displayedMotivation = parts[0].replace('Motivation:', '').trim()
        const extraList = parts.slice(1).map(p => {
          const innerParts = p.split(':')
          if (innerParts.length >= 2) {
            const label = innerParts[0].trim()
            const val = innerParts.slice(1).join(':').trim()
            return `<div><strong>${label} :</strong> ${val}</div>`
          }
          return `<div>${p}</div>`
        }).join('')
        
        extendedDetails = `
          <div style="font-size: 10.5px; border-top: 1px dashed #cbd5e1; margin-top: 6px; padding-top: 4px; color: #475569;">
            ${extraList}
          </div>
        `
      }

      let paymentHtml = '';
      if (item.methode_paiement) {
        paymentHtml = `
          <div style="font-size: 11px; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 10px; margin-top: 6px; display: block; max-width: 220px; line-height: 1.4;">
            <strong>💳 Paiement : ${item.methode_paiement}</strong>
            ${item.montant_paye ? `<br>Montant : <strong>${Number(item.montant_paye).toLocaleString()} HTG</strong>` : ''}
            ${item.reference_paiement ? `<br><span style="font-family: monospace; font-size: 10px;">Réf: ${item.reference_paiement}</span>` : ''}
            ${item.recu_paiement_url ? `<br><a href="${item.recu_paiement_url}" target="_blank" style="color: #003366; text-decoration: underline; font-weight: bold; font-size: 10px;">📁 Voir le reçu</a>` : ''}
          </div>
        `;
      } else {
        paymentHtml = `
          <div style="font-size: 11px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; margin-top: 6px; display: inline-block;">
            🍃 Gratuit / Libre
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <strong>${item.prenom || ''} ${item.nom || ''}</strong>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Soumis le : ${dateStr}</div>
            ${paymentHtml}
          </td>
          <td>
            <div style="font-size: 12px; color: #334155;">✉️ ${item.email || ''}</div>
            <div style="font-size: 12px; color: #334155;">📞 ${item.telephone || 'Non renseigné'}</div>
          </td>
          <td><span style="font-weight: 700; color: #003366;">${relationCourse.titre || item.formation || 'Inconnue'}</span></td>
          <td>
            <div style="font-size: 12px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayedMotivation}">${displayedMotivation}</div>
            ${extendedDetails}
          </td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `
    }).join('')
  } catch (err) {
    console.error(err)
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #de3a49; font-weight:700;">Impossible de joindre la base de données : ${err.message}</td></tr>`
  }
}

const updateInscriptionStatus = async (id, status) => {
  try {
    const { error } = await inscriptions.updateStatus(id, status)
    if (error) throw error
    loadAllInscriptionsData()
  } catch (err) {
    alert("Erreur lors de la mise à jour : " + err.message)
  }
}

// Onglet 3 : Boîte de réception support / contact
const loadAllContactsData = async () => {
  const container = document.getElementById('contactsListContainer')
  if (!container) return
  container.innerHTML = '<p style="text-align:center;">Mise en correspondance des messages en cours...</p>'

  try {
    const { data, error } = await contacts.getAll()
    if (error) throw error

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 25px; color: #64748b;">Aucun message d\'assistance reçu pour l\'instant.</p>'
      return
    }

    container.innerHTML = data.map(msg => {
      const dateStr = msg.created_at ? new Date(msg.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Non précisé'

      const isNew = msg.status === 'nouveau'
      const badgeClass = isNew ? 'badge nouveau' : 'badge lu'
      const badgeText = isNew ? 'Nouveau' : 'Lu'

      const actionBtn = isNew 
        ? `<button class="admin-btn secondary btn-sm" style="padding: 6px 12px; font-size: 11px; margin-top: 10px;" onclick="window.markContactAsRead('${msg.id}')">Marquer comme lu</button>`
        : ''

      return `
        <div class="msg-card ${isNew ? 'nouveau' : ''}">
          <div class="msg-meta">
            <span>👤 <strong>${msg.nom || 'Anonyme'}</strong> (${msg.email})</span>
            <span>📅 ${dateStr}</span>
          </div>
          <div style="font-size: 12.5px; font-weight: bold; margin-bottom: 8px; color: #003366;">Sujet : ${msg.sujet || 'Assistance académique / Information'}</div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; color: #334155;">
            ${msg.message || ''}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top:12px;">
             <span>📞 Tél: <a href="tel:${msg.telephone}">${msg.telephone || 'Non spécifié'}</a></span>
             <span class="${badgeClass}">${badgeText}</span>
          </div>
          ${actionBtn}
        </div>
      `
    }).join('')
  } catch (err) {
    console.error(err)
    container.innerHTML = `<p style="color: red; text-align:center;">Impossible de charger les messages : ${err.message}</p>`
  }
}

const markContactAsRead = async (id) => {
  try {
    const { error } = await contacts.markAsRead(id)
    if (error) throw error
    loadAllContactsData()
  } catch (err) {
    alert("Erreur de modification : " + err.message)
  }
}

// Rattachement global aux onglets
window.loadAllFormationsData = loadAllFormationsData
window.loadAllInscriptionsData = loadAllInscriptionsData
window.updateInscriptionStatus = updateInscriptionStatus

window.lastViewedFormationId = null

window.viewFormationParticipants = async (formationId, formationTitre) => {
  window.lastViewedFormationId = formationId
  
  // Supprimer tout modal existant
  const existing = document.getElementById('participantsModal')
  if (existing) existing.remove()
  
  // Créer un overlay modal
  const modal = document.createElement('div')
  modal.id = 'participantsModal'
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    padding: 20px;
    box-sizing: border-box;
  `
  
  modal.innerHTML = `
    <div style="background: white; width: 100%; max-width: 950px; max-height: 90vh; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); display: flex; flex-direction: column; overflow: hidden; border-top: 6px solid #003366; animation: modalSlideEnter 0.25s ease-out;">
      <style>
        @keyframes modalSlideEnter {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .modal-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          font-size: 12px;
          padding: 12px 16px;
          text-align: left;
          border-bottom: 2px solid #e2e8f0;
        }
        .modal-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
        <div>
          <h3 style="margin: 0; font-family: 'Outfit', sans-serif; color: #003366; font-size: 1.3rem;">👥 Élèves inscrits</h3>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.88rem; font-weight: 500;">
            Formation : <strong id="modalFormationTitle" style="color: #f47c20;">${formationTitre}</strong>
          </p>
        </div>
        <button id="closeParticipantsModalBtn" style="border: none; background: transparent; font-size: 1.6rem; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; transition: background-color 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='transparent'">×</button>
      </div>
      
      <div id="modalParticipantsListContainer" style="flex: 1; overflow-y: auto; padding: 20px;">
        <div style="text-align: center; color: #64748b; padding: 30px;">
          Chargement de la liste des participants...
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  // Gérer la fermeture
  const closeModal = () => {
    window.lastViewedFormationId = null
    modal.remove()
  }
  document.getElementById('closeParticipantsModalBtn').addEventListener('click', closeModal)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  // Charger les données de l'inscription
  await window.refreshParticipantsModalList(formationId, formationTitre)
}

window.refreshParticipantsModalList = async (formationId, formationTitre) => {
  const container = document.getElementById('modalParticipantsListContainer')
  if (!container) return

  try {
    const { data, error } = await supabase
      .from('inscriptions')
      .select('*, formations(*)')
      .eq('formation_id', formationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px; font-weight: 500;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">👥</div>
          Aucun élève n'est encore inscrit à ce programme de formation.
        </div>
      `
      return
    }

    let tbodyRows = data.map(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : 'Inconnue'

      const relationCourse = item.formations || {}
      const meta = (typeof relationCourse.modules === 'object' && relationCourse.modules) ? relationCourse.modules : {}
      const formateurNom = relationCourse.formateur_nom || meta.formateur_nom || 'Jean-Daniel Michel'
      const formateurRole = relationCourse.formateur_role || meta.formateur_role || 'Formateur d\'Aptitude'
      const duration = relationCourse.duree || '30 heures'

      let displayStatus = 'En attente'
      let badgeStyles = 'background: #fef3c7; color: #d97706; border: 1px solid #fde68a;'
      if (item.status === 'acceptee') {
        if (item.certificat_emission) {
          displayStatus = 'Professionnel Certifié ✔'
          badgeStyles = 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'
        } else {
          displayStatus = 'Acceptée / En apprentissage'
          badgeStyles = 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;'
        }
      } else if (item.status === 'refusee') {
        displayStatus = 'Refusée'
        badgeStyles = 'background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'
      }

      const statusBadge = `<span class="modal-badge" style="${badgeStyles}">${displayStatus}</span>`

      let actionButtons = ''
      if (item.status === 'en_attente') {
        actionButtons = `
          <button class="admin-btn success btn-sm" style="padding: 6px 12px; font-size: 11px; margin-right: 6px; background: #22c55e;" onclick="window.updateInscriptionStatusFromModal('${item.id}', 'acceptee')">Approuver</button>
          <button class="admin-btn danger btn-sm" style="padding: 6px 12px; font-size: 11px;" onclick="window.updateInscriptionStatusFromModal('${item.id}', 'refusee')">Décliner</button>
        `
      } else if (item.status === 'acceptee' && !item.certificat_emission) {
        const courseTitleSafe = (relationCourse.titre || item.formation || 'Diplôme INFJ').replace(/'/g, "\\'")
        const studentNameSafe = `${item.prenom || ''} ${item.nom || ''}`.replace(/'/g, "\\'")
        const formateurSafe = formateurNom.replace(/'/g, "\\'")
        const roleSafe = formateurRole.replace(/'/g, "\\'")
        const durationSafe = duration.replace(/'/g, "\\'")

        actionButtons = `
          <button class="admin-btn btn-sm" style="padding: 6px 12px; font-size: 11px; background: #e28743;" onclick="window.certifyAndCompleteInscriptionFromModal('${item.id}', '${studentNameSafe}', '${courseTitleSafe}', '${durationSafe}', '${formateurSafe}', '${roleSafe}')">
            📜 Marquer comme diplômé(e)
          </button>
        `
      } else {
        actionButtons = `<span style="color:#166534; font-size:11px; font-weight:700;">Traité ✔</span>`
      }

      // Motivation
      let displayedMotivation = item.motivation || 'Pas de note fournie'
      if (displayedMotivation.includes('|')) {
        displayedMotivation = displayedMotivation.split('|')[0].replace('Motivation:', '').trim()
      }

      return `
        <tr>
          <td>
            <strong>${item.prenom || ''} ${item.nom || ''}</strong>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Inscrit le : ${dateStr}</div>
          </td>
          <td>
            <div style="font-size: 11.5px; color: #334155;">✉️ ${item.email || ''}</div>
            <div style="font-size: 11.5px; color: #334155;">📞 ${item.telephone || 'Non renseigné'}</div>
          </td>
          <td>
            <div style="font-size: 12px; max-width: 250px; word-wrap: break-word;" title="${displayedMotivation}">${displayedMotivation}</div>
          </td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `
    }).join('')

    container.innerHTML = `
      <div class="admin-table-container">
        <table class="modal-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Email & Tél.</th>
              <th>Motivation</th>
              <th>Statut</th>
              <th>Décision / Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>
      </div>
    `
  } catch (err) {
    console.error(err)
    container.innerHTML = `
      <div style="text-align: center; color: #de3a49; padding: 20px; font-weight: 700;">
        Une erreur est survenue lors du chargement des élèves : ${err.message}
      </div>
    `
  }
}

window.updateInscriptionStatusFromModal = async (id, status) => {
  try {
    const { error } = await inscriptions.updateStatus(id, status)
    if (error) throw error
    
    // Rafraîchir tout
    if (window.lastViewedFormationId) {
      const activeHeader = document.getElementById('modalFormationTitle')
      const formationTitre = activeHeader ? activeHeader.textContent : ''
      await window.refreshParticipantsModalList(window.lastViewedFormationId, formationTitre)
    }
    
    loadAllInscriptionsData()
    loadAllFormationsData()
  } catch (err) {
    alert("Erreur lors de la mise à jour : " + err.message)
  }
}

window.certifyAndCompleteInscriptionFromModal = async (inscriptionId, studentName, courseTitle, duration, formateurNom, formateurRole) => {
  await window.certifyAndCompleteInscription(inscriptionId, studentName, courseTitle, duration, formateurNom, formateurRole)
  
  if (window.lastViewedFormationId) {
    const activeHeader = document.getElementById('modalFormationTitle')
    const formationTitre = activeHeader ? activeHeader.textContent : courseTitle
    await window.refreshParticipantsModalList(window.lastViewedFormationId, formationTitre)
  }
  
  loadAllInscriptionsData()
  loadAllFormationsData()
}
window.loadAllContactsData = loadAllContactsData
window.markContactAsRead = markContactAsRead

// Fonction globale d'action rapide de statut pour l'admin
window.updateFormationStatus = async (id, newStatusLabel) => {
  try {
    let statutDb = 'active'
    if (newStatusLabel === 'brouillon') statutDb = 'inactive'
    if (newStatusLabel === 'archivée') statutDb = 'completed'
    if (newStatusLabel === 'fini') statutDb = 'completed'

    const { data: currentItem, error: getErr } = await supabase.from('formations').select('modules').eq('id', id).single()
    if (getErr) throw getErr

    const meta = (typeof currentItem.modules === 'object' && currentItem.modules) ? currentItem.modules : {}
    meta.status_label = newStatusLabel

    const { error } = await supabase.from('formations')
      .update({
        statut: statutDb,
        modules: meta,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error
    loadAllFormationsData()
  } catch (err) {
    alert("Erreur de mise à jour du statut : " + err.message)
  }
}

/* ADAPTATION DE LA GESTION DES LIVES ET DU SUIVI DE PRESENCE DIRECTEMENT SUR LE DASHBOARD ADMIN */
let selectedAdminSessionId = null;

window.generateComplexMeetingId = function() {
    const course = document.getElementById('liveCourse')?.value || 'general';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 20; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const uniqueId = `infj-live-${course}-${randomStr}`;
    const field = document.getElementById('liveMeetingId');
    if (field) {
        field.value = uniqueId;
    }
    return uniqueId;
}

window.handleCreateLive = async function(event) {
    if (event) event.preventDefault();
    const titre = document.getElementById('liveTitle').value.trim();
    const course_id = document.getElementById('liveCourse').value;
    const meeting_id = document.getElementById('liveMeetingId').value;

    if (!titre || !meeting_id) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    try {
        const { user } = await auth.getCurrentUser()
        const creatorId = user ? user.id : null;
        
        // Insérer la nouvelle session de visioconférence
        const { data, error } = await supabase
            .from('live_sessions')
            .insert([{
                titre,
                course_id,
                meeting_id,
                is_active: true,
                created_by: creatorId,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        alert("Visioconférence de cours lancée avec succès en direct !");
        document.getElementById('liveTitle').value = "";
        window.generateComplexMeetingId();
        await window.loadAllLivesData();

    } catch (err) {
        console.error("Erreur lors de la création du live:", err);
        
        // Fallback local en cas d'absence temporaire de la table sur Supabase
        const fallbackSession = {
            id: 'fallback-' + Date.now(),
            titre,
            course_id,
            meeting_id,
            is_active: true,
            created_at: new Date().toISOString()
        };
        let locals = JSON.parse(localStorage.getItem('local_live_sessions') || '[]');
        locals.push(fallbackSession);
        localStorage.setItem('local_live_sessions', JSON.stringify(locals));
        
        alert("Visioconférence lancée en mode de secours (Hors ligne).");
        document.getElementById('liveTitle').value = "";
        window.generateComplexMeetingId();
        await window.loadAllLivesData();
    }
}

window.closeSession = async function(id) {
    if (!confirm("Voulez-vous vraiment clôturer cette visioconférence ? Elle ne sera plus accessible aux étudiants.")) return;

    try {
        if (id.toString().startsWith('fallback-')) {
            let locals = JSON.parse(localStorage.getItem('local_live_sessions') || '[]');
            locals = locals.map(s => s.id === id ? { ...s, is_active: false } : s);
            localStorage.setItem('local_live_sessions', JSON.stringify(locals));
        } else {
            const { error } = await supabase
                .from('live_sessions')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
        }

        alert("Visioconférence clôturée.");
        await window.loadAllLivesData();
    } catch (err) {
        console.error("Erreur lors de la clôture:", err);
    }
}

window.deleteSession = async function(id) {
    if (!confirm("Voulez-vous supprimer définitivement cet enregistrement ?")) return;

    try {
        if (id.toString().startsWith('fallback-')) {
            let locals = JSON.parse(localStorage.getItem('local_live_sessions') || '[]');
            locals = locals.filter(s => s.id !== id);
            localStorage.setItem('local_live_sessions', JSON.stringify(locals));
        } else {
            const { error } = await supabase
                .from('live_sessions')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }
        
        alert("Enregistrement supprimé.");
        if (selectedAdminSessionId === id) {
            selectedAdminSessionId = null;
            document.getElementById('attendanceSectionTitle').textContent = "👥 Feuille d'Émargement";
            const tbody = document.getElementById('attendanceTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Sélectionnez une session pour afficher les présences.</td></tr>';
            }
        }
        await window.loadAllLivesData();
    } catch (err) {
        console.error("Erreur lors de la suppression:", err);
    }
}

window.viewAttendanceForSession = async function(sessionId, sessionTitle) {
    selectedAdminSessionId = sessionId;
    document.getElementById('attendanceSectionTitle').textContent = `👥 Émargements : ${sessionTitle}`;
    
    // Mettre en gras/sélectionner visuellement la session active dans la liste
    const sessions = document.querySelectorAll('.session-item');
    sessions.forEach(s => s.classList.remove('selected-session-border'));
    
    const clickedCard = document.getElementById(`session-card-${sessionId}`);
    if (clickedCard) {
        clickedCard.style.outline = '3px solid #003366';
        clickedCard.classList.add('selected-session-border');
    }
    
    await window.refreshAttendance();
}

window.refreshAttendance = async function() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (!selectedAdminSessionId) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Veuillez d'abord sélectionner une session de live ci-contre.</td></tr>`;
        return;
    }

    let attends = [];
    try {
        if (selectedAdminSessionId.toString().startsWith('fallback-')) {
            attends = JSON.parse(localStorage.getItem(`fallback_attendance_${selectedAdminSessionId}`) || '[]');
        } else {
            const { data, error } = await supabase
                .from('live_attendance')
                .select('*')
                .eq('session_id', selectedAdminSessionId)
                .order('joined_at', { ascending: false });
            
            if (error) throw error;
            attends = data || [];
        }
    } catch (err) {
        console.error("Erreur de récupération des présences:", err);
        attends = JSON.parse(localStorage.getItem(`fallback_attendance_${selectedAdminSessionId}`) || '[]');
    }

    if (attends.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Aucun étudiant n'a encore émargé ou rejoint cette classe virtuelle.</td></tr>`;
        return;
    }

    tbody.innerHTML = attends.map(att => {
        const joined = new Date(att.joined_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const lastSeen = new Date(att.last_seen_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isOnline = (new Date() - new Date(att.last_seen_at)) < 45000;
        
        return `
            <tr>
                <td style="font-weight: 700; color: #003366;">🎓 ${att.nom_complet || 'Étudiant'}</td>
                <td style="color: #475569;">${att.email || 'Email indisponible'}</td>
                <td>
                    <div style="font-size:12px;"><strong>Entrée à:</strong> ${joined}</div>
                    <div style="font-size:11px; color:#64748b;"><strong>Dernière activité:</strong> ${lastSeen}</div>
                </td>
                <td>
                    <span class="status-badge ${isOnline ? 'online' : 'offline'}" style="font-size:11px;">
                        ${isOnline ? '● Présent' : '● Absent/Parti'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

window.exportAttendanceToCSV = async function() {
    if (!selectedAdminSessionId) {
        alert("Veuillez sélectionner un cours pour exporter sa feuille de présence.");
        return;
    }

    let attends = [];
    try {
        if (selectedAdminSessionId.toString().startsWith('fallback-')) {
            attends = JSON.parse(localStorage.getItem(`fallback_attendance_${selectedAdminSessionId}`) || '[]');
        } else {
            const { data, error } = await supabase
                .from('live_attendance')
                .select('*')
                .eq('session_id', selectedAdminSessionId)
                .order('joined_at', { ascending: false });
            if (error) throw error;
            attends = data || [];
        }
    } catch (err) {
         console.error(err);
         attends = JSON.parse(localStorage.getItem(`fallback_attendance_${selectedAdminSessionId}`) || '[]');
    }

    if (attends.length === 0) {
        alert("Aucun participant n'est enregistré. L'export CSV est vide.");
        return;
    }

    let csvContent = "\uFEFF"; // BOM pour Excel UTF-8
    csvContent += "Nom de l'étudiant;Adresse Email;Heure d'arrivée;Dernière activité;Statut\n";

    attends.forEach(att => {
        const joined = new Date(att.joined_at).toLocaleString('fr-FR');
        const lastSeen = new Date(att.last_seen_at).toLocaleString('fr-FR');
        const isOnline = (new Date() - new Date(att.last_seen_at)) < 45000 ? "Présent" : "Absent/Parti";
        csvContent += `"${att.nom_complet || 'Étudiant'}";"${att.email || ''}";"${joined}";"${lastSeen}";"${isOnline}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Feuille-Presence-INFJ-${selectedAdminSessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.loadAllLivesData = async function() {
    const listContainer = document.getElementById('liveSessionsList');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="font-size: 0.85rem; color: #64748b; text-align: center; margin: 20px 0;">Chargement des sessions...</p>';

    let sessions = [];
    try {
        const { data, error } = await supabase
            .from('live_sessions')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        sessions = data || [];
    } catch (err) {
        console.warn("Fallback local pour les sessions :");
        sessions = JSON.parse(localStorage.getItem('local_live_sessions') || '[]');
    }

    // Mettre à jour les statistiques dynamiques de lives
    const totalCount = sessions.length;
    const activeCount = sessions.filter(s => s.is_active === true || s.statut === 'en_cours').length;

    const totalEl = document.getElementById('livesTotalStats');
    const activeEl = document.getElementById('livesActiveStats');

    if (totalEl) totalEl.textContent = totalCount;
    if (activeEl) activeEl.textContent = activeCount;

    if (sessions.length === 0) {
        listContainer.innerHTML = '<p style="font-size: 0.85rem; color: #64748b; text-align: center; margin: 20px 0;">Aucune session en direct programmée.</p>';
        return;
    }

    listContainer.innerHTML = sessions.map(session => {
        const isActive = session.is_active;
        const activeClass = isActive ? 'active-session' : '';
        const formatTime = new Date(session.created_at).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="session-item ${activeClass}" id="session-card-${session.id}" style="${selectedAdminSessionId === session.id ? 'outline: 3px solid #003366;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <strong style="color:#003366; font-size:0.9rem; display:block; margin-bottom:2px;">${session.titre}</strong>
                        <span style="font-size:0.7rem; background:#003366; color:white; padding:2px 8px; border-radius:10px; font-weight:700;">
                            ${(session.formation_id || session.course_id || 'general').toUpperCase()}
                        </span>
                    </div>
                    <span class="status-badge ${isActive ? 'online' : 'offline'}" style="font-size:10px;">${isActive ? 'En Cours' : 'Clôturé'}</span>
                </div>
                <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-top:2px; word-break:break-all;">
                    Code Jitsi: <strong>${session.meeting_id}</strong>
                </div>
                <div style="font-size:0.7rem; color:#94a3b8; font-weight: 500;">Créé le: ${formatTime}</div>
                
                <div style="display:flex; gap:8px; margin-top:8px; justify-content: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                    <button class="admin-btn" style="padding:4px 10px; font-size:0.75rem; background:#003366;" onclick="window.viewAttendanceForSession('${session.id}', '${session.titre}')">
                        📊 Émargement
                    </button>
                    ${isActive ? `
                        <button class="admin-btn secondary" style="padding:4px 10px; font-size:0.75rem;" onclick="window.closeSession('${session.id}')">
                            🛑 Clôturer
                        </button>
                    ` : `
                        <button class="admin-btn danger" style="padding:4px 10px; font-size:0.75rem;" onclick="window.deleteSession('${session.id}')">
                            🗑️ Supprimer
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Initialisation au chargement de la page
const initAdminPage = async () => {
    await checkAdmin()
    await loadAllVideoCourses()
    await loadAllFormationsToSelect()
    await loadCourseVideos()
}
initAdminPage()

if (document.getElementById('liveMeetingId')) {
    window.generateComplexMeetingId()
}

