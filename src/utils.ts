export const truncate = (str: string, n: number) => {
  const startChars = n
  const endChars = n
  // Check if the total length of the start and end parts exceeds the string length
  if (startChars + endChars >= str.length) {
    return str
  }

  // Extract the start and end parts
  const startPart = str.substring(0, startChars)
  const endPart = str.substring(str.length - endChars)

  // Return the truncated string
  return `${startPart}...${endPart}`
}
