function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (err) => reject(err))
    img.crossOrigin = 'anonymous'
    img.src = url
  })
}

export async function getCroppedImageBlob(imageSrc, cropPixels, mimeType = 'image/jpeg') {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cropPixels.width)
  canvas.height = Math.round(cropPixels.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, canvas.width, canvas.height
  )
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, 0.9)
  })
}
