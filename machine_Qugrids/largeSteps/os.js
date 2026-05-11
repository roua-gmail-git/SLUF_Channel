const path = require('path');
const os = require('os');
const fs = require('fs')


async function create_directory(dir_name){
    let tempDir = path.join(os.tmpdir(), dir_name);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      return tempDir

}












module.exports =create_directory