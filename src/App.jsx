import { useEffect, useMemo, useState } from 'react'
import ImageEditor from './components/ImageEditor'

const ASPECT_PRESETS = [
  { id: 'free', label: 'Свободно', aspect: null },
  { id: 'square', label: 'Квадрат', aspect: 1 / 1 },
  { id: '16:9', label: '16:9', aspect: 16 / 9 },
  { id: '16:10', label: '16:10', aspect: 16 / 10 },
  { id: '4:3', label: '4:3', aspect: 4 / 3 },
  { id: '3:4', label: '3:4', aspect: 3 / 4 }
]
const INSTAGRAM_MIN_ASPECT = 4 / 5
const INSTAGRAM_MAX_ASPECT = 1.91
const EPSILON = 0.001
const INSTAGRAM_COMPATIBILITY_KEY = 'instagram'

function createCenteredCropInFrame(frame, aspect) {
  const frameX = frame.x ?? 0
  const frameY = frame.y ?? 0
  const frameWidth = frame.width ?? 0
  const frameHeight = frame.height ?? 0

  if (!frameWidth || !frameHeight) {
    return null
  }

  if (!aspect) {
    const width = frameWidth * 0.6
    const height = frameHeight * 0.6
    return {
      unit: 'px',
      x: frameX + (frameWidth - width) / 2,
      y: frameY + (frameHeight - height) / 2,
      width,
      height
    }
  }

  const safeArea = 0.8
  let width = frameWidth * safeArea
  let height = width / aspect

  if (height > frameHeight * safeArea) {
    height = frameHeight * safeArea
    width = height * aspect
  }

  return {
    unit: 'px',
    x: frameX + (frameWidth - width) / 2,
    y: frameY + (frameHeight - height) / 2,
    width,
    height
  }
}

function createInstagramCompatibleCrop(frame) {
  const frameX = frame.x ?? 0
  const frameY = frame.y ?? 0
  const frameWidth = frame.width ?? 0
  const frameHeight = frame.height ?? 0
  const imageAspect = frameWidth / frameHeight

  if (
    imageAspect >= INSTAGRAM_MIN_ASPECT - EPSILON &&
    imageAspect <= INSTAGRAM_MAX_ASPECT + EPSILON
  ) {
    return {
      unit: 'px',
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight
    }
  }

  let cropWidth = frameWidth
  let cropHeight = frameHeight
  let cropX = frameX
  let cropY = frameY

  if (imageAspect < INSTAGRAM_MIN_ASPECT) {
    cropHeight = frameWidth / INSTAGRAM_MIN_ASPECT
    cropY = frameY + (frameHeight - cropHeight) / 2
  } else {
    cropWidth = frameHeight * INSTAGRAM_MAX_ASPECT
    cropX = frameX + (frameWidth - cropWidth) / 2
  }

  return {
    unit: 'px',
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight
  }
}

function clampPixelCropToFrame(crop, frame) {
  const cropX = crop.x ?? 0
  const cropY = crop.y ?? 0
  const cropWidth = crop.width ?? 0
  const cropHeight = crop.height ?? 0
  const frameX = frame.x ?? 0
  const frameY = frame.y ?? 0
  const frameWidth = frame.width ?? 0
  const frameHeight = frame.height ?? 0

  const x1 = Math.max(frameX, cropX)
  const y1 = Math.max(frameY, cropY)
  const x2 = Math.min(frameX + frameWidth, cropX + cropWidth)
  const y2 = Math.min(frameY + frameHeight, cropY + cropHeight)

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1)
  }
}

