const fs = require('fs');
const path = require('path');

// Directory for temporary files


/*function cleanUpTempFiles(tempDir) {
  fs.readdirSync(tempDir).forEach(file => fs.unlinkSync(path.join(tempDir, file)));
  fs.rmdirSync(tempDir);
}*/
function cleanUpTempFiles(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach(file => {
      const filePath = path.join(tempDir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        cleanUpTempFiles(filePath); 
      } else {
        fs.unlinkSync(filePath); 
      }
    });
    fs.rmdirSync(tempDir); 
  }
}
module.exports= cleanUpTempFiles
