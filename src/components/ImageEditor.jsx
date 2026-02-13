import { useMemo, useRef, useState } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

function formatSize(crop) {
  if (!crop?.width || !crop?.height) {
    return '0 x 0'
  }
  return `${Math.round(crop.width)} x ${Math.round(crop.height)}`
}

function renderToCanvas(image, canvas, crop) {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const pixelRatio = window.devicePixelRatio || 1

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  const ctx = canvas.getContext('2d')
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  ctx.drawImage(
    image,
    cropX,
    cropY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width * scaleX,
    crop.height * scaleY
  )
}

async function downloadCropped(image, crop) {
  const canvas = document.createElement('canvas')
  renderToCanvas(image, canvas, crop)

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png', 0.95)
  })

  if (!blob) {
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cropped-${Date.now()}.png`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ImageEditor({
  source,
  crop,
  completedCrop,
  activePreset,
  presets,
  instagramCompatible,
  currentAspect,
  showCompatibility,
  onCropChange,
  onCropComplete,
  onImageLoaded,
  onPresetChange,
  onImageSelect,
  onReset
}) {
  const inputRef = useRef(null)
  const imageRef = useRef(null)
  const cropAreaRef = useRef(null)
  const [isSaving, setIsSaving] = useState(false)

  const disabledSave = useMemo(() => {
    if (!source || !completedCrop?.width || !completedCrop?.height) {
      return true
    }
    return completedCrop.width < 2 || completedCrop.height < 2
  }, [source, completedCrop])

  const handleOpenPicker = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      onImageSelect(file)
    }
    event.target.value = ''
  }

  const handleSave = async () => {
    if (!imageRef.current || !completedCrop || disabledSave) {
      return
    }

    try {
      setIsSaving(true)
      await downloadCropped(imageRef.current, completedCrop)
    } finally {
      setIsSaving(false)
    }
  }

  const getImageFrame = () => {
    const image = imageRef.current
    const cropArea = cropAreaRef.current
    if (!image || !cropArea) {
      return null
    }

    const cropRoot = cropArea.querySelector('.ReactCrop')
    const baseRect = (cropRoot || cropArea).getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()

    return {
      x: imageRect.left - baseRect.left,
      y: imageRect.top - baseRect.top,
      width: imageRect.width,
      height: imageRect.height
    }
  }

  const aspectLabel = currentAspect ? `${currentAspect.toFixed(2)}:1` : '—'

  return (
    <div className="editor-shell">
      <aside className="editor-sidebar">
        <div className="sidebar-title">Обрезка</div>
        <button className="ghost-btn" onClick={onReset}>Сброс</button>

        <div className="meta-block">
          <div className="meta-label">Размер выреза</div>
          <div className="meta-value">{formatSize(completedCrop || crop)}</div>
        </div>

        <div className="preset-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className={`preset-btn ${activePreset.id === preset.id ? 'active' : ''}`}
              onClick={() => onPresetChange(preset, imageRef.current)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {showCompatibility && (
          <div className="compatibility-block">
            <div className="meta-label">Совместимость</div>
            <div className="compatibility-row">
              <span>Инстаграм</span>
              <span
                className={`compatibility-icon ${instagramCompatible ? 'ok' : 'fail'}`}
                aria-label={instagramCompatible ? 'Совместимо' : 'Не совместимо'}
                title={
                  instagramCompatible
                    ? 'Подходит для API Инстаграм'
                    : 'Не подходит для API Инстаграм'
                }
              >
                {instagramCompatible ? '✓' : '✕'}
              </span>
            </div>
            <div className="compatibility-note">Ограничение: 4:5 .. 1.91:1</div>
            <div className="compatibility-note">Текущее: {aspectLabel}</div>
          </div>
        )}
      </aside>

      <main className="editor-main">
        <header className="editor-toolbar">
          <button className="ghost-btn" onClick={handleOpenPicker}>Выбрать картинку</button>
          <button className="primary-btn" disabled={disabledSave || isSaving} onClick={handleSave}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </header>

        {!source && (
          <div className="drop-screen">
            <h1>Выберите изображение</h1>
            <p>Поддерживаются JPG, PNG, WEBP</p>
            <button className="primary-btn" onClick={handleOpenPicker}>Открыть файл</button>
          </div>
        )}

        {source && (
          <div className="crop-wrap">
            <div className="crop-area" ref={cropAreaRef}>
              <ReactCrop
                crop={crop}
                onChange={(pixelCrop, percentCrop) =>
                  onCropChange(pixelCrop, percentCrop, getImageFrame())
                }
                onComplete={(pixelCrop) => onCropComplete(pixelCrop, getImageFrame())}
                aspect={activePreset.aspect || undefined}
                minWidth={40}
                minHeight={40}
                keepSelection
                ruleOfThirds
              >
                <img
                  ref={imageRef}
                  src={source}
                  alt="Редактируемое изображение"
                  onLoad={(event) => onImageLoaded(event.currentTarget, getImageFrame())}
                  className="preview-image"
                />
              </ReactCrop>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden-input"
        />
      </main>
    </div>
  )
}
