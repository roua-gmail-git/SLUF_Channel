function calculateMean(data) {
    const sum = data.reduce((acc, value) => acc + value, 0);
    return sum / data.length;
  }
  
  function calculateStandardDeviation(data, mean) {
    const squaredDifferences = data.map(value => {
      const difference = value - mean;
      return difference * difference;
    });
  
    const meanOfSquaredDifferences = calculateMean(squaredDifferences);
    return Math.sqrt(meanOfSquaredDifferences);
  }
  
  function filterOutliers(data) {
    const filteredData = [];
  
    data.forEach((value, index) => {
      // Create a new array excluding the current value
      const remainingValues = data.filter((_, i) => i !== index);
  
      // Calculate mean and std deviation for the remaining values
      const mean = calculateMean(remainingValues);
      const stdDev = calculateStandardDeviation(remainingValues, mean);
  
      // Calculate the 4-sigma boundaries
      const lowerBound = mean - 4 * stdDev;
      const upperBound = mean + 4 * stdDev;
      /* false && console.log(lowerBound,upperBound , value) */
  
      // Check if the excluded value falls within the boundaries
      if (value >= lowerBound && value <= upperBound) {
        filteredData.push(value); // Keep the value if it's within the boundaries
      }
    });
  
    return filteredData;
  }
  
  // Example dataset
  const data = [99,99.00000001,99.00000002]; // 100 is an outlier
  
  const filteredData = filterOutliers(data);
  
  /* false && console.log('Filtered data:', filteredData); */
  
