var events = require('events');

// Function to calculate the mean
function calculateMean(arr) {
    return arr.reduce((acc, val) => acc + Number(val.Data), 0) / arr.length;
  }
  
  // Function to calculate the standard deviation
  function calculateStandardDeviation(arr) {
    const mean = calculateMean(arr);
    const variance = arr.reduce((acc, val) => acc + Math.pow(Number(val.Data) - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
  
  // Function to check if excluded value falls within boundaries
  function checkBoundaries(arr, value) {
    if (arr.length <= 1) return true;
  
    const mean = calculateMean(arr);
    const stdDev = calculateStandardDeviation(arr);
  
    const lowerBoundary = mean - 4 * stdDev;
    const upperBoundary = mean + 4 * stdDev;
  
    return Number(value.Data) >= lowerBoundary && Number(value.Data) <= upperBoundary;
  }
  
  // Main function to perform the operations
  function start_standardDev(arr,standardDev_eventEmitter) {
    var real_length =arr.length  //so in case an item was deleted from arr the length for the index will not change 
    arr.forEach((value, index) => {
        const arrWithoutValue = arr.filter((_, i) => i !== index);
        const withinBoundaries = checkBoundaries(arrWithoutValue, value);
      if(!withinBoundaries ){arr = arr.filter(item => item !== value); }
      /* false && console.log(withinBoundaries) */
      if(index == real_length -1 ){ 
        standardDev_eventEmitter.emit('StandardDev',(arr))
      }
    });
  }

function  start_2_actors_softrules(arr,standardDev_eventEmitter){ //**** NEED TO BE MODIFIED *****/
  var real_length =arr.length  //so in case an item was deleted from arr the length for the index will not change 
  arr.forEach((value, index) => {
    if ((Number(value.Data) < 0 || isNaN(Number(value.Data))) && value.Data != undefined){
      arr = arr.filter(item => item !== value);
    }
  if(index == real_length -1 ){ 
    standardDev_eventEmitter.emit('StandardDev',(arr))
  }
});

}  

  async function applie_actors_sofrules(chunked_array ,eventEmitter,machineIDS) {
   
    var finish_counter=0
    var result = []
    var standardDev_eventEmitter = new events.EventEmitter()
    standardDev_eventEmitter.on('StandardDev',async(arr)=>{
      finish_counter++
        result =result.concat(arr.flat())
        if(finish_counter == chunked_array.length){
            var sorted_array= result.sort((a, b) => a.Timestamp - b.Timestamp);
            
            var ordered_array= await ordering(sorted_array,machineIDS)
            eventEmitter.emit('StandardDevExamDone',(ordered_array))

        }
    })
    if(machineIDS.length > 2){
      chunked_array.forEach(array=>{
        start_standardDev(array,standardDev_eventEmitter)
      })
    }else{
      chunked_array.forEach(array=>{
        start_2_actors_softrules(array,standardDev_eventEmitter)
      })
    }
    

  }

async function ordering(arr,machineIDS){ // order every transaction to its corresponding ack
    let result =[]
        for(let i =0; i< arr.length; i++){
            if(arr[i].Replier==  undefined){// it is a transaction
              var counter =0
                // we need to find its ACK
                for(let a=0;a<machineIDS.length;a++){
                  if(machineIDS[a]!= arr[i].Requester){
                    let corresponding_replie =  arr.find(item => (item.Timestamp === arr[i].Timestamp && item.Replier === machineIDS[a]));
                if(corresponding_replie != undefined && counter ==0 ){
                  counter++
                       result.push(arr[i])
                       result.push(corresponding_replie)
                      }else if (corresponding_replie != undefined && counter !=0 ){

                       result.push(corresponding_replie)

                      }
                  }
                }
             }   
        }
    return result
}  
  

  
module.exports =applie_actors_sofrules  
