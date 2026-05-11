

function summary_hardrules(array ,summary_file){ // if there was a tampering process append the message to the summary
    let result_array= count_occurance(array)
    if(result_array.length != 0){
        summary_file.append_to_file('\nTampering detected: \n' )
        let data= result_array.map(item => JSON.stringify(item)).join('\n'); 
        summary_file.append_to_file( data )
        return true
    }else{return false}
}
function count_occurance(array){ // see if a machine sent a differet messages to the other machine 
    var repeated_object=[]
    array.forEach(element => {
        var i= 0 ; var count=0;
        while(i<= array.length){
            if(i< array.length){
                if(element.Replier == undefined){// itis a transaction 
                    if(element.Timestamp == array[i].Timestamp && element.Requester == array[i].Requester  &&  element.Data != array[i].Data){
                    
                        count++
                    }
                }else{ // the element is An ACK
                    if(element.Timestamp == array[i].Timestamp && element.Replier == array[i].Replier  &&  element.Data != array[i].Data ){
                        count++
                    }

                }
                
            }else{
               if(count > 0){repeated_object.push(element)}
            }
            i++
            
        }
    });
    return repeated_object;
}
module.exports={summary_hardrules}