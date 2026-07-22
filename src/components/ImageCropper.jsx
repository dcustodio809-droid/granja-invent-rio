import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImageBlob } from '../lib/cropImage'

export default function ImageCropper({ imageSrc, fileName, aspect = 16 / 9, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_croppedArea, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      const file = new File([blob], fileName || 'foto.jpg', { type: blob.type })
      onConfirm(file)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-title">Ajustar foto</div>
        <div className="modal-sub">Arraste para posicionar e use a régua para dar zoom, mostrando só a parte que você quer que apareça.</div>

        <div className="cropper-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="field-label" style={{ marginTop: 16 }}>Zoom</label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: '100%' }}
        />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Aplicando...' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
