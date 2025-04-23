// Function to calculate font size based on the number of characters in the formatted string.
// Using a linear interpolation between maxFontSize and minFontSize.
export const calculateFontSize = (formatted: string) => {
  const maxFontSize = 96;
  const minFontSize = 64;

  // "$0.00" has 5 characters
  const minLength = 5;
  // "$99,999.99" has 10 characters
  const maxLength = 10;

  if (formatted.length <= minLength) return maxFontSize;
  if (formatted.length >= maxLength) return minFontSize;

  const fontSize =
    maxFontSize - ((formatted.length - minLength) * (maxFontSize - minFontSize)) / (maxLength - minLength);

  return fontSize;
};