import RasterBusiness from "./rasterbusiness.js";
import Constant from "./constant.js";

export default class Raster {
  /**
   * Gets image data url according to the specified indexes, position and area.
   * Merges the images specified in indexes in one canvas and
   * extracts the desired image from that canvas according to given
   * x,y pixel coordinate in position object
   *
   * @param {array} indexes index objects with row and column number
   * property of images in the region of interest.
   * @param {dictionary} position object containing X, Y coordinates of the image inside region of interest.
   * @param {string} resolution resolution of the images.
   * @param {number} area dimension of the desired image insided the for which the position is given
   * @returns {Promise} Promise that will return dataURL/base64 representation of desired image
   */

  getImage(indexes, roiDimension, position, resolution, elevation, area) {
    return this._getSelectedImageDataUrl(
      indexes,
      roiDimension,
      position,
      resolution,
      elevation,
      area
    );
  }

  _getSelectedImageDataUrl(
    indexes,
    roiDimension,
    position,
    resolution,
    elevation,
    area
  ) {
    return new Promise((resolve, reject) => {
      RasterBusiness.getImage(
        indexes,
        roiDimension,
        this._getResInWord(resolution),
        elevation
      )
        .then((canvas) => {
          canvas.id = "canvas";
          resolve(
            this._getDesiredImageDataUrl(canvas, resolution, position, area)
          );
          //resolve(canvas.toDataURL())
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  _getDesiredImageDataUrl(canvas, resolution, position, dimension) {
    let dataUrl = null;
    if (position["x"] >= 0 && position["y"] >= 0) {
      let subImageCanvas = document.createElement("canvas");
      subImageCanvas.id = "subImageCanvas";
      subImageCanvas.width = dimension / resolution;
      subImageCanvas.height = dimension / resolution;
      // cutting image
      subImageCanvas
        .getContext("2d")
        .drawImage(
          canvas,
          position["x"],
          position["y"],
          subImageCanvas.width,
          subImageCanvas.height,
          0,
          0,
          subImageCanvas.width,
          subImageCanvas.height
        );
      dataUrl = subImageCanvas.toDataURL();
    } else {
      console.log("Given position is invalid");
    }
    return dataUrl;
  }

  _getResInWord(res) {
    let resolution = "";
    if (res == "1") resolution = Constant.ONE_METER;
    else if (res == "5") resolution = Constant.FIVE_METER;
    else if (res == "10") resolution = Constant.TEN_METER;
    else if (res == "25") resolution = Constant.TWENTY_FIVE_METER;
    else if (res == "50") resolution = Constant.FIFTY_METER;
    return resolution;
  }
}