export default function App() {
  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return new URLSearchParams()
    }

    return new URLSearchParams(window.location.search)
  }, [])
  const compatibilityMode = searchParams.get('compatibility')?.toLowerCase() || null
  const instagramCompatibilityEnabled =
    compatibilityMode === INSTAGRAM_COMPATIBILITY_KEY
  const hasErrorParam = searchParams.get('error') === '1'

  const [source, setSource] = useState(null)
  const [activePreset, setActivePreset] = useState(ASPECT_PRESETS[0])
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const [livePixelCrop, setLivePixelCrop] = useState(null)
  const [imageFrame, setImageFrame] = useState(null)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(hasErrorParam)

  const effectiveCrop = useMemo(() => {
    if (!imageFrame?.width || !imageFrame?.height) {
      return null
    }

    if (livePixelCrop?.width && livePixelCrop?.height) {
      return clampPixelCropToFrame(livePixelCrop, imageFrame)
    }

    if (completedCrop?.width && completedCrop?.height) {
      return clampPixelCropToFrame(completedCrop, imageFrame)
    }

    return null
  }, [livePixelCrop, completedCrop, imageFrame])

  const currentAspect = useMemo(() => {
    if (!effectiveCrop?.width || !effectiveCrop?.height) {
      return null
    }

    return effectiveCrop.width / effectiveCrop.height
  }, [effectiveCrop])

  const instagramCompatible = useMemo(() => {
    if (!source || !currentAspect) {
      return false
    }

    return (
      currentAspect >= INSTAGRAM_MIN_ASPECT - EPSILON &&
      currentAspect <= INSTAGRAM_MAX_ASPECT + EPSILON
    )
  }, [source, currentAspect])

  useEffect(() => {
    return () => {
      if (source) {
        URL.revokeObjectURL(source)
      }
    }
  }, [source])

  const handleImageLoaded = (img, frame) => {
    const nextFrame =
      frame || {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
      }
    setImageFrame(nextFrame)

    if (instagramCompatibilityEnabled) {
      const nextCrop = createInstagramCompatibleCrop(nextFrame)
      setActivePreset(ASPECT_PRESETS[0])
      setCrop(nextCrop)
      setCompletedCrop(null)
      setLivePixelCrop(nextCrop)
      return
    }

    const nextCrop = createCenteredCropInFrame(nextFrame, activePreset.aspect)
    if (!nextCrop) {
      return
    }
    setCrop(nextCrop)
    setCompletedCrop(null)
    setLivePixelCrop(nextCrop)
  }

  const handlePresetChange = (preset, imageRef, frame) => {
    setActivePreset(preset)
    const targetFrame = frame || imageFrame

    if (targetFrame?.width && targetFrame?.height) {
      const nextCrop = createCenteredCropInFrame(targetFrame, preset.aspect)
      if (nextCrop) {
        setCrop(nextCrop)
        setCompletedCrop(null)
        setLivePixelCrop(nextCrop)
        return
      }
    }

    if (!imageRef?.width || !imageRef?.height) {
      return
    }

    const fallbackFrame = {
      x: 0,
      y: 0,
      width: imageRef.width,
      height: imageRef.height
    }
    const nextCrop = createCenteredCropInFrame(fallbackFrame, preset.aspect)
    if (!nextCrop) {
      return
    }
    setCrop(nextCrop)
    setCompletedCrop(null)
    setLivePixelCrop(nextCrop)
    setImageFrame(fallbackFrame)
  }

  const handleCropChange = (pixelCrop, percentCrop, frame) => {
    const activeFrame = frame || imageFrame
    const nextCrop = activeFrame
      ? clampPixelCropToFrame(pixelCrop, activeFrame)
      : pixelCrop

    setCrop(nextCrop)
    setLivePixelCrop(nextCrop)
    if (activeFrame) {
      setImageFrame(activeFrame)
    }
  }

  const handleCropComplete = (pixelCrop, frame) => {
    const activeFrame = frame || imageFrame
    const nextCrop = activeFrame
      ? clampPixelCropToFrame(pixelCrop, activeFrame)
      : pixelCrop

    setCompletedCrop(nextCrop)
    setLivePixelCrop(nextCrop)
    if (activeFrame) {
      setImageFrame(activeFrame)
    }
  }

  const handleImageSelect = (file) => {
    if (!file) {
      return
    }
    const nextUrl = URL.createObjectURL(file)
    setSource((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return nextUrl
    })
    setCompletedCrop(null)
    setLivePixelCrop(null)
    setImageFrame(null)
  }

  const handleReset = () => {
    if (source) {
      URL.revokeObjectURL(source)
    }
    setSource(null)
    setCrop(undefined)
    setCompletedCrop(null)
    setLivePixelCrop(null)
    setActivePreset(ASPECT_PRESETS[0])
    setImageFrame(null)
  }

  return (
    <ImageEditor
      source={source}
      crop={crop}
      completedCrop={completedCrop}
      activePreset={activePreset}
      presets={ASPECT_PRESETS}
      onCropChange={handleCropChange}
      onCropComplete={handleCropComplete}
      onImageLoaded={handleImageLoaded}
      onPresetChange={handlePresetChange}
      onImageSelect={handleImageSelect}
      onReset={handleReset}
      instagramCompatible={instagramCompatible}
      currentAspect={currentAspect}
      showCompatibility={instagramCompatibilityEnabled}
      showErrorModal={isErrorModalOpen}
      onCloseErrorModal={() => setIsErrorModalOpen(false)}
    />
  )
}
