const fs = require('fs');

const readline = require('readline');

/**
 * @brief File
 *
 * This class creates a txt File object and append content to it
 *
 * @param name: name of the file 
 * 
 * @return file
 */
class File{
    constructor(ordner,name,create=true){
        this.name=name
        this.path= './Files/'+ordner+'/' + this.name + '.txt'
        this.pending_append_chunks = []
        this.pending_flush_callbacks = []
        this.flush_in_progress = false
        this.write_stream = undefined
        if(create==true){this.create_File()}
        
        
    }
    create_File(){ //create a txt file 
        if(this.write_stream != undefined && this.write_stream.destroyed == false){
          this.write_stream.end()
        }
        this.write_stream = fs.createWriteStream(this.path, { flags: 'w' });
        this.write_stream.on('error', (err) => {
          console.error('error writing file stream', this.path, err.message);
        });
        return this.write_stream
      

    } 
    append_to_file(content,flag=true,name='',callback){ // append the content to the file 
        if(flag == true){
            this.pending_append_chunks.push(name +content+ '\n')
            if(typeof callback === 'function'){
              this.pending_flush_callbacks.push(callback)
            }
            this.flush_pending_appends()
        }
    }
    ensure_write_stream(){
      if(this.write_stream == undefined || this.write_stream.destroyed === true){
        this.create_File()
      }
    }
    flush_pending_appends(callback){
      if(typeof callback === 'function'){
        this.pending_flush_callbacks.push(callback)
      }
      if(this.flush_in_progress === true){
        return
      }
      if(this.pending_append_chunks.length === 0){
        this.run_flush_callbacks()
        return
      }
      this.flush_in_progress = true
      this.ensure_write_stream()
      const flush_next = () => {
        if(this.pending_append_chunks.length === 0){
          this.flush_in_progress = false
          this.run_flush_callbacks()
          return
        }
        const chunk = this.pending_append_chunks.shift()
        const can_continue = this.write_stream.write(chunk)
        if(can_continue === true){
          setImmediate(flush_next)
          return
        }
        this.write_stream.once('drain', flush_next)
      }
      flush_next()
    }
    run_flush_callbacks(){
      if(this.pending_flush_callbacks.length === 0){
        return
      }
      const callbacks = this.pending_flush_callbacks
      this.pending_flush_callbacks = []
      callbacks.forEach((cb) => {
        try{
          cb()
        }catch(error){
        }
      })
    }
    wait_for_flush(){
      return new Promise((resolve) => {
        this.flush_pending_appends(() => {
          resolve()
        })
      })
    }
    delete_file(path){
        fs.unlink(path, (err) => {
            if (err) {
              console.error('file not Found');
            } else {
              /* false && console.log('File is deleted.'); */ 
            }
          });
    }
    async copyFileObject(mergedFile,eventEmitter){
      await this.wait_for_flush()
      return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(this.path);
        const writeStream = fs.createWriteStream(mergedFile.path);
    
        // Copy each data chunk manually
        readStream.on('data', (chunk) => {
          const canWrite = writeStream.write(chunk);
          if (!canWrite) {
            readStream.pause(); // Pause if the write buffer is full
            writeStream.once('drain', () => readStream.resume()); // Resume after draining
          }
        });
    
        // End the write stream when the read stream ends
        readStream.on('end', () => {
          writeStream.end();
        });
    
        // Resolve the promise when the write stream finishes
        writeStream.on('finish', () => {
          
        });
    
        // Handle errors
        readStream.on('error', (err) => reject(err));
        writeStream.on('error', (err) => reject(err));
        // Closing events to confirm file descriptors are closed
        readStream.on('close', () => {});
        writeStream.on('close', () => {
          /* false && console.log('File was copied successfully to ', mergedFile.path); */ 
          this.control_size(this.path,mergedFile.path,eventEmitter, mergedFile)
          resolve();
        });
      });
      
    }
      
    async copyTempFile(oldpath,eventEmitter){
        await this.wait_for_flush()
        return new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(oldpath);
          const writeStream = fs.createWriteStream(this.path);
      
          // Copy each data chunk manually
          readStream.on('data', (chunk) => {
            const canWrite = writeStream.write(chunk);
            if (!canWrite) {
              readStream.pause(); // Pause if the write buffer is full
              writeStream.once('drain', () => readStream.resume()); // Resume after draining
            }
          });
      
          // End the write stream when the read stream ends
          readStream.on('end', () => {
            writeStream.end();
          });
      
          // Resolve the promise when the write stream finishes
          writeStream.on('finish', () => {
           
          });
      
          // Handle errors
          readStream.on('error', (err) => reject(err));
          writeStream.on('error', (err) => reject(err));
          // Closing events to confirm file descriptors are closed
          readStream.on('close', () => {});
          writeStream.on('close', () => {
            /* false && console.log('File was copied successfully to ', this.path); */ 
            this.control_size(oldpath,this.path,eventEmitter, oldpath)
            resolve();
          });
          
        });
        
      }

    control_size(oldpath,newpath,eventEmitter,file){
      var old_filesize = fs.statSync(oldpath).size;
      var timer =setInterval(() => {
        var new_filesize = fs.statSync(newpath).size;
        if(new_filesize == old_filesize){
          clearInterval(timer)
          /* false && console.log('emitted\n') */
          eventEmitter.emit('FileCopied',(file))

        }
      }, 1);
    }
    closeFiles(closePath,filehashPath, filehash,metadata_hash){
      this.flush_pending_appends(() => {
        const masterfilewriteStream = fs.createWriteStream(closePath + this.name+'.txt', {flags : 'a'});
        const masterFilereadStream = fs.createReadStream(this.path);
        const fileHashwriteStream = fs.createWriteStream(filehashPath + this.name+'.txt');
        fileHashwriteStream.write(filehash)
        masterfilewriteStream.write(metadata_hash+'\n')
        masterFilereadStream.pipe(masterfilewriteStream)
        masterfilewriteStream.on('error', (err) => {
          console.error('Error writing to the destination file:', err);
        });
        
        // Log completion when the writing is done
        masterfilewriteStream.on('finish', () => {
          /* false && console.log('File has been successfully copied.\n\n'); */
        });
      })
    }
    
    
    
}
module.exports= File
