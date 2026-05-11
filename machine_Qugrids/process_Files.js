
// create the files needed for the process


class processFiles{
    constructor(File_class,machine_ID){
        this.File_class = File_class // th class File to create and manage files 
        this.machine_ID= machine_ID // this machine ID
        this.masterfile_under_modifications // file that all data are going to be stored in
        this.masterfile_after_END // file that the correct data is going to be stored in after the end filtering process
        this.summaryFile 
        this.auditorFile  
        this.mergedFile //file where all the collect data including mine are going to be stored in after calling the internal judge
        this.DataFile_array=[]
    }
    create_masterfile_under_modifications(){
        this.masterfile_under_modifications = new this.File_class('under_modification',this.machine_ID+'_masterfile_under_modifications_' +Date.now())
    }
    create_masterfile_after_END(){
        this.masterfile_after_END = new this.File_class('Ended',this.machine_ID+'_masterfile_after_END_' +Date.now())
    }
    create_auditor_summaryFiles(){
        this.summaryFile= new this.File_class('Auditor_Files/Summaries',this.masterfile_after_END.name)
        this.auditorFile= new this.File_class('Auditor_Files/closed',this.masterfile_after_END.name)
    }
    create_mergedFile(){
        this.mergedFile= new this.File_class('Auditor_Files/under_modifications',this.masterfile_after_END.name)
    }
    

}
module.exports = processFiles