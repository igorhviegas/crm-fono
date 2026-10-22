// Arte de aniversário (1080x1350, formato feed/stories do Instagram) desenhada em canvas: só o nome muda.
const OURO = '#B08D4F'
const W = 1080
const H = 1350

async function logo(): Promise<HTMLImageElement | null> {
  // Opcional: coloque o logo em public/logo.png e ele aparece na arte.
  return new Promise((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ok(null)
    i.src = '/logo.png'
  })
}

function ajustaFonte(c: CanvasRenderingContext2D, texto: string, fam: string, max: number, larg: number) {
  let t = max
  do c.font = `${t--}px ${fam}`
  while (c.measureText(texto).width > larg && t > 30)
}

export async function geraArte(nome: string, clinica: string): Promise<Blob> {
  await Promise.all(['100px "Great Vibes"', '500 40px "Cormorant Garamond"'].map((f) => document.fonts.load(f)))
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = '#fff'
  c.fillRect(0, 0, W, H)
  c.strokeStyle = OURO
  c.lineWidth = 3
  c.strokeRect(50, 50, W - 100, H - 100)
  c.lineWidth = 1
  c.strokeRect(68, 68, W - 136, H - 136)
  c.textAlign = 'center'
  c.textBaseline = 'middle'

  const img = await logo()
  if (img) {
    const h = 200
    c.drawImage(img, W / 2 - (img.width * h) / img.height / 2, 130, (img.width * h) / img.height, h)
  }

  c.fillStyle = OURO
  c.font = '500 44px "Cormorant Garamond", serif'
  c.letterSpacing = '12px'
  c.fillText('FELIZ', W / 2, 470)
  c.letterSpacing = '0px'
  c.font = '170px "Great Vibes", cursive'
  c.fillText('Aniversário', W / 2, 600)

  c.beginPath()
  c.moveTo(W / 2 - 90, 710)
  c.lineTo(W / 2 + 90, 710)
  c.stroke()

  c.fillStyle = '#111'
  const primeiro = nome.trim().split(/\s+/)[0]
  ajustaFonte(c, primeiro, '"Cormorant Garamond", serif', 150, W - 240)
  c.fillText(primeiro, W / 2, 840)

  c.fillStyle = '#444'
  c.font = '500 36px "Cormorant Garamond", serif'
  c.fillText('Que seu novo ciclo seja repleto de coisas boas.', W / 2, 960)

  c.fillStyle = OURO
  c.font = '500 34px "Cormorant Garamond", serif'
  c.letterSpacing = '6px'
  c.fillText(clinica.toUpperCase(), W / 2, H - 150)

  return new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'))
}

/** No celular abre o menu de compartilhar (dá para salvar na galeria); no PC baixa o arquivo. */
export async function salvaArte(blob: Blob, nome: string) {
  const arquivo = new File([blob], `aniversario-${nome.trim().split(/\s+/)[0].toLowerCase()}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(arquivo)
  a.download = arquivo.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
