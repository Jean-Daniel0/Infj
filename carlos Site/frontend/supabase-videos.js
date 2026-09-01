// Videos depuis Supabase Storage
import { supabase } from './supabase-config.js'
import { SUPABASE_STORAGE } from './config.js'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogg'])

const COURSE_FOLDER_MAP = {
  web: 'web',
  'creation-site-web': 'web',
  leadership: 'leadership',
  entrepreneuriat: 'entrepreneuriat',
  communication: 'communication',
  marketing: 'marketing',
  dropshipping: 'dropshipping'
}

const normalizeCourseType = (courseType) => {
  return String(courseType || 'web').trim()
}

const toTitle = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const stripExtension = (fileName) => {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot)
}

const getExtension = (fileName) => {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase()
}

const getOrderKey = (fileName) => {
  const match = /^\s*(\d{1,3})[\s._-]/.exec(fileName)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

const sortFiles = (files) =>
  [...files].sort((a, b) => {
    const orderA = getOrderKey(a.name || '')
    const orderB = getOrderKey(b.name || '')
    if (orderA !== orderB) return orderA - orderB
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr')
  })

const getPublicUrl = (bucket, path) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || ''
}

const getSignedUrl = async (bucket, path, expiresIn) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw error
  }

  return data?.signedUrl || ''
}

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ''))

const resolveFilePath = (folder, fileName) => {
  const cleanName = String(fileName || '').replace(/^\/+/, '')
  if (!cleanName) return ''
  if (cleanName.includes('/')) return cleanName
  return `${folder}/${cleanName}`
}

const parseManifest = (manifestData) => {
  if (!manifestData) return null
  if (Array.isArray(manifestData)) {
    return { videos: manifestData }
  }
  if (typeof manifestData === 'object') {
    return manifestData
  }
  return null
}

const downloadManifest = async (bucket, folder) => {
  const manifestPath = `${folder}/manifest.json`
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(manifestPath)

  if (error || !data) {
    return null
  }

  const text = await data.text()
  try {
    return JSON.parse(text)
  } catch (parseError) {
    console.warn('Manifest Supabase invalide:', parseError)
    return null
  }
}

export async function getCourseVideos(courseType = 'web') {
  const normalizedCourseType = normalizeCourseType(courseType)
  const bucket = SUPABASE_STORAGE?.bucket || 'videos'
  const isPublic = SUPABASE_STORAGE?.public !== false
  const signedUrlExpiresIn = SUPABASE_STORAGE?.signedUrlExpiresIn || 3600

  const folder = COURSE_FOLDER_MAP[normalizedCourseType] || normalizedCourseType || 'web'

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 200,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })

  if (error) {
    throw new Error(error.message || 'Erreur lors de la lecture du stockage Supabase.')
  }

  const videoFiles = sortFiles((data || []).filter((item) => {
    const extension = getExtension(item.name || '')
    return VIDEO_EXTENSIONS.has(extension)
  }))

  const fileMap = new Map(videoFiles.map((item) => [item.name, item]))
  const manifestRaw = await downloadManifest(bucket, folder)
  const manifest = parseManifest(manifestRaw)
  const manifestVideos = Array.isArray(manifest?.videos) ? manifest.videos : []

  const courseTitle = manifest?.courseTitle || ''
  const courseDescription = manifest?.courseDescription || ''

  const videos = []
  const usedFiles = new Set()

  for (const entry of manifestVideos) {
    const fileName = entry?.file || entry?.name || entry?.path || ''
    const filePath = resolveFilePath(folder, fileName)
    if (!filePath) continue

    const baseName = filePath.split('/').pop() || ''
    usedFiles.add(baseName)

    const videoUrl = isPublic
      ? getPublicUrl(bucket, filePath)
      : await getSignedUrl(bucket, filePath, signedUrlExpiresIn)

    let thumbnailUrl = ''
    if (entry?.thumbnail) {
      if (isAbsoluteUrl(entry.thumbnail)) {
        thumbnailUrl = entry.thumbnail
      } else {
        const thumbPath = resolveFilePath(folder, entry.thumbnail)
        if (thumbPath) {
          thumbnailUrl = isPublic
            ? getPublicUrl(bucket, thumbPath)
            : await getSignedUrl(bucket, thumbPath, signedUrlExpiresIn)
        }
      }
    }

    videos.push({
      id: filePath,
      title: entry?.title || toTitle(stripExtension(baseName || 'Video')),
      description: entry?.description || '',
      category: entry?.category || normalizedCourseType,
      streamingUrl: videoUrl,
      publicUrl: videoUrl,
      thumbnailUrl,
      duration: entry?.duration || null,
      views: entry?.views || null,
      order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : getOrderKey(baseName)
    })
  }

  // Ajouter les fichiers non listés dans le manifest
  for (const file of videoFiles) {
    if (usedFiles.has(file.name)) continue
    const filePath = `${folder}/${file.name}`
    const videoUrl = isPublic
      ? getPublicUrl(bucket, filePath)
      : await getSignedUrl(bucket, filePath, signedUrlExpiresIn)

    videos.push({
      id: filePath,
      title: toTitle(stripExtension(file.name || 'Video')),
      description: '',
      category: normalizedCourseType,
      streamingUrl: videoUrl,
      publicUrl: videoUrl,
      thumbnailUrl: '',
      duration: null,
      views: null,
      order: getOrderKey(file.name || '')
    })
  }

  // Trier par ordre si dispo
  videos.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return String(a.title || '').localeCompare(String(b.title || ''), 'fr')
  })

  if (!videos.length) {
    return {
      success: true,
      courseType: normalizedCourseType,
      videos: [],
      total: 0,
      bucket,
      folder,
      message: 'Aucune video disponible pour ce cours.',
      courseTitle,
      courseDescription
    }
  }

  return {
    success: true,
    courseType: normalizedCourseType,
    videos,
    total: videos.length,
    bucket,
    folder,
    courseTitle,
    courseDescription
  }
}

export default {
  getCourseVideos
}
