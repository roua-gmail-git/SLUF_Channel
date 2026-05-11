const fs = require('fs')
const Sorting = require('../largeSteps/sortChunks')
const sortDeleteMergeChunks=require('../largeSteps/mergeChunks')
const events = require('events')
const readline = require('readline');
const splitbothFiles=require('./splitfile')
const processFiles= require('./processingFiles')
const create_directory= require('../largeSteps/os')
const cleanUpTempFiles= require('../largeSteps/clean')


 async function mergingFiles(mergedFile ,eventEmitter,filePaths_array,myfile) {
    var my_tmpDir= await create_directory( myfile.name.slice(0,8))
    var dirname= myfile.name.slice(0,8)+'/'
    let merging_eventEmitter= new events.EventEmitter()
    var i =0
    merging_eventEmitter.on('FileCopied',async (mergedfileRenamed)=>{
        cleanUpTempFiles(my_tmpDir)
        eventEmitter.emit('mergingISdone',mergedfileRenamed)
    })
    merging_eventEmitter.on('mergingISdone', async ()=>{
        i++ 
        if(i== filePaths_array.length ){
            /* false && console.log('copiedfile' , mergedFile.path , myfile) */
            await myfile.copyFileObject(mergedFile,merging_eventEmitter)
           
           /*setTimeout(() => {
            merging_eventEmitter.emit('FileRenamed',(mergedFile))
           }, 1000);*/
          // merging_eventEmitter.emit('FileCopied',(mergedFile))


        }
    })
    
    
    merging_eventEmitter.on('ChunksSorted_duplicatesRemoved_Merged',async (merging_temp_dir_name)=>{
         await splitbothFiles(myfile.path, merging_temp_dir_name+'/sorted_others_file.txt',dirname+'myfileChunks_'+ myfile.name.slice(0,8),dirname+'othersfileChunks_'+merging_temp_dir_name.slice(21) )
         await processFiles(myfile.path,dirname+'myfileChunks_'+ myfile.name.slice(0,8),dirname+'othersfileChunks_'+ merging_temp_dir_name.slice(21),merging_eventEmitter)
    })
    merging_eventEmitter.on('ChunkedAndSorted', (sorting_temp_dir_name)=>{
        var merging_temp_dir_name =dirname+'merging_after_'+sorting_temp_dir_name.slice(9)
        sortDeleteMergeChunks('sorted_others_file.txt',sorting_temp_dir_name, merging_temp_dir_name,merging_eventEmitter)
    })

    for(let i=0; i< filePaths_array.length ; i++){
        start_mergingProcess(merging_eventEmitter,myfile, filePaths_array[i],dirname)
    }
    
        
        
}

function start_mergingProcess(merging_eventEmitter,myfile,othersfilepath,dirname){
    var sorting_temp_dir_name =dirname+'sorting_'+  myfile.name.slice(0,8)+'_'+othersfilepath.slice(-8)
    
    Sorting(othersfilepath+'.txt.gz', sorting_temp_dir_name ,merging_eventEmitter) // only the othersfile should be sorted
}
module.exports= mergingFiles
