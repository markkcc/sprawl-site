// Encode a Luma URL code
export function encodeLumaCode(code) {
  // 1. Split into pairs of two characters
  const pairs = []
  for (let i = 0; i < code.length; i += 2) {
    pairs.push(code.slice(i, i + 2))
  }

  // 2. Shuffle order to 2,1,4,3 (indices 1,0,3,2)
  const shuffled = [pairs[1], pairs[0], pairs[3], pairs[2]]

  // 3. Base-64 encode each pair 3 times
  const encoded = shuffled.map(pair => {
    let result = pair
    for (let i = 0; i < 3; i++) {
      result = btoa(result)
    }
    return result
  })

  // 4. Concatenate results
  let concatenated = encoded.join('')

  // 5. Add increasing ASCII values (3, 4, 5, ...) with modulo to stay in printable ASCII range (33-126)
  let final = ''
  const MIN_ASCII = 33 // !
  const MAX_ASCII = 126 // ~
  const ASCII_RANGE = MAX_ASCII - MIN_ASCII + 1 // 94 characters

  for (let i = 0; i < concatenated.length; i++) {
    const charCode = concatenated.charCodeAt(i)
    const offset = (i + 3)
    // Shift within printable ASCII range using modulo
    const shifted = ((charCode - MIN_ASCII + offset) % ASCII_RANGE) + MIN_ASCII
    final += String.fromCharCode(shifted)
  }

  return final
}

// Decode back to original Luma URL code
export function decodeLumaCode(encoded) {
  // 5. Reverse: subtract increasing ASCII values with modulo
  let concatenated = ''
  const MIN_ASCII = 33 // !
  const MAX_ASCII = 126 // ~
  const ASCII_RANGE = MAX_ASCII - MIN_ASCII + 1 // 94 characters

  for (let i = 0; i < encoded.length; i++) {
    const charCode = encoded.charCodeAt(i)
    const offset = (i + 3)
    // Reverse shift within printable ASCII range using modulo (add ASCII_RANGE to handle negatives)
    const shifted = ((charCode - MIN_ASCII - offset + ASCII_RANGE) % ASCII_RANGE) + MIN_ASCII
    concatenated += String.fromCharCode(shifted)
  }

  // 4. Split back into 4 parts (each base64 encoded chunk has same length)
  const chunkLength = concatenated.length / 4
  const chunks = []
  for (let i = 0; i < 4; i++) {
    chunks.push(concatenated.slice(i * chunkLength, (i + 1) * chunkLength))
  }

  // 3. Base-64 decode each chunk 3 times
  const decoded = chunks.map(chunk => {
    let result = chunk
    for (let i = 0; i < 3; i++) {
      result = atob(result)
    }
    return result
  })

  // 2. Unshuffle order from 2,1,4,3 back to 1,2,3,4 (indices 1,0,3,2 -> 0,1,2,3)
  const unshuffled = [decoded[1], decoded[0], decoded[3], decoded[2]]

  // 1. Concatenate pairs back together
  return unshuffled.join('')
}
