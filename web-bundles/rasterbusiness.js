import Constant from './constant.js'
import Api from "./api.js";

class RasterBusiness {

    /**
     * Gets image from the database according to the specified index locations from the given resolution.
     * Merges these images in one canvas
     *
     * @param {array} indexes index of the sub images.
     * @param {string} resolution resolution of the bigger image from which the subimages will be extracted
     * @returns {Promise} Promise which will return HTML5Canvas containing all the images from specified indexes
     */
    getImage(indexes, roiDimension, resolution, elevation) {
        return new Promise(function (resolve, reject) {
            rasterBusinessInst._getCanvas(indexes, roiDimension, resolution, elevation).then(canvas => {
                resolve(canvas)
            }).catch(error => {
                reject(error);
            })
        })
    }

    _getCanvas(indexes, roiDimension, resolution, elevation) {
        return new Promise((resolve, reject) => {
            let canvas = document.createElement('canvas');
            canvas.id = "canvas"
            let context = canvas.getContext('2d');
            let rows = roiDimension["rows"]
            let cols = roiDimension["cols"]
            canvas.width = 0
            canvas.height = 0
            let positionX = 0
            let positionY = 0
            let imagesMerged = 0
            let total_images_to_merge = indexes.length
            //adding element for dummy iteration
            // in order to wait for promise for last image
            let clonedindexes = Array.from(indexes)
            clonedindexes[clonedindexes.length] = undefined
            // waits for previous promise in chain to execute before executing promise for the next item(index)
            clonedindexes.reduce(async (previousGetImagePromise, index) => {
                await previousGetImagePromise.then(imageDataURL => {
                    //in case of first dummy resolve    
                    if (imageDataURL != null) {
                        let img = new Image()
                        img.src = imageDataURL
                        img.onload = function () {
                            if (imagesMerged == 0) {
                                canvas.width = img.width * cols
                                canvas.height = img.height * rows
                            }
                            img.style.objectFit = "fill";
                            context.drawImage(img, 0, 0, img.width, img.height, positionX, positionY, img.width, img.height)
                            positionX += img.width
                            if ((imagesMerged + 1) % cols == 0) {
                                positionX = 0
                                positionY += img.height
                            }
                            imagesMerged++
                            if (imagesMerged == total_images_to_merge) {
                                resolve(canvas)
                            }
                        }
                    }
                }).catch(error => {
                    reject(error)
                })

                //undefined check to wait for promise of last index
                if (index != undefined) {
                    let indexRow = index[Constant.INDEX_ROW];
                    let indexCol = index[Constant.INDEX_COL];
                    return Api.getImage(resolution, indexRow, indexCol, elevation)
                } else {
                    return null
                }
            }, Promise.resolve())
        })
    }
}

//singleton object
const rasterBusinessInst = new RasterBusiness()
export default rasterBusinessInst