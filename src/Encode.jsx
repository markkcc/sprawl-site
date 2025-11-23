import { useState, useEffect } from 'react'
import './Encode.css'
import { encodeLumaCode } from './encodeUtils'

function Encode() {
  const [matrixColumns, setMatrixColumns] = useState([])
  const [inputValue, setInputValue] = useState('')

  // Matrix animation at full intensity (8x)
  useEffect(() => {
    const matrixChars = ['ﾊ', 'ﾐ', 'ﾋ', 'ｰ', 'ｳ', 'ｼ', 'ﾅ', 'ﾓ', 'ﾆ', 'ｻ', 'ﾜ', 'ﾂ', 'ｵ', 'ﾘ', 'ｱ', 'ﾎ', 'ﾃ', 'ﾏ', 'ｹ', 'ﾒ', 'ｴ', 'ｶ', 'ｷ', 'ﾑ', 'ﾕ', 'ﾗ', 'ｾ', 'ﾈ', 'ｽ', 'ﾀ', 'ﾇ', 'ﾍ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Z', ':', '.', '"', '=', '*', '+', '-', '<', '>', '¦', '|', '╌']
    const interval = setInterval(() => {
      const columnLength = Math.floor(Math.random() * 3) + 3 // 3-5 characters
      const characters = []
      for (let i = 0; i < columnLength; i++) {
        characters.push(matrixChars[Math.floor(Math.random() * matrixChars.length)])
      }

      const newColumn = {
        id: Date.now() + Math.random(),
        characters: characters,
        x: Math.random() * 100
      }

      setMatrixColumns(prev => [...prev, newColumn])

      // Remove column after animation completes (10 seconds)
      setTimeout(() => {
        setMatrixColumns(prev => prev.filter(col => col.id !== newColumn.id))
      }, 10000)
    }, 25) // 8x faster: 200ms / 8 = 25ms

    return () => clearInterval(interval)
  }, [])

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      try {
        const encoded = encodeLumaCode(inputValue.trim())
        setInputValue(encoded)
      } catch (error) {
        console.error('Encoding error:', error)
        alert('Error encoding. Make sure input is 8 characters.')
      }
    }
  }

  return (
    <div className="encode-page">
      {/* Matrix background */}
      <div className="encode-matrix-container">
        {matrixColumns.map(column => (
          <div
            key={column.id}
            className="encode-matrix-column"
            style={{
              left: `${column.x}%`
            }}
          >
            {column.characters.map((char, index) => (
              <div key={index} className="encode-matrix-char">
                {char}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Input field */}
      <div className="encode-input-container">
        <input
          type="text"
          className="encode-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="paste luma code..."
          autoFocus
        />
      </div>
    </div>
  )
}

export default Encode
