import Constant from "./constant.js";

const ELE_FLDR_MAP = {"BUILDINGS" : "building_tiles", "BARE_EARTH" : "dem_tiles"}
const RES_FLDR_MAP = {"ONE_METER" : "L04", "FIVE_METER" : "L03", "TEN_METER" : "L02", 
                      "TWENTY_FIVE_METER" : "L01", "FIFTY_METER" : "L00"}
const TOTAL_IMAGES = {"BUILDINGS" : {"ONE_METER" : 13686, "FIVE_METER" : 610, "TEN_METER" : 174, 
                                     "TWENTY_FIVE_METER" : 35, "FIFTY_METER" : 12}, 
                      "BARE_EARTH" : {"ONE_METER" : 13686, "FIVE_METER" : 610, "TEN_METER" : 174, 
                                      "TWENTY_FIVE_METER" : 35, "FIFTY_METER" : 12} }
class Api {
  getImage(resolution, indexRow, indexCol, elevation) {
    return new Promise(function (resolve, reject) {
          var img = new Image()
          img.src = "./georeferenced-images/"+ELE_FLDR_MAP[elevation]+"/_alllayers/"+RES_FLDR_MAP[resolution]+"/"+indexRow+"/"+indexCol+".png"
          img.onload = function() {
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            var dataURL = canvas.toDataURL("image/png");
            resolve(dataURL)
          }
          img.onerror = function() {
            var dummyImg = new Image()
            dummyImg.src = "./img/dummy.png"
            dummyImg.onload = function() {
              var canvas = document.createElement("canvas");
              canvas.width = dummyImg.width;
              canvas.height = dummyImg.height;
              var ctx = canvas.getContext("2d");
              ctx.drawImage(dummyImg, 0, 0);
              var dataURL = canvas.toDataURL("image/png");
              resolve(dataURL)
            }
            dummyImg.onerror = function() {
              reject(new Error("Error occurred in reading image from folder."))
            }

          }
        
      })
   
  }

  getStats(elevation, resolution) {
    return new Promise(function(resolve, reject){
      resolve({[Constant.TOTAL_IMAGES] : TOTAL_IMAGES[elevation][resolution]})
    })
  }
    

}

let api = new Api();
export default api;
